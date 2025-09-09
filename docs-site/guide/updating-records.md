# Updating Records

Master data updates in PGRestify with partial updates, conditional updates, bulk updates, optimistic locking, and return specifications.

## Overview

Updating records in PGRestify provides flexible and safe data modification capabilities. You can perform partial updates, conditional updates, bulk operations, and handle concurrency with optimistic locking. All update operations use PostgreSQL's UPDATE statement through PostgREST's API.

## Basic Record Updates

### Single Record Update

```typescript
import { createClient } from 'pgrestify';

const client = createClient({
  url: 'http://localhost:3000'
});

// Update a user by ID
const updatedUser = await client
  .from('users')
  .update({
    name: 'John Updated',
    age: 31,
    updated_at: new Date().toISOString()
  })
  .eq('id', 123)
  .execute();

console.log('Updated user:', updatedUser.data);
```

### Partial Updates

```typescript
// Update only specific fields
const partialUpdate = await client
  .from('users')
  .update({
    last_login: new Date().toISOString()
    // Only updates last_login, other fields remain unchanged
  })
  .eq('id', 123)
  .execute();

// Update nested JSON fields
const jsonUpdate = await client
  .from('users')
  .update({
    'preferences->theme': 'dark',
    'preferences->language': 'en'
  })
  .eq('id', 123)
  .execute();
```

### Type-Safe Updates

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
  is_active: boolean;
  updated_at: string;
}

// Type-safe update
const typedUpdate = await client
  .from<User>('users')
  .update({
    name: 'Jane Updated',
    age: 28
    // TypeScript ensures only valid User fields can be updated
  })
  .eq('id', 456)
  .execute();

// TypeScript prevents invalid updates
// .update({ invalid_field: 'value' })  // ❌ TypeScript error
```

## Conditional Updates

### Single Condition Updates

```typescript
// Update users with specific condition
const conditionalUpdate = await client
  .from('users')
  .update({
    status: 'verified',
    verified_at: new Date().toISOString()
  })
  .eq('email_verified', true)
  .is('verified_at', null)  // Only update unverified users
  .execute();

console.log(`Updated ${conditionalUpdate.data.length} users`);
```

### Multiple Condition Updates

```typescript
// Update with complex conditions
const complexUpdate = await client
  .from('products')
  .update({
    status: 'discontinued',
    updated_at: new Date().toISOString()
  })
  .lt('stock_quantity', 5)
  .eq('is_active', true)
  .lt('last_sold', '2023-01-01')
  .execute();

// Update with OR conditions
const orConditionUpdate = await client
  .from('orders')
  .update({
    priority: 'high',
    updated_at: new Date().toISOString()
  })
  .or('total_amount.gte.1000,customer_tier.eq.premium')
  .execute();
```

### Existence-Based Updates

```typescript
// Update only if record exists
const safeUpdate = async (userId: number, updates: Partial<User>) => {
  // First check if user exists
  const user = await client
    .from('users')
    .select('id')
    .eq('id', userId)
    .single()
    .execute();

  if (user.error || !user.data) {
    throw new Error(`User with ID ${userId} not found`);
  }

  // Proceed with update
  const result = await client
    .from('users')
    .update(updates)
    .eq('id', userId)
    .execute();

  if (result.error) {
    throw new Error(`Update failed: ${result.error.message}`);
  }

  return result.data[0];
};

// Usage
try {
  const updatedUser = await safeUpdate(123, {
    name: 'Safe Updated Name',
    age: 35
  });
  console.log('User updated safely:', updatedUser);
} catch (error) {
  console.error('Update failed:', error.message);
}
```

## Bulk Updates

### Multiple Records Update

```typescript
// Update multiple records with same values
const bulkStatusUpdate = await client
  .from('orders')
  .update({
    status: 'processing',
    processing_started_at: new Date().toISOString()
  })
  .eq('status', 'pending')
  .gte('created_at', '2024-01-01')
  .execute();

console.log(`Updated ${bulkStatusUpdate.data.length} orders to processing`);
```

### Conditional Bulk Updates

```typescript
// Bulk update with complex conditions
const bulkPriceUpdate = await client
  .from('products')
  .update({
    price: client.raw('price * 1.1'),  // Increase price by 10%
    updated_at: new Date().toISOString()
  })
  .eq('category', 'electronics')
  .gte('created_at', '2023-01-01')
  .execute();

