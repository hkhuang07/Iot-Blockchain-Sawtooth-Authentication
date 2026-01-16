/**
 * Smart Garden Event Subscriber
 * 
 * This service listens to Sawtooth blockchain events, synchronizes
 * block and transaction data to MongoDB, and broadcasts updates
 * to the frontend via Socket.io.
 */

const { ZmqEventSubscriber } = require('sawtooth-sdk/event');
const { protobuf } = require('sawtooth-sdk');
const mongoose = require('mongoose');
const axios = require('axios');
const http = require('http');
const EventEmitter = require('events');

// Configuration
const CONFIG = {
    VALIDATOR_URL: process.env.VALIDATOR_URL || 'tcp://validator-0:4004',
    MONGO_URL: process.env.MONGO_URL || 'mongodb://admin:password123@mongodb:27017',
    SOCKET_SERVER: process.env.SOCKET_SERVER || 'http://dashboard:8080',
    SOCKET_PATH: process.env.SOCKET_PATH || '/ws',
    POLL_INTERVAL: parseInt(process.env.POLL_INTERVAL) || 1000
};

// Global state
let socket = null;
let subscriber = null;
let isConnected = false;
let lastBlockNum = 0;

// ============================================
// MongoDB Schemas
// ============================================

// Block Schema
const blockSchema = new mongoose.Schema({
    blockId: { type: String, required: true, unique: true },
    blockNumber: { type: Number, required: true, index: true },
    previousBlockId: String,
    stateRootHash: String,
    batchIds: [String],
    batchCount: Number,
    transactions: [{
        transactionId: String,
        deviceId: String,
        action: String,
        payload: mongoose.Schema.Types.Mixed,
        signerPublicKey: String,
        status: String
    }],
    transactionCount: Number,
    consensus: String,
    createdAt: { type: Date, default: Date.now },
    receivedAt: { type: Date, default: Date.now }
});

blockSchema.index({ blockId: 1 });
blockSchema.index({ previousBlockId: 1 });

const Block = mongoose.model('Block', blockSchema);

// Device State Schema (current state from blockchain)
const deviceStateSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    deviceName: String,
    publicKey: String,
    registered: Boolean,
    whitelisted: Boolean,
    registeredAt: Date,
    lastReading: {
        temperature: Number,
        humidity: Number,
        timestamp: Date,
        pumpStatus: String
    },
    lastUpdate: Date,
    blockNumber: Number,
    updatedAt: { type: Date, default: Date.now }
});

deviceStateSchema.index({ deviceId: 1 });
deviceStateSchema.index({ lastReading: 1 });

const DeviceState = mongoose.model('DeviceState', deviceStateSchema);

// ============================================
// Helper Functions
// ============================================

/**
 * Send event to frontend via Socket.io
 */
function sendToFrontend(eventType, data) {
    if (!socket) {
        console.log('[Subscriber] No socket connection, skipping event');
        return;
    }
    
    try {
        const payload = JSON.stringify({
            type: eventType,
            data: data,
            timestamp: new Date().toISOString()
        });
        
        const options = {
            hostname: new URL(CONFIG.SOCKET_SERVER).hostname,
            port: new URL(CONFIG.SOCKET_SERVER).port || 80,
            path: CONFIG.SOCKET_PATH,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };
        
        const req = http.request(options, (res) => {
            if (res.statusCode !== 200) {
                console.log('[Subscriber] Socket server responded with:', res.statusCode);
            }
        });
        
        req.on('error', (error) => {
            console.log('[Subscriber] Socket connection error:', error.message);
        });
        
        req.write(payload);
        req.end();
        
        console.log(`[Subscriber] Event sent: ${eventType}`);
        
    } catch (error) {
        console.error('[Subscriber] Failed to send event:', error.message);
    }
}

/**
 * Fetch block details from REST API
 */
async function fetchBlockDetails(blockId) {
    try {
        const response = await axios.get(
            `http://rest-api-0:8008/blocks/${blockId}`,
            { timeout: 5000 }
        );
        return response.data;
    } catch (error) {
        console.error(`[Subscriber] Failed to fetch block ${blockId}:`, error.message);
        return null;
    }
}

/**
 * Parse transaction payload
 */
function parsePayload(payloadBytes) {
    try {
        return JSON.parse(payloadBytes.toString());
    } catch (error) {
        return { raw: payloadBytes.toString('hex') };
    }
}

