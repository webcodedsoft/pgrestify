# Custom Schemas

PGRestify provides comprehensive support for custom PostgreSQL schemas, allowing you to organize your database structure according to your application's needs. This guide covers schema configuration, multi-schema applications, and best practices.

## Overview

PostgreSQL schemas provide a way to organize database objects into logical groups. PGRestify and PostgREST can work with single or multiple schemas, giving you flexibility in how you structure your database.

### Common Schema Patterns

- **Single Schema**: All tables in one schema (typically `api` or `public`)
- **Multi-Schema**: Different schemas for different purposes (`api`, `auth`, `admin`)
- **Domain-Driven**: Schemas organized by business domains (`users`, `products`, `orders`)
- **Environment-Based**: Different schemas for different environments

## Schema Configuration

### PostgREST Schema Configuration

Configure which schemas PostgREST exposes through your `postgrest.conf`:

```conf
# Single schema
db-schemas = "api"

# Multiple schemas (comma-separated)
db-schemas = "public,api,auth"

# Multiple schemas with different access levels
db-schemas = "api,admin,reporting"
```

### PGRestify Integration

PGRestify automatically reads your PostgREST schema configuration:

```typescript
// Client automatically uses configured schemas
const client = createClient({
  url: 'http://localhost:3000',
  // Schema configuration is read from PostgREST
});

// Access tables from different schemas
const users = await client.from('users').select('*'); // api.users
const profiles = await client.from('profiles').select('*'); // api.profiles
```

## Setting Up Custom Schemas

### CLI Commands

Use the PGRestify CLI to manage schemas:

```bash
# Initialize project with custom schema
pgrestify api init --schema custom_schema

# Generate schema structure
pgrestify api schema generate --schema business_logic

# Pull existing schema
pgrestify api pull --schema existing_schema

# Apply changes to specific schema  
pgrestify api apply --schema target_schema
```

### Manual Schema Setup

Create schemas manually in PostgreSQL:

```sql
-- Create custom schemas
CREATE SCHEMA IF NOT EXISTS api;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS business;

-- Grant permissions to PostgREST roles
GRANT USAGE ON SCHEMA api TO web_anon, authenticated;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA admin TO web_admin;
GRANT USAGE ON SCHEMA business TO authenticated, web_admin;
```

## Multi-Schema Applications

### Schema Organization Patterns

#### By Application Layer

```sql
-- API layer (public-facing)
CREATE SCHEMA api;
CREATE TABLE api.users (...);
CREATE TABLE api.posts (...);

-- Authentication layer
CREATE SCHEMA auth;
CREATE TABLE auth.sessions (...);
CREATE TABLE auth.refresh_tokens (...);

-- Administrative layer
CREATE SCHEMA admin;
CREATE TABLE admin.audit_logs (...);
CREATE TABLE admin.system_config (...);
```

#### By Business Domain

```sql
-- User management domain
CREATE SCHEMA users;
CREATE TABLE users.profiles (...);
CREATE TABLE users.preferences (...);

-- E-commerce domain
CREATE SCHEMA commerce;
CREATE TABLE commerce.products (...);
CREATE TABLE commerce.orders (...);

-- Content management domain
CREATE SCHEMA content;
CREATE TABLE content.articles (...);
CREATE TABLE content.media (...);
```

### PostgREST Configuration for Multi-Schema

```conf
# postgrest.conf for multi-schema setup
db-schemas = "api,users,commerce,content"
db-anon-role = "web_anon"
db-authenticated-role = "authenticated"

# Optional: Default schema for unqualified names
db-schema = "api"
```

### Client Usage with Multiple Schemas

```typescript
import { createClient } from 'pgrestify';

const client = createClient({
  url: 'http://localhost:3000'
});

// Access tables from different schemas
// PostgREST automatically handles schema routing

// Default schema (api)
const posts = await client.from('posts').select('*');

// If PostgREST exposes multiple schemas,
// they're all accessible through the same endpoint
const users = await client.from('users').select('*');
const products = await client.from('products').select('*');
```

## Schema-Specific Configuration

### Environment-Based Schemas

Configure different schemas for different environments:

```typescript
// config/database.ts
const schemaConfig = {
  development: 'dev_api',
  staging: 'staging_api', 
  production: 'api'
};

const currentSchema = schemaConfig[process.env.NODE_ENV || 'development'];
```

