# Deleting Records

Master data deletion in PGRestify with single deletes, bulk deletes, soft delete patterns, cascade handling, and return specifications.

## Overview

Deleting records in PGRestify provides safe and efficient data removal capabilities. You can perform single record deletion, bulk operations, implement soft deletes, handle cascading relationships, and control what data is returned. All delete operations use PostgreSQL's DELETE statement through PostgREST's API.

## Basic Record Deletion

### Single Record Delete

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000'
});

// Delete a user by ID
const deletedUser = await client
  .from('users')
  .delete()
  .eq('id', 123)
  .execute();

console.log('Deleted user:', deletedUser.data);
// Returns: [{ id: 123, name: 'John Doe', ... }] (the deleted record)
```

### Delete with Multiple Conditions

```typescript
// Delete with multiple conditions
const conditionalDelete = await client
  .from('posts')
  .delete()
  .eq('author_id', 456)
  .eq('status', 'draft')
  .lt('created_at', '2023-01-01')
  .execute();

console.log(`Deleted ${conditionalDelete.data.length} draft posts`);
```

### Type-Safe Deletion

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

// Type-safe delete with proper typing
const typedDelete = await client
  .from<User>('users')
  .delete()
  .eq('is_active', false)
  .lt('created_at', '2022-01-01')
  .execute();

// TypeScript ensures type safety for returned data
typedDelete.data.forEach(user => {
  console.log(`Deleted inactive user: ${user.name}`);
});
```

## Conditional Deletion

### Safe Existence Check

```typescript
// Delete only if record exists
const safeDelete = async (userId: number) => {
  // First check if user exists
  const user = await client
    .from('users')
    .select('id, name')
    .eq('id', userId)
    .single()
    .execute();

  if (user.error || !user.data) {
    throw new Error(`User with ID ${userId} not found`);
  }

  // Proceed with delete
  const result = await client
    .from('users')
    .delete()
    .eq('id', userId)
    .execute();

  if (result.error) {
    throw new Error(`Delete failed: ${result.error.message}`);
  }

  return user.data;
};

// Usage
try {
  const deletedUser = await safeDelete(123);
  console.log('User deleted successfully:', deletedUser.name);
} catch (error) {
  console.error('Delete failed:', error.message);
}
```

### Conditional Business Logic

```typescript
// Delete with business logic conditions
const deleteExpiredSessions = async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return client
    .from('user_sessions')
    .delete()
    .lt('last_activity', thirtyDaysAgo.toISOString())
    .eq('is_active', false)
    .execute();
};

// Delete inactive users
const deleteInactiveUsers = async () => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  return client
    .from('users')
    .delete()
    .eq('is_active', false)
    .is('last_login', null)  // Never logged in
    .lt('created_at', sixMonthsAgo.toISOString())
    .execute();
};
```

### Permission-Based Deletion

```typescript
// Delete with permission checks
const deleteUserPost = async (postId: number, userId: number) => {
  // Check if user owns the post
  const post = await client
    .from('posts')
    .select('id, author_id, title')
    .eq('id', postId)
    .single()
    .execute();

  if (post.error || !post.data) {
    throw new Error('Post not found');
  }

  if (post.data.author_id !== userId) {
    throw new Error('You can only delete your own posts');
  }

  // Proceed with delete
  const result = await client
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('author_id', userId)  // Extra safety check
    .execute();

  return result.data[0];
};
```

## Bulk Deletion

### Delete Multiple Records

```typescript
// Delete multiple records with same condition
const bulkDelete = await client
  .from('logs')
  .delete()
  .lt('created_at', '2023-01-01')
  .in('level', ['debug', 'info'])
  .execute();

console.log(`Deleted ${bulkDelete.data.length} log entries`);
```

### Batch Delete with Different Conditions

```typescript
// Delete records with different conditions
const batchDeleteDifferentConditions = async () => {
  const results = await Promise.all([
    // Delete old draft posts
    client
      .from('posts')
      .delete()
      .eq('status', 'draft')
      .lt('created_at', '2023-06-01')
      .execute(),
    
    // Delete expired tokens
    client
      .from('access_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .execute(),
    
    // Delete inactive sessions
    client
      .from('user_sessions')
      .delete()
      .eq('is_active', false)
      .lt('last_activity', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .execute()
  ]);

  return {
    drafts: results[0].data.length,
    tokens: results[1].data.length,
    sessions: results[2].data.length
  };
};
```

