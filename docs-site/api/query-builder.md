# Query Builder API Reference

Comprehensive API documentation for PGRestify's dual query builder approach: PostgREST Query Builder and ORM-Style SelectQueryBuilder.

## Query Builder Types

PGRestify offers two complementary query builders:

### 🎯 PostgREST Query Builder
Direct access to PostgREST's powerful query syntax with familiar chainable methods.

### 🏗️ ORM-Style SelectQueryBuilder  
ORM-inspired query builder with parameter binding, complex WHERE conditions, and method chaining.

---

# PostgREST Query Builder

## Basic PostgREST Query Builder Interface

```typescript
interface QueryBuilder<T = Record<string, unknown>> {
  // Select specific columns (supports arrays and aliasing)
  select(...columns: (keyof T | string)[]): QueryBuilder<T>;
  select(columns: (keyof T | string)[]): QueryBuilder<T>;
  
  // Relations for table joins
  relations(relations: string[]): QueryBuilder<T>;
  
  // Ordering methods
  order(column: keyof T | string): QueryBuilder<T>;
  order(column: keyof T | string, options: { 
    ascending?: boolean; 
    nullsFirst?: boolean 
  }): QueryBuilder<T>;
  
  // Filter methods
  eq(column: keyof T, value: T[keyof T]): QueryBuilder<T>;
  neq(column: keyof T, value: T[keyof T]): QueryBuilder<T>;
  gt(column: keyof T, value: T[keyof T]): QueryBuilder<T>;
  gte(column: keyof T, value: T[keyof T]): QueryBuilder<T>;
  lt(column: keyof T, value: T[keyof T]): QueryBuilder<T>;
  lte(column: keyof T, value: T[keyof T]): QueryBuilder<T>;
}
```

## Instantiation

```typescript
// Basic instantiation
const query = client.from<User>('users');

// With type inference
interface User {
  id: number;
  name: string;
  email: string;
}

const userQuery = client.from<User>('users');
```

## Selection Methods

### Array Syntax (Recommended)

```typescript
// Select specific columns using array
const selectedUsers = await client
  .from<User>('users')
  .select(['id', 'name', 'email'])
  .execute();

// Select with aliases using array and AS keyword
const aliasedUsers = await client
  .from<User>('users')
  .select([
    'id AS user_id',
    'name AS full_name', 
    'email AS contact_email'
  ])
  .execute();

// Mixed selection with and without aliases
const mixedSelection = await client
  .from<User>('users')
  .select([
    'id',
    'name AS full_name',
    'email',
    'created_at AS signup_date'
  ])
  .execute();

// Dynamic column selection
const columns = ['id', 'name AS username', 'email'];
const dynamicUsers = await client
  .from<User>('users')
  .select(columns)
  .execute();
```

### String Syntax

```typescript
// Traditional string syntax
const stringUsers = await client
  .from<User>('users')
  .select('id, name, email')
  .execute();

// String syntax with PostgREST colon aliases
const colonAliases = await client
  .from<User>('users')
  .select(`
    id,
    name:full_name,
    email:contact_email
  `)
  .execute();

// String syntax with AS keyword aliases
const asAliases = await client
  .from<User>('users')
  .select(`
    id as user_id, 
    name as full_name, 
    email as contact_email
  `)
  .execute();
```

### Complex Selection with Relations and Aliases

```typescript
// Array syntax with relations and aliases
const complexSelection = await client
  .from<User>('users')
  .select([
    'id AS user_id',
    'name AS full_name',
    'profile.bio AS user_bio',
    'profile.avatar_url AS profile_image',
    'posts.title AS latest_post_title'
  ])
  .relations(['profile', 'posts'])
  .execute();
```

## Filtering Methods

```typescript
// Equality filter
const activeUsers = await client
  .from<User>('users')
  .select('*')
  .eq('active', true)
  .execute();

// Multiple filters
const filteredUsers = await client
  .from<User>('users')
  .select('*')
  .eq('active', true)
  .gte('age', 18)
  .lt('age', 35)
  .execute();
```

## Logical Operators

