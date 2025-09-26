# Basic Usage Examples

This guide shows you how to get started with PGRestify using practical examples with both PostgREST native syntax and repository patterns.

## Setup

First, install PGRestify:

```bash
npm install @webcoded/pgrestify
```

## Define Your Types

```typescript
// Define interfaces for type safety
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  role: 'user' | 'admin' | 'moderator';
  created_at: string;
  updated_at?: string;
}

interface Post {
  id: number;
  title: string;
  content: string;
  author_id: number;
  published: boolean;
  tags: string[];
  created_at: string;
}
```

## Create a Client

```typescript
import { createClient } from '@webcoded/pgrestify';

// Basic client setup
const client = createClient({
  url: 'http://localhost:3000', // Your PostgREST URL
  auth: {
    persistSession: true
  }
});

// Advanced client with caching
const client = createClient({
  url: process.env.POSTGREST_URL || 'http://localhost:3000',
  auth: {
    persistSession: true,
    autoRefreshToken: true
  },
  cache: {
    enabled: true,
    ttl: 300000, // 5 minutes
    maxSize: 1000
  }
});
```

## Dual Query Syntax

PGRestify supports two query approaches - choose what feels natural:

### 🎯 PostgREST Native Syntax

```typescript
// Get users with array syntax (recommended)
const { data: users, error } = await client
  .from('users')
  .select(['id', 'name', 'email', 'active', 'created_at'])
  .execute();

// Query with aliases using array syntax
const { data: usersWithAliases } = await client
  .from('users')
  .select([
    'id AS user_id',
    'name AS full_name', 
    'email AS contact_email',
    'created_at AS signup_date'
  ])
  .execute();

// Filter with multiple sort orders
const { data: activeUsers } = await client
  .from('users')
  .select(['id', 'name', 'email', 'role'])
  .eq('active', true)
  .order('role')                           // Primary sort: by role
  .order('name', { ascending: true })      // Secondary sort: alphabetical
  .execute();

// Relations example with aliases and sorting
const { data: usersWithPosts } = await client
  .from('users')
  .select([
    'id',
    'name AS user_name',
    'posts.title AS post_title',
    'posts.created_at AS post_date'
  ])
  .relations(['posts'])
  .eq('active', true)
  .order('name')
  .order('posts.created_at', { ascending: false })
  .execute();
```

### 🏗️ Repository Pattern

```typescript
// Get repository for users table
const userRepo = client.getRepository<User>('users');

// Simple queries
const users = await userRepo.find();
const activeUsers = await userRepo.findBy({ active: true });
const user = await userRepo.findOne({ id: 1 });

// Query builder with aliases
const usersWithAliases = await userRepo
  .createQueryBuilder()
  .select([
    'id AS user_id',
    'name AS full_name',
    'email AS contact_email'
  ])
  .where('active = :active', { active: true })
  .orderBy('name', 'ASC')
  .getMany();

// Multiple sort orders with repository pattern
const sortedUsers = await userRepo
  .createQueryBuilder()
  .select(['id', 'name', 'email', 'role', 'created_at'])
  .where('active = :active', { active: true })
  .orderBy('role', 'ASC')              // Primary sort
  .addOrderBy('created_at', 'DESC')    // Secondary sort
  .addOrderBy('name', 'ASC')           // Tertiary sort
  .getMany();

// Relations with repository pattern  
const usersWithRelations = await userRepo
  .createQueryBuilder()
  .select([
    'id',
    'name AS user_name',
    'posts.title AS post_title',
    'posts.published'
  ])
  .relations(['posts'])
  .where('active = :active', { active: true })
  .orderBy('name', 'ASC')
  .getMany();
```

## CRUD Operations

### Create (Insert) Records

::: code-group

```typescript [PostgREST Syntax]
// Insert a single user
const { data: newUser } = await client
  .from('users')
  .insert({
    name: 'John Doe',
    email: 'john@example.com',
    active: true
  })
  .single()
  .execute();

// Bulk insert users
const { data: newUsers } = await client
  .from('users')
  .insert([
    { name: 'Alice', email: 'alice@example.com', active: true },
    { name: 'Bob', email: 'bob@example.com', active: false }
  ])
  .execute();
```

```typescript [Repository Pattern]
// Create single user
const user = await userRepo.save({
  name: 'John Doe',
  email: 'john@example.com',
  active: true
});

// Create multiple users
const users = await userRepo.save([
  { name: 'Alice', email: 'alice@example.com', active: true },
  { name: 'Bob', email: 'bob@example.com', active: false }
]);
```

:::

### Read (Select) Records

::: code-group

```typescript [PostgREST Syntax]
// Find all active users
const { data: activeUsers } = await client
  .from('users')
  .select('*')
  .eq('active', true)
  .execute();

// Find a specific user
const { data: user } = await client
  .from('users')
  .select('id, name, email')
  .eq('id', 1)
  .single()
  .execute();

// Complex query with joins
const { data: usersWithPosts } = await client
  .from('users')
  .select(`
    id, 
    name, 
    email, 
    posts:posts(id, title, content)
  `)
  .eq('active', true)
  .execute();
```

