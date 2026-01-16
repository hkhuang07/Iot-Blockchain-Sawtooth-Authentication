FROM python:3.9-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir aiohttp

# Copy application
COPY sim_esp32.py .

# Make script executable
RUN chmod +x sim_esp32.py

# Environment variables
ENV GATEWAY_URL=http://iot-gateway:3000
ENV INTERVAL=5
ENV DEVICE_ID=sensor_01

# Run the simulator
CMD ["python3", "sim_esp32.py", "--gateway-url", "$GATEWAY_URL", "--interval", "$INTERVAL", "--device-id", "$DEVICE_ID"]
