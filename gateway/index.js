// Smart Garden IoT Gateway - Updated with MQTT Bridge
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
const mqtt = require('mqtt'); // Đã thêm thư viện mqtt
const { createContext, CryptoFactory } = require('sawtooth-sdk/signing');
const { protobuf } = require('sawtooth-sdk');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// Configuration
const CONFIG = {
    VALIDATOR_URL: process.env.VALIDATOR_URL || 'http://rest-api-0:8008',
    MONGO_URL: process.env.MONGO_URL || 'mongodb://admin:password123@mongodb:27017',
    GARDEN_FAMILY_NAME: process.env.GARDEN_FAMILY_NAME || 'GardenContract',
    GARDEN_FAMILY_VERSION: process.env.GARDEN_FAMILY_VERSION || '1.0',
    DEVICE_KEYS_DIR: process.env.DEVICE_KEYS_DIR || '/app/keys',
    PORT: parseInt(process.env.PORT) || 3030,
    MQTT_BROKER_EXTERNAL: "mqtt://broker.hivemq.com", // Cấu hình Broker ngoại vi
    SENSOR_TOPIC: "garden/sensor/temp_hum_data"      // Topic lắng nghe từ ESP32
};

// Global state
const app = express();
const eventEmitter = new EventEmitter();
let context;
let cryptoFactory;

// ============================================
// MongoDB Schemas
// ============================================

const deviceSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    deviceName: String,
    publicKey: { type: String, required: true },
    privateKey: { type: String, required: true }, 
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
const Transaction = mongoose.model('Transaction', transactionSchema);

// ============================================
// Helper Functions
// ============================================

function hash(data) {
    return crypto.createHash('sha512').update(data).digest('hex');
}

function getAddress(deviceId) {
    const prefix = hash(CONFIG.GARDEN_FAMILY_NAME).substring(0, 6);
    const deviceHash = hash(deviceId).substring(0, 64);
    return prefix + deviceHash;
}

function loadOrCreateDeviceKey(deviceId) {
    const keyPath = path.join(CONFIG.DEVICE_KEYS_DIR, `${deviceId}.key`);
    
    if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, 'utf8').trim();
    }
    
    const privateKey = context.newRandomPrivateKey();
    const privateKeyHex = privateKey.asHex();
    
    if (!fs.existsSync(CONFIG.DEVICE_KEYS_DIR)) {
        fs.mkdirSync(CONFIG.DEVICE_KEYS_DIR, { recursive: true });
    }
    
    fs.writeFileSync(keyPath, privateKeyHex);
    const publicKey = cryptoFactory.getPublicKey(privateKey);
    fs.writeFileSync(path.join(CONFIG.DEVICE_KEYS_DIR, `${deviceId}.pub`), publicKey.asHex());
    
    console.log(`[Gateway] Generated new key pair for device: ${deviceId}`);
    return privateKeyHex;
}

// ============================================
// Blockchain Logic
// ============================================

async function submitTransaction(deviceId, action, payload) {
    try {
        const privateKeyHex = loadOrCreateDeviceKey(deviceId);
        const privateKey = context.fromHex(privateKeyHex);
        const publicKeyHex = cryptoFactory.getPublicKey(privateKey).asHex();
        
        const payloadBytes = Buffer.from(JSON.stringify({
            action: action,
            device_id: deviceId,
            ...payload,
            timestamp: new Date().toISOString()
        }));
        
        const address = getAddress(deviceId);
        
        const header = protobuf.TransactionHeader.create({
            familyName: CONFIG.GARDEN_FAMILY_NAME,
            familyVersion: CONFIG.GARDEN_FAMILY_VERSION,
            inputs: [address],
            outputs: [address],
            signerPublicKey: publicKeyHex,
            nonce: crypto.randomBytes(16).toString('hex'),
            batcherPublicKey: publicKeyHex,
            dependencies: [],
            payloadSha512: hash(payloadBytes.toString())
        });
        
        const signature = cryptoFactory.newSigner(privateKey).sign(header.toBuffer());
        
        const transaction = protobuf.Transaction.create({
            header: header.toBuffer(),
            headerSignature: signature,
            payload: payloadBytes
        });
        
        const batchHeader = protobuf.BatchHeader.create({
            signerPublicKey: publicKeyHex,
            transactionIds: [signature]
        });
        
        const batchSignature = cryptoFactory.newSigner(privateKey).sign(batchHeader.toBuffer());
        
        const batchList = protobuf.BatchList.create({
            batches: [protobuf.Batch.create({
                header: batchHeader.toBuffer(),
                headerSignature: batchSignature,
                transactions: [transaction]
            })]
        });
        
        const response = await axios.post(`${CONFIG.VALIDATOR_URL}/batches`, batchList.toBuffer(), {
            headers: { 'Content-Type': 'application/octet-stream' }
        });
        
        console.log(`[Gateway] Transaction submitted: ${signature}`);
        
        const txRecord = new Transaction({
            transactionId: signature,
            deviceId,
            action,
            payload: { action, deviceId, ...payload },
            signerPublicKey: publicKeyHex,
            timestamp: new Date(),
            status: 'SUBMITTED'
        });
        await txRecord.save();
        
        return { success: true, transactionId: signature };
    } catch (error) {
        console.error('[Gateway] Transaction failed:', error.message);
        throw error;
    }
}