### Safe Bulk Delete with Limits

```typescript
// Bulk delete with safety limits
const safeBulkDelete = async (
  table: string,
  conditions: Record<string, any>,
  maxDelete = 1000
) => {
  let totalDeleted = 0;
  let batch = 0;

  while (true) {
    batch++;
    console.log(`Processing delete batch ${batch}...`);

    // Build query with conditions
    let query = client.from(table).delete();
    
    Object.entries(conditions).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    // Apply limit to prevent massive deletions
    const result = await query.limit(100).execute();

    if (result.error) {
      throw new Error(`Batch ${batch} failed: ${result.error.message}`);
    }

    totalDeleted += result.data.length;
    console.log(`Batch ${batch}: deleted ${result.data.length} records`);

    // Stop if no more records or hit limit
    if (result.data.length === 0 || totalDeleted >= maxDelete) {
      break;
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return totalDeleted;
};

// Usage
const deleted = await safeBulkDelete(
  'old_logs', 
  { level: 'debug' }, 
  5000
);
console.log(`Safely deleted ${deleted} records`);
```

## Soft Delete Patterns

### Basic Soft Delete

```typescript
// Implement soft delete instead of hard delete
const softDelete = async (table: string, id: number) => {
  return client
    .from(table)
    .update({
      deleted_at: new Date().toISOString(),
      is_deleted: true
    })
    .eq('id', id)
    .is('deleted_at', null)  // Only soft delete if not already deleted
    .execute();
};

// Soft delete with metadata
const softDeleteWithMetadata = async (
  table: string, 
  id: number, 
  deletedBy: number, 
  reason?: string
) => {
  return client
    .from(table)
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy,
      delete_reason: reason || 'User requested',
      is_deleted: true
    })
    .eq('id', id)
    .is('deleted_at', null)
    .execute();
};

// Usage
const softDeletedUser = await softDeleteWithMetadata(
  'users', 
  123, 
  456, 
  'Account deactivation requested'
);
```

### Restore Soft Deleted Records

```typescript
// Restore soft deleted records
const restoreSoftDeleted = async (table: string, id: number) => {
  return client
    .from(table)
    .update({
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      is_deleted: false,
      restored_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('is_deleted', true)
    .execute();
};

// Bulk restore
const bulkRestoreSoftDeleted = async (table: string, ids: number[]) => {
  return client
    .from(table)
    .update({
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
      is_deleted: false,
      restored_at: new Date().toISOString()
    })
    .in('id', ids)
    .eq('is_deleted', true)
    .execute();
};
```

### Permanent Delete of Soft Deleted

```typescript
// Permanently delete soft-deleted records after grace period
const permanentDeleteExpired = async (gracePeriodDays = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);

  return client
    .from('users')
    .delete()  // Hard delete
    .eq('is_deleted', true)
    .lt('deleted_at', cutoffDate.toISOString())
    .execute();
};

// Permanent delete with confirmation
const permanentDeleteWithConfirmation = async (
  table: string, 
  id: number, 
  confirmationToken: string
) => {
  // Verify confirmation token first
  const record = await client
    .from(table)
    .select('id, delete_confirmation_token, deleted_at')
    .eq('id', id)
    .eq('is_deleted', true)
    .single()
    .execute();

  if (record.error || !record.data) {
    throw new Error('Soft deleted record not found');
  }

  if (record.data.delete_confirmation_token !== confirmationToken) {
    throw new Error('Invalid confirmation token');
  }

  // Proceed with permanent deletion
  return client
    .from(table)
    .delete()
    .eq('id', id)
    .execute();
};
```

## Cascade Handling

### Manual Cascade Delete

