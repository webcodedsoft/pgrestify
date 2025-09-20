# Bulk Operations

Master high-performance bulk operations in PGRestify for inserting, updating, upserting, and deleting large datasets efficiently with comprehensive error handling and conflict resolution.

## Overview

Bulk operations in PGRestify provide efficient processing of large datasets with two powerful approaches:

- **🎯 PostgREST Native Syntax**: Direct `.bulkInsert()`, `.bulkUpdate()`, `.bulkUpsert()` and `.bulkDelete()` methods
- **🏗️ ORM-Style Repository Pattern**: Repository batch methods and custom bulk operations

Both approaches maintain data integrity and provide detailed feedback on success and failure rates while offering optimized batch processing capabilities.

## Benefits of Bulk Operations

- **🚀 Performance**: Significantly faster than individual operations for large datasets
- **💾 Memory Efficient**: Process data in configurable batches to manage memory usage
- **🛡️ Error Resilient**: Continue processing despite individual record failures
- **⚖️ Conflict Resolution**: Handle duplicates with flexible strategies
- **📊 Progress Tracking**: Detailed reporting on success/failure rates
- **🔒 Type Safe**: Full TypeScript support with generic constraints

## Bulk Insert

### Basic Bulk Insert

::: code-group

```typescript [PostgREST Syntax]
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000'
});

// Define your data interface
interface User {
  id?: number;
  name: string;
  email: string;
  role: string;
  created_at?: string;
}

// Prepare data
const users: Partial<User>[] = [
  { name: 'John Doe', email: 'john@example.com', role: 'user' },
  { name: 'Jane Smith', email: 'jane@example.com', role: 'admin' },
  { name: 'Bob Johnson', email: 'bob@example.com', role: 'user' },
];

// Basic bulk insert
const result = await client
  .from<User>('users')
  .bulkInsert(users);

console.log(`Successfully inserted ${result.successful} records`);
console.log(`Failed insertions: ${result.failed}`);
console.log(`Total processed: ${result.count}`);
```

```typescript [Repository Pattern]
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000'
});

// Define your data interface
interface User {
  id?: number;
  name: string;
  email: string;
  role: string;
  created_at?: string;
}

// Get repository
const userRepo = client.getRepository<User>('users');

// Prepare data
const users: Partial<User>[] = [
  { name: 'John Doe', email: 'john@example.com', role: 'user' },
  { name: 'Jane Smith', email: 'jane@example.com', role: 'admin' },
  { name: 'Bob Johnson', email: 'bob@example.com', role: 'user' },
];

// Repository bulk insert
const result = await userRepo.bulkInsert(users);

console.log(`Successfully inserted ${result.length} records`);

// Alternative: Using insertMany method
const insertedUsers = await userRepo.insertMany(users);
console.log(`Inserted ${insertedUsers.length} users`);

// Custom repository with bulk operations
class UserRepository extends CustomRepositoryBase<User> {
  async bulkCreateUsers(userData: Partial<User>[]) {
    // Add timestamps to all users
    const usersWithTimestamps = userData.map(user => ({
      ...user,
      created_at: new Date().toISOString()
    }));

    return this.insertMany(usersWithTimestamps);
  }

  async bulkInsertWithValidation(userData: Partial<User>[]) {
    // Validate data before inserting
    const validUsers = userData.filter(user => 
      user.name && user.email && user.email.includes('@')
    );

    if (validUsers.length === 0) {
      throw new Error('No valid users to insert');
    }

    return this.insertMany(validUsers);
  }
}

const customUserRepo = client.getCustomRepository(UserRepository);
const createdUsers = await customUserRepo.bulkCreateUsers(users);
console.log(`Created ${createdUsers.length} users with custom repository`);
```

:::

### Advanced Bulk Insert with Options

::: code-group

