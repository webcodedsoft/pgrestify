# PGRestify - Complete Feature Reference

This document provides comprehensive details of everything PGRestify can do, from basic queries to advanced database management. Every feature is documented with examples and use cases.

## 🏗️ Core Library Capabilities

### 1. Type-Safe Query Builder

**Full PostgREST Operator Support:**

```typescript
import { createClient } from 'pgrestify';

const client = createClient({
  url: 'http://localhost:3000',
  anonKey: 'your-anon-key'
});

// === SELECT Operations ===
// Basic select with type inference
const users = await client
  .from('users')
  .select('id, name, email')
  .execute();
// Type: { id: string, name: string, email: string }[]

// Select with relationships (joins)
const usersWithPosts = await client
  .from('users')
  .select('name, posts(title, content, created_at)')
  .execute();
// Type: { name: string, posts: { title: string, content: string, created_at: string }[] }[]

// Select specific columns with aliases
const data = await client
  .from('posts')
  .select('title, author:users(name), category:categories(name)')
  .execute();

// === WHERE Clauses (All PostgREST Operators) ===
// Equality
client.from('users').select().eq('name', 'John')
client.from('users').select().neq('status', 'inactive')

// Comparison
client.from('products').select().gt('price', 100)
client.from('products').select().gte('price', 100)
client.from('products').select().lt('price', 1000)
client.from('products').select().lte('price', 1000)

// Pattern matching
client.from('users').select().like('name', 'John%')
client.from('users').select().ilike('email', '%@gmail.com')

// Range operations
client.from('events').select().gte('date', '2025-01-01').lte('date', '2025-12-31')

// Array operations
client.from('posts').select().in('category', ['tech', 'programming'])
client.from('posts').select().contains('tags', ['javascript'])
client.from('posts').select().containedBy('permissions', ['read', 'write'])

// Full-text search
client.from('articles').select().textSearch('title', 'PostgreSQL')
client.from('articles').select().plainto('content', 'database management')
client.from('articles').select().phraseto('content', '"exact phrase"')

// JSON operations
client.from('users').select().filter('metadata->language', 'eq', 'en')
client.from('orders').select().filter('data->>status', 'eq', 'shipped')

// Null checks
client.from('users').select().is('deleted_at', null)
client.from('users').select().not.is('email', null)

// === INSERT Operations ===
// Single insert
const newUser = await client
  .from('users')
  .insert({ name: 'John Doe', email: 'john@example.com' })
  .select()
  .single();

// Bulk insert
const newUsers = await client
  .from('users')
  .insert([
    { name: 'Alice', email: 'alice@example.com' },
    { name: 'Bob', email: 'bob@example.com' }
  ])
  .select();

// Insert with conflict resolution (upsert)
const user = await client
  .from('users')
  .upsert({ id: '123', name: 'John Updated', email: 'john@example.com' })
  .select()
  .single();

// === UPDATE Operations ===
// Single update
const updatedUser = await client
  .from('users')
  .update({ name: 'John Smith' })
  .eq('id', '123')
  .select()
  .single();

// Bulk update
const updatedUsers = await client
  .from('users')
  .update({ status: 'active' })
  .in('id', ['123', '456', '789'])
  .select();

// Conditional update
const result = await client
  .from('posts')
  .update({ view_count: 'view_count + 1' })
  .eq('id', postId)
  .select('view_count')
  .single();

// === DELETE Operations ===
// Single delete
await client
  .from('users')
  .delete()
  .eq('id', '123');

// Conditional delete
await client
  .from('posts')
  .delete()
  .eq('author_id', userId)
  .eq('status', 'draft');

// === Ordering and Pagination ===
// Order by single column
client.from('posts').select().order('created_at', { ascending: false })

// Order by multiple columns
client.from('users').select().order('last_name').order('first_name')

// Pagination
client.from('posts').select().range(0, 9)  // First 10 items
client.from('posts').select().limit(10).offset(20)  // Items 21-30

// === Aggregation ===
// Count
const { count } = await client
  .from('users')
  .select('*', { count: 'exact' })
  .eq('active', true);

// Head (existence check)
const exists = await client
  .from('users')
  .select()
  .eq('email', 'test@example.com')
  .limit(1)
  .maybeSingle();
```

### 2. RPC Function Calls

```typescript
// === Remote Procedure Calls ===
// Simple RPC call
const result = await client
  .rpc('calculate_total', { order_id: '123' })
  .execute();

// RPC with complex parameters
const stats = await client
  .rpc('user_statistics', {
    user_id: '456',
    date_range: { start: '2025-01-01', end: '2025-12-31' },
    include_deleted: false
  })
  .execute();

// RPC returning table data (can be filtered)
const filteredResults = await client
  .rpc('search_posts', { query: 'typescript' })
  .eq('status', 'published')
  .order('created_at', { ascending: false })
  .limit(10)
  .execute();
```

### 3. Authentication System

```typescript
// === JWT Authentication ===
// Sign in
const { data, error } = await client.auth.signIn({
  email: 'user@example.com',
  password: 'password'
});

// Sign up
const { data, error } = await client.auth.signUp({
  email: 'user@example.com',
  password: 'password',
  options: {
    data: { name: 'John Doe' }
  }
});

// Sign out
await client.auth.signOut();

// Get current user
const { data: user } = await client.auth.getUser();

// Refresh token
const { data: session } = await client.auth.refreshSession();

// Auth state changes
client.auth.onAuthStateChange((event, session) => {
  console.log(event, session);
  // Events: 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED'
});

// === Automatic Row Level Security ===
// Queries automatically include user context
const myPosts = await client
  .from('posts')
  .select('*')
  .execute();
// Only returns posts the authenticated user can see based on RLS policies
```

### 4. Real-Time Subscriptions

```typescript
// === PostgreSQL LISTEN/NOTIFY Integration ===
// Subscribe to table changes
const subscription = client
  .from('messages')
  .on('INSERT', payload => {
    console.log('New message:', payload.new);
  })
  .on('UPDATE', payload => {
    console.log('Updated:', payload.old, '→', payload.new);
  })
  .on('DELETE', payload => {
    console.log('Deleted:', payload.old);
  })
  .subscribe();

// Filter subscriptions
const filteredSub = client
  .from('notifications')
  .on('INSERT', payload => {
    console.log('New notification for user:', payload.new);
  })
  .filter('user_id', 'eq', currentUserId)
  .subscribe();

// Subscribe to specific operations
const insertSub = client
  .from('posts')
  .on('INSERT', handleNewPost)
  .subscribe();

// Unsubscribe
subscription.unsubscribe();
```

