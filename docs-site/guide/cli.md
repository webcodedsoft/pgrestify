# CLI Tool

PGRestify CLI is a comprehensive command-line tool designed to streamline PostgREST development. It provides separate commands for frontend client projects and backend API configuration, ensuring security and clarity in your development workflow.

## Quick Start

```bash
# Install globally
npm install -g pgrestify

# Initialize a new API project
pgrestify api init my-project --template basic

# Start development environment
cd my-project
npm run pgrestify:start
```

## Command Categories

The CLI is organized into three main categories:

### Frontend Commands (Client-Safe)
Commands that are safe for client-side projects and never handle credentials:

```bash
pgrestify frontend init     # Initialize a frontend project
pgrestify frontend types    # Generate TypeScript types from PostgREST API
pgrestify frontend hooks    # Generate React/Vue hooks
```

### API/Backend Commands (PostgREST & Database)
Commands for backend development, database management, and API configuration:

```bash
pgrestify api init               # Initialize complete PostgREST project
pgrestify api migrate            # Run database migrations
pgrestify api schema generate    # Generate schema with RLS
pgrestify api config postgrest   # Generate PostgREST config
pgrestify api config docker      # Generate Docker setup
```

### Shared Commands
Commands that work across different project types:

```bash
pgrestify validate               # Validate project configuration and security
```

## Detailed Documentation

For comprehensive CLI documentation, including detailed command references, examples, and best practices, see:

- **[CLI Overview](/guide/cli/overview)** - Complete command structure and installation
- **[Project Initialization](/guide/cli/project-init)** - Frontend & API project setup
- **[Schema Management](/guide/cli/schema-management)** - Database schema generation with RLS
- **[Migrations](/guide/cli/migrations)** - Database migration system
- **[Functions](/guide/cli/functions)** - PostgreSQL function generation
- **[Features](/guide/cli/features)** - Views, triggers, and indexes
- **[Configuration](/guide/cli/configuration)** - PostgREST and Docker configuration
- **[Security](/guide/cli/security)** - Security validation and scanning
- **[Templates](/guide/cli/templates)** - Project templates and customization

## Common Usage Patterns
--typescript          # Use TypeScript (default: true)
--skip-prompts        # Use defaults without prompts
```

**Examples:**
```bash
# Interactive setup
pgrestify frontend init

# React project with TypeScript
pgrestify frontend init --framework react --typescript

# Connect to existing PostgREST API
pgrestify frontend init https://api.example.com
```

### `pgrestify frontend types`

Generate TypeScript types from PostgREST schema.

**Options:**
```bash
--api-url <url>       # PostgREST API URL
--output <file>       # Output file (default: src/types/database.ts)
--schema <name>       # Schema name (default: api)
```

**Examples:**
```bash
# Generate from local API
pgrestify frontend types

# Generate from remote API
pgrestify frontend types --api-url https://api.example.com

# Custom output location
pgrestify frontend types --output src/db-types.ts
```

### `pgrestify frontend hooks`

Generate React/Vue hooks for database operations.

**Examples:**
```bash
# Generate all hooks
pgrestify frontend hooks

