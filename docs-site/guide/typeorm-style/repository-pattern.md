# Repository Pattern

PGRestify implements the Repository pattern popularized by TypeORM, providing a clean, object-oriented interface for database operations. This pattern abstracts database access logic and provides a consistent API for working with your PostgREST endpoints.

## Overview

The Repository pattern in PGRestify offers:

- **TypeORM-like API**: Familiar methods for developers coming from TypeORM
- **Type Safety**: Full TypeScript support with generic types
- **Query Builder Integration**: Access to the underlying query builder when needed
- **Standardized CRUD Operations**: Consistent interface for all database operations
- **Custom Repository Support**: Extend repositories with domain-specific logic

## Basic Repository Usage

### Creating and Using Repositories

The simplest way to use repositories is through the DataManager:

```tsx
import { createClient } from 'pgrestify';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Create client and get DataManager
const client = createClient({ url: 'http://localhost:3000' });
const dataManager = client.dataManager;

// Get repository for users table
const userRepository = dataManager.getRepository<User>('users');

// Basic CRUD operations
async function userOperations() {
  // Find all users
  const allUsers = await userRepository.find();
  
  // Find users by condition
  const activeUsers = await userRepository.findBy({ active: true });
  
  // Find single user
  const user = await userRepository.findOne({ email: 'john@example.com' });
  
  // Find by ID
  const userById = await userRepository.findById('user-id-123');
  
  // Count users
  const userCount = await userRepository.count({ active: true });
  
  // Check if user exists
  const exists = await userRepository.exists({ email: 'john@example.com' });
}
```

## Repository Methods

### Query Methods

#### Finding Records

```tsx
async function queryMethods() {
  const userRepository = dataManager.getRepository<User>('users');
  
  // Find all records
  const allUsers = await userRepository.find();
  
  // Find with conditions
  const activeUsers = await userRepository.findBy({ 
    active: true,
    role: 'admin'
  });
  
  // Find single record (returns null if not found)
  const user = await userRepository.findOne({ email: 'john@example.com' });
  
  // Find single record or throw error
  try {
    const user = await userRepository.findOneOrFail({ email: 'nonexistent@example.com' });
  } catch (error) {
    console.error('User not found:', error.message);
  }
  
  // Find by ID
  const userById = await userRepository.findById('user-123');
  
  // Find by multiple IDs
  const users = await userRepository.findByIds(['user-1', 'user-2', 'user-3']);
}
```

#### Counting and Existence Checks

```tsx
async function countingMethods() {
  const userRepository = dataManager.getRepository<User>('users');
  
  // Count all records
  const totalUsers = await userRepository.count();
  
  // Count with conditions
  const activeUserCount = await userRepository.count({ active: true });
  
  // Check existence
  const userExists = await userRepository.exists({ email: 'john@example.com' });
  
  if (userExists) {
    console.log('User already exists');
  }
}
```

### Mutation Methods

#### Creating Records

```tsx
async function createOperations() {
  const userRepository = dataManager.getRepository<User>('users');
  
  // Insert single user
  const newUsers = await userRepository.insert({
    email: 'jane@example.com',
    first_name: 'Jane',
    last_name: 'Doe',
    active: true
  });
  
  console.log('Created user:', newUsers[0]);
  
  // Insert multiple users
  const multipleUsers = await userRepository.insertMany([
    {
      email: 'user1@example.com',
      first_name: 'User',
      last_name: 'One',
      active: true
    },
    {
      email: 'user2@example.com',
      first_name: 'User',
      last_name: 'Two',
      active: false
    }
  ]);
  
  console.log(`Created ${multipleUsers.length} users`);
  
  // Save (insert or update - upsert operation)
  const savedUsers = await userRepository.save({
    email: 'existing@example.com',
    first_name: 'Updated',
    last_name: 'Name',
    active: true
  });
}
```

#### Updating Records

```tsx
async function updateOperations() {
  const userRepository = dataManager.getRepository<User>('users');
  
  // Update users matching condition
  const updatedUsers = await userRepository.update(
    { active: false }, // WHERE condition
    { active: true }   // UPDATE values
  );
  
  console.log(`Activated ${updatedUsers.length} users`);
  
  // Update single user by email
  const updatedUser = await userRepository.update(
    { email: 'john@example.com' },
    { 
      first_name: 'Jonathan',
      last_name: 'Smith',
      updated_at: new Date().toISOString()
    }
  );
  
  // Bulk update with complex conditions
  const bulkUpdated = await userRepository.update(
    { role: 'user', active: true },
    { last_login: new Date().toISOString() }
  );
}
```

