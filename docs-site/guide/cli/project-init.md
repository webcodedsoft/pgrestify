# Project Initialization

PGRestify CLI provides powerful project initialization commands for both frontend applications and complete PostgREST API setups. This guide covers all initialization options and workflows.

## Frontend Project Initialization

Initialize a new frontend project configured to work with PostgREST APIs:

### Basic Usage

```bash
# Interactive initialization
pgrestify frontend init

# Skip prompts and use defaults
pgrestify frontend init --skip-prompts

# Specify framework
pgrestify frontend init --framework react
```

### Frontend Options

```bash
pgrestify frontend init [options]

Options:
  --framework <type>     Framework choice (react|vue|angular|vanilla)
  --typescript          Use TypeScript (default: true)
  --api-url <url>       PostgREST API URL
  --skip-prompts        Skip interactive prompts
  --no-install          Skip dependency installation
  --output <dir>        Output directory (default: current)
```

### Framework Templates

#### React Project
```bash
pgrestify frontend init --framework react

# Generates:
# - React app with PGRestify hooks
# - TypeScript configuration
# - Data fetching components
# - Authentication setup
# - CRUD examples
```

#### Vue Project
```bash
pgrestify frontend init --framework vue

# Generates:
# - Vue 3 app with Composition API
# - PGRestify composables
# - Pinia store integration
# - Router with auth guards
# - Form components
```

#### Vanilla JavaScript
```bash
pgrestify frontend init --framework vanilla

# Generates:
# - Pure JavaScript client
# - Fetch API wrappers
# - Authentication helpers
# - No framework dependencies
```

### Generated Frontend Structure

```
my-frontend/
├── src/
│   ├── api/
│   │   ├── client.ts          # PGRestify client configuration
│   │   ├── auth.ts            # Authentication helpers
│   │   └── types.ts           # Generated TypeScript types
│   ├── hooks/                 # React hooks (React projects)
│   │   ├── useQuery.ts
│   │   ├── useMutation.ts
│   │   └── useAuth.ts
│   ├── composables/           # Vue composables (Vue projects)
│   │   ├── useApi.ts
│   │   └── useAuth.ts
│   ├── components/
│   │   ├── DataTable.tsx     # CRUD table component
│   │   ├── Form.tsx          # Generic form component
│   │   └── AuthGuard.tsx    # Protected route wrapper
│   └── utils/
│       └── error-handler.ts  # Error handling utilities
├── .env.example              # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## API Project Initialization

Initialize a complete PostgREST API with database schema, migrations, and Docker configuration:

### Basic Usage

```bash
# Interactive initialization
pgrestify api init

# Quick setup with template
pgrestify api init --template blog --skip-prompts

# Production setup
pgrestify api init --env production --template ecommerce
```

### API Options

```bash
pgrestify api init [options]

Options:
  --skip-prompts              Skip interactive prompts
  --template <type>           Schema template (basic|blog|ecommerce|custom)
  --env <environment>         Target environment (development|staging|production)
  --local                     Use local PostgreSQL instead of Docker
  --run-migrations           Auto-run migrations after generation
  --testing-data             Generate realistic test data
  --testing-records <count>  Number of test records (default: 50)
  --testing-with-images      Include image URLs in test data
```

### Schema Templates

#### Basic Template
Minimal setup with user authentication:

```sql
-- Generated tables:
- users (id, email, password_hash, created_at)
- sessions (id, user_id, token, expires_at)
- profiles (id, user_id, full_name, avatar_url)
```

#### Blog Template
Complete blogging platform schema:

```sql
-- Generated tables:
- users (authentication)
- posts (title, content, slug, published)
- categories (name, slug, description)
- comments (post_id, user_id, content)
- tags (name, slug)
- post_tags (many-to-many)
```

#### E-commerce Template
Full e-commerce database structure:

```sql
-- Generated tables:
- users (customers)
- products (name, price, stock, description)
- categories (hierarchical)
- orders (user_id, status, total)
- order_items (order_id, product_id, quantity)
- payments (order_id, method, status)
- reviews (product_id, rating, comment)
- cart (user_id, product_id, quantity)
```

### Generated API Structure

```
my-api/
├── sql/
│   ├── 00-extensions.sql      # Required PostgreSQL extensions
│   ├── 01-schemas.sql         # Database schemas
│   ├── 02-tables/             # Table definitions by folder
│   │   ├── users/
│   │   │   ├── table.sql     # Table definition
│   │   │   ├── rls.sql       # Row Level Security
│   │   │   ├── triggers.sql  # Audit triggers
│   │   │   └── indexes.sql   # Performance indexes
│   │   └── posts/
│   │       └── ...
│   ├── 03-functions.sql       # PostgreSQL functions
│   ├── 04-views.sql          # Database views
│   ├── 05-seed.sql           # Optional seed data
│   └── 99-grants.sql         # Permission grants
├── config/
│   ├── postgrest.conf        # PostgREST configuration
│   └── nginx.conf           # Optional nginx config
├── docker/
│   ├── docker-compose.yml    # Docker services
│   ├── Dockerfile.postgrest  # PostgREST image
│   └── init.sh              # Database initialization
├── scripts/
│   ├── setup.sh             # Initial setup script
│   ├── migrate.sh           # Migration runner
│   └── backup.sh            # Backup script
├── migrations/              # User migrations directory
├── .env.example            # Environment template
├── .gitignore
├── package.json            # npm scripts
└── README.md              # Setup instructions
```

## Interactive Configuration

When running without `--skip-prompts`, the CLI guides you through configuration:

### Frontend Interactive Flow

```bash
$ pgrestify frontend init