// Update with different values based on conditions
const tieredUpdate = async () => {
  // Update premium customers
  const premiumUpdate = await client
    .from('customers')
    .update({
      discount_rate: 0.15,
      tier: 'premium_plus'
    })
    .eq('tier', 'premium')
    .gte('total_spent', 10000)
    .execute();

  // Update regular customers
  const regularUpdate = await client
    .from('customers')
    .update({
      discount_rate: 0.05,
      tier: 'regular_plus'
    })
    .eq('tier', 'regular')
    .gte('total_spent', 5000)
    .execute();

  return {
    premiumUpdated: premiumUpdate.data.length,
    regularUpdated: regularUpdate.data.length
  };
};
```

### Batch Update with Different Values

```typescript
// Update multiple records with different values
const batchUpdateWithDifferentValues = async (updates: Array<{ id: number; data: any }>) => {
  const results = [];
  const errors = [];

  for (const { id, data } of updates) {
    try {
      const result = await client
        .from('users')
        .update(data)
        .eq('id', id)
        .single()
        .execute();

      if (result.error) {
        errors.push({ id, error: result.error.message });
      } else {
        results.push(result.data);
      }
    } catch (error) {
      errors.push({ id, error: error.message });
    }
  }

  return { results, errors };
};

// Usage
const updateBatch = [
  { id: 1, data: { name: 'User One Updated', age: 25 } },
  { id: 2, data: { name: 'User Two Updated', age: 30 } },
  { id: 3, data: { status: 'inactive' } }
];

