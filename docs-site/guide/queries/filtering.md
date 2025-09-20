# Filtering & Operators

Master the comprehensive filtering capabilities of PGRestify with all PostgREST operators, pattern matching, and complex filter combinations.

## Overview

Filtering is essential for retrieving specific data from your database. PGRestify provides a complete set of operators that map directly to PostgreSQL's powerful filtering capabilities, allowing you to construct precise queries from simple equality checks to complex pattern matching and JSON operations.

## Basic Filtering Operators

### Equality Operators

#### eq (Equals)

Match records where a column equals a specific value:

```typescript
// Find user with specific email
const user = await client
  .from('users')
  .select('*')
  .eq('email', 'john@example.com')
  .execute();

// Find products with exact price
const products = await client
  .from('products')
  .select('*')
  .eq('price', 99.99)
  .execute();

// Boolean equality
const activeUsers = await client
  .from('users')
  .select('*')
  .eq('is_active', true)
  .execute();
```

#### neq (Not Equals)

Match records where a column does not equal a specific value:

```typescript
// Find all users except one
const otherUsers = await client
  .from('users')
  .select('*')
  .neq('id', 123)
  .execute();

// Find products not in a specific category
const products = await client
  .from('products')
  .select('*')
  .neq('category', 'electronics')
  .execute();

// Find incomplete orders
const pendingOrders = await client
  .from('orders')
  .select('*')
  .neq('status', 'completed')
  .execute();
```

### Comparison Operators

#### gt (Greater Than)

```typescript
// Find expensive products
const expensiveProducts = await client
  .from('products')
  .select('*')
  .gt('price', 1000)
  .execute();

// Find recent posts
const recentPosts = await client
  .from('posts')
  .select('*')
  .gt('created_at', '2024-01-01')
  .execute();

// Find users above certain age
const adults = await client
  .from('users')
  .select('*')
  .gt('age', 18)
  .execute();
```

#### gte (Greater Than or Equal)

```typescript
// Include boundary value
const products = await client
  .from('products')
  .select('*')
  .gte('price', 100)
  .execute();

// Find posts from specific date onwards
const posts = await client
  .from('posts')
  .select('*')
  .gte('published_at', '2024-01-01')
  .execute();

// Minimum quantity check
const inStock = await client
  .from('inventory')
  .select('*')
  .gte('quantity', 1)
  .execute();
```

#### lt (Less Than)

```typescript
// Find cheap products
const budgetProducts = await client
  .from('products')
  .select('*')
  .lt('price', 50)
  .execute();

// Find old records
const oldPosts = await client
  .from('posts')
  .select('*')
  .lt('created_at', '2023-01-01')
  .execute();

// Find young users
const youngUsers = await client
  .from('users')
  .select('*')
  .lt('age', 18)
  .execute();
```

#### lte (Less Than or Equal)

```typescript
// Include boundary value
const affordableProducts = await client
  .from('products')
  .select('*')
  .lte('price', 100)
  .execute();

// Find records up to specific date
const historicalData = await client
  .from('events')
  .select('*')
  .lte('event_date', '2023-12-31')
  .execute();

// Maximum limit check
const lowStock = await client
  .from('inventory')
  .select('*')
  .lte('quantity', 10)
  .execute();
```

## Pattern Matching Operators

### like (Pattern Match - Case Sensitive)

```typescript
// Find emails from specific domain
const gmailUsers = await client
  .from('users')
  .select('*')
  .like('email', '%@gmail.com')
  .execute();

// Find products with specific name pattern
const products = await client
  .from('products')
  .select('*')
  .like('name', 'iPhone%')
  .execute();

// Find posts with specific tags
const tutorials = await client
  .from('posts')
  .select('*')
  .like('title', '%Tutorial%')
  .execute();

// Pattern matching with wildcards
// % - matches any sequence of characters
// _ - matches any single character
const results = await client
  .from('products')
  .select('*')
  .like('sku', 'PRD-___-2024')  // Matches PRD-XXX-2024
  .execute();
```

### ilike (Pattern Match - Case Insensitive)

