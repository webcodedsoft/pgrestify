# Column Name Transformation

Transform between JavaScript `camelCase` and PostgreSQL `snake_case` column names automatically with both PostgREST syntax and ORM-style repository patterns.

## Overview

PGRestify provides automatic bidirectional column name transformation, similar to naming strategies in ORMs. This feature allows you to write JavaScript code using familiar `camelCase` naming conventions while maintaining PostgreSQL `snake_case` standards in your database.

Both PostgREST native syntax and repository patterns support full column transformation capabilities.

### Key Benefits

- ✅ **Native JavaScript conventions** - Use `firstName` instead of `first_name`
- ✅ **Database compatibility** - Maintains PostgreSQL naming standards
- ✅ **Bidirectional transformation** - Works for both queries and responses
- ✅ **Deep nesting support** - Transforms nested objects and arrays recursively
- ✅ **Type safety** - Full TypeScript support maintained
- ✅ **Zero breaking changes** - Opt-in feature with backward compatibility

## Quick Start

### Basic Example

::: code-group

```typescript [PostgREST Syntax]
import { createClient } from '@webcoded/pgrestify';

// Enable transformation globally
const client = createClient({
  url: 'http://localhost:3000',
  transformColumns: true  // Default: false
});

// Use camelCase in your TypeScript interfaces
interface User {
  userId: number;
  firstName: string;
  lastName: string;
  emailAddress: string;
  isActive: boolean;
  createdAt: string;
}

// Write queries using camelCase
const users = await client
  .from<User>('users')
  .select('userId', 'firstName', 'lastName')
  .where('isActive', 'eq', true)
  .order('createdAt', { ascending: false })
  .execute();

// Response data has camelCase properties
console.log(users.data[0].firstName); // ✅ Works!
```

```typescript [Repository Pattern]
import { createClient } from '@webcoded/pgrestify';

// Enable transformation globally
const client = createClient({
  url: 'http://localhost:3000',
  transformColumns: true  // Default: false
});

// Use camelCase in your TypeScript interfaces
interface User {
  userId: number;
  firstName: string;
  lastName: string;
  emailAddress: string;
  isActive: boolean;
  createdAt: string;
}

// Get repository with transformation
const userRepo = client.getRepository<User>('users');

// Repository methods automatically use transformation
const users = await userRepo.find({
  select: ['userId', 'firstName', 'lastName'],
  where: { isActive: true },
  order: { createdAt: 'DESC' },
  take: 10
});

// Response data has camelCase properties
console.log(users[0].firstName); // ✅ Works!

// Alternative: Query builder with repository
const queryBuilderUsers = await userRepo
  .createQueryBuilder()
  .select(['userId', 'firstName', 'lastName'])
  .where('isActive = :active', { active: true })
  .orderBy('createdAt', 'DESC')
  .getMany();

console.log(queryBuilderUsers[0].firstName); // ✅ Works!
```

:::

### What Happens Under the Hood

```typescript
// Your JavaScript code:
.select('userId', 'firstName', 'lastName')
.where('isActive', 'eq', true)

// Generated PostgREST query:
// GET /users?select=user_id,first_name,last_name&is_active=eq.true

// Database response (snake_case):
[{ user_id: 1, first_name: "John", last_name: "Doe" }]

// Transformed response (camelCase):
[{ userId: 1, firstName: "John", lastName: "Doe" }]
```

## Configuration Options

### Global Configuration

Enable transformation for all queries in your application:

```typescript
const client = createClient({
  url: 'http://localhost:3000',
  transformColumns: true  // Apply to all queries
});
```

### Query-Level Configuration

Override global settings for specific queries:

::: code-group

```typescript [PostgREST Syntax]
const client = createClient({
  url: 'http://localhost:3000',
  transformColumns: false  // Disabled globally
});

// Enable for specific queries
const query1 = client
  .from('users')
  .transformColumns(true)  // ✅ Enable transformation
  .select('firstName', 'lastName');

// Keep disabled for others
const query2 = client
  .from('users')
  .transformColumns(false) // ✅ Explicit disable
  .select('first_name', 'last_name');
```

