# ⚡ Quick Start - Get Up and Running in 5 Minutes

Get PGRestify running with your PostgreSQL database in just 5 minutes! This guide focuses on the fastest path to success.

## 🚀 Option 1: Complete Setup with CLI (Recommended)

The PGRestify CLI sets up everything for you: database, PostgREST, and your project structure.

### Step 1: Install CLI

```bash
# Install globally for new projects
npm install -g @webcoded/pgrestify

# Verify installation
pgrestify --version
```

### Step 2: Create Your Project

```bash
# Create a new API project (backend)
pgrestify api init my-awesome-app --template basic

# Navigate to project
cd my-awesome-app

# See what was created
ls -la
```

**What you get:**
- 📝 `pgrestify.config.ts` - Configuration file
- 🐳 `docker-compose.yml` - PostgreSQL + PostgREST setup  
- 📦 `package.json` - Dependencies
- 🔐 `.env.example` - Environment template
- 💾 `sql/init.sql` - Database schema

### Step 3: Start Everything

```bash
# Start PostgreSQL and PostgREST with Docker
docker compose up -d

# Or use the npm scripts
npm run pgrestify:start

# Verify it's running
curl http://localhost:3000
# Should show PostgREST API documentation
```

### Step 4: Start Coding

```bash
# Set up database migrations
npm run pgrestify:setup

# Run migrations (create tables, RLS, etc.)
pgrestify api migrate

# Generate your first schema
pgrestify api schema generate users
```

**🎉 You're ready! Your full-stack setup is complete.**

---

## 📦 Option 2: Library-Only Installation

If you already have PostgREST running, just install the library:

### Step 1: Install PGRestify

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

### Step 2: Create a Client

```typescript
import { createClient } from '@webcoded/pgrestify';

// Connect to your existing PostgREST API
const client = createClient({
  url: 'http://localhost:3000', // Your PostgREST URL
  auth: {
    persistSession: true
  }
});
```

### Step 3: Define Your Schema Types

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

interface Post {
  id: number;
  title: string;
  content: string;
  author_id: number;
  published: boolean;
}
```

### Step 4: Start Querying

PGRestify supports two query approaches - choose what feels natural:

#### 🎯 PostgREST Syntax (Direct & Clean)

```typescript
// Get all users
const users = await client.from<User>('users').select('*').execute();

// Find active users
const activeUsers = await client.from<User>('users')
  .select('*')
  .eq('active', true)
  .execute();

// Create a new user
const newUser = await client.from<User>('users')
  .insert({
    name: 'John Doe',
    email: 'john@example.com',
    active: true
  })
  .single()
  .execute();
```

#### 🏗️ ORM-Style Repository Pattern (NEW!)

```typescript
// Get repository for the users table
const userRepo = client.getRepository<User>('users');

// Simple queries
const users = await userRepo.find();
const activeUsers = await userRepo.findBy({ active: true });
const user = await userRepo.findOne({ id: 1 });

// Advanced query builder
const complexQuery = await userRepo
  .createQueryBuilder()
  .select(['id', 'name', 'email'])
  .where('active = :active', { active: true })
  .andWhere('created_at >= :date', { date: '2024-01-01' })
  .orderBy('name', 'ASC')
  .limit(10)
  .getMany();

// CRUD operations
const newUser = await userRepo.save({
  name: 'John Doe',
  email: 'john@example.com',
  active: true
});

await userRepo.remove(user);
```

#### 🔧 Custom Repository (Advanced)

```typescript
import { CustomRepositoryBase } from '@webcoded/pgrestify';

class UserRepository extends CustomRepositoryBase<User> {
  async findActiveUsers(): Promise<User[]> {
    return this.createQueryBuilder()
      .where('active = :active', { active: true })
      .andWhere('verified = :verified', { verified: true })
      .getMany();
  }

  async findUserWithPosts(userId: number): Promise<User | null> {
    return this.createQueryBuilder()
      .leftJoinAndSelect('posts', 'post')
      .where('id = :id', { id: userId })
      .getOne();
  }
}

// Use your custom repository
const userRepo = client.getCustomRepository(UserRepository, 'users');
const activeUsers = await userRepo.findActiveUsers()
  .execute();
```

---

## 🔧 Option 3: Manual PostgreSQL Setup (Without Docker)

If you have PostgreSQL installed locally and prefer not to use Docker:

### Step 1: Initialize your project

```bash
# Create a new project with manual setup
pgrestify init my-app --no-docker
cd my-app
```

### Step 2: Configure Database Credentials (NEW Simplified Method!)

Instead of manually editing multiple configuration files, use the interactive credential setup:

```bash
# Interactive database credential configuration
pgrestify setup database

# The CLI will prompt you for:
# - Database host (default: localhost)
# - Database port (default: 5432)
# - Database name
# - Username
# - Password
# - Optional admin credentials for database creation
```

This command will:
- ✅ Update your `pgrestify.config.ts` with the database URL
- ✅ Update `.env.example` with your credentials
- ✅ Generate SQL setup scripts with your database/user names
- ✅ Create shell scripts for database setup
- ✅ Add database management scripts to `package.json`

### Step 3: Create Database and Tables

```bash
# Run the generated setup script
npm run pgrestify:db:setup

# Or run manually with psql
psql -U postgres -f sql/setup-database.sql
psql -U your_user -d your_db -f sql/sample-schema.sql
```

### Step 4: Install and Configure PostgREST

```bash
# Download PostgREST (macOS example)
brew install postgrest

