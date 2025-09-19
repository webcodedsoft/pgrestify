# Docker Deployment Example

Comprehensive guide to deploying PGRestify applications using Docker.

## Basic Docker Setup

### Dockerfile

```dockerfile
# Use official Node.js image
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Production stage
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["pnpm", "start"]
```

### Docker Compose Configuration

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: pguser
      POSTGRES_PASSWORD: securepassword
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  # PostgREST API
  postgrest:
    image: postgrest/postgrest
    depends_on:
      - postgres
    environment:
      PGRST_DB_URI: postgres://pguser:securepassword@postgres:5432/myapp
      PGRST_DB_SCHEMA: public
      PGRST_DB_ANON_ROLE: web_anon
    ports:
      - "3000:3000"

  # PGRestify Application
  pgrestify-app:
    build: .
    depends_on:
      - postgrest
    environment:
      POSTGREST_URL: http://postgrest:3000
      JWT_SECRET: your-jwt-secret
      NODE_ENV: production
    ports:
      - "4000:4000"

volumes:
  postgres-data:
```

## PGRestify Client Configuration

```typescript
import { createClient } from '@webcoded/pgrestify';

// Docker-aware client configuration
const client = createClient(
  process.env.POSTGREST_URL || 'http://localhost:3000', 
  {
    // Docker-specific configuration
    docker: {
      enabled: true,
      
      // Automatic service discovery
      serviceDiscovery: {
        strategy: 'env' // Use environment variables
      },
      
      // Retry configuration for container networks
      retry: {
        enabled: true,
        maxAttempts: 5,
        delay: 2000, // 2 seconds
        
        // Retry only on connection-related errors
        shouldRetry: (error) => 
          error.code === 'ECONNREFUSED' || 
          error.name === 'NetworkError'
      }
    }
  }
);
```

## Kubernetes Deployment

### Deployment Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgrestify-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: pgrestify
  template:
    metadata:
      labels:
        app: pgrestify
    spec:
      containers:
      - name: pgrestify
        image: your-pgrestify-image:latest
        ports:
        - containerPort: 4000
        env:
        - name: POSTGREST_URL
          valueFrom:
            configMapKeyRef:
              name: postgrest-config
              key: url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: jwt-secret
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        readinessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 4000
          initialDelaySeconds: 15
          periodSeconds: 10
```

### Service Configuration

```yaml
apiVersion: v1
kind: Service
metadata:
  name: pgrestify-service
spec:
  selector:
    app: pgrestify
  ports:
  - port: 80
    targetPort: 4000
  type: LoadBalancer
```

## Health Check Endpoint

```typescript
import express from 'express';
import { createClient } from '@webcoded/pgrestify';

const app = express();
const client = createClient(process.env.POSTGREST_URL);

app.get('/health', async (req, res) => {
  try {
    // Perform a simple database health check
    await client
      .from('health_check')
      .select('status')
      .single();

    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message 
    });
  }
});
```

## Environment-Specific Configuration

```typescript
const client = createClient(process.env.POSTGREST_URL, {
  // Environment-specific settings
  ...(process.env.NODE_ENV === 'production' && {
    cache: {
      enabled: true,
      ttl: 600000 // 10 minutes
    },
    logging: {
      level: 'error'
    }
  }),
  
  ...(process.env.NODE_ENV === 'development' && {
    cache: { enabled: false },
    logging: { level: 'debug' }
  })
});
```

## Docker Security Best Practices

```dockerfile
# Use multi-stage build
FROM node:18-alpine AS builder

# Create non-root user
RUN addgroup -S pgrestify && adduser -S pgrestify -G pgrestify

# Set working directory
WORKDIR /app

# Copy files with correct permissions
COPY --chown=pgrestify:pgrestify . .

# Install dependencies as non-root
USER pgrestify

# Run as non-root user
USER pgrestify

# Disable npm audit and fund messages
RUN npm set audit=false && npm set fund=false
```

## Continuous Integration

```yaml
# GitHub Actions workflow
name: Docker CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Build Docker image
      run: docker build -t pgrestify-app .
    
    - name: Run tests in container
      run: |
        docker run --rm pgrestify-app npm test
    
    - name: Push to Docker Hub
      run: |
        docker login -u ${{ secrets.DOCKER_USERNAME }} -p ${{ secrets.DOCKER_PASSWORD }}
        docker push your-docker-repo/pgrestify-app
```

## Monitoring and Logging

```yaml
# Docker Compose with monitoring
version: '3.8'
services:
  pgrestify-app:
    # ... existing configuration
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
```

## Best Practices

- Use multi-stage builds
- Minimize image size
- Run containers as non-root
- Use environment variables
- Implement health checks
- Configure resource limits
- Use secrets management
- Enable logging and monitoring
- Implement CI/CD pipelines

## Performance Optimization

- Use Alpine-based images
- Leverage Docker layer caching
- Minimize number of layers
- Use specific image tags
- Implement efficient dependency management
- Configure resource constraints
- Use volume mounts for persistent data