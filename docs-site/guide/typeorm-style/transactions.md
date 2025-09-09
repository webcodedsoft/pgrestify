# Transactions

While PostgREST doesn't support traditional database transactions like TypeORM, PGRestify provides transaction-like patterns and coordination mechanisms to help manage complex operations across multiple tables. This guide covers the available patterns and best practices for handling multi-step operations.

## Overview

Transaction handling in PGRestify includes:

- **Pseudo-Transactions**: Coordination mechanisms that simulate transaction behavior
- **Compensating Actions**: Manual rollback patterns for failed operations
- **Atomic Operations**: Single-request operations that are naturally atomic
- **Error Handling**: Comprehensive error handling for multi-step operations
- **PostgreSQL Functions**: Using RPC calls for true database-level transactions

## PostgREST Transaction Limitations

PostgREST operates over HTTP and doesn't maintain persistent connections, which means traditional transactions aren't supported. However, there are several patterns to work around this limitation.

### What PostgREST Doesn't Support

```typescript
// ❌ This doesn't exist in PostgREST/PGRestify
const transaction = await dataManager.startTransaction();
try {
  await userRepository.save(user);
  await postRepository.save(post);
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

### What PGRestify Provides Instead

```typescript
// ✅ Pseudo-transaction with error handling and compensation
const result = await dataManager.transaction(async (manager) => {
  const userRepo = manager.getRepository<User>('users');
  const postRepo = manager.getRepository<Post>('posts');
  
  // Operations with manual rollback logic
  const user = await userRepo.insert(userData);
  try {
    const post = await postRepo.insert({ ...postData, author_id: user[0].id });
    return { user: user[0], post: post[0] };
  } catch (error) {
    // Compensating action: delete the user if post creation failed
    await userRepo.delete({ id: user[0].id });
    throw error;
  }
});
```

## Pseudo-Transaction Patterns

### Basic Pseudo-Transaction

The DataManager provides a transaction method that coordinates operations:

```typescript
import { createClient } from 'pgrestify';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  active: boolean;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  published: boolean;
}

const client = createClient({ url: 'http://localhost:3000' });
const dataManager = client.dataManager;

async function createUserWithPost(userData: Partial<User>, postData: Partial<Post>) {
  return await dataManager.transaction(async (manager) => {
    const userRepo = manager.getRepository<User>('users');
    const postRepo = manager.getRepository<Post>('posts');
    
    // Step 1: Create user
    const createdUsers = await userRepo.insert(userData);
    const user = createdUsers[0];
    
    if (!user) {
      throw new Error('Failed to create user');
    }
    
    try {
      // Step 2: Create post linked to user
      const postWithAuthor = {
        ...postData,
        author_id: user.id
      };
      
      const createdPosts = await postRepo.insert(postWithAuthor);
      const post = createdPosts[0];
      
      if (!post) {
        throw new Error('Failed to create post');
      }
      
      return { user, post };
      
    } catch (postError) {
      // Compensating action: delete the user
      try {
        await userRepo.delete({ id: user.id });
      } catch (cleanupError) {
        console.error('Failed to cleanup user after post creation failure:', cleanupError);
      }
      throw postError;
    }
  });
}
```

### Complex Multi-Table Operations

Handle operations across multiple related tables:

```typescript
interface UserProfile {
  id: string;
  user_id: string;
  bio: string;
  avatar_url: string;
}

interface UserRole {
  user_id: string;
  role: string;
  assigned_at: string;
}