```typescript
// Case-insensitive email search
const users = await client
  .from('users')
  .select('*')
  .ilike('email', '%JOHN%')
  .execute();

// Case-insensitive name search
const products = await client
  .from('products')
  .select('*')
  .ilike('name', '%laptop%')
  .execute();

// Flexible search patterns
const articles = await client
  .from('articles')
  .select('*')
  .ilike('title', '%javascript%')
  .execute();
```

### match (Full-Text Search)

```typescript
// Regular expression matching (PostgreSQL specific)
const results = await client
  .from('users')
  .select('*')
  .match({ email: '^[a-z]+@example\\.com$' })
  .execute();

// Multiple column matching
const products = await client
  .from('products')
  .select('*')
  .match({
    name: 'laptop',
    category: 'electronics'
  })
  .execute();
```

## Range and List Operators

### in (In List)

```typescript
// Find records with ID in list
const selectedUsers = await client
  .from('users')
  .select('*')
  .in('id', [1, 2, 3, 4, 5])
  .execute();

// Find products in multiple categories
const products = await client
  .from('products')
  .select('*')
  .in('category', ['electronics', 'computers', 'phones'])
  .execute();

// Find orders with specific statuses
const orders = await client
  .from('orders')
  .select('*')
  .in('status', ['pending', 'processing', 'shipped'])
  .execute();

// Dynamic list building
const userIds = [10, 20, 30, 40];
const users = await client
  .from('users')
  .select('*')
  .in('id', userIds)
  .execute();
```

### Array Operations

#### contains (Array Contains)

```typescript
// Find posts with specific tags (array column)
const javascriptPosts = await client
  .from('posts')
  .select('*')
  .contains('tags', ['javascript', 'typescript'])
  .execute();

// Find users with specific roles
const adminUsers = await client
  .from('users')
  .select('*')
  .contains('roles', ['admin'])
  .execute();

// Find products with specific features
const products = await client
  .from('products')
  .select('*')
  .contains('features', ['wifi', 'bluetooth'])
  .execute();
```

#### containedBy (Array Contained By)

```typescript
// Find posts with tags that are subset of given array
const filteredPosts = await client
  .from('posts')
  .select('*')
  .containedBy('tags', ['javascript', 'typescript', 'react', 'vue'])
  .execute();

// Find users whose permissions are within allowed set
const users = await client
  .from('users')
  .select('*')
  .containedBy('permissions', ['read', 'write', 'delete'])
  .execute();
```

#### overlaps (Array Overlaps)

```typescript
// Find posts with any of the specified tags
const posts = await client
  .from('posts')
  .select('*')
  .overlaps('tags', ['javascript', 'python', 'rust'])
  .execute();

// Find users with overlapping skills
const developers = await client
  .from('developers')
  .select('*')
  .overlaps('skills', ['react', 'vue', 'angular'])
  .execute();
```

## JSON/JSONB Operators

### JSON Field Access

```typescript
// Access JSON field with arrow operator
const users = await client
  .from('users')
  .select('*, metadata->preferences')
  .execute();

// Filter by JSON field value
const darkModeUsers = await client
  .from('users')
  .select('*')
  .eq('metadata->theme', 'dark')
  .execute();

// Nested JSON field access
const results = await client
  .from('users')
  .select('*')
  .eq('settings->notifications->email', true)
  .execute();
```

### JSON Contains

```typescript
// Check if JSON contains specific structure
const users = await client
  .from('users')
  .select('*')
  .contains('metadata', { 
    theme: 'dark',
    language: 'en'
  })
  .execute();

// Partial JSON matching
const products = await client
  .from('products')
  .select('*')
  .contains('specifications', {
    color: 'black'
  })
  .execute();
```

### JSON Operations with Operators

```typescript
// Compare JSON field values
const users = await client
  .from('users')
  .select('*')
  .gt('stats->login_count', 10)
  .execute();

// Pattern matching in JSON fields
const products = await client
  .from('products')
  .select('*')
  .ilike('details->manufacturer', '%apple%')
  .execute();

// JSON array operations
const posts = await client
  .from('posts')
  .select('*')
  .contains('metadata->categories', ['technology'])
  .execute();
```

## NULL Value Handling

### is (IS NULL / IS NOT NULL)