```typescript [PostgREST Syntax]
import { BulkInsertOptions } from '@webcoded/pgrestify';

const bulkInsertOptions: BulkInsertOptions = {
  batchSize: 100,              // Process 100 records at a time
  returning: true,             // Return inserted records in result
  onConflict: 'ignore',        // Strategy: 'ignore', 'update', or 'error'
  conflictColumns: ['email']   // Columns to check for conflicts
};

const result = await client
  .from<User>('users')
  .bulkInsert(users, bulkInsertOptions);

// Result structure
console.log('Bulk Insert Result:');
console.log('- Data:', result.data);           // Inserted records (if returning: true)
console.log('- Count:', result.count);         // Total records processed
console.log('- Successful:', result.successful); // Successfully inserted
console.log('- Failed:', result.failed);       // Failed insertions
console.log('- Errors:', result.errors);       // Array of error details
```

```typescript [Repository Pattern]
import { BulkInsertOptions } from '@webcoded/pgrestify';

const userRepo = client.getRepository<User>('users');

// Repository bulk insert with options
const bulkInsertOptions: BulkInsertOptions = {
  batchSize: 100,              // Process 100 records at a time
  returning: true,             // Return inserted records in result
  onConflict: 'ignore',        // Strategy: 'ignore', 'update', or 'error'
  conflictColumns: ['email']   // Columns to check for conflicts
};

const result = await userRepo.bulkInsert(users, bulkInsertOptions);

// Repository result handling
console.log('Repository Bulk Insert Result:');
console.log('- Inserted Records:', result);  // Array of inserted records

// Alternative: Repository methods with different conflict handling
const insertWithIgnore = await userRepo.insertMany(users, {
  onConflict: 'ignore',
  conflictColumns: ['email']
});

// Custom repository with advanced options
class UserRepository extends CustomRepositoryBase<User> {
  async bulkInsertWithDuplicateHandling(userData: Partial<User>[]) {
    try {
      // Try insert without conflicts first
      return await this.insertMany(userData, { 
        onConflict: 'error' 
      });
    } catch (error) {
      // Fallback to ignore duplicates
      console.warn('Conflicts detected, ignoring duplicates');
      return await this.insertMany(userData, { 
        onConflict: 'ignore',
        conflictColumns: ['email']
      });
    }
  }

  async bulkInsertInBatches(userData: Partial<User>[], batchSize: number = 100) {
    const results = [];
    
    for (let i = 0; i < userData.length; i += batchSize) {
      const batch = userData.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}...`);
      
      const batchResult = await this.insertMany(batch, {
        onConflict: 'ignore',
        conflictColumns: ['email']
      });
      
      results.push(...batchResult);
    }
    
    return results;
  }

  async upsertUsers(userData: Partial<User>[]) {
    // Repository-style upsert using save
    const results = [];
    
    for (const user of userData) {
      try {
        const savedUser = await this.save(user);
        results.push(savedUser);
      } catch (error) {
        console.warn(`Failed to upsert user ${user.email}:`, error);
      }
    }
    
    return results;
  }
}

const customUserRepo = client.getCustomRepository(UserRepository);

// Usage examples
const insertResult = await customUserRepo.bulkInsertWithDuplicateHandling(users);
console.log(`Inserted ${insertResult.length} users with duplicate handling`);

const batchResult = await customUserRepo.bulkInsertInBatches(users, 50);
console.log(`Batch processed ${batchResult.length} users`);
```

:::

### Large Dataset Bulk Insert

```typescript
// Handle very large datasets efficiently
const insertLargeDataset = async (data: Partial<User>[]) => {
  const batchSize = 1000;
  const results = [];
  
  console.log(`Starting bulk insert of ${data.length} records...`);
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}...`);
    
    const result = await client
      .from<User>('users')
      .bulkInsert(batch, {
        batchSize: 100,  // Internal batch processing
        returning: false, // Don't return data for memory efficiency
        onConflict: 'ignore',
        conflictColumns: ['email']
      });
    
    results.push(result);
    console.log(`Batch completed: ${result.successful} successful, ${result.failed} failed`);
  }
  
  // Calculate totals
  const totals = results.reduce((acc, result) => ({
    successful: acc.successful + result.successful,
    failed: acc.failed + result.failed,
    count: acc.count + result.count
  }), { successful: 0, failed: 0, count: 0 });
  
  console.log(`Total: ${totals.successful} successful, ${totals.failed} failed`);
  return totals;
};

// Usage
const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: i % 10 === 0 ? 'admin' : 'user'
}));

const result = await insertLargeDataset(largeDataset);
```