/**
 * Extract device ID from transaction
 */
function extractDeviceId(payload) {
    if (payload.device_id) {
        return payload.device_id;
    }
    return null;
}

/**
 * Process and store a new block
 */
async function processBlock(blockData) {
    try {
        const { block_id, block_num, previous_block_id, state_root_hash } = blockData.block;
        
        // Skip genesis block
        if (block_num === 0) {
            console.log('[Subscriber] Skipping genesis block');
            return;
        }
        
        // Check if block already exists
        const existingBlock = await Block.findOne({ blockId: block_id });
        if (existingBlock) {
            console.log(`[Subscriber] Block ${block_num} already processed`);
            return;
        }
        
        // Extract transactions from batches
        const batchIds = blockData.block.batches.map(b => b.header_signature);
        const transactions = [];
        
        for (const batch of blockData.block.batches) {
            for (const tx of batch.transactions) {
                const payload = parsePayload(tx.payload);
                const deviceId = extractDeviceId(payload);
                
                transactions.push({
                    transactionId: tx.header_signature,
                    deviceId: deviceId,
                    action: payload.action || 'UNKNOWN',
                    payload: payload,
                    signerPublicKey: tx.header.signer_public_key,
                    status: tx.status || 'COMMITTED'
                });
                
                // Update device state if applicable
                if (deviceId && payload.action === 'SEND_TELEMETRY') {
                    await updateDeviceState(deviceId, payload, block_num);
                }
            }
        }
        
        // Create block record
        const blockRecord = new Block({
            blockId: block_id,
            blockNumber: parseInt(block_num),
            previousBlockId: previous_block_id,
            stateRootHash: state_root_hash,
            batchIds: batchIds,
            batchCount: blockData.block.batches.length,
            transactions: transactions,
            transactionCount: transactions.length,
            consensus: blockData.block.consensus ? blockData.block.consensus.toString('hex') : null
        });
        
        await blockRecord.save();
        
        console.log(`[Subscriber] Block ${block_num} stored with ${transactions.length} transactions`);
        
        // Update last processed block
        if (parseInt(block_num) > lastBlockNum) {
            lastBlockNum = parseInt(block_num);
        }
        
        // Send update to frontend
        sendToFrontend('NEW_BLOCK', {
            blockNumber: parseInt(block_num),
            blockId: block_id,
            transactionCount: transactions.length,
            transactions: transactions.map(tx => ({
                transactionId: tx.transactionId,
                deviceId: tx.deviceId,
                action: tx.action,
                pumpStatus: tx.payload.pump_status
            }))
        });
        
        // Also send device state updates
        for (const tx of transactions) {
            if (tx.deviceId && tx.action === 'SEND_TELEMETRY') {
                sendToFrontend('DEVICE_UPDATE', {
                    deviceId: tx.deviceId,
                    temperature: tx.payload.temperature,
                    humidity: tx.payload.humidity,
                    pumpStatus: tx.payload.pump_status,
                    timestamp: tx.payload.timestamp
                });
            }
        }
        
        return blockRecord;
        
    } catch (error) {
        console.error('[Subscriber] Block processing failed:', error);
        throw error;
    }
}

/**
 * Update device state in MongoDB
 */
async function updateDeviceState(deviceId, payload, blockNumber) {
    try {
        let deviceState = await DeviceState.findOne({ deviceId });
        
        if (!deviceState) {
            deviceState = new DeviceState({
                deviceId: deviceId,
                registered: true,
                whitelisted: true
            });
        }
        
        // Update reading data
        if (payload.temperature !== undefined) {
            deviceState.lastReading = {
                temperature: payload.temperature,
                humidity: payload.humidity,
                timestamp: payload.timestamp || new Date(),
                pumpStatus: payload.pump_status || 'OFF'
            };
        }
        
        deviceState.lastUpdate = new Date();
        deviceState.blockNumber = blockNumber;
        
        await deviceState.save();
        
    } catch (error) {
        console.error(`[Subscriber] Failed to update device state: ${error.message}`);
    }
}

/**
 * Sync blocks from REST API (fallback method)
 */