```typescript
// AND filter
const complexFilter = await client
  .from<User>('users')
  .select('*')
  .and(
    'active.eq.true', 
    'verified.eq.true'
  )
  .execute();

// OR filter
const roleFilter = await client
  .from<User>('users')
  .select('*')
  .or(
    'role.eq.admin', 
    'role.eq.moderator'
  )
  .execute();
```

## Sorting and Ordering

### Single Column Ordering

```typescript
// Ascending order (default)
const orderedUsers = await client
  .from<User>('users')
  .select('*')
  .order('name')
  .execute();

// Descending order
const recentUsers = await client
  .from<User>('users')
  .select('*')
  .order('created_at', { ascending: false })
  .execute();

// With null handling
const usersWithNulls = await client
  .from<User>('users')
  .select('*')
  .order('last_login', { ascending: false, nullsFirst: false })
  .execute();
```

### Multiple Column Ordering

Chain multiple `.order()` calls for complex sorting:

```typescript
// Two-column sort: age descending, then name ascending
const complexOrdering = await client
  .from<User>('users')
  .select('*')
  .order('age', { ascending: false })
  .order('name', { ascending: true })
  .execute();

// Three-column sort: status, date, name
const prioritizedUsers = await client
  .from<User>('users')
  .select('*')
  .order('is_active', { ascending: false })
  .order('created_at', { ascending: false })
  .order('name')
  .execute();

// Complex business logic sorting
const productsByImportance = await client
  .from<Product>('products')
  .select('*')
  .order('featured', { ascending: false })     // Featured first
  .order('in_stock', { ascending: false })     // In-stock next
  .order('category')                           // Group by category
  .order('rating', { ascending: false })       // Best rated first
  .order('price')                              // Cheapest first
  .execute();
```

### Dynamic Multiple Ordering

```typescript
interface OrderCriteria {
  column: string;
  ascending?: boolean;
  nullsFirst?: boolean;
}

// Build dynamic multi-column sorts
const buildMultiSort = (table: string, criteria: OrderCriteria[]) => {
  let query = client.from(table).select('*');
  
  criteria.forEach(sort => {
    query = query.order(sort.column, {
      ascending: sort.ascending !== false,
      nullsFirst: sort.nullsFirst
    });
  });
  
  return query;
};

// Usage
const dynamicSort = await buildMultiSort('orders', [
  { column: 'priority', ascending: false },
  { column: 'due_date', ascending: true },
  { column: 'customer_name', ascending: true }
]).execute();
```

### String-Based Ordering

```typescript
// PostgREST string format for single sort
const singleSort = await client
  .from<Product>('products')
  .select('*')
  .order('price.desc')
  .execute();

// PostgREST string format for multiple sorts
const multiSort = await client
  .from<User>('users')
  .select('*')
  .order('is_active.desc,created_at.desc,name.asc')
  .execute();
```

## Pagination

```typescript
// Page-based pagination
const paginatedUsers = await client
  .from<User>('users')
  .select('*')
  .paginate({ 
    page: 1, 
    pageSize: 10 
  })
  .executeWithPagination();

// Cursor-based pagination
const cursorPage = await client
  .from<User>('users')
  .select('*')
  .range(0, 9)
  .executeWithPagination();
```

## Full-Text Search

```typescript
// Basic full-text search
const searchResults = await client
  .from<Post>('posts')
  .select('*')
  .fts('content', 'typescript postgresql')
  .execute();

// Phrase search
const phraseSearch = await client
  .from<Documentation>('docs')
  .select('*')
  .phfts('text', '"type safety"')
  .execute();
```

## Aggregate Functions

```typescript
// Basic aggregates
const userStats = await client
  .from<User>('users')
  .select(`
    count(*) as total_users,
    avg(age) as average_age,
    min(created_at) as first_user_date
  `)
  .execute();

// Grouped aggregates
const roleStats = await client
  .from<User>('users')
  .select(`
    role,
    count(*) as user_count,
    avg(age) as average_age
  `)
  .groupBy('role')
  .execute();
```

## Joins and Embedded Resources

### Relations Array Syntax

