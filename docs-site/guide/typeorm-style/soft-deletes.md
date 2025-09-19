# Soft Deletes

PGRestify supports soft deletes, a pattern where records are marked as deleted instead of being physically removed from the database. This approach preserves data for audit trails, recovery, and maintaining referential integrity while hiding deleted records from normal queries.

## Overview

Soft delete features in PGRestify include:

- **Automatic Soft Delete Support**: Built-in methods in Repository pattern
- **Deleted Record Filtering**: Automatic exclusion of soft-deleted records
- **Restore Functionality**: Ability to restore soft-deleted records
- **Audit Trail**: Maintain complete history of record changes
- **Custom Deleted Column**: Flexible column naming and types
- **Query Builder Integration**: Advanced querying with soft delete awareness

## Setting Up Soft Deletes

### Database Schema

Add a `deleted_at` column to tables that need soft delete support:

```sql
-- Add soft delete column to existing table
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Or include in initial table creation
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id),
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL -- Soft delete column
);

-- Create index for soft delete queries
CREATE INDEX idx_posts_deleted_at ON posts(deleted_at) WHERE deleted_at IS NOT NULL;

-- Create partial index for active records (performance optimization)
CREATE INDEX idx_posts_active ON posts(author_id, published) WHERE deleted_at IS NULL;
```

### TypeScript Interface

Define interfaces that include the soft delete column:

```typescript
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null; // Soft delete column
}

interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null; // Soft delete column
}
```

## Basic Soft Delete Operations

### Soft Deleting Records

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient({ url: 'http://localhost:3000' });
const dataManager = client.dataManager;
const userRepository = dataManager.getRepository<User>('users');

async function softDeleteOperations() {
  // Soft delete a single user by ID
  const softDeletedUsers = await userRepository.softDelete({ 
    id: 'user-123' 
  });
  
  console.log('Soft deleted users:', softDeletedUsers.length);
  
  // Soft delete multiple users by condition
  const inactiveUsers = await userRepository.softDelete({ 
    active: false 
  });
  
  console.log('Soft deleted inactive users:', inactiveUsers.length);
  
  // Soft delete users by email domain
  const result = await userRepository
    .getQueryBuilder()
    .update({ deleted_at: new Date().toISOString() })
    .like('email', '%@oldcompany.com')
    .is('deleted_at', null) // Only delete non-deleted records
    .execute();
  
  console.log('Soft deleted company users:', result.data?.length || 0);
}
```

### Restoring Soft Deleted Records

```typescript
async function restoreOperations() {
  // Restore a specific user
  const restoredUsers = await userRepository.restore({ 
    id: 'user-123' 
  });
  
  console.log('Restored users:', restoredUsers.length);
  
  // Restore users deleted within the last 24 hours
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const recentlyDeleted = await userRepository
    .getQueryBuilder()
    .update({ deleted_at: null })
    .gte('deleted_at', yesterday.toISOString())
    .execute();
  
  console.log('Restored recently deleted users:', recentlyDeleted.data?.length || 0);
  
  // Restore all soft deleted posts by a specific author
  const postRepository = dataManager.getRepository<Post>('posts');
  const restoredPosts = await postRepository.restore({ 
    author_id: 'user-123' 
  });
  
  console.log('Restored author posts:', restoredPosts.length);
}
```

## Querying with Soft Deletes

### Excluding Soft Deleted Records

By default, you need to manually exclude soft-deleted records:

```typescript
async function queryingWithSoftDeletes() {
  // Query only non-deleted users
  const activeUsers = await userRepository
    .getQueryBuilder()
    .select('*')
    .is('deleted_at', null) // Exclude soft deleted
    .eq('active', true)
    .execute();
  
  // Query with findBy (manual exclusion)
  const nonDeletedUsers = await userRepository
    .getQueryBuilder()
    .eq('active', true)
    .is('deleted_at', null)
    .execute();
  
  // Complex query excluding soft deleted records
  const publishedPosts = await dataManager.getRepository<Post>('posts')
    .getQueryBuilder()
    .select('id, title, content, author_id, created_at')
    .eq('published', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20)
    .execute();
  
  console.log('Query results:', {
    activeUsers: activeUsers.data?.length,
    nonDeletedUsers: nonDeletedUsers.data?.length,
    publishedPosts: publishedPosts.data?.length
  });
}
```

### Including Soft Deleted Records

Sometimes you need to query all records, including soft deleted ones:

```typescript
async function queryingIncludingSoftDeleted() {
  // Query all users including soft deleted
  const allUsers = await userRepository.find();
  
  // Query only soft deleted users
  const softDeletedUsers = await userRepository
    .getQueryBuilder()
    .select('*')
    .not('deleted_at', 'is', null) // Only soft deleted
    .execute();
  
  // Query with soft delete status
  const usersWithDeleteStatus = await userRepository
    .getQueryBuilder()
    .select(`
      id,
      email,
      first_name,
      last_name,
      deleted_at,
      CASE 
        WHEN deleted_at IS NULL THEN false 
        ELSE true 
      END as is_deleted
    `)
    .execute();
  
  console.log('Query results:', {
    allUsers: allUsers.length,
    softDeletedUsers: softDeletedUsers.data?.length,
    usersWithStatus: usersWithDeleteStatus.data?.length
  });
}
```

## Advanced Soft Delete Patterns

### Custom Soft Delete Repository

Create a repository with built-in soft delete awareness:

```typescript
class SoftDeleteRepository<T extends { deleted_at?: string | null }> extends Repository<T> {
  /**
   * Find records excluding soft deleted by default
   */
  async findActive(): Promise<T[]> {
    const result = await this.getQueryBuilder()
      .is('deleted_at', null)
      .execute();
    
    return result.data || [];
  }
  