### Conflict Resolution Strategies

```typescript
// Strategy 1: Ignore conflicts (skip duplicates)
const ignoreConflicts = await client
  .from<User>('users')
  .bulkInsert(users, {
    onConflict: 'ignore',
    conflictColumns: ['email'],
    batchSize: 50
  });

console.log(`Inserted ${ignoreConflicts.successful} new users, skipped ${ignoreConflicts.failed} duplicates`);

// Strategy 2: Update on conflict (upsert behavior)
const updateOnConflict = await client
  .from<User>('users')
  .bulkInsert(users, {
    onConflict: 'update',
    conflictColumns: ['email'],
    returning: true
  });

console.log(`Inserted/updated ${updateOnConflict.successful} users`);

// Strategy 3: Error on conflict (strict mode)
const strictInsert = async (data: Partial<User>[]) => {
  try {
    const result = await client
      .from<User>('users')
      .bulkInsert(data, {
        onConflict: 'error',
        conflictColumns: ['email']
      });
    return result;
  } catch (error) {
    console.error('Bulk insert failed due to conflicts:', error);
    // Handle the error appropriately
    throw error;
  }
};
```

## Bulk Update

### Basic Bulk Update

::: code-group

```typescript [PostgREST Syntax]
// Prepare update data with IDs
const userUpdates = [
  { id: 1, name: 'John Updated', active: true },
  { id: 2, name: 'Jane Updated', active: false },
  { id: 3, role: 'admin' }, // Partial update
];

const result = await client
  .from<User>('users')
  .bulkUpdate(userUpdates, {
    matchColumn: 'id', // Column to match records by
    batchSize: 50,
    returning: true
  });

console.log(`Updated ${result.successful} records`);
```

```typescript [Repository Pattern]
// Repository bulk updates
const userRepo = client.getRepository<User>('users');

// Prepare update data with IDs
const userUpdates = [
  { id: 1, name: 'John Updated', active: true },
  { id: 2, name: 'Jane Updated', active: false },
  { id: 3, role: 'admin' }, // Partial update
];

// Method 1: Repository bulk update
const result = await userRepo.bulkUpdate(userUpdates, {
  matchColumn: 'id', // Column to match records by
  batchSize: 50
});

console.log(`Updated ${result.length} records`);

// Method 2: Using save method for bulk updates
const updatedUsers = [];
for (const update of userUpdates) {
  const user = await userRepo.findOne({ id: update.id });
  if (user) {
    const updatedUser = await userRepo.save({ ...user, ...update });
    updatedUsers.push(updatedUser);
  }
}

console.log(`Updated ${updatedUsers.length} users with save method`);

// Custom repository with bulk update logic
class UserRepository extends CustomRepositoryBase<User> {
  async bulkUpdateUsers(updates: Array<{ id: number } & Partial<User>>) {
    const results = [];
    
    for (const update of updates) {
      try {
        const { id, ...updateData } = update;
        const updated = await this.update({ id }, updateData);
        results.push(...updated);
      } catch (error) {
        console.error(`Failed to update user ${update.id}:`, error);
      }
    }
    
    return results;
  }

  async bulkUpdateWithValidation(updates: Array<{ id: number } & Partial<User>>) {
    const validUpdates = updates.filter(update => 
      update.id && (update.name || update.email || update.role !== undefined)
    );

    if (validUpdates.length === 0) {
      throw new Error('No valid updates provided');
    }

    return this.bulkUpdateUsers(validUpdates);
  }

  async bulkUpdateStatus(userIds: number[], active: boolean) {
    const updates = userIds.map(id => ({ 
      id, 
      active,
      updated_at: new Date().toISOString()
    }));

    return this.bulkUpdateUsers(updates);
  }
}

const customUserRepo = client.getCustomRepository(UserRepository);
const updateResult = await customUserRepo.bulkUpdateUsers(userUpdates);
console.log(`Updated ${updateResult.length} users with custom repository`);
```

:::

### Conditional Bulk Updates

