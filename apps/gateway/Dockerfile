# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy all configuration files
COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./
COPY jest.preset.js ./
COPY jest.config.ts ./

# Copy project files
COPY apps/gateway ./apps/gateway
COPY shared ./shared

# Install dependencies
#RUN npm ci
RUN npm install --force

# Build the application
RUN npx nx build gateway

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist/apps/gateway ./
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "main.js"]
