# Transaction Patterns

Transactions ensure data consistency by grouping multiple operations into atomic units. While PostgREST doesn't directly support multi-statement transactions, PGRestify provides patterns and utilities for handling transactional workflows effectively.

## Understanding PostgREST Transactions

PostgREST operates on single-request transactions. Each HTTP request to PostgREST runs in its own database transaction, which commits automatically upon successful completion or rolls back on error.

```typescript
import { createClient } from 'pgrestify';

interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

interface Profile {
  id: string;
  user_id: string;
  bio: string;
  avatar_url?: string;
}

const client = createClient({ url: 'http://localhost:3000' });
```

## Single-Operation Transactions

### Atomic Operations

Each query is automatically wrapped in a transaction:

```typescript
// This entire operation is atomic
const user = await client
  .from<User>('users')
  .insert({
    email: 'john@example.com',
    name: 'John Doe'
  })
  .single()
  .execute();

// If this fails, nothing is inserted
console.log('User created:', user.data);
```

### Batch Operations as Transactions

Multiple records in a single operation are transactional:

```typescript
// All records inserted or none (atomic batch)
const users = await client
  .from<User>('users')
  .insert([
    { email: 'user1@example.com', name: 'User 1' },
    { email: 'user2@example.com', name: 'User 2' },
    { email: 'user3@example.com', name: 'User 3' }
  ])
  .execute();

// If any record fails validation, entire batch rolls back
```

### Complex Single Operations

Use database-level constraints and triggers for consistency:

```typescript
// Database ensures referential integrity
const profile = await client
  .from<Profile>('profiles')
  .insert({
    user_id: '123', // Must reference existing user
    bio: 'Software developer'
  })
  .execute();
```

## Multi-Operation Patterns

### Sequential Operations with Error Handling

```typescript
interface CreateUserWithProfileResult {
  user: User;
  profile: Profile;
}

async function createUserWithProfile(
  userData: Omit<User, 'id' | 'created_at'>,
  profileData: Omit<Profile, 'id' | 'user_id'>
): Promise<CreateUserWithProfileResult> {
  let createdUser: User | null = null;
  
  try {
    // Step 1: Create user
    const userResult = await client
      .from<User>('users')
      .insert(userData)
      .single()
      .execute();
    
    if (!userResult.data) {
      throw new Error('Failed to create user');
    }
    
    createdUser = userResult.data;
    
    // Step 2: Create profile
    const profileResult = await client
      .from<Profile>('profiles')
      .insert({
        ...profileData,
        user_id: createdUser.id
      })
      .single()
      .execute();
    
    if (!profileResult.data) {
      throw new Error('Failed to create profile');
    }
    
    return {
      user: createdUser,
      profile: profileResult.data
    };
    
  } catch (error) {
    // Cleanup: Delete user if profile creation failed
    if (createdUser) {
      try {
        await client
          .from<User>('users')
          .delete()
          .eq('id', createdUser.id)
          .execute();
        console.log('Cleaned up orphaned user:', createdUser.id);
      } catch (cleanupError) {
        console.error('Failed to cleanup user:', cleanupError);
      }
    }
    
    throw error;
  }
}

// Usage
try {
  const result = await createUserWithProfile(
    { email: 'john@example.com', name: 'John Doe' },
    { bio: 'Software developer' }
  );
  console.log('Success:', result);
} catch (error) {
  console.error('Transaction failed:', error);
}
```

### Saga Pattern Implementation