### Schema-Specific Permissions

Set up different permission levels per schema:

```sql
-- Public API schema - limited access
GRANT USAGE ON SCHEMA api TO web_anon;
GRANT SELECT ON ALL TABLES IN SCHEMA api TO web_anon;

-- Internal schema - authenticated access only
GRANT USAGE ON SCHEMA internal TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA internal TO authenticated;

-- Admin schema - admin access only
GRANT ALL ON SCHEMA admin TO web_admin;
GRANT ALL ON ALL TABLES IN SCHEMA admin TO web_admin;
```

## Schema Management with CLI

### Generating Schema Structure

```bash
# Generate complete schema with tables, functions, and policies
pgrestify api schema generate \
  --schema business_logic \
  --include-tables \
  --include-functions \
  --include-policies

# Generate specific components
pgrestify api schema generate \
  --schema auth \
  --tables-only \
  --output sql/auth-schema.sql
```

### Schema Validation

```bash
# Validate schema configuration
pgrestify api schema validate --schema api

# Check schema consistency
pgrestify api schema validate --all-schemas

# Validate against PostgREST requirements
pgrestify api schema validate --postgrest-compatibility
```

### Schema Migration

```bash
# Migrate specific schema
pgrestify api migrate --schema target_schema

# Migrate all configured schemas  
pgrestify api migrate --all-schemas

# Dry run migration
pgrestify api migrate --schema api --dry-run
```

## Cross-Schema Relationships

### Foreign Keys Across Schemas

```sql
-- Reference table in different schema
CREATE TABLE api.posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  author_id INTEGER REFERENCES users.profiles(id),
  category_id INTEGER REFERENCES content.categories(id)
);

-- Set up proper permissions for cross-schema access
GRANT SELECT ON users.profiles TO authenticated;
GRANT SELECT ON content.categories TO web_anon;
```

### Views Spanning Multiple Schemas

```sql
-- Create view combining data from multiple schemas
CREATE VIEW api.post_details AS
SELECT 
  p.id,
  p.title,
  p.content,
  u.username,
  c.name AS category_name
FROM api.posts p
JOIN users.profiles u ON p.author_id = u.id
JOIN content.categories c ON p.category_id = c.id;

-- Grant access to the view
GRANT SELECT ON api.post_details TO web_anon;
```

### Functions Accessing Multiple Schemas

```sql
-- Function that works across schemas
CREATE OR REPLACE FUNCTION api.get_user_posts(user_id INTEGER)
RETURNS TABLE(
  post_id INTEGER,
  title TEXT,
  username TEXT
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT 
    p.id,
    p.title,
    u.username
  FROM api.posts p
  JOIN users.profiles u ON p.author_id = u.id
  WHERE u.id = user_id;
$$;
```

## Schema Security and Access Control

### Row Level Security with Schemas

```sql
-- Enable RLS on tables in specific schemas
ALTER TABLE api.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users.profiles ENABLE ROW LEVEL SECURITY;

-- Schema-aware RLS policies
CREATE POLICY "api_posts_select" ON api.posts
  FOR SELECT TO web_anon
  USING (published = true);

CREATE POLICY "users_own_profile" ON users.profiles
  FOR ALL TO authenticated
  USING (id = current_user_id());
```

### Schema-Based Role Management

```sql
-- Create schema-specific roles
CREATE ROLE api_read NOLOGIN;
CREATE ROLE api_write NOLOGIN;
CREATE ROLE users_admin NOLOGIN;

-- Grant schema access to roles
GRANT USAGE ON SCHEMA api TO api_read, api_write;
GRANT SELECT ON ALL TABLES IN SCHEMA api TO api_read;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA api TO api_write;

-- Grant admin access to users schema
GRANT ALL ON SCHEMA users TO users_admin;
```

## Best Practices

### Schema Organization

```sql
-- Good: Clear separation of concerns
CREATE SCHEMA api;      -- Public API endpoints
CREATE SCHEMA auth;     -- Authentication/authorization
CREATE SCHEMA internal; -- Internal operations
CREATE SCHEMA audit;    -- Audit logging

-- Avoid: Too many schemas or unclear purposes
CREATE SCHEMA misc;     -- Unclear purpose
CREATE SCHEMA temp;     -- Temporary schemas in production
```