```typescript [Repository Pattern]
// Find all active users
const activeUsers = await userRepo.findBy({ active: true });

// Find a specific user
const user = await userRepo.findOne({ id: 1 });

// Advanced query with joins
const usersWithPosts = await userRepo
  .createQueryBuilder()
  .leftJoinAndSelect('posts', 'post')
  .where('active = :active', { active: true })
  .getMany();
```

:::

### Update Records

::: code-group

```typescript [PostgREST Syntax]
// Update a user
const { data: updatedUser } = await client
  .from('users')
  .update({ active: false })
  .eq('id', 1)
  .single()
  .execute();

// Bulk update
const { data: updatedUsers } = await client
  .from('users')
  .update({ active: false })
  .lt('created_at', '2023-01-01')
  .execute();
```

```typescript [Repository Pattern]
// Update a user
const user = await userRepo.findOne({ id: 1 });
if (user) {
  user.active = false;
  await userRepo.save(user);
}

// Direct update
await userRepo.update({ id: 1 }, { active: false });

// Bulk update
await userRepo.update(
  { created_at: { $lt: '2023-01-01' } }, 
  { active: false }
);
```

:::

### Delete Records

::: code-group

```typescript [PostgREST Syntax]
// Delete a specific user
await client
  .from('users')
  .delete()
  .eq('id', 1)
  .execute();

// Bulk delete
await client
  .from('users')
  .delete()
  .eq('active', false)
  .execute();
```

```typescript [Repository Pattern]
// Delete a specific user
const user = await userRepo.findOne({ id: 1 });
if (user) {
  await userRepo.remove(user);
}

// Direct delete
await userRepo.delete({ id: 1 });

// Bulk delete
await userRepo.delete({ active: false });
```

:::

## Advanced Querying

::: code-group

```typescript [PostgREST Syntax]
// Pagination
const { data: paginatedUsers, count } = await client
  .from('users')
  .select('*', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(0, 9)
  .execute();

// Full-text search
const { data: searchResults } = await client
  .from('posts')
  .select('*')
  .textSearch('content', 'typescript postgresql')
  .limit(10)
  .execute();

// Aggregate functions
const { data: userStats } = await client
  .from('users')
  .select(`
    count(*) as total_users,
    avg(id) as avg_id,
    min(created_at) as first_user_date
  `)
  .single()
  .execute();
```

```typescript [Repository Pattern]
// Pagination with repository
const [users, total] = await userRepo
  .createQueryBuilder()
  .orderBy('created_at', 'DESC')
  .limit(10)
  .offset(0)
  .getManyAndCount();

// Full-text search with repository
const searchResults = await userRepo
  .createQueryBuilder()
  .where('name ILIKE :search', { search: '%john%' })
  .orWhere('email ILIKE :search', { search: '%john%' })
  .getMany();

// Complex filtering
const complexQuery = await userRepo
  .createQueryBuilder()
  .where('active = :active', { active: true })
  .andWhere('created_at >= :date', { date: '2024-01-01' })
  .andWhere('role IN (:...roles)', { roles: ['admin', 'moderator'] })
  .orderBy('name', 'ASC')
  .getMany();
```

:::

## Error Handling

```typescript
// PostgREST syntax error handling
try {
  const { data: user, error } = await client
    .from('users')
    .select('*')
    .eq('id', 999)
    .single()
    .execute();
    
  if (error) {
    console.error('Database error:', error);
  } else {
    console.log('User found:', user);
  }
} catch (err) {
  console.error('Network error:', err);
}

// Repository pattern error handling
try {
  const user = await userRepo.findOne({ id: 999 });
  if (!user) {
    console.log('User not found');
  }
} catch (error) {
  if (error.name === 'PostgrestError') {
    console.error('Database error:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Real-world Example: User Management System

```typescript
class UserService {
  private userRepo = client.getRepository<User>('users');

  // Get active users with pagination
  async getActiveUsers(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    return await this.userRepo
      .createQueryBuilder()
      .where('active = :active', { active: true })
      .orderBy('created_at', 'DESC')
      .limit(limit)
      .offset(offset)
      .getManyAndCount();
  }

  // Search users by name or email
  async searchUsers(query: string) {
    return await this.userRepo
      .createQueryBuilder()
      .where('name ILIKE :query', { query: `%${query}%` })
      .orWhere('email ILIKE :query', { query: `%${query}%` })
      .andWhere('active = :active', { active: true })
      .getMany();
  }

  // Create user with validation
  async createUser(userData: Partial<User>) {
    // Check if email already exists
    const existingUser = await this.userRepo.findOne({ 
      email: userData.email 
    });
    
    if (existingUser) {
      throw new Error('Email already exists');
    }

    return await this.userRepo.save({
      ...userData,
      created_at: new Date().toISOString()
    });
  }

  // Update user profile
  async updateUser(id: number, updates: Partial<User>) {
    const user = await this.userRepo.findOne({ id });
    
    if (!user) {
      throw new Error('User not found');
    }

    return await this.userRepo.save({
      ...user,
      ...updates,
      updated_at: new Date().toISOString()
    });
  }