```typescript
interface SagaStep<T = any> {
  name: string;
  execute: () => Promise<T>;
  compensate?: (result?: T) => Promise<void>;
}

class Saga {
  private steps: SagaStep[] = [];
  private executedSteps: Array<{ step: SagaStep; result: any }> = [];
  
  addStep<T>(step: SagaStep<T>): Saga {
    this.steps.push(step);
    return this;
  }
  
  async execute(): Promise<any[]> {
    try {
      const results: any[] = [];
      
      for (const step of this.steps) {
        console.log(`Executing step: ${step.name}`);
        const result = await step.execute();
        
        this.executedSteps.push({ step, result });
        results.push(result);
      }
      
      return results;
      
    } catch (error) {
      console.error('Saga failed, rolling back...');
      await this.rollback();
      throw error;
    }
  }
  
  private async rollback(): Promise<void> {
    // Execute compensation actions in reverse order
    const stepsToCompensate = [...this.executedSteps].reverse();
    
    for (const { step, result } of stepsToCompensate) {
      if (step.compensate) {
        try {
          console.log(`Compensating step: ${step.name}`);
          await step.compensate(result);
        } catch (compensationError) {
          console.error(`Failed to compensate ${step.name}:`, compensationError);
        }
      }
    }
  }
}

// Usage example
async function createOrderSaga(orderData: any, paymentData: any) {
  const saga = new Saga();
  
  let createdOrder: any = null;
  let createdPayment: any = null;
  let updatedInventory: any = null;
  
  saga
    .addStep({
      name: 'create-order',
      execute: async () => {
        const result = await client
          .from('orders')
          .insert(orderData)
          .single()
          .execute();
        createdOrder = result.data;
        return createdOrder;
      },
      compensate: async (order) => {
        if (order) {
          await client
            .from('orders')
            .delete()
            .eq('id', order.id)
            .execute();
        }
      }
    })
    .addStep({
      name: 'reserve-inventory',
      execute: async () => {
        const result = await client
          .from('inventory')
          .update({ reserved: true })
          .eq('product_id', orderData.product_id)
          .execute();
        updatedInventory = result.data;
        return updatedInventory;
      },
      compensate: async () => {
        if (updatedInventory) {
          await client
            .from('inventory')
            .update({ reserved: false })
            .eq('product_id', orderData.product_id)
            .execute();
        }
      }
    })
    .addStep({
      name: 'process-payment',
      execute: async () => {
        const result = await client
          .from('payments')
          .insert({
            ...paymentData,
            order_id: createdOrder.id
          })
          .single()
          .execute();
        createdPayment = result.data;
        return createdPayment;
      },
      compensate: async (payment) => {
        if (payment) {
          await client
            .from('payments')
            .delete()
            .eq('id', payment.id)
            .execute();
        }
      }
    });
  
  return await saga.execute();
}
```

## Database-Level Transactions

### Using PostgreSQL Functions

Create PostgreSQL functions for complex transactions:

```sql
-- Database function for atomic user creation
CREATE OR REPLACE FUNCTION create_user_with_profile(
  user_email TEXT,
  user_name TEXT,
  profile_bio TEXT
) RETURNS JSON AS $$
DECLARE
  new_user_id UUID;
  result JSON;
BEGIN
  -- Insert user
  INSERT INTO users (email, name) 
  VALUES (user_email, user_name)
  RETURNING id INTO new_user_id;
  
  -- Insert profile
  INSERT INTO profiles (user_id, bio)
  VALUES (new_user_id, profile_bio);
  
  -- Return combined result
  SELECT json_build_object(
    'user', row_to_json(u.*),
    'profile', row_to_json(p.*)
  ) INTO result
  FROM users u
  LEFT JOIN profiles p ON p.user_id = u.id
  WHERE u.id = new_user_id;
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback happens automatically
    RAISE;
END;
$$ LANGUAGE plpgsql;
```

Call the function via RPC:

```typescript
// Use RPC for true database transactions
const result = await client
  .rpc('create_user_with_profile', {
    user_email: 'john@example.com',
    user_name: 'John Doe',
    profile_bio: 'Software developer'
  })
  .execute();

console.log('Transaction result:', result.data);
```

### Batch Operations with RPC

```typescript
// PostgreSQL function for batch processing
const batchResult = await client
  .rpc('process_order_batch', {
    orders: [
      { product_id: '1', quantity: 2, customer_id: '123' },
      { product_id: '2', quantity: 1, customer_id: '124' }
    ]
  })
  .execute();
```

