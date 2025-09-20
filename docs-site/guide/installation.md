# Installation

Get PGRestify up and running with three setup approaches: **Docker** (recommended), **Non-Docker CLI**, or **Manual** (library only).

## 🐳 Option 1: Docker Setup (Recommended)

Perfect for developers who want everything configured automatically. Docker handles PostgreSQL, PostgREST, and all dependencies.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed
- [Node.js 16+](https://nodejs.org/) installed

### Step 1: Install PGRestify CLI

```bash
# Install globally (recommended)
npm install -g @webcoded/pgrestify

# Verify installation
pgrestify --version
```

### Step 2: Create Your Project

```bash
# Create a new API project with Docker setup
pgrestify api init my-awesome-app --template basic

# Navigate to project
cd my-awesome-app

# See what was generated
ls -la
```

**You get everything needed:**
- `docker-compose.yml` - PostgreSQL + PostgREST containers
- `pgrestify.config.ts` - Configuration file  
- `sql/init.sql` - Database schema
- `.env.example` - Environment template

### Step 3: Start Development Environment

```bash
# Start PostgreSQL and PostgREST containers
docker compose up -d

# Or use the npm script
npm run pgrestify:start

# This automatically:
# ✅ Starts PostgreSQL on port 5432
# ✅ Starts PostgREST on port 3000  
# ✅ Creates database schema
# ✅ Sets up proper permissions
```

### Step 4: Verify Everything Works

```bash
# Check if PostgREST is running
curl http://localhost:3000
# You should see PostgREST API documentation

# Check services status
pgrestify docker status

# View logs (if needed)
pgrestify docker logs
```

### Step 5: Start Building

```bash
# Generate TypeScript types from your database
pgrestify generate types

# Create React components
pgrestify generate component UserList
pgrestify generate hook useUsers

# Start development server (if using React/Next.js)
npm start
```

**🎉 Docker setup complete! Skip to [Framework Integration](#framework-integration)**

---

## 🔧 Option 2: Non-Docker Setup (CLI with Existing PostgreSQL)

For developers who have existing PostgreSQL installations but want CLI assistance for setup and script generation.

### Prerequisites  
- [Node.js 16+](https://nodejs.org/) installed
- [PostgreSQL](https://www.postgresql.org/download/) running
- [PostgREST](https://postgrest.org/en/stable/install.html) installed

### Step 1: Install PGRestify CLI

::: code-group

```bash [npm]
npm install -g @webcoded/pgrestify
```

```bash [yarn]  
yarn global add @webcoded/pgrestify
```

```bash [pnpm]
pnpm add -g @webcoded/pgrestify
```

:::

### Step 2: Interactive CLI-Guided Setup

The PGRestify CLI provides an interactive setup wizard for non-Docker installations:

```bash
# Create project with guided setup
pgrestify init my-app --no-docker

# The CLI will prompt you with:
# ❓ Setup database and user? (Y/n)
# ❓ Create sample tables? (Y/n) 
# ❓ Generate PostgREST config? (Y/n)
# ❓ Create startup scripts? (Y/n)
```

### Step 3: Generated Files and Scripts

The CLI generates helpful setup files based on your choices:

**Database Setup** (`sql/setup-database.sql`):
```sql
-- Generated database setup
CREATE DATABASE my_app_db;
CREATE USER my_app_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE my_app_db TO my_app_user;

-- Connect and create schema
\c my_app_db
CREATE SCHEMA api;
GRANT USAGE ON SCHEMA api TO my_app_user;
GRANT CREATE ON SCHEMA api TO my_app_user;

-- PostgREST anonymous role
CREATE ROLE web_anon NOLOGIN;
GRANT USAGE ON SCHEMA api TO web_anon;
```

**Setup Script** (`scripts/setup-database.sh`):
```bash
#!/bin/bash
echo "🗄️ Setting up PostgreSQL database..."

# Run database setup
psql -U postgres -f sql/setup-database.sql

echo "✅ Database setup complete!"
```

**PostgREST Configuration** (`postgrest.conf`):
```ini
# Database connection (auto-filled from your settings)
db-uri = "postgres://my_app_user:secure_password@localhost:5432/my_app_db"
db-schemas = "api"
db-anon-role = "web_anon"

# Server settings
server-host = "localhost"
server-port = 3000

# JWT settings
jwt-secret = "your-super-secure-jwt-secret-change-this-in-production"

# CORS settings for browser requests
server-cors-allowed-origins = "*"
```

**Startup Script** (`scripts/start-postgrest.sh`):
```bash
#!/bin/bash
echo "🚀 Starting PostgREST server..."

# Check if database is accessible
if ! pg_isready -h localhost -p 5432 -q; then
    echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
    exit 1
fi

# Start PostgREST
echo "✅ Starting PostgREST on http://localhost:3000"
postgrest postgrest.conf
```

### Step 4: Run Generated Scripts

```bash
# Run database setup (if you chose CLI generation)
./scripts/setup-database.sh

# Start PostgREST (in a separate terminal)
./scripts/start-postgrest.sh
```

### Step 5: Start Building

```bash
# Generate TypeScript types from your database
pgrestify generate types

# Generate React components for your tables
pgrestify generate component UserList

# Generate custom hooks for data fetching
pgrestify generate hook useUsers

# Start building your application
npm start  # or your preferred dev command
```

**🎉 Non-Docker CLI setup complete!**

---

## ⚙️ Option 3: Manual Setup (Library Only, No CLI)

For developers who prefer complete control and want to configure everything manually without CLI assistance.

### Step 1: Install PGRestify Library Only

::: code-group

```bash [npm]
npm install @webcoded/pgrestify
```

```bash [yarn]
yarn add @webcoded/pgrestify
```

```bash [pnpm]
pnpm add @webcoded/pgrestify
```

```bash [bun]
bun add @webcoded/pgrestify
```

:::

### Step 2: Set Up Your Database Manually

Create your PostgreSQL database and schema:

```sql
-- Connect to PostgreSQL as superuser
-- psql -U postgres

-- Create your database
CREATE DATABASE my_app_db;

-- Create application user
CREATE USER my_app_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE my_app_db TO my_app_user;

-- Connect to your database
\c my_app_db

-- Create API schema
CREATE SCHEMA api;
GRANT USAGE ON SCHEMA api TO my_app_user;
GRANT CREATE ON SCHEMA api TO my_app_user;

-- Create PostgREST anonymous role
CREATE ROLE web_anon NOLOGIN;
GRANT USAGE ON SCHEMA api TO web_anon;

-- Create your tables
CREATE TABLE api.users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant permissions
GRANT SELECT ON api.users TO web_anon;
```

### Step 3: Configure PostgREST Manually

Create a `postgrest.conf` file:

```ini
# postgrest.conf
db-uri = "postgres://my_app_user:secure_password@localhost:5432/my_app_db"
db-schemas = "api"
db-anon-role = "web_anon"
server-host = "localhost"
server-port = 3000
jwt-secret = "your-super-secure-jwt-secret-32-chars-minimum"
server-cors-allowed-origins = "*"
```

### Step 4: Start PostgREST Manually

```bash
# Start PostgREST with your configuration
postgrest postgrest.conf

# Verify it's running
curl http://localhost:3000
```

### Step 5: Configure PGRestify Client

Create your client configuration:

```typescript
// src/lib/client.ts
import { createClient } from '@webcoded/pgrestify';

export const client = createClient({
  url: 'http://localhost:3000',
  auth: {
    persistSession: true
  }
});

// Define your database types manually
export interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}
```

### Step 6: Use PGRestify in Your Application

```typescript
// src/example.ts
import { client } from './lib/client';

async function getUsers() {
  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('active', true);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Users:', data);
}

getUsers();
```

**🎉 Manual setup complete! You have full control over your configuration.**

---

## 📚 Framework Integration

### React Setup

```bash
# Install React dependencies
npm install react react-dom pgrestify

# Create React app structure
mkdir -p src/components src/hooks
```

**React Provider Setup:**

```tsx
// src/App.tsx
import React from 'react';
import { PGRestifyProvider } from '@webcoded/pgrestify/react';
import { client } from './lib/client';
import { UserList } from './components/UserList';

function App() {
  return (
    <PGRestifyProvider client={client}>
      <div className="App">
        <h1>My PGRestify App</h1>
        <UserList />
      </div>
    </PGRestifyProvider>
  );
}

export default App;
```

**React Hook Example:**

```tsx
// src/components/UserList.tsx
import React from 'react';
import { useQuery } from '@webcoded/pgrestify/react';
import { client } from '../lib/client';

export function UserList() {
  const { data: users, isLoading, error } = useQuery(
    client,
    'users',
    (query) => query.select('*').eq('active', true)
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Users</h2>
      {users?.map(user => (
        <div key={user.id}>
          <strong>{user.name}</strong> - {user.email}
        </div>
      ))}
    </div>
  );
}
```

### Next.js Setup

```bash
# Install Next.js dependencies
npm install next react react-dom pgrestify
```

**Next.js Provider Setup:**

```tsx
// pages/_app.tsx
import type { AppProps } from 'next/app';
import { PGRestifyProvider } from '@webcoded/pgrestify/react';
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: process.env.NEXT_PUBLIC_POSTGREST_URL || 'http://localhost:3000'
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <PGRestifyProvider client={client}>
      <Component {...pageProps} />
    </PGRestifyProvider>
  );
}
```

---

## 🔧 Environment Configuration

### Environment Variables

Create appropriate `.env` files for your setup:

#### For Docker Setup:
```bash
# .env
DATABASE_URL=postgresql://postgres:password@localhost:5432/pgrestify_dev
POSTGREST_URL=http://localhost:3000
JWT_SECRET=your-super-secure-jwt-secret-32-chars-minimum
NODE_ENV=development
```

#### For Non-Docker/Manual Setup:
```bash
# .env
DATABASE_URL=postgres://my_app_user:secure_password@localhost:5432/my_app_db
POSTGREST_URL=http://localhost:3000
JWT_SECRET=your-super-secure-jwt-secret-32-chars-minimum
NODE_ENV=development
```

#### For Production:
```bash
# .env.production
DATABASE_URL=postgresql://user:password@prod-host:5432/prod_db
POSTGREST_URL=https://api.yourapp.com
JWT_SECRET=extremely-secure-production-secret
NODE_ENV=production
```

---

## 🛠️ Adding Setup to Existing Projects

### For Existing Projects (CLI Assistance)

```bash
# Navigate to your existing project
cd my-existing-project

# Add interactive PostgreSQL setup
pgrestify setup manual

# Or use the enhanced native command
pgrestify setup native
```

### Setup Commands Available

- `pgrestify setup manual` - Interactive PostgreSQL setup for existing projects
- `pgrestify setup native` - Enhanced native setup with interactive prompts  
- `pgrestify setup existing` - Configure PGRestify in existing projects
- `pgrestify setup cloud` - Set up with cloud databases

---

## 🐛 Troubleshooting

### Docker Setup Issues

#### "Docker command not found"
```bash
# Install Docker Desktop
# Visit: https://docs.docker.com/get-docker/

# Verify Docker is running
docker --version
docker ps
```

#### "Port already in use"
```bash
# Check what's using the ports
lsof -i :5432  # PostgreSQL
lsof -i :3000  # PostgREST

# Stop conflicting services
pgrestify docker stop
```

### Non-Docker Setup Issues

#### "PostgreSQL connection refused"
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Start PostgreSQL (varies by OS)
brew services start postgresql  # macOS
sudo service postgresql start   # Ubuntu
```

#### "PostgREST connection failed"
```bash
# Check PostgREST process
ps aux | grep postgrest

# Test PostgREST directly
curl http://localhost:3000

# Check PostgREST logs
tail -f postgrest.log
```

### Manual Setup Issues

#### "Cannot find module 'pgrestify'"
```bash
# Make sure you've installed the package
npm install @webcoded/pgrestify

# Check package.json
cat package.json | grep pgrestify
```

#### "Client connection issues"
```typescript
// Verify your client configuration
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000', // Make sure PostgREST is running here
  auth: {
    persistSession: true
  }
});

// Test connection
client.from('users').select('count').then(console.log);
```

### Common Issues (All Setups)

#### "CORS errors in browser"
Add CORS configuration to your PostgREST config:

```ini
# postgrest.conf
server-cors-allowed-origins = "*"
```

#### "TypeScript errors"
```bash
# Install TypeScript if needed
npm install -D typescript @types/node

# For CLI setups, generate types
pgrestify generate types

# For manual setups, define types manually
```

---

## 🚀 Next Steps

Choose your path based on your setup:

### 🐳 If you used Docker Setup:
- **[Quick Start Guide](./getting-started.md)** - Build your first app
- **[CLI Tool Guide](./cli.md)** - Master the development tools
- **[Query Builder](./query-builder.md)** - Learn advanced queries

### 🔧 If you used Non-Docker CLI Setup:
- **[CLI Tool Guide](./cli.md)** - Explore more CLI commands
- **[Query Builder](./query-builder.md)** - Build complex queries
- **[Authentication](./advanced-features/authentication.md)** - Add user authentication

### ⚙️ If you used Manual Setup:
- **[Core Library Guide](./core/client-creation.md)** - Learn the core PGRestify API
- **[Query Builder](./query-builder.md)** - Master query building
- **[Client Configuration](./configuration.md)** - Advanced client options

### ⚛️ Framework Integration (All Setups):
- **[React Guide](./react.md)** - React hooks and components  
- **[Next.js Guide](./nextjs/overview.md)** - SSR, API routes, and deployment

**🎉 Happy coding with PGRestify!**