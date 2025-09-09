# Schema Management

PGRestify CLI provides comprehensive schema management tools for PostgreSQL databases with PostgREST integration. This includes table generation, Row Level Security (RLS) policies, indexes, and schema validation.

## Overview

Schema management commands help you:

- Generate database tables with proper types and constraints
- Set up Row Level Security (RLS) policies
- Create indexes for performance optimization
- Validate PostgREST schema compatibility
- Manage schema versions and migrations

## Schema Generation

### Basic Schema Generation

Generate PostgREST-compatible database schemas with Row Level Security:

```bash
# Generate schema with RLS (default)
pgrestify api schema generate

# Generate with specific options
pgrestify api schema generate --with-rls --with-functions --with-triggers

# Generate for specific tables
pgrestify api schema generate --tables users,posts,comments

# Generate with specific schema name
pgrestify api schema generate --schema api
```

### Schema Generation Options

```bash
pgrestify api schema generate [options]

Options:
  --with-rls             Include Row Level Security policies (default: true)
  --with-functions       Include utility functions (default: true)
  --with-triggers        Include audit triggers (default: true)
  --schema <name>        Schema name
  --tables <tables>      Comma-separated table names
  --single-file          Use single file mode (deprecated, not recommended)
```

### Generated Schema Structure

```
sql/
├── 00-extensions.sql      # PostgreSQL extensions
├── 01-schemas.sql         # Schema definitions
├── 02-tables/             # Table definitions
│   ├── users/
│   │   ├── table.sql     # Table structure
│   │   ├── rls.sql       # Row Level Security
│   │   ├── triggers.sql  # Audit triggers
│   │   └── indexes.sql   # Performance indexes
│   ├── posts/
│   │   └── ...
│   └── comments/
│       └── ...
├── 03-functions.sql       # Custom functions
├── 04-views.sql          # Database views
└── 05-grants.sql         # Permission grants
```

## Table Generation

### Individual Table Creation

Create specific tables with proper structure:

```bash
# Generate user table with authentication
pgrestify api schema table users \
  --columns "id:uuid:primary,email:varchar:unique,password_hash:varchar" \
  --with-rls \
  --with-audit

# Generate posts table with relationships
pgrestify api schema table posts \
  --columns "id:uuid:primary,title:varchar:required,content:text,author_id:uuid:fk:users" \
  --indexes "title,created_at" \
  --rls-pattern user_specific
```

### Column Type Mapping

PGRestify supports comprehensive PostgreSQL type mapping:

```bash
# Basic types
id:uuid:primary              # UUID PRIMARY KEY DEFAULT gen_random_uuid()
name:varchar:required        # VARCHAR NOT NULL
email:varchar:unique         # VARCHAR UNIQUE
age:integer                  # INTEGER
price:decimal:10,2           # DECIMAL(10,2)
active:boolean:default:true  # BOOLEAN DEFAULT TRUE

# Advanced types
metadata:jsonb               # JSONB for JSON data
tags:varchar[]               # VARCHAR array
created_at:timestamptz       # TIMESTAMP WITH TIME ZONE
coordinates:point            # PostGIS point type

# Relationships
author_id:uuid:fk:users      # Foreign key to users table
category_id:integer:fk:categories:id  # Explicit foreign key column
```

### Table Templates

Pre-defined table templates for common use cases:

```bash
# User authentication table
pgrestify api schema table users --template auth
# Generates: id, email, password_hash, created_at, updated_at

# Blog post table
pgrestify api schema table posts --template blog
# Generates: id, title, slug, content, published, author_id

# E-commerce product table
pgrestify api schema table products --template ecommerce
# Generates: id, name, price, stock, description, category_id

# Audit log table
pgrestify api schema table audit_log --template audit
# Generates: id, table_name, operation, old_data, new_data, timestamp
```

## Row Level Security (RLS)

### RLS Policy Generation

Generate secure RLS policies for your tables:

```bash
# Generate RLS policies for a table
pgrestify api schema rls posts --pattern user_specific

# Multiple patterns
pgrestify api schema rls posts --pattern "admin_full,user_own,public_read"

# Custom policy
pgrestify api schema rls posts --custom "CREATE POLICY posts_policy ON posts FOR SELECT TO authenticated USING (author_id = auth.uid())"
```

### Built-in RLS Patterns

#### Public Read Pattern
```sql
-- Allow public read access
CREATE POLICY "posts_public_read" ON posts
  FOR SELECT TO anon, authenticated
  USING (published = true);
```

#### User-Specific Pattern
```sql
-- Users can only access their own records
CREATE POLICY "posts_user_own" ON posts
  FOR ALL TO authenticated
  USING (author_id = auth.uid());
```

#### Admin Full Access Pattern
```sql
-- Admins have full access
CREATE POLICY "posts_admin_full" ON posts
  FOR ALL TO admin_role
  USING (true);
```

#### Role-Based Pattern
```sql
-- Different access based on user role
CREATE POLICY "posts_role_based" ON posts
  FOR SELECT TO authenticated
  USING (
    CASE auth.role()
      WHEN 'admin' THEN true
      WHEN 'editor' THEN author_id = auth.uid() OR published = true
      WHEN 'user' THEN published = true
      ELSE false
    END
  );
```

### RLS Policy Commands

```bash
# Enable RLS on table
pgrestify api schema rls posts --enable

# Generate specific policy types
pgrestify api schema rls posts --select --insert --update --delete

# Disable RLS (use with caution)
pgrestify api schema rls posts --disable

# List existing policies
pgrestify api schema rls posts --list
```

## Schema Validation

### PostgREST Compatibility Check

Validate your schema for PostgREST compatibility:

```bash
# Validate entire schema
pgrestify api schema validate

# Validate specific table
pgrestify api schema validate --table users

# Check for common issues
pgrestify api schema validate --check-rls --check-permissions

# Detailed validation report
pgrestify api schema validate --detailed
```

### Validation Checks

The validator checks for:

1. **Table Accessibility**: Tables in public schema or exposed via views
2. **RLS Configuration**: Proper Row Level Security setup
3. **Permission Grants**: Correct role permissions
4. **Primary Keys**: All tables have primary keys
5. **Foreign Keys**: Valid relationship definitions
6. **Function Security**: Proper function permissions
7. **JWT Configuration**: Correct authentication setup

### Validation Output

```bash
$ pgrestify api schema validate

✅ Schema Validation Results

Tables (5 checked):
  ✅ users - Primary key, RLS enabled
  ✅ posts - Primary key, RLS enabled, foreign keys valid
  ✅ comments - Primary key, RLS enabled
  ❌ categories - Missing RLS policies
  ⚠️  tags - No primary key defined

Permissions:
  ✅ anon role configured
  ✅ authenticated role configured
  ❌ Missing SELECT grants on categories

Functions:
  ✅ auth functions accessible
  ⚠️  custom_function lacks security definer

Issues Found: 2 errors, 2 warnings
```

## Index Management

### Index Generation

Create performance indexes for your tables:

```bash
# Generate indexes for a table
pgrestify api schema indexes posts

# Specific index types
pgrestify api schema indexes posts --btree "title,created_at" --gin "search_vector"

# Unique indexes
pgrestify api schema indexes users --unique email,username

# Partial indexes
pgrestify api schema indexes posts --partial "published = true"
```

### Index Types

```sql
-- B-tree indexes (default)
CREATE INDEX posts_title_idx ON posts (title);
CREATE INDEX posts_created_at_idx ON posts (created_at DESC);

-- Composite indexes
CREATE INDEX posts_author_date_idx ON posts (author_id, created_at);

-- Unique indexes
CREATE UNIQUE INDEX users_email_idx ON users (email);

-- Partial indexes
CREATE INDEX posts_published_idx ON posts (created_at) 
  WHERE published = true;

-- GIN indexes for JSONB and arrays
CREATE INDEX posts_metadata_idx ON posts USING GIN (metadata);
CREATE INDEX posts_tags_idx ON posts USING GIN (tags);

-- Full-text search indexes
CREATE INDEX posts_search_idx ON posts USING GIN (to_tsvector('english', title || ' ' || content));
```

## Schema Restructuring

### Schema Migration Tools

Restructure existing schemas safely:

```bash
# Analyze current schema
pgrestify api schema analyze

# Generate restructure plan
pgrestify api schema restructure --plan

# Apply restructuring
pgrestify api schema restructure --execute

# Rollback restructuring
pgrestify api schema restructure --rollback
```

### Safe Schema Changes

```bash
# Add new column
pgrestify api schema alter posts --add-column "summary:text"

# Modify column type
pgrestify api schema alter posts --modify-column "price:decimal:12,2"

# Add constraint
pgrestify api schema alter posts --add-constraint "CHECK (price > 0)"

# Drop column (with confirmation)
pgrestify api schema alter posts --drop-column "old_field" --confirm
```

## Schema Comparison

### Compare Schemas

Compare different schema versions or environments:

```bash
# Compare with another database
pgrestify api schema compare --source local --target production

# Generate diff report
pgrestify api schema diff --output schema-diff.sql

# Compare specific tables
pgrestify api schema compare --tables users,posts
```

### Diff Output

```sql
-- Schema Diff Report
-- Generated: 2024-01-15T10:30:00Z
-- Source: development | Target: production

-- Missing tables in target
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Column differences
ALTER TABLE users ADD COLUMN last_login TIMESTAMPTZ;
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Missing indexes
CREATE INDEX posts_title_idx ON posts (title);

-- RLS policy differences
CREATE POLICY "posts_user_read" ON posts FOR SELECT TO authenticated USING (true);
```

## Best Practices

### Schema Design

1. **Always use UUIDs for primary keys** in distributed systems
2. **Enable RLS by default** for security
3. **Create proper indexes** for query performance
4. **Use meaningful table and column names**
5. **Document relationships** with foreign keys
6. **Include audit columns** (created_at, updated_at)

### Security Considerations

1. **Never expose sensitive data** without proper RLS
2. **Use specific role permissions** instead of broad access
3. **Regularly validate schema security**
4. **Audit schema changes** in production
5. **Test RLS policies** thoroughly

### Performance Optimization

1. **Create indexes for frequently queried columns**
2. **Use partial indexes** for filtered queries
3. **Consider composite indexes** for multi-column queries
4. **Monitor query performance** and adjust indexes
5. **Use appropriate PostgreSQL data types**

## Troubleshooting

### Common Issues

#### RLS Blocks Queries
```bash
# Check RLS policies
pgrestify api schema rls posts --list

# Temporarily disable RLS (development only)
pgrestify api schema rls posts --disable
```

#### Missing Permissions
```bash
# Grant necessary permissions
pgrestify api schema grants --role authenticated --table posts

# Check current permissions
pgrestify api schema validate --check-permissions
```

#### Index Performance Issues
```bash
# Analyze query performance
EXPLAIN ANALYZE SELECT * FROM posts WHERE title = 'example';

# Generate recommended indexes
pgrestify api schema indexes posts --recommend
```

## Summary

PGRestify's schema management tools provide comprehensive control over your PostgreSQL database structure with PostgREST integration. From initial schema generation to ongoing validation and optimization, these tools ensure your database is secure, performant, and compatible with PostgREST's requirements.