```typescript [Repository Pattern]
const client = createClient({
  url: 'http://localhost:3000',
  transformColumns: false  // Disabled globally
});

const userRepo = client.getRepository<User>('users');

// Enable transformation for specific repository queries
const usersWithTransform = await userRepo.find({
  select: ['firstName', 'lastName'],
  transformColumns: true  // ✅ Enable transformation
});

// Keep disabled for specific queries
const usersWithoutTransform = await userRepo.find({
  select: ['first_name', 'last_name'],
  transformColumns: false // ✅ Explicit disable
});

// Query builder with transformation control
const transformedQuery = await userRepo
  .createQueryBuilder()
  .select(['firstName', 'lastName'])
  .transformColumns(true)  // ✅ Enable for this query
  .getMany();

const rawQuery = await userRepo
  .createQueryBuilder()
  .select(['first_name', 'last_name'])
  .transformColumns(false) // ✅ Keep disabled
  .getMany();
```

:::

### React Hook Configuration

Use transformation with React hooks:

```typescript
import { useQuery, useInfiniteQuery } from '@webcoded/pgrestify/react';

// Modern useQuery with config object
const { data, isLoading } = useQuery<User>({
  from: 'users',
  select: ['userId', 'firstName', 'lastName'],
  filter: { isActive: true },
  transformColumns: true  // ✅ Enable transformation
});

// Infinite query with transformation
const { data, fetchNextPage } = useInfiniteQuery<User>('users', {
  select: ['userId', 'firstName'],
  transformColumns: true,
  pageSize: 10
});
```

## Query Methods Support

All query methods support column transformation:

### Find Methods

::: code-group

```typescript [PostgREST Syntax]
// findOne() with transformation
const user = await client
  .from('users')
  .transformColumns(true)
  .findOne({
    where: { userId: 1 },
    select: ['firstName', 'lastName', 'emailAddress']
  });

// findOneOrFail() with relations
const courseWithCategory = await client
  .from('course')
  .transformColumns(true)
  .findOneOrFail({
    where: { id: 'uuid-here' },
    relations: ['courseCategory', 'courseTranslation'],
    select: ['id', 'finalPrice', 'createdAt']
  });

// find() with complex queries
const courses = await client
  .from('course')
  .transformColumns(true)
  .find({
    where: { publishedAt: true },
    select: ['id', 'finalPrice', 'courseCategory.categoryName'],
    order: { createdAt: 'DESC' },
    take: 10
  });
```

```typescript [Repository Pattern]
// Repository findOne() with transformation
const userRepo = client.getRepository<User>('users');
const courseRepo = client.getRepository<Course>('course');

const user = await userRepo.findOne({
  where: { userId: 1 },
  select: ['firstName', 'lastName', 'emailAddress']
  // transformColumns inherited from client configuration
});

// findOneOrFail() with relations
const courseWithCategory = await courseRepo.findOneOrFail({
  where: { id: 'uuid-here' },
  relations: ['courseCategory', 'courseTranslation'],
  select: ['id', 'finalPrice', 'createdAt']
});

// find() with complex queries
const courses = await courseRepo.find({
  where: { publishedAt: true },
  select: ['id', 'finalPrice', 'courseCategory.categoryName'],
  order: { createdAt: 'DESC' },
  take: 10
});

// Query builder equivalents
const userWithBuilder = await userRepo
  .createQueryBuilder()
  .select(['firstName', 'lastName', 'emailAddress'])
  .where('userId = :id', { id: 1 })
  .getOne();

const coursesWithBuilder = await courseRepo
  .createQueryBuilder('c')
  .leftJoinAndSelect('c.courseCategory', 'category')
  .select(['c.id', 'c.finalPrice', 'category.categoryName'])
  .where('c.publishedAt = :published', { published: true })
  .orderBy('c.createdAt', 'DESC')
  .take(10)
  .getMany();
```

:::

### Direct Query Building

```typescript
// Chainable query builder
const users = await client
  .from<User>('users')
  .transformColumns(true)
  .select('userId', 'firstName', 'lastName')
  .where('isActive', 'eq', true)
  .where('firstName', 'ilike', '%john%')
  .order('createdAt', { ascending: false })
  .limit(20)
  .execute();

// Complex queries with joins
const coursesWithDetails = await client
  .from('course')
  .transformColumns(true)
  .select('id', 'title', 'finalPrice')
  .leftJoin('course_category', { 
    select: ['categoryName', 'description'] 
  })
  .where('publishedAt', 'eq', true)
  .execute();
```

### Mutation Methods

Transformation works for all mutation operations:

::: code-group

