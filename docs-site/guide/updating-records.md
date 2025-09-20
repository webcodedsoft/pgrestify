# Updating Records

Master data updates in PGRestify with both PostgREST syntax and ORM-style repositories for partial updates, conditional updates, bulk updates, optimistic locking, and return specifications.

## Overview

Updating records in PGRestify provides flexible and safe data modification capabilities with two powerful approaches:

- **🎯 PostgREST Native Syntax**: Direct `.update()` methods with condition chaining
- **🏗️ ORM-Style Repository Pattern**: Repository methods like `.save()`, `.update()`, and query builder updates

Both approaches offer full type safety, conditional updates, and performance optimization.

## Basic Record Updates

### Single Record Update

::: code-group

```typescript [PostgREST Syntax]
import { createClient } from '@webcoded/pgrestify';

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

```typescript [Repository Pattern]
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000'
});

// Get repository for users table
const userRepo = client.getRepository<User>('users');

// Method 1: Update using save (if you have the full entity)
const user = await userRepo.findOne({ id: 123 });
if (user) {
  user.name = 'John Updated';
  user.age = 31;
  user.updated_at = new Date().toISOString();
  
  const updatedUser = await userRepo.save(user);
  console.log('Updated user:', updatedUser);
}

// Method 2: Direct update with conditions
const updatedUsers = await userRepo.update(
  { id: 123 }, // where condition
  {
    name: 'John Updated',
    age: 31,
    updated_at: new Date().toISOString()
  }
);

console.log('Updated users:', updatedUsers);
```

:::

### Partial Updates

::: code-group

```typescript [PostgREST Syntax]
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

```typescript [Repository Pattern]
// Repository partial updates
const userRepo = client.getRepository<User>('users');

// Update only specific fields
const partialUpdate = await userRepo.update(
  { id: 123 },
  {
    last_login: new Date().toISOString()
    // Only updates last_login, other fields remain unchanged
  }
);

// Update using query builder for complex conditions
const queryBuilderUpdate = await userRepo
  .createQueryBuilder()
  .update({
    last_login: new Date().toISOString(),
    status: 'active'
  })
  .where('id = :id', { id: 123 })
  .execute();

// Note: JSON field updates with repository pattern
// would typically involve reading, modifying, and saving
const user = await userRepo.findOne({ id: 123 });
if (user && user.preferences) {
  user.preferences.theme = 'dark';
  user.preferences.language = 'en';
  await userRepo.save(user);
}
```

:::

### Type-Safe Updates

::: code-group

```typescript [PostgREST Syntax]
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

```typescript [Repository Pattern]
interface User {
  id: number;
  name: string;
  email: string;
  age?: number;
  is_active: boolean;
  updated_at: string;
}

// Get typed repository
const userRepo = client.getRepository<User>('users');

// Type-safe repository update
const typedUpdate = await userRepo.update(
  { id: 456 },
  {
    name: 'Jane Updated',
    age: 28
    // TypeScript ensures only valid User fields can be updated
  }
);

// TypeScript prevents invalid updates
// userRepo.update({ id: 456 }, { invalid_field: 'value' });  // ❌ TypeScript error

// Type-safe query builder update
const qbUpdate = await userRepo
  .createQueryBuilder()
  .update({
    name: 'Jane Updated',
    age: 28
  })
  .where('id = :id', { id: 456 })
  .execute();
```

:::

## Conditional Updates

### Single Condition Updates

::: code-group

```typescript [PostgREST Syntax]
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
```

```typescript [Repository Pattern]
// Repository conditional updates
const userRepo = client.getRepository<User>('users');

// Update with multiple conditions using query builder
const conditionalUpdate = await userRepo
  .createQueryBuilder()
  .update({
    status: 'verified',
    verified_at: new Date().toISOString()
  })
  .where('email_verified = :verified', { verified: true })
  .andWhere('verified_at IS NULL')
  .execute();

