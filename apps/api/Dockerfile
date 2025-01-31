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
COPY apps/api ./apps/api
COPY shared ./shared

# Install dependencies
#RUN npm ci
RUN npm install --force

# Build the application (Changed this line)
RUN npx nx build api

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built assets from builder
COPY --from=builder /app/dist/apps/api ./
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Set environment variables
ENV PORT=3001
ENV NODE_ENV=production

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["node", "main.js"]
