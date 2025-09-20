# Creating Records

Master data insertion in PGRestify with single record creation, batch inserts, return specifications, default values, and constraint handling.

## Overview

Creating records in PGRestify is straightforward and type-safe. You can insert single records, batch multiple records, control what data is returned, and handle database constraints gracefully. All insertion operations use PostgreSQL's INSERT statement through PostgREST's API.

## Basic Record Creation

### Single Record Insert

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000'
});

// Insert a single user
const newUser = await client
  .from('users')
  .insert({
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    is_active: true
  })
  .execute();

console.log('Created user:', newUser.data);
// Returns: [{ id: 123, name: 'John Doe', email: 'john@example.com', ... }]
```

### Insert with Type Safety

```typescript
// Define your table interface
interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
  is_active: boolean;
  created_at: string;
}

// Type-safe insert
const typedUser = await client
  .from<User>('users')
  .insert({
    name: 'Jane Smith',
    email: 'jane@example.com',
    is_active: true
    // age is optional, id and created_at will be auto-generated
  })
  .execute();

// TypeScript ensures type safety
typedUser.data.forEach(user => {
  console.log(user.name);  // ✓ TypeScript knows this is string
  // console.log(user.invalid); // ❌ TypeScript error
});
```

### Insert with Column Transformation

```typescript
// With column transformation enabled
const transformedInsert = await client
  .from('users')
  .transformColumns(true)
  .insert({
    firstName: 'John',      // Transforms to first_name
    lastName: 'Doe',        // Transforms to last_name
    isActive: true          // Transforms to is_active
  })
  .execute();
```

## Return Specifications

### Controlling Returned Data

```typescript
// Return all fields (default)
const fullReturn = await client
  .from('products')
  .insert({
    name: 'New Product',
    price: 29.99,
    category_id: 1
  })
  .execute();

// Return only specific fields
const limitedReturn = await client
  .from('products')
  .insert({
    name: 'Another Product',
    price: 39.99,
    category_id: 2
  })
  .select('id, name, created_at')
  .execute();

// Return nothing (minimal response)
const noReturn = await client
  .from('products')
  .insert({
    name: 'Silent Product',
    price: 19.99,
    category_id: 1
  })
  .select('')  // Empty select returns minimal data
  .execute();
```

### Single Record Return

```typescript
// Ensure single record return
const singleUser = await client
  .from('users')
  .insert({
    name: 'Single User',
    email: 'single@example.com'
  })
  .single()  // Ensures single object return, not array
  .execute();

console.log(singleUser.data); // Single object, not array
```

## Batch Operations

### Multiple Record Insert

```typescript
// Insert multiple records at once
const multipleUsers = await client
  .from('users')
  .insert([
    {
      name: 'User One',
      email: 'user1@example.com',
      age: 25
    },
    {
      name: 'User Two',
      email: 'user2@example.com',
      age: 30
    },
    {
      name: 'User Three',
      email: 'user3@example.com',
      age: 35
    }
  ])
  .execute();

console.log(`Created ${multipleUsers.data.length} users`);
```

### Large Batch Inserts

```typescript
// Efficient large batch insert
const insertLargeBatch = async (records: any[], batchSize = 100) => {
  const results = [];
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const result = await client
      .from('data_table')
      .insert(batch)
      .execute();
    
    if (result.error) {
      console.error(`Batch ${i / batchSize + 1} failed:`, result.error);
      throw new Error(`Failed to insert batch starting at index ${i}`);
    }
    
    results.push(...result.data);
    console.log(`Inserted batch ${i / batchSize + 1}, total: ${results.length}`);
  }
  
  return results;
};

// Usage
const thousandRecords = Array.from({ length: 1000 }, (_, i) => ({
  name: `Record ${i + 1}`,
  value: Math.random(),
  created_at: new Date().toISOString()
}));

const insertedRecords = await insertLargeBatch(thousandRecords, 50);
```

### Bulk Insert with Error Handling

```typescript
// Robust bulk insert with individual error handling
const bulkInsertWithErrorHandling = async (records: any[]) => {
  const successful = [];
  const failed = [];

  for (const [index, record] of records.entries()) {
    try {
      const result = await client
        .from('users')
        .insert(record)
        .single()
        .execute();

      if (result.error) {
        failed.push({ index, record, error: result.error });
      } else {
        successful.push(result.data);
      }
    } catch (error) {
      failed.push({ index, record, error: error.message });
    }
  }

  return {
    successful,
    failed,
    successCount: successful.length,
    failureCount: failed.length
  };
};

