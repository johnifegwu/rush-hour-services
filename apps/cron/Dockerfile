# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./

# Copy project files
COPY apps/cron ./apps/cron
COPY shared/src ./shared/src

# Install dependencies
RUN npm ci

# Build the application
RUN npm run nx build cron

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist/apps/cron ./
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3002

# Expose the port the app runs on
EXPOSE 3002

# Start the application
CMD ["node", "main.js"]
