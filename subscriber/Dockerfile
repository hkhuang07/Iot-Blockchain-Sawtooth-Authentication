#FROM node:16-alpine
#FROM node:14-slim
#FROM node:14-bullseye-slim
FROM node:12-bullseye-slim

# Cài libzmq3-dev giúp npm install nhận diện thư viện có sẵn, không phải build lại từ đầu
RUN apt-get update && apt-get install -y \
    python \
    make \
    g++ \
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
