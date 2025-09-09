# Configuration Management

PGRestify CLI provides comprehensive configuration management for PostgREST deployments and Docker setups. This includes environment-specific configurations, security hardening, and deployment optimization.

## Overview

Configuration management helps you:

- Generate optimized PostgREST configuration files
- Set up Docker Compose for development and production
- Configure environment-specific settings
- Apply security best practices
- Manage database connections and authentication

## PostgREST Configuration

### Generate PostgREST Config

Create PostgREST configuration files optimized for different environments:

```bash
# Interactive configuration generation
pgrestify api config postgrest

# Generate for specific environment
pgrestify api config postgrest --env production

# Generate with custom settings
pgrestify api config postgrest \
  --env staging \
  --port 3001 \
  --schema api \
  --output ./config/postgrest.conf
```

### PostgREST Config Options

```bash
pgrestify api config postgrest [options]

Options:
  --output <file>         Output file (default: ./postgrest.conf)
  --env <environment>     Environment (development|staging|production)
  --port <port>           Server port (default: 3000)
  --schema <schema>       API schema
  --db-uri <uri>          Database URI (will prompt if not provided)
```

### Environment Configurations

#### Development Environment
Optimized for local development with debug features:

```ini
# postgrest.conf (Development)
db-uri = "postgresql://postgres:postgres@localhost:5432/myapp_dev"
db-schema = "api"
db-anon-role = "anon"
db-pool = 10
db-pool-timeout = 10

server-host = "0.0.0.0"
server-port = 3000
server-cors-allowed-origins = "*"

jwt-secret = "development-jwt-secret-min-32-chars"
jwt-aud = "authenticated"

log-level = "info"
openapi-server-proxy-uri = "http://localhost:3000"

# Development optimizations
db-prepared-statements = false
db-tx-end = "commit"
db-tx-isolation = "read-committed"
db-max-rows = 1000
```

#### Staging Environment
Testing environment with production-like settings:

```ini
# postgrest.conf (Staging)
db-uri = "postgresql://staginguser:stagingpass@staging-db:5432/myapp_staging"
db-schema = "api"
db-anon-role = "anon"
db-pool = 20
db-pool-timeout = 10

server-host = "0.0.0.0"  
server-port = 3000
server-cors-allowed-origins = "https://staging.myapp.com"

jwt-secret = "staging-jwt-secret-very-secure-32-chars"
jwt-aud = "authenticated"
jwt-role-claim-key = ".role"

log-level = "warn"
openapi-server-proxy-uri = "https://staging-api.myapp.com"

# Staging security
db-prepared-statements = true
db-tx-end = "commit"
db-max-rows = 500
```

#### Production Environment
Production environment with security hardening:

```ini
# postgrest.conf (Production)
db-uri = "postgresql://produser:securepass@prod-db:5432/myapp_prod"
db-schema = "api"
db-anon-role = "anon"
db-pool = 100
db-pool-timeout = 10

server-host = "0.0.0.0"
server-port = 3000
server-cors-allowed-origins = "https://myapp.com,https://www.myapp.com"

jwt-secret = "production-jwt-secret-very-secure-minimum-32-chars"
jwt-aud = "authenticated"
jwt-role-claim-key = ".role"
jwt-secret-is-base64 = false

log-level = "error"
openapi-server-proxy-uri = "https://api.myapp.com"

# Production security hardening
db-prepared-statements = true
db-tx-end = "rollback-allow-override"
db-tx-isolation = "read-committed"
db-max-rows = 100

# Rate limiting and security
server-request-timeout = "10"
```

### Interactive Configuration

When running without all options, the CLI guides you through configuration:

```bash
$ pgrestify api config postgrest

⚙️  Generating PostgREST Configuration

? Target environment:
❯ Development - Local development with debug features
  Staging - Testing environment with production-like settings  
  Production - Production environment with security hardening

? Server configuration:
  Port: (3000)
  Schema: (api)
  Host: (0.0.0.0)

? Database configuration:
  Database URI: postgresql://user:pass@host:5432/database
  Anonymous role: (anon)
  Authenticated role: (authenticated)
  Connection pool size: (10)

? Security configuration:
  JWT secret: (will be generated)
  CORS origins: (*)
  Request timeout: (10s)

? Performance settings:
  Max rows per request: (1000)
  Enable prepared statements: (Y/n)
  Transaction isolation: (read-committed)
```

