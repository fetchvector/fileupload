
# Multi-stage build
FROM node:20-slim AS builder

WORKDIR /app

# Copy server first
COPY server ./server
WORKDIR /app/server
RUN npm ci || npm install

# Copy client and build
WORKDIR /app
COPY client ./client
WORKDIR /app/client
RUN npm ci || npm install
RUN npm run build

# Prepare runtime image
FROM node:20-slim

WORKDIR /app

# Copy server runtime files
COPY --from=builder /app/server /app/server

# Copy built client into server/public
RUN mkdir -p /app/server/public
COPY --from=builder /app/client/dist /app/server/public

WORKDIR /app/server

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
