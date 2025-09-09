# Database Migrations

PGRestify CLI provides a comprehensive migration system for applying SQL schemas to PostgreSQL databases. The migration runner supports both local PostgreSQL and Docker deployments with proper error handling and rollback capabilities.

## Migration Overview

The migration system:

- Executes SQL files in a specific order for proper schema setup
- Supports both Docker and local PostgreSQL connections
- Handles schema files and optional testing data separately
- Provides confirmation prompts and error handling
- Uses folder-based organization for table definitions

## Running Migrations

### Basic Migration Command

```bash
# Run migrations with prompts
pgrestify api migrate

# Run migrations with Docker
pgrestify api migrate --docker

# Force migrations without prompts
pgrestify api migrate --force

# Skip testing data insertion
pgrestify api migrate --skip-testing-data
```

### Migration Options

```bash
pgrestify api migrate [options]

Database Connection Options:
  --db-uri <uri>            Full database connection URI
  --host <host>             Database host (default: localhost)
  --port <port>             Database port (default: 5432)
  --database <database>     Database name
  --username <username>     Database username (default: postgres)
  --password <password>     Database password

Execution Options:
  --docker                  Use Docker to run migrations
  --force                   Force migrations even if some fail
  --skip-testing-data       Skip testing data insertion (schema only)
```

### Connection Methods

#### Using Connection URI

```bash
# Full connection string
pgrestify api migrate --db-uri "postgresql://username:password@localhost:5432/database_name"

# With environment variables
export DATABASE_URL="postgresql://user:pass@localhost:5432/myapp"
pgrestify api migrate --db-uri $DATABASE_URL
```

#### Individual Connection Parameters

```bash
# Specify each parameter
pgrestify api migrate \
  --host localhost \
  --port 5432 \
  --database myapp_db \
  --username myuser \
  --password mypassword
```

#### Docker Execution

```bash
# Use Docker container for migration
pgrestify api migrate --docker

# Assumes docker-compose.yml with postgres service
# Executes: docker compose exec postgres psql -U postgres -d database_name
```

## Migration File Structure

The migration system looks for SQL files in this structure:

```
sql/
├── 00-extensions.sql         # PostgreSQL extensions
├── 01-schemas.sql           # Schema definitions
├── 02-tables/               # Table folder structure
│   ├── users/
│   │   ├── table.sql       # Table definition
│   │   ├── rls.sql         # Row Level Security policies
│   │   ├── triggers.sql    # Audit triggers
│   │   └── indexes.sql     # Performance indexes
│   ├── posts/
│   │   └── ...
│   └── comments/
│       └── ...
├── 03-functions.sql         # PostgreSQL functions
├── 04-views.sql            # Database views
├── 05-grants.sql           # Permission grants
└── testing_data.sql        # Optional test data
```

### Execution Order

Files are executed in this specific order:

1. **Extensions** (`00-extensions.sql`) - Enable required PostgreSQL extensions
2. **Schemas** (`01-schemas.sql`) - Create database schemas
3. **Tables** (`02-tables/*/`) - Create tables in alphabetical order by folder
   - `table.sql` - Table structure
   - `rls.sql` - Row Level Security policies
   - `triggers.sql` - Audit triggers
   - `indexes.sql` - Performance indexes
4. **Functions** (`03-functions.sql`) - Custom PostgreSQL functions
5. **Views** (`04-views.sql`) - Database views
6. **Grants** (`05-grants.sql`) - Permission grants
7. **Testing Data** (`testing_data.sql`) - Sample data (optional)

## Interactive Migration Process

### Confirmation Prompts

When running without `--force`, the CLI shows:

```bash
$ pgrestify api migrate

🗄️  Database Migration Runner

📋 Found Migration Files:
  📄 00-extensions.sql
  📄 01-schemas.sql
  📄 02-tables/users/table.sql
  📄 02-tables/users/rls.sql
  📄 02-tables/posts/table.sql
  📄 02-tables/posts/rls.sql
  📄 03-functions.sql
  📄 04-views.sql
  📄 05-grants.sql
  🎲 testing_data.sql (testing data)

⚠️  Testing data will insert sample records into your database.
   This is useful for development but should NOT be used in production.

? Run these migrations against the database? (y/N)
? Include testing data? (y/N)
```

### Database Configuration Prompts

If connection details aren't provided, the CLI prompts for:

```bash
🔧 Database Configuration
? Database host: (localhost)
? Database port: (5432)
? Database name: myapp_db
? Database username: (postgres)
? Database password: [hidden]
? Use Docker for execution? (Y/n)
```

## Migration Execution

### Successful Migration

```bash
✅ Migration completed successfully!

📊 Migration Summary:
  ✅ 00-extensions.sql - Extensions enabled
  ✅ 01-schemas.sql - Schemas created
  ✅ 02-tables/users/table.sql - Table created
  ✅ 02-tables/users/rls.sql - RLS policies applied
  ✅ 02-tables/posts/table.sql - Table created
  ✅ 02-tables/posts/rls.sql - RLS policies applied
  ✅ 03-functions.sql - Functions created
  ✅ 04-views.sql - Views created
  ✅ 05-grants.sql - Permissions granted
  ✅ testing_data.sql - Test data inserted

🎉 Database setup complete!
🔗 PostgREST should now be able to connect to your database.
```

### Handling Errors