```typescript
// Find records with NULL values
const usersWithoutEmail = await client
  .from('users')
  .select('*')
  .is('email', null)
  .execute();

// Find records with non-NULL values
const usersWithEmail = await client
  .from('users')
  .select('*')
  .is('email', 'not.null')
  .execute();

// Multiple NULL checks
const incompleteProfiles = await client
  .from('user_profiles')
  .select('*')
  .is('bio', null)
  .is('avatar_url', null)
  .execute();
```

### NULL in Comparisons

```typescript
// Combine NULL checks with other filters
const activeUsersWithoutProfile = await client
  .from('users')
  .select('*')
  .eq('active', true)
  .is('profile_id', null)
  .execute();

// Handle optional fields
const products = await client
  .from('products')
  .select('*')
  .is('discount_price', 'not.null')
  .lt('discount_price', 100)
  .execute();
```

## Complex Filter Combinations

### AND Logic (Default)

```typescript
// Multiple filters are combined with AND by default
const results = await client
  .from('products')
  .select('*')
  .eq('category', 'electronics')
  .gte('price', 100)
  .lte('price', 1000)
  .eq('in_stock', true)
  .execute();

// Complex AND conditions
const users = await client
  .from('users')
  .select('*')
  .eq('active', true)
  .gte('age', 18)
  .ilike('email', '%@company.com')
  .is('deleted_at', null)
  .execute();
```

### OR Logic

```typescript
// Simple OR condition
const results = await client
  .from('products')
  .select('*')
  .or('price.lt.50,price.gt.1000')
  .execute();

// Multiple OR conditions
const posts = await client
  .from('posts')
  .select('*')
  .or('status.eq.draft,status.eq.published')
  .execute();

// Complex OR with multiple fields
const users = await client
  .from('users')
  .select('*')
  .or('email.ilike.%@gmail.com,email.ilike.%@yahoo.com,email.ilike.%@outlook.com')
  .execute();

// Combining OR groups
const products = await client
  .from('products')
  .select('*')
  .or('(category.eq.electronics,category.eq.computers)')
  .or('(price.lt.100,price.gt.5000)')
  .execute();
```

### Mixed AND/OR Logic

```typescript
// AND with nested OR
const products = await client
  .from('products')
  .select('*')
  .eq('in_stock', true)
  .or('category.eq.electronics,category.eq.computers')
  .gte('price', 100)
  .execute();

// Complex mixed conditions
const users = await client
  .from('users')
  .select('*')
  .eq('active', true)
  .or('role.eq.admin,role.eq.moderator')
  .gte('created_at', '2023-01-01')
  .execute();
```

### NOT Logic

```typescript
// Negate conditions
const results = await client
  .from('products')
  .select('*')
  .not('category', 'eq', 'electronics')
  .execute();

// NOT with other operators
const users = await client
  .from('users')
  .select('*')
  .not('email', 'like', '%@test.com')
  .execute();

// Complex NOT conditions
const posts = await client
  .from('posts')
  .select('*')
  .not('status', 'in', ['draft', 'archived'])
  .execute();
```

## Dynamic Filter Building

### Conditional Filter Application

::: code-group

```typescript [PostgREST Syntax]
interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  search?: string;
}

const getFilteredProducts = async (filters: ProductFilters) => {
  let query = client
    .from('products')
    .select('*');

  // Apply filters conditionally
  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.minPrice !== undefined) {
    query = query.gte('price', filters.minPrice);
  }

  if (filters.maxPrice !== undefined) {
    query = query.lte('price', filters.maxPrice);
  }

  if (filters.inStock !== undefined) {
    query = query.eq('in_stock', filters.inStock);
  }

  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }

  return query.execute();
};

// Usage
const electronics = await getFilteredProducts({
  category: 'electronics',
  minPrice: 100,
  maxPrice: 1000,
  inStock: true
});
```