#### Deleting Records

```tsx
async function deleteOperations() {
  const userRepository = dataManager.getRepository<User>('users');
  
  // Hard delete users matching condition
  const deletedUsers = await userRepository.delete({ active: false });
  console.log(`Deleted ${deletedUsers.length} inactive users`);
  
  // Remove specific entity
  const userToRemove = await userRepository.findOne({ email: 'remove@example.com' });
  if (userToRemove) {
    await userRepository.remove(userToRemove);
    console.log('User removed');
  }
  
  // Clear all records (use with extreme caution!)
  // await userRepository.clear();
}
```

### Soft Delete Operations

PGRestify supports soft deletes if your database schema includes a `deleted_at` column:

```tsx
async function softDeleteOperations() {
  const userRepository = dataManager.getRepository<User>('users');
  
  // Soft delete users
  const softDeletedUsers = await userRepository.softDelete({ 
    active: false 
  });
  
  console.log(`Soft deleted ${softDeletedUsers.length} users`);
  
  // Restore soft deleted users
  const restoredUsers = await userRepository.restore({ 
    email: 'restore@example.com' 
  });
  
  console.log(`Restored ${restoredUsers.length} users`);
}
```

## Advanced Repository Patterns

### Using Query Builder

Access the underlying query builder for complex queries:

```tsx
async function complexQueries() {
  const userRepository = dataManager.getRepository<User>('users');
  
  // Get fresh query builder instance
  const queryBuilder = userRepository.getQueryBuilder();
  
  // Build complex query
  const complexQuery = queryBuilder
    .select('id, email, first_name, last_name, created_at')
    .eq('active', true)
    .in('role', ['admin', 'moderator'])
    .gte('created_at', '2024-01-01')
    .order('created_at', { ascending: false })
    .limit(50);
  
  const result = await complexQuery.execute();
  
  if (result.error) {
    throw result.error;
  }
  
  const users = result.data || [];
  console.log(`Found ${users.length} users`);
}
```

### Repository with Relations

Handle related data using PostgREST's join capabilities:

```tsx
interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  created_at: string;
}

async function handleRelations() {
  const postRepository = dataManager.getRepository<Post>('posts');
  
  // Use query builder for joins
  const postsWithAuthors = await postRepository
    .getQueryBuilder()
    .select('*, author:users!author_id(id, first_name, last_name, email)')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(20)
    .execute();
  
  if (postsWithAuthors.data) {
    postsWithAuthors.data.forEach(post => {
      console.log(`Post "${post.title}" by ${post.author.first_name} ${post.author.last_name}`);
    });
  }
}
```

### Pagination with Repository

```tsx
async function paginatedQuery() {
  const userRepository = dataManager.getRepository<User>('users');
  
  const page = 1;
  const pageSize = 20;
  const offset = (page - 1) * pageSize;
  
  // Get paginated results
  const paginatedUsers = await userRepository
    .getQueryBuilder()
    .eq('active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)
    .execute();
  
  // Get total count for pagination info
  const totalCount = await userRepository.count({ active: true });
  const totalPages = Math.ceil(totalCount / pageSize);
  
  console.log(`Page ${page} of ${totalPages} (${totalCount} total users)`);
  
  return {
    data: paginatedUsers.data || [],
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    }
  };
}
```

## Error Handling

### Repository Error Patterns

```tsx
import { PostgRESTError } from 'pgrestify';

async function errorHandling() {
  const userRepository = dataManager.getRepository<User>('users');
  
  try {
    // Operation that might fail
    const user = await userRepository.findOneOrFail({ email: 'nonexistent@example.com' });
    console.log('User found:', user);
    
  } catch (error) {
    if (error instanceof PostgRESTError) {
      // Handle PostgREST-specific errors
      switch (error.statusCode) {
        case 404:
          console.log('User not found');
          break;
        case 401:
          console.log('Unauthorized access');
          break;
        case 403:
          console.log('Forbidden - insufficient permissions');
          break;
        default:
          console.error('PostgREST error:', error.message);
      }
    } else {
      // Handle other errors
      console.error('Unexpected error:', error);
    }
  }
  
  // Safe operations with null checking
  const user = await userRepository.findOne({ email: 'maybe@example.com' });
  if (user) {
    console.log('User exists:', user.email);
  } else {
    console.log('User not found');
  }
}
```