### 5. Caching System

```typescript
// === Intelligent Caching ===
// Automatic caching with TTL
const client = createClient({
  url: 'http://localhost:3000',
  cache: {
    enabled: true,
    ttl: 300000, // 5 minutes
    maxSize: 100 // Max cached queries
  }
});

// Manual cache control
// Cache specific query
const users = await client
  .from('users')
  .select('*')
  .cache(600000) // Cache for 10 minutes
  .execute();

// Bypass cache
const freshData = await client
  .from('users')
  .select('*')
  .noCache()
  .execute();

// Invalidate cache
client.cache.invalidate('users');
client.cache.clear(); // Clear all cache
```

### 6. Repository Pattern

```typescript
// === Repository Pattern for Data Access ===
const userRepo = client.getRepository('users');

// Find operations
const allUsers = await userRepo.find();
const activeUsers = await userRepo.find({
  where: { active: true },
  order: { created_at: 'DESC' },
  limit: 10
});

// Find with relations
const usersWithPosts = await userRepo.find({
  select: ['name', 'email'],
  relations: ['posts'],
  where: { active: true }
});

// Find one
const user = await userRepo.findOne('user-id');
const userByEmail = await userRepo.findOne({
  where: { email: 'user@example.com' }
});

// Create
const newUser = await userRepo.create({
  name: 'John Doe',
  email: 'john@example.com'
});

// Update
const updatedUser = await userRepo.update('user-id', {
  name: 'John Smith'
});

// Delete
await userRepo.delete('user-id');

// Custom queries
const customResults = await userRepo.query()
  .select('name, posts(title)')
  .gte('created_at', '2025-01-01')
  .execute();
```

### 7. Server-Side Rendering (SSR)

```typescript
// === Next.js SSR/SSG Support ===
// Server-side data fetching
export async function getServerSideProps() {
  const client = createClient({
    url: process.env.POSTGREST_URL!,
    anonKey: process.env.POSTGREST_ANON_KEY!
  });

  const posts = await client
    .from('posts')
    .select('*, author:users(name)')
    .eq('published', true)
    .execute();

  return {
    props: { posts }
  };
}

// Static generation with ISR
export async function getStaticProps() {
  const posts = await client
    .from('posts')
    .select('*')
    .eq('featured', true)
    .execute();

  return {
    props: { posts },
    revalidate: 3600 // Revalidate every hour
  };
}

// SSR with authentication
export async function getServerSideProps({ req }) {
  const token = req.cookies.token;
  
  const client = createClient({
    url: process.env.POSTGREST_URL!,
    anonKey: process.env.POSTGREST_ANON_KEY!,
    accessToken: token
  });

  const userPosts = await client
    .from('posts')
    .select('*')
    .execute();

  return { props: { userPosts } };
}
```

---

## 🖥️ Framework Adapters

### React Adapter

**Context Provider:**
```typescript
// === React Context Setup ===
import { PGRestifyProvider } from 'pgrestify/react';

function App() {
  return (
    <PGRestifyProvider
      url="http://localhost:3000"
      anonKey="your-anon-key"
      options={{
        auth: { autoRefreshToken: true },
        cache: { enabled: true, ttl: 300000 }
      }}
    >
      <MyApp />
    </PGRestifyProvider>
  );
}
```

**Hooks for Data Fetching:**
```typescript
// === Data Fetching Hooks ===
import { 
  usePGRestify, 
  usePGRestifyQuery,
  usePGRestifyMutation,
  useAuth,
  useRealtime 
} from 'pgrestify/react';

// Basic data fetching
function UsersList() {
  const { data: users, loading, error, refetch } = usePGRestify(
    client => client.from('users').select('*').eq('active', true)
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}

// Query with dependencies
function UserPosts({ userId }: { userId: string }) {
  const { data: posts } = usePGRestifyQuery(
    ['user-posts', userId],
    client => client
      .from('posts')
      .select('title, content, created_at')
      .eq('author_id', userId)
      .order('created_at', { ascending: false }),
    { enabled: !!userId }
  );

  return <div>{/* Render posts */}</div>;
}

// Mutations
function CreatePostForm() {
  const { mutate: createPost, loading } = usePGRestifyMutation(
    client => (data: any) => client.from('posts').insert(data).select().single()
  );

  const handleSubmit = (formData: any) => {
    createPost(formData, {
      onSuccess: (post) => console.log('Created:', post),
      onError: (error) => console.error('Failed:', error)
    });
  };

  return <form onSubmit={handleSubmit}>{/* Form fields */}</form>;
}

// Authentication hook
function LoginForm() {
  const { signIn, signOut, user, loading } = useAuth();

  const handleLogin = async (email: string, password: string) => {
    const { error } = await signIn({ email, password });
    if (error) console.error('Login failed:', error);
  };

  if (loading) return <div>Loading...</div>;
  if (user) return <div>Welcome, {user.name}! <button onClick={signOut}>Logout</button></div>;
  
  return <LoginForm onSubmit={handleLogin} />;
}

// Real-time subscriptions
function LiveNotifications() {
  const { data: notifications } = useRealtime(
    'notifications',
    client => client
      .from('notifications')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false })
  );

  return (
    <div>
      {notifications.map(notification => (
        <div key={notification.id}>{notification.message}</div>
      ))}
    </div>
  );
}
```

### TanStack Query Integration

```typescript
// === Advanced Caching with TanStack Query ===
import { usePGRestifyQuery, usePGRestifyInfiniteQuery } from 'pgrestify/tanstack-query';

// Standard query with TanStack Query features
function PostsList() {
  const {
    data: posts,
    isLoading,
    error,
    refetch,
    isStale
  } = usePGRestifyQuery({
    queryKey: ['posts', 'published'],
    queryFn: client => client
      .from('posts')
      .select('*, author:users(name)')
      .eq('published', true)
      .order('created_at', { ascending: false }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false
  });

  return <div>{/* Render posts */}</div>;
}

// Infinite queries for pagination
function InfinitePostsList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = usePGRestifyInfiniteQuery({
    queryKey: ['posts', 'infinite'],
    queryFn: ({ pageParam = 0 }) => client
      .from('posts')
      .select('*')
      .range(pageParam * 10, (pageParam + 1) * 10 - 1),
    getNextPageParam: (lastPage, pages) => 
      lastPage.length === 10 ? pages.length : undefined
  });

  return (
    <div>
      {data?.pages.map((page, i) => (
        <div key={i}>
          {page.map(post => <div key={post.id}>{post.title}</div>)}
        </div>
      ))}
      
      {hasNextPage && (
        <button 
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}

// Mutations with optimistic updates
function useCreatePost() {
  return usePGRestifyMutation({
    mutationFn: client => (data: any) => 
      client.from('posts').insert(data).select().single(),
    onMutate: async (newPost) => {
      // Optimistic update
      queryClient.setQueryData(['posts'], (old: any[]) => [...old, newPost]);
    },
    onError: (err, newPost, context) => {
      // Rollback on error
      queryClient.setQueryData(['posts'], context.previousPosts);
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries(['posts']);
    }
  });
}
```