// Alternative: Find and update pattern
const usersToUpdate = await userRepo
  .createQueryBuilder()
  .where('email_verified = :verified', { verified: true })
  .andWhere('verified_at IS NULL')
  .getMany();

for (const user of usersToUpdate) {
  user.status = 'verified';
  user.verified_at = new Date().toISOString();
  await userRepo.save(user);
}
```

:::

### Multiple Condition Updates

::: code-group

```typescript [PostgREST Syntax]
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

```typescript [Repository Pattern]
// Repository complex condition updates
const productRepo = client.getRepository<Product>('products');
const orderRepo = client.getRepository<Order>('orders');

// Update with complex conditions using query builder
const complexUpdate = await productRepo
  .createQueryBuilder()
  .update({
    status: 'discontinued',
    updated_at: new Date().toISOString()
  })
  .where('stock_quantity < :stock', { stock: 5 })
  .andWhere('is_active = :active', { active: true })
  .andWhere('last_sold < :date', { date: '2023-01-01' })
  .execute();

// Update with OR conditions using query builder
const orConditionUpdate = await orderRepo
  .createQueryBuilder()
  .update({
    priority: 'high',
    updated_at: new Date().toISOString()
  })
  .where('total_amount >= :amount', { amount: 1000 })
  .orWhere('customer_tier = :tier', { tier: 'premium' })
  .execute();

// Alternative: Complex conditions with custom repository
class ProductRepository extends CustomRepositoryBase<Product> {
  async discontinueOldLowStockProducts() {
    return this.createQueryBuilder()
      .update({
        status: 'discontinued',
        updated_at: new Date().toISOString()
      })
      .where('stock_quantity < :stock', { stock: 5 })
      .andWhere('is_active = :active', { active: true })
      .andWhere('last_sold < :date', { date: '2023-01-01' })
      .execute();
  }
}

const customProductRepo = client.getCustomRepository(ProductRepository);
const result = await customProductRepo.discontinueOldLowStockProducts();
```

:::

### Existence-Based Updates

::: code-group

```typescript [PostgREST Syntax]
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

```typescript [Repository Pattern]
// Repository-based existence updates
const userRepo = client.getRepository<User>('users');

// Method 1: Repository built-in existence checking
const safeUpdateRepo = async (userId: number, updates: Partial<User>) => {
  // findOne returns null if not found
  const existingUser = await userRepo.findOne({ id: userId });
  
  if (!existingUser) {
    throw new Error(`User with ID ${userId} not found`);
  }

  // Update existing user
  const updatedUser = { ...existingUser, ...updates };
  return await userRepo.save(updatedUser);
};

// Method 2: Direct update with existence validation
const safeDirectUpdate = async (userId: number, updates: Partial<User>) => {
  const result = await userRepo.update({ id: userId }, updates);
  
  if (result.length === 0) {
    throw new Error(`User with ID ${userId} not found`);
  }
  
  return result[0];
};

// Method 3: Custom repository with built-in safety
class UserRepository extends CustomRepositoryBase<User> {
  async safeUpdate(userId: number, updates: Partial<User>) {
    const user = await this.findOne({ id: userId });
    
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    return this.save({ ...user, ...updates });
  }

  async updateIfExists(userId: number, updates: Partial<User>) {
    const result = await this.update({ id: userId }, updates);
    return result.length > 0 ? result[0] : null;
  }
}

const customUserRepo = client.getCustomRepository(UserRepository);

// Usage
try {
  const updatedUser = await customUserRepo.safeUpdate(123, {
    name: 'Safe Updated Name',
    age: 35
  });
  console.log('User updated safely:', updatedUser);
} catch (error) {
  console.error('Update failed:', error.message);
}

// Alternative: Silent update (returns null if not found)
const result = await customUserRepo.updateIfExists(123, {
  name: 'Safe Updated Name',
  age: 35
});

if (result) {
  console.log('User updated:', result);
} else {
  console.log('User not found, no update performed');
}
```

:::

## Bulk Updates

### Multiple Records Update

::: code-group

```typescript [PostgREST Syntax]
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