## Error Handling Patterns

### Retry with Exponential Backoff

```typescript
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
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
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Usage
const result = await executeWithRetry(async () => {
  return await client
    .from<User>('users')
    .insert(userData)
    .execute();
});
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeout) {
        throw new Error('Circuit breaker is OPEN');
      } else {
        this.state = 'HALF_OPEN';
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

// Usage
const circuitBreaker = new CircuitBreaker();

const result = await circuitBreaker.execute(async () => {
  return await client
    .from<User>('users')
    .insert(userData)
    .execute();
});
```

## Isolation Levels

### Understanding PostgREST Isolation

PostgREST uses PostgreSQL's default READ COMMITTED isolation level:

```typescript
// Each request runs in READ COMMITTED isolation
const user1 = await client
  .from<User>('users')
  .select('*')
  .eq('id', '123')
  .single()
  .execute();

// Another concurrent request might see different data
const user2 = await client
  .from<User>('users')
  .select('*')
  .eq('id', '123')
  .single()
  .execute();
```

### Handling Concurrent Modifications

```typescript
interface VersionedRecord {
  id: string;
  version: number;
  data: any;
}

// Optimistic locking pattern
async function updateWithOptimisticLock<T extends VersionedRecord>(
  table: string,
  id: string,
  expectedVersion: number,
  updates: Partial<T>
): Promise<T> {
  const result = await client
    .from<T>(table)
    .update({
      ...updates,
      version: expectedVersion + 1
    })
    .eq('id', id)
    .eq('version', expectedVersion)
    .select('*')
    .single()
    .execute();
  
  if (!result.data) {
    throw new Error('Record was modified by another process');
  }
  
  return result.data;
}

// Usage
try {
  const updatedUser = await updateWithOptimisticLock(
    'users',
    '123',
    5, // Expected version
    { name: 'Updated Name' }
  );
  console.log('Update successful:', updatedUser);
} catch (error) {
  console.error('Concurrent modification detected:', error);
  // Refresh and retry or handle conflict
}
```

## Best Practices

### 1. Design for Idempotency

```typescript
// Make operations idempotent when possible
async function idempotentCreateUser(userData: Omit<User, 'id' | 'created_at'>) {
  // Use upsert for idempotent creation
  return await client
    .from<User>('users')
    .upsert(userData)
    .rawParams({ 'on_conflict': 'email' })
    .execute();
}
```

### 2. Use Database Constraints

```sql
-- Enforce data consistency at the database level
ALTER TABLE profiles 
ADD CONSTRAINT fk_profiles_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE orders 
ADD CONSTRAINT check_positive_amount 
CHECK (amount > 0);
```

### 3. Implement Proper Error Recovery

```typescript
class TransactionManager {
  private operations: Array<{
    name: string;
    execute: () => Promise<any>;
    rollback: () => Promise<void>;
  }> = [];
  
  addOperation(operation: {
    name: string;
    execute: () => Promise<any>;
    rollback: () => Promise<void>;
  }): void {
    this.operations.push(operation);
  }
  
  async executeAll(): Promise<any[]> {
    const results: any[] = [];
    const executed: number[] = [];
    
    try {
      for (let i = 0; i < this.operations.length; i++) {
        const operation = this.operations[i];
        console.log(`Executing: ${operation.name}`);
        
        const result = await operation.execute();
        results.push(result);
        executed.push(i);
      }
      
      return results;
    } catch (error) {
      console.error('Transaction failed, rolling back...');
      
      // Rollback in reverse order
      for (let i = executed.length - 1; i >= 0; i--) {
        const operationIndex = executed[i];
        const operation = this.operations[operationIndex];
        
        try {
          await operation.rollback();
          console.log(`Rolled back: ${operation.name}`);
        } catch (rollbackError) {
          console.error(`Failed to rollback ${operation.name}:`, rollbackError);
        }
      }
      
      throw error;
    }
  }
}
```