### Next.js Adapter

```typescript
// === Complete Next.js Integration ===
// App Router support (app/layout.tsx)
import { NextPGRestifyProvider } from 'pgrestify/nextjs';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <NextPGRestifyProvider
          url={process.env.NEXT_PUBLIC_POSTGREST_URL!}
          anonKey={process.env.NEXT_PUBLIC_POSTGREST_ANON_KEY!}
        >
          {children}
        </NextPGRestifyProvider>
      </body>
    </html>
  );
}

// Server Components (app/users/page.tsx)
import { createServerClient } from 'pgrestify/nextjs';

export default async function UsersPage() {
  const client = createServerClient();
  
  const users = await client
    .from('users')
    .select('*')
    .eq('active', true)
    .execute();

  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}

// API Routes (app/api/users/route.ts)
import { createRouteHandlerClient } from 'pgrestify/nextjs';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const client = createRouteHandlerClient();
  
  const users = await client
    .from('users')
    .select('*')
    .execute();

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const client = createRouteHandlerClient();
  const body = await request.json();
  
  const newUser = await client
    .from('users')
    .insert(body)
    .select()
    .single();

  return NextResponse.json(newUser);
}

// Middleware with authentication (middleware.ts)
import { createMiddlewareClient } from 'pgrestify/nextjs';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const client = createMiddlewareClient({ req: request, res });

  const { data: { session } } = await client.auth.getSession();

  if (!session && request.nextUrl.pathname.startsWith('/protected')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return res;
}

// Pages Router support (pages/_app.tsx)
import { PGRestifyProvider } from 'pgrestify/react';
import { createPagesBrowserClient } from 'pgrestify/nextjs';
import { useState } from 'react';

export default function App({ Component, pageProps }: any) {
  const [client] = useState(() => createPagesBrowserClient());

  return (
    <PGRestifyProvider client={client}>
      <Component {...pageProps} />
    </PGRestifyProvider>
  );
}

// Server-side props (pages/posts/[id].tsx)
import { createPagesServerClient } from 'pgrestify/nextjs';

export async function getServerSideProps({ params, req, res }: any) {
  const client = createPagesServerClient({ req, res });
  
  const post = await client
    .from('posts')
    .select('*, author:users(name), comments(*)')
    .eq('id', params.id)
    .single();

  return { props: { post } };
}
```

---

## 🛠️ CLI Tool Capabilities

### Frontend Project Generation

```bash
# === Frontend Initialization ===
# React project with TypeScript
pgrestify frontend init my-react-app --framework react --typescript

# Vue.js project
pgrestify frontend init my-vue-app --framework vue

# Vanilla JavaScript project
pgrestify frontend init my-js-app --framework vanilla

# Connect to existing API
pgrestify frontend init --api-url https://api.example.com
```

**Generated Frontend Structure:**
```
my-react-app/
├── src/
│   ├── types/
│   │   └── database.ts        # Generated TypeScript types
│   ├── hooks/
│   │   ├── useUsers.ts        # Generated data hooks
│   │   ├── usePosts.ts
│   │   └── useAuth.ts
│   ├── components/
│   │   ├── UserList.tsx       # Generated components
│   │   └── PostCard.tsx
│   └── lib/
│       └── pgrestify.ts       # Client configuration
├── package.json               # Dependencies included
└── README.md                  # Usage instructions
```

### Complete API Project Generation

```bash
# === API Project Templates ===
# Basic template (users + profiles)
pgrestify api init --template basic --skip-prompts

# Blog template (authors, posts, comments, categories)
pgrestify api init blog-project --template blog --skip-prompts

# E-commerce template (customers, products, orders, etc.)
pgrestify api init store-project --template ecommerce --skip-prompts

# With testing data
pgrestify api init --template blog --testing-data --testing-records 100
```

**Complete API Project Structure:**
```
blog-project/
├── 📁 sql/schemas/           # Table-based folders (NEW)
│   ├── _setup/
│   │   └── table.sql         # Roles, extensions, permissions
│   ├── authors/
│   │   ├── table.sql         # Author table definition
│   │   ├── rls.sql           # Author-specific RLS policies
│   │   ├── triggers.sql      # Audit triggers
│   │   ├── indexes.sql       # Performance indexes
│   │   └── views.sql         # Author-related views
│   ├── categories/
│   │   └── [same structure]
│   ├── posts/
│   │   └── [same structure]
│   └── comments/
│       └── [same structure]
├── 📁 sql/functions/
│   ├── auth.sql              # Authentication functions
│   └── utilities.sql         # Utility functions
├── 📁 sql/migrations/        # User migrations
├── 📁 scripts/
│   └── setup.sh              # Database setup script
├── 📄 postgrest.conf         # PostgREST configuration
├── 🐳 docker-compose.yml     # PostgreSQL + PostgREST
├── 📦 package.json           # Scripts and dependencies
├── 🔐 .env.example           # Environment template
└── 📖 README.md              # Project documentation
```

### Database Schema Generation

```bash
# === Schema Generation ===
# Generate schema for specific tables
pgrestify api schema generate --tables users,posts,comments

# Generate with all features
pgrestify api schema generate --with-rls --with-functions --with-triggers

# Generate minimal schema
pgrestify api schema generate --with-rls=false --with-triggers=false
```

### RLS Policy Generation

```bash
# === Row Level Security Policies ===
# Auto-detect ownership patterns
pgrestify api generate policy users

# Specific ownership pattern
pgrestify api generate policy posts --pattern user_specific --owner-column author_id

# Public read access
pgrestify api generate policy categories --pattern public_read

# Admin-only access
pgrestify api generate policy admin_logs --pattern admin_only

# Generate for all tables
pgrestify api generate policy --all-tables
```

