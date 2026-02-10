FROM node:20-alpine AS build

WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build frontend
RUN npm run build:client

# Build server
RUN npm run build:server

# --- Production image ---
FROM node:20-alpine

WORKDIR /app

# Install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built assets
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

# Expose port
EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "dist-server/index.js"]