# Generate specific table hooks
pgrestify frontend hooks --tables users,posts
```

---

## API Commands

### `pgrestify api init`

Initialize complete PostgREST project with **table-based folder structure**.

**Options:**
```bash
--skip-prompts              # Skip interactive prompts
--template <type>           # Schema template (basic|blog|ecommerce)
--env <environment>         # Environment (development|production)
--local                     # Use local PostgreSQL instead of Docker
--run-migrations            # Auto-run migrations after generation
--testing-data              # Generate and apply testing data
--testing-records <count>   # Number of test records (default: 50)
--testing-with-images       # Include image URLs in test data
```

**Templates:**

**`basic`** - Minimal setup:
```bash
pgrestify api init --template basic --skip-prompts
```
*Generates:* `users`, `profiles` tables with basic structure

**`blog`** - Complete blog:
```bash
pgrestify api init --template blog --skip-prompts
```
*Generates:* `authors`, `categories`, `posts`, `comments` tables

**`ecommerce`** - E-commerce platform:
```bash
pgrestify api init --template ecommerce --skip-prompts
```
*Generates:* `customers`, `addresses`, `categories`, `products`, `orders`, `order_items` tables

**Generated Structure (Table-Based Folders):**
```
sql/
├── schemas/
│   ├── _setup/
│   │   └── table.sql          # Roles, extensions, permissions
│   ├── users/
│   │   ├── table.sql          # Table definition
│   │   ├── rls.sql            # Row Level Security policies
│   │   ├── triggers.sql       # Audit triggers
│   │   ├── indexes.sql        # Performance indexes
│   │   └── views.sql          # Table-specific views
│   └── [other_tables]/
│       └── [same structure]
├── functions/
│   └── auth.sql               # Authentication functions
└── migrations/                # User migrations
```

### `pgrestify api migrate`

Run database migrations using conservative order.

**Options:**
```bash
--docker                # Use Docker containers
--force                 # Continue on errors
--dry-run               # Show what would be executed
--verbose               # Show detailed output
```

**Migration Order (Conservative Approach):**
1. **Pass 1**: All `table.sql` files (table definitions)
2. **Pass 2a**: All `indexes.sql` files (performance indexes)
3. **Pass 2b**: All `rls.sql` files (security policies)
4. **Pass 2c**: All `triggers.sql` files (audit triggers)  
5. **Pass 2d**: All `views.sql` files (last - may depend on other tables)

**Examples:**
```bash
# Run with Docker
pgrestify api migrate --docker

# Local PostgreSQL
pgrestify api migrate

# Dry run to preview
pgrestify api migrate --dry-run
```

### `pgrestify api schema`

Schema management commands with table-folder structure.

#### `pgrestify api schema generate`

Generate PostgREST schema with RLS policies.

**Options:**
```bash
--with-rls              # Include RLS policies (default: true)
--with-functions        # Include utility functions (default: true)
--with-triggers         # Include audit triggers (default: true)
--schema <name>         # Schema name (default: api)
--tables <tables>       # Comma-separated table names
--single-file           # Deprecated (uses table-folders anyway)
```

**Examples:**
```bash
# Interactive mode
pgrestify api schema generate

# Specific tables
pgrestify api schema generate --tables users,posts,comments

# Without triggers
pgrestify api schema generate --with-triggers=false
```

#### `pgrestify api schema validate`

Validate PostgREST schema configuration.

**Options:**
```bash
--schema <name>         # Schema name (default: api)
--check-rls             # Validate RLS policies
--check-permissions     # Validate role permissions
```

#### `pgrestify api schema rls`

Manage Row Level Security policies.

**Subcommands:**

**`add <table>`** - Add RLS policy to table:
```bash
pgrestify api schema rls add users
pgrestify api schema rls add posts --policy-type user_specific
```

**`update <table> <policy>`** - Update existing policy:
```bash
pgrestify api schema rls update users select_policy
```

**`test <table>`** - Generate RLS tests:
```bash
pgrestify api schema rls test users
```

**`list [table]`** - List policies:
```bash
pgrestify api schema rls list
pgrestify api schema rls list users
```

**`fix-anonymous`** - Fix anonymous access issues:
```bash
pgrestify api schema rls fix-anonymous
```

#### `pgrestify api schema restructure`

Migrate from old numbered files to new table-based structure.

**Options:**
```bash
--dry-run               # Preview changes without applying
--backup                # Create backup before migration
--force                 # Overwrite existing table folders
```

**Examples:**
```bash
# Preview migration
pgrestify api schema restructure --dry-run

# Perform migration with backup
pgrestify api schema restructure --backup
```

### `pgrestify api generate`

Generate optimized database objects using intelligent analysis.

#### `pgrestify api generate policy <table>`

Generate RLS policies with intelligent ownership detection.

**Options:**
```bash
--schema <name>           # Schema name (default: api)
--pattern <type>          # Policy pattern (user_specific|public_read|admin_only|custom)
--owner-column <column>   # Column for ownership (auto-detected)
--all-tables              # Generate for all tables
```

**Examples:**
```bash
# Auto-detect ownership pattern
pgrestify api generate policy users

# Specific pattern
pgrestify api generate policy posts --pattern user_specific --owner-column author_id

