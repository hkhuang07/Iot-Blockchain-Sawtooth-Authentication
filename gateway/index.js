//Smart Garden IoT Gateway

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
const { createContext, CryptoFactory } = require('sawtooth-sdk/signing');
const { protobuf } = require('sawtooth-sdk');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const context = createContext('secp256k1');
const privateKey = context.newRandomPrivateKey();
const signer = new CryptoFactory(context).newSigner(privateKey)
console.log("Public Key thiết bị:", signer.getPublicKey().asHex());


// Configuration
const CONFIG = {
    VALIDATOR_URL: process.env.VALIDATOR_URL || 'http://rest-api-0:8008',
    MONGO_URL: process.env.MONGO_URL || 'mongodb://admin:password123@mongodb:27017',
    GARDEN_FAMILY_NAME: process.env.GARDEN_FAMILY_NAME || 'GardenContract',
    GARDEN_FAMILY_VERSION: process.env.GARDEN_FAMILY_VERSION || '1.0',
    DEVICE_KEYS_DIR: process.env.DEVICE_KEYS_DIR || '/app/keys',
    PORT: parseInt(process.env.PORT) || 3000
};

// Global state
const app = express();
const eventEmitter = new EventEmitter();
let context;
let cryptoFactory;

// Device Schema
const deviceSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    deviceName: String,
    publicKey: { type: String, required: true },
    privateKey: { type: String, required: true }, // Encrypted
    registered: { type: Boolean, default: false },
    whitelisted: { type: Boolean, default: false },
    registeredAt: Date,
    lastReading: {
        temperature: Number,
        humidity: Number,
        timestamp: Date,
        pumpStatus: String
    },
    lastUpdate: Date
});

deviceSchema.index({ deviceId: 1 });
deviceSchema.index({ publicKey: 1 });

const Device = mongoose.model('Device', deviceSchema);

// Transaction Schema for History
const transactionSchema = new mongoose.Schema({
    transactionId: { type: String, required: true, unique: true },
    blockId: String,
    blockNumber: Number,
    deviceId: String,
    action: String,
    payload: mongoose.Schema.Types.Mixed,
    signerPublicKey: String,
    timestamp: Date,
    status: String,
    createdAt: { type: Date, default: Date.now }
});

transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ blockId: 1 });
transactionSchema.index({ deviceId: 1 });
transactionSchema.index({ timestamp: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

//Generate SHA512 hash
function hash(data) {
    return crypto.createHash('sha512').update(data).digest('hex');
}

/**
 * Generate address for GardenContract family
 * Format: 70 chars (6 chars prefix + 64 chars device hash)
*/
function getAddress(deviceId) {
    const prefix = hash(CONFIG.GARDEN_FAMILY_NAME).substring(0, 6);
    const deviceHash = hash(deviceId).substring(0, 64);
    return prefix + deviceHash;
}

//Load device key from file or generate new one

function loadOrCreateDeviceKey(deviceId) {
    const keyPath = path.join(CONFIG.DEVICE_KEYS_DIR, `${deviceId}.key`);
    
    if (fs.existsSync(keyPath)) {
        const privateKey = fs.readFileSync(keyPath, 'utf8').trim();
        return privateKey;
    }
    
    // Generate new key pair
    const privateKey = context.newRandomPrivateKey();
    const privateKeyHex = privateKey.asHex();
    
    // Ensure directory exists
    if (!fs.existsSync(CONFIG.DEVICE_KEYS_DIR)) {
        fs.mkdirSync(CONFIG.DEVICE_KEYS_DIR, { recursive: true });
    }
    
    // Save private key
    fs.writeFileSync(keyPath, privateKeyHex);
    
    // Also save public key
    const publicKey = cryptoFactory.getPublicKey(privateKey);
    fs.writeFileSync(path.join(CONFIG.DEVICE_KEYS_DIR, `${deviceId}.pub`), publicKey.asHex());
    
    console.log(`[Gateway] Generated new key pair for device: ${deviceId}`);
    return privateKeyHex;
}

// Create and submit transaction to blockchain
async function submitTransaction(deviceId, action, payload) {
    try {
        // Get or create device key
        const privateKeyHex = loadOrCreateDeviceKey(deviceId);
        const privateKey = context.fromHex(privateKeyHex);
        const publicKey = cryptoFactory.getPublicKey(privateKey);
        const publicKeyHex = publicKey.asHex();
        
        // Create transaction header
        const familyName = CONFIG.GARDEN_FAMILY_NAME;
        const familyVersion = CONFIG.GARDEN_FAMILY_VERSION;
        
        // Create payload
        const payloadBytes = Buffer.from(JSON.stringify({
            action: action,
            device_id: deviceId,
            ...payload,
            timestamp: new Date().toISOString()
        }));
        
        // Create input and output addresses
        const address = getAddress(deviceId);
        
        const header = protobuf.TransactionHeader.create({
            familyName: familyName,
            familyVersion: familyVersion,
            inputs: [address],
            outputs: [address],
            signerPublicKey: publicKeyHex,
            nonce: crypto.randomBytes(16).toString('hex'),
            batcherPublicKey: publicKeyHex,
            dependencies: [],
            payloadSha512: hash(payloadBytes.toString())
        });
        
        // Sign the header
        const headerBytes = header.toBuffer();
        const signature = cryptoFactory.sign(header, privateKey);
        
        // Create transaction
        const transaction = protobuf.Transaction.create({
            header: headerBytes,
            headerSignature: signature,
            payload: payloadBytes
        });
        
        // Create batch
        const batchHeader = protobuf.BatchHeader.create({
            signerPublicKey: publicKeyHex,
            transactionIds: [signature]
        });
        
        const batchHeaderBytes = batchHeader.toBuffer();
        const batchSignature = cryptoFactory.sign(batchHeader, privateKey);
        
        const batch = protobuf.Batch.create({
            header: batchHeaderBytes,
            headerSignature: batchSignature,
            transactions: [transaction]
        });
        
        // Create batch list
        const batchList = protobuf.BatchList.create({
            batches: [batch]
        });
        
        const batchListBytes = batchList.toBuffer();
        
        // Submit to validator
        const response = await axios.post(
            `${CONFIG.VALIDATOR_URL}/batches`,
            batchListBytes,
            {
                headers: {
                    'Content-Type': 'application/octet-stream'
                }
            }
        );
        
        console.log(`[Gateway] Transaction submitted successfully: ${signature}`);
        
        // Store in MongoDB
        const txRecord = new Transaction({
            transactionId: signature,
            deviceId: deviceId,
            action: action,
            payload: { action, deviceId, ...payload },
            signerPublicKey: publicKeyHex,
            timestamp: new Date(),
            status: 'SUBMITTED'
        });
        await txRecord.save();
        
        return {
            success: true,
            transactionId: signature,
            batchId: response.data.link
        };
        
    } catch (error) {
        console.error('[Gateway] Transaction submission failed:', error.message);
        throw error;
    }
}

//Register a new device
async function registerDevice(deviceId, deviceName) {
    try {
        // Get or create device key
        const privateKeyHex = loadOrCreateDeviceKey(deviceId);
        const privateKey = context.fromHex(privateKeyHex);
        const publicKey = cryptoFactory.getPublicKey(privateKey);
        const publicKeyHex = publicKey.asHex();
        
        // Create transaction
        const result = await submitTransaction(deviceId, 'REGISTER_DEVICE', {
            device_name: deviceName
        });
        
        // Update MongoDB
        let device = await Device.findOne({ deviceId });
        if (!device) {
            device = new Device({
                deviceId,
                publicKey: publicKeyHex,
                privateKey: privateKeyHex, // In production, encrypt this!
                registered: true,
                whitelisted: true,
                registeredAt: new Date(),
                deviceName
            });
        } else {
            device.publicKey = publicKeyHex;
            device.privateKey = privateKeyHex;
            device.registered = true;
            device.whitelisted = true;
            device.registeredAt = new Date();
            if (deviceName) device.deviceName = deviceName;
        }
        await device.save();
        
        return result;
        
    } catch (error) {
        console.error(`[Gateway] Device registration failed: ${error.message}`);
        throw error;
    }
}

// API Routes

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// CORS headers
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Health check
app.get('/health', async (req, res) => {
    try {
        const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        res.json({
            status: 'healthy',
            mongodb: mongoStatus,
            validator: CONFIG.VALIDATOR_URL,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Register device
app.post('/api/devices/register', async (req, res) => {
    try {
        const { device_id, device_name } = req.body;
        
        if (!device_id) {
            return res.status(400).json({ error: 'device_id is required' });
        }
        
        const result = await registerDevice(device_id, device_name);
        res.json({
            success: true,
            message: `Device ${device_id} registered successfully`,
            ...result
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send telemetry data
app.post('/api/telemetry', async (req, res) => {
    try {
        const { device_id, temperature, humidity } = req.body;
        
        if (!device_id || temperature === undefined || humidity === undefined) {
            return res.status(400).json({
                error: 'device_id, temperature, and humidity are required'
            });
        }
        
        // Validate range
        if (temperature < -40 || temperature > 85) {
            return res.status(400).json({ error: 'Invalid temperature value' });
        }
        if (humidity < 0 || humidity > 100) {
            return res.status(400).json({ error: 'Invalid humidity value' });
        }
        
        const result = await submitTransaction(device_id, 'SEND_TELEMETRY', {
            temperature: parseFloat(temperature),
            humidity: parseFloat(humidity)
        });
        
        res.json({
            success: true,
            message: 'Telemetry data submitted',
            ...result
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get device info
app.get('/api/devices/:deviceId', async (req, res) => {
    try {
        const device = await Device.findOne({ deviceId: req.params.deviceId });
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }
        
        // Don't return private key
        const { privateKey, ...safeDevice } = device.toObject();
        res.json(safeDevice);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all devices
app.get('/api/devices', async (req, res) => {
    try {
        const devices = await Device.find({}, '-privateKey');
        res.json(devices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get transaction history
app.get('/api/transactions', async (req, res) => {
    try {
        const { device_id, limit = 50 } = req.query;
        const query = device_id ? { deviceId: device_id } : {};
        const transactions = await Transaction.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get transaction by ID
app.get('/api/transactions/:id', async (req, res) => {
    try {
        const transaction = await Transaction.findOne({ transactionId: req.params.id });
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        res.json(transaction);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Manual pump control
app.post('/api/pump/control', async (req, res) => {
    try {
        const { device_id, action } = req.body;
        
        if (!device_id || !action) {
            return res.status(400).json({ error: 'device_id and action are required' });
        }
        
        if (!['ON', 'OFF'].includes(action)) {
            return res.status(400).json({ error: 'Action must be ON or OFF' });
        }
        
        // Submit manual control as telemetry with pump status
        const result = await submitTransaction(device_id, 'SEND_TELEMETRY', {
            temperature: 25, // Default values for manual control
            humidity: 50,
            manual_pump_control: action
        });
        
        res.json({
            success: true,
            message: `Pump ${action} command submitted`,
            ...result
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Socket.io event emitter for real-time updates
app.set('eventEmitter', eventEmitter);

// Initialization
async function initialize() {
    try {
        console.log('[Gateway] Initializing Smart Garden IoT Gateway...');
        
        // Initialize signing context
        context = createContext('secp256k1');
        cryptoFactory = new CryptoFactory(context);
        console.log('[Gateway] Signing context initialized');
        
        // Connect to MongoDB
        await mongoose.connect(CONFIG.MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('[Gateway] Connected to MongoDB');
        
        // Ensure indexes
        await Device.ensureIndexes();
        await Transaction.ensureIndexes();
        console.log('[Gateway] Database indexes created');
        
        // Start server
        app.listen(CONFIG.PORT, () => {
            console.log(`[Gateway] Server listening on port ${CONFIG.PORT}`);
            console.log(`[Gateway] Validator URL: ${CONFIG.VALIDATOR_URL}`);
        });
        
    } catch (error) {
        console.error('[Gateway] Initialization failed:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('[Gateway] Shutting down...');
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('[Gateway] Shutting down...');
    await mongoose.connection.close();
    process.exit(0);
});

// Start the gateway
initialize();

module.exports = { app, submitTransaction, registerDevice, eventEmitter };