async function createCompleteUser(
  userData: Partial<User>, 
  profileData: Partial<UserProfile>,
  roleData: Partial<UserRole>
) {
  const createdEntities: {
    user?: User;
    profile?: UserProfile;
    role?: UserRole;
  } = {};
  
  try {
    return await dataManager.transaction(async (manager) => {
      const userRepo = manager.getRepository<User>('users');
      const profileRepo = manager.getRepository<UserProfile>('user_profiles');
      const roleRepo = manager.getRepository<UserRole>('user_roles');
      
      // Step 1: Create user
      const users = await userRepo.insert(userData);
      createdEntities.user = users[0];
      
      if (!createdEntities.user) {
        throw new Error('Failed to create user');
      }
      
      // Step 2: Create profile
      const profileWithUserId = {
        ...profileData,
        user_id: createdEntities.user.id
      };
      
      const profiles = await profileRepo.insert(profileWithUserId);
      createdEntities.profile = profiles[0];
      
      if (!createdEntities.profile) {
        throw new Error('Failed to create user profile');
      }
      
      // Step 3: Assign role
      const roleWithUserId = {
        ...roleData,
        user_id: createdEntities.user.id,
        assigned_at: new Date().toISOString()
      };
      
      const roles = await roleRepo.insert(roleWithUserId);
      createdEntities.role = roles[0];
      
      if (!createdEntities.role) {
        throw new Error('Failed to assign user role');
      }
      
      return {
        user: createdEntities.user,
        profile: createdEntities.profile,
        role: createdEntities.role
      };
    });
    
  } catch (error) {
    // Comprehensive cleanup
    await cleanupFailedUserCreation(createdEntities);
    throw error;
  }
}

async function cleanupFailedUserCreation(entities: {
  user?: User;
  profile?: UserProfile;
  role?: UserRole;
}) {
  const userRepo = dataManager.getRepository<User>('users');
  const profileRepo = dataManager.getRepository<UserProfile>('user_profiles');
  const roleRepo = dataManager.getRepository<UserRole>('user_roles');
  
  try {
    // Clean up in reverse order
    if (entities.role && entities.user) {
      await roleRepo.delete({ user_id: entities.user.id });
    }
    
    if (entities.profile && entities.user) {
      await profileRepo.delete({ user_id: entities.user.id });
    }
    
    if (entities.user) {
      await userRepo.delete({ id: entities.user.id });
    }
    
  } catch (cleanupError) {
    console.error('Failed to cleanup entities:', cleanupError);
    // In a real application, you might want to log this for manual cleanup
  }
}
```

## Atomic Operations

### Single-Request Atomicity

Some operations are naturally atomic within PostgREST:

```typescript
async function atomicOperations() {
  const userRepo = dataManager.getRepository<User>('users');
  
  // ✅ These operations are atomic (single request)
  
  // Bulk insert - all succeed or all fail
  const users = await userRepo.insertMany([
    { email: 'user1@example.com', first_name: 'User', last_name: 'One' },
    { email: 'user2@example.com', first_name: 'User', last_name: 'Two' },
    { email: 'user3@example.com', first_name: 'User', last_name: 'Three' }
  ]);
  
  // Bulk update - all matching records updated atomically
  const updatedUsers = await userRepo.update(
    { role: 'user' },
    { active: true, updated_at: new Date().toISOString() }
  );
  
  // Upsert operation - atomic insert or update
  const upsertedUser = await userRepo.save({
    email: 'unique@example.com',
    first_name: 'Unique',
    last_name: 'User'
  });
  
  console.log('Atomic operations completed successfully');
}
```

### Query Builder Atomic Operations

```typescript
async function complexAtomicOperations() {
  const userRepo = dataManager.getRepository<User>('users');
  
  // Atomic bulk operations with conditions
  const result = await userRepo
    .getQueryBuilder()
    .update({
      active: false,
      deactivated_at: new Date().toISOString()
    })
    .lt('last_login', '2023-01-01')
    .eq('role', 'user')
    .execute();
  
  console.log(`Deactivated ${result.data?.length || 0} inactive users`);
  
  // Atomic deletion with complex conditions
  const deletedUsers = await userRepo
    .getQueryBuilder()
    .delete()
    .eq('active', false)
    .is('email', null)
    .lt('created_at', '2022-01-01')
    .execute();
  
  console.log(`Deleted ${deletedUsers.data?.length || 0} stale accounts`);
}
```

## PostgreSQL Function Transactions

For true database-level transactions, use PostgreSQL functions via RPC:

### Creating Transaction Functions

```sql
-- Create a PostgreSQL function for transactional operations
CREATE OR REPLACE FUNCTION create_user_with_posts(
  p_email TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_post_titles TEXT[]
) RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_title TEXT;
  v_result JSON;
