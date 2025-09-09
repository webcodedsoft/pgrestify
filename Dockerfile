# PGRestify Development Dockerfile
# This provides a complete development environment for PGRestify

FROM node:18-alpine AS base

# Install dependencies only when needed
RUN apk add --no-cache libc6-compat git curl
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Development stage
FROM base AS dev
WORKDIR /app

# Copy source code
COPY . .

# Expose development port
EXPOSE 3000

# Start development server
CMD ["pnpm", "dev"]

# Build stage
FROM base AS builder
WORKDIR /app

# Copy source code
COPY . .

# Build the library
RUN pnpm build

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Install only production dependencies
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile

# Copy built assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/README.md ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run as non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S pgrestify -u 1001
USER pgrestify

CMD ["node", "dist/index.js"]

# Testing stage
FROM dev AS test
WORKDIR /app

# Run tests
RUN pnpm test

# Linting stage  
FROM dev AS lint
WORKDIR /app

# Run linting
RUN pnpm lint