```typescript
// Update view counts for posts
const viewUpdates = [
  { id: 1, views: 1500 },
  { id: 2, views: 2000 },
  { id: 3, views: 750 },
];

const result = await client
  .from<Post>('posts')
  .bulkUpdate(viewUpdates, {
    matchColumn: 'id',
    returning: false // Don't need returned data
  });

// Status updates with timestamps
const statusUpdates = userIds.map(id => ({
  id,
  active: true,
  updated_at: new Date().toISOString()
}));

await client
  .from<User>('users')
  .bulkUpdate(statusUpdates, {
    matchColumn: 'id',
    batchSize: 20
  });
```

## Bulk Upsert

Bulk upsert combines insert and update operations, creating new records or updating existing ones:

::: code-group

```typescript [PostgREST Syntax]
// Upsert user data
const userData = [
  { email: 'existing@example.com', name: 'Updated Name' },
  { email: 'new@example.com', name: 'New User', role: 'user' },
];

const result = await client
  .from<User>('users')
  .bulkUpsert(userData, {
    conflictColumns: ['email'], // Use email as unique identifier
    batchSize: 50,
    returning: true
  });

console.log('Upsert results:', {
  created: result.data.filter(user => user.created_at === user.updated_at).length,
  updated: result.data.filter(user => user.created_at !== user.updated_at).length
});
```

```typescript [Repository Pattern]
// Repository bulk upsert
const userRepo = client.getRepository<User>('users');

// Upsert user data
const userData = [
  { email: 'existing@example.com', name: 'Updated Name' },
  { email: 'new@example.com', name: 'New User', role: 'user' },
];

// Method 1: Repository bulk upsert
const result = await userRepo.bulkUpsert(userData, {
  conflictColumns: ['email'], // Use email as unique identifier
  batchSize: 50
});

console.log(`Upserted ${result.length} users`);

// Method 2: Manual upsert using save method
const upsertResults = [];
for (const user of userData) {
  try {
    const upsertedUser = await userRepo.save(user);
    upsertResults.push(upsertedUser);
  } catch (error) {
    console.error(`Failed to upsert user ${user.email}:`, error);
  }
}

console.log(`Manually upserted ${upsertResults.length} users`);

// Custom repository with advanced upsert logic
class UserRepository extends CustomRepositoryBase<User> {
  async bulkUpsertUsers(userData: Partial<User>[]) {
    const results = [];
    
    for (const user of userData) {
      try {
        // Check if user exists
        const existing = await this.findOne({ email: user.email });
        
        if (existing) {
          // Update existing user
          const updated = await this.save({ ...existing, ...user });
          results.push({ action: 'updated', user: updated });
        } else {
          // Create new user
          const created = await this.save({
            ...user,
            created_at: new Date().toISOString()
          });
          results.push({ action: 'created', user: created });
        }
      } catch (error) {
        console.error(`Failed to upsert user ${user.email}:`, error);
        results.push({ action: 'error', user, error: error.message });
      }
    }
    
    return results;
  }

  async bulkUpsertWithConflictResolution(userData: Partial<User>[]) {
    // First try bulk insert with ignore conflicts
    try {
      const inserted = await this.insertMany(userData, {
        onConflict: 'ignore',
        conflictColumns: ['email']
      });
      
      console.log(`Inserted ${inserted.length} new users`);
      
      // Find users that weren't inserted (conflicts)
      const insertedEmails = inserted.map(u => u.email);
      const conflictUsers = userData.filter(u => !insertedEmails.includes(u.email));
      
      // Update conflicting users
      const updated = [];
      for (const user of conflictUsers) {
        const existing = await this.findOne({ email: user.email });
        if (existing) {
          const updatedUser = await this.save({ ...existing, ...user });
          updated.push(updatedUser);
        }
      }
      
      console.log(`Updated ${updated.length} existing users`);
      
      return {
        inserted,
        updated,
        total: inserted.length + updated.length
      };
    } catch (error) {
      console.error('Bulk upsert failed:', error);
      throw error;
    }
  }

  async smartBulkUpsert(userData: Partial<User>[]) {
    // Group users by whether they likely exist
    const emails = userData.map(u => u.email).filter(Boolean);
    const existingUsers = await this
      .createQueryBuilder()
      .where('email IN (:...emails)', { emails })
      .getMany();
    
    const existingEmails = new Set(existingUsers.map(u => u.email));
    
    const toInsert = userData.filter(u => !existingEmails.has(u.email));
    const toUpdate = userData.filter(u => existingEmails.has(u.email));
    
    const [inserted, updated] = await Promise.all([
      toInsert.length > 0 ? this.insertMany(toInsert) : [],
      Promise.all(toUpdate.map(async (user) => {
        const existing = existingUsers.find(e => e.email === user.email);
        return this.save({ ...existing, ...user });
      }))
    ]);
    
    return {
      inserted,
      updated,
      total: inserted.length + updated.length
    };
  }
}

const customUserRepo = client.getCustomRepository(UserRepository);

// Usage examples
const upsertResult = await customUserRepo.bulkUpsertUsers(userData);
console.log('Upsert results:', {
  created: upsertResult.filter(r => r.action === 'created').length,
  updated: upsertResult.filter(r => r.action === 'updated').length,
  errors: upsertResult.filter(r => r.action === 'error').length
});

const smartResult = await customUserRepo.smartBulkUpsert(userData);
console.log(`Smart upsert: ${smartResult.inserted.length} inserted, ${smartResult.updated.length} updated`);
```

