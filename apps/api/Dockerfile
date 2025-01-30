# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./

# Copy project files
COPY apps/api ./apps/api
COPY shared ./shared

# Install dependencies
RUN npm ci

# Build the application
RUN npm run nx build api

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built assets from builder
COPY --from=builder /app/dist/apps/api ./

# Install production dependencies only
RUN npm ci --only=production

# Set environment variables
ENV PORT=3001
ENV NODE_ENV=production

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["node", "main.js"]
