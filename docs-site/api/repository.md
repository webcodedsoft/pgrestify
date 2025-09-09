# Repository API Reference

Comprehensive API documentation for PGRestify's type-safe Repository pattern.

## Basic Repository Interface

```typescript
interface Repository<T> {
  // Find methods
  find(): Promise<T[]>;
  findBy(criteria: Partial<T>): Promise<T[]>;
  findOne(criteria: Partial<T>): Promise<T | null>;
  findById(id: number | string): Promise<T | null>;
  findOneOrFail(criteria: Partial<T>): Promise<T>;

  // Create/Update methods
  save(entity: Partial<T>): Promise<T>;
  saveMany(entities: Partial<T>[]): Promise<T[]>;
  update(id: number | string, updates: Partial<T>): Promise<T>;
  upsert(entity: T): Promise<T>;

  // Delete methods
  remove(entity: T): Promise<void>;
  removeById(id: number | string): Promise<void>;
  removeBy(criteria: Partial<T>): Promise<void>;

  // Query methods
  createQueryBuilder(): QueryBuilder<T>;
}
```

## Instantiation

```typescript
// Basic repository creation
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

const userRepo = client.getRepository<User>('users');
```

## Find Methods

```typescript
// Find all records
const allUsers = await userRepo.find();

// Find by specific criteria
const activeUsers = await userRepo.findBy({ active: true });

// Find a single user
const user = await userRepo.findOne({ email: 'john@example.com' });

// Find by ID
const specificUser = await userRepo.findById(123);

// Find or throw an error
try {
  const requiredUser = await userRepo.findOneOrFail({ id: 999 });
} catch (error) {
  // Handle not found scenario
  console.error('User not found');
}
```

## Create and Update Methods

```typescript
// Create a new user
const newUser = await userRepo.save({
  name: 'John Doe',
  email: 'john@example.com',
  active: true
});

// Bulk create users
const newUsers = await userRepo.saveMany([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' }
]);

// Update a user
const updatedUser = await userRepo.update(123, {
  name: 'Updated Name',
  active: false
});

// Upsert (insert or update)
const upsertedUser = await userRepo.upsert({
  id: 123,
  name: 'John Doe',
  email: 'john@example.com'
});
```

## Delete Methods

```typescript
// Remove a specific user
await userRepo.remove(user);

// Remove by ID
await userRepo.removeById(123);

// Remove by criteria
await userRepo.removeBy({ active: false });
```

## Advanced Querying

```typescript
// Use query builder for complex queries
const complexQuery = await userRepo
  .createQueryBuilder()
  .select('id', 'name', 'email')
  .eq('active', true)
  .order('created_at', { ascending: false })
  .limit(10)
  .getMany();
```

## Pagination

```typescript
// Paginated find
const paginatedUsers = await userRepo.find({
  page: 1,
  pageSize: 10,
  order: { created_at: 'DESC' }
});

// Cursor-based pagination
const cursorUsers = await userRepo.find({
  cursor: lastUserId,
  limit: 10
});
```

## Transactions

```typescript
// Perform multiple operations in a transaction
await client.transaction(async (transactionalRepo) => {
  const user = await transactionalRepo.save({ 
    name: 'John Doe', 
    email: 'john@example.com' 
  });

  const profile = await transactionalRepo
    .getRepository('profiles')
    .save({
      user_id: user.id,
      bio: 'Developer'
    });

  return { user, profile };
});
```

## Relationships and Joins

```typescript
// Eager loading of related entities
const usersWithPosts = await userRepo.find({
  relations: ['posts']
});

// Nested eager loading
const usersWithPostsAndComments = await userRepo.find({
  relations: {
    posts: {
      comments: true
    }
  }
});
```

## Type Safety and Inference

```typescript
// Strict type checking
const typeSafeUser = await userRepo.save({
  // TypeScript ensures type safety
  name: 'John Doe',     // Correct
  email: 'john@example.com', // Correct
  // age: '30'  // Would cause a TypeScript error
});
```

## Error Handling

```typescript
try {
  const user = await userRepo.findOneOrFail({ id: 999 });
} catch (error) {
  if (error.name === 'NotFoundError') {
    console.log('User not found');
  } else if (error.name === 'ValidationError') {
    console.log('Invalid user data');
  }
}
```

## Soft Delete Support

```typescript
// Soft delete configuration
const userRepo = client.getRepository<User>('users', {
  softDelete: {
    enabled: true,
    deletedAtColumn: 'deleted_at'
  }
});

// Soft delete a user
await userRepo.softRemove(user);

// Find only non-deleted users
const activeUsers = await userRepo.find({
  withDeleted: false
});
```

## Hooks and Lifecycle Events

```typescript
const userRepo = client.getRepository<User>('users', {
  hooks: {
    // Before save hook
    beforeSave: (user) => {
      // Validate or modify user before saving
      user.email = user.email.toLowerCase();
    },

    // After find hook
    afterFind: (users) => {
      // Post-process found users
      return users.map(user => ({
        ...user,
        fullName: `${user.firstName} ${user.lastName}`
      }));
    }
  }
});
```

## Performance Optimization

```typescript
const userRepo = client.getRepository<User>('users', {
  performance: {
    // Caching strategy
    cache: {
      enabled: true,
      ttl: 300000, // 5 minutes
      strategy: 'lru'
    },

    // Query optimization
    queryOptimization: {
      enabled: true,
      selectStrategy: 'minimal'
    }
  }
});
```

## Best Practices

- Always use type generics
- Leverage type safety
- Use transactions for complex operations
- Implement proper error handling
- Use hooks for data validation and transformation
- Configure caching strategically
- Minimize database round trips
- Use eager loading judiciously
- Implement soft delete when appropriate

## Performance Considerations

- Minimize the number of database calls
- Use eager loading carefully
- Implement caching
- Use pagination for large datasets
- Optimize query complexity
- Monitor and profile repository methods