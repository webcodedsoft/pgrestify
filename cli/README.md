# PGRestify CLI

The official command-line interface for PGRestify - a comprehensive TypeScript client library for PostgREST APIs.

## Overview

PGRestify CLI simplifies the setup and management of PostgreSQL + PostgREST development environments. It provides tools for project initialization, database management, code generation, and Docker orchestration.

## Features

- 🚀 **Quick Project Setup** - Initialize new projects with pre-configured templates
- 🐳 **Docker Integration** - Automated PostgreSQL + PostgREST containerization
- 📝 **Code Generation** - Auto-generate TypeScript types from database schema
- 🔄 **Development Server** - Start/stop/restart development services
- 📊 **Migration Management** - Create and manage database migrations with real PostgreSQL execution
- 🌱 **Database Seeding** - Manage seed data with tracking and rollback support
- 🔐 **JWT Support** - Full support for JWT secrets and PEM files (RSA/ECDSA)
- ⚙️ **Configuration Management** - Generate and manage config files
- 🗄️ **Real Database Operations** - Native PostgreSQL integration with connection pooling

## Installation

The CLI is included with the PGRestify package:

```bash
# Install PGRestify (includes CLI)
npm install @webcoded/pgrestify

# Or install globally for system-wide access
npm install -g @webcoded/pgrestify
```

## Quick Start

```bash
# Create a new project
mkdir my-app && cd my-app
npx @webcoded/pgrestify init

# Start development servers
npm run dev

# Your API is now running at http://localhost:3000
```

## Commands

### `pgrestify setup`

Set up PGRestify in existing projects or configure non-Docker environments.

**Features:**
- Detects existing project setup
- Supports native PostgreSQL installations
- Configures cloud database connections
- Validates existing database credentials
- **NEW: Interactive database credential configuration**

#### Subcommands:

##### `pgrestify setup database` (NEW)
Simplified interactive database credential setup:

```bash
# Interactive credential collection
pgrestify setup database

# Skip prompts and use defaults
pgrestify setup database --skip-prompts

# Also regenerate all dependent files
pgrestify setup database --regenerate-all
```

**What it does:**
- Prompts for database credentials (host, port, database, username, password)
- Updates `pgrestify.config.ts` with your database URL
- Updates `.env.example` with credentials
- Regenerates SQL setup scripts with correct database/user names
- Creates database management scripts in `package.json`
- Supports optional admin credentials for database creation

##### Other Setup Commands:

```bash
# Setup in existing project
pgrestify setup existing

# Native PostgreSQL setup
pgrestify setup native

# Manual PostgreSQL setup
pgrestify setup manual

# Cloud database setup
pgrestify setup cloud --provider supabase

# Migrate from other tools
pgrestify setup migrate --from hasura
```

### `pgrestify init [project-name]`

Initialize a new PGRestify project with PostgreSQL + PostgREST setup.

**Options:**
- `-t, --template <template>` - Project template (basic|blog|ecommerce|saas|cms)
- `--skip-prompts` - Skip interactive prompts and use defaults
- `--use-docker` - Set up Docker development environment
- `--database-url <url>` - PostgreSQL database URL
- `--jwt-secret <secret>` - JWT secret for authentication
- `--jwt-secret-file <path>` - Path to JWT PEM file (RSA/ECDSA)
- `--typescript` - Enable TypeScript configuration

**Examples:**
```bash
# Interactive setup
pgrestify init my-blog

# Quick setup with blog template
pgrestify init my-blog --template blog --skip-prompts

# Custom database configuration
pgrestify init --database-url postgresql://user:pass@localhost/mydb
```

### `pgrestify dev`

Development server management commands.

#### `pgrestify dev:start`

Start PostgreSQL and PostgREST development servers.

**Options:**
- `-p, --port <port>` - PostgREST port (default: 3000)
- `--db-port <port>` - PostgreSQL port (default: 5432)
- `-d, --detach` - Run in detached mode

**Examples:**
```bash
# Start with default ports
pgrestify dev:start

# Custom ports
pgrestify dev:start --port 3001 --db-port 5433
```

#### `pgrestify dev:stop`

Stop development servers.

#### `pgrestify dev:restart`

Restart development servers.

#### `pgrestify dev:reset`

Reset database and restart servers.

**Options:**
- `--confirm` - Skip confirmation prompt

#### `pgrestify dev:logs`

Show development server logs.

**Options:**
- `-f, --follow` - Follow logs
- `-s, --service <service>` - Show logs for specific service

#### `pgrestify dev:status`

Show development server status.

### `pgrestify docker`

Docker container and image management.

#### `pgrestify docker:init`

Initialize Docker configuration for existing project.

**Options:**
- `--postgres-version <version>` - PostgreSQL version (default: 15)
- `--postgrest-version <version>` - PostgREST version (default: latest)
- `--force` - Overwrite existing docker-compose.yml

#### `pgrestify docker:build`

Build custom Docker images.