```typescript
// Handle cascading deletes manually for better control
const deleteUserWithRelatedData = async (userId: number) => {
  try {
    // Delete in proper order to respect foreign key constraints
    
    // 1. Delete user posts comments first
    const deletedComments = await client
      .from('comments')
      .delete()
      .eq('user_id', userId)
      .execute();
    
    // 2. Delete user posts
    const deletedPosts = await client
      .from('posts')
      .delete()
      .eq('author_id', userId)
      .execute();
    
    // 3. Delete user profile
    const deletedProfile = await client
      .from('user_profiles')
      .delete()
      .eq('user_id', userId)
      .execute();
    
    // 4. Delete user sessions
    const deletedSessions = await client
      .from('user_sessions')
      .delete()
      .eq('user_id', userId)
      .execute();
    
    // 5. Finally delete the user
    const deletedUser = await client
      .from('users')
      .delete()
      .eq('id', userId)
      .execute();

    return {
      user: deletedUser.data[0],
      relatedData: {
        comments: deletedComments.data.length,
        posts: deletedPosts.data.length,
        profiles: deletedProfile.data.length,
        sessions: deletedSessions.data.length
      }
    };
  } catch (error) {
    console.error('Cascade delete failed:', error);
    throw new Error(`Failed to delete user and related data: ${error.message}`);
  }
};
```

### Soft Cascade Delete

```typescript
// Soft delete with cascading to related records
const softDeleteWithCascade = async (userId: number, deletedBy: number) => {
  const deletedAt = new Date().toISOString();
  
  try {
    // Soft delete related records
    const results = await Promise.all([
      // Soft delete user posts
      client
        .from('posts')
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
          is_deleted: true
        })
        .eq('author_id', userId)
        .is('deleted_at', null)
        .execute(),
      
      // Soft delete user comments
      client
        .from('comments')
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
          is_deleted: true
        })
        .eq('user_id', userId)
        .is('deleted_at', null)
        .execute(),
      
      // Soft delete user
      client
        .from('users')
        .update({
          deleted_at: deletedAt,
          deleted_by: deletedBy,
          is_deleted: true
        })
        .eq('id', userId)
        .is('deleted_at', null)
        .execute()
    ]);

    return {
      posts: results[0].data.length,
      comments: results[1].data.length,
      user: results[2].data.length
    };
  } catch (error) {
    console.error('Soft cascade delete failed:', error);
    throw error;
  }
};
```

### Archive Before Delete

```typescript
// Archive data before deletion
const archiveAndDelete = async (table: string, conditions: Record<string, any>) => {
  // First, get records to archive
  let query = client.from(table).select('*');
  
  Object.entries(conditions).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  const toArchive = await query.execute();
  
  if (toArchive.error || toArchive.data.length === 0) {
    return { archived: 0, deleted: 0 };
  }

  // Archive the records
  const archived = await client
    .from(`${table}_archive`)
    .insert(
      toArchive.data.map(record => ({
        ...record,
        archived_at: new Date().toISOString(),
        original_table: table
      }))
    )
    .execute();

  if (archived.error) {
    throw new Error(`Archiving failed: ${archived.error.message}`);
  }

  // Now delete the original records
  let deleteQuery = client.from(table).delete();
  
  Object.entries(conditions).forEach(([key, value]) => {
    deleteQuery = deleteQuery.eq(key, value);
  });

  const deleted = await deleteQuery.execute();

  if (deleted.error) {
    throw new Error(`Deletion failed: ${deleted.error.message}`);
  }

  return {
    archived: archived.data.length,
    deleted: deleted.data.length
  };
};
```

## Return Specifications

### Control Returned Data

```typescript
// Return all deleted fields (default)
const fullDeleteReturn = await client
  .from('users')
  .delete()
  .eq('id', 123)
  .execute();

console.log('Deleted user data:', fullDeleteReturn.data[0]);

// Return only specific fields
const limitedDeleteReturn = await client
  .from('users')
  .delete()
  .eq('id', 123)
  .select('id, name, email')
  .execute();

// Return nothing for performance
const noDeleteReturn = await client
  .from('logs')
  .delete()
  .lt('created_at', '2023-01-01')
  .select('')  // Minimal return
  .execute();

console.log(`Deleted ${noDeleteReturn.data.length} log entries`);
```

### Single Record Delete Return

```typescript
// Ensure single record delete and return
const singleDelete = await client
  .from('users')
  .delete()
  .eq('id', 123)
  .single()  // Ensures single object return
  .execute();

console.log('Deleted user:', singleDelete.data);
```

## Error Handling and Safety

### Safe Delete Operations