# Or download from https://github.com/PostgREST/postgrest/releases
```

### Step 5: Start PostgREST

```bash
# Start PostgREST with generated config
npm run pgrestify:db:start

# Or manually
postgrest postgrest.conf
```

### Step 6: Verify Everything Works

```bash
# Test the API
curl http://localhost:3000

# Should see available endpoints
curl http://localhost:3000/users
```

### Alternative: Update Existing Credentials

If you need to change your database credentials later:

```bash
# Update credentials and regenerate all files
pgrestify setup database --regenerate-all
```

This will:
- Collect new credentials
- Update all configuration files
- Regenerate SQL scripts with new values
- Update all dependent files

---

## 🎯 Your First Real Example

Let's build a simple blog with users and posts:

### 1. Set up the project

```bash
pgrestify init blog-app
cd blog-app
pgrestify docker start
```

### 2. Create your schema

Edit `sql/init.sql`:

```sql
-- Users table
CREATE TABLE api.users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts table  
CREATE TABLE api.posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  author_id INTEGER REFERENCES api.users(id),
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert some sample data
INSERT INTO api.users (name, email) VALUES 
  ('Alice Johnson', 'alice@example.com'),
  ('Bob Smith', 'bob@example.com');

INSERT INTO api.posts (title, content, author_id, published) VALUES 
  ('Getting Started with PostgreSQL', 'PostgreSQL is awesome...', 1, true),
  ('Advanced PostgREST Tips', 'Here are some tips...', 2, true);
```

### 3. Generate TypeScript types

```bash
# Generate types from your database
pgrestify generate types

# This creates src/types/database.ts with your schema
```

### 4. Create a React component

```bash
pgrestify generate component BlogPosts
```

Edit `src/components/BlogPosts.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: process.env.REACT_APP_POSTGREST_URL || 'http://localhost:3000'
});

interface Post {
  id: number;
  title: string;
  content: string;
  author: {
    name: string;
    email: string;
  };
}

export function BlogPosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const data = await client
          .from('posts')
          .select(`
            id,
            title,
            content,
            author:users!posts_author_id_fkey(name, email)
          `)
          .eq('published', true)
          .order('created_at', { ascending: false })
          .execute();

        setPosts(data.data || []);
      } catch (error) {
        console.error('Error fetching posts:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPosts();
  }, []);

  if (isLoading) return <div>Loading posts...</div>;

  return (
    <div className="blog-posts">
      <h1>Latest Blog Posts</h1>
      {posts.map(post => (
        <article key={post.id} className="post">
          <h2>{post.title}</h2>
          <p>By {post.author.name}</p>
          <div>{post.content}</div>
        </article>
      ))}
    </div>
  );
}
```

### 5. Test your app

```bash
# Start development server
npm start

# Visit http://localhost:3000 to see your blog!
```

---

## 🛠️ Common Commands Reference

### Project Management
```bash
pgrestify init <project-name>    # Create new project
pgrestify setup                  # Set up existing project
pgrestify dev --watch           # Start development with watch mode
```

### Code Generation
```bash
pgrestify generate component UserCard    # React component
pgrestify generate hook useUsers         # Custom React hook  
pgrestify generate page Dashboard        # Page component
pgrestify generate types                 # TypeScript types
```

### Docker Management
```bash
pgrestify docker start         # Start database + PostgREST
pgrestify docker stop          # Stop services
pgrestify docker restart       # Restart services
pgrestify docker logs          # View logs
pgrestify docker status        # Check status
```

---

## 🐛 Troubleshooting

### "pgrestify command not found"
```bash
# Install globally
npm install -g @webcoded/pgrestify

# Or use without installing
npx pgrestify init my-app
```

### "Docker not starting"  
```bash
# Make sure Docker is running
docker --version

# Clean up and restart
pgrestify docker stop
docker system prune -f
pgrestify docker start
```

### "Connection refused to PostgREST"
```bash
# Check if services are running
pgrestify docker status

# Check logs for errors
pgrestify docker logs

# Verify port is correct (default: 3000)
curl http://localhost:3000
```

---

## 📚 Next Steps

Now that you have PGRestify running, explore these features:

### 🔥 Essential Features
- **[Query Builder](./query-builder.md)** - Master advanced queries
- **[Authentication](./advanced-features/authentication.md)** - Secure your app
- **[Configuration](./configuration.md)** - Customize your setup

### ⚛️ React Integration  
- **[React Hooks](./react.md)** - Use `useQuery`, `useMutation`

### ▲ Next.js Integration
- **[Next.js Guide](./nextjs/overview.md)** - SSR, API routes, middleware
- **[Server Components](./nextjs/server-components.md)** - Latest Next.js features

### 🚀 Production
- **[Docker Guide](./production/docker-setup.md)** - Deploy with containers
- **[Production Tips](./production/deployment.md)** - Performance and scaling

---

## 💡 Pro Tips

### Development Workflow
```bash
# Terminal 1: Keep database running
pgrestify docker start

# Terminal 2: Development mode
pgrestify dev --watch

# Terminal 3: Generate code as needed
pgrestify generate component NewFeature
```

### Environment Variables
Create `.env` file:
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/mydb
POSTGREST_URL=http://localhost:3000
JWT_SECRET=your-super-secure-secret
REACT_APP_POSTGREST_URL=http://localhost:3000
```

### TypeScript Integration
```typescript
// Use generated types for full type safety
import { Database } from './types/database';

const client = createClient<Database>({
  url: 'http://localhost:3000'
});

// Now you get full IntelliSense!
const users = await client.from('users').select('*').execute();
```

**🎉 Happy coding with PGRestify!**