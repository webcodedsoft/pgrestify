# Upsert Operations

Upsert operations combine INSERT and UPDATE functionality, inserting new records or updating existing ones based on unique constraints or primary keys. This is particularly useful for data synchronization and handling duplicate entries gracefully.

## Basic Upsert Operations

### Single Record Upsert

```typescript
import { createClient } from 'pgrestify';

interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

const client = createClient({ url: 'http://localhost:3000' });

// Basic upsert - will insert or update based on primary key
const user = await client
  .from<User>('users')
  .upsert({
    id: '123',
    email: 'john@example.com',
    name: 'John Doe'
  })
  .single()
  .execute();

console.log('Upserted user:', user.data);
```

### Multiple Record Upsert

```typescript
// Batch upsert multiple records
const users = await client
  .from<User>('users')
  .upsert([
    {
      id: '123',
      email: 'john@example.com',
      name: 'John Doe'
    },
    {
      id: '456',
      email: 'jane@example.com',
      name: 'Jane Smith'
    }
  ])
  .execute();

console.log('Upserted users:', users.data);
```

## Conflict Resolution Strategies

### Default Behavior

By default, PostgREST uses the primary key for conflict detection:

```typescript
// Will conflict on 'id' field (primary key)
const result = await client
  .from<User>('users')
  .upsert({
    id: '123',
    email: 'newemail@example.com',
    name: 'Updated Name'
  })
  .execute();
```

### Custom Conflict Columns

Use raw parameters to specify custom conflict resolution:

```typescript
// Conflict on email field instead of primary key
const result = await client
  .from<User>('users')
  .upsert({
    email: 'john@example.com',
    name: 'John Updated'
  })
  .rawParams({
    'on_conflict': 'email'
  })
  .execute();
```

### Multiple Conflict Columns

```typescript
// Conflict on multiple columns
const result = await client
  .from<User>('users')
  .upsert({
    email: 'john@example.com',
    department: 'Engineering',
    name: 'John Doe'
  })
  .rawParams({
    'on_conflict': 'email,department'
  })
  .execute();
```

## Advanced Upsert Patterns

### Conditional Updates

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  updated_at: string;
}

// Only update if new price is different
const result = await client
  .from<Product>('products')
  .upsert({
    id: 'prod-123',
    name: 'Widget',
    price: 29.99,
    stock: 100
  })
  .rawParams({
    'on_conflict': 'id',
    'resolution': 'merge-duplicates'
  })
  .execute();
```

### Partial Updates on Conflict

```typescript
// Only update specific fields when conflict occurs
const result = await client
  .from<User>('users')
  .upsert({
    email: 'john@example.com',
    last_login: new Date().toISOString(),
    login_count: 1
  })
  .rawParams({
    'on_conflict': 'email'
  })
  .execute();
```

### Ignore Conflicts

```typescript
// Insert only, ignore if record exists
const result = await client
  .from<User>('users')
  .upsert({
    email: 'john@example.com',
    name: 'John Doe'
  })
  .rawParams({
    'on_conflict': 'email',
    'resolution': 'ignore'
  })
  .execute();
```

## Bulk Upsert Operations

### Large Dataset Processing

```typescript
interface DataPoint {
  id: string;
  timestamp: string;
  value: number;
  sensor_id: string;
}

async function bulkUpsertSensorData(dataPoints: DataPoint[]) {
  const batchSize = 1000;
  const results: DataPoint[] = [];
  
  for (let i = 0; i < dataPoints.length; i += batchSize) {
    const batch = dataPoints.slice(i, i + batchSize);
    
    try {
      const result = await client
        .from<DataPoint>('sensor_data')
        .upsert(batch)
        .rawParams({
          'on_conflict': 'sensor_id,timestamp'
        })
        .execute();
      
      if (result.data) {
        results.push(...result.data);
      }
    } catch (error) {
      console.error(`Failed to upsert batch ${i / batchSize + 1}:`, error);
      throw error;
    }
  }
  
  return results;
}

// Usage
const sensorData = [
  // ... array of sensor data points
];