### Validation Before Operations

```tsx
async function validatedOperations() {
  const userRepository = dataManager.getRepository<User>('users');
  
  // Check before insert
  const emailExists = await userRepository.exists({ email: 'new@example.com' });
  
  if (emailExists) {
    throw new Error('User with this email already exists');
  }
  
  // Proceed with insert
  const newUser = await userRepository.insert({
    email: 'new@example.com',
    first_name: 'New',
    last_name: 'User',
    active: true
  });
  
  // Validate update conditions
  const usersToUpdate = await userRepository.findBy({ role: 'temp' });
  
  if (usersToUpdate.length === 0) {
    console.log('No temp users found to update');
    return;
  }
  
  const updatedUsers = await userRepository.update(
    { role: 'temp' },
    { role: 'user', updated_at: new Date().toISOString() }
  );
  
  console.log(`Updated ${updatedUsers.length} temp users to regular users`);
}
```

## Performance Optimization

### Efficient Queries

```tsx
async function optimizedQueries() {
  const userRepository = dataManager.getRepository<User>('users');
  
  // Select only needed columns
  const minimalUsers = await userRepository
    .getQueryBuilder()
    .select('id, email, first_name, last_name')
    .eq('active', true)
    .limit(100)
    .execute();
  
  // Use indices effectively
  const indexedQuery = await userRepository.findBy({
    created_at: '2024-01-01' // Assuming created_at is indexed
  });
  
  // Batch operations instead of loops
  const userIds = ['id1', 'id2', 'id3', 'id4', 'id5'];
  const batchUsers = await userRepository.findByIds(userIds);
  
  // Instead of:
  // const users = [];
  // for (const id of userIds) {
  //   const user = await userRepository.findById(id);
  //   if (user) users.push(user);
  // }
}
```

## Repository Pattern Benefits

### Testability

Repositories make your code more testable by providing a clear abstraction:

```tsx
// Easy to mock for testing
interface IUserRepository {
  findBy(where: Partial<User>): Promise<User[]>;
  insert(user: Partial<User>): Promise<User[]>;
  update(where: Partial<User>, data: Partial<User>): Promise<User[]>;
}

class UserService {
  constructor(private userRepository: IUserRepository) {}
  
  async activateUser(email: string): Promise<User | null> {
    const users = await this.userRepository.findBy({ email });
    if (users.length === 0) return null;
    
    const updated = await this.userRepository.update(
      { email },
      { active: true, updated_at: new Date().toISOString() }
    );
    
    return updated[0] || null;
  }
}
```

### Domain Logic Separation

Keep business logic separate from data access:

```tsx
class UserService {
  constructor(private dataManager: DataManager) {}
  
  async createUser(userData: Partial<User>): Promise<User> {
    const userRepository = this.dataManager.getRepository<User>('users');
    
    // Business logic
    if (!userData.email || !userData.first_name) {
      throw new Error('Email and first name are required');
    }
    
    // Check uniqueness
    const exists = await userRepository.exists({ email: userData.email });
    if (exists) {
      throw new Error('User with this email already exists');
    }
    
    // Set defaults
    const userWithDefaults = {
      ...userData,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Data access
    const created = await userRepository.insert(userWithDefaults);
    return created[0];
  }
}
```

## Summary

The Repository pattern in PGRestify provides:

- **Familiar API**: TypeORM-like methods for easy adoption
- **Type Safety**: Full TypeScript support with generic repositories
- **Flexibility**: Access to underlying query builder when needed
- **Consistency**: Standardized CRUD operations across all tables
- **Testability**: Clean abstraction for unit testing
- **Performance**: Efficient operations with PostgREST

This pattern makes it easy to work with your PostgREST API using familiar object-oriented patterns while maintaining the flexibility and performance of the underlying query system.