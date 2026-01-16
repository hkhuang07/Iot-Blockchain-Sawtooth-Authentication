#!/usr/bin/env python3
"""
ESP32 Sensor Simulator for Smart Garden IoT

This script simulates an ESP32 microcontroller sending sensor data
to the IoT Gateway. It can be used for testing and demonstration purposes.
"""

import asyncio
import aiohttp
import json
import random
import time
import hashlib
import logging
from datetime import datetime
from pathlib import Path
import secrets

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
LOGGER = logging.getLogger(__name__)


class ESP32Simulator:
    """
    Simulates an ESP32 device with temperature and humidity sensors.
    Sends telemetry data to the IoT Gateway.
    """
    
    def __init__(self, device_id, gateway_url, interval=5, auto_register=True):
        self.device_id = device_id
        self.device_name = f"ESP32 Simulator {device_id}"
        self.gateway_url = gateway_url
        self.interval = interval
        self.auto_register = auto_register
        
        # Sensor characteristics
        self.base_temp = 25.0  # Base temperature in Celsius
        self.base_humidity = 55.0  # Base humidity percentage
        
        # Generate device key pair
        self.private_key = None
        self.public_key = None
        
        # State
        self.running = False
        self.registered = False
        self.pump_status = "OFF"
        
    def generate_key_pair(self):
        """Generate a simulated key pair for the device."""
        # In real ESP32, this would use cryptographic hardware
        private_key_bytes = secrets.token_bytes(32)
        self.private_key = private_key_bytes.hex()
        
        # Generate public key (simplified - real implementation would use ECDSA)
        self.public_key = hashlib.sha256(
            (self.private_key + self.device_id).encode()
        ).hexdigest()
        
        LOGGER.info(f"Generated key pair for device {self.device_id}")
        return self.private_key, self.public_key
    
    async def register_device(self, session):
        """Register this device with the gateway."""
        if self.registered:
            return True
            
        try:
            url = f"{self.gateway_url}/api/devices/register"
            payload = {
                "device_id": self.device_id,
                "device_name": self.device_name
            }
            
            async with session.post(url, json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    self.registered = True
                    LOGGER.info(f"Device {self.device_id} registered successfully")
                    return True
                else:
                    error = await response.text()
                    LOGGER.error(f"Registration failed: {error}")
                    return False
                    
        except Exception as e:
            LOGGER.error(f"Registration error: {e}")
            return False
    
    async def send_telemetry(self, session, temperature, humidity):
        """Send telemetry data to the gateway."""
        try:
            url = f"{self.gateway_url}/api/telemetry"
            payload = {
                "device_id": self.device_id,
                "temperature": round(temperature, 1),
                "round(humidity, 1)"
            }
            
            async with session.post(url, json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    LOGGER.info(
                        f"Telemetry sent: temp={temperature:.1f}°C, "
                        f"humidity={humidity:.1f}%, "
                        f"tx_id={data.get('transactionId', 'N/A')[:16]}..."
                    )
                    return True
                else:
                    error = await response.text()
                    LOGGER.error(f"Telemetry failed: {error}")
                    return False
                    
        except Exception as e:
            LOGGER.error(f"Telemetry error: {e}")
            return False
    
    def read_sensors(self):
        """
        Simulate reading from DHT22 sensor.
        Returns realistic temperature and humidity values.
        """
        # Add some variation based on time of day
        current_hour = datetime.now().hour
        
        # Temperature variation (cooler at night, warmer during day)
        time_factor = -3 if 0 <= current_hour < 6 else (
            3 if 6 <= current_hour < 18 else 0
        )
        
        # Random fluctuation
        temp_noise = random.gauss(0, 0.5)
        humidity_noise = random.gauss(0, 2)
        
        temperature = self.base_temp + time_factor + temp_noise
        humidity = max(0, min(100, self.base_humidity + humidity_noise))
        
        # Simulate occasional low humidity events (for smart contract demo)
        if random.random() < 0.1:  # 10% chance
            humidity = random.uniform(20, 28)
            LOGGER.info(f"Simulated low humidity event: {humidity:.1f}%")
        
        return round(temperature, 1), round(humidity, 1)
    
    async def run(self):
        """Main loop for the simulator."""
        self.running = True
        
        LOGGER.info(f"Starting ESP32 Simulator for device: {self.device_id}")
        LOGGER.info(f"Gateway URL: {self.gateway_url}")
        LOGGER.info(f"Update interval: {self.interval} seconds")
        
        # Generate keys
        self.generate_key_pair()
        
        # Create HTTP session
        async with aiohttp.ClientSession() as session:
            # Register device if enabled
            if self.auto_register:
                await asyncio.sleep(1)  # Wait for gateway to be ready
                await self.register_device(session)
            
            # Main loop
            while self.running:
                # Read sensors
                temperature, humidity = self.read_sensors()
                
                # Send telemetry
                await self.send_telemetry(session, temperature, humidity)
                
                # Wait for next reading
                await asyncio.sleep(self.interval)
    
    def stop(self):
        """Stop the simulator."""
        self.running = False
        LOGGER.info(f"Stopping simulator for device: {self.device_id}")


async def run_multiple_devices(num_devices, gateway_url, base_interval=5):
    """
    Run multiple device simulators concurrently.
    """
    tasks = []
    
    for i in range(num_devices):
        device_id = f"sensor_{i+1:02d}"
        
        # Add slight variation to intervals to avoid sync
        interval = base_interval + random.uniform(0, 2)
        
        simulator = ESP32Simulator(
            device_id=device_id,
            gateway_url=gateway_url,
            interval=interval,
            auto_register=True
        )
        
        task = asyncio.create_task(simulator.run())
        tasks.append(task)
        
        LOGGER.info(f"Created simulator for {device_id}")
        
        # Small delay between starting devices
        await asyncio.sleep(0.5)
    
    # Wait for all tasks
    await asyncio.gather(*tasks)


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="ESP32 Sensor Simulator for Smart Garden IoT"
    )
    parser.add_argument(
        "--device-id",
        default="sensor_01",
        help="Device ID for this simulator"
    )
    parser.add_argument(
        "--gateway-url",
        default="http://localhost:3000",
        help="URL of the IoT Gateway"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=5,
        help="Data transmission interval in seconds"
    )
    parser.add_argument(
        "--num-devices",
        type=int,
        default=1,
        help="Number of concurrent device simulators"
    )
    parser.add_argument(
        "--auto-register",
        action="store_true",
        default=True,
        help="Auto-register devices with gateway"
    )
    
    args = parser.parse_args()
    
    if args.num_devices > 1:
        # Run multiple devices
        asyncio.run(run_multiple_devices(args.num_devices, args.gateway_url, args.interval))
    else:
        # Run single device
        simulator = ESP32Simulator(
            device_id=args.device_id,
            gateway_url=args.gateway_url,
            interval=args.interval,
            auto_register=args.auto_register
        )
        asyncio.run(simulator.run())


if __name__ == "__main__":
    main()