async function syncFromRestApi() {
    try {
        console.log('[Subscriber] Syncing blocks from REST API...');
        
        let currentBlock = lastBlockNum;
        let synced = 0;
        
        while (synced < 10) { // Sync up to 10 blocks at a time
            try {
                const response = await axios.get(
                    `http://rest-api-0:8008/blocks?limit=1`,
                    { timeout: 5000 }
                );
                
                if (!response.data.data || response.data.data.length === 0) {
                    break;
                }
                
                const latestBlock = response.data.data[0];
                const latestBlockNum = parseInt(latestBlock.header.block_num);
                
                if (latestBlockNum > currentBlock) {
                    // Fetch detailed block data
                    const blockDetails = await fetchBlockDetails(latestBlock.header_signature);
                    
                    if (blockDetails) {
                        await processBlock(blockDetails);
                        currentBlock = latestBlockNum;
                        synced++;
                    }
                } else {
                    break;
                }
                
            } catch (error) {
                break;
            }
        }
        
        if (synced > 0) {
            console.log(`[Subscriber] Synced ${synced} new blocks`);
        }
        
    } catch (error) {
        console.error('[Subscriber] REST API sync failed:', error.message);
    }
}

/**
 * Start ZMQ event subscription
 */
async function startZmqSubscription() {
    return new Promise((resolve, reject) => {
        try {
            console.log('[Subscriber] Connecting to validator via ZMQ...');
            
            subscriber = new ZmqEventSubscriber(CONFIG.VALIDATOR_URL);
            
            // Subscribe to block commit events
            subscriber.addHandler((event) => {
                console.log('[Subscriber] Received event:', event.eventType);
                
                if (event.eventType === 'sawtooth/block-commit') {
                    const blockId = event.attributes.find(
                        attr => attr.key === 'block_id'
                    )?.value;
                    
                    if (blockId) {
                        fetchBlockDetails(blockId).then(blockData => {
                            if (blockData) {
                                processBlock(blockData);
                            }
                        });
                    }
                }
            });
            
            // Subscribe to state change events
            subscriber.addHandler((event) => {
                if (event.eventType === 'sawtooth/state-change') {
                    console.log('[Subscriber] State change detected');
                    // Could process state changes here
                }
            });
            
            subscriber.connect().then(() => {
                console.log('[Subscriber] ZMQ connected');
                isConnected = true;
                
                // Subscribe to specific events
                subscriber.subscribe('sawtooth/block-commit');
                subscriber.subscribe('sawtooth/state-change');
                
                resolve();
            }).catch(reject);
            
        } catch (error) {
            console.error('[Subscriber] ZMQ subscription failed:', error);
            reject(error);
        }
    });
}

/**
 * Periodic polling for new blocks
 */
function startPolling() {
    setInterval(async () => {
        if (!isConnected) {
            await syncFromRestApi();
        }
    }, CONFIG.POLL_INTERVAL);
    
    console.log(`[Subscriber] Polling every ${CONFIG.POLL_INTERVAL}ms`);
}

// ============================================
// Initialization
// ============================================

async function initialize() {
    try {
        console.log('[Subscriber] Initializing Event Subscriber...');
        
        // Connect to MongoDB
        await mongoose.connect(CONFIG.MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('[Subscriber] Connected to MongoDB');
        
        // Ensure indexes
        await Block.ensureIndexes();
        await DeviceState.ensureIndexes();
        console.log('[Subscriber] Database indexes created');
        
        // Get last processed block
        const lastBlock = await Block.findOne().sort({ blockNumber: -1 });
        if (lastBlock) {
            lastBlockNum = lastBlock.blockNumber;
            console.log(`[Subscriber] Resuming from block ${lastBlockNum}`);
        }
        
        // Try ZMQ subscription first
        try {
            await startZmqSubscription();
        } catch (error) {
            console.log('[Subscriber] ZMQ not available, using REST API polling');
            isConnected = false;
        }
        
        // Start polling as backup
        startPolling();
        
        console.log('[Subscriber] Event Subscriber running');
        
    } catch (error) {
        console.error('[Subscriber] Initialization failed:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('[Subscriber] Shutting down...');
    if (subscriber) {
        await subscriber.disconnect();
    }
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('[Subscriber] Shutting down...');
    if (subscriber) {
        await subscriber.disconnect();
    }
    await mongoose.connection.close();
    process.exit(0);
});

// Start the subscriber
initialize();

module.exports = {
    processBlock,
    updateDeviceState,
    sendToFrontend,
    syncFromRestApi
};