```typescript [Repository Pattern]
// Repository bulk updates
const orderRepo = client.getRepository<Order>('orders');

// Method 1: Repository update with conditions
const bulkStatusUpdate = await orderRepo.update(
  { 
    status: 'pending',
    created_at: { gte: '2024-01-01' }
  },
  {
    status: 'processing',
    processing_started_at: new Date().toISOString()
  }
);

console.log(`Updated ${bulkStatusUpdate.length} orders to processing`);

// Method 2: Query builder bulk update
const qbBulkUpdate = await orderRepo
  .createQueryBuilder()
  .update({
    status: 'processing',
    processing_started_at: new Date().toISOString()
  })
  .where('status = :status', { status: 'pending' })
  .andWhere('created_at >= :date', { date: '2024-01-01' })
  .execute();

// Method 3: Custom repository with business logic
class OrderRepository extends CustomRepositoryBase<Order> {
  async startProcessingPendingOrders(sinceDate: string) {
    return this.createQueryBuilder()
      .update({
        status: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .where('status = :status', { status: 'pending' })
      .andWhere('created_at >= :date', { date: sinceDate })
      .execute();
  }

  async bulkUpdateStatus(fromStatus: string, toStatus: string, additionalUpdates: Partial<Order> = {}) {
    return this.update(
      { status: fromStatus },
      { 
        ...additionalUpdates,
        status: toStatus,
        updated_at: new Date().toISOString()
      }
    );
  }
}

const customOrderRepo = client.getCustomRepository(OrderRepository);
const result = await customOrderRepo.startProcessingPendingOrders('2024-01-01');
console.log(`Updated ${result.length} orders to processing`);
```

:::

### Conditional Bulk Updates

::: code-group

```typescript [PostgREST Syntax]
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

```typescript [Repository Pattern]
// Repository conditional bulk updates
const productRepo = client.getRepository<Product>('products');
const customerRepo = client.getRepository<Customer>('customers');

// Bulk price update with raw SQL expressions
const bulkPriceUpdate = await productRepo
  .createQueryBuilder()
  .update({
    price: client.raw('price * 1.1'),  // Increase price by 10%
    updated_at: new Date().toISOString()
  })
  .where('category = :category', { category: 'electronics' })
  .andWhere('created_at >= :date', { date: '2023-01-01' })
  .execute();

// Tiered update with custom repository methods
class CustomerRepository extends CustomRepositoryBase<Customer> {
  async upgradePremiumCustomers(spentThreshold: number = 10000) {
    return this.update(
      { 
        tier: 'premium',
        total_spent: { gte: spentThreshold }
      },
      {
        discount_rate: 0.15,
        tier: 'premium_plus',
        updated_at: new Date().toISOString()
      }
    );
  }

  async upgradeRegularCustomers(spentThreshold: number = 5000) {
    return this.update(
      {
        tier: 'regular',
        total_spent: { gte: spentThreshold }
      },
      {
        discount_rate: 0.05,
        tier: 'regular_plus',
        updated_at: new Date().toISOString()
      }
    );
  }

  async performTieredUpdate() {
    const [premiumUpdate, regularUpdate] = await Promise.all([
      this.upgradePremiumCustomers(10000),
      this.upgradeRegularCustomers(5000)
    ]);

    return {
      premiumUpdated: premiumUpdate.length,
      regularUpdated: regularUpdate.length
    };
  }
}

// Usage with custom repository
const customCustomerRepo = client.getCustomRepository(CustomerRepository);
const tieredUpdateResult = await customCustomerRepo.performTieredUpdate();

// Alternative: Using standard repository with parallel updates
const tieredUpdate = async () => {
  const [premiumUpdate, regularUpdate] = await Promise.all([
    customerRepo.update(
      { tier: 'premium', total_spent: { gte: 10000 } },
      { discount_rate: 0.15, tier: 'premium_plus' }
    ),
    customerRepo.update(
      { tier: 'regular', total_spent: { gte: 5000 } },
      { discount_rate: 0.05, tier: 'regular_plus' }
    )
  ]);

  return {
    premiumUpdated: premiumUpdate.length,
    regularUpdated: regularUpdate.length
  };
};
```

:::

### Batch Update with Different Values

::: code-group

```typescript [PostgREST Syntax]
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

