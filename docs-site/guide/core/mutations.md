# Mutations

Learn how to create, update, and delete data using PGRestify's mutation operations.

## Overview

Mutations in PGRestify handle all data modification operations including inserting new records, updating existing ones, and deleting data. The library provides a type-safe, intuitive API that maps directly to PostgREST's capabilities while maintaining consistency with the query building patterns.

## Insert Operations

### Basic Inserts

Create new records using the `insert()` method:

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000'
});

// Insert a single record
const newUser = await client
  .from('users')
  .insert({
    name: 'John Doe',
    email: 'john@example.com',
    active: true
  })
  .select('*')
  .single()
  .execute();

console.log('Created user:', newUser.data);
```

### Bulk Inserts

Insert multiple records in a single operation:

```typescript
// Insert multiple users at once
const newUsers = await client
  .from('users')
  .insert([
    {
      name: 'Alice Smith',
      email: 'alice@example.com',
      active: true
    },
    {
      name: 'Bob Johnson',
      email: 'bob@example.com', 
      active: false
    },
    {
      name: 'Carol White',
      email: 'carol@example.com',
      active: true
    }
  ])
  .select('*')
  .execute();

console.log(`Created ${newUsers.data.length} users`);
```

### Insert with Return Specification

Control which columns are returned after insertion:

```typescript
// Return only specific columns
const user = await client
  .from('users')
  .insert({
    name: 'Jane Doe',
    email: 'jane@example.com',
    password_hash: 'hashed_password'
  })
  .select('id, name, email, created_at') // Don't return password_hash
  .single()
  .execute();

// Return all columns except sensitive ones
const userWithoutSensitive = await client
  .from('users')
  .insert(userData)
  .select('*, -password_hash, -reset_token')
  .single()
  .execute();
```

## Update Operations

### Basic Updates

Update existing records using the `update()` method combined with filters:

```typescript
// Update a specific user
const updatedUser = await client
  .from('users')
  .update({
    name: 'John Smith',
    updated_at: new Date().toISOString()
  })
  .eq('id', 123)
  .select('*')
  .single()
  .execute();

console.log('Updated user:', updatedUser.data);
```

### Conditional Updates

Update records based on multiple conditions:

```typescript
// Update users with specific criteria
const updatedUsers = await client
  .from('users')
  .update({
    active: false,
    deactivated_at: new Date().toISOString()
  })
  .eq('active', true)
  .lt('last_login', '2023-01-01')
  .select('id, name, email')
  .execute();

console.log(`Deactivated ${updatedUsers.data.length} inactive users`);
```

### Partial Updates

Update only specific fields while preserving others:

```typescript
// Update user profile information
const updateProfile = async (userId: number, profileData: Partial<UserProfile>) => {
  const validFields = ['bio', 'avatar_url', 'location', 'website'];
  const updateData: any = {};
  
  // Only include provided fields
  Object.keys(profileData).forEach(key => {
    if (validFields.includes(key) && profileData[key] !== undefined) {
      updateData[key] = profileData[key];
    }
  });

  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid fields to update');
  }

  return client
    .from('user_profiles')
    .update(updateData)
    .eq('user_id', userId)
    .select('*')
    .single()
    .execute();
};

// Usage
const updated = await updateProfile(123, {
  bio: 'New bio text',
  location: 'New York'
  // other fields remain unchanged
});
```

### Increment/Decrement Operations

Update numeric fields with relative values:

```typescript
// Increment view count
const incrementViews = await client
  .from('posts')
  .update({
    view_count: client.raw('view_count + 1'),
    last_viewed: new Date().toISOString()
  })
  .eq('id', postId)
  .select('id, view_count')
  .single()
  .execute();

// Decrement inventory
const updateInventory = await client
  .from('products')
  .update({
    stock_quantity: client.raw('stock_quantity - ?', [orderQuantity])
  })
  .eq('id', productId)
  .select('id, stock_quantity')
  .single()
  .execute();
```

## Delete Operations

### Basic Deletes

Remove records using the `delete()` method:

```typescript
// Delete a specific record
const deletedUser = await client
  .from('users')
  .delete()
  .eq('id', 123)
  .select('id, name') // Return info about deleted record
  .single()
  .execute();