```typescript
// Simple relation
const usersWithProfile = await client
  .from<User>('users')
  .select(['id', 'name', 'email', 'profile.bio', 'profile.avatar_url'])
  .relations(['profile'])
  .execute();

// Multiple relations
const usersWithData = await client
  .from<User>('users')
  .select(['id', 'name', 'posts.title', 'comments.content'])
  .relations(['posts', 'comments'])
  .execute();

// Nested relations
const deepData = await client
  .from<User>('users')
  .select(['id', 'name', 'posts.title', 'posts.comments.content'])
  .relations(['posts.comments'])
  .execute();
```

### PostgREST Embedded Resources

```typescript
// One-to-many join
const usersWithPosts = await client
  .from<User>('users')
  .select(`
    id, 
    name, 
    posts:posts(id, title, content)
  `)
  .execute();

// Nested joins
const complexJoin = await client
  .from<User>('users')
  .select(`
    id, 
    name,
    posts:posts(
      id, 
      title, 
      comments:comments(
        id, 
        content, 
        author:users(name)
      )
    )
  `)
  .execute();
```

## Mutation Methods

```typescript
// Insert single record
const newUser = await client
  .from<User>('users')
  .insert({ 
    name: 'John Doe', 
    email: 'john@example.com' 
  })
  .select('*')
  .single()
  .execute();

// Bulk insert
const newUsers = await client
  .from<User>('users')
  .insert([
    { name: 'Alice', email: 'alice@example.com' },
    { name: 'Bob', email: 'bob@example.com' }
  ])
  .select('*')
  .execute();

// Update records
const updatedUsers = await client
  .from<User>('users')
  .update({ active: false })
  .eq('last_login', null)
  .select('*')
  .execute();

// Delete records
await client
  .from<User>('users')
  .delete()
  .eq('id', 123)
  .execute();
```

## Error Handling

```typescript
try {
  const users = await client
    .from<User>('users')
    .select('*')
    .execute();
} catch (error) {
  if (error.name === 'QueryBuilderError') {
    console.error('Query execution failed:', error.message);
    
    // Handle specific error types
    switch (error.code) {
      case 'INVALID_FILTER':
        // Handle invalid filter
        break;
      case 'UNAUTHORIZED':
        // Handle unauthorized access
        break;
    }
  }
}
```

## Advanced Configuration

```typescript
const query = client
  .from<User>('users')
  .select('*')
  .configure({
    // Query-specific settings
    timeout: 5000, // 5 seconds
    retryAttempts: 3,
    cacheStrategy: 'aggressive',
    
    // Performance optimization
    selectStrategy: 'minimal',
    
    // Logging
    logQuery: true
  });
```

## Type Safety and Inference

```typescript
// Strict type checking
const typeSafeQuery = client
  .from<User>('users')
  .select('id', 'name') // Only allowed User fields
  .eq('active', true);  // Type-safe value

// Prevents type errors
// This would cause a TypeScript compilation error:
// .eq('nonexistent_field', 123)
```

## Performance Considerations

- Use selective column selection
- Apply filters server-side
- Leverage indexes
- Use pagination for large datasets
- Minimize client-side data processing
- Cache query results when appropriate

## Best Practices

- Always use type generics
- Apply filters early in the query
- Select only necessary columns
- Use server-side aggregations
- Handle potential errors
- Implement proper logging
- Monitor query performance

---

# ORM-Style SelectQueryBuilder

## SelectQueryBuilder Interface

```typescript
interface SelectQueryBuilder<T extends Record<string, unknown> = Record<string, unknown>> {
  // SELECT methods
  select(selection?: string | string[]): this;
  addSelect(selection: string): this;

  // WHERE methods with parameter binding
  where(condition: string, parameters?: Record<string, any>): this;
  andWhere(condition: string, parameters?: Record<string, any>): this;
  orWhere(condition: string, parameters?: Record<string, any>): this;

  // Advanced WHERE methods
  whereIn(column: string, values: any[]): this;
  whereNull(column: string): this;
  whereNotNull(column: string): this;
  whereExists(subQuery: (qb: SelectQueryBuilder<T>) => void): this;

  // JOIN methods (PostgREST embedded resources)
  leftJoinAndSelect(relation: string, alias: string, condition?: string, parameters?: Record<string, any>): this;
  innerJoinAndSelect(relation: string, alias: string, condition?: string, parameters?: Record<string, any>): this;

  // ORDER BY methods
  orderBy(column: string, direction?: 'ASC' | 'DESC'): this;
  addOrderBy(column: string, direction?: 'ASC' | 'DESC'): this;

  // LIMIT and OFFSET
  limit(limit: number): this;
  offset(offset: number): this;

  // Execution methods
  getMany(): Promise<T[]>;
  getOne(): Promise<T | null>;
  getOneOrFail(): Promise<T>;
  getCount(): Promise<number>;

  // Utility methods
  clone(): SelectQueryBuilder<T>;
}
```