### 4. Monitor Transaction Performance

```typescript
class TransactionMetrics {
  private static metrics = new Map<string, {
    count: number;
    totalDuration: number;
    failures: number;
  }>();
  
  static async measure<T>(
    name: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      
      const duration = Date.now() - startTime;
      this.recordSuccess(name, duration);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordFailure(name, duration);
      throw error;
    }
  }
  
  private static recordSuccess(name: string, duration: number): void {
    const metric = this.metrics.get(name) || { count: 0, totalDuration: 0, failures: 0 };
    metric.count++;
    metric.totalDuration += duration;
    this.metrics.set(name, metric);
  }
  
  private static recordFailure(name: string, duration: number): void {
    const metric = this.metrics.get(name) || { count: 0, totalDuration: 0, failures: 0 };
    metric.failures++;
    metric.totalDuration += duration;
    this.metrics.set(name, metric);
  }
  
  static getMetrics(): Record<string, {
    count: number;
    avgDuration: number;
    failures: number;
    successRate: number;
  }> {
    const result: any = {};
    
    for (const [name, metric] of this.metrics.entries()) {
      result[name] = {
        count: metric.count,
        avgDuration: metric.totalDuration / (metric.count + metric.failures),
        failures: metric.failures,
        successRate: metric.count / (metric.count + metric.failures)
      };
    }
    
    return result;
  }
}

// Usage
const result = await TransactionMetrics.measure(
  'create-user-with-profile',
  () => createUserWithProfile(userData, profileData)
);
```

## Common Transaction Patterns

### 1. Order Processing

```typescript
async function processOrder(orderData: any) {
  const operations = [];
  let order: any = null;
  
  try {
    // 1. Create order
    const orderResult = await client
      .from('orders')
      .insert(orderData)
      .single()
      .execute();
    
    order = orderResult.data;
    
    // 2. Update inventory
    await client
      .from('inventory')
      .update({ 
        quantity: client.raw('quantity - ' + orderData.quantity),
        reserved: client.raw('reserved + ' + orderData.quantity)
      })
      .eq('product_id', orderData.product_id)
      .execute();
    
    // 3. Create payment record
    await client
      .from('payments')
      .insert({
        order_id: order.id,
        amount: orderData.total_amount,
        status: 'pending'
      })
      .execute();
    
    return order;
  } catch (error) {
    // Cleanup order if later steps failed
    if (order) {
      await client
        .from('orders')
        .delete()
        .eq('id', order.id)
        .execute();
    }
    throw error;
  }
}
```

### 2. User Registration

```typescript
async function registerUser(userData: any, profileData: any, settingsData: any) {
  return await client
    .rpc('register_user_complete', {
      user_data: userData,
      profile_data: profileData,
      settings_data: settingsData
    })
    .execute();
}
```

### 3. Bulk Data Import

```typescript
async function importDataWithTransaction(data: any[]) {
  const batchSize = 1000;
  const processed: any[] = [];
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    try {
      const result = await client
        .from('imported_data')
        .insert(batch)
        .execute();
      
      processed.push(...(result.data || []));
    } catch (error) {
      console.error(`Batch ${i / batchSize + 1} failed:`, error);
      throw error;
    }
  }
  
  return processed;
}
```

## Summary

Transaction patterns in PGRestify focus on:

- **Single-Operation Atomicity**: Each PostgREST request is automatically transactional
- **Multi-Operation Coordination**: Use saga patterns and careful error handling
- **Database Functions**: Leverage PostgreSQL's native transaction support via RPC
- **Error Recovery**: Implement compensation actions and retry logic
- **Performance Monitoring**: Track transaction metrics and optimize accordingly

While PostgREST doesn't support multi-request transactions directly, these patterns provide robust solutions for maintaining data consistency in complex scenarios.