# All tables
pgrestify api generate policy --all-tables
```

#### `pgrestify api generate view <name>`

Generate optimized views using intelligent schema analysis.

**Options:**
```bash
--schema <name>           # Schema name (default: api)
--base-table <table>      # Base table (determines output folder)
--materialized            # Create materialized view
--template <type>         # View template
```

**Examples:**
```bash
# Interactive view creation
pgrestify api generate view user_posts

# Materialized view
pgrestify api generate view daily_stats --materialized --base-table analytics
```

#### `pgrestify api generate function <name>`

Generate PostgreSQL functions.

**Options:**
```bash
--schema <name>           # Schema name (default: api)
--template <type>         # Function template (auth|crud|custom)
--return-type <type>      # Return type (JSON|TABLE|etc.)
```

**Examples:**
```bash
# Authentication functions
pgrestify api generate function auth_functions --template auth

# Custom function
pgrestify api generate function calculate_total --return-type JSON
```

#### `pgrestify api generate index <table>`

Generate optimized indexes using performance analysis.

**Options:**
```bash
--schema <name>           # Schema name (default: api)
--analyze                 # Analyze query patterns first
--column <column>         # Specific column to index
```

### `pgrestify api features`

Advanced PostgreSQL features.

#### `pgrestify api features views`

**Subcommands:**

**`generate <name>`** - Generate PostgreSQL view:
```bash
pgrestify api features views generate user_posts --base-table users
```

**`suggest`** - Analyze and suggest useful views:
```bash
pgrestify api features views suggest
```

**`analyze`** - Analyze schema relationships:
```bash
pgrestify api features views analyze
```

**`list`** - List existing views:
```bash
pgrestify api features views list
```

#### `pgrestify api features triggers`

Generate PostgreSQL triggers with intelligent analysis.

**Subcommands:**

**`add <table>`** - Add trigger to table:
```bash
pgrestify api features triggers add users --type audit
```

**`generate <name>`** - Generate custom trigger:
```bash
pgrestify api features triggers generate update_timestamp
```

**`audit-all`** - Add audit triggers to all tables:
```bash
pgrestify api features triggers audit-all
```

#### `pgrestify api features indexes`

Generate performance indexes with intelligent analysis.

**Subcommands:**

**`add <table>`** - Add index to table:
```bash
pgrestify api features indexes add users --column email
```

**`analyze`** - Analyze query patterns for index suggestions:
```bash
pgrestify api features indexes analyze
```

**`suggest`** - Suggest indexes based on schema analysis:
```bash
pgrestify api features indexes suggest
```

### `pgrestify api config`

Configuration management.

#### `pgrestify api config postgrest`

Generate PostgREST configuration.

**Options:**
```bash
--db-uri <uri>            # Database connection URI
--env <environment>       # Environment (development|production)
--output <file>           # Output file (default: postgrest.conf)
```

#### `pgrestify api config docker`

Generate Docker Compose configuration.

**Options:**
```bash
--output <file>                # Output file (default: docker-compose.yml)
--append-to <file>             # Append to existing docker-compose file
--env <environment>            # Environment (development|production)
--include-db                   # Include PostgreSQL service (default: true)
--db-version <version>         # PostgreSQL version (default: 15)
--postgrest-version <version>  # PostgREST version (default: latest)
```

**Examples:**
```bash
# Basic Docker setup
pgrestify api config docker

# Production-ready setup
pgrestify api config docker --env production

# Custom versions
pgrestify api config docker --db-version 14 --postgrest-version v11.2.0

# Append to existing file
pgrestify api config docker --append-to existing-compose.yml
```

### `pgrestify api functions`

PostgREST function management.

#### `pgrestify api functions create`

Create PostgREST functions.

**Options:**
```bash
--name <name>             # Function name
--type <type>             # Function type (auth|crud|custom)
--schema <name>           # Schema name (default: api)
```

### `pgrestify api testing-data`

Generate realistic testing/dummy data.

**Options:**
```bash
--template <type>         # Template (basic|blog|ecommerce)
--records <count>         # Number of records (default: 50)
--with-images             # Include image URLs
--output <file>           # Output file
```

### `pgrestify api update`

Update existing configurations.

### `pgrestify api sync`

Detect and synchronize manual database changes.

### `pgrestify api migrations`

Manage database migrations and schema versioning.

---

## Table-Based Folder Structure

PGRestify now uses a **mandatory table-based folder structure** for better organization:

### New Structure (Current)
```
sql/schemas/
├── users/
│   ├── table.sql          # Table definition
│   ├── rls.sql            # Row Level Security policies
│   ├── triggers.sql       # Audit triggers  
│   ├── indexes.sql        # Performance indexes
│   └── views.sql          # Table-specific views
├── posts/
│   ├── table.sql
│   ├── rls.sql
│   └── ...
└── _setup/
    └── table.sql          # Roles, extensions, permissions