```bash
❌ Migration failed at 02-tables/users/rls.sql

Error: relation "users" does not exist
  at line 2: CREATE POLICY "users_policy" ON users...

💡 Suggestions:
  - Check if previous migrations completed successfully
  - Verify table creation scripts
  - Run with --force to continue despite errors

Continue with remaining migrations? (y/N)
```

## Testing Data Management

### Skipping Testing Data

```bash
# Schema only, no sample data
pgrestify api migrate --skip-testing-data
```

### Testing Data Features

When testing data is included:
- Realistic sample records for all tables
- Proper foreign key relationships
- Configurable record counts
- Optional image URLs from placeholder services
- Respects database constraints

### Testing Data Structure

```sql
-- testing_data.sql example
-- Insert sample users
INSERT INTO users (email, password_hash, created_at) VALUES
  ('user1@example.com', '$2b$12$...', NOW()),
  ('user2@example.com', '$2b$12$...', NOW());

-- Insert sample posts with relationships
INSERT INTO posts (title, content, author_id, published) VALUES
  ('Sample Post 1', 'Lorem ipsum...', (SELECT id FROM users WHERE email = 'user1@example.com'), true),
  ('Sample Post 2', 'More content...', (SELECT id FROM users WHERE email = 'user2@example.com'), false);
```

## Docker Integration

### Docker Compose Support

The migration command integrates with Docker Compose:

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: myapp_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"

  postgrest:
    image: postgrest/postgrest:latest
    depends_on:
      - postgres
    environment:
      PGRST_DB_URI: postgres://postgres:postgres@postgres:5432/myapp_db
      PGRST_DB_SCHEMA: api
```

### Docker Execution Command

When using `--docker`, the CLI executes:

```bash
# Generated command
docker compose exec -T postgres psql \
  -U postgres \
  -d myapp_db \
  -v ON_ERROR_STOP=1 \
  < sql_file.sql
```

## Migration Best Practices

### Development Workflow

1. **Generate schema** first:
   ```bash
   pgrestify api schema generate --with-rls
   ```

2. **Review generated SQL** before applying:
   ```bash
   # Check generated files in sql/ directory
   cat sql/02-tables/users/table.sql
   ```

3. **Run migrations in development**:
   ```bash
   pgrestify api migrate --docker
   ```

4. **Test with sample data**:
   ```bash
   pgrestify api migrate --docker  # Includes testing data
   ```

### Production Deployment

1. **Skip testing data** in production:
   ```bash
   pgrestify api migrate --skip-testing-data --db-uri $PRODUCTION_DATABASE_URL
   ```

2. **Use connection URIs** for security:
   ```bash
   export DATABASE_URL="postgresql://user:pass@prod-host:5432/prod_db"
   pgrestify api migrate --db-uri $DATABASE_URL --skip-testing-data
   ```

3. **Run migrations with confirmation**:
   ```bash
   # Don't use --force in production
   pgrestify api migrate --skip-testing-data
   ```

### Error Handling

1. **Always backup** before migrations in production
2. **Test migrations** in staging environment first
3. **Use transactions** where possible (PostgreSQL DDL is transactional)
4. **Have rollback plan** for schema changes
5. **Monitor logs** during migration execution

## Troubleshooting Migrations

### Common Issues

#### No Migration Files Found
```bash
❌ No migration files found in sql/ directory
💡 Make sure you're in a project directory with generated SQL files

# Solution: Generate schema first
pgrestify api schema generate
```

#### Connection Refused
```bash
❌ Connection failed: connection refused at localhost:5432

# Solution: Start PostgreSQL or use Docker
docker compose up -d postgres
# or
brew services start postgresql
```

#### Permission Denied
```bash
❌ Permission denied for user 'postgres'

# Solution: Check credentials or use superuser
pgrestify api migrate --username postgres --password your-password
```

#### RLS Policy Errors
```bash
❌ Error: relation "users" does not exist

# Solution: Ensure table creation runs before RLS policies
# Check file execution order and dependencies
```

### Migration Recovery

#### Partial Migration Recovery
```bash
# If migration fails midway, identify the last successful step
# and manually apply remaining files

# Check what tables exist
psql -d myapp_db -c "\dt"

# Apply remaining files manually
psql -d myapp_db -f sql/03-functions.sql
```

#### Testing Data Cleanup
```bash
# Remove testing data if accidentally applied to production
# (This requires careful planning and depends on your schema)

# Example cleanup (be very careful!)
DELETE FROM posts WHERE title LIKE 'Sample Post%';
DELETE FROM users WHERE email LIKE '%@example.com';
```

## Environment Variables

The migration system respects these environment variables:

```bash
# Database connection
DATABASE_URL                # Full connection string
POSTGRES_HOST              # Database host
POSTGRES_PORT              # Database port  
POSTGRES_DB                # Database name
POSTGRES_USER              # Database username
POSTGRES_PASSWORD          # Database password

# Migration behavior
PGRESTIFY_SKIP_PROMPTS     # Skip all confirmations
PGRESTIFY_FORCE            # Force execution
PGRESTIFY_DOCKER           # Use Docker by default
```

## Integration with Other Commands

### Complete Workflow

```bash
# 1. Initialize project
pgrestify api init --template blog

# 2. Generate schema
pgrestify api schema generate --with-rls

# 3. Run migrations
pgrestify api migrate --docker

# 4. Start services
npm run pgrestify:start

# 5. Verify deployment
curl http://localhost:3000/users
```

## Summary

PGRestify's migration system provides reliable database schema deployment with proper error handling, confirmation prompts, and support for both development and production environments. The folder-based organization and ordered execution ensure consistent database setup across different environments.