## Creating a SelectQueryBuilder

```typescript
// Via repository
const userRepo = client.getRepository<User>('users');
const queryBuilder = userRepo.createQueryBuilder();

// Via custom repository
class UserRepository extends CustomRepositoryBase<User> {
  findActiveUsers() {
    return this.createQueryBuilder()
      .where('active = :active', { active: true });
  }
}
```

## SELECT Methods

```typescript
// Select specific columns
const users = await userRepo
  .createQueryBuilder()
  .select(['id', 'name', 'email'])
  .getMany();

// Add additional selections
const usersWithExtra = await userRepo
  .createQueryBuilder()
  .select(['id', 'name'])
  .addSelect('email')
  .addSelect('created_at')
  .getMany();

// Select all columns (default)
const allUsers = await userRepo
  .createQueryBuilder()
  .getMany();
```

## WHERE Conditions with Parameter Binding

```typescript
// Basic WHERE with parameters
const activeUsers = await userRepo
  .createQueryBuilder()
  .where('active = :active', { active: true })
  .getMany();

// Multiple WHERE conditions
const filteredUsers = await userRepo
  .createQueryBuilder()
  .where('active = :active', { active: true })
  .andWhere('age >= :minAge', { minAge: 18 })
  .andWhere('created_at >= :date', { date: '2024-01-01' })
  .getMany();

// OR conditions
const roleUsers = await userRepo
  .createQueryBuilder()
  .where('role = :admin', { admin: 'admin' })
  .orWhere('role = :moderator', { moderator: 'moderator' })
  .getMany();
```

## Advanced WHERE Methods

```typescript
// WHERE IN
const statusUsers = await userRepo
  .createQueryBuilder()
  .whereIn('status', ['active', 'verified', 'premium'])
  .getMany();

// NULL checks
const unverifiedUsers = await userRepo
  .createQueryBuilder()
  .whereNull('verified_at')
  .getMany();

const verifiedUsers = await userRepo
  .createQueryBuilder()
  .whereNotNull('verified_at')
  .getMany();

// EXISTS subquery
const usersWithPosts = await userRepo
  .createQueryBuilder()
  .whereExists(subQuery => {
    subQuery
      .select('1')
      .from('posts')
      .where('posts.user_id = users.id');
  })
  .getMany();
```

## Complex WHERE Conditions with Brackets

```typescript
import { Brackets } from '@webcoded/pgrestify';

const complexQuery = await userRepo
  .createQueryBuilder()
  .where('active = :active', { active: true })
  .andWhere(new Brackets(qb => {
    qb.where('role = :admin', { admin: 'admin' })
      .orWhere('verified = :verified', { verified: true });
  }))
  .andWhere(new Brackets(qb => {
    qb.where('age >= :minAge', { minAge: 18 })
      .andWhere('age <= :maxAge', { maxAge: 65 });
  }))
  .getMany();

// Generates: WHERE active = true AND (role = 'admin' OR verified = true) AND (age >= 18 AND age <= 65)
```

## JOIN Operations (PostgREST Embedded Resources)

```typescript
// Left join with posts
const usersWithPosts = await userRepo
  .createQueryBuilder()
  .leftJoinAndSelect('posts', 'post')
  .getMany();

// Inner join with profile
const usersWithProfile = await userRepo
  .createQueryBuilder()
  .innerJoinAndSelect('profile', 'profile')
  .getMany();

// Multiple joins
const complexJoin = await userRepo
  .createQueryBuilder()
  .leftJoinAndSelect('posts', 'post')
  .leftJoinAndSelect('profile', 'profile')
  .innerJoinAndSelect('roles', 'role')
  .getMany();
```

## ORDER BY

