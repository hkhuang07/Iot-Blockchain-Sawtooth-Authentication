# Smart Garden IoT - Blockchain Powered Garden Monitoring System

## Overview

Smart Garden IoT is a decentralized IoT monitoring system built on Hyperledger Sawtooth blockchain technology. It enables secure, transparent, and tamper-proof monitoring of garden sensors with automatic irrigation control through smart contracts.

## Key Features

- **Blockchain Security**: All sensor data is stored on a distributed ledger using Hyperledger Sawtooth PBFT consensus
- **Smart Contract Automation**: Automatic pump activation when humidity drops below 30%
- **Device Authentication**: Only whitelisted devices can submit data to the network
- **Real-time Dashboard**: Vue.js dashboard with live charts and network status
- **Multi-Validator Network**: 4-node PBFT network for fault tolerance
- **Off-chain Storage**: MongoDB for fast queries and historical data

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Smart Garden IoT System                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐     ┌─────────────────────────────────────┐       │
│  │  ESP32/     │────▶│           IoT Gateway               │       │
│  │  Simulator  │     │  (Transaction Signing & Submission) │       │
│  └─────────────┘     └────────────┬────────────────────────┘       │
│                                   │                                 │
│                                   ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Hyperledger Sawtooth PBFT Network               │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │   │
│  │  │ Val-0   │──│ Val-1   │──│ Val-2   │──│ Val-3   │        │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │   │
│  │       │            │            │            │               │   │
│  │       └────────────┴────────────┴────────────┘               │   │
│  │                      (PBFT Consensus)                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                   │                                 │
│                                   ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Garden Contract TP                        │   │
│  │  - Device Registration                                       │   │
│  │  - Telemetry Validation                                      │   │
│  │  - Smart Pump Control (Humidity < 30%)                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                   │                                 │
│                                   ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Event Subscriber                          │   │
│  │  - Block Event Listening                                     │   │
│  │  - MongoDB Sync                                              │   │
│  │  - Socket.io Broadcasting                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                   │                                 │
│              ┌────────────────────┼────────────────────┐          │
│              ▼                    ▼                    ▼          │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐    │
│  │  MongoDB     │      │  Vue.js      │      │  External    │    │
│  │  Database    │      │  Dashboard   │      │  APIs        │    │
│  └──────────────┘      └──────────────┘      └──────────────┘    │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
smart-garden-iot/
├── docker-compose.yaml          # Main orchestration file
├── README.md                    # This file
│
├── sawtooth/                    # Blockchain configuration
│   ├── keys/                    # Validator keys
│   └── genesis/                 # Genesis configuration
│
├── processors/
│   └── garden_tp/               # Smart Contract (Transaction Processor)
│       ├── Dockerfile
│       ├── handler.py           # Contract logic
│       └── main.py              # TP entry point
│
├── gateway/                     # IoT Gateway Service
│   ├── Dockerfile
│       ├── index.js             # REST API & signing logic
│       └── package.json
│
├── subscriber/                  # Event Listener Service
│   ├── Dockerfile
│   ├── sync.js                  # Blockchain sync logic
│   └── package.json
│
├── dashboard/                   # Vue.js Frontend
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.js
│       ├── App.vue
│       ├── router/
│       ├── stores/
│       ├── views/
│       └── components/
│
└── simulator/                   # ESP32 Simulator
    ├── Dockerfile
    └── sim_esp32.py             # Sensor data generator
```

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2+
- 8GB RAM (minimum)
- 4 CPU cores (recommended)

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd smart-garden-iot
```

### 2. Generate Validator Keys

```bash
# Create keys directory
mkdir -p sawtooth/keys

# Generate keys for 4 validators
for i in {0..3}; do
    docker run --rm \
        -v $(pwd)/sawtooth/keys:/keys \
        hyperledger/sawtooth-validator:latest \
        sawtooth keygen --key-dir /keys validator-$i
done
```

### 3. Create Genesis Block

```bash
docker run --rm \
    -v $(pwd)/sawtooth/genesis:/genesis \
    hyperledger/sawtooth-cli:latest \
    sawset genesis \
        -k /dev/null \
        -o /genesis/genesis.batch
```

### 4. Start the Network

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 5. Access the Dashboard

Open your browser and navigate to:
- **Dashboard**: http://localhost:8080
- **REST API**: http://localhost:3000
- **Validator-0**: http://localhost:8008

## Services