```typescript [Repository Pattern]
interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  search?: string;
}

const getFilteredProducts = async (filters: ProductFilters) => {
  const productRepo = client.getRepository<Product>('products');
  let query = productRepo.createQueryBuilder();

  // Apply filters conditionally with parameter binding
  if (filters.category) {
    query = query.where('category = :category', { category: filters.category });
  }

  if (filters.minPrice !== undefined) {
    query = query.andWhere('price >= :minPrice', { minPrice: filters.minPrice });
  }

  if (filters.maxPrice !== undefined) {
    query = query.andWhere('price <= :maxPrice', { maxPrice: filters.maxPrice });
  }

  if (filters.inStock !== undefined) {
    query = query.andWhere('in_stock = :inStock', { inStock: filters.inStock });
  }

  if (filters.search) {
    query = query.andWhere('name ILIKE :search', { search: `%${filters.search}%` });
  }

  return query.getMany();
};

// Usage
const electronics = await getFilteredProducts({
  category: 'electronics',
  minPrice: 100,
  maxPrice: 1000,
  inStock: true
});
```

:::
```

### Filter Builder Pattern

```typescript
class FilterBuilder {
  private filters: any[] = [];

  eq(column: string, value: any) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push({ type: 'gt', column, value });
    return this;
  }

  like(column: string, pattern: string) {
    this.filters.push({ type: 'like', column, value: pattern });
    return this;
  }

  apply(query: any) {
    this.filters.forEach(filter => {
      switch (filter.type) {
        case 'eq':
          query = query.eq(filter.column, filter.value);
          break;
        case 'gt':
          query = query.gt(filter.column, filter.value);
          break;
        case 'like':
          query = query.like(filter.column, filter.value);
          break;
      }
    });
    return query;
  }
}

// Usage
const filterBuilder = new FilterBuilder()
  .eq('category', 'electronics')
  .gt('price', 100)
  .like('name', '%laptop%');

const query = client.from('products').select('*');
const filteredQuery = filterBuilder.apply(query);
const results = await filteredQuery.execute();
```

## Advanced Filtering Patterns

### Date Range Filtering

```typescript
const getRecordsInDateRange = async (
  table: string,
  dateColumn: string,
  startDate: string,
  endDate: string
) => {
  return client
    .from(table)
    .select('*')
    .gte(dateColumn, startDate)
    .lte(dateColumn, endDate)
    .execute();
};

// Get posts from last 30 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const recentPosts = await client
  .from('posts')
  .select('*')
  .gte('created_at', thirtyDaysAgo.toISOString())
  .execute();

// Get events for specific month
const monthEvents = await getRecordsInDateRange(
  'events',
  'event_date',
  '2024-01-01',
  '2024-01-31'
);
```

### Numeric Range Filtering

```typescript
// Price range with optional bounds
const getProductsInPriceRange = async (
  min?: number,
  max?: number
) => {
  let query = client
    .from('products')
    .select('*');

  if (min !== undefined) {
    query = query.gte('price', min);
  }

  if (max !== undefined) {
    query = query.lte('price', max);
  }

  return query.execute();
};

// Percentage range
const getHighPerformers = async () => {
  return client
    .from('employees')
    .select('*')
    .gte('performance_score', 80)
    .lte('performance_score', 100)
    .execute();
};
```

### Multi-Column Search

```typescript
const searchAcrossColumns = async (
  searchTerm: string,
  columns: string[]
) => {
  const orConditions = columns
    .map(col => `${col}.ilike.%${searchTerm}%`)
    .join(',');

  return client
    .from('products')
    .select('*')
    .or(orConditions)
    .execute();
};

// Usage
const results = await searchAcrossColumns('laptop', [
  'name',
  'description',
  'category',
  'brand'
]);
```

### Hierarchical Filtering

```typescript
// Filter with parent-child relationships
const getCategoryProducts = async (categoryId: number) => {
  // Get category and all subcategories
  const categories = await client
    .from('categories')
    .select('id')
    .or(`id.eq.${categoryId},parent_id.eq.${categoryId}`)
    .execute();

  const categoryIds = categories.data.map(c => c.id);

  // Get products in these categories
  return client
    .from('products')
    .select('*')
    .in('category_id', categoryIds)
    .execute();
};
```

## Filter Validation and Safety

### Input Sanitization

```typescript
const safeSearch = async (userInput: string) => {
  // Escape special characters for LIKE patterns
  const escapedInput = userInput
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');

  return client
    .from('products')
    .select('*')
    .ilike('name', `%${escapedInput}%`)
    .execute();
};