console.log('Deleted user:', deletedUser.data);
```

### Conditional Deletes

Delete multiple records based on criteria:

```typescript
// Delete inactive users
const deletedUsers = await client
  .from('users')
  .delete()
  .eq('active', false)
  .lt('created_at', '2023-01-01')
  .select('id, name, email')
  .execute();

console.log(`Deleted ${deletedUsers.data.length} inactive users`);

// Soft delete pattern
const softDeleteUsers = await client
  .from('users')
  .update({
    deleted_at: new Date().toISOString(),
    active: false
  })
  .eq('active', false)
  .is('deleted_at', null)
  .select('id')
  .execute();
```

### Cascading Deletes

Handle related data when deleting records:

```typescript
// Delete user and all related data
const deleteUserCompletely = async (userId: number) => {
  try {
    // Delete in order: dependent tables first
    await client.from('user_sessions').delete().eq('user_id', userId).execute();
    await client.from('user_profiles').delete().eq('user_id', userId).execute();
    await client.from('posts').delete().eq('user_id', userId).execute();
    
    // Finally delete the user
    const deletedUser = await client
      .from('users')
      .delete()
      .eq('id', userId)
      .select('id, name, email')
      .single()
      .execute();
      
    return deletedUser.data;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};
```

## Upsert Operations

### Basic Upserts

Insert new records or update existing ones based on unique constraints:

```typescript
// Upsert user (insert if new, update if exists)
const upsertedUser = await client
  .from('users')
  .upsert({
    email: 'user@example.com', // Unique constraint
    name: 'Updated Name',
    active: true,
    updated_at: new Date().toISOString()
  })
  .select('*')
  .single()
  .execute();

console.log('Upserted user:', upsertedUser.data);
```

### Upsert with Conflict Resolution

Control how conflicts are handled during upserts:

```typescript
// Upsert with specific conflict resolution
const upsertWithConflict = await client
  .from('user_settings')
  .upsert({
    user_id: 123,
    theme: 'dark',
    notifications: true,
    updated_at: new Date().toISOString()
  }, {
    onConflict: 'user_id', // Specify conflict column
    ignoreDuplicates: false
  })
  .select('*')
  .single()
  .execute();
```

### Bulk Upserts

Perform upserts on multiple records:

```typescript
// Bulk upsert user preferences
const bulkUpsert = await client
  .from('user_preferences')
  .upsert([
    { user_id: 1, preference: 'theme', value: 'dark' },
    { user_id: 1, preference: 'language', value: 'en' },
    { user_id: 2, preference: 'theme', value: 'light' },
    { user_id: 2, preference: 'language', value: 'es' }
  ], {
    onConflict: 'user_id,preference'
  })
  .select('*')
  .execute();
```

## Transaction Patterns

### Manual Transactions

Group multiple mutations into transactions:

```typescript
// Transfer between accounts (requires transaction)
const transferFunds = async (fromAccountId: number, toAccountId: number, amount: number) => {
  const transaction = client.transaction();
  
  try {
    // Debit from source account
    await transaction
      .from('accounts')
      .update({
        balance: client.raw('balance - ?', [amount]),
        updated_at: new Date().toISOString()
      })
      .eq('id', fromAccountId)
      .execute();

    // Credit to destination account
    await transaction
      .from('accounts')
      .update({
        balance: client.raw('balance + ?', [amount]),
        updated_at: new Date().toISOString()
      })
      .eq('id', toAccountId)
      .execute();

    // Record transaction
    await transaction
      .from('transactions')
      .insert({
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: amount,
        type: 'transfer',
        created_at: new Date().toISOString()
      })
      .execute();

    // Commit transaction
    await transaction.commit();
    
    return { success: true };
  } catch (error) {
    // Rollback on error
    await transaction.rollback();
    throw error;
  }
};
```

### Optimistic Concurrency

Handle concurrent updates with version control:

```typescript
// Update with version checking
const updateWithVersionControl = async (recordId: number, updates: any, currentVersion: number) => {
  const updated = await client
    .from('documents')
    .update({
      ...updates,
      version: currentVersion + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', recordId)
    .eq('version', currentVersion) // Ensure version hasn't changed
    .select('*')
    .single()
    .execute();

  if (!updated.data) {
    throw new Error('Document was modified by another user. Please refresh and try again.');
  }

  return updated.data;
};
```

## Error Handling in Mutations

### Constraint Violations

Handle database constraint errors gracefully:

```typescript
import { PGRestifyError } from '@webcoded/pgrestify';

const createUserWithValidation = async (userData: any) => {
  try {
    const newUser = await client
      .from('users')
      .insert(userData)
      .select('*')
      .single()
      .execute();
      
    return { success: true, data: newUser.data };
  } catch (error) {
    if (error instanceof PGRestifyError) {
      switch (error.code) {
        case '23505': // Unique violation
          return { 
            success: false, 
            error: 'Email address already exists' 
          };
        case '23502': // Not null violation
          return { 
            success: false, 
            error: 'Required field is missing' 
          };
        case '23514': // Check constraint violation
          return { 
            success: false, 
            error: 'Invalid data provided' 
          };
        default:
          return { 
            success: false, 
            error: `Database error: ${error.message}` 
          };
      }
    }
    throw error; // Re-throw unexpected errors
  }
};
```

### Validation Before Mutations

Validate data before sending to database:

```typescript
interface UserInput {
  name: string;
  email: string;
  age?: number;
}

const validateAndCreateUser = async (input: UserInput) => {
  // Client-side validation
  const errors: string[] = [];
  
  if (!input.name || input.name.length < 2) {
    errors.push('Name must be at least 2 characters long');
  }
  
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push('Valid email address is required');
  }
  
  if (input.age !== undefined && (input.age < 0 || input.age > 150)) {
    errors.push('Age must be between 0 and 150');
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }

  // Proceed with database insertion
  try {
    const result = await client
      .from('users')
      .insert(input)
      .select('*')
      .single()
      .execute();
      
    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, errors: ['Failed to create user'] };
  }
};
```

## Advanced Mutation Patterns

### Batch Operations

Perform multiple related mutations efficiently:

```typescript
// Batch create posts with tags
const createPostWithTags = async (postData: any, tagNames: string[]) => {
  // 1. Create the post
  const post = await client
    .from('posts')
    .insert(postData)
    .select('id')
    .single()
    .execute();

  if (!post.data) {
    throw new Error('Failed to create post');
  }

  // 2. Find or create tags
  const tagResults = await Promise.all(
    tagNames.map(async (tagName) => {
      // Try to find existing tag
      const existingTag = await client
        .from('tags')
        .select('id')
        .eq('name', tagName)
        .maybeSingle()
        .execute();

      if (existingTag.data) {
        return existingTag.data;
      }

      // Create new tag if it doesn't exist
      const newTag = await client
        .from('tags')
        .insert({ name: tagName })
        .select('id')
        .single()
        .execute();
        
      return newTag.data;
    })
  );

  // 3. Create post-tag relationships
  const postTags = tagResults.map(tag => ({
    post_id: post.data.id,
    tag_id: tag.id
  }));

  await client
    .from('post_tags')
    .insert(postTags)
    .execute();

  return post.data;
};
```

### Conditional Mutations

Perform mutations based on existing data:

```typescript
// Update user level based on points
const updateUserLevel = async (userId: number) => {
  // Get current user data
  const user = await client
    .from('users')
    .select('id, points, level')
    .eq('id', userId)
    .single()
    .execute();

  if (!user.data) {
    throw new Error('User not found');
  }

  // Determine new level based on points
  let newLevel = user.data.level;
  if (user.data.points >= 10000) newLevel = 5;
  else if (user.data.points >= 5000) newLevel = 4;
  else if (user.data.points >= 1000) newLevel = 3;
  else if (user.data.points >= 500) newLevel = 2;
  else newLevel = 1;

  // Update level if it changed
  if (newLevel !== user.data.level) {
    const updated = await client
      .from('users')
      .update({
        level: newLevel,
        level_updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('*')
      .single()
      .execute();

    // Log level change
    await client
      .from('user_level_history')
      .insert({
        user_id: userId,
        old_level: user.data.level,
        new_level: newLevel,
        created_at: new Date().toISOString()
      })
      .execute();

    return updated.data;
  }

  return user.data;
};
```

### Audit Trail Pattern

Automatically track changes to records:

```typescript
const updateWithAudit = async (table: string, id: number, updates: any, userId: number) => {
  // Get current record for audit trail
  const currentRecord = await client
    .from(table)
    .select('*')
    .eq('id', id)
    .single()
    .execute();

  if (!currentRecord.data) {
    throw new Error('Record not found');
  }

  // Perform the update
  const updatedRecord = await client
    .from(table)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: userId
    })
    .eq('id', id)
    .select('*')
    .single()
    .execute();

  // Create audit record
  await client
    .from('audit_log')
    .insert({
      table_name: table,
      record_id: id,
      action: 'UPDATE',
      old_values: JSON.stringify(currentRecord.data),
      new_values: JSON.stringify(updatedRecord.data),
      changed_by: userId,
      changed_at: new Date().toISOString()
    })
    .execute();

  return updatedRecord.data;
};
```

## Type-Safe Mutations

### Strongly Typed Operations

Use TypeScript interfaces for type-safe mutations:

```typescript
interface User {
  id?: number;
  name: string;
  email: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface CreateUserInput {
  name: string;
  email: string;
  active?: boolean;
}

interface UpdateUserInput {
  name?: string;
  email?: string;
  active?: boolean;
}

class UserRepository {
  constructor(private client: any) {}

  async create(input: CreateUserInput): Promise<User> {
    const result = await this.client
      .from<User>('users')
      .insert({
        ...input,
        active: input.active ?? true,
        created_at: new Date().toISOString()
      })
      .select('*')
      .single()
      .execute();

    return result.data;
  }

  async update(id: number, input: UpdateUserInput): Promise<User> {
    const result = await this.client
      .from<User>('users')
      .update({
        ...input,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single()
      .execute();

    return result.data;
  }

  async delete(id: number): Promise<User> {
    const result = await this.client
      .from<User>('users')
      .delete()
      .eq('id', id)
      .select('*')
      .single()
      .execute();

    return result.data;
  }
}

// Usage
const userRepo = new UserRepository(client);

const newUser = await userRepo.create({
  name: 'John Doe',
  email: 'john@example.com'
});

const updatedUser = await userRepo.update(newUser.id, {
  name: 'John Smith'
});
```

## Performance Optimization

### Bulk Operations

Optimize performance with batch operations:

```typescript
// Efficient bulk insert
const bulkInsertUsers = async (users: CreateUserInput[]) => {
  const batchSize = 1000;
  const results = [];

  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    
    const batchResult = await client
      .from('users')
      .insert(batch)
      .select('id, name, email')
      .execute();
      
    results.push(...batchResult.data);
    
    console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(users.length / batchSize)}`);
  }

  return results;
};
```

### Efficient Updates

Update only changed fields:

```typescript
const efficientUpdate = async (id: number, newData: Partial<User>, currentData: User) => {
  // Find only the fields that actually changed
  const changes: Partial<User> = {};
  
  Object.keys(newData).forEach(key => {
    if (newData[key] !== currentData[key]) {
      changes[key] = newData[key];
    }
  });

  // Skip update if nothing changed
  if (Object.keys(changes).length === 0) {
    return currentData;
  }

  // Add update timestamp
  changes.updated_at = new Date().toISOString();

  return client
    .from('users')
    .update(changes)
    .eq('id', id)
    .select('*')
    .single()
    .execute();
};
```

---

## Summary

Effective mutations with PGRestify involve:

- **Insert Operations**: Creating new records with proper validation and error handling
- **Update Operations**: Modifying existing records with conditional logic and concurrency control
- **Delete Operations**: Removing records safely with proper cascade handling
- **Upsert Operations**: Combining insert and update logic for flexible data management
- **Transaction Management**: Ensuring data consistency across multiple operations
- **Type Safety**: Using TypeScript for compile-time validation and better developer experience
- **Performance**: Optimizing bulk operations and avoiding unnecessary database calls
- **Error Handling**: Gracefully managing constraint violations and validation errors

The key to successful data mutations is understanding your data model, implementing proper validation, and handling edge cases gracefully while maintaining data integrity.