// Usage
const mixedQualityData = [
  { name: 'Good User', email: 'good@example.com' },
  { name: 'Bad User', email: 'invalid-email' },  // This might fail validation
  { name: 'Another Good', email: 'another@example.com' }
];

const bulkResult = await bulkInsertWithErrorHandling(mixedQualityData);
console.log(`Success: ${bulkResult.successCount}, Failed: ${bulkResult.failureCount}`);
```

## Default Values and Auto-Generation

### Working with Database Defaults

```typescript
// Let database handle default values
const userWithDefaults = await client
  .from('users')
  .insert({
    name: 'User with Defaults',
    email: 'defaults@example.com'
    // id, created_at, updated_at, is_active will use database defaults
  })
  .execute();

// Explicitly override defaults when needed
const userOverridingDefaults = await client
  .from('users')
  .insert({
    name: 'Custom User',
    email: 'custom@example.com',
    is_active: false,  // Override default of true
    created_at: '2024-01-01T00:00:00Z'  // Custom creation time
  })
  .execute();
```

### Handling Auto-Incrementing IDs

```typescript
// Insert and get auto-generated ID
const newProduct = await client
  .from('products')
  .insert({
    name: 'New Product',
    description: 'Product description',
    price: 99.99
  })
  .select('id, name')  // Get the generated ID back
  .single()
  .execute();

console.log(`Created product with ID: ${newProduct.data.id}`);

// Use returned ID for related records
const productImages = await client
  .from('product_images')
  .insert([
    {
      product_id: newProduct.data.id,
      url: 'https://example.com/image1.jpg',
      is_primary: true
    },
    {
      product_id: newProduct.data.id,
      url: 'https://example.com/image2.jpg',
      is_primary: false
    }
  ])
  .execute();
```

### Working with UUIDs

```typescript
// When using UUID primary keys
const uuidRecord = await client
  .from('uuid_table')
  .insert({
    name: 'UUID Record',
    data: { key: 'value' }
    // uuid field will be auto-generated by database
  })
  .select('uuid, name, created_at')
  .single()
  .execute();

console.log(`Created record with UUID: ${uuidRecord.data.uuid}`);
```

## Constraint Handling

### Unique Constraint Handling

```typescript
// Handle unique constraint violations gracefully
const insertWithUniqueHandling = async (userData: any) => {
  try {
    const result = await client
      .from('users')
      .insert(userData)
      .single()
      .execute();

    if (result.error) {
      // Check for unique constraint violation
      if (result.error.message?.includes('duplicate key')) {
        console.log('User with this email already exists');
        
        // Try to find existing user
        const existingUser = await client
          .from('users')
          .select('*')
          .eq('email', userData.email)
          .single()
          .execute();
          
        return { data: existingUser.data, wasExisting: true };
      }
      throw new Error(`Insert failed: ${result.error.message}`);
    }

    return { data: result.data, wasExisting: false };
  } catch (error) {
    console.error('Insert error:', error);
    throw error;
  }
};

// Usage
const userResult = await insertWithUniqueHandling({
  name: 'John Doe',
  email: 'existing@example.com'  // This email might already exist
});

if (userResult.wasExisting) {
  console.log('Found existing user:', userResult.data.name);
} else {
  console.log('Created new user:', userResult.data.name);
}
```

### Foreign Key Constraint Handling

```typescript
// Handle foreign key constraints
const insertWithForeignKeyCheck = async (orderData: any) => {
  try {
    // First check if customer exists
    const customer = await client
      .from('customers')
      .select('id')
      .eq('id', orderData.customer_id)
      .single()
      .execute();

    if (customer.error || !customer.data) {
      throw new Error(`Customer with ID ${orderData.customer_id} does not exist`);
    }

    // Customer exists, proceed with order
    const result = await client
      .from('orders')
      .insert(orderData)
      .single()
      .execute();

    if (result.error) {
      throw new Error(`Order creation failed: ${result.error.message}`);
    }

    return result.data;
  } catch (error) {
    console.error('Order creation error:', error);
    throw error;
  }
};