```typescript [PostgREST Syntax]
// INSERT with transformation
const newUser = await client
  .from('users')
  .transformColumns(true)
  .insert({
    firstName: 'Jane',        // → first_name
    lastName: 'Smith',        // → last_name
    emailAddress: 'jane@example.com', // → email_address
    isActive: true           // → is_active
  })
  .execute();

// UPDATE with transformation
const updatedUser = await client
  .from('users')
  .transformColumns(true)
  .update({
    firstName: 'Jane Updated',  // → first_name
    lastLoginAt: new Date()     // → last_login_at
  })
  .where('userId', 'eq', 1)      // → user_id
  .execute();

// UPSERT with transformation
await client
  .from('user_preferences')
  .transformColumns(true)
  .upsert({
    userId: 1,                // → user_id
    themePreference: 'dark',  // → theme_preference
    notificationsEnabled: true // → notifications_enabled
  })
  .execute();
```

```typescript [Repository Pattern]
// Repository mutations with transformation
const userRepo = client.getRepository<User>('users');
const preferencesRepo = client.getRepository<UserPreferences>('user_preferences');

// INSERT with repository save
const newUser = await userRepo.save({
  firstName: 'Jane',        // → first_name
  lastName: 'Smith',        // → last_name
  emailAddress: 'jane@example.com', // → email_address
  isActive: true           // → is_active
});

// Alternative: using insert method
const insertedUser = await userRepo.insert({
  firstName: 'Jane',
  lastName: 'Smith',
  emailAddress: 'jane@example.com',
  isActive: true
});

// UPDATE with repository
const updatedUser = await userRepo.update(
  { userId: 1 },              // → user_id
  {
    firstName: 'Jane Updated', // → first_name
    lastLoginAt: new Date()    // → last_login_at
  }
);

// Alternative: using save for updates
const existingUser = await userRepo.findOne({ userId: 1 });
if (existingUser) {
  existingUser.firstName = 'Jane Updated';
  existingUser.lastLoginAt = new Date();
  await userRepo.save(existingUser);
}

// UPSERT with repository save (automatic upsert behavior)
await preferencesRepo.save({
  userId: 1,                // → user_id
  themePreference: 'dark',  // → theme_preference
  notificationsEnabled: true // → notifications_enabled
});

// Custom repository methods with transformation
class UserRepository extends CustomRepositoryBase<User> {
  async updateProfile(userId: number, profileData: Partial<User>) {
    return this.update(
      { userId },             // → user_id
      {
        ...profileData,
        updatedAt: new Date() // → updated_at
      }
    );
  }

  async createUserWithPreferences(userData: Partial<User>, preferences: any) {
    const user = await this.save(userData);
    
    if (user) {
      await this.manager.getRepository('user_preferences').save({
        userId: user.userId,  // → user_id
        ...preferences
      });
    }
    
    return user;
  }
}
```

:::

### Bulk Operations

```typescript
// Bulk insert with transformation
const results = await client
  .from('users')
  .transformColumns(true)
  .bulkInsert([
    { firstName: 'Alice', lastName: 'Johnson', isActive: true },
    { firstName: 'Bob', lastName: 'Wilson', isActive: false }
  ]);

// Each item in results.data will have camelCase properties
results.data.forEach(user => {
  console.log(user.firstName); // ✅ Transformed
});
```

## Advanced Features

### Nested Object Transformation

Transformation works recursively with nested objects and arrays:

```typescript
interface Course {
  id: string;
  title: string;
  finalPrice: number;
  courseCategory: {
    categoryId: number;
    categoryName: string;
    parentCategory: {
      categoryId: number;
      categoryName: string;
    };
  };
  courseTags: Array<{
    tagId: number;
    tagName: string;
    tagColor: string;
  }>;
}

const course = await client
  .from<Course>('course')
  .transformColumns(true)
  .findOne({
    where: { id: 'course-uuid' },
    relations: ['courseCategory', 'courseTags'],
    select: [
      'id', 'title', 'finalPrice',
      'courseCategory.categoryName',
      'courseCategory.parentCategory.categoryName',
      'courseTags.tagName'
    ]
  });

// Response has fully transformed nested structure:
// {
//   id: 'course-uuid',
//   title: 'Course Title',
//   finalPrice: 99.99,
//   courseCategory: {
//     categoryName: 'Programming',
//     parentCategory: {
//       categoryName: 'Technology'
//     }
//   },
//   courseTags: [
//     { tagName: 'JavaScript' },
//     { tagName: 'TypeScript' }
//   ]
// }
```

### Aliasing with Transformation

Combine aliases with transformation for custom response shapes:

```typescript
const courses = await client
  .from('course')
  .transformColumns(true)
  .select([
    'id',
    'finalPrice AS price',      // Alias preserved
    'createdAt AS publishDate', // → created_at AS publish_date
    'courseCategory.categoryName AS category'
  ])
  .execute();

// Response structure:
// [{ 
//   id: '...', 
//   price: 99.99,           // Alias used as-is
//   publishDate: '...',     // Alias used as-is
//   category: 'Programming' // Nested field aliased
// }]
```

### Raw Queries with Transformation

Even raw SQL-like queries benefit from transformation:

```typescript
const results = await client
  .from('users')
  .transformColumns(true)
  .rawSelect('userId,firstName,lastName')
  .rawFilter({ 'createdAt': 'gte.2023-01-01' })
  .execute();
// Raw filters use snake_case, response gets camelCase
```

## React Integration

### Hook-based Queries

```typescript
import { 
  useQuery, 
  useInfiniteQuery, 
  useQueryBuilder,
  useInsert, 
  useUpdate 
} from '@webcoded/pgrestify/react';

function UserList() {
  // Modern useQuery with transformation
  const { data: users, isLoading } = useQuery<User>({
    from: 'users',
    select: ['userId', 'firstName', 'lastName', 'isActive'],
    filter: { isActive: true },
    order: { column: 'createdAt', ascending: false },
    transformColumns: true,
    limit: 10
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {users?.map(user => (
        <div key={user.userId}>
          {user.firstName} {user.lastName}
          {user.isActive ? ' (Active)' : ' (Inactive)'}
        </div>
      ))}
    </div>
  );
}
```

### Infinite Queries with Transformation

```typescript
function InfiniteUserList() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery<User>('users', {
    select: ['userId', 'firstName', 'lastName'],
    filter: { isActive: true },
    transformColumns: true,
    pageSize: 20,
    paginationType: 'offset'
  });

  return (
    <div>
      {data?.pages.map((page, pageIndex) => (
        <div key={pageIndex}>
          {page.map(user => (
            <div key={user.userId}>
              {user.firstName} {user.lastName}
            </div>
          ))}
        </div>
      ))}
      
      {hasNextPage && (
        <button onClick={() => fetchNextPage()}>
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

### Pre-built Query with Hook

```typescript
function UserDetail({ userId }: { userId: number }) {
  // Build query with transformation
  const query = client
    .from<User>('users')
    .transformColumns(true)
    .select('userId', 'firstName', 'lastName', 'emailAddress')
    .where('userId', 'eq', userId);

  // Use with hook
  const { data: user, error, isLoading } = useQueryBuilder(query);

  if (isLoading) return <div>Loading user...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div>
      <h1>{user.firstName} {user.lastName}</h1>
      <p>Email: {user.emailAddress}</p>
      <p>ID: {user.userId}</p>
    </div>
  );
}
```

### Mutations with Transformation

```typescript
function CreateUserForm() {
  const { mutate: createUser, isLoading } = useInsert<User>('users');
  const { mutate: updateUser } = useUpdate<User>('users');

  const handleCreate = () => {
    createUser({
      firstName: 'New',           // → first_name
      lastName: 'User',           // → last_name
      emailAddress: 'new@user.com', // → email_address
      isActive: true              // → is_active
    });
  };

  const handleUpdate = () => {
    updateUser({
      values: {
        firstName: 'Updated',     // → first_name
        isActive: false           // → is_active
      },
      where: { userId: 1 }        // → user_id
    });
  };

  return (
    <div>
      <button onClick={handleCreate} disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create User'}
      </button>
      <button onClick={handleUpdate}>
        Update User
      </button>
    </div>
  );
}
```

## TypeScript Integration

### Interface Definition

Define your interfaces using camelCase conventions:

```typescript
interface User {
  userId: number;
  firstName: string;
  lastName: string;
  emailAddress: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  
  // Nested objects
  userProfile?: {
    profileId: number;
    bioText: string;
    avatarUrl: string;
  };
  
  // Arrays of objects
  userPreferences?: Array<{
    preferenceId: number;
    preferenceName: string;
    preferenceValue: string;
  }>;
}
```

### Type-Safe Queries

```typescript
// TypeScript validates column names and types
const users = await client
  .from<User>('users')
  .transformColumns(true)
  .select('userId', 'firstName', 'emailAddress') // ✅ Type-checked
  .where('isActive', 'eq', true)                 // ✅ Type-checked
  .order('createdAt', { ascending: false })      // ✅ Type-checked
  .execute();

