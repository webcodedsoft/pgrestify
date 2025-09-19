# Bulk Operations

Master high-performance bulk operations in PGRestify for inserting, updating, upserting, and deleting large datasets efficiently with comprehensive error handling and conflict resolution.

## Overview

Bulk operations in PGRestify provide efficient processing of large datasets while maintaining data integrity and providing detailed feedback on success and failure rates. These operations are built on top of the standard CRUD methods but provide optimized batch processing capabilities.

## Benefits of Bulk Operations

- **🚀 Performance**: Significantly faster than individual operations for large datasets
- **💾 Memory Efficient**: Process data in configurable batches to manage memory usage
- **🛡️ Error Resilient**: Continue processing despite individual record failures
- **⚖️ Conflict Resolution**: Handle duplicates with flexible strategies
- **📊 Progress Tracking**: Detailed reporting on success/failure rates
- **🔒 Type Safe**: Full TypeScript support with generic constraints

## Bulk Insert

### Basic Bulk Insert

```typescript
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

### Advanced Bulk Insert with Options

```typescript
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

```typescript
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

```typescript
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

## Bulk Delete

### Basic Bulk Delete

```typescript
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