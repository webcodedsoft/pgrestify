# Migrations

PGRestify provides migration capabilities through its CLI tool, allowing you to version-control your database schema changes and apply them consistently across different environments. While PostgREST doesn't support traditional migration files, PGRestify's approach focuses on SQL file generation and structured database management.

## Overview

Migration features in PGRestify include:

- **SQL File Generation**: Generate structured SQL files for database schema
- **Migration Runner**: Apply SQL changes to your PostgreSQL database
- **Schema Versioning**: Track and manage database schema changes
- **Environment Support**: Different configurations for development, staging, production
- **Docker Integration**: Run migrations in Docker containers
- **Rollback Support**: Manual rollback through SQL file management

## Getting Started with Migrations

### Initial Setup

Create a new project with migration support:

```bash
# Initialize API project with migration structure
pgrestify api init my-project --template basic

cd my-project

# View generated structure
tree sql/
```

Generated migration structure:
```
sql/
├── schemas/
│   ├── 01_main.sql        # Core tables and schemas
│   ├── 02_rls.sql         # Row Level Security policies
│   ├── 03_views.sql       # Database views
│   ├── 04_triggers.sql    # Audit and other triggers
│   └── 05_indexes.sql     # Performance indexes
├── functions/
│   └── auth.sql           # Authentication functions
└── migrations/            # Custom migrations
    └── .gitkeep
```

### Running Initial Migration

```bash
# Start PostgreSQL with Docker
docker compose up -d postgres

# Run initial database setup
pgrestify api migrate

# Verify tables were created
pgrestify api migrate --verify
```

## Schema Generation

### Generate Table Schema

Create tables with proper structure and RLS policies:

```bash
# Generate a users table
pgrestify api schema generate users

# Generate with specific columns
pgrestify api schema generate posts \
  --columns "title:text,content:text,author_id:uuid,published:boolean"

# Generate with relationships
pgrestify api schema generate comments \
  --columns "content:text,post_id:uuid,author_id:uuid" \
  --foreign-keys "post_id:posts(id),author_id:users(id)"
```

Generated SQL structure for a table:

```sql
-- sql/schemas/01_main.sql (excerpt)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automatically include updated_at trigger
CREATE TRIGGER users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

### Generate RLS Policies

Row Level Security policies are generated automatically:

```sql
-- sql/schemas/02_rls.sql (excerpt)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY users_select_own ON users
    FOR SELECT
    USING (auth.uid() = id OR auth.role() = 'admin');

-- Users can update their own profile
CREATE POLICY users_update_own ON users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Only admins can insert new users
CREATE POLICY users_insert_admin ON users
    FOR INSERT
    WITH CHECK (auth.role() = 'admin');
```

## Migration Management

### Custom Migrations

Create custom migration files for schema changes:

```bash
# Create a custom migration
mkdir -p sql/migrations/2024-01-15-add-user-preferences

# Create the migration file
cat > sql/migrations/2024-01-15-add-user-preferences/up.sql << 'EOF'
-- Add preferences column to users table
ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}';

-- Create index for JSON queries
CREATE INDEX idx_users_preferences ON users USING GIN (preferences);

-- Update RLS policy to allow preference updates
DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
EOF

# Create rollback file
cat > sql/migrations/2024-01-15-add-user-preferences/down.sql << 'EOF'
-- Remove preferences column and index
DROP INDEX IF EXISTS idx_users_preferences;
ALTER TABLE users DROP COLUMN IF EXISTS preferences;

-- Restore original RLS policy
DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own ON users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND id = NEW.id);
EOF
```

### Running Custom Migrations

```bash
# Run specific migration
pgrestify api migrate --file sql/migrations/2024-01-15-add-user-preferences/up.sql

# Run all pending migrations
pgrestify api migrate --all

# Force migration (continue on errors)
pgrestify api migrate --force

# Dry run (show what would be executed)
pgrestify api migrate --dry-run
```

### Migration with Docker

```bash
# Run migrations in Docker container
pgrestify api migrate --docker

# Specify Docker compose service
pgrestify api migrate --docker --service postgres

# Use specific Docker network
pgrestify api migrate --docker --network my-network
```

## Migration Patterns

### TypeORM-Style Migration Class

While PGRestify doesn't use class-based migrations like TypeORM, you can organize migrations with consistent patterns:

```typescript
// migration-template.ts (for reference/documentation)
interface Migration {
  readonly name: string;
  readonly timestamp: number;
  
  up(): Promise<void>;
  down(): Promise<void>;
}

// Example pattern for organizing migration logic
class AddUserPreferences20240115 implements Migration {
  readonly name = 'AddUserPreferences';
  readonly timestamp = 20240115;
  
  async up(): Promise<void> {
    // SQL commands would go in up.sql file:
    // - ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}'
    // - CREATE INDEX idx_users_preferences ON users USING GIN (preferences)
  }
  
  async down(): Promise<void> {
    // SQL commands would go in down.sql file:
    // - DROP INDEX IF EXISTS idx_users_preferences
    // - ALTER TABLE users DROP COLUMN IF EXISTS preferences
  }
}
```

### Schema Evolution Patterns

#### Adding Columns

```sql
-- migrations/add-avatar-column/up.sql
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;

-- Update RLS policies if needed
CREATE POLICY users_read_public_info ON users
    FOR SELECT
    USING (true)  -- Allow reading public info like bio and avatar
    WITH CHECK (false);  -- But not for modifications