// Usage
try {
  const newOrder = await insertWithForeignKeyCheck({
    customer_id: 123,
    total_amount: 299.99,
    status: 'pending'
  });
  console.log('Order created:', newOrder);
} catch (error) {
  console.error('Failed to create order:', error.message);
}
```

### Check Constraint Validation

```typescript
// Handle check constraint violations
const insertWithValidation = async (productData: any) => {
  // Client-side validation before insert
  if (productData.price < 0) {
    throw new Error('Price must be non-negative');
  }
  
  if (productData.stock_quantity < 0) {
    throw new Error('Stock quantity cannot be negative');
  }

  try {
    const result = await client
      .from('products')
      .insert(productData)
      .single()
      .execute();

    if (result.error) {
      // Handle database constraint violations
      if (result.error.message?.includes('check constraint')) {
        throw new Error('Product data violates business rules');
      }
      throw new Error(`Insert failed: ${result.error.message}`);
    }

    return result.data;
  } catch (error) {
    console.error('Product insert error:', error);
    throw error;
  }
};
```

## Advanced Insert Patterns

### Conditional Insert

```typescript
// Insert only if condition is met
const conditionalInsert = async (userData: any) => {
  // Check condition first
  const existingUser = await client
    .from('users')
    .select('id')
    .eq('email', userData.email)
    .execute();

  if (existingUser.data.length > 0) {
    console.log('User already exists, skipping insert');
    return existingUser.data[0];
  }

  // Proceed with insert
  const result = await client
    .from('users')
    .insert(userData)
    .single()
    .execute();

  return result.data;
};
```

### Insert with Relationship Data

::: code-group

```typescript [PostgREST Syntax]
// Create related records in sequence
const createUserWithProfile = async (userData: any, profileData: any) => {
  try {
    // Create user first
    const user = await client
      .from('users')
      .insert(userData)
      .select('id, name, email')
      .single()
      .execute();

    if (user.error) {
      throw new Error(`User creation failed: ${user.error.message}`);
    }

    // Create profile with user ID
    const profile = await client
      .from('user_profiles')
      .insert({
        ...profileData,
        user_id: user.data.id
      })
      .single()
      .execute();

    if (profile.error) {
      // Rollback user creation if profile fails
      await client
        .from('users')
        .delete()
        .eq('id', user.data.id)
        .execute();
        
      throw new Error(`Profile creation failed: ${profile.error.message}`);
    }

    return {
      user: user.data,
      profile: profile.data
    };
  } catch (error) {
    console.error('User with profile creation error:', error);
    throw error;
  }
};
```

```typescript [Repository Pattern]
// Repository approach with cleaner business logic
const createUserWithProfile = async (userData: any, profileData: any) => {
  const userRepo = client.getRepository<User>('users');
  const profileRepo = client.getRepository<UserProfile>('user_profiles');
  
  try {
    // Create user first
    const user = await userRepo.save(userData);

    // Create profile with user ID
    const profile = await profileRepo.save({
      ...profileData,
      user_id: user.id
    });

    return { user, profile };
  } catch (error) {
    console.error('User with profile creation error:', error);
    throw error;
  }
};

// Alternative: Custom repository with encapsulated business logic
import { CustomRepositoryBase } from '@webcoded/pgrestify';

class UserRepository extends CustomRepositoryBase<User> {
  async createWithProfile(userData: Partial<User>, profileData: Partial<UserProfile>) {
    try {
      // Create user
      const user = await this.save(userData);
      
      // Create profile
      const profileRepo = client.getRepository<UserProfile>('user_profiles');
      const profile = await profileRepo.save({
        ...profileData,
        user_id: user.id
      });
      
      return { user, profile };
    } catch (error) {
      // Handle rollback logic here if needed
      throw error;
    }
  }
}

// Usage with custom repository
const userRepo = client.getCustomRepository(UserRepository, 'users');
const result = await userRepo.createWithProfile(userData, profileData);
```

:::

// Usage
const userWithProfile = await createUserWithProfile(
  {
    name: 'John Doe',
    email: 'john@example.com'
  },
  {
    bio: 'Software developer',
    avatar_url: 'https://example.com/avatar.jpg',
    birth_date: '1990-01-15'
  }
);
```

### Insert with JSON/JSONB Data