## Docker Configuration

### Generate Docker Setup

Create Docker Compose configurations for different deployment scenarios:

```bash
# Generate Docker setup
pgrestify api config docker

# Generate with specific services
pgrestify api config docker --services postgres,postgrest,nginx

# Generate for production
pgrestify api config docker --env production --output docker-compose.prod.yml

# Generate with custom networks
pgrestify api config docker --network custom_network
```

### Docker Config Options

```bash
pgrestify api config docker [options]

Options:
  --output <file>         Output file (default: docker-compose.yml)
  --env <environment>     Environment (development|staging|production)  
  --services <list>       Services to include (postgres,postgrest,nginx,redis)
  --network <name>        Custom network name
  --postgres-version      PostgreSQL version (default: 15-alpine)
  --postgrest-version     PostgREST version (default: latest)
```

### Generated Docker Configurations

#### Development Docker Compose

```yaml
# docker-compose.yml (Development)
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: pgrestify_postgres_dev
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-myapp_dev}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./sql:/docker-entrypoint-initdb.d:ro
    networks:
      - pgrestify_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $POSTGRES_USER -d $POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 5

  postgrest:
    image: postgrest/postgrest:latest
    container_name: pgrestify_postgrest_dev
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      PGRST_DB_URI: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@postgres:5432/${POSTGRES_DB:-myapp_dev}
      PGRST_DB_SCHEMA: ${POSTGREST_SCHEMA:-api}
      PGRST_DB_ANON_ROLE: ${POSTGREST_ANON_ROLE:-anon}
      PGRST_JWT_SECRET: ${JWT_SECRET:-development-jwt-secret-min-32-chars}
      PGRST_OPENAPI_SERVER_PROXY_URI: http://localhost:${POSTGREST_PORT:-3000}
    ports:
      - "${POSTGREST_PORT:-3000}:3000"
    networks:
      - pgrestify_network
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  pgrestify_network:
    driver: bridge
```

#### Production Docker Compose

```yaml
# docker-compose.prod.yml (Production)
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: pgrestify_postgres_prod
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
    secrets:
      - postgres_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - postgres_backup:/backup
    networks:
      - internal_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $POSTGRES_USER -d $POSTGRES_DB"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: "0.5"
        reservations:
          memory: 512M
          cpus: "0.25"

  postgrest:
    image: postgrest/postgrest:v11.2.0  # Pinned version for production
    container_name: pgrestify_postgrest_prod
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      PGRST_DB_URI: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      PGRST_DB_SCHEMA: ${POSTGREST_SCHEMA:-api}
      PGRST_DB_ANON_ROLE: ${POSTGREST_ANON_ROLE:-anon}
      PGRST_JWT_SECRET_FILE: /run/secrets/jwt_secret
      PGRST_LOG_LEVEL: error
      PGRST_DB_POOL: 100
      PGRST_DB_MAX_ROWS: 100
      PGRST_DB_PREPARED_STATEMENTS: true
    secrets:
      - jwt_secret
    networks:
      - internal_network
      - web_network
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "0.5"
        reservations:
          memory: 256M
          cpus: "0.25"

  nginx:
    image: nginx:alpine
    container_name: pgrestify_nginx_prod
    depends_on:
      - postgrest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - nginx_cache:/var/cache/nginx
    networks:
      - web_network
    restart: unless-stopped

secrets:
  postgres_password:
    file: ./secrets/postgres_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt

volumes:
  postgres_data:
  postgres_backup:
  nginx_cache:

networks:
  internal_network:
    driver: bridge
    internal: true
  web_network:
    driver: bridge
```

## Environment Variables

### PostgREST Environment Variables

Generated configurations use environment variables for flexibility:

```bash
# .env.example
# Database Configuration
POSTGRES_DB=myapp_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=secure-password
POSTGRES_PORT=5432

# PostgREST Configuration  
POSTGREST_PORT=3000
POSTGREST_SCHEMA=api
POSTGREST_ANON_ROLE=anon
JWT_SECRET=your-jwt-secret-minimum-32-characters

# Optional Configuration
POSTGREST_DB_POOL=20
POSTGREST_MAX_ROWS=1000
CORS_ORIGINS=*

# SSL Configuration (Production)
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
```

### Security Environment Variables