### Naming Conventions

```sql
-- Use descriptive schema names
users_management    -- Clear purpose
product_catalog     -- Business domain
financial_reports   -- Functional area

-- Avoid generic names
data               -- Too generic
stuff              -- Meaningless
app                -- Unclear scope
```

### Permission Management

```sql
-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA api 
  GRANT SELECT ON TABLES TO web_anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA api 
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Use explicit grants rather than broad permissions
GRANT USAGE ON SCHEMA specific_schema TO specific_role;
-- Rather than
GRANT ALL ON SCHEMA specific_schema TO public;
```

## Advanced Schema Patterns

### Tenant-Based Schemas

```sql
-- Multi-tenant application with schema per tenant
CREATE SCHEMA tenant_company_a;
CREATE SCHEMA tenant_company_b;

-- Shared schema for common data
CREATE SCHEMA shared;
CREATE TABLE shared.countries (...);
CREATE TABLE shared.currencies (...);

-- Tenant-specific data
CREATE TABLE tenant_company_a.users (...);
CREATE TABLE tenant_company_b.users (...);
```

### Versioned Schemas

```sql
-- API versioning through schemas
CREATE SCHEMA api_v1;
CREATE SCHEMA api_v2;

-- Gradual migration between versions
CREATE VIEW api_v1.users AS 
  SELECT id, name, email FROM api_v2.users;

-- Configure PostgREST for specific version
-- db-schemas = "api_v2,shared"
```

### Microservice Schemas

```sql
-- Each microservice gets its own schema
CREATE SCHEMA user_service;
CREATE SCHEMA order_service;
CREATE SCHEMA payment_service;

-- Shared reference data
CREATE SCHEMA shared;

-- Cross-service communication through views/functions
CREATE VIEW order_service.user_details AS
  SELECT id, name, email FROM user_service.users;
```

## Troubleshooting

### Schema Not Found

```bash
# Check available schemas
SELECT schema_name FROM information_schema.schemata;

# Verify PostgREST configuration
pgrestify api config show

# Update schema configuration
pgrestify api config update --schema "api,users,content"
```

### Permission Denied

```sql
-- Check schema permissions
SELECT 
  schema_name,
  grantee,
  privilege_type
FROM information_schema.schema_privileges
WHERE schema_name IN ('api', 'users', 'auth');

-- Grant missing permissions
GRANT USAGE ON SCHEMA api TO web_anon;
```

### Cross-Schema References

```sql
-- Ensure all referenced schemas are accessible
-- Check foreign key constraints
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.table_schema,
  kcu.table_name AS referenced_table,
  kcu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

## Migration Examples

### Single to Multi-Schema Migration

```sql
-- Step 1: Create new schemas
CREATE SCHEMA api;
CREATE SCHEMA auth;

-- Step 2: Move tables to appropriate schemas
ALTER TABLE users SET SCHEMA api;
ALTER TABLE sessions SET SCHEMA auth;

-- Step 3: Update foreign key references
ALTER TABLE posts 
  ADD CONSTRAINT fk_author 
  FOREIGN KEY (author_id) REFERENCES api.users(id);

-- Step 4: Update PostgREST configuration
-- db-schemas = "api,auth"

-- Step 5: Update application code if needed
```

### Schema Consolidation

```sql
-- Move tables from multiple schemas to single schema
ALTER TABLE schema_a.table1 SET SCHEMA consolidated;
ALTER TABLE schema_b.table2 SET SCHEMA consolidated;
ALTER TABLE schema_c.table3 SET SCHEMA consolidated;

-- Update references
-- Update PostgREST configuration
-- db-schemas = "consolidated"

-- Drop empty schemas
DROP SCHEMA schema_a CASCADE;
DROP SCHEMA schema_b CASCADE;
DROP SCHEMA schema_c CASCADE;
```

## Next Steps

- [Database Roles](./database-roles) - Configure role-based access control
- [Row Level Security](./rls-policies) - Implement fine-grained security
- [CLI Schema Management](./cli-schema) - Advanced CLI schema operations
- [Authentication](./authentication) - Set up schema-aware authentication