// users.data has correct TypeScript types
users.data.forEach(user => {
  console.log(user.firstName); // ✅ TypeScript knows this exists
  console.log(user.userId);    // ✅ TypeScript knows this is a number
});
```

### Generic Repository Pattern

::: code-group

```typescript [PostgREST Syntax]
class UserService {
  constructor(private client: PostgRESTClient) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.client
      .from<User>('users')
      .transformColumns(true)
      .findOne({
        where: { emailAddress: email },
        select: ['userId', 'firstName', 'lastName', 'isActive']
      });
  }

  async create(userData: Omit<User, 'userId' | 'createdAt'>): Promise<User> {
    const result = await this.client
      .from<User>('users')
      .transformColumns(true)
      .insert(userData)
      .single()
      .execute();

    if (result.error) throw new Error(result.error.message);
    return result.data!;
  }

  async updateProfile(userId: number, updates: Partial<User>): Promise<User> {
    const result = await this.client
      .from<User>('users')
      .transformColumns(true)
      .update(updates)
      .where('userId', 'eq', userId)
      .single()
      .execute();

    if (result.error) throw new Error(result.error.message);
    return result.data!;
  }
}
```

```typescript [Repository Pattern]
class UserRepository extends CustomRepositoryBase<User> {
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({
      where: { emailAddress: email },
      select: ['userId', 'firstName', 'lastName', 'isActive']
      // transformColumns inherited from client configuration
    });
  }

  async create(userData: Omit<User, 'userId' | 'createdAt'>): Promise<User> {
    return this.save({
      ...userData,
      createdAt: new Date().toISOString()
    });
  }

  async updateProfile(userId: number, updates: Partial<User>): Promise<User> {
    const existingUser = await this.findOne({ userId });
    if (!existingUser) {
      throw new Error('User not found');
    }

    return this.save({
      ...existingUser,
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  async findActiveUsers(limit: number = 10): Promise<User[]> {
    return this.find({
      where: { isActive: true },
      select: ['userId', 'firstName', 'lastName', 'emailAddress'],
      order: { createdAt: 'DESC' },
      take: limit
    });
  }

  async createWithPreferences(
    userData: Omit<User, 'userId' | 'createdAt'>,
    preferences: any
  ): Promise<User> {
    // Use transaction for atomicity
    return this.manager.transaction(async (transactionalEntityManager) => {
      const userRepo = transactionalEntityManager.getRepository<User>('users');
      const prefRepo = transactionalEntityManager.getRepository('user_preferences');

      const user = await userRepo.save({
        ...userData,
        createdAt: new Date().toISOString()
      });

      await prefRepo.save({
        userId: user.userId,  // → user_id
        ...preferences
      });

      return user;
    });
  }
}

// Usage
const userRepo = client.getCustomRepository(UserRepository);

const user = await userRepo.findByEmail('john@example.com');
const newUser = await userRepo.create({
  firstName: 'John',
  lastName: 'Doe',
  emailAddress: 'john@example.com',
  isActive: true
});
```

:::

## Performance Considerations

### Transformation Overhead

- **Minimal impact** - Simple regex-based transformations
- **Efficient algorithms** - O(n) complexity where n = number of keys
- **Memory usage** - Creates new objects (immutable pattern)
- **Caching potential** - Column name mappings could be cached

### Best Practices

```typescript
// ✅ Good: Enable globally if most queries need it
const client = createClient({
  url: 'http://localhost:3000',
  transformColumns: true
});

// ✅ Good: Disable for specific performance-critical queries
const largeBatchQuery = client
  .from('analytics_data')
  .transformColumns(false) // Skip transformation for performance
  .select('*')
  .limit(10000);

// ✅ Good: Use selective columns to reduce transformation overhead
const optimizedQuery = client
  .from('users')
  .transformColumns(true)
  .select('userId', 'firstName') // Only transform needed columns
  .limit(100);

// ❌ Avoid: Unnecessary transformation for simple queries
const simpleCount = client
  .from('users')
  .transformColumns(true) // Unnecessary for count queries
  .count();
```

## Migration Strategies

### Gradual Migration

If you have an existing codebase, migrate gradually:

```typescript
// Phase 1: Keep existing code working
const client = createClient({
  url: 'http://localhost:3000',
  transformColumns: false // Keep disabled globally
});

// Phase 2: Enable for new features
const newFeatureQuery = client
  .from('new_table')
  .transformColumns(true) // Enable for new code
  .select('camelCaseField');

// Phase 3: Migrate existing queries one by one
const migratedQuery = client
  .from('existing_table')
  .transformColumns(true)
  .select('existingField'); // Update interfaces gradually
```

### Interface Updates

Update your TypeScript interfaces gradually:

```typescript
// Before (snake_case)
interface User {
  user_id: number;
  first_name: string;
  last_name: string;
  email_address: string;
}

// After (camelCase with transformation)
interface User {
  userId: number;
  firstName: string;
  lastName: string;
  emailAddress: string;
}
```

## Troubleshooting

### Common Issues

**Issue: Data not being transformed**
```typescript
// ❌ Transformation not enabled
const client = createClient({ url: 'http://localhost:3000' });
const data = await client.from('users').execute();
// Solution: Enable transformation
const client = createClient({ url: 'http://localhost:3000', transformColumns: true });
```

**Issue: Mixed naming conventions**
```typescript
// ❌ Mixing camelCase and snake_case
.select('firstName', 'last_name') // Inconsistent

// ✅ Use consistent naming
.select('firstName', 'lastName')   // All camelCase
```

**Issue: Nested objects not transforming**
```typescript
// This is expected behavior - transformation is recursive
const data = await client
  .from('users')
  .transformColumns(true)
  .leftJoin('user_profile', { select: ['bio_text'] })
  .execute();

// Result will be:
// { userId: 1, userProfile: { bioText: '...' } }
```

### Debug Tips

```typescript
// 1. Check if transformation is enabled
const query = client.from('users').transformColumns(true);
// @ts-ignore - For debugging only
console.log('Transform enabled:', query.isColumnTransformEnabled?.());

// 2. Compare raw vs transformed queries
const rawQuery = client.from('users').transformColumns(false);
const transformedQuery = client.from('users').transformColumns(true);

// 3. Test with simple queries first
const simpleTest = await client
  .from('users')
  .transformColumns(true)
  .select('userId')  // Single field test
  .limit(1)
  .execute();
```

## Examples

### E-commerce Application

```typescript
interface Product {
  productId: string;
  productName: string;
  unitPrice: number;
  isActive: boolean;
  createdAt: string;
  categoryId: number;
  
  // Relations
  productCategory?: {
    categoryId: number;
    categoryName: string;
    categorySlug: string;
  };
  
  productImages?: Array<{
    imageId: number;
    imageUrl: string;
    altText: string;
    sortOrder: number;
  }>;
}

// Product listing with category and images
const products = await client
  .from<Product>('products')
  .transformColumns(true)
  .find({
    where: { isActive: true },
    relations: ['productCategory', 'productImages'],
    select: [
      'productId', 'productName', 'unitPrice',
      'productCategory.categoryName',
      'productImages.imageUrl'
    ],
    order: { createdAt: 'DESC' },
    take: 20
  });
```

### User Management System

```typescript
interface User {
  userId: number;
  firstName: string;
  lastName: string;
  emailAddress: string;
  isActive: boolean;
  lastLoginAt?: string;
  
  userRoles?: Array<{
    roleId: number;
    roleName: string;
    permissions: string[];
  }>;
}

class UserService {
  constructor(private client: PostgRESTClient) {}

  async getUserWithRoles(userId: number): Promise<User | null> {
    return this.client
      .from<User>('users')
      .transformColumns(true)
      .findOne({
        where: { userId },
        relations: ['userRoles'],
        select: [
          'userId', 'firstName', 'lastName', 'emailAddress',
          'isActive', 'lastLoginAt',
          'userRoles.roleName', 'userRoles.permissions'
        ]
      });
  }

  async updateLastLogin(userId: number): Promise<void> {
    await this.client
      .from('users')
      .transformColumns(true)
      .update({ lastLoginAt: new Date().toISOString() })
      .where('userId', 'eq', userId)
      .execute();
  }
}
```

---

## Summary

Column name transformation in PGRestify provides:

- **Seamless JavaScript integration** with camelCase conventions
- **Database compatibility** with PostgreSQL snake_case standards  
- **Full feature support** across all query and mutation methods
- **Deep nesting transformation** for complex data structures
- **Type safety** with complete TypeScript integration
- **Performance optimization** with selective transformation
- **Migration flexibility** for existing codebases

This feature bridges the gap between JavaScript naming conventions and PostgreSQL database schemas, providing a seamless development experience while maintaining database best practices.