? Choose your framework: (Use arrow keys)
❯ React - React with hooks and TypeScript
  Vue - Vue 3 with Composition API
  Angular - Angular with services
  Vanilla - No framework

? Use TypeScript? (Y/n)
? PostgREST API URL: (http://localhost:3000)
? Include authentication? (Y/n)
? Generate example CRUD components? (Y/n)
? Install dependencies now? (Y/n)
```

### API Interactive Flow

```bash
$ pgrestify api init

? Choose a schema template:
❯ Basic - Simple tables and authentication
  Blog - Posts, comments, categories
  E-commerce - Products, orders, customers
  Custom - I'll define my own schema

? Target environment:
❯ Development - Local development setup
  Staging - Testing environment
  Production - Production deployment

? Use Docker for deployment? (Y/n)
? Database host: (localhost)
? Database port: (5432)
? Database name: (myapp_db)
? Enable Row Level Security? (Y/n)
? Generate test data? (Y/n)
```

## Package.json Scripts

Both frontend and API projects include helpful npm scripts:

### Frontend Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "types": "pgrestify frontend types",
    "api:mock": "pgrestify mock-server",
    "test": "vitest"
  }
}
```

### API Scripts

```json
{
  "scripts": {
    "pgrestify:start": "docker compose up -d",
    "pgrestify:stop": "docker compose down",
    "pgrestify:logs": "docker compose logs -f postgrest",
    "pgrestify:setup": "./scripts/setup.sh",
    "pgrestify:migrate": "pgrestify api migrate",
    "pgrestify:seed": "pgrestify api seed",
    "pgrestify:backup": "./scripts/backup.sh"
  }
}
```

## Environment Configuration

### Frontend Environment

```bash
# .env.example (Frontend)
VITE_API_URL=http://localhost:3000
VITE_ANON_KEY=your-anon-key-here
VITE_AUTH_URL=http://localhost:3000/auth/v1
```

### API Environment

```bash
# .env.example (API)
# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=myapp_db
POSTGRES_PORT=5432

# PostgREST Configuration
POSTGREST_PORT=3000
POSTGREST_SCHEMA=api
POSTGREST_ANON_ROLE=anon
POSTGREST_JWT_SECRET=your-secret-key-min-32-chars

# Admin Configuration
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure-password
```

## Testing Data Generation

Generate realistic test data during initialization:

```bash
# Generate 100 test records
pgrestify api init --testing-data --testing-records 100

# Include image URLs
pgrestify api init --testing-data --testing-with-images

# Apply test data automatically
pgrestify api init --testing-data --run-migrations
```

Test data features:
- Realistic names, emails, and content
- Consistent relationships between tables
- Configurable record counts
- Optional image URLs from placeholder services
- Respects foreign key constraints

## Post-Initialization Steps

### Frontend Projects

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API details
   ```

3. **Generate types**:
   ```bash
   npm run types
   ```

4. **Start development**:
   ```bash
   npm run dev
   ```

### API Projects

1. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with secure passwords
   ```

2. **Run setup**:
   ```bash
   npm run pgrestify:setup
   ```

3. **Start services**:
   ```bash
   npm run pgrestify:start
   ```

4. **Verify deployment**:
   ```bash
   curl http://localhost:3000
   ```

## Troubleshooting Initialization

### Common Issues

#### Port Conflicts
```bash
# Error: Port 5432 already in use
# Solution: Change POSTGRES_PORT in .env
POSTGRES_PORT=5433
```

#### Permission Denied
```bash
# Error: Permission denied executing setup.sh
# Solution: Make scripts executable
chmod +x scripts/*.sh
```

#### Docker Not Found
```bash
# Error: docker command not found
# Solution: Install Docker or use --local flag
pgrestify api init --local
```

### Validation

Validate your configuration after initialization:

```bash
# Check configuration
pgrestify validate

# Test database connection
pgrestify api test-connection

# Verify PostgREST
curl http://localhost:3000
```

## Best Practices

1. **Always use environment variables** for sensitive configuration
2. **Review generated schemas** before applying to production
3. **Test migrations** in development first
4. **Use version control** for all generated files except .env
5. **Customize templates** to match your requirements
6. **Enable RLS** for production deployments
7. **Generate TypeScript types** for type safety

## Summary

PGRestify's initialization commands provide a complete setup for both frontend and backend development with PostgREST. The flexible template system and interactive configuration make it easy to get started while maintaining best practices for security and scalability.