  // Soft delete user
  async deactivateUser(id: number) {
    return await this.userRepo.update(
      { id },
      { active: false, updated_at: new Date().toISOString() }
    );
  }
}

// Usage
const userService = new UserService();

// Get paginated active users
const [users, total] = await userService.getActiveUsers(1, 20);

// Search for users
const searchResults = await userService.searchUsers('john');

// Create new user
const newUser = await userService.createUser({
  name: 'Jane Doe',
  email: 'jane@example.com',
  role: 'user',
  active: true
});
```

## Advanced Examples: Combining All Features

Here are practical examples that combine relations, aliases, and multiple sort orders:

```typescript
// E-commerce: Products with categories and reviews
const getProductCatalog = async () => {
  return client
    .from('products')
    .select([
      'id AS product_id',
      'name AS product_name',
      'price AS current_price',
      'category.name AS category_name',
      'reviews.rating AS review_rating',
      'reviews.count AS review_count'
    ])
    .relations(['category', 'reviews'])
    .eq('active', true)
    .order('category.name')                    // Group by category
    .order('reviews.rating', { ascending: false })  // Best rated first
    .order('price')                            // Cheapest first
    .execute();
};

// Blog: Posts with authors and comments
const getBlogPosts = async () => {
  return client
    .from('posts')
    .select([
      'id AS post_id',
      'title AS post_title',
      'created_at AS published_date',
      'author.name AS author_name',
      'author.email AS author_contact',
      'comments.content AS comment_text',
      'comments.created_at AS comment_date'
    ])
    .relations(['author', 'comments'])
    .eq('published', true)
    .order('created_at', { ascending: false })     // Latest posts first
    .order('comments.created_at', { ascending: false })  // Latest comments first
    .execute();
};

// User Management: Users with profiles and recent activity
const getUserDashboard = async () => {
  return client
    .from('users')
    .select([
      'id AS user_id',
      'name AS display_name',
      'email AS contact_email',
      'created_at AS joined_date',
      'profile.bio AS user_bio',
      'profile.avatar_url AS profile_image',
      'activity.action AS recent_action',
      'activity.created_at AS activity_date'
    ])
    .relations(['profile', 'activity'])
    .eq('active', true)
    .order('activity.created_at', { ascending: false })  // Recent activity first
    .order('created_at', { ascending: false })     // Newest users first
    .order('name')                                 // Alphabetical fallback
    .limit(50)
    .execute();
};

// Repository Pattern: Complex business queries
const userRepo = client.getRepository<User>('users');

const getTeamDirectory = async () => {
  return userRepo
    .createQueryBuilder()
    .select([
      'id AS employee_id',
      'first_name AS firstName',
      'last_name AS lastName',
      'email AS workEmail',
      'department.name AS dept_name',
      'manager.first_name AS manager_firstName',
      'manager.last_name AS manager_lastName'
    ])
    .relations(['department', 'manager'])
    .where('active = :active', { active: true })
    .orderBy('department.name', 'ASC')             // Group by department
    .addOrderBy('manager.last_name', 'ASC')        // Then by manager
    .addOrderBy('last_name', 'ASC')                // Then alphabetical
    .addOrderBy('first_name', 'ASC')               // Finally by first name
    .getMany();
};
```

## Best Practices

### Type Safety
```typescript
// Always define your types
interface User {
  id: number;
  name: string;
  email: string;
  // ... other fields
}

// Use generics for type safety
const userRepo = client.getRepository<User>('users');
const user = await userRepo.findOne({ id: 1 }); // Type: User | null
```

### Error Handling
```typescript
// Always handle errors appropriately
try {
  const result = await userRepo.find();
  return result;
} catch (error) {
  console.error('Failed to fetch users:', error);
  throw error; // Re-throw or handle appropriately
}
```

### Performance Optimization
```typescript
// Select only needed fields
const users = await client
  .from('users')
  .select('id, name, email') // Don't select unnecessary fields
  .execute();

// Use pagination for large datasets
const paginatedUsers = await userRepo
  .createQueryBuilder()
  .limit(50) // Reasonable page size
  .offset(page * 50)
  .getMany();

// Use caching for frequently accessed data
const client = createClient({
  cache: {
    enabled: true,
    ttl: 300000 // 5 minutes
  }
});
```

### Security Considerations
```typescript
// Validate input parameters
function validateUserId(id: unknown): number {
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error('Invalid user ID');
  }
  return userId;
}

// Use parameterized queries to prevent injection
const users = await userRepo
  .createQueryBuilder()
  .where('name = :name', { name: userInput }) // Safe parameterized query
  .getMany();
```

This example demonstrates:
- ✅ Both PostgREST native syntax and repository patterns
- ✅ Complete CRUD operations with both approaches
- ✅ Advanced querying techniques
- ✅ Proper error handling
- ✅ Real-world service architecture
- ✅ Type safety best practices
- ✅ Performance optimization tips
- ✅ Security considerations