```typescript
interface DeleteResult<T> {
  success: boolean;
  deletedCount: number;
  deletedData?: T[];
  error?: string;
}

const safeDeleteOperation = async <T>(
  table: string,
  conditions: Record<string, any>,
  confirmDelete = false
): Promise<DeleteResult<T>> => {
  try {
    if (!confirmDelete) {
      // Dry run - show what would be deleted
      let query = client.from(table).select('*');
      
      Object.entries(conditions).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const preview = await query.execute();
      
      return {
        success: false,
        deletedCount: preview.data?.length || 0,
        deletedData: preview.data,
        error: 'Dry run - set confirmDelete=true to proceed'
      };
    }

    // Actual delete
    let deleteQuery = client.from(table).delete();
    
    Object.entries(conditions).forEach(([key, value]) => {
      deleteQuery = deleteQuery.eq(key, value);
    });

    const result = await deleteQuery.execute();

    if (result.error) {
      return {
        success: false,
        deletedCount: 0,
        error: result.error.message
      };
    }

    return {
      success: true,
      deletedCount: result.data.length,
      deletedData: result.data
    };
  } catch (error) {
    return {
      success: false,
      deletedCount: 0,
      error: error.message
    };
  }
};

// Usage
// Dry run first
const dryRun = await safeDeleteOperation('old_data', { created_at: { lt: '2023-01-01' } });
console.log(`Would delete ${dryRun.deletedCount} records`);

// Actual delete after confirmation
if (dryRun.deletedCount > 0 && confirm('Proceed with deletion?')) {
  const result = await safeDeleteOperation('old_data', 
    { created_at: { lt: '2023-01-01' } }, 
    true
  );
  console.log(`Actually deleted ${result.deletedCount} records`);
}
```

### Referential Integrity Checks

```typescript
// Check for references before deletion
const checkReferencesBeforeDelete = async (userId: number) => {
  const references = await Promise.all([
    // Check for posts
    client.from('posts').select('id').eq('author_id', userId).execute(),
    // Check for comments  
    client.from('comments').select('id').eq('user_id', userId).execute(),
    // Check for orders
    client.from('orders').select('id').eq('customer_id', userId).execute()
  ]);

  const [posts, comments, orders] = references;
  const refCounts = {
    posts: posts.data?.length || 0,
    comments: comments.data?.length || 0,
    orders: orders.data?.length || 0
  };

  const totalReferences = refCounts.posts + refCounts.comments + refCounts.orders;

  if (totalReferences > 0) {
    throw new Error(
      `Cannot delete user: has ${refCounts.posts} posts, ${refCounts.comments} comments, ${refCounts.orders} orders`
    );
  }

  // Safe to delete
  return client.from('users').delete().eq('id', userId).execute();
};
```

## Performance Optimization

### Efficient Deletion Patterns

```typescript
// Delete with index-friendly conditions
const efficientDelete = async () => {
  // Use indexed columns for better performance
  return client
    .from('logs')
    .delete()
    .gte('created_at', '2023-01-01')  // Use indexed date column
    .lte('created_at', '2023-12-31')
    .eq('level', 'debug')             // Use indexed level column
    .execute();
};

// Batch delete for large datasets
const batchDelete = async (
  table: string, 
  condition: Record<string, any>, 
  batchSize = 1000
) => {
  let totalDeleted = 0;
  
  while (true) {
    let query = client.from(table).delete().limit(batchSize);
    
    Object.entries(condition).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const result = await query.execute();
    
    if (result.error) {
      throw new Error(`Batch delete failed: ${result.error.message}`);
    }

    totalDeleted += result.data.length;
    
    if (result.data.length < batchSize) {
      break; // No more records to delete
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  return totalDeleted;
};
```

---

## Summary

PGRestify's record deletion capabilities provide:

- **Safe Deletion**: Conditional checks and existence verification
- **Bulk Operations**: Efficient multi-record deletion with safety limits
- **Soft Delete Patterns**: Reversible deletion with metadata tracking
- **Cascade Handling**: Manual and automatic relationship management
- **Return Control**: Flexible control over returned deletion data
- **Error Handling**: Comprehensive safety checks and error management
- **Performance**: Optimized batch operations and index-aware deletions
- **Referential Integrity**: Foreign key constraint handling

Master these deletion patterns to build robust data removal workflows that maintain data integrity, handle relationships properly, and provide safe, recoverable deletion operations.