:::

## Bulk Delete

### Basic Bulk Delete

::: code-group

```typescript [PostgREST Syntax]
// Delete by IDs
const idsToDelete = [1, 2, 3, 4, 5];

const result = await client
  .from<User>('users')
  .bulkDelete(idsToDelete, {
    matchColumn: 'id',
    batchSize: 100
  });

console.log(`Deleted ${result.successful} records`);
```

```typescript [Repository Pattern]
// Repository bulk delete
const userRepo = client.getRepository<User>('users');

// Delete by IDs
const idsToDelete = [1, 2, 3, 4, 5];

// Method 1: Repository bulk delete
const result = await userRepo.bulkDelete(idsToDelete, {
  matchColumn: 'id',
  batchSize: 100
});

console.log(`Deleted ${result.length} records`);

// Method 2: Using delete method
const deleteResult = await userRepo.delete({ 
  id: { in: idsToDelete } 
});

console.log(`Deleted ${deleteResult.length} users`);

// Method 3: Individual deletions with error handling
const deletedUsers = [];
const failedDeletes = [];

for (const id of idsToDelete) {
  try {
    const deleted = await userRepo.delete({ id });
    if (deleted.length > 0) {
      deletedUsers.push(...deleted);
    } else {
      failedDeletes.push({ id, error: 'User not found' });
    }
  } catch (error) {
    failedDeletes.push({ id, error: error.message });
  }
}

console.log(`Successfully deleted: ${deletedUsers.length}, Failed: ${failedDeletes.length}`);

// Custom repository with bulk delete logic
class UserRepository extends CustomRepositoryBase<User> {
  async bulkDeleteUsers(userIds: number[]) {
    const results = {
      deleted: [],
      failed: []
    };

    // Delete in batches
    const batchSize = 50;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      
      try {
        const deleted = await this.delete({ 
          id: { in: batch } 
        });
        results.deleted.push(...deleted);
      } catch (error) {
        console.error(`Failed to delete batch:`, error);
        results.failed.push(...batch.map(id => ({ id, error: error.message })));
      }
    }

    return results;
  }

  async softDeleteUsers(userIds: number[]) {
    // Soft delete by marking as inactive
    const updateData = {
      active: false,
      deleted_at: new Date().toISOString()
    };

    const updated = await this.update(
      { id: { in: userIds } },
      updateData
    );

    return updated;
  }

  async deleteInactiveUsers(inactiveSince: string) {
    // Delete users who have been inactive since a certain date
    const usersToDelete = await this
      .createQueryBuilder()
      .where('active = :active', { active: false })
      .andWhere('last_login < :date', { date: inactiveSince })
      .getMany();

    if (usersToDelete.length === 0) {
      return [];
    }

    const userIds = usersToDelete.map(u => u.id);
    return this.bulkDeleteUsers(userIds);
  }

  async cascadeDeleteUserData(userId: number) {
    // Delete user and all related data
    try {
      // Delete related data first (assuming relationships exist)
      await this.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
      await this.query('DELETE FROM user_preferences WHERE user_id = $1', [userId]);
      
      // Finally delete the user
      const deleted = await this.delete({ id: userId });
      
      return {
        success: true,
        deletedUser: deleted[0] || null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

const customUserRepo = client.getCustomRepository(UserRepository);

// Usage examples
const bulkDeleteResult = await customUserRepo.bulkDeleteUsers(idsToDelete);
console.log(`Bulk delete: ${bulkDeleteResult.deleted.length} deleted, ${bulkDeleteResult.failed.length} failed`);

const softDeleted = await customUserRepo.softDeleteUsers([1, 2, 3]);
console.log(`Soft deleted ${softDeleted.length} users`);
```