| Service | Port | Description |
|---------|------|-------------|
| validator-0 | 4004, 8800 | PBFT Validator Node 0 |
| validator-1 | 4004, 8801 | PBFT Validator Node 1 |
| validator-2 | 4004, 8802 | PBFT Validator Node 2 |
| validator-3 | 4004, 8803 | PBFT Validator Node 3 |
| rest-api-0 | 8008 | REST API (Validator 0) |
| rest-api-1 | 8009 | REST API (Validator 1) |
| rest-api-2 | 8010 | REST API (Validator 2) |
| rest-api-3 | 8011 | REST API (Validator 3) |
| iot-gateway | 3000 | IoT Gateway API |
| event-subscriber | 3001 | WebSocket Server |
| dashboard | 8080 | Vue.js Dashboard |
| mongodb | 27017 | MongoDB Database |

## API Documentation

### Register Device

```bash
curl -X POST http://localhost:3000/api/devices/register \
  -H "Content-Type: application/json" \
  -d '{"device_id": "sensor_01", "device_name": "Garden Sensor 1"}'
```

### Send Telemetry

```bash
curl -X POST http://localhost:3000/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{"device_id": "sensor_01", "temperature": 25.5, "humidity": 62.3}'
```

### Get Device Info

```bash
curl http://localhost:3000/api/devices/sensor_01
```

### Get Block Info

```bash
curl http://localhost:8008/blocks
```

## Demo Scenarios

### Scenario 1: Smart Contract Activation

1. Start the sensor simulator:
   ```bash
   python simulator/sim_esp32.py --device-id sensor_01 --gateway-url http://localhost:3000
   ```

2. Watch the dashboard - when humidity drops below 30%, the pump status will automatically change to "ON"

3. Check the blockchain explorer to see the smart contract transaction

### Scenario 2: Fault Tolerance

1. While the system is running:
   ```bash
   docker-compose stop validator-3
   ```

2. Continue sending telemetry data

3. Observe that the system continues to function with 3 validators (PBFT tolerates 1 fault with 4 nodes)

### Scenario 3: Device Authentication

1. Attempt to send data from an unregistered device:
   ```bash
   curl -X POST http://localhost:3000/api/telemetry \
     -H "Content-Type: application/json" \
     -d '{"device_id": "unauthorized_device", "temperature": 25, "humidity": 50}'
   ```

2. The transaction will be rejected by the smart contract

## Smart Contract Logic

The GardenContract handles the following actions:

### REGISTER_DEVICE
- Validates device ID and name
- Stores device public key for authentication
- Adds device to whitelist

### SEND_TELEMETRY
- Validates device is whitelisted
- Verifies transaction signature
- **Smart Contract Logic**: If humidity < 30%, automatically sets pump status to "ON"

### Address Format
```
70-character address:
- First 6 chars: SHA512("GardenContract") prefix
- Last 64 chars: SHA512(device_id) hash
```

## Troubleshooting

### Services not starting
```bash
# Check logs
docker-compose logs

# Restart services
docker-compose restart
```

### MongoDB connection issues
```bash
# Check MongoDB status
docker-compose exec mongodb mongo --eval "db.adminCommand('ping')"
```

### Validator not reaching consensus
```bash
# Check validator logs
docker-compose logs validator-0

# Verify network connectivity
docker-compose exec validator-0 ping validator-1
```

### Reset the network
```bash
# Stop all services and remove data
docker-compose down -v

# Remove MongoDB data volume
docker volume rm smart-garden-iot_mongodb_data

# Restart
docker-compose up -d
```

## Development

### Running services individually

```bash
# Start only the blockchain network
docker-compose up -d validator-0 validator-1 validator-2 validator-3

# Start the gateway
docker-compose up -d iot-gateway

# Start the dashboard in dev mode
cd dashboard
npm install
npm run dev
```

### Modifying the smart contract

1. Edit `processors/garden_tp/handler.py`
2. Rebuild the TP:
   ```bash
   docker-compose build garden-tp
   docker-compose up -d garden-tp
   ```

## Performance Considerations

- **Block Time**: ~2 seconds (PBFT)
- **Transaction Latency**: ~3-5 seconds (end-to-end)
- **Max Validators**: 4 (optimal for PBFT)
- **Data Retention**: Unlimited on blockchain, configurable in MongoDB

## Security Features

1. **Device Authentication**: Only whitelisted devices can submit data
2. **Transaction Signing**: All transactions are cryptographically signed
3. **Consensus**: PBFT provides Byzantine fault tolerance
4. **Immutability**: All data is permanently recorded on the blockchain

## License

MIT License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