**Generated RLS Examples:**
```sql
-- User-specific access (posts table)
CREATE POLICY "posts_select_own" ON api.posts
  FOR SELECT TO web_user
  USING (author_id = auth.current_user_id());

CREATE POLICY "posts_insert_own" ON api.posts
  FOR INSERT TO web_user
  WITH CHECK (author_id = auth.current_user_id());

-- Public read access (categories table)
CREATE POLICY "categories_select_public" ON api.categories
  FOR SELECT TO web_anon, web_user
  USING (true);

-- Admin-only access
CREATE POLICY "admin_logs_admin_only" ON api.admin_logs
  FOR ALL TO web_user
  USING (auth.is_admin());
```

### Database View Generation

```bash
# === Intelligent View Generation ===
# Interactive view creation with schema analysis
pgrestify api features views generate user_posts

# Specific view with base table
pgrestify api features views generate user_stats --base-table users

# Materialized view for performance
pgrestify api features views generate daily_analytics --materialized --base-table orders

# Suggest views based on schema analysis
pgrestify api features views suggest

# Analyze existing schema relationships
pgrestify api features views analyze
```

**Generated View Examples:**
```sql
-- User posts view (written to sql/schemas/users/views.sql)
CREATE VIEW api.user_posts AS
SELECT 
  u.name AS author_name,
  u.email AS author_email,
  p.title,
  p.content,
  p.created_at,
  c.name AS category_name
FROM api.users u
JOIN api.posts p ON u.id = p.author_id
LEFT JOIN api.categories c ON p.category_id = c.id
WHERE p.published = true;

-- User statistics materialized view
CREATE MATERIALIZED VIEW api.user_stats AS
SELECT 
  u.id,
  u.name,
  COUNT(p.id) AS post_count,
  COUNT(CASE WHEN p.published = true THEN 1 END) AS published_count,
  MAX(p.created_at) AS last_post_date
FROM api.users u
LEFT JOIN api.posts p ON u.id = p.author_id
GROUP BY u.id, u.name;
```

### Index Generation with Performance Analysis

```bash
# === Performance Index Generation ===
# Add index to specific column
pgrestify api features indexes add users --column email

# Analyze and suggest indexes
pgrestify api features indexes suggest

# Add composite index
pgrestify api features indexes add posts --columns "author_id,created_at"

# Full-text search index
pgrestify api features indexes add articles --column content --type gin
```

**Generated Index Examples:**
```sql
-- Performance indexes (written to sql/schemas/users/indexes.sql)
-- Added by pgrestify api features indexes add users --column email
-- Generated: 2025-08-31T10:30:45.123Z
CREATE INDEX CONCURRENTLY idx_users_email ON api.users(email);

-- Composite index for common queries
CREATE INDEX CONCURRENTLY idx_posts_author_date ON api.posts(author_id, created_at DESC);

-- Full-text search index
CREATE INDEX CONCURRENTLY idx_articles_content_gin ON api.articles USING gin(to_tsvector('english', content));

-- Partial index for active records
CREATE INDEX CONCURRENTLY idx_users_active_email ON api.users(email) WHERE active = true;
```

### Function Generation

```bash
# === PostgreSQL Function Generation ===
# Authentication functions
pgrestify api generate function --type auth

# CRUD helper functions
pgrestify api generate function --type crud

# Custom business logic functions
pgrestify api generate function calculate_order_total --return-type JSON

# Utility functions
pgrestify api generate function --type utils
```

**Generated Function Examples:**
```sql
-- Authentication functions (sql/functions/auth.sql)
CREATE OR REPLACE FUNCTION api.register(email TEXT, password TEXT, name TEXT)
RETURNS JSON AS $$
DECLARE
  user_id UUID;
  jwt_token TEXT;
BEGIN
  -- Validate and create user
  INSERT INTO api.users (email, name, password_hash)
  VALUES (register.email, register.name, crypt(register.password, gen_salt('bf')))
  RETURNING id INTO user_id;
  
  -- Generate JWT token
  jwt_token := sign(
    json_build_object(
      'sub', user_id::TEXT,
      'email', register.email,
      'role', 'web_user',
      'exp', extract(epoch from now() + interval '7 days')
    ),
    current_setting('app.jwt_secret')
  );
  
  RETURN json_build_object('token', jwt_token, 'user', json_build_object('id', user_id, 'email', register.email));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CRUD helper functions
CREATE OR REPLACE FUNCTION api.search(
  table_name TEXT,
  search_query TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 20
) RETURNS JSON AS $$
-- Search implementation
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Trigger Generation

```bash
# === Database Trigger Generation ===
# Add audit trigger to specific table
pgrestify api features triggers add users --type audit

# Add timestamp update trigger
pgrestify api features triggers add posts --type timestamp

# Add all audit triggers
pgrestify api features triggers audit-all

# Custom trigger
pgrestify api features triggers generate notify_post_update
```

**Generated Trigger Examples:**
```sql
-- Audit triggers (written to sql/schemas/users/triggers.sql)
-- Added by pgrestify api features triggers add users --type audit
-- Generated: 2025-08-31T11:00:00.000Z

-- Audit log trigger
CREATE OR REPLACE FUNCTION api.audit_users()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO api.audit_log (
    table_name,
    operation,
    row_data,
    changed_by,
    changed_at
  ) VALUES (
    'users',
    TG_OP,
    CASE TG_OP
      WHEN 'DELETE' THEN row_to_json(OLD)
      ELSE row_to_json(NEW)
    END,
    current_setting('request.jwt.claims', true)::json->>'sub',
    NOW()
  );
  
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_users_trigger
  AFTER INSERT OR UPDATE OR DELETE ON api.users
  FOR EACH ROW EXECUTE FUNCTION api.audit_users();
```

### Testing Data Generation

```bash
# === Realistic Testing Data ===
# Generate 50 records per table
pgrestify api testing-data --template blog --records 50

# Generate with image URLs
pgrestify api testing-data --template ecommerce --with-images --records 100

# Apply testing data automatically
pgrestify api init --template blog --testing-data --run-migrations
```

**Generated Testing Data Examples:**
```sql
-- Realistic blog testing data
INSERT INTO api.authors (name, email, bio) VALUES
  ('Sarah Chen', 'sarah.chen@example.com', 'Tech blogger specializing in web development'),
  ('Marcus Rodriguez', 'marcus.r@example.com', 'Full-stack developer and writer'),
  ('Emily Johnson', 'emily.j@example.com', 'UI/UX designer turned developer advocate');