```typescript
// Basic ordering
const orderedUsers = await userRepo
  .createQueryBuilder()
  .orderBy('created_at', 'DESC')
  .getMany();

// Multiple ordering
const multiOrderUsers = await userRepo
  .createQueryBuilder()
  .orderBy('role', 'ASC')
  .addOrderBy('created_at', 'DESC')
  .addOrderBy('name', 'ASC')
  .getMany();
```

## LIMIT and OFFSET

```typescript
// Pagination
const page1 = await userRepo
  .createQueryBuilder()
  .orderBy('created_at', 'DESC')
  .limit(20)
  .offset(0)
  .getMany();

const page2 = await userRepo
  .createQueryBuilder()
  .orderBy('created_at', 'DESC')
  .limit(20)
  .offset(20)
  .getMany();
```

## Execution Methods

```typescript
// Get multiple results
const users: User[] = await userRepo
  .createQueryBuilder()
  .where('active = :active', { active: true })
  .getMany();

// Get single result (null if not found)
const user: User | null = await userRepo
  .createQueryBuilder()
  .where('id = :id', { id: 1 })
  .getOne();

// Get single result (throws error if not found)
const userOrFail: User = await userRepo
  .createQueryBuilder()
  .where('id = :id', { id: 1 })
  .getOneOrFail();

// Get count
const count: number = await userRepo
  .createQueryBuilder()
  .where('active = :active', { active: true })
  .getCount();
```

## Query Builder in Custom Repositories

```typescript
import { CustomRepositoryBase, Brackets } from '@webcoded/pgrestify';

class UserRepository extends CustomRepositoryBase<User> {
  async findActiveUsers(): Promise<User[]> {
    return this.createQueryBuilder()
      .where('active = :active', { active: true })
      .andWhere('verified = :verified', { verified: true })
      .orderBy('created_at', 'DESC')
      .getMany();
  }

  async findUsersByRoleAndStatus(role: string, statuses: string[]): Promise<User[]> {
    return this.createQueryBuilder()
      .where('role = :role', { role })
      .andWhere(new Brackets(qb => {
        qb.whereIn('status', statuses)
          .orWhere('premium = :premium', { premium: true });
      }))
      .leftJoinAndSelect('profile', 'profile')
      .orderBy('name', 'ASC')
      .getMany();
  }

  async findUsersWithRecentActivity(days: number): Promise<User[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.createQueryBuilder()
      .where('last_login >= :cutoff', { cutoff: cutoffDate.toISOString() })
      .orWhere('updated_at >= :cutoff', { cutoff: cutoffDate.toISOString() })
      .whereNotNull('verified_at')
      .orderBy('last_login', 'DESC')
      .limit(100)
      .getMany();
  }
}
```

## Cloning and Reusing Queries

```typescript
// Create base query
const baseQuery = userRepo
  .createQueryBuilder()
  .where('active = :active', { active: true })
  .orderBy('created_at', 'DESC');

// Clone and extend for different use cases
const recentUsers = await baseQuery
  .clone()
  .andWhere('created_at >= :date', { date: '2024-01-01' })
  .limit(10)
  .getMany();

const premiumUsers = await baseQuery
  .clone()
  .andWhere('premium = :premium', { premium: true })
  .leftJoinAndSelect('subscription', 'sub')
  .getMany();
```

## Type Safety and Parameter Binding

The SelectQueryBuilder provides complete type safety:

```typescript
// Parameters are properly typed and validated
const typedQuery = await userRepo
  .createQueryBuilder()
  .where('age >= :minAge', { minAge: 18 })        // ✅ Correct
  .andWhere('name = :name', { name: 'John' })     // ✅ Correct
  .andWhere('active = :active', { active: true }) // ✅ Correct
  // .where('age >= :minAge', { wrongParam: 18 })  // ❌ TypeScript error
  .getMany();
```

## Performance Best Practices

- **Use parameter binding** to prevent SQL injection
- **Select only needed columns** to reduce data transfer
- **Apply WHERE conditions early** to filter data server-side
- **Use appropriate JOINs** for related data
- **Add database indexes** for frequently queried columns
- **Use LIMIT/OFFSET** for pagination
- **Clone and reuse** base queries when possible