// Validate filter values
const validateAndFilter = async (filters: any) => {
  const validFilters: any = {};

  // Validate category
  if (filters.category && typeof filters.category === 'string') {
    validFilters.category = filters.category;
  }

  // Validate price
  if (filters.price && !isNaN(filters.price) && filters.price > 0) {
    validFilters.price = filters.price;
  }

  // Apply validated filters
  let query = client.from('products').select('*');
  
  Object.entries(validFilters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  return query.execute();
};
```

### Type-Safe Filtering

```typescript
// Define allowed filter types
interface StrictFilters {
  id?: number;
  name?: string;
  category?: 'electronics' | 'books' | 'clothing';
  price?: { min?: number; max?: number };
  inStock?: boolean;
}

const applyStrictFilters = async (filters: StrictFilters) => {
  let query = client.from('products').select('*');

  if (filters.id !== undefined) {
    query = query.eq('id', filters.id);
  }

  if (filters.name) {
    query = query.ilike('name', `%${filters.name}%`);
  }

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.price) {
    if (filters.price.min !== undefined) {
      query = query.gte('price', filters.price.min);
    }
    if (filters.price.max !== undefined) {
      query = query.lte('price', filters.price.max);
    }
  }

  if (filters.inStock !== undefined) {
    query = query.eq('in_stock', filters.inStock);
  }

  return query.execute();
};
```

## Performance Optimization

### Index-Aware Filtering

```typescript
// Use indexed columns for filtering
const efficientUserSearch = async (email: string) => {
  // Email is typically indexed
  return client
    .from('users')
    .select('*')
    .eq('email', email)
    .single()
    .execute();
};

// Combine indexed columns efficiently
const efficientProductSearch = async (
  category: string,
  priceRange: { min: number; max: number }
) => {
  // Both category and price might be indexed
  return client
    .from('products')
    .select('*')
    .eq('category', category)
    .gte('price', priceRange.min)
    .lte('price', priceRange.max)
    .execute();
};
```

### Filter Order Optimization

```typescript
// Place most selective filters first
const optimizedQuery = async () => {
  return client
    .from('orders')
    .select('*')
    .eq('user_id', 123)           // Most selective
    .eq('status', 'completed')     // Moderately selective
    .gte('created_at', '2024-01-01') // Least selective
    .execute();
};

// Avoid expensive operations on large result sets
const avoidExpensiveFilters = async () => {
  // ❌ Bad: Pattern matching on large dataset
  const inefficient = await client
    .from('large_table')
    .select('*')
    .ilike('description', '%keyword%')
    .execute();

  // ✅ Good: Reduce dataset first
  const efficient = await client
    .from('large_table')
    .select('*')
    .eq('category', 'specific')
    .gte('created_at', '2024-01-01')
    .ilike('description', '%keyword%')
    .execute();
};
```

---

## Summary

PGRestify's filtering capabilities provide:

- **Dual Syntax Support**: Choose between PostgREST operators or ORM-style query builders
- **Complete Operator Set**: All PostgREST operators for any filtering need
- **Parameter Binding**: Safe, parameterized queries with the repository pattern
- **Pattern Matching**: Powerful LIKE/ILIKE operations for text search
- **Array Operations**: Native array column filtering support
- **JSON Support**: Query JSON/JSONB columns naturally
- **Complex Logic**: AND/OR/NOT combinations with Brackets for sophisticated filters
- **Type Safety**: Full TypeScript support for all filter operations
- **Performance**: Optimized filtering with index awareness
- **Flexibility**: Dynamic filter building for runtime conditions
- **Method Chaining**: Fluent APIs in both PostgREST and ORM styles

### Which Filtering Approach to Choose?

**Use PostgREST Syntax when:**
- You prefer direct PostgREST operators (`eq`, `gte`, `ilike`)
- Working with simple filters
- You want minimal query transformation
- Migrating from existing PostgREST applications

**Use Repository Pattern when:**
- You prefer SQL-like syntax (`WHERE`, `AND`, `OR`)
- You need parameter binding for security
- Building complex conditional logic
- You want automatic parameter escaping
- Coming from ORM or similar ORMs

Both approaches offer the same filtering power with complete type safety. Master these filtering techniques to build precise, efficient queries that retrieve exactly the data you need from your PostgreSQL database.