```typescript
// Insert records with JSON data
const insertWithJsonData = await client
  .from('user_settings')
  .insert({
    user_id: 123,
    preferences: {
      theme: 'dark',
      language: 'en',
      notifications: {
        email: true,
        push: false,
        sms: false
      }
    },
    metadata: {
      last_updated: new Date().toISOString(),
      version: '1.0'
    }
  })
  .execute();

// Insert with complex nested JSON
const complexJsonInsert = await client
  .from('analytics_events')
  .insert({
    event_name: 'user_action',
    properties: {
      action: 'button_click',
      component: 'header',
      metadata: {
        timestamp: Date.now(),
        user_agent: 'Mozilla/5.0...',
        session_id: 'sess_123456'
      },
      custom_data: {
        experiment_variant: 'A',
        feature_flags: ['new_ui', 'advanced_search']
      }
    }
  })
  .execute();
```

### Insert with Array Data

```typescript
// Insert records with array columns
const insertWithArrays = await client
  .from('posts')
  .insert({
    title: 'My Blog Post',
    content: 'Post content here...',
    tags: ['javascript', 'typescript', 'react'],
    categories: [1, 2, 5],  // Array of category IDs
    metadata: {
      keywords: ['programming', 'tutorial', 'web development']
    }
  })
  .execute();
```

## Error Handling and Validation

### Comprehensive Error Handling

```typescript
interface InsertResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

const safeInsert = async <T>(
  table: string,
  data: Partial<T>
): Promise<InsertResult<T>> => {
  try {
    const result = await client
      .from(table)
      .insert(data)
      .single()
      .execute();

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
        errorCode: result.status?.toString()
      };
    }

    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      errorCode: 'NETWORK_ERROR'
    };
  }
};

// Usage
const insertResult = await safeInsert('users', {
  name: 'Test User',
  email: 'test@example.com'
});

if (insertResult.success) {
  console.log('User created:', insertResult.data);
} else {
  console.error('Insert failed:', insertResult.error);
}
```

### Input Validation

```typescript
// Validation helper
const validateUserInput = (userData: any): string[] => {
  const errors: string[] = [];

  if (!userData.name || userData.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  }

  if (!userData.email || !/\S+@\S+\.\S+/.test(userData.email)) {
    errors.push('Valid email is required');
  }

  if (userData.age && (userData.age < 13 || userData.age > 120)) {
    errors.push('Age must be between 13 and 120');
  }

  return errors;
};

// Validated insert
const insertUserWithValidation = async (userData: any) => {
  const validationErrors = validateUserInput(userData);
  
  if (validationErrors.length > 0) {
    throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
  }

  return client
    .from('users')
    .insert(userData)
    .single()
    .execute();
};
```

## Performance Optimization

### Optimized Insert Patterns

```typescript
// Efficient batch insert
const optimizedBatchInsert = async (records: any[]) => {
  // Use single query for better performance
  const result = await client
    .from('bulk_data')
    .insert(records)
    .execute();  // Don't select unnecessary data

  return {
    insertedCount: result.data.length,
    success: !result.error
  };
};

// Memory-efficient streaming insert
const streamingInsert = async (dataStream: AsyncIterable<any>) => {
  const batchSize = 1000;
  let batch = [];
  let totalInserted = 0;

  for await (const record of dataStream) {
    batch.push(record);

    if (batch.length >= batchSize) {
      const result = await client
        .from('streaming_data')
        .insert(batch)
        .execute();

      if (result.error) {
        throw new Error(`Batch insert failed: ${result.error.message}`);
      }

      totalInserted += result.data.length;
      batch = [];
      
      console.log(`Inserted ${totalInserted} records so far`);
    }
  }

  // Insert remaining records
  if (batch.length > 0) {
    const result = await client
      .from('streaming_data')
      .insert(batch)
      .execute();

    totalInserted += result.data.length;
  }

  return totalInserted;
};
```

---

## Summary

PGRestify's record creation capabilities provide:

- **Simple API**: Intuitive insert methods with type safety
- **Batch Operations**: Efficient multi-record insertion
- **Flexible Returns**: Control what data is returned after insert
- **Constraint Handling**: Graceful handling of database constraints
- **Default Values**: Seamless integration with database defaults
- **Error Handling**: Comprehensive error management and validation
- **Performance**: Optimized patterns for large-scale insertions
- **JSON Support**: Native handling of JSON/JSONB data types

Master these insertion patterns to build robust data creation workflows that handle edge cases, maintain data integrity, and perform efficiently at scale.