**Options:**
- `--service <service>` - Build specific service

#### `pgrestify docker:pull`

Pull required Docker images.

#### `pgrestify docker:clean`

Clean up Docker resources.

**Options:**
- `--all` - Remove all project-related Docker resources
- `--volumes` - Remove data volumes (WARNING: This will delete all data)
- `--confirm` - Skip confirmation prompts

#### `pgrestify docker:ps`

Show running containers.

#### `pgrestify docker:exec <service> <command>`

Execute command in container.

### `pgrestify generate`

Code and configuration generation.

#### `pgrestify generate:types`

Generate TypeScript types from database schema.

**Options:**
- `-o, --output <path>` - Output file path (default: src/types/database.ts)
- `--schema-file <path>` - Schema file path (default: sql/init.sql)

#### `pgrestify generate:migration <name>`

Generate a new migration file.

**Options:**
- `--sql` - Generate SQL migration (default)
- `--typescript` - Generate TypeScript migration

#### `pgrestify generate:config`

Generate configuration files.

**Options:**
- `--type <type>` - Config type (postgrest|docker|env|all)
- `--force` - Overwrite existing files

#### `pgrestify generate:client`

Generate typed client code.

**Options:**
- `-o, --output <path>` - Output file path (default: src/lib/client.ts)

#### `pgrestify generate:schema <schema-file>`

Generate SQL schema from TypeScript definition.

**Options:**
- `-o, --output <path>` - Output SQL file (default: sql/generated-schema.sql)

## Project Templates

### Basic Template
- Simple users table with authentication
- JWT configuration
- Row Level Security setup

### Blog Template
- Users, posts, comments, categories
- Publishing workflow
- SEO-friendly slugs
- Comment threading

### E-commerce Template
- Customers, products, orders, order items
- Inventory management
- Order processing workflow
- Customer management

### SaaS Template
- Multi-tenant architecture
- Organizations, users, projects
- Role-based access control
- Subscription management

### CMS Template
- Content management system
- Pages, media, user roles
- Content publishing workflow
- Media management

## Configuration Files

### `pgrestify.config.ts/js`

Main configuration file for PGRestify projects.

```typescript
export default {
  name: 'my-project',
  version: '1.0.0',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/myapp',
    schemas: ['api']
  },
  
  postgrest: {
    dbUri: process.env.DATABASE_URL,
    dbSchemas: 'api',
    dbAnonRole: 'web_anon',
    
    // Option 1: Simple JWT secret string
    jwtSecret: process.env.JWT_SECRET,
    
    // Option 2: Advanced JWT with PEM file support
    // jwt: {
    //   secretFile: './jwt-private-key.pem',
    //   algorithm: 'RS256',
    //   issuer: 'your-app',
    //   audience: 'your-app-users',
    //   expiresIn: 3600
    // },
    serverCorsAllowedOrigins: '*',
    dbMaxRows: 1000,
    serverHost: '0.0.0.0',
    serverPort: 3000
  },
  
  dev: {
    postgres: {
      image: 'postgres:15',
      port: 5432
    },
    postgrest: {
      image: 'postgrest/postgrest',
      port: 3000
    }
  }
}
```

### Environment Variables

Common environment variables used by PGRestify CLI:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT secret key (string)
- `JWT_SECRET_FILE` - Path to JWT PEM file
- `JWT_ALGORITHM` - JWT algorithm (HS256, RS256, ES256, etc.)
- `POSTGREST_URL` - PostgREST API URL
- `NODE_ENV` - Environment (development|production)
- `DEBUG` - Enable debug output
- `VERBOSE` - Enable verbose logging

### `pgrestify migrate`

Database migration management with real PostgreSQL execution.

#### `pgrestify migrate run`

Run pending migrations.

**Options:**
- `--dry-run` - Show what would be migrated without executing
- `--to <version>` - Migrate to specific version

#### `pgrestify migrate rollback`

Rollback migrations.

**Options:**
- `--steps <count>` - Number of migrations to rollback (default: 1)
- `--to <version>` - Rollback to specific version
- `--confirm` - Skip confirmation prompt

#### `pgrestify migrate status`

Show migration status.

#### `pgrestify migrate reset`

Reset all migrations (⚠️ DESTRUCTIVE).

**Options:**
- `--confirm` - Skip confirmation prompt

#### `pgrestify migrate fresh`

Drop all tables and re-run migrations.

**Options:**
- `--seed` - Run seeders after migration
- `--confirm` - Skip confirmation prompt

### `pgrestify seed`

Database seeding commands with tracking and rollback support.

#### `pgrestify seed run`

Run database seeders.

**Options:**
- `--class <name>` - Run specific seeder class
- `--force` - Force re-seeding (delete existing data)

#### `pgrestify seed generate <name>`

Generate a new seeder file.

**Options:**
- `--table <table>` - Target table name

#### `pgrestify seed fresh`

Reset database and run all seeders.

**Options:**
- `--confirm` - Skip confirmation prompt

