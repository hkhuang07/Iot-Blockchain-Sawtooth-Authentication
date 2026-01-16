FROM python:3.9-slim

WORKDIR /project

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg2 \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

# Install Sawtooth SDK
RUN pip install --no-cache-dir \
    sawtooth-sdk \
    protobuf

# Copy application files
COPY handler.py .
COPY main.py .

# Expose port
EXPOSE 4004

# Run the transaction processor
CMD ["python3", "main.py", "--connect", "tcp://validator-0:4004", "-v"]