  /**
   * Find records including soft deleted
   */
  async findWithDeleted(): Promise<T[]> {
    return this.find(); // Regular find includes all records
  }
  
  /**
   * Find only soft deleted records
   */
  async findDeleted(): Promise<T[]> {
    const result = await this.getQueryBuilder()
      .not('deleted_at', 'is', null)
      .execute();
    
    return result.data || [];
  }
  
  /**
   * Find by conditions excluding soft deleted
   */
  async findActiveBy(where: Partial<T>): Promise<T[]> {
    let query = this.getQueryBuilder().is('deleted_at', null);
    
    for (const [key, value] of Object.entries(where)) {
      query = query.eq(key as keyof T, value);
    }
    
    const result = await query.execute();
    return result.data || [];
  }
  
  /**
   * Count active (non-deleted) records
   */
  async countActive(where?: Partial<T>): Promise<number> {
    let query = this.getQueryBuilder().is('deleted_at', null);
    
    if (where) {
      for (const [key, value] of Object.entries(where)) {
        query = query.eq(key as keyof T, value);
      }
    }
    
    return query.getCount();
  }
  
  /**
   * Soft delete with additional metadata
   */
  async softDeleteWithReason(where: Partial<T>, reason?: string, deletedBy?: string): Promise<T[]> {
    const updateData: any = {
      deleted_at: new Date().toISOString()
    };
    
    if (reason) updateData.deletion_reason = reason;
    if (deletedBy) updateData.deleted_by = deletedBy;
    
    return this.update(where, updateData);
  }
  
  /**
   * Permanent delete (hard delete)
   */
  async hardDelete(where: Partial<T>): Promise<T[]> {
    return this.delete(where);
  }
}

// Usage
class UserSoftDeleteRepository extends SoftDeleteRepository<User> {
  async findActiveAdmins(): Promise<User[]> {
    return this.findActiveBy({ role: 'admin' } as Partial<User>);
  }
  
  async deactivateInactiveUsers(days: number = 90): Promise<User[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const result = await this.getQueryBuilder()
      .update({ deleted_at: new Date().toISOString() })
      .is('deleted_at', null) // Only active users
      .lt('last_login', cutoffDate.toISOString())
      .execute();
    
    return result.data || [];
  }
}