:::

### Conditional Bulk Delete

```typescript
// Delete inactive users older than 1 year
const inactiveUsers = await client
  .from<User>('users')
  .select('id')
  .eq('active', false)
  .lt('last_login', '2023-01-01')
  .find();

const userIds = inactiveUsers.map(user => user.id);

const result = await client
  .from<User>('users')
  .bulkDelete(userIds, {
    matchColumn: 'id',
    batchSize: 50,
    returning: true // Return deleted records for audit
  });
```

## Large Dataset Processing

### Memory-Efficient Processing

```typescript
// Process 10,000 sales records efficiently
const generateSalesData = () => Array.from({ length: 10000 }, (_, i) => ({
  product_name: `Product ${i + 1}`,
  category: ['Electronics', 'Clothing', 'Books'][i % 3],
  amount: Math.round((Math.random() * 500 + 50) * 100) / 100,
  quantity: Math.floor(Math.random() * 10) + 1,
  sale_date: new Date().toISOString().split('T')[0],
  region: ['North', 'South', 'East', 'West'][i % 4]
}));

const salesData = generateSalesData();
const startTime = Date.now();

const result = await client
  .from<Sale>('sales')
  .bulkInsert(salesData, {
    batchSize: 100,     // Process in batches of 100
    returning: false    // Don't return data to save memory
  });

const endTime = Date.now();
console.log(`Processed ${result.count} records in ${endTime - startTime}ms`);
```

### Progress Tracking

```typescript
// Track progress of large operations
async function bulkInsertWithProgress<T>(
  client: PostgRESTClient,
  tableName: string,
  data: T[],
  options: BulkInsertOptions = {}
) {
  const batchSize = options.batchSize || 100;
  const batches = Math.ceil(data.length / batchSize);
  
  let totalSuccessful = 0;
  let totalFailed = 0;
  const allErrors: Error[] = [];

  for (let i = 0; i < batches; i++) {
    const batch = data.slice(i * batchSize, (i + 1) * batchSize);
    
    try {
      const result = await client
        .from<T>(tableName)
        .bulkInsert(batch, options);
      
      totalSuccessful += result.successful;
      totalFailed += result.failed;
      allErrors.push(...result.errors);
      
      // Progress callback
      const progress = ((i + 1) / batches) * 100;
      console.log(`Progress: ${progress.toFixed(1)}% (${i + 1}/${batches} batches)`);
      
    } catch (error) {
      console.error(`Batch ${i + 1} failed:`, error);
      totalFailed += batch.length;
    }
  }

  return {
    total: data.length,
    successful: totalSuccessful,
    failed: totalFailed,
    errors: allErrors
  };
}

// Usage
const result = await bulkInsertWithProgress(
  client,
  'sales',
  salesData,
  { batchSize: 100, returning: false }
);
```

## Error Handling and Retry Logic

### Comprehensive Error Handling

