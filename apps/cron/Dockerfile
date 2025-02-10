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
COPY apps/cron ./apps/cron
COPY shared/src ./shared/src

# Install dependencies
#RUN npm ci
RUN npm install --force && \
    npm install -g nx @nrwl/cli

# Build the application (Changed this line)
RUN npx nx build cron

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