INSERT INTO api.posts (title, content, author_id, category_id, published) VALUES
  ('Getting Started with PostgreSQL', 'PostgreSQL is a powerful...', '123...', '456...', true),
  ('Advanced TypeScript Patterns', 'TypeScript offers many...', '234...', '567...', true);
```

### Migration System

```bash
# === Database Migration Management ===
# Run migrations with Docker
pgrestify api migrate --docker

# Run migrations on local PostgreSQL
pgrestify api migrate

# Preview migrations (dry run)
pgrestify api migrate --dry-run --verbose

# Force migrations (continue on errors)
pgrestify api migrate --force
```

**Migration Execution Order:**
1. **Setup Phase**: `sql/schemas/_setup/table.sql` (roles, extensions)
2. **Tables Phase**: All `table.sql` files across all table folders
3. **Indexes Phase**: All `indexes.sql` files across all table folders
4. **RLS Phase**: All `rls.sql` files across all table folders
5. **Triggers Phase**: All `triggers.sql` files across all table folders
6. **Views Phase**: All `views.sql` files across all table folders
7. **Functions Phase**: All files in `sql/functions/`

### Configuration Management

```bash
# === Configuration Generation ===
# PostgREST configuration
pgrestify api config postgrest --db-uri "postgresql://user:pass@localhost:5432/mydb"

# Docker Compose setup
pgrestify api config docker --postgres-port 5433 --postgrest-port 3001

# Environment-specific configs
pgrestify api config postgrest --env production
```

### Project Validation

```bash
# === Security and Configuration Validation ===
# Complete project validation
pgrestify validate

# Check RLS policies
pgrestify validate --check-rls

# Check role permissions
pgrestify validate --check-permissions

# Security audit
pgrestify validate --security-audit
```

---

## 🔐 Security Features

### Built-in Security Measures

1. **Row Level Security (RLS) by Default**
   - All generated tables have RLS enabled
   - User-specific, public read, and admin-only policy patterns
   - Automatic ownership detection

2. **Secure Role Management**
   - `web_anon` role for unauthenticated users
   - `web_user` role for authenticated users
   - `authenticator` role for PostgREST connection
   - Proper role inheritance and permissions

3. **JWT Integration**
   - Automatic JWT secret generation (cryptographically secure)
   - Token refresh handling
   - Role-based claims in JWT tokens

4. **SQL Injection Prevention**
   - All user inputs validated and sanitized
   - Parameterized queries only
   - No dynamic SQL construction

5. **No Credential Storage**
   - CLI never stores database passwords
   - Temporary connections only for operations
   - Environment variable recommendations

### Security Validation Features

```bash
# Comprehensive security checks
pgrestify validate --security-audit

# Specific security validations
pgrestify validate --check-rls           # Verify RLS policies
pgrestify validate --check-permissions   # Verify role permissions
pgrestify validate --check-functions     # Verify function security
pgrestify validate --check-jwt           # Verify JWT configuration
```

---

## 🎯 Advanced Features

### TypeScript Type Generation

```bash
# === Type Generation from PostgREST Schema ===
# Generate from local API
pgrestify frontend types

# Generate from remote API
pgrestify frontend types --api-url https://api.production.com

# Custom output location
pgrestify frontend types --output src/types/db.ts --schema public
```

**Generated Types Example:**
```typescript
// Generated types include full database schema
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          title: string;
          content: string | null;
          author_id: string;
          published: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          content?: string | null;
          author_id: string;
          published?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          content?: string | null;
          author_id?: string;
          published?: boolean;
          created_at?: string;
        };
      };
    };
    Views: {
      user_posts: {
        Row: {
          author_name: string;
          title: string;
          content: string | null;
          published: boolean;
        };
      };
    };
    Functions: {
      register: {
        Args: { email: string; password: string; name?: string };
        Returns: Json;
      };
      login: {
        Args: { email: string; password: string };
        Returns: Json;
      };
    };
  };
}
```

### Project Restructuring

```bash
# === Migrate from Old Structure ===
# Preview what will be migrated
pgrestify api schema restructure --dry-run

# Perform migration with backup
pgrestify api schema restructure --backup

# Force migration (overwrite existing)
pgrestify api schema restructure --force

# Migrate specific schema
pgrestify api schema restructure --schema custom_schema
```

### Sync and Update Commands

```bash
# === Synchronization ===
# Detect manual database changes
pgrestify api sync

# Update existing configurations
pgrestify api update schema --table users
pgrestify api update policies --table posts

# Bulk updates
pgrestify api update policies --all-tables --backup
```

### Migration Generation

```bash
# === Schema Migration Generation ===
# Generate migration between schemas
pgrestify api schema migrate --from old_schema.sql --to new_schema.sql

# Generate migration with name
pgrestify api schema migrate --from v1 --to v2 --name "add_user_preferences"
```

---

## 🔗 Integration Capabilities

### Framework Support

**React:**
- Hooks: `usePGRestify`, `usePGRestifyQuery`, `usePGRestifyMutation`
- Context Provider: `PGRestifyProvider`
- Authentication: `useAuth`
- Real-time: `useRealtime`

**Next.js:**
- App Router: Server Components, Route Handlers, Middleware
- Pages Router: SSR, SSG, API Routes
- Authentication: Session management, protected routes
- Caching: Built-in Next.js cache integration

**TanStack Query:**
- Advanced caching strategies
- Infinite queries
- Optimistic updates
- Background refetching

**Vue.js (Planned):**
- Composables: `usePGRestify`, `useAuth`
- Plugin integration
- Nuxt.js support

### Database Integration

**PostgreSQL Versions:**
- PostgreSQL 12+ (basic support)
- PostgreSQL 13+ (recommended)
- PostgreSQL 14+ (optimal performance)
- PostgreSQL 15+ (latest features)

**PostgREST Versions:**
- PostgREST 9.0+ (basic support)
- PostgREST 10.0+ (recommended)
- PostgREST 11.0+ (full features)

**Cloud Database Support:**
- AWS RDS PostgreSQL
- Google Cloud SQL
- Azure Database for PostgreSQL
- Supabase (with migration tools)
- Railway
- PlanetScale (with PostgreSQL)

---

## 📊 Performance Optimization Features

### Intelligent Index Generation

```bash
# Analyze query patterns and suggest indexes
pgrestify api features indexes analyze

# Generate performance-optimized indexes
pgrestify api features indexes suggest --analyze-queries

# Add specific performance indexes
pgrestify api features indexes add orders --column status --where "status IN ('processing', 'shipped')"
```

### Query Optimization

```typescript
// === Performance Features ===
// Request batching
const client = createClient({
  url: 'http://localhost:3000',
  options: {
    batchRequests: true,
    batchDelay: 10 // ms
  }
});