```

### Old Structure (Deprecated)
```
sql/schemas/
├── 01_main.sql           # ALL tables
├── 02_rls.sql            # ALL RLS policies
├── 03_views.sql          # ALL views
├── 04_triggers.sql       # ALL triggers
└── 05_indexes.sql        # ALL indexes
```

### Migration from Old Structure

Use the restructure command to migrate existing projects:

```bash
# Preview migration
pgrestify api schema restructure --dry-run

# Perform migration with backup
pgrestify api schema restructure --backup

# Force migration (overwrite existing folders)
pgrestify api schema restructure --force
```

### Benefits of Table-Based Structure

- **Better Organization**: Each table has its own folder
- **Easier Maintenance**: Find table-specific code quickly
- **Scalable**: Add tables without cluttering
- **Team Collaboration**: Different developers can work on different tables
- **Version Control Friendly**: Smaller, focused files

---

## Development Workflow

### 1. Initial Project Setup

```bash
# Create new PostgREST project
pgrestify api init my-project --template blog --skip-prompts

# Or initialize in existing directory
cd my-existing-project
pgrestify api init --skip-prompts
```

### 2. Run Database Setup

```bash
# With Docker (recommended)
npm run pgrestify:start

# Or manually apply SQL files
npm run pgrestify:setup
```

### 3. Generate Additional Features

```bash
# Add RLS policies
pgrestify api generate policy users --pattern user_specific

# Create custom views
pgrestify api features views generate user_posts --base-table users

# Add performance indexes
pgrestify api features indexes add posts --column title

# Generate functions
pgrestify api generate function auth_helpers --template auth
```

### 4. Generate Frontend Types

```bash
# Generate TypeScript types
pgrestify frontend types --api-url http://localhost:3000
```

---

## Configuration Files Generated

### `postgrest.conf`
PostgREST configuration with security settings:
```ini
db-uri = "postgresql://postgres:password@localhost:5432/my_project"
db-schema = "api"
db-anon-role = "web_anon"
db-pre-request = "authenticator"
server-host = "0.0.0.0"
server-port = 3000
jwt-secret = "generated-secure-secret"
```

### `docker-compose.yml`
PostgreSQL + PostgREST containers:
```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: my_project
    ports:
      - "5432:5432"
      
  postgrest:
    image: postgrest/postgrest:latest
    depends_on:
      - postgres
    ports:
      - "3000:3000"