const batchResult = await batchUpdateWithDifferentValues(updateBatch);
console.log(`Success: ${batchResult.results.length}, Errors: ${batchResult.errors.length}`);
```

## Optimistic Locking

### Version-Based Locking

```typescript
// Optimistic locking with version field
const optimisticUpdate = async (id: number, updates: any, expectedVersion: number) => {
  const result = await client
    .from('documents')
    .update({
      ...updates,
      version: expectedVersion + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('version', expectedVersion)  // Only update if version matches
    .execute();

  if (result.data.length === 0) {
    throw new Error('Document was modified by another user. Please refresh and try again.');
  }

  return result.data[0];
};

// Usage with retry logic
const updateWithRetry = async (id: number, updates: any, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Get current version
      const current = await client
        .from('documents')
        .select('version')
        .eq('id', id)
        .single()
        .execute();

      if (current.error) {
        throw new Error('Document not found');
      }

      // Attempt update with current version
      return await optimisticUpdate(id, updates, current.data.version);
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`Update attempt ${attempt} failed, retrying...`);
      // Brief delay before retry
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
};
```

### Timestamp-Based Locking

```typescript
// Optimistic locking with timestamp
const timestampBasedUpdate = async (id: number, updates: any, expectedTimestamp: string) => {
  const result = await client
    .from('posts')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('updated_at', expectedTimestamp)
    .execute();

  if (result.data.length === 0) {
    // Check if record exists or was modified
    const current = await client
      .from('posts')
      .select('id, updated_at')
      .eq('id', id)
      .single()
      .execute();

    if (current.error) {
      throw new Error('Record not found');
    }

    throw new Error(`Record was modified at ${current.data.updated_at}, expected ${expectedTimestamp}`);
  }

  return result.data[0];
};
```

## Return Specifications

### Controlling Returned Data

```typescript
// Return all updated fields (default)
const fullReturn = await client
  .from('products')
  .update({
    name: 'Updated Product',
    price: 199.99
  })
  .eq('id', 456)
  .execute();

// Return only specific fields
const limitedReturn = await client
  .from('products')
  .update({
    name: 'Updated Product',
    price: 199.99,
    updated_at: new Date().toISOString()
  })
  .eq('id', 456)
  .select('id, name, price, updated_at')
  .execute();

// Return nothing for performance
const noReturn = await client
  .from('products')
  .update({
    view_count: client.raw('view_count + 1')
  })
  .eq('id', 456)
  .select('')  // Minimal return
  .execute();
```

### Single Record Return

```typescript
// Ensure single record update and return
const singleUpdate = await client
  .from('users')
  .update({
    last_login: new Date().toISOString(),
    login_count: client.raw('login_count + 1')
  })
  .eq('id', 123)
  .single()  // Ensures single object return
  .execute();

console.log('Updated user:', singleUpdate.data);
```

## Advanced Update Patterns

### Increment/Decrement Operations

```typescript
// Increment counters
const incrementCounters = await client
  .from('posts')
  .update({
    view_count: client.raw('view_count + 1'),
    like_count: client.raw('like_count + 1'),
    updated_at: new Date().toISOString()
  })
  .eq('id', 789)
  .execute();

// Decrement stock
const decrementStock = await client
  .from('products')
  .update({
    stock_quantity: client.raw('stock_quantity - 1'),
    updated_at: new Date().toISOString()
  })
  .eq('id', 456)
  .gte('stock_quantity', 1)  // Only if stock available
  .execute();

if (decrementStock.data.length === 0) {
  throw new Error('Insufficient stock');
}
```

### Conditional Field Updates

```typescript
// Update fields based on conditions
const conditionalFieldUpdate = await client
  .from('orders')
  .update({
    status: 'shipped',
    shipped_at: new Date().toISOString(),
    // Use PostgreSQL CASE expression for conditional updates
    tracking_number: client.raw(`
      CASE 
        WHEN shipping_method = 'express' THEN 'EXP' || nextval('tracking_seq')
        WHEN shipping_method = 'standard' THEN 'STD' || nextval('tracking_seq')
        ELSE 'REG' || nextval('tracking_seq')
      END
    `)
  })
  .eq('status', 'processing')
  .execute();
```

### JSON/JSONB Updates

```typescript
// Update JSON fields
const jsonFieldUpdate = await client
  .from('users')
  .update({
    // Update specific JSON keys
    'preferences->theme': 'dark',
    'preferences->notifications->email': false,
    // Update entire JSON object
    metadata: {
      last_updated: new Date().toISOString(),
      update_source: 'user_preferences',
      version: 2
    }
  })
  .eq('id', 123)
  .execute();

// Merge JSON objects
const mergeJsonUpdate = await client
  .from('user_settings')
  .update({
    // Use PostgreSQL jsonb_set for complex updates
    settings: client.raw(`
      jsonb_set(
        jsonb_set(settings, '{ui,theme}', '"dark"'),
        '{notifications,email}', 'false'
      )
    `)
  })
  .eq('user_id', 123)
  .execute();
```

### Array Updates

```typescript
// Update array fields
const arrayUpdate = await client
  .from('posts')
  .update({
    tags: ['javascript', 'typescript', 'react', 'hooks'],  // Replace entire array
    updated_at: new Date().toISOString()
  })
  .eq('id', 789)
  .execute();

// Append to array using PostgreSQL functions
const appendToArray = await client
  .from('posts')
  .update({
    tags: client.raw("array_append(tags, 'new-tag')"),
    categories: client.raw("array_cat(categories, ARRAY[4, 5])")
  })
  .eq('id', 789)
  .execute();

// Remove from array
const removeFromArray = await client
  .from('posts')
  .update({
    tags: client.raw("array_remove(tags, 'old-tag')"),
    updated_at: new Date().toISOString()
  })
  .eq('id', 789)
  .execute();
```

## Error Handling and Validation

### Comprehensive Error Handling

```typescript
interface UpdateResult<T> {
  success: boolean;
  data?: T[];
  error?: string;
  updatedCount?: number;
}

const safeUpdate = async <T>(
  table: string,
  updates: Partial<T>,
  conditions: Record<string, any>
): Promise<UpdateResult<T>> => {
  try {
    let query = client.from(table).update(updates);

    // Apply conditions
    Object.entries(conditions).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const result = await query.execute();

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
        updatedCount: 0
      };
    }

    return {
      success: true,
      data: result.data,
      updatedCount: result.data.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      updatedCount: 0
    };
  }
};

// Usage
const updateResult = await safeUpdate('users', 
  { name: 'Updated Name', age: 30 },
  { id: 123 }
);

if (updateResult.success) {
  console.log(`Updated ${updateResult.updatedCount} records`);
} else {
  console.error('Update failed:', updateResult.error);
}
```

### Input Validation

```typescript
// Validate update data
const validateUpdateData = (updates: any): string[] => {
  const errors: string[] = [];

  if (updates.email && !/\S+@\S+\.\S+/.test(updates.email)) {
    errors.push('Invalid email format');
  }

  if (updates.age && (updates.age < 0 || updates.age > 150)) {
    errors.push('Age must be between 0 and 150');
  }

  if (updates.price && updates.price < 0) {
    errors.push('Price cannot be negative');
  }

  return errors;
};

