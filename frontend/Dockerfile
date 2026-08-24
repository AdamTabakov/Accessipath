FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY frontend/ .

# Build the app
RUN npm run build

# Production stage
FROM node:20-alpine as production

WORKDIR /app

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Install only production dependencies
RUN npm ci --only=production

# Expose port
EXPOSE 3000

# Command to serve the app
CMD ["npx", "serve", "-s", "dist"]