```typescript
async function robustBulkInsert<T>(
  client: PostgRESTClient,
  tableName: string,
  data: T[],
  options: BulkInsertOptions = {},
  maxRetries = 3
) {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await client
        .from<T>(tableName)
        .bulkInsert(data, options);
      
      // Success - return result
      if (result.failed === 0) {
        return result;
      }
      
      // Partial failure - log and continue
      console.warn(`Attempt ${attempt}: ${result.failed} failed records`);
      
      if (attempt === maxRetries) {
        return result; // Return partial result on final attempt
      }
      
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Usage
try {
  const result = await robustBulkInsert(
    client,
    'users',
    userData,
    { batchSize: 100, onConflict: 'ignore' },
    3 // max retries
  );
  
  console.log('Bulk insert completed:', result.successful);
} catch (error) {
  console.error('All retry attempts failed:', error);
}
```

### Validation and Data Quality

```typescript
// Validate data before bulk operations
function validateUserData(users: Partial<User>[]): {
  valid: Partial<User>[],
  invalid: { record: Partial<User>, errors: string[] }[]
} {
  const valid: Partial<User>[] = [];
  const invalid: { record: Partial<User>, errors: string[] }[] = [];
  
  users.forEach(user => {
    const errors: string[] = [];
    
    if (!user.name || user.name.trim().length === 0) {
      errors.push('Name is required');
    }
    
    if (!user.email || !user.email.includes('@')) {
      errors.push('Valid email is required');
    }
    
    if (user.role && !['user', 'admin', 'guest'].includes(user.role)) {
      errors.push('Invalid role');
    }
    
    if (errors.length === 0) {
      valid.push(user);
    } else {
      invalid.push({ record: user, errors });
    }
  });
  
  return { valid, invalid };
}

// Bulk insert with validation
const { valid, invalid } = validateUserData(userData);

if (invalid.length > 0) {
  console.warn(`${invalid.length} invalid records found:`, invalid);
}

if (valid.length > 0) {
  const result = await client
    .from<User>('users')
    .bulkInsert(valid, {
      batchSize: 100,
      onConflict: 'ignore'
    });
  
  console.log(`Successfully processed ${result.successful} valid records`);
}
```

## Performance Optimization

### Batch Size Optimization

```typescript
// Test different batch sizes to find optimal performance
async function findOptimalBatchSize<T>(
  client: PostgRESTClient,
  tableName: string,
  sampleData: T[],
  testSizes = [50, 100, 200, 500, 1000]
) {
  const results: { batchSize: number, timePerRecord: number }[] = [];
  
  for (const batchSize of testSizes) {
    const startTime = Date.now();
    
    const result = await client
      .from<T>(tableName)
      .bulkInsert(sampleData.slice(0, Math.min(batchSize, sampleData.length)), {
        batchSize,
        returning: false
      });
    
    const endTime = Date.now();
    const timePerRecord = (endTime - startTime) / result.successful;
    
    results.push({ batchSize, timePerRecord });
    
    console.log(`Batch size ${batchSize}: ${timePerRecord.toFixed(2)}ms per record`);
  }
  
  // Find optimal batch size (lowest time per record)
  const optimal = results.reduce((best, current) => 
    current.timePerRecord < best.timePerRecord ? current : best
  );
  
  console.log(`Optimal batch size: ${optimal.batchSize}`);
  return optimal.batchSize;
}
```

### Memory Management

```typescript
// Process very large datasets without running out of memory
async function processLargeDataset<T>(
  client: PostgRESTClient,
  tableName: string,
  dataGenerator: () => Iterator<T>,
  options: {
    batchSize?: number;
    maxMemoryMB?: number;
    onProgress?: (processed: number) => void;
  } = {}
) {
  const { batchSize = 100, maxMemoryMB = 100, onProgress } = options;
  
  let processed = 0;
  let batch: T[] = [];
  
  for (const record of dataGenerator()) {
    batch.push(record);
    
    // Process batch when it reaches size limit
    if (batch.length >= batchSize) {
      const result = await client
        .from<T>(tableName)
        .bulkInsert(batch, { returning: false });
      
      processed += result.successful;
      batch = []; // Clear batch to free memory
      
      if (onProgress) {
        onProgress(processed);
      }
      
      // Check memory usage (simplified)
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
      if (memoryUsage > maxMemoryMB) {
        console.warn(`Memory usage (${memoryUsage.toFixed(1)}MB) exceeds limit`);
      }
    }
  }
  
  // Process remaining records
  if (batch.length > 0) {
    const result = await client
      .from<T>(tableName)
      .bulkInsert(batch, { returning: false });
    
    processed += result.successful;
    
    if (onProgress) {
      onProgress(processed);
    }
  }
  
  return processed;
}
```