```typescript [Repository Pattern]
// Repository batch updates with different values
const userRepo = client.getRepository<User>('users');

// Method 1: Sequential updates with repository
const batchUpdateSequential = async (updates: Array<{ id: number; data: Partial<User> }>) => {
  const results = [];
  const errors = [];

  for (const { id, data } of updates) {
    try {
      const result = await userRepo.update({ id }, data);
      
      if (result.length > 0) {
        results.push(result[0]);
      } else {
        errors.push({ id, error: 'User not found' });
      }
    } catch (error) {
      errors.push({ id, error: error.message });
    }
  }

  return { results, errors };
};

// Method 2: Parallel updates with Promise.allSettled
const batchUpdateParallel = async (updates: Array<{ id: number; data: Partial<User> }>) => {
  const updatePromises = updates.map(async ({ id, data }) => {
    try {
      const result = await userRepo.update({ id }, data);
      return { id, success: true, data: result[0] };
    } catch (error) {
      return { id, success: false, error: error.message };
    }
  });

  const results = await Promise.allSettled(updatePromises);
  
  const successful = results
    .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
    .map(result => result.value)
    .filter(value => value.success);

  const failed = results
    .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
    .map(result => result.value)
    .filter(value => !value.success);

  return {
    results: successful.map(s => s.data),
    errors: failed.map(f => ({ id: f.id, error: f.error }))
  };
};

// Method 3: Custom repository with batch update logic
class UserRepository extends CustomRepositoryBase<User> {
  async batchUpdate(updates: Array<{ id: number; data: Partial<User> }>) {
    const results = [];
    const errors = [];

    // Group updates by similarity to optimize
    const groupedUpdates = this.groupUpdatesByFields(updates);
    
    for (const group of groupedUpdates) {
      try {
        if (group.length === 1) {
          // Single update
          const { id, data } = group[0];
          const result = await this.update({ id }, data);
          if (result.length > 0) {
            results.push({ id, data: result[0] });
          } else {
            errors.push({ id, error: 'User not found' });
          }
        } else {
          // Bulk update if all have same fields
          const sampleData = group[0].data;
          const allSameFields = group.every(item => 
            Object.keys(item.data).sort().join(',') === Object.keys(sampleData).sort().join(',')
          );

          if (allSameFields && this.allHaveSameValues(group)) {
            // True bulk update
            const ids = group.map(item => item.id);
            const bulkResult = await this.update(
              { id: { in: ids } },
              sampleData
            );
            results.push(...bulkResult.map(data => ({ id: data.id, data })));
          } else {
            // Individual updates
            for (const { id, data } of group) {
              const result = await this.update({ id }, data);
              if (result.length > 0) {
                results.push({ id, data: result[0] });
              } else {
                errors.push({ id, error: 'User not found' });
              }
            }
          }
        }
      } catch (error) {
        for (const { id } of group) {
          errors.push({ id, error: error.message });
        }
      }
    }

    return { results, errors };
  }

  private groupUpdatesByFields(updates: Array<{ id: number; data: any }>) {
    const groups = new Map();
    
    for (const update of updates) {
      const fieldKey = Object.keys(update.data).sort().join(',');
      if (!groups.has(fieldKey)) {
        groups.set(fieldKey, []);
      }
      groups.get(fieldKey).push(update);
    }
    
    return Array.from(groups.values());
  }

  private allHaveSameValues(group: Array<{ id: number; data: any }>) {
    if (group.length <= 1) return true;
    const first = JSON.stringify(group[0].data);
    return group.every(item => JSON.stringify(item.data) === first);
  }
}

// Usage
const customUserRepo = client.getCustomRepository(UserRepository);

const updateBatch = [
  { id: 1, data: { name: 'User One Updated', age: 25 } },
  { id: 2, data: { name: 'User Two Updated', age: 30 } },
  { id: 3, data: { status: 'inactive' } }
];

const batchResult = await customUserRepo.batchUpdate(updateBatch);
console.log(`Success: ${batchResult.results.length}, Errors: ${batchResult.errors.length}`);

// Simple parallel update
const parallelResult = await batchUpdateParallel(updateBatch);
console.log(`Success: ${parallelResult.results.length}, Errors: ${parallelResult.errors.length}`);
```