```

### `package.json` Scripts
Convenient development scripts:
```json
{
  "scripts": {
    "pgrestify:start": "docker compose up -d",
    "pgrestify:stop": "docker compose down", 
    "pgrestify:logs": "docker compose logs -f postgrest",
    "pgrestify:setup": "./scripts/setup.sh",
    "pgrestify:migrate": "pgrestify api migrate"
  }
}
```

---

## File Output Locations

### Table-Specific Files
All table-related SQL is written to table-specific folders:

- **Table Definition**: `sql/schemas/{table}/table.sql`
- **RLS Policies**: `sql/schemas/{table}/rls.sql`
- **Triggers**: `sql/schemas/{table}/triggers.sql`
- **Indexes**: `sql/schemas/{table}/indexes.sql`
- **Views**: `sql/schemas/{table}/views.sql` (when view is table-specific)

### Shared Files
- **Functions**: `sql/functions/{name}.sql`
- **Schema Setup**: `sql/schemas/_setup/table.sql`
- **Migrations**: `sql/migrations/{timestamp}_{name}.sql`

### When Files Are Appended
When you add features to existing tables, SQL is **appended with timestamps**:

```sql
-- Added by pgrestify api features indexes add users --column email
-- Generated: 2025-08-31T10:30:45.123Z
CREATE INDEX idx_users_email ON api.users(email);
```

---

## Command Flags Reference

### Global Flags
```bash
--verbose               # Detailed output
--quiet                 # Minimal output
--no-color              # Disable colored output
--help                  # Show command help
```

### Common Flags Across Commands
```bash
--skip-prompts          # Use defaults (available on most commands)
--schema <name>         # PostgreSQL schema name (default: api)
--output <file>         # Output file/directory
--force                 # Overwrite existing files
--dry-run               # Preview without making changes
--backup                # Create backup before changes
```

### Template-Specific Flags
```bash
--template <type>       # Available: basic, blog, ecommerce
--env <environment>     # Available: development, production
--with-rls              # Include Row Level Security (default: true)
--with-functions        # Include utility functions (default: true)
--with-triggers         # Include audit triggers (default: true)
```

---

## Security Features

### Built-in Security
- **RLS by Default**: All tables have Row Level Security enabled
- **Secure Roles**: Proper `web_anon` and `web_user` role separation
- **JWT Integration**: Automatic JWT secret generation
- **Input Validation**: SQL injection prevention
- **No Credential Storage**: CLI never stores database passwords

### Security Validation
```bash
# Comprehensive security check
pgrestify validate

# Check specific areas
pgrestify validate --check-rls --check-permissions
```

---

## Troubleshooting

### Common Issues

#### Port 5432 Already in Use
```bash
# Change PostgreSQL port in .env
POSTGRES_PORT=5433

# Or stop existing PostgreSQL
brew services stop postgresql
```

#### Docker Compose Command Not Found
```bash
# Use Docker Compose v2 (already handled in generated files)
docker compose up -d
```

#### Schema "api" Does Not Exist
```bash
# Run migrations first
npm run pgrestify:setup
```

#### localhost:3000 Not Working
PostgREST now uses `server-host = "0.0.0.0"` to support both:
- `http://localhost:3000`
- `http://127.0.0.1:3000`

### Debug Mode
```bash
# Enable verbose logging
DEBUG=pgrestify:* pgrestify api init
```

---

## Integration Examples

### React Integration
```bash
# Initialize React project
pgrestify frontend init --framework react

# Generate types and hooks
pgrestify frontend types
pgrestify frontend hooks
```

### Next.js Integration  
```bash
# Initialize Next.js project
pgrestify frontend init --framework react --typescript

# Generate API types
pgrestify frontend types --output src/types/database.ts
```

### Existing Project Integration
```bash
# Add PGRestify to existing backend
pgrestify api init --skip-prompts

# Add PGRestify to existing frontend
pgrestify frontend init https://your-api.com
```

---

## Performance Tips

### Development
- Use `--skip-prompts` for faster setup
- Use Docker for consistent environments
- Generate types after schema changes

### Production
- Use `--env production` for optimized configs
- Enable connection pooling
- Use materialized views for heavy queries

---

## Command Cheat Sheet

```bash
# 🚀 Quick Start
pgrestify api init my-project --template blog --skip-prompts
cd my-project && npm run pgrestify:start

# 📊 Generate Features  
pgrestify api generate policy users            # RLS policies
pgrestify api features views generate stats    # Custom views
pgrestify api features indexes add posts       # Performance indexes

# 🔄 Migration & Updates
pgrestify api migrate --docker                 # Run migrations
pgrestify api schema restructure               # Migrate to table-folders

# 🎯 Frontend Integration
pgrestify frontend init --framework react      # Frontend setup
pgrestify frontend types                       # Generate types

# 🔍 Validation & Security
pgrestify validate                             # Security check
pgrestify api schema rls fix-anonymous         # Fix permissions
```

---

## Next Steps

- **[Getting Started](./getting-started)** - Complete walkthrough
- **[Authentication](./authentication)** - JWT setup and RLS
- **[React Integration](./react)** - Using with React
- **[Next.js Integration](./nextjs)** - Full Next.js setup
- **[Production Deployment](./production)** - Deployment guide

**🚀 Ready to build with PGRestify's powerful CLI!**