BEGIN
  -- Start implicit transaction
  
  -- Insert user
  INSERT INTO users (email, first_name, last_name, active)
  VALUES (p_email, p_first_name, p_last_name, true)
  RETURNING id INTO v_user_id;
  
  -- Insert posts for the user
  FOREACH v_title IN ARRAY p_post_titles LOOP
    INSERT INTO posts (title, content, author_id, published)
    VALUES (
      v_title, 
      'Default content for ' || v_title,
      v_user_id,
      false
    );
  END LOOP;
  
  -- Return the created user with post count
  SELECT json_build_object(
    'user_id', v_user_id,
    'email', p_email,
    'posts_created', array_length(p_post_titles, 1)
  ) INTO v_result;
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Transaction will be automatically rolled back
    RAISE EXCEPTION 'Failed to create user with posts: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
```

### Using RPC Transactions

```typescript
interface CreateUserWithPostsArgs {
  p_email: string;
  p_first_name: string;
  p_last_name: string;
  p_post_titles: string[];
}

interface CreateUserWithPostsResult {
  user_id: string;
  email: string;
  posts_created: number;
}

async function createUserWithPostsTransactional(
  email: string,
  firstName: string,
  lastName: string,
  postTitles: string[]
) {
  try {
    // Call PostgreSQL function - this is a true database transaction
    const result = await client.rpc<CreateUserWithPostsArgs, CreateUserWithPostsResult>(
      'create_user_with_posts',
      {
        p_email: email,
        p_first_name: firstName,
        p_last_name: lastName,
        p_post_titles: postTitles
      }
    ).execute();
    
    if (result.error) {
      throw result.error;
    }
    
    console.log('User and posts created successfully:', result.data);
    return result.data;
    
  } catch (error) {
    console.error('Transaction failed (automatic rollback):', error);
    throw error;
  }
}

// Usage
const userResult = await createUserWithPostsTransactional(
  'author@example.com',
  'Jane',
  'Author',
  ['My First Post', 'Getting Started', 'Advanced Tips']
);
```

## Error Handling Patterns

### Comprehensive Error Handling

```typescript
import { PostgRESTError } from 'pgrestify';

async function robustTransactionPattern<T>(
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    const result = await operation();
    
    console.log(`Transaction completed successfully in ${Date.now() - startTime}ms`);
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error instanceof PostgRESTError) {
      console.error(`PostgREST error after ${duration}ms:`, {
        status: error.statusCode,
        message: error.message,
        details: error.details
      });
      
      // Handle specific error types
      switch (error.statusCode) {
        case 409: // Conflict (unique constraint violation)
          throw new Error('Data conflict: Record already exists');
        case 403: // Forbidden (RLS policy violation)
          throw new Error('Access denied: Insufficient permissions');
        case 400: // Bad request (data validation error)
          throw new Error('Invalid data: ' + error.message);
        default:
          throw new Error(`Database error: ${error.message}`);
      }
    } else {
      console.error(`Application error after ${duration}ms:`, error);
      throw error;
    }
  }
}

// Usage with comprehensive error handling
async function createUserSafely(userData: Partial<User>) {
  return await robustTransactionPattern(async () => {
    return await dataManager.transaction(async (manager) => {
      const userRepo = manager.getRepository<User>('users');
      
      // Validate input
      if (!userData.email || !userData.first_name) {
        throw new Error('Email and first name are required');
      }
      
      // Check if user already exists
      const existingUser = await userRepo.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('User with this email already exists');
      }
      
      // Create user
      const users = await userRepo.insert({
        ...userData,
        active: true,
        created_at: new Date().toISOString()
      });
      
      return users[0];
    });
  });
}
```

### Retry Mechanisms

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry certain errors
      if (error instanceof PostgRESTError) {
        if (error.statusCode === 400 || error.statusCode === 401 || error.statusCode === 403) {
          throw error; // Don't retry client errors
        }
      }
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      console.warn(`Attempt ${attempt} failed, retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2; // Exponential backoff
    }
  }
  
  throw lastError!;
}