## Real-World Examples

### Data Migration

```typescript
// Migrate data from one table to another with transformation
async function migrateUserData() {
  // Read old user data
  const oldUsers = await client.from('legacy_users').find();
  
  // Transform data
  const transformedUsers = oldUsers.map(oldUser => ({
    name: `${oldUser.first_name} ${oldUser.last_name}`,
    email: oldUser.email_address,
    active: oldUser.status === 'active',
    created_at: oldUser.registration_date,
    // Map old role system to new
    role: oldUser.user_type === 'administrator' ? 'admin' : 'user'
  }));
  
  // Bulk insert with conflict resolution
  const result = await client
    .from<User>('users')
    .bulkUpsert(transformedUsers, {
      conflictColumns: ['email'],
      batchSize: 200,
      returning: false
    });
  
  console.log(`Migration completed: ${result.successful} users migrated`);
}
```

### CSV Import

```typescript
import * as csv from 'csv-parser';
import * as fs from 'fs';

async function importCSV(filePath: string) {
  const records: any[] = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Transform CSV row to database record
        records.push({
          name: data.Name,
          email: data.Email,
          active: data.Status === 'Active',
          created_at: new Date().toISOString()
        });
        
        // Process in chunks to avoid memory issues
        if (records.length >= 1000) {
          processBatch(records.splice(0, 1000));
        }
      })
      .on('end', async () => {
        // Process remaining records
        if (records.length > 0) {
          await processBatch(records);
        }
        resolve(true);
      })
      .on('error', reject);
  });
  
  async function processBatch(batch: any[]) {
    const result = await client
      .from<User>('users')
      .bulkInsert(batch, {
        batchSize: 100,
        onConflict: 'ignore',
        conflictColumns: ['email']
      });
    
    console.log(`Processed batch: ${result.successful} successful, ${result.failed} failed`);
  }
}
```

## Best Practices

### ✅ Recommended Practices

- **Optimal Batch Sizes**: Use 50-500 records per batch for best performance
- **Error Resilience**: Implement comprehensive error handling and retry logic
- **Data Validation**: Validate data before bulk operations to ensure quality
- **Memory Efficiency**: Use `returning: false` for large datasets to conserve memory
- **Resource Monitoring**: Monitor memory usage and processing time for large operations
- **Conflict Strategy**: Choose appropriate conflict resolution for your use case
- **Performance Testing**: Test different batch sizes to find optimal performance
- **User Feedback**: Implement progress tracking for long-running operations
- **Type Safety**: Leverage TypeScript generics for type-safe bulk operations

### ❌ Common Pitfalls

- **Tiny Batches**: Avoid batch sizes < 10 records (network overhead)
- **Oversized Batches**: Avoid batch sizes > 1000 records (memory issues)
- **Ignoring Failures**: Always handle and log failed record details
- **Skipping Validation**: Validate data to prevent database constraint violations
- **Blocking UI**: Run bulk operations in background threads/workers
- **Conflict Ignorance**: Handle duplicate key conflicts in production data
- **Memory Leaks**: Clear processed batches to prevent memory accumulation
- **Network Timeouts**: Configure appropriate timeouts for large operations

---

## Summary

PGRestify's bulk operations provide:

- **High Performance**: Optimized batch processing for large datasets
- **Error Resilience**: Comprehensive error handling with detailed feedback
- **Flexible Strategies**: Multiple conflict resolution approaches
- **Memory Efficiency**: Configurable batch sizes and streaming capabilities
- **Progress Tracking**: Built-in mechanisms for monitoring long-running operations
- **Type Safety**: Full TypeScript support with generic constraints
- **Production Ready**: Retry logic, validation, and resource management
- **Comprehensive API**: Support for bulk insert, update, upsert, and delete operations

Master these bulk operation patterns to efficiently process large datasets while maintaining data integrity and providing excellent user experience through progress tracking and error handling.