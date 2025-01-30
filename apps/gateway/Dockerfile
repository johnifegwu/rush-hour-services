# Use Node.js LTS as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy shared files
COPY shared/src ./shared/src

# Copy gateway application
COPY apps/gateway ./apps/gateway

# Install dependencies
RUN npm ci

# Build the application
RUN npm run build

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["node", "dist/apps/gateway/main.js"]