// Connection pooling
const client = createClient({
  url: 'http://localhost:3000',
  options: {
    pool: {
      maxConnections: 10,
      idleTimeoutMillis: 30000
    }
  }
});

// Query deduplication
const users1 = client.from('users').select('*').execute(); // New request
const users2 = client.from('users').select('*').execute(); // Deduped!

// Prepared statements
const getUser = client.prepare(
  client.from('users').select('*').eq('id', '$1')
);
const user = await getUser('123');
```

### Caching Strategies

```typescript
// === Advanced Caching ===
// Memory cache
const client = createClient({
  cache: {
    type: 'memory',
    ttl: 300000, // 5 minutes
    maxSize: 100 // queries
  }
});

// Redis cache
const client = createClient({
  cache: {
    type: 'redis',
    redis: {
      url: 'redis://localhost:6379'
    },
    ttl: 3600000 // 1 hour
  }
});

// Custom cache adapter
const client = createClient({
  cache: {
    type: 'custom',
    adapter: new MyCustomCacheAdapter()
  }
});
```

---

## 🚀 Deployment and Production Features

### Environment Management

```bash
# === Environment-Specific Configurations ===
# Development setup
pgrestify api init --env development

# Production setup with optimizations
pgrestify api init --env production

# Staging environment
pgrestify api init --env staging
```

**Environment Differences:**

| Feature | Development | Production |
|---------|-------------|------------|
| JWT Secret | Generated | User-provided required |
| CORS | Permissive (`*`) | Strict (specific origins) |
| Logging | Verbose | Error-only |
| SSL | Optional | Required |
| Connection Pool | Small (5) | Large (20+) |
| Cache TTL | Short (1min) | Long (1hr) |

### Production Deployment

```bash
# === Production Deployment Helpers ===
# Generate production config
pgrestify api config postgrest --env production --db-uri $DATABASE_URL

# Generate optimized Docker setup
pgrestify api config docker --env production

# Validate production security
pgrestify validate --env production --strict
```

### Monitoring and Observability

```typescript
// === Built-in Monitoring ===
const client = createClient({
  url: 'http://localhost:3000',
  options: {
    logging: {
      enabled: true,
      level: 'info', // debug|info|warn|error
      destination: 'console' // console|file|custom
    },
    metrics: {
      enabled: true,
      endpoint: '/metrics'
    }
  }
});

// Custom monitoring
client.on('query', (query, duration) => {
  console.log(`Query executed in ${duration}ms:`, query);
});

client.on('error', (error, context) => {
  console.error('Query failed:', error, context);
});

client.on('auth', (event, session) => {
  console.log('Auth event:', event, session);
});
```

---

## 🧪 Testing and Development

### Testing Data Generation

```bash
# === Comprehensive Testing Data ===
# Generate realistic data for blog template
pgrestify api testing-data --template blog --records 100 --with-images

# Generate data for e-commerce template
pgrestify api testing-data --template ecommerce --records 200 --with-relationships

# Custom testing scenarios
pgrestify api testing-data --custom-scenario heavy_load
```

### Development Utilities

```bash
# === Development Tools ===
# Watch mode for schema changes
pgrestify api schema generate --watch

# Live reload for type generation
pgrestify frontend types --watch

# Database reset and reseed
pgrestify api reset --confirm