const upsertedData = await bulkUpsertSensorData(sensorData);
console.log(`Successfully upserted ${upsertedData.length} data points`);
```

### Progress Tracking

```typescript
async function bulkUpsertWithProgress<T>(
  tableName: string,
  records: Partial<T>[],
  options: {
    batchSize?: number;
    onProgress?: (processed: number, total: number) => void;
    conflictColumns?: string[];
  } = {}
) {
  const { 
    batchSize = 1000, 
    onProgress,
    conflictColumns = []
  } = options;
  
  const results: T[] = [];
  let processed = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const query = client.from<T>(tableName).upsert(batch);
    
    // Add conflict resolution if specified
    if (conflictColumns.length > 0) {
      query.rawParams({
        'on_conflict': conflictColumns.join(',')
      });
    }
    
    const result = await query.execute();
    
    if (result.data) {
      results.push(...result.data);
    }
    
    processed += batch.length;
    onProgress?.(processed, records.length);
  }
  
  return results;
}

// Usage with progress tracking
const result = await bulkUpsertWithProgress<User>(
  'users',
  userData,
  {
    batchSize: 500,
    conflictColumns: ['email'],
    onProgress: (processed, total) => {
      console.log(`Progress: ${processed}/${total} (${Math.round(processed/total * 100)}%)`);
    }
  }
);
```

## Return Specifications

### Returning Specific Columns

```typescript
// Return only specific columns after upsert
const result = await client
  .from<User>('users')
  .select('id', 'email', 'updated_at')
  .upsert({
    email: 'john@example.com',
    name: 'John Updated'
  })
  .execute();

console.log('Updated fields:', result.data);
```

### Returning All Data

```typescript
// Return complete record after upsert
const result = await client
  .from<User>('users')
  .select('*')
  .upsert({
    id: '123',
    email: 'john@example.com',
    name: 'John Doe'
  })
  .execute();
```

### Count Information

```typescript
// Get count information about upserted records
const result = await client
  .from<User>('users')
  .upsert(userData)
  .execute({ count: 'exact' });

console.log(`Upserted ${result.count} records`);
```

## Error Handling

### Basic Error Handling

```typescript
try {
  const result = await client
    .from<User>('users')
    .upsert({
      email: 'invalid-email', // Will fail validation
      name: 'Test User'
    })
    .execute();
    
  console.log('Success:', result.data);
} catch (error) {
  console.error('Upsert failed:', error);
}
```

### Validation Errors

```typescript
interface UpsertError {
  column: string;
  message: string;
  value: any;
}

async function safeUpsert<T>(
  tableName: string,
  data: Partial<T>[],
  conflictColumns: string[] = []
) {
  try {
    const query = client.from<T>(tableName).upsert(data);
    
    if (conflictColumns.length > 0) {
      query.rawParams({
        'on_conflict': conflictColumns.join(',')
      });
    }
    
    return await query.execute();
  } catch (error: any) {
    // Parse PostgreSQL constraint errors
    if (error.message?.includes('violates check constraint')) {
      const constraintMatch = error.message.match(/constraint "(.+?)"/);
      const constraint = constraintMatch?.[1] || 'unknown';
      
      throw new Error(`Validation failed: ${constraint} constraint violated`);
    }
    
    if (error.message?.includes('duplicate key')) {
      throw new Error('Duplicate key error: Record already exists');
    }
    
    throw error;
  }
}
```

### Retry Logic

```typescript
async function upsertWithRetry<T>(
  tableName: string,
  data: Partial<T>[],
  maxRetries: number = 3,
  conflictColumns: string[] = []
) {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const query = client.from<T>(tableName).upsert(data);
      
      if (conflictColumns.length > 0) {
        query.rawParams({
          'on_conflict': conflictColumns.join(',')
        });
      }
      
      return await query.execute();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry for validation errors
      if (error.message?.includes('violates check constraint')) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Upsert failed after all retries');
}
```

## Performance Considerations

### Batch Size Optimization

```typescript
// Optimal batch sizes for different scenarios
const BATCH_SIZES = {
  simple: 1000,      // Simple records with few columns
  complex: 500,      // Records with many columns or relations
  withBlobs: 100,    // Records containing binary data
  highConcurrency: 200 // When many clients are writing simultaneously
};

async function optimizedUpsert<T>(
  tableName: string,
  records: Partial<T>[],
  complexity: 'simple' | 'complex' | 'withBlobs' | 'highConcurrency' = 'simple'
) {
  const batchSize = BATCH_SIZES[complexity];
  // ... implementation with appropriate batch size
}
```

### Index Optimization

```typescript
// For frequent upserts, ensure proper indexes exist
// This would typically be done in your database migration:

// CREATE UNIQUE INDEX CONCURRENTLY idx_users_email 
// ON users(email) WHERE email IS NOT NULL;

// CREATE INDEX CONCURRENTLY idx_products_sku_category 
// ON products(sku, category) WHERE active = true;

