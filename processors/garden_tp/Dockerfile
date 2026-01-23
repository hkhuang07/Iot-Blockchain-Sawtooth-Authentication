FROM python:3.9-slim

WORKDIR /project

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg2 \
    lsb-release \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir protobuf==3.20.3
RUN pip install --no-cache-dir sawtooth-sdk


# Copy application files
COPY . .

# Expose port
EXPOSE 4004

# Thêm biến môi trường ép chạy bản python để tránh lỗi C++ Descriptor
ENV PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python

# Run the transaction processor
CMD ["python3", "main.py", "--connect", "tcp://validator-0:4004", "-v"]