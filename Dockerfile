FROM node:20-alpine

WORKDIR /app

# Copy backend package file
COPY backend/package.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY backend/src ./src

# Create data directory for database
RUN mkdir -p ./data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start server
CMD ["node", "src/server.js"]