```bash
# Security-focused variables
JWT_SECRET_FILE=/run/secrets/jwt_secret
POSTGRES_PASSWORD_FILE=/run/secrets/postgres_password
ADMIN_PASSWORD_FILE=/run/secrets/admin_password

# CORS and security headers
CORS_ALLOWED_ORIGINS=https://myapp.com,https://www.myapp.com
RATE_LIMIT_PER_MINUTE=100
REQUEST_TIMEOUT=10

# Monitoring and logging
LOG_LEVEL=error
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true
```

## Configuration Validation

### Validate Configurations

Check configuration files for common issues:

```bash
# Validate PostgREST config
pgrestify validate --config postgrest.conf

# Validate Docker setup
pgrestify validate --docker docker-compose.yml

# Comprehensive validation
pgrestify validate --all
```

### Validation Checks

The validator checks for:

1. **PostgREST Configuration**:
   - Valid database URI format
   - Proper JWT secret length (minimum 32 characters)
   - Correct role configuration
   - Security settings validation

2. **Docker Configuration**:
   - Service dependencies
   - Network configuration
   - Volume mounts
   - Health checks

3. **Environment Variables**:
   - Required variables present
   - Secure defaults
   - Production readiness

### Validation Output

```bash
$ pgrestify validate --config postgrest.conf

✅ Configuration Validation Results

PostgREST Configuration:
  ✅ Database URI format valid
  ✅ JWT secret length adequate (32+ characters)
  ✅ Roles configured correctly
  ❌ CORS origins too permissive for production
  ⚠️  Log level set to 'info' (recommend 'error' for production)

Security Checks:
  ✅ No hardcoded passwords found
  ✅ Environment variables used properly
  ❌ JWT secret should use environment variable
  
Recommendations:
  - Set CORS origins to specific domains
  - Move JWT secret to environment variable
  - Consider using JWT secret file in production

Issues Found: 2 errors, 1 warning
```

## Configuration Templates

### Custom Configuration Templates

Create reusable configuration templates:

```bash
# Create template from existing config
pgrestify api config template create my-template --from postgrest.conf

# Use template for new projects
pgrestify api config postgrest --template my-template

# List available templates
pgrestify api config template list
```

## Best Practices

### Security Configuration

1. **Never hardcode secrets** in configuration files
2. **Use environment variables** or secret files
3. **Set restrictive CORS origins** in production
4. **Use minimum required permissions** for database roles
5. **Enable prepared statements** for performance and security

### Performance Configuration

1. **Tune connection pool size** based on expected load
2. **Set appropriate max rows** limits
3. **Use read-committed isolation** for most use cases
4. **Enable request timeout** to prevent hanging requests
5. **Configure proper logging levels**

### Production Configuration

1. **Pin Docker image versions** for reproducible deployments
2. **Use secrets management** for sensitive data
3. **Configure resource limits** for containers
4. **Set up proper health checks** and monitoring
5. **Use SSL/TLS termination** at load balancer or reverse proxy

## Troubleshooting Configuration

### Common Issues

#### Connection Issues
```bash
# Error: Connection refused
# Check database URI and network configuration
PGRST_DB_URI=postgresql://user:pass@correct-host:5432/database
```

#### Authentication Issues
```bash
# Error: JWT validation failed
# Ensure JWT secret matches between client and server
JWT_SECRET=same-secret-on-both-sides-min-32-chars
```

#### CORS Issues
```bash
# Error: CORS policy blocked
# Add client domain to allowed origins
server-cors-allowed-origins = "https://client-domain.com"
```

### Testing Configuration

Test generated configurations:

```bash
# Test PostgREST config
postgrest postgrest.conf

# Test Docker setup
docker-compose up --dry-run

# Test environment variables
env | grep POSTGREST
```

## Integration with Other Commands

### Complete Workflow

```bash
# 1. Initialize project
pgrestify api init --template blog

# 2. Generate configuration
pgrestify api config postgrest --env production
pgrestify api config docker --env production

# 3. Set up environment
cp .env.example .env
# Edit .env with production values

# 4. Start services
docker-compose -f docker-compose.prod.yml up -d

# 5. Validate deployment
pgrestify validate --all
curl http://localhost:3000
```

## Summary

PGRestify's configuration management provides comprehensive tools for setting up PostgREST deployments with proper security, performance optimization, and environment-specific configurations. The generated configurations follow best practices and can be easily customized for different deployment scenarios.