# Performance analysis
pgrestify api analyze --performance
```

---

## 📚 Complete Command Reference

### Frontend Commands (Client-Safe)

| Command | Purpose | Options | Example |
|---------|---------|---------|---------|
| `frontend init [api-url]` | Initialize frontend project | `--framework`, `--typescript`, `--skip-prompts` | `pgrestify frontend init --framework react` |
| `frontend types` | Generate TypeScript types | `--api-url`, `--output`, `--schema` | `pgrestify frontend types --output src/db.ts` |
| `frontend hooks` | Generate React/Vue hooks | `--tables`, `--output` | `pgrestify frontend hooks --tables users,posts` |
| `frontend components` | Generate framework components | `--framework`, `--template` | `pgrestify frontend components --framework react` |

### API/Backend Commands (PostgREST & Database)

#### Project Management
| Command | Purpose | Options | Example |
|---------|---------|---------|---------|
| `api init` | Initialize PostgREST project | `--template`, `--env`, `--skip-prompts`, `--local`, `--testing-data` | `pgrestify api init --template blog --skip-prompts` |
| `api migrate` | Run database migrations | `--docker`, `--force`, `--dry-run`, `--verbose` | `pgrestify api migrate --docker --verbose` |

#### Schema Management
| Command | Purpose | Options | Example |
|---------|---------|---------|---------|
| `api schema generate` | Generate schema with RLS | `--with-rls`, `--with-functions`, `--with-triggers`, `--tables` | `pgrestify api schema generate --tables users,posts` |
| `api schema validate` | Validate schema configuration | `--schema`, `--check-rls`, `--check-permissions` | `pgrestify api schema validate --check-rls` |
| `api schema restructure` | Migrate to table-folders | `--dry-run`, `--backup`, `--force` | `pgrestify api schema restructure --backup` |

#### RLS Management
| Command | Purpose | Options | Example |
|---------|---------|---------|---------|
| `api schema rls add <table>` | Add RLS policy | `--policy-type`, `--owner-column` | `pgrestify api schema rls add posts --policy-type user_specific` |
| `api schema rls update <table> <policy>` | Update RLS policy | `--new-condition` | `pgrestify api schema rls update users select_policy` |
| `api schema rls test <table>` | Generate RLS tests | `--output` | `pgrestify api schema rls test users` |
| `api schema rls list [table]` | List RLS policies | `--verbose` | `pgrestify api schema rls list users` |
| `api schema rls fix-anonymous` | Fix anonymous access | `--tables` | `pgrestify api schema rls fix-anonymous` |

#### Code Generation
| Command | Purpose | Options | Example |
|---------|---------|---------|---------|
| `api generate policy <table>` | Generate RLS policies | `--pattern`, `--owner-column`, `--all-tables` | `pgrestify api generate policy users --pattern user_specific` |
| `api generate view <name>` | Generate database views | `--base-table`, `--materialized`, `--template` | `pgrestify api generate view user_posts --base-table users` |
| `api generate function <name>` | Generate PostgreSQL functions | `--template`, `--return-type`, `--schema` | `pgrestify api generate function auth --template auth` |
| `api generate index <table>` | Generate performance indexes | `--column`, `--analyze`, `--type` | `pgrestify api generate index posts --column title` |

#### Feature Generation
| Command | Purpose | Options | Example |
|---------|---------|---------|---------|
| `api features views generate <name>` | Generate PostgreSQL view | `--base-table`, `--materialized`, `--template` | `pgrestify api features views generate stats --base-table users` |
| `api features views suggest` | Suggest useful views | `--analyze`, `--schema` | `pgrestify api features views suggest` |
| `api features views analyze` | Analyze schema relationships | `--output` | `pgrestify api features views analyze` |
| `api features views list` | List existing views | `--schema` | `pgrestify api features views list` |
| `api features triggers add <table>` | Add trigger to table | `--type`, `--function` | `pgrestify api features triggers add users --type audit` |
| `api features triggers generate <name>` | Generate custom trigger | `--table`, `--event`, `--function` | `pgrestify api features triggers generate update_timestamp` |
| `api features triggers audit-all` | Add audit to all tables | `--schema` | `pgrestify api features triggers audit-all` |
| `api features indexes add <table>` | Add index to table | `--column`, `--type`, `--where` | `pgrestify api features indexes add users --column email` |
| `api features indexes analyze` | Analyze query patterns | `--schema`, `--output` | `pgrestify api features indexes analyze` |
| `api features indexes suggest` | Suggest performance indexes | `--analyze-queries` | `pgrestify api features indexes suggest` |

#### Configuration
| Command | Purpose | Options | Example |
|---------|---------|---------|---------|
| `api config postgrest` | Generate PostgREST config | `--db-uri`, `--env`, `--output` | `pgrestify api config postgrest --env production` |
| `api config docker` | Generate Docker setup | `--postgres-port`, `--postgrest-port` | `pgrestify api config docker --postgres-port 5433` |

#### Functions
| Command | Purpose | Options | Example |
|---------|---------|---------|---------|
| `api functions create` | Create PostgREST functions | `--type`, `--name`, `--schema` | `pgrestify api functions create --type auth` |

#### Data Management
| Command | Purpose | Options | Example |
|---------|---------|---------|---------|
| `api testing-data` | Generate testing data | `--template`, `--records`, `--with-images` | `pgrestify api testing-data --template blog --records 100` |
| `api sync` | Sync manual changes | `--schema`, `--backup` | `pgrestify api sync --backup` |
| `api update` | Update configurations | `--target`, `--backup` | `pgrestify api update --target policies` |
| `api migrations` | Manage migrations | `--create`, `--run`, `--rollback` | `pgrestify api migrations --create add_user_preferences` |

### Shared Commands
| Command | Purpose | Options | Example |
|---------|---------|---------|---------|
| `validate` | Validate project | `--check-rls`, `--check-permissions`, `--security-audit` | `pgrestify validate --security-audit` |

---

## 🏗️ Templates and Generators

### Project Templates

**Basic Template:**
- Tables: `users`, `profiles`
- Features: Basic authentication, user profiles
- Use case: Simple applications, prototypes

**Blog Template:**
- Tables: `authors`, `categories`, `posts`, `comments`
- Features: Content management, categorization, commenting
- Use case: Blogs, news sites, content platforms

**E-commerce Template:**
- Tables: `customers`, `addresses`, `categories`, `products`, `orders`, `order_items`
- Features: Product catalog, shopping cart, order management
- Use case: Online stores, marketplaces, B2B platforms

### Code Generators

**Component Generators:**
```bash
# React components
pgrestify frontend components --framework react --template list
pgrestify frontend components --framework react --template form
pgrestify frontend components --framework react --template detail

# Vue components
pgrestify frontend components --framework vue --template table
```

**Hook Generators:**
```bash
# Data fetching hooks
pgrestify frontend hooks --type query --tables users,posts

# Mutation hooks
pgrestify frontend hooks --type mutation --operations create,update,delete

# Authentication hooks
pgrestify frontend hooks --type auth
```

---

## 🎯 Use Cases and Examples

### 1. Simple Blog Application

```bash
# 1. Initialize blog project
pgrestify api init my-blog --template blog --skip-prompts

# 2. Start development environment
cd my-blog
npm run pgrestify:start

# 3. Initialize frontend
pgrestify frontend init --framework react

# 4. Generate types and hooks
pgrestify frontend types
pgrestify frontend hooks

# 5. Add custom features
pgrestify api features views generate popular_posts --base-table posts
pgrestify api generate policy comments --pattern user_specific --owner-column author_id
```

### 2. E-commerce Platform

```bash
# 1. Initialize e-commerce project
pgrestify api init online-store --template ecommerce --skip-prompts

# 2. Add performance indexes
pgrestify api features indexes add products --column name
pgrestify api features indexes add orders --columns "customer_id,created_at"

# 3. Generate business logic functions
pgrestify api generate function calculate_shipping_cost --return-type JSON
pgrestify api generate function process_payment --template crud

# 4. Add audit trails
pgrestify api features triggers audit-all

# 5. Generate admin views
pgrestify api features views generate order_analytics --base-table orders --materialized
```

### 3. SaaS Application with Multi-tenancy

```bash
# 1. Start with basic template
pgrestify api init saas-app --template basic --skip-prompts

# 2. Add organization structure
pgrestify api schema generate --tables organizations,memberships,subscriptions

# 3. Generate tenant-aware policies
pgrestify api generate policy users --pattern user_specific --owner-column organization_id
pgrestify api generate policy projects --pattern user_specific --owner-column organization_id

# 4. Add subscription management functions
pgrestify api generate function handle_subscription_webhook --template custom
```

### 4. Migrating from Existing System

```bash
# 1. Initialize in existing project
cd existing-project
pgrestify api init --skip-prompts

# 2. Migrate existing SQL to table-folders
pgrestify api schema restructure --backup

# 3. Generate frontend integration
pgrestify frontend init http://localhost:3000

# 4. Sync with existing database
pgrestify api sync --analyze-existing
```

---

## 📈 Advanced Configuration

### Environment Variables

```bash
# === All Supported Environment Variables ===
# Database
DATABASE_URL=postgresql://user:pass@host:port/db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=myapp

# PostgREST
POSTGREST_URL=http://localhost:3000
POSTGREST_ANON_KEY=your-anon-key
POSTGREST_SERVICE_KEY=your-service-key
JWT_SECRET=your-super-secure-secret

# PGRestify
PGRESTIFY_ENV=development
PGRESTIFY_SCHEMA=api
PGRESTIFY_LOG_LEVEL=info
PGRESTIFY_CACHE_TTL=300000

