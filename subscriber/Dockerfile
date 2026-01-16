FROM node:18-alpine

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