```

#### Adding Relationships

```sql
-- migrations/add-user-posts/up.sql
-- Create posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY posts_select_published ON posts
    FOR SELECT
    USING (published = true OR auth.uid() = author_id);

CREATE POLICY posts_insert_own ON posts
    FOR INSERT
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY posts_update_own ON posts
    FOR UPDATE
    USING (auth.uid() = author_id)
    WITH CHECK (auth.uid() = author_id);

-- Add indexes
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_published ON posts(published) WHERE published = true;
```

#### Modifying Constraints

```sql
-- migrations/modify-email-constraints/up.sql
-- Add email validation
ALTER TABLE users ADD CONSTRAINT valid_email 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Make username unique (if adding username)
ALTER TABLE users ADD COLUMN username TEXT;
UPDATE users SET username = LOWER(SPLIT_PART(email, '@', 1)) WHERE username IS NULL;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT unique_username UNIQUE (username);
```

## Environment-Specific Migrations

### Development Environment

```bash
# Development-specific setup
pgrestify api migrate --env development

# Include test data
pgrestify api migrate --include-test-data

# Reset development database
pgrestify api migrate --reset --env development
```

### Production Environment

```bash
# Production migration with backup
pgrestify api migrate --env production --backup

# Staged migration (test first, then apply)
pgrestify api migrate --env production --dry-run
pgrestify api migrate --env production --confirm

# Zero-downtime migration pattern
pgrestify api migrate --env production --no-lock
```

### Configuration Files

```javascript
// pgrestify.config.js
module.exports = {
  environments: {
    development: {
      database: {
        host: 'localhost',
        port: 5432,
        database: 'myapp_dev',
        username: 'postgres'
      },
      migrations: {
        directory: './sql/migrations',
        includeTestData: true
      }
    },
    
    production: {
      database: {
        // Use environment variables in production
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME,
        username: process.env.DB_USER
      },
      migrations: {
        directory: './sql/migrations',
        requireConfirmation: true,
        backupBeforeMigration: true
      }
    }
  }
};
```

## Migration Best Practices

### Safe Migration Patterns

```sql
-- 1. Always use IF EXISTS/IF NOT EXISTS
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Use transactions for atomic operations
BEGIN;
    ALTER TABLE users ADD COLUMN temp_field TEXT;
    UPDATE users SET temp_field = 'default_value';
    ALTER TABLE users ALTER COLUMN temp_field SET NOT NULL;
COMMIT;

-- 3. Create indexes concurrently (non-blocking)
CREATE INDEX CONCURRENTLY idx_users_created_at ON users(created_at);

-- 4. Add constraints as NOT VALID first, then validate
ALTER TABLE users ADD CONSTRAINT check_email 
    CHECK (email IS NOT NULL) NOT VALID;
ALTER TABLE users VALIDATE CONSTRAINT check_email;
```

### Rollback Strategies

```bash
# Manual rollback
pgrestify api migrate --file sql/migrations/2024-01-15-add-preferences/down.sql

# Automated rollback to specific migration
pgrestify api migrate --rollback-to 20240110

# Create rollback script for complex changes
cat > rollback-preferences.sql << 'EOF'
-- Step 1: Remove dependent objects
DROP INDEX IF EXISTS idx_users_preferences;

-- Step 2: Remove column
ALTER TABLE users DROP COLUMN IF EXISTS preferences;

-- Step 3: Update any affected RLS policies
-- (Add specific policy updates here)
EOF
```

### Migration Testing

```bash
# Test migration on copy of production data
pgrestify api migrate --test --copy-prod-data

# Validate migration results
pgrestify api validate --after-migration

# Performance testing after migration
pgrestify api migrate --benchmark
```

## Integration with Repository Pattern

### Using Migrations with Repositories

After running migrations, your repositories automatically work with new schema:

```typescript
// After adding preferences column via migration
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  preferences?: Record<string, any>; // New column
  created_at: string;
}

const userRepository = dataManager.getRepository<User>('users');

// New column is immediately available
const userWithPrefs = await userRepository.update(
  { id: 'user-123' },
  { 
    preferences: { 
      theme: 'dark', 
      notifications: true 
    } 
  }
);
```

### Schema Validation

```typescript
// Validate schema matches expectations
const validateSchema = async () => {
  try {
    // Test that new column exists
    await userRepository.findOne({ 
      preferences: { theme: 'dark' } 
    });
    console.log('✅ Schema migration successful');
  } catch (error) {
    console.error('❌ Schema validation failed:', error);
  }
};
```

## Migration Monitoring

### Migration Status

```bash
# Check migration status
pgrestify api migrate --status

# View migration history
pgrestify api migrate --history

# Verify current schema version
pgrestify api migrate --version
```

### Migration Logs

```bash
# View migration logs
pgrestify api migrate --logs

# Export migration report
pgrestify api migrate --report > migration-report.json

# Monitor long-running migrations
pgrestify api migrate --progress
```

## Summary

PGRestify migrations provide:

- **Structured Schema Management**: Organized SQL files with clear execution order
- **CLI Integration**: Comprehensive migration commands through the CLI tool
- **Environment Support**: Different configurations for various deployment environments
- **Docker Support**: Container-based migration execution
- **Safety Features**: Dry-run, backup, and validation capabilities
- **TypeORM-Like Patterns**: Familiar migration concepts adapted for PostgREST
- **Repository Integration**: Seamless integration with the repository pattern

While different from TypeORM's class-based approach, PGRestify migrations provide powerful, SQL-focused database evolution capabilities that work excellently with PostgREST's architecture.