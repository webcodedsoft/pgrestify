# Prerequisites and Setup Guide

Before using PGRestify in your application, you need to set up the underlying infrastructure that makes it work. PGRestify is a client library for PostgREST APIs, which means you need to have a complete PostgREST + PostgreSQL stack running.

## Overview

PGRestify requires:
1. **PostgreSQL Database** - The data storage layer
2. **PostgREST API Server** - The REST API generator
3. **Proper Database Schema** - Tables, roles, and permissions
4. **Authentication Setup** - JWT configuration (optional but recommended)
5. **Network Configuration** - CORS and connectivity setup

## 1. PostgreSQL Database Setup

### Installation Options

#### Option A: Docker (Recommended for Development)
```bash
# Start PostgreSQL container
docker run --name pgrestify-db \
  -e POSTGRES_DB=myapp \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your_secure_password \
  -p 5432:5432 \
  -d postgres:15

# Connect to the database
docker exec -it pgrestify-db psql -U postgres -d myapp
```

#### Option B: Local Installation

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql-15 postgresql-contrib-15
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
Download and install from [PostgreSQL Official Website](https://www.postgresql.org/download/windows/)

### Database Schema Setup

Once PostgreSQL is running, create the necessary schema and roles:

```sql
-- Connect to your database as superuser
psql -U postgres -d myapp

-- 1. Create API schema (separate from public schema for security)
CREATE SCHEMA api;

-- 2. Create your application tables
CREATE TABLE api.users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE api.posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  user_id INTEGER REFERENCES api.users(id),
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create database roles for PostgREST
-- Anonymous role (for unauthenticated users)
CREATE ROLE web_anon NOLOGIN;
GRANT USAGE ON SCHEMA api TO web_anon;
-- Grant read-only access to public data
GRANT SELECT ON api.posts TO web_anon;

-- Authenticated user role
CREATE ROLE web_user NOLOGIN;
GRANT USAGE ON SCHEMA api TO web_user;
GRANT ALL ON api.users TO web_user;
GRANT ALL ON api.posts TO web_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA api TO web_user;

-- Authenticator role (PostgREST connects with this role)
CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'your_jwt_secret_here';
GRANT web_anon TO authenticator;
GRANT web_user TO authenticator;
```

### Row Level Security (RLS) - Recommended

Enable Row Level Security for better data protection:

```sql
-- Enable RLS on tables
ALTER TABLE api.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.posts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY user_access ON api.users
  FOR ALL USING (email = current_setting('request.jwt.claims', true)::json->>'email');

-- Posts visibility based on user and publication status
CREATE POLICY post_access ON api.posts
  FOR ALL USING (
    published = true OR 
    user_id = (SELECT id FROM api.users WHERE email = current_setting('request.jwt.claims', true)::json->>'email')
  );
```

## 2. PostgREST Installation

### Installation Options

#### Option A: Docker (Recommended)
```bash
# Pull PostgREST image
docker pull postgrest/postgrest

# Or use docker-compose (see full example below)
```

#### Option B: Binary Installation

**macOS (Homebrew):**
```bash
brew install postgrest
```

**Linux (Download Binary):**
```bash
# Download latest release from GitHub
wget https://github.com/PostgREST/postgrest/releases/latest/download/postgrest-linux-static-x64.tar.xz
tar -xf postgrest-linux-static-x64.tar.xz
sudo mv postgrest /usr/local/bin/
```

**Windows:**
Download from [PostgREST Releases](https://github.com/PostgREST/postgrest/releases)

### PostgREST Configuration

Create a configuration file `postgrest.conf`:

```conf
# Database connection
db-uri = "postgres://authenticator:your_jwt_secret_here@localhost:5432/myapp"
db-schemas = "api"
db-anon-role = "web_anon"

# Server configuration
server-host = "0.0.0.0"
server-port = 3000

# JWT Configuration (for authentication)
jwt-secret = "your-256-bit-secret-key-here-make-it-very-long-and-random"
# You can also use a file: jwt-secret = "@/path/to/jwt-secret.txt"

# CORS (adjust origins for your frontend)
server-cors-allowed-origins = "*"

# Security settings
db-max-rows = 1000
log-level = "info"

# Optional: OpenAPI documentation
openapi-mode = "follow-privileges"
```

### Running PostgREST

```bash
# Start PostgREST with config file
postgrest postgrest.conf

# Or with environment variables
DB_URI="postgres://authenticator:password@localhost:5432/myapp" \
DB_SCHEMAS="api" \
DB_ANON_ROLE="web_anon" \
JWT_SECRET="your-secret" \
postgrest
```

## 3. Docker Compose Setup (Complete Stack)

For a complete development setup, use this `docker-compose.yml`:

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql

  postgrest:
    image: postgrest/postgrest
    depends_on:
      - postgres
    environment:
      PGRST_DB_URI: postgres://authenticator:mypassword@postgres:5432/myapp
      PGRST_DB_SCHEMAS: api
      PGRST_DB_ANON_ROLE: web_anon
      PGRST_JWT_SECRET: your-256-bit-secret-key-here
      PGRST_SERVER_CORS_ALLOWED_ORIGINS: "*"
    ports:
      - "3000:3000"

volumes:
  postgres_data:
```

Create `init.sql` with your schema setup:
```sql
-- Your database schema goes here
-- (Use the SQL from the Database Schema Setup section above)
```

Start the stack:
```bash
docker-compose up -d
```

## 4. Authentication Setup (JWT)

### JWT Secret Generation

Generate a secure secret key:

```bash
# Generate a 256-bit secret
openssl rand -base64 32

# Or use a UUID
uuidgen
```

### JWT Token Structure

For PGRestify to work with authentication, your JWT tokens should include:

```json
{
  "role": "web_user",
  "user_id": 123,
  "email": "user@example.com",
  "exp": 1640995200,
  "iat": 1640908800
}
```

### Example JWT Generation (Node.js)

```javascript
const jwt = require('jsonwebtoken');

function generateToken(user) {
  return jwt.sign(
    {
      role: 'web_user',
      user_id: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
    },
    'your-256-bit-secret-key-here'
  );
}
```

## 5. Production Considerations

### Security Checklist

- [ ] Use strong, unique passwords for all database roles
- [ ] Enable SSL/TLS for database connections
- [ ] Use HTTPS for all API communication
- [ ] Configure proper CORS origins (not "*" in production)
- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Regular security updates for PostgreSQL and PostgREST
- [ ] Use environment variables for sensitive configuration
- [ ] Set up proper firewall rules

### Performance Optimization

- [ ] Configure connection pooling (`db-pool` setting)
- [ ] Set appropriate `db-max-rows` limits
- [ ] Create database indexes for frequently queried columns
- [ ] Monitor query performance
- [ ] Consider read replicas for high-traffic applications

### Monitoring and Logging

```conf
# Enhanced logging configuration
log-level = "info"
db-prepared-statements = true

# Optional: Add request logging
db-pre-request = "api.log_request"
```

## 6. Verification

Once everything is set up, verify your installation:

```bash
# Test PostgREST API
curl http://localhost:3000/

# Test a table endpoint
curl http://localhost:3000/posts

# Test with authentication (if configured)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/users
```

## 7. Environment Variables Reference

You can configure PostgREST using environment variables instead of a config file:

```bash
# Database
export PGRST_DB_URI="postgres://authenticator:password@localhost:5432/myapp"
export PGRST_DB_SCHEMAS="api"
export PGRST_DB_ANON_ROLE="web_anon"

# Server
export PGRST_SERVER_HOST="0.0.0.0"
export PGRST_SERVER_PORT="3000"

# Authentication
export PGRST_JWT_SECRET="your-secret-key"

# CORS
export PGRST_SERVER_CORS_ALLOWED_ORIGINS="https://yourdomain.com"

# Performance
export PGRST_DB_MAX_ROWS="1000"
export PGRST_DB_POOL="10"
```

## Next Steps

Once your PostgREST API is running and accessible:

1. Install PGRestify in your application: `npm install pgrestify`
2. Configure PGRestify client with your PostgREST URL
3. Start building your application with type-safe database operations

See the [Getting Started guide](./getting-started.md) for how to use PGRestify in your application.

## Troubleshooting

### Common Issues

**Connection refused:**
- Check if PostgreSQL is running
- Verify connection string and credentials
- Check firewall settings

**Authentication errors:**
- Verify JWT secret matches between token generation and PostgREST
- Check role assignments in PostgreSQL
- Ensure token hasn't expired

**Permission denied:**
- Review role permissions and grants
- Check Row Level Security policies
- Verify schema access rights

**CORS errors:**
- Configure `server-cors-allowed-origins` properly
- Ensure frontend origin is allowed
- Check for mixed HTTP/HTTPS content

For more detailed troubleshooting, see the [Troubleshooting guide](./troubleshooting/common-issues.md).