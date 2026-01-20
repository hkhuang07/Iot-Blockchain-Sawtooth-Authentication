#FROM node:16-alpine
#FROM node:14-slim
FROM node:14-bullseye-slim

# Cài đặt các công cụ biên dịch (Bullseye repos vẫn sống nên sẽ chạy được)
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
COPY index.js ./
# Create keys directory
RUN mkdir -p /app/keys

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Run the gateway
CMD ["node", "index.js"]
