# syntax=docker/dockerfile:1.6

# ============================================================
# Stage 1: Build the React Native (Expo web export) frontend
# ============================================================
FROM node:20-alpine AS frontend-build
WORKDIR /frontend

# Install deps first for better layer caching
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

COPY frontend/ ./
# Export the Expo web bundle (static assets consumed by the Express server)
RUN npx expo export --platform web --output-dir dist

# ============================================================
# Stage 2: Build the Express backend (production deps only)
# ============================================================
FROM node:20-alpine AS backend-build
WORKDIR /app

RUN apk add --no-cache python3 make g++ \
    && ln -sf python3 /usr/bin/python

COPY backend/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# ============================================================
# Stage 3: Runtime image - Express + static frontend + SQLite
# ============================================================
FROM node:20-alpine AS runtime
WORKDIR /app

# Runtime system deps for better-sqlite3 / sqlite3 native bindings
RUN apk add --no-cache python3 make g++ wget curl tini \
    && ln -sf python3 /usr/bin/python

ENV NODE_ENV=production \
    PORT=4000 \
    NODE_OPTIONS="--enable-source-maps"

# Install production backend dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# Copy backend source
COPY backend/ ./

# Copy built React Native web bundle into Express static dir
COPY --from=frontend-build /frontend/dist ./public

# Pre-create the SQLite data directory with correct permissions
RUN mkdir -p /app/data && chown -R node:node /app

VOLUME ["/app/data"]
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:4000/api/health || exit 1

USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]