# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy the rest of the application code
COPY . .

# Stage 2: Production Image
FROM node:20-alpine

# Set node environment to production
ENV NODE_ENV=production

WORKDIR /app

# Copy the application from the builder stage
COPY --from=builder /app ./

# Run as non-root user for better security
USER node

# Expose port 5000
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