// Your upsert operations will be much faster with proper indexes
const result = await client
  .from<Product>('products')
  .upsert(productData)
  .rawParams({
    'on_conflict': 'sku,category'
  })
  .execute();
```

### Memory Management

```typescript
async function memoryEfficientUpsert<T>(
  tableName: string,
  dataStream: AsyncIterable<T[]>,
  conflictColumns: string[] = []
) {
  let totalProcessed = 0;
  
  for await (const batch of dataStream) {
    const query = client.from<T>(tableName).upsert(batch);
    
    if (conflictColumns.length > 0) {
      query.rawParams({
        'on_conflict': conflictColumns.join(',')
      });
    }
    
    await query.execute();
    totalProcessed += batch.length;
    
    // Force garbage collection for large datasets
    if (totalProcessed % 10000 === 0) {
      if (global.gc) {
        global.gc();
      }
    }
  }
  
  return totalProcessed;
}
```

## Best Practices

### 1. Choose Appropriate Conflict Columns

```typescript
// Good: Use natural unique constraints
await client.from<User>('users')
  .upsert(userData)
  .rawParams({ 'on_conflict': 'email' })
  .execute();

// Avoid: Using non-unique columns for conflict detection
// This may not work as expected
```

### 2. Validate Data Before Upsert

```typescript
function validateUserData(userData: Partial<User>[]): Partial<User>[] {
  return userData.filter(user => {
    if (!user.email || !isValidEmail(user.email)) {
      console.warn('Skipping invalid user:', user);
      return false;
    }
    return true;
  });
}

const validatedData = validateUserData(rawUserData);
await client.from<User>('users').upsert(validatedData).execute();
```

### 3. Use Transactions for Related Data

```typescript
// For related data that must be consistent, use transactions
// (This would be implemented with PostgreSQL transactions)
async function upsertUserWithProfile(userData: User, profileData: Profile) {
  // Begin transaction
  const user = await client
    .from<User>('users')
    .upsert(userData)
    .single()
    .execute();
  
  if (user.data) {
    await client
      .from<Profile>('profiles')
      .upsert({
        ...profileData,
        user_id: user.data.id
      })
      .execute();
  }
  // Commit transaction
}
```

### 4. Monitor Performance

```typescript
async function monitoredUpsert<T>(
  tableName: string,
  data: Partial<T>[],
  conflictColumns: string[] = []
) {
  const startTime = Date.now();
  
  try {
    const query = client.from<T>(tableName).upsert(data);
    
    if (conflictColumns.length > 0) {
      query.rawParams({
        'on_conflict': conflictColumns.join(',')
      });
    }
    
    const result = await query.execute();
    
    const duration = Date.now() - startTime;
    console.log(`Upserted ${data.length} records in ${duration}ms`);
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Upsert failed after ${duration}ms:`, error);
    throw error;
  }
}
```

## Common Use Cases

### 1. Data Synchronization

```typescript
// Synchronizing external data with local database
async function syncExternalUsers(externalUsers: ExternalUser[]) {
  const localUsers = externalUsers.map(external => ({
    external_id: external.id,
    email: external.email,
    name: external.full_name,
    last_sync: new Date().toISOString()
  }));
  
  return await client
    .from<User>('users')
    .upsert(localUsers)
    .rawParams({
      'on_conflict': 'external_id'
    })
    .execute();
}
```

### 2. Cache Updates

```typescript
// Updating cached computed values
async function updateUserStats(userId: string, newStats: UserStats) {
  return await client
    .from<UserStats>('user_stats')
    .upsert({
      user_id: userId,
      ...newStats,
      updated_at: new Date().toISOString()
    })
    .rawParams({
      'on_conflict': 'user_id'
    })
    .execute();
}
```

### 3. Configuration Management

```typescript
// Managing application settings
async function updateSettings(settings: AppSetting[]) {
  return await client
    .from<AppSetting>('app_settings')
    .upsert(settings)
    .rawParams({
      'on_conflict': 'key'
    })
    .execute();
}
```

## Summary

Upsert operations in PGRestify provide a powerful way to handle INSERT/UPDATE scenarios gracefully. Key points:

- **Flexibility**: Support for single and batch operations with customizable conflict resolution
- **Performance**: Optimized for large datasets with proper batching and error handling
- **Safety**: Built-in error handling and validation support
- **Integration**: Seamless integration with PostgREST's native upsert capabilities

Choose upsert operations when you need to handle data that may or may not already exist, such as data synchronization, cache updates, or configuration management scenarios.