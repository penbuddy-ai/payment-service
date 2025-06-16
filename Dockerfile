# Multi-stage Dockerfile for Penpal AI Payment Service

FROM node:18-alpine as base

# Install curl for health checks
RUN apk --no-cache add curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Development stage
FROM base as development

# Install all dependencies including devDependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3003

# Start in dev mode
CMD ["npm", "run", "start:dev"]

# Production build stage
FROM base as build

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine as production

# Install curl for health checks
RUN apk --no-cache add curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from build stage
COPY --from=build /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

USER nestjs

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3003/ || exit 1

# Start the application
CMD ["node", "dist/main"] 