#### `pgrestify seed reset`

Remove all seeded data.

**Options:**
- `--confirm` - Skip confirmation prompt

## Project Structure

```
my-project/
├── src/                          # Application source code
│   ├── lib/                     # Client and utilities
│   │   └── client.ts           # Typed PGRestify client
│   └── types/                   # TypeScript definitions
│       └── database.ts          # Generated database types
├── sql/                         # Database files
│   ├── init.sql                # Initial schema
│   ├── migrations/             # Database migrations (with real SQL execution)
│   └── seed/                   # Database seeders (with tracking)
├── docker-compose.yml          # Docker services
├── pgrestify.config.ts         # PGRestify configuration
├── package.json               # Project dependencies
└── README.md                  # Project documentation
```

## Development Workflow

1. **Initialize Project**
   ```bash
   pgrestify init my-app --template blog
   cd my-app
   npm install
   ```

2. **Start Development**
   ```bash
   npm run dev
   ```

3. **Generate Types**
   ```bash
   pgrestify generate:types
   ```

4. **Create and Run Migrations**
   ```bash
   # Generate migration
   pgrestify generate:migration add_user_avatar
   
   # Run migrations
   pgrestify migrate run
   ```

5. **Seed Database**
   ```bash
   # Generate seeder
   pgrestify seed generate users --table users
   
   # Run seeders
   pgrestify seed run
   ```

5. **Build and Test**
   ```bash
   npm run build
   npm test
   ```

## JWT Authentication Configuration

PGRestify CLI supports both simple JWT secrets and advanced PEM file configurations.

### Simple JWT Secret (Development)

Use a string secret for development:

```typescript
// pgrestify.config.ts
postgrest: {
  jwtSecret: process.env.JWT_SECRET || 'your-32-character-secret-key'
}
```

### PEM File Support (Production)

Use RSA or ECDSA keys for production:

```typescript
// pgrestify.config.ts
postgrest: {
  jwt: {
    secretFile: './jwt-private-key.pem',
    algorithm: 'RS256', // or ES256 for ECDSA
    issuer: 'your-app',
    audience: 'your-app-users',
    expiresIn: 3600
  }
}
```

### Generate JWT Keys

```bash
# Generate RSA key pair
openssl genrsa -out jwt-private-key.pem 2048
openssl rsa -in jwt-private-key.pem -pubout -out jwt-public-key.pem

# Generate ECDSA key pair
openssl ecparam -genkey -name prime256v1 -noout -out jwt-private-key.pem
openssl ec -in jwt-private-key.pem -pubout -out jwt-public-key.pem
```

### Supported Algorithms

- **HMAC**: HS256, HS384, HS512 (for string secrets)
- **RSA**: RS256, RS384, RS512 (for RSA PEM files)
- **ECDSA**: ES256, ES384, ES512 (for ECDSA PEM files)

## Docker Integration

PGRestify CLI provides seamless Docker integration for development environments.

### Automatic Setup

When initializing a project, PGRestify automatically creates:

- `docker-compose.yml` with PostgreSQL and PostgREST services
- Health checks and proper service dependencies
- Volume mounts for persistent data
- Network configuration

### Manual Docker Setup

For existing projects:

```bash
# Initialize Docker configuration
pgrestify docker:init

# Start services
pgrestify dev:start

# View logs
pgrestify dev:logs --follow
```

### Production Deployment

The generated Docker configuration is production-ready with proper:

- Security settings
- Resource limits
- Health checks
- Logging configuration

## Code Generation

### TypeScript Types

Generate type-safe interfaces from your database schema:

```bash
pgrestify generate:types
```

This creates `src/types/database.ts` with:

- Table row interfaces
- Insert/update types
- Typed client interfaces
- Utility types

### Typed Client

Generate a pre-configured typed client:

```bash
pgrestify generate:client
```

Usage:
```typescript
import { client } from './lib/client';

// Type-safe queries
const users = await client.from('users').select('*');
const posts = await client.from('posts')
  .select('id, title, content')
  .eq('published', true);
```

### Migrations

Create database migrations:

```bash
pgrestify generate:migration add_user_profiles
```

Generates timestamped migration files with up/down operations.

## Error Handling

The CLI provides helpful error messages and suggestions:

- **Missing Dependencies**: Guides you to install required packages
- **Configuration Errors**: Points to specific configuration issues  
- **Docker Issues**: Helps diagnose container problems
- **Database Errors**: Shows connection and query issues

## Debugging

Enable debug mode for detailed output:

```bash
# Environment variable
DEBUG=1 pgrestify dev:start

# Command option
pgrestify dev:start --debug

# Verbose logging
pgrestify dev:start --verbose
```

## Contributing

The PGRestify CLI is open source. See our [contributing guide](../CONTRIBUTING.md) for details on:

- Development setup
- Adding new commands
- Testing procedures
- Documentation standards

## License

MIT License - see [LICENSE](../LICENSE) file for details.