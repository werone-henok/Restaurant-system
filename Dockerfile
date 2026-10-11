# =====================================================================
# GourmetOS Unified Production Container
# Multi-stage build: compiles React frontend + TypeScript server
# =====================================================================

# Stage 1: Build Frontend Web Client
FROM node:22-bookworm-slim AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build Backend Server
FROM node:22-bookworm-slim AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npx tsc

# Stage 3: Production Runner
FROM node:22-bookworm-slim AS runner
WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=4001
ENV DB_PATH=/app/server/data/restaurant.db
ENV UPLOAD_DIR=/app/server/data/uploads

# Install production dependencies (including native better-sqlite3)
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy compiled backend and static web client
COPY --from=server-builder /app/server/dist ./dist
COPY --from=client-builder /app/client/dist ./public

# Create persistent storage directories
RUN mkdir -p /app/server/data/uploads

VOLUME ["/app/server/data"]

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4001/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.js"]