// Validated update
const updateWithValidation = async (id: number, updates: any) => {
  const validationErrors = validateUpdateData(updates);
  
  if (validationErrors.length > 0) {
    throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
  }

  return client
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .execute();
};
```

### Conflict Resolution

```typescript
// Handle update conflicts gracefully
const updateWithConflictResolution = async (
  id: number, 
  updates: any, 
  strategy: 'overwrite' | 'merge' | 'fail' = 'merge'
) => {
  try {
    // Get current data
    const current = await client
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()
      .execute();

    if (current.error) {
      throw new Error('Document not found');
    }

    let finalUpdates = updates;

    switch (strategy) {
      case 'overwrite':
        // Use updates as-is
        break;
        
      case 'merge':
        // Merge with current data
        finalUpdates = { ...current.data, ...updates };
        break;
        
      case 'fail':
        // Check if any fields have changed
        const hasConflicts = Object.keys(updates).some(
          key => current.data[key] !== updates[key] && 
                 current.data.updated_at > new Date(Date.now() - 60000) // Modified in last minute
        );
        
        if (hasConflicts) {
          throw new Error('Concurrent modification detected');
        }
        break;
    }

    const result = await client
      .from('documents')
      .update({
        ...finalUpdates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .execute();

    return result.data[0];
  } catch (error) {
    console.error('Update conflict resolution failed:', error);
    throw error;
  }
};
```

## Performance Optimization

### Efficient Update Patterns

```typescript
// Batch updates for better performance
const efficientBulkUpdate = async (updates: Array<{id: number, data: any}>) => {
  // Group updates by similar patterns
  const grouped = updates.reduce((acc, update) => {
    const keys = Object.keys(update.data).sort().join(',');
    if (!acc[keys]) acc[keys] = [];
    acc[keys].push(update);
    return acc;
  }, {} as Record<string, typeof updates>);

  const results = [];
  
  // Process each group
  for (const [keys, group] of Object.entries(grouped)) {
    if (group.length === 1) {
      // Single update
      const { id, data } = group[0];
      const result = await client
        .from('users')
        .update(data)
        .eq('id', id)
        .execute();
      results.push(...result.data);
    } else {
      // If all updates have same data, do bulk update
      const sampleData = group[0].data;
      const allSame = group.every(item => 
        JSON.stringify(item.data) === JSON.stringify(sampleData)
      );
      
      if (allSame) {
        const ids = group.map(item => item.id);
        const result = await client
          .from('users')
          .update(sampleData)
          .in('id', ids)
          .execute();
        results.push(...result.data);
      } else {
        // Individual updates for different data
        for (const { id, data } of group) {
          const result = await client
            .from('users')
            .update(data)
            .eq('id', id)
            .execute();
          results.push(...result.data);
        }
      }
    }
  }

  return results;
};
```

### Minimal Data Updates

```typescript
// Update only changed fields
const updateOnlyChanged = async (id: number, newData: any) => {
  // Get current data
  const current = await client
    .from('users')
    .select('*')
    .eq('id', id)
    .single()
    .execute();

  if (current.error) {
    throw new Error('Record not found');
  }

  // Find only changed fields
  const changes: any = {};
  Object.keys(newData).forEach(key => {
    if (current.data[key] !== newData[key]) {
      changes[key] = newData[key];
    }
  });

  // Only update if there are changes
  if (Object.keys(changes).length === 0) {
    console.log('No changes detected, skipping update');
    return current.data;
  }

  changes.updated_at = new Date().toISOString();

  const result = await client
    .from('users')
    .update(changes)
    .eq('id', id)
    .single()
    .execute();

  return result.data;
};
```

---

## Summary

PGRestify's record update capabilities provide:

- **Flexible Updates**: Partial, conditional, and bulk update operations
- **Type Safety**: Full TypeScript support for update operations
- **Optimistic Locking**: Version and timestamp-based concurrency control  
- **Advanced Patterns**: JSON/JSONB updates, array operations, and SQL expressions
- **Error Handling**: Comprehensive error management and validation
- **Performance**: Efficient bulk operations and minimal data transfer
- **Conflict Resolution**: Strategies for handling concurrent modifications
- **Safe Operations**: Existence checks and constraint handling

Master these update patterns to build robust data modification workflows that handle concurrency, maintain data integrity, and perform efficiently at scale.