async function registerDevice(deviceId, deviceName) {
    try {
        const privateKeyHex = loadOrCreateDeviceKey(deviceId);
        const privateKey = context.fromHex(privateKeyHex);
        const publicKeyHex = cryptoFactory.getPublicKey(privateKey).asHex();
        
        const result = await submitTransaction(deviceId, 'REGISTER_DEVICE', {
            device_name: deviceName
        });
        
        let device = await Device.findOne({ deviceId });
        const deviceData = {
            deviceId,
            publicKey: publicKeyHex,
            privateKey: privateKeyHex,
            registered: true,
            whitelisted: true,
            registeredAt: new Date(),
            deviceName
        };

        if (!device) {
            device = new Device(deviceData);
        } else {
            Object.assign(device, deviceData);
        }
        await device.save();
        return result;
    } catch (error) {
        console.error(`[Gateway] Registration failed: ${error.message}`);
        throw error;
    }
}

// ============================================
// MQTT Bridge Logic
// ============================================

function startMqttBridge() {
    console.log(`[Gateway] Connecting to HiveMQ: ${CONFIG.MQTT_BROKER_EXTERNAL}`);
    const mqttClient = mqtt.connect(CONFIG.MQTT_BROKER_EXTERNAL);

    mqttClient.on('connect', () => {
        console.log('[Gateway] Connected to HiveMQ Broker');
        mqttClient.subscribe(CONFIG.SENSOR_TOPIC, (err) => {
            if (!err) console.log(`[Gateway] Subscribed to topic: ${CONFIG.SENSOR_TOPIC}`);
        });
    });

    mqttClient.on('message', async (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            const deviceId = data.device_id;

            if (!deviceId) return;

            console.log(`[Gateway] Bridge received from ${deviceId}: T=${data.temperature}, H=${data.humidity}`);

            // Tự động kiểm tra và đăng ký nếu thiết bị chưa có trong DB
            let device = await Device.findOne({ deviceId });
            if (!device || !device.registered) {
                console.log(`[Gateway] Auto-registering ${deviceId} to Blockchain...`);
                await registerDevice(deviceId, "DHT22 Sensor Board");
            }

            // Gửi dữ liệu lên Blockchain
            await submitTransaction(deviceId, 'SEND_TELEMETRY', {
                temperature: parseFloat(data.temperature),
                humidity: parseFloat(data.humidity)
            });

        } catch (error) {
            console.error('[Gateway] MQTT Bridge processing error:', error.message);
        }
    });

    mqttClient.on('error', (err) => {
        console.error('[Gateway] MQTT Bridge connection error:', err);
    });
}

// ============================================
// API Routes
// ============================================

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        validator: CONFIG.VALIDATOR_URL,
        timestamp: new Date().toISOString()
    });
});

app.post('/api/devices/register', async (req, res) => {
    try {
        const { device_id, device_name } = req.body;
        if (!device_id) return res.status(400).json({ error: 'device_id is required' });
        const result = await registerDevice(device_id, device_name);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/telemetry', async (req, res) => {
    try {
        const { device_id, temperature, humidity } = req.body;
        if (!device_id || temperature === undefined || humidity === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const result = await submitTransaction(device_id, 'SEND_TELEMETRY', {
            temperature: parseFloat(temperature),
            humidity: parseFloat(humidity)
        });
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/devices', async (req, res) => {
    try {
        const devices = await Device.find({}, '-privateKey');
        res.json(devices);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Initialization
// ============================================

async function initialize() {
    try {
        console.log('[Gateway] Initializing Smart Garden IoT Gateway...');
        
        context = createContext('secp256k1');
        cryptoFactory = new CryptoFactory(context);
        
        await mongoose.connect(CONFIG.MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('[Gateway] Connected to MongoDB');
        
        await Device.ensureIndexes();
        await Transaction.ensureIndexes();
        
        // Khởi động MQTT Bridge
        startMqttBridge();
        
        app.listen(CONFIG.PORT, () => {
            console.log(`[Gateway] Server listening on port ${CONFIG.PORT}`);
        });
        
    } catch (error) {
        console.error('[Gateway] Initialization failed:', error);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    await mongoose.connection.close();
    process.exit(0);
});

initialize();

module.exports = { app, submitTransaction, registerDevice, eventEmitter };