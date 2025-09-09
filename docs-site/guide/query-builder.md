# Query Builder

PGRestify's query builder provides a fluent, type-safe API for constructing complex database queries. It supports all PostgREST operators and features while maintaining full TypeScript type safety.

For detailed API documentation, see our comprehensive [Query Building Guide](./query-building.md).

## Basic Query Building

### Simple Selection

```typescript
// Select all columns
const response = await client.from<User>('users').execute();
const users = response.data || [];

// Select specific columns
const response = await client
  .from<User>('users')
  .select('id', 'name', 'email')
  .execute();

// Using getMany for cleaner syntax
const response = await client
  .from<User>('users')
  .select('id', 'name', 'email')
  .getMany();
```

### Filtering

PGRestify supports all PostgREST filter operators:

#### Equality Operators

```typescript
// Equal
const response = await client
  .from<User>('users')
  .eq('active', true)
  .execute();

// Not equal
const response = await client
  .from<User>('users')
  .neq('active', true)
  .getMany();
```

#### Comparison Operators

```typescript
// Greater than
const response = await client
  .from<User>('users')
  .gt('created_at', '2023-01-01')
  .execute();

// Greater than or equal
const response = await client
  .from<User>('users')
  .gte('age', 18)
  .getMany();

// Less than
const response = await client
  .from<User>('users')
  .lt('age', 30)
  .execute();

// Less than or equal
const response = await client
  .from<User>('users')
  .lte('age', 65)
  .getMany();
```

#### Pattern Matching

```typescript
// Like (case-sensitive)
const response = await client
  .from<User>('users')
  .like('name', 'John*')
  .execute();

// ILike (case-insensitive)
const response = await client
  .from<User>('users')
  .ilike('name', 'john*')
  .getMany();

// Match (regex, case-sensitive)
const response = await client
  .from<User>('users')
  .match('email', '.*@gmail\\.com$')
  .execute();

// IMatch (regex, case-insensitive)
const response = await client
  .from<User>('users')
  .imatch('email', '.*@GMAIL\\.COM$')
  .getMany();
```

#### Array and Range Operations

```typescript
// In array
const response = await client
  .from<User>('users')
  .in('id', [1, 2, 3, 4, 5])
  .execute();

// Contains (for arrays and ranges)
const response = await client
  .from<Post>('posts')
  .contains('tags', ['javascript', 'typescript'])
  .getMany();

// Contained by
const response = await client
  .from<Post>('posts')
  .containedBy('tags', ['javascript', 'typescript', 'react', 'vue'])
  .execute();

// Overlaps (for ranges)
const response = await client
  .from<Event>('events')
  .overlaps('date_range', '[2023-01-01,2023-12-31)')
  .getMany();
```

#### Null Operations

```typescript
// Is null
const response = await client
  .from<User>('users')
  .is('profile_id', null)
  .execute();

// Is not null
const response = await client
  .from<User>('users')
  .not('profile_id', 'is', null)
  .getMany();
```

## Combining Filters

### AND Conditions (Default)

By default, multiple filters are combined with AND:

```typescript
const response = await client
  .from<User>('users')
  .eq('active', true)
  .gte('age', 18)
  .execute();
// WHERE active = true AND age >= 18
```

### OR Conditions

```typescript
const response = await client
  .from<User>('users')
  .or('age.lt.25,age.gt.65')
  .execute();
// WHERE age < 25 OR age > 65

// Complex OR with AND
const response = await client
  .from<User>('users')
  .or('and(name.ilike.*john*,active.eq.true),and(name.ilike.*jane*,active.eq.false)')
  .getMany();
```

### NOT Conditions

```typescript
const response = await client
  .from<User>('users')
  .not('name', 'ilike', '*john*')
  .execute();
```

## Ordering

```typescript
// Single column, ascending (default)
const response = await client
  .from<User>('users')
  .order('name')
  .execute();

// Single column, descending
const response = await client
  .from<User>('users')
  .order('created_at', { ascending: false })
  .getMany();

// Multiple columns
const response = await client
  .from<User>('users')
  .order('active', { ascending: false })
  .order('name', { ascending: true })
  .execute();

// Null handling
const response = await client
  .from<User>('users')
  .order('last_login', { ascending: false, nullsFirst: false })
  .getMany();
```

## Pagination

### Limit and Offset

```typescript
// First 10 users
const response = await client
  .from<User>('users')
  .limit(10)
  .execute();

// Second page (skip first 10)
const response = await client
  .from<User>('users')
  .limit(10)
  .offset(10)
  .getMany();
```

### Range-based Pagination

```typescript
// Get rows 20-29 (zero-indexed)
const response = await client
  .from<User>('users')
  .range(20, 29)
  .execute();
```

## Counting

```typescript
// Get count only
const userCount = await client
  .from<User>('users')
  .getCount();

// Get data with count
const response = await client
  .from<User>('users')
  .select('*')
  .count('exact')
  .execute();
const { data, count } = response;

// Estimated count (faster for large tables)
const response = await client
  .from<User>('users')
  .count('estimated')
  .execute();
const { data, count } = response;
```

## Single Row Queries

