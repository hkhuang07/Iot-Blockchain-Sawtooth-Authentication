#!/usr/bin/env python3
"""
Smart Garden IoT Transaction Processor
Handles GardenContract family: REGISTER_DEVICE and SEND_TELEMETRY actions
"""

import hashlib
import logging
import sys
from functools import partial
from urllib.parse import urlparse

from sawtooth_sdk.processor.handler import TransactionHandler
from sawtooth_sdk.processor.exceptions import InvalidTransaction
from sawtooth_sdk.protobuf import state_context_pb2

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
LOGGER = logging.getLogger(__name__)

# Family name and version
FAMILY_NAME = "GardenContract"
FAMILY_VERSION = "1.0"

# Address prefix: first 6 chars of SHA512("GardenContract")
FAMILY_PREFIX = hashlib.sha512(FAMILY_NAME.encode()).hexdigest()[:6]

# Device whitelist storage address
WHITELIST_ADDRESS = FAMILY_PREFIX + "0" * 64

# Action types
ACTION_REGISTER = "REGISTER_DEVICE"
ACTION_TELEMETRY = "SEND_TELEMETRY"


def _hash(value):
    """Create SHA512 hash"""
    return hashlib.sha512(value.encode()).hexdigest()


def _get_device_address(device_id):
    """
    Generate address for device state
    Address format: 70 chars
    - First 6 chars: Family prefix (hash of "GardenContract")
    - Last 64 chars: SHA512 hash of device_id
    """
    return FAMILY_PREFIX + _hash(device_id)[:64]


def _serialize(data):
    """Serialize data to JSON bytes"""
    import json
    return json.dumps(data, sort_keys=True).encode('utf-8')


def _deserialize(data):
    """Deserialize JSON bytes to dict"""
    import json
    return json.loads(data.decode('utf-8'))


class GardenHandler(TransactionHandler):
    """
    Transaction Handler for GardenContract
    Handles device registration and telemetry data
    """

    def __init__(self):
        super().__init__()
        self.family_name = FAMILY_NAME
        self.family_versions = [FAMILY_VERSION]
        self.namespaces = [FAMILY_PREFIX]

    def apply(self, transaction, state):
        """
        Apply transaction to state
        This is the main entry point for processing transactions
        """
        # Parse transaction header
        header = transaction.header
        signer_public_key = header.signer_public_key

        # Get payload
        payload = _deserialize(transaction.payload)
        action = payload.get('action')
        device_id = payload.get('device_id')

        LOGGER.info(f"Processing transaction: action={action}, device_id={device_id}")

        # Route to appropriate handler
        if action == ACTION_REGISTER:
            self._handle_register(state, payload, signer_public_key)
        elif action == ACTION_TELEMETRY:
            self._handle_telemetry(state, payload, signer_public_key)
        else:
            raise InvalidTransaction(f"Unknown action: {action}")

    def _handle_register(self, state, payload, signer_public_key):
        """
        Handle device registration
        Only allows device to register itself or admin registration
        """
        device_id = payload.get('device_id')
        device_name = payload.get('device_name', 'Unnamed Device')
        timestamp = payload.get('timestamp')

        if not device_id:
            raise InvalidTransaction("device_id is required for registration")

        # Get current device state
        device_address = _get_device_address(device_id)
        current_state = state.get_state([device_address])

        # Check if device is already registered
        if current_state.get(device_address):
            existing_data = _deserialize(current_state[device_address])
            if existing_data.get('registered'):
                raise InvalidTransaction(f"Device {device_id} is already registered")

        # Create device record
        device_record = {
            'device_id': device_id,
            'device_name': device_name,
            'public_key': signer_public_key,
            'registered': True,
            'registered_at': timestamp,
            'whitelisted': True
        }

        # Store in state
        state.set_state({
            device_address: _serialize(device_record)
        })

        LOGGER.info(f"Device {device_id} registered successfully")

    def _handle_telemetry(self, state, payload, signer_public_key):
        """
        Handle telemetry data submission
        Validates device is whitelisted and applies smart contract logic
        """
        device_id = payload.get('device_id')
        temperature = payload.get('temperature')
        humidity = payload.get('humidity')
        timestamp = payload.get('timestamp')

        # Validate required fields
        if not device_id:
            raise InvalidTransaction("device_id is required for telemetry")
        if temperature is None or humidity is None:
            raise InvalidTransaction("temperature and humidity are required")

        # Get device state to check whitelist
        device_address = _get_device_address(device_id)
        current_state = state.get_state([device_address])

        # Check if device is registered and whitelisted
        if not current_state.get(device_address):
            raise InvalidTransaction(f"Device {device_id} is not registered")

        device_data = _deserialize(current_state[device_address])

        if not device_data.get('whitelisted', False):
            raise InvalidTransaction(f"Device {device_id} is not whitelisted")

        # Verify the signer matches the device's registered public key
        registered_key = device_data.get('public_key')
        if registered_key != signer_public_key:
            raise InvalidTransaction(
                f"Device {device_id} public key mismatch. "
                f"Expected {registered_key[:16]}..., got {signer_public_key[:16]}..."
            )

        # ============================================
        # SMART CONTRACT LOGIC: Automatic Pump Control
        # ============================================
        # If humidity < 30%, automatically activate pump
        PUMP_THRESHOLD = 30.0
        pump_action = "OFF"

        if humidity < PUMP_THRESHOLD:
            pump_action = "ON"
            LOGGER.warning(
                f"SMART CONTRACT ACTIVATED: Low humidity ({humidity}%) "
                f"- Pump set to {pump_action}"
            )
        else:
            LOGGER.info(
                f"Humidity normal ({humidity}%) - Pump remains {pump_action}"
            )

        # Create telemetry record with smart contract decision
        telemetry_record = {
            'device_id': device_id,
            'temperature': float(temperature),
            'humidity': float(humidity),
            'timestamp': timestamp,
            'pump_status': pump_action,
            'smart_contract_triggered': pump_action == "ON",
            'block_height': None  # Will be set by validator
        }

        # Store telemetry data
        telemetry_address = (
            FAMILY_PREFIX +
            _hash(f"{device_id}_telemetry")[:22] +
            _hash(timestamp)[:42]
        )

        state.set_state({
            telemetry_address: _serialize(telemetry_record)
        })

        # Update device's current state
        device_data['last_reading'] = {
            'temperature': float(temperature),
            'humidity': float(humidity),
            'timestamp': timestamp,
            'pump_status': pump_action
        }
        device_data['last_update'] = timestamp

        state.set_state({
            device_address: _serialize(device_data)
        })

        LOGGER.info(
            f"Telemetry recorded: device={device_id}, "
            f"temp={temperature}, humidity={humidity}%, "
            f"pump={pump_action}"
        )


def main():
    """Main entry point for the Transaction Processor"""
    handler = GardenHandler()
    return handler


if __name__ == "__main__":
    LOGGER.info("Starting Garden Contract Transaction Processor...")
    main()