:::

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

::: code-group

```typescript [PostgREST Syntax]
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

```typescript [Repository Pattern]
// Repository return control
const productRepo = client.getRepository<Product>('products');

// Return all updated fields (default behavior)
const fullReturn = await productRepo.update(
  { id: 456 },
  {
    name: 'Updated Product',
    price: 199.99
  }
);

// Repository updates always return the full entity by default
// For partial returns, use query builder with select
const limitedReturn = await productRepo
  .createQueryBuilder()
  .update({
    name: 'Updated Product',
    price: 199.99,
    updated_at: new Date().toISOString()
  })
  .where('id = :id', { id: 456 })
  .select(['id', 'name', 'price', 'updated_at'])
  .execute();

// For performance updates with minimal return
const performanceUpdate = await productRepo
  .createQueryBuilder()
  .update({
    view_count: client.raw('view_count + 1')
  })
  .where('id = :id', { id: 456 })
  .select(['id'])  // Minimal return
  .execute();

// Custom repository for controlled returns
class ProductRepository extends CustomRepositoryBase<Product> {
  async incrementViewCount(id: number): Promise<{ id: number; view_count: number }> {
    const result = await this.createQueryBuilder()
      .update({
        view_count: client.raw('view_count + 1')
      })
      .where('id = :id', { id })
      .select(['id', 'view_count'])
      .execute();
    
    return result[0];
  }

  async updateWithMinimalReturn(id: number, updates: Partial<Product>) {
    return this.createQueryBuilder()
      .update(updates)
      .where('id = :id', { id })
      .select(['id', 'updated_at'])
      .execute();
  }
}
```

:::

### Single Record Return

::: code-group

```typescript [PostgREST Syntax]
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

```typescript [Repository Pattern]
// Repository single record returns
const userRepo = client.getRepository<User>('users');

// Method 1: Repository update (always returns array, get first item)
const updateResult = await userRepo.update(
  { id: 123 },
  {
    last_login: new Date().toISOString(),
    login_count: client.raw('login_count + 1')
  }
);

const singleUpdate = updateResult[0]; // Get first (and should be only) result
console.log('Updated user:', singleUpdate);

// Method 2: Custom repository method that ensures single return
class UserRepository extends CustomRepositoryBase<User> {
  async updateSingleUser(id: number, updates: Partial<User>): Promise<User> {
    const result = await this.update({ id }, updates);
    
    if (result.length === 0) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    if (result.length > 1) {
      throw new Error(`Multiple users found with ID ${id}`);
    }
    
    return result[0];
  }

  async updateLoginInfo(id: number): Promise<User> {
    const result = await this.createQueryBuilder()
      .update({
        last_login: new Date().toISOString(),
        login_count: client.raw('login_count + 1')
      })
      .where('id = :id', { id })
      .execute();
    
    if (result.length === 0) {
      throw new Error('User not found');
    }
    
    return result[0];
  }
}

const customUserRepo = client.getCustomRepository(UserRepository);

// Usage with guaranteed single return
try {
  const updatedUser = await customUserRepo.updateLoginInfo(123);
  console.log('Updated user:', updatedUser);
} catch (error) {
  console.error('Update failed:', error.message);
}

// Method 3: Using save for single record updates
const user = await userRepo.findOne({ id: 123 });
if (user) {
  user.last_login = new Date().toISOString();
  user.login_count = (user.login_count || 0) + 1;
  
  const updatedUser = await userRepo.save(user);
  console.log('Updated user:', updatedUser);
}
```

:::

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