// Register custom repository
const userRepo = dataManager.getCustomRepository(UserSoftDeleteRepository, 'users');

// Use enhanced methods
const activeUsers = await userRepo.findActive();
const deletedUsers = await userRepo.findDeleted();
const activeAdmins = await userRepo.findActiveAdmins();
```

### Soft Delete with Audit Information

Enhance soft deletes with audit information:

```typescript
interface AuditableUser extends User {
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_reason?: string | null;
}

class AuditableSoftDeleteRepository<T extends { 
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_reason?: string | null;
}> extends SoftDeleteRepository<T> {
  
  async auditedSoftDelete(
    where: Partial<T>, 
    auditInfo: {
      deletedBy: string;
      reason?: string;
    }
  ): Promise<T[]> {
    return this.update(where, {
      deleted_at: new Date().toISOString(),
      deleted_by: auditInfo.deletedBy,
      deletion_reason: auditInfo.reason || 'No reason provided'
    } as Partial<T>);
  }
  
  async getDeletionAudit(recordId: string): Promise<{
    record: T | null;
    deletionInfo: {
      deletedAt?: string;
      deletedBy?: string;
      reason?: string;
    } | null;
  }> {
    const record = await this.findById(recordId);
    
    if (!record) {
      return { record: null, deletionInfo: null };
    }
    
    return {
      record,
      deletionInfo: record.deleted_at ? {
        deletedAt: record.deleted_at,
        deletedBy: record.deleted_by || undefined,
        reason: record.deletion_reason || undefined
      } : null
    };
  }
}
```

### Cascading Soft Deletes

Handle relationships with soft deletes:

```typescript
async function cascadingSoftDeletes() {
  const userRepo = dataManager.getCustomRepository(UserSoftDeleteRepository, 'users');
  const postRepo = dataManager.getCustomRepository(SoftDeleteRepository, 'posts');
  
  // Soft delete user and cascade to their posts
  const softDeleteUserCascade = async (userId: string, deletedBy: string) => {
    try {
      // Soft delete the user
      const softDeletedUsers = await userRepo.auditedSoftDelete(
        { id: userId },
        { 
          deletedBy, 
          reason: 'Account deactivation' 
        }
      );
      
      if (softDeletedUsers.length === 0) {
        throw new Error('User not found or already deleted');
      }
      
      // Cascade soft delete to user's posts
      const softDeletedPosts = await postRepo.softDelete({ 
        author_id: userId 
      });
      
      return {
        user: softDeletedUsers[0],
        postsDeleted: softDeletedPosts.length
      };
      
    } catch (error) {
      console.error('Cascading soft delete failed:', error);
      throw error;
    }
  };
  
  const result = await softDeleteUserCascade('user-123', 'admin-456');
  console.log('Cascade result:', result);
}
```

## Soft Delete with RLS (Row Level Security)

Integrate soft deletes with PostgreSQL RLS policies:

```sql
-- RLS policies that respect soft deletes
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can only see non-deleted users (except admins)
CREATE POLICY users_select_active ON users
    FOR SELECT
    USING (
        deleted_at IS NULL OR 
        auth.role() = 'admin'
    );

-- Users can only update non-deleted records they own
CREATE POLICY users_update_own_active ON users
    FOR UPDATE
    USING (
        auth.uid() = id AND 
        deleted_at IS NULL
    )
    WITH CHECK (
        auth.uid() = id AND 
        deleted_at IS NULL
    );

-- Only admins can perform soft deletes
CREATE POLICY users_soft_delete_admin ON users
    FOR UPDATE
    USING (
        auth.role() = 'admin' AND
        deleted_at IS NULL
    )
    WITH CHECK (
        auth.role() = 'admin' AND
        deleted_at IS NOT NULL
    );

-- Similar policies for posts
CREATE POLICY posts_select_active ON posts
    FOR SELECT
    USING (
        (deleted_at IS NULL AND published = true) OR
        (deleted_at IS NULL AND auth.uid() = author_id) OR
        auth.role() = 'admin'
    );