# Docker
DOCKER_POSTGRES_PORT=5432
DOCKER_POSTGREST_PORT=3000
DOCKER_NETWORK=pgrestify-network
```

### Custom Configuration

```typescript
// === pgrestify.config.ts Full Configuration ===
export default {
  database: {
    url: process.env.DATABASE_URL,
    schema: 'api',
    connectionPool: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000
    }
  },
  postgrest: {
    url: process.env.POSTGREST_URL,
    anonKey: process.env.POSTGREST_ANON_KEY,
    serviceKey: process.env.POSTGREST_SERVICE_KEY,
    headers: {
      'X-Custom-Header': 'value'
    }
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: 'localStorage', // localStorage|sessionStorage|custom
    redirectTo: '/dashboard'
  },
  cache: {
    enabled: true,
    type: 'memory', // memory|redis|custom
    ttl: 300000,
    maxSize: 100
  },
  realtime: {
    enabled: true,
    heartbeatIntervalMs: 30000,
    reconnectDelayMs: 1000
  },
  cli: {
    defaultTemplate: 'basic',
    outputDir: './src/types',
    generateHooks: true,
    generateComponents: true
  }
};
```

---

## 🔍 Error Handling and Debugging

### Error Types

```typescript
// === Comprehensive Error Handling ===
import { 
  PGRestifyError, 
  NetworkError, 
  AuthError, 
  ValidationError,
  DatabaseError 
} from 'pgrestify';

try {
  const users = await client.from('users').select('*').execute();
} catch (error) {
  if (error instanceof AuthError) {
    // Handle authentication errors
    console.log('Auth failed:', error.message);
    // Redirect to login
  } else if (error instanceof NetworkError) {
    // Handle network issues
    console.log('Network error:', error.message);
    // Show offline message
  } else if (error instanceof ValidationError) {
    // Handle validation errors
    console.log('Validation failed:', error.details);
    // Show form errors
  } else if (error instanceof DatabaseError) {
    // Handle database errors
    console.log('Database error:', error.code, error.message);
    // Show user-friendly message
  }
}

// Global error handler
client.onError((error, context) => {
  console.error('PGRestify Error:', error, context);
  // Send to error tracking service
});
```

### Debug Features

```typescript
// === Debug and Development Features ===
// Enable debug mode
const client = createClient({
  url: 'http://localhost:3000',
  debug: true, // Logs all queries and responses
  options: {
    logLevel: 'debug',
    showPerformanceMetrics: true
  }
});

// Query performance monitoring
client.onQuery((query, metadata) => {
  console.log(`Query: ${query.sql}`);
  console.log(`Duration: ${metadata.duration}ms`);
  console.log(`Cache: ${metadata.fromCache ? 'HIT' : 'MISS'}`);
});

// Network monitoring
client.onNetwork((request, response, timing) => {
  console.log(`${request.method} ${request.url} - ${response.status} (${timing.total}ms)`);
});
```

---

## 🌟 Best Practices

### Query Optimization

```typescript
// === Performance Best Practices ===
// 1. Select only needed columns
const users = await client
  .from('users')
  .select('id, name') // Not .select('*')
  .execute();

// 2. Use pagination for large datasets
const posts = await client
  .from('posts')
  .select('*')
  .range(0, 19) // First 20 items
  .execute();

// 3. Use indexes for filtered queries
// First add index: pgrestify api features indexes add users --column email
const user = await client
  .from('users')
  .select('*')
  .eq('email', 'user@example.com')
  .single();

// 4. Batch related queries
const [users, posts, categories] = await Promise.all([
  client.from('users').select('*').execute(),
  client.from('posts').select('*').execute(),
  client.from('categories').select('*').execute()
]);

// 5. Use materialized views for complex queries
// Generate: pgrestify api features views generate user_stats --materialized
const stats = await client.from('user_stats').select('*').execute();
```

### Security Best Practices

```typescript
// === Security Best Practices ===
// 1. Always use RLS policies
// Generate: pgrestify api generate policy users --pattern user_specific

// 2. Validate user input
const safeEmail = email.trim().toLowerCase();
if (!safeEmail.includes('@')) {
  throw new Error('Invalid email');
}

// 3. Use type-safe parameters
const user = await client
  .from('users')
  .select('*')
  .eq('id', userId) // Safe - parameterized
  // Never: .filter(`id = '${userId}'`) // Unsafe - SQL injection risk
  .single();

// 4. Handle authentication properly
if (!client.auth.session) {
  // Redirect to login
  return;
}

// 5. Use HTTPS in production
const client = createClient({
  url: 'https://api.yourdomain.com', // HTTPS only
  anonKey: process.env.POSTGREST_ANON_KEY
});
```

---

## 🚀 Complete Capability Summary

PGRestify provides:

### ✅ Library Features
- **Type-safe queries** with full PostgREST operator support
- **Framework adapters** for React, Next.js, TanStack Query
- **Authentication system** with JWT and RLS integration
- **Real-time subscriptions** via PostgreSQL LISTEN/NOTIFY
- **Intelligent caching** with multiple backend options
- **Repository pattern** for data abstraction
- **SSR support** for Next.js and other frameworks
- **Error handling** with typed error classes
- **Performance monitoring** and metrics collection

### ✅ CLI Features
- **Project initialization** with 3 templates (basic, blog, ecommerce)
- **Schema generation** with mandatory table-based folder structure
- **RLS policy generation** with intelligent ownership detection
- **Database view generation** with schema analysis
- **Performance index generation** with query analysis
- **PostgreSQL function generation** for auth, CRUD, and custom logic
- **Database trigger generation** for auditing and automation
- **Testing data generation** with realistic, relational data
- **Migration system** with conservative ordering and conflict resolution
- **Configuration management** for PostgREST and Docker
- **Project validation** with security auditing
- **Structure migration** from old numbered files to table folders

### ✅ Security Features
- **RLS by default** on all generated tables
- **Secure role management** with proper separation
- **JWT integration** with automatic token refresh
- **Input validation** and SQL injection prevention
- **No credential storage** in CLI
- **Security auditing** and validation tools

### ✅ Developer Experience
- **100% TypeScript support** with intelligent inference
- **Comprehensive documentation** with examples
- **Interactive and non-interactive modes** for all commands
- **Detailed error messages** with recovery suggestions
- **Performance optimization** guidance and tools
- **Migration assistance** for existing projects

**PGRestify is the most comprehensive, secure, and developer-friendly PostgREST client library available.**