```typescript
// Get single row (throws if not found or multiple found)
const response = await client
  .from<User>('users')
  .select('*')
  .eq('id', 1)
  .single()
  .execute();
const user = response.data;

// Maybe single (returns null if not found)
const response = await client
  .from<User>('users')
  .eq('id', 1)
  .maybeSingle()
  .execute();
const user = response.data;

// Get one or fail (cleaner syntax)
const user = await client
  .from<User>('users')
  .eq('id', 1)
  .getOneOrFail();
```

## Advanced Selection

### Column Aliasing

```typescript
// Rename columns in response
const response = await client
  .from<User>('users')
  .selectAs({
    userId: 'id',
    fullName: 'name',
    emailAddress: 'email'
  })
  .execute();
```

### Computed Fields

```typescript
// Select with computed fields
const response = await client
  .from<Post>('posts')
  .select(`
    id,
    title,
    views,
    likes,
    engagement_score:(views + likes * 2),
    is_popular:(views > 1000)
  `)
  .execute();
```

### Embedded Resources (Joins)

```typescript
// Simple join
const response = await client
  .from<Post>('posts')
  .select(`
    id,
    title,
    content,
    author:users!posts_author_id_fkey(id, name, email)
  `)
  .execute();

// Complex nested joins
const postsWithEverything = await client
  .from<Post>('posts')
  .select(`
    id,
    title,
    content,
    author:users!posts_author_id_fkey(
      id,
      name,
      email,
      profile:profiles(bio, avatar_url)
    ),
    comments:comments(
      id,
      content,
      user:users(name)
    )
  `)
  .find();
```

## Full-Text Search

```typescript
// Simple full-text search
const response = await client
  .from<Post>('posts')
  .fts('content', 'javascript typescript')
  .execute();

// Search with configuration
const configuredSearch = await client
  .from<Post>('posts')
  .fts('content', 'javascript', { config: 'english' })
  .find();

// Phrase search
const phraseSearch = await client
  .from<Post>('posts')
  .plfts('content', 'web development')
  .find();

// WebSearch-style search
const webSearch = await client
  .from<Post>('posts')
  .wfts('content', 'javascript OR typescript')
  .find();
```

## Aggregation Functions

```typescript
// Basic aggregates
const stats = await client
  .from<Sale>('sales')
  .select(`
    count(*) as total_sales,
    sum(amount) as total_revenue,
    avg(amount) as avg_sale,
    min(amount) as min_sale,
    max(amount) as max_sale
  `)
  .single()
  .execute();

// Group by
const salesByRegion = await client
  .from<Sale>('sales')
  .select(`
    region,
    count(*) as total_sales,
    sum(amount) as revenue
  `)
  .groupBy('region')
  .execute();

// Having clause
const bigRegions = await client
  .from<Sale>('sales')
  .select(`
    region,
    sum(amount) as revenue
  `)
  .groupBy('region')
  .having('sum(amount) > 10000')
  .execute();
```

## Method Chaining

All query builder methods can be chained for complex queries:

```typescript
const response = await client
  .from<User>('users')
  .select('id, name, email, posts:posts(id, title)')
  .eq('active', true)
  .gte('created_at', '2023-01-01')
  .or('role.eq.admin,posts.gt.10')
  .order('created_at', { ascending: false })
  .order('name')
  .range(0, 19)
  .execute();
```

## Query Execution

### Execution Methods

```typescript
// execute() - returns QueryResponse with data/error
const response = await client.from<User>('users').execute();
if (response.error) {
  console.error('Query failed:', response.error);
} else {
  console.log('Users:', response.data);
}

// getMany() - returns QueryResponse for multiple rows
const response = await client.from<User>('users').getMany();

// getOne() - returns QueryResponse for single row
const response = await client
  .from<User>('users')
  .eq('id', 1)
  .getOne();

// getOneOrFail() - throws if not found, returns the entity directly
const user = await client
  .from<User>('users')
  .eq('id', 1)
  .getOneOrFail();

// single() - ensure single row result (with execute)
const response = await client
  .from<User>('users')
  .eq('id', 1)
  .single()
  .execute();

// maybeSingle() - single row or null (with execute)
const response = await client
  .from<User>('users')
  .eq('email', 'user@example.com')
  .maybeSingle()
  .execute();
```

### Error Handling

```typescript
try {
  const response = await client.from<User>('users').execute();
  if (response.error) {
    throw response.error;
  }
  const users = response.data;
} catch (error) {
  if (error instanceof PostgRESTError) {
    console.log(`Database error ${error.statusCode}: ${error.message}`);
    console.log('Details:', error.details);
  }
}
```

## Performance Tips

### Use Specific Selects

```typescript
// ❌ Don't select all columns if you don't need them
const response = await client.from<User>('users').execute();

// ✅ Select only what you need
const response = await client
  .from<User>('users')
  .select('id', 'name', 'email')
  .execute();
```

### Use Limits

```typescript
// ❌ Don't fetch unlimited rows
const response = await client.from<User>('users').execute();

// ✅ Always use limits for large datasets
const response = await client
  .from<User>('users')
  .limit(100)
  .execute();
```

### Use Estimated Counts

```typescript
// ❌ Exact counts are slow for large tables
const { count } = await client
  .from<User>('users')
  .count('exact')
  .execute();

// ✅ Use estimated counts when possible
const { count } = await client
  .from<User>('users')
  .count('estimated')
  .execute();
```

The query builder is the heart of PGRestify, providing a powerful yet intuitive way to construct any query your application needs! 🚀