```

## Performance Considerations

### Indexing Strategy

```sql
-- Partial indexes for better performance
CREATE INDEX idx_users_active ON users(email, active) WHERE deleted_at IS NULL;
CREATE INDEX idx_posts_published_active ON posts(published, created_at) WHERE deleted_at IS NULL;

-- Index for soft deleted records (for audit queries)
CREATE INDEX idx_users_deleted ON users(deleted_at, deleted_by) WHERE deleted_at IS NOT NULL;

-- Composite indexes for common query patterns
CREATE INDEX idx_posts_author_active ON posts(author_id, published) WHERE deleted_at IS NULL;
```

### Query Optimization

```typescript
async function optimizedSoftDeleteQueries() {
  // Use partial indexes effectively
  const activePublishedPosts = await dataManager.getRepository<Post>('posts')
    .getQueryBuilder()
    .select('id, title, created_at, author_id')
    .eq('published', true)
    .is('deleted_at', null) // Uses partial index
    .order('created_at', { ascending: false })
    .limit(50)
    .execute();
  
  // Efficient counting with partial indexes
  const activeUserCount = await userRepository
    .getQueryBuilder()
    .is('deleted_at', null)
    .getCount();
  
  // Bulk operations on active records
  const updatedUsers = await userRepository
    .getQueryBuilder()
    .update({ last_activity_check: new Date().toISOString() })
    .is('deleted_at', null)
    .gte('last_login', '2024-01-01')
    .execute();
  
  console.log('Optimized queries completed:', {
    posts: activePublishedPosts.data?.length,
    activeUsers: activeUserCount,
    updated: updatedUsers.data?.length
  });
}
```

## Cleanup and Maintenance

### Permanent Deletion of Old Soft Deleted Records

```typescript
async function cleanupOldSoftDeletes() {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 6); // 6 months ago
  
  // Hard delete users soft deleted more than 6 months ago
  const permanentlyDeleted = await userRepository
    .getQueryBuilder()
    .delete()
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoffDate.toISOString())
    .execute();
  
  console.log(`Permanently deleted ${permanentlyDeleted.data?.length || 0} old records`);
  
  // Archive before permanent deletion (optional)
  const toArchive = await userRepository
    .getQueryBuilder()
    .select('*')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoffDate.toISOString())
    .execute();
  
  if (toArchive.data && toArchive.data.length > 0) {
    // Archive to separate table or export to file
    console.log(`Archiving ${toArchive.data.length} records before permanent deletion`);
  }
}
```

### Statistics and Monitoring

```typescript
async function softDeleteStatistics() {
  const userStats = await userRepository
    .getQueryBuilder()
    .select(`
      COUNT(*) as total_users,
      COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_users,
      COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted_users,
      COUNT(CASE WHEN deleted_at > NOW() - INTERVAL '7 days' THEN 1 END) as recently_deleted
    `)
    .execute();
  
  console.log('User statistics:', userStats.data?.[0]);
  
  // Deletion activity over time
  const deletionActivity = await userRepository
    .getQueryBuilder()
    .select(`
      DATE(deleted_at) as deletion_date,
      COUNT(*) as deletions_count,
      deleted_by
    `)
    .not('deleted_at', 'is', null)
    .gte('deleted_at', '2024-01-01')
    .order('deletion_date', { ascending: false })
    .execute();
  
  console.log('Recent deletion activity:', deletionActivity.data);
}
```

## Summary

PGRestify's soft delete support provides:

- **Built-in Repository Methods**: `softDelete()` and `restore()` methods
- **Flexible Schema Design**: Support for custom deleted columns and audit fields
- **Custom Repository Classes**: Enhanced repositories with soft delete awareness
- **Performance Optimization**: Proper indexing strategies for soft delete queries
- **RLS Integration**: Row Level Security policies that respect soft delete status
- **Audit Trail**: Track who deleted what and when
- **Cleanup Utilities**: Tools for managing old soft deleted records

Soft deletes are essential for applications requiring data retention, audit trails, and the ability to recover accidentally deleted records while maintaining good performance and data integrity.