// Usage with retry
async function reliableUserCreation(userData: Partial<User>) {
  return await withRetry(
    () => createUserSafely(userData),
    3, // 3 attempts
    1000 // Start with 1 second delay
  );
}
```

## Best Practices

### 1. Design for Idempotency

Make operations safe to retry:

```typescript
async function idempotentUserCreation(userData: Partial<User>) {
  const userRepo = dataManager.getRepository<User>('users');
  
  // Check if user already exists
  const existingUser = await userRepo.findOne({ email: userData.email });
  if (existingUser) {
    console.log('User already exists, returning existing user');
    return existingUser;
  }
  
  // Create new user
  const users = await userRepo.insert(userData);
  return users[0];
}
```

### 2. Use Compensating Actions

Implement manual rollback logic:

```typescript
const rollbackActions: (() => Promise<void>)[] = [];

try {
  // Step 1
  const user = await userRepo.insert(userData);
  rollbackActions.push(() => userRepo.delete({ id: user[0].id }));
  
  // Step 2
  const profile = await profileRepo.insert({ user_id: user[0].id, ...profileData });
  rollbackActions.push(() => profileRepo.delete({ id: profile[0].id }));
  
  // Step 3
  const posts = await postRepo.insertMany(postData.map(p => ({ ...p, author_id: user[0].id })));
  rollbackActions.push(() => postRepo.delete({ author_id: user[0].id }));
  
} catch (error) {
  // Execute rollback actions in reverse order
  for (const rollback of rollbackActions.reverse()) {
    try {
      await rollback();
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
  }
  throw error;
}
```

### 3. Prefer PostgreSQL Functions for Critical Transactions

For operations that must be truly atomic, use PostgreSQL functions:

```sql
CREATE OR REPLACE FUNCTION transfer_post_ownership(
  p_post_id UUID,
  p_old_owner_id UUID,
  p_new_owner_id UUID
) RETURNS JSON AS $$
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM posts 
    WHERE id = p_post_id AND author_id = p_old_owner_id
  ) THEN
    RAISE EXCEPTION 'Post not found or not owned by specified user';
  END IF;
  
  -- Verify new owner exists
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = p_new_owner_id AND active = true
  ) THEN
    RAISE EXCEPTION 'New owner not found or inactive';
  END IF;
  
  -- Transfer ownership atomically
  UPDATE posts 
  SET author_id = p_new_owner_id, updated_at = NOW()
  WHERE id = p_post_id;
  
  -- Log the transfer
  INSERT INTO ownership_transfers (post_id, old_owner_id, new_owner_id, transferred_at)
  VALUES (p_post_id, p_old_owner_id, p_new_owner_id, NOW());
  
  RETURN json_build_object(
    'success', true,
    'post_id', p_post_id,
    'transferred_to', p_new_owner_id
  );
END;
$$ LANGUAGE plpgsql;
```

## Summary

While PGRestify doesn't provide traditional transactions like TypeORM, it offers several patterns for managing complex operations:

- **Pseudo-Transactions**: Coordination mechanisms through DataManager
- **Compensating Actions**: Manual rollback patterns for error recovery
- **Atomic Operations**: Single-request operations that are naturally atomic
- **RPC Functions**: True database transactions via PostgreSQL functions
- **Error Handling**: Comprehensive error handling and retry mechanisms
- **Best Practices**: Idempotency, rollback strategies, and critical operation patterns

Choose the appropriate pattern based on your consistency requirements and the criticality of the operation.