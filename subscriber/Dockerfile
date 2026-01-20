#FROM node:16-alpine
#FROM node:14-slim
FROM node:14-bullseye-slim

# Cài đặt các công cụ build cần thiết cho zeromq
# RUN apk add --no-cache python3 make g++ gcc libtool autoconf automake
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    libzmq3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app


# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application
COPY sync.js ./

# Environment variables
ENV NODE_ENV=production
ENV POLL_INTERVAL=2000

# Run the subscriber
CMD ["node", "sync.js"]
