# Basic Queries

Learn the fundamentals of querying data with PGRestify using either PostgREST's native syntax or ORM-style repositories. Master both approaches to choose what fits your development style.

## Overview

Basic queries form the foundation of data retrieval in PGRestify. This guide covers both query approaches:

- **🎯 PostgREST Native Syntax**: Direct, chainable queries that map to PostgREST's capabilities
- **🏗️ ORM-Style Repository Pattern**: ORM-inspired approach with repositories and query builders

Both approaches are fully supported and can be used together in the same application.

## Getting Started with Queries

### Your First Query

The simplest query retrieves all records from a table. Choose the approach that feels natural:

::: code-group

```typescript [PostgREST Syntax]
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000'
});

// Retrieve all users
const users = await client
  .from('users')
  .select('*')
  .execute();

console.log(users.data); // Array of user objects
```

```typescript [Repository Pattern]
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000'
});

// Get repository for users table
const userRepo = client.getRepository<User>('users');

// Retrieve all users
const users = await userRepo.find();

console.log(users); // Array of user objects (no .data wrapper)
```

:::

### Understanding the Query Structure

PGRestify supports two query patterns:

#### 🎯 PostgREST Native Pattern

1. **Client** - Your configured PGRestify instance
2. **Table Selection** - Using `from()` to specify the table
3. **Column Selection** - Using `select()` to choose columns
4. **Filters/Modifiers** - Optional conditions and modifications
5. **Execution** - Using `execute()` to run the query

```typescript
const result = await client
  .from('table_name')        // 1. Select table
  .select('columns')          // 2. Select columns
  .eq('column', 'value')      // 3. Add filters (optional)
  .order('column')            // 4. Add modifiers (optional)
  .execute();                 // 5. Execute query
```

#### 🏗️ ORM-Style Repository Pattern

1. **Repository** - Get a repository for your table
2. **Query Builder** - Build queries with parameter binding
3. **Method Chaining** - Add conditions, joins, ordering
4. **Execution** - Using `getMany()`, `getOne()`, etc.

```typescript
const result = await userRepo
  .createQueryBuilder()           // 1. Create query builder
  .select(['column1', 'column2']) // 2. Select columns
  .where('column = :value', { value: 'test' }) // 3. Add conditions
  .orderBy('column', 'ASC')       // 4. Add ordering
  .getMany();                     // 5. Execute query
```

## SELECT Operations

### Selecting All Columns

::: code-group

```typescript [PostgREST Syntax]
// Use the wildcard `*` to select all columns
const allData = await client
  .from('products')
  .select('*')
  .execute();

// Returns all columns for all products
// { id, name, price, description, created_at, ... }
console.log(allData.data);
```

```typescript [Repository Pattern]
// Repository approach - all columns by default
const productRepo = client.getRepository<Product>('products');

// Simple find - returns all columns
const allData = await productRepo.find();

// Or using query builder (explicit all columns)
const allDataExplicit = await productRepo
  .createQueryBuilder()
  .getMany(); // Selects all columns by default

console.log(allData);
```

:::

### Selecting Specific Columns

::: code-group

```typescript [PostgREST Syntax]
// Array format (recommended)
const products = await client
  .from('products')
  .select(['id', 'name', 'price'])
  .execute();

// Returns only: { id, name, price }

// String format
const stringProducts = await client
  .from('products')
  .select('id, name, price')
  .execute();

// Dynamic column selection with array
const columns = ['id', 'name', 'price'];
const dynamicProducts = await client
  .from('products')
  .select(columns)
  .execute();
```

```typescript [Repository Pattern]
// Repository approach - specify columns in select array
const productRepo = client.getRepository<Product>('products');

// Using query builder with specific columns
const products = await productRepo
  .createQueryBuilder()
  .select(['id', 'name', 'price'])
  .getMany();

// Returns only: { id, name, price }

// Dynamic column selection
const columns = ['id', 'name', 'price'];
const dynamicProducts = await productRepo
  .createQueryBuilder()
  .select(columns)
  .getMany();
```

:::

### Column Aliases

Rename columns in your query results using various syntax options:

::: code-group

```typescript [PostgREST Array Syntax]
// Array syntax with AS keyword (recommended)
const products = await client
  .from('products')
  .select([
    'id',
    'name AS product_name',
    'price AS unit_price', 
    'created_at AS date_added'
  ])
  .execute();

// Returns: { id, product_name, unit_price, date_added }

// Mixed aliases and regular columns
const mixedProducts = await client
  .from('products')
  .select([
    'id',
    'name AS product_name',
    'description',  // No alias
    'price AS cost',
    'category_id'   // No alias
  ])
  .execute();
```

```typescript [PostgREST String Syntax]
// Traditional string syntax with PostgREST colon notation
const products = await client
  .from('products')
  .select(`
    id,
    name:product_name,
    price:unit_price,
    created_at:date_added
  `)
  .execute();

// String syntax with AS keyword
const productsWithAS = await client
  .from('products')
  .select(`
    id,
    name AS product_name,
    price AS unit_price,
    created_at AS date_added
  `)
  .execute();
```

```typescript [Repository Pattern]
// Repository approach - use arrays with AS keyword
const productRepo = client.getRepository<Product>('products');

const products = await productRepo
  .createQueryBuilder()
  .select([
    'id',
    'name AS product_name',
    'price AS unit_price',
    'created_at AS date_added'
  ])
  .getMany();

// Alternative: String syntax
const stringProducts = await productRepo
  .createQueryBuilder()
  .select('id, name as product_name, price as unit_price, created_at as date_added')
  .getMany();

// Individual selects with aliases
const aliasedProducts = await productRepo
  .createQueryBuilder()
  .select('id')
  .addSelect('name as product_name')
  .addSelect('price as unit_price')
  .addSelect('created_at as date_added')
  .getMany();
```

:::

### Computed Columns

::: code-group

```typescript [PostgREST Syntax]
// If your database has computed columns
const orders = await client
  .from('orders')
  .select(`
    id,
    quantity,
    unit_price,
    total_amount
  `)
  .execute();

// total_amount might be computed as quantity * unit_price
```

```typescript [Repository Pattern]
// Repository approach - computed columns work the same way
const orderRepo = client.getRepository<Order>('orders');

const orders = await orderRepo
  .createQueryBuilder()
  .select([
    'id',
    'quantity', 
    'unit_price',
    'total_amount' // Computed column
  ])
  .getMany();

// Or with computed expressions
const ordersWithComputed = await orderRepo
  .createQueryBuilder()
  .select('id, quantity, unit_price, (quantity * unit_price) as computed_total')
  .getMany();
```

:::

## Working with Different Data Types

### String Data

```typescript
// Text and varchar columns
const textData = await client
  .from('articles')
  .select('title, content, summary')
  .execute();

// Handle null values
const articles = await client
  .from('articles')
  .select('title, subtitle')
  .execute();

articles.data.forEach(article => {
  const subtitle = article.subtitle || 'No subtitle';
  console.log(`${article.title}: ${subtitle}`);
});
```

### Numeric Data

```typescript
// Integer columns
const products = await client
  .from('products')
  .select('id, quantity, stock_level')
  .execute();

// Decimal/float columns
const financial = await client
  .from('transactions')
  .select('amount, tax_rate, total')
  .execute();

// Working with numeric data
financial.data.forEach(transaction => {
  const calculatedTotal = transaction.amount * (1 + transaction.tax_rate);
  console.log(`Total: ${calculatedTotal.toFixed(2)}`);
});
```

### Boolean Data

```typescript
// Boolean columns
const users = await client
  .from('users')
  .select('id, name, is_active, email_verified')
  .execute();

// Filter based on boolean
const activeUsers = users.data.filter(user => user.is_active);
const verifiedUsers = users.data.filter(user => user.email_verified);

// Handle in UI
users.data.forEach(user => {
  const status = user.is_active ? 'Active' : 'Inactive';
  const verified = user.email_verified ? '✓' : '✗';
  console.log(`${user.name}: ${status} ${verified}`);
});
```

### Date and Time Data

```typescript
// Date/timestamp columns
const events = await client
  .from('events')
  .select('id, title, event_date, created_at, updated_at')
  .execute();

// Parse and format dates
events.data.forEach(event => {
  const eventDate = new Date(event.event_date);
  const formatted = eventDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  console.log(`${event.title}: ${formatted}`);
});

// Calculate time differences
const posts = await client
  .from('posts')
  .select('title, created_at')
  .execute();

posts.data.forEach(post => {
  const created = new Date(post.created_at);
  const now = new Date();
  const daysAgo = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`${post.title}: ${daysAgo} days ago`);
});
```

### JSON/JSONB Data

```typescript
// JSON columns
const users = await client
  .from('users')
  .select('id, name, preferences, metadata')
  .execute();

// Access JSON properties
users.data.forEach(user => {
  // preferences is automatically parsed from JSON
  console.log(`Theme: ${user.preferences.theme}`);
  console.log(`Language: ${user.preferences.language}`);
  
  // Access nested properties
  if (user.metadata?.settings?.notifications) {
    console.log('Notifications enabled');
  }
});

// Query specific JSON fields
const usersWithTheme = await client
  .from('users')
  .select('id, name, preferences->theme')
  .execute();
```

### Array Data

```typescript
// Array columns
const posts = await client
  .from('posts')
  .select('id, title, tags, categories')
  .execute();

// Work with arrays
posts.data.forEach(post => {
  // tags is an array of strings
  console.log(`Tags: ${post.tags.join(', ')}`);
  
  // Check if array contains value
  if (post.tags.includes('javascript')) {
    console.log(`${post.title} is about JavaScript`);
  }
  
  // Array length
  console.log(`Number of tags: ${post.tags.length}`);
});
```

### NULL Values

```typescript
// Handle nullable columns
const users = await client
  .from('users')
  .select('id, name, middle_name, phone_number, bio')
  .execute();

users.data.forEach(user => {
  // Check for null
  if (user.middle_name === null) {
    console.log(`${user.name} has no middle name`);
  }
  
  // Provide defaults for null values
  const phone = user.phone_number || 'No phone number';
  const bio = user.bio || 'No bio provided';
  
  // Use optional chaining for safety
  const middleInitial = user.middle_name?.[0] || '';
});
```

## Query Execution Patterns

### Basic Execution

::: code-group

```typescript [PostgREST Syntax]
// Standard execution returning all results
const result = await client
  .from('products')
  .select('*')
  .execute();

// Check the response
if (result.error) {
  console.error('Query failed:', result.error);
} else {
  console.log(`Retrieved ${result.data.length} products`);
}
```

```typescript [Repository Pattern]
// Repository execution - throws errors instead of error objects
try {
  const products = await productRepo.find();
  console.log(`Retrieved ${products.length} products`);
} catch (error) {
  console.error('Query failed:', error);
}

// Query builder execution
try {
  const products = await productRepo
    .createQueryBuilder()
    .getMany();
  console.log(`Retrieved ${products.length} products`);
} catch (error) {
  console.error('Query failed:', error);
}
```

:::

### Single Record Queries

::: code-group

```typescript [PostgREST Syntax]
// When expecting exactly one record
const user = await client
  .from('users')
  .select('*')
  .eq('id', 123)
  .single()
  .execute();

if (user.data) {
  console.log('User found:', user.data.name);
} else {
  console.log('User not found');
}

// When expecting zero or one record
const settings = await client
  .from('user_settings')
  .select('*')
  .eq('user_id', 123)
  .maybeSingle()
  .execute();

const theme = settings.data?.theme || 'default';
```

```typescript [Repository Pattern]
// Repository single record patterns
const userRepo = client.getRepository<User>('users');
const settingsRepo = client.getRepository<UserSettings>('user_settings');

// Simple findOne (returns null if not found)
const user = await userRepo.findOne({ id: 123 });

if (user) {
  console.log('User found:', user.name);
} else {
  console.log('User not found');
}

// Query builder - getOne (returns null if not found)
const userQb = await userRepo
  .createQueryBuilder()
  .where('id = :id', { id: 123 })
  .getOne();

// Query builder - getOneOrFail (throws error if not found)
try {
  const userOrFail = await userRepo
    .createQueryBuilder()
    .where('id = :id', { id: 123 })
    .getOneOrFail();
  console.log('User found:', userOrFail.name);
} catch (error) {
  console.log('User not found');
}

// Zero or one record
const settings = await settingsRepo.findOne({ user_id: 123 });
const theme = settings?.theme || 'default';
```

:::
```

### Count Queries

::: code-group

```typescript [PostgREST Syntax]
// Get count with data
const result = await client
  .from('products')
  .select('*', { count: 'exact' })
  .execute();

console.log(`Total products: ${result.count}`);
console.log(`Returned: ${result.data.length}`);

// Get count only (no data)
const countOnly = await client
  .from('products')
  .select('*', { count: 'exact', head: true })
  .execute();

console.log(`Total products: ${countOnly.count}`);
```

```typescript [Repository Pattern]
// Repository count queries
const productRepo = client.getRepository<Product>('products');

// Get count only
const totalProducts = await productRepo
  .createQueryBuilder()
  .getCount();

console.log(`Total products: ${totalProducts}`);

// Get data and count separately
const products = await productRepo.find();
const count = await productRepo
  .createQueryBuilder()
  .getCount();

console.log(`Total products: ${count}`);
console.log(`Returned: ${products.length}`);

// Count with conditions
const activeCount = await productRepo
  .createQueryBuilder()
  .where('active = :active', { active: true })
  .getCount();
```

:::
```

### Limited Queries

::: code-group

```typescript [PostgREST Syntax]
// Get first 10 records
const topProducts = await client
  .from('products')
  .select('*')
  .limit(10)
  .execute();

// Get specific range
const pageTwo = await client
  .from('products')
  .select('*')
  .range(10, 19) // Records 11-20
  .execute();
```

```typescript [Repository Pattern]
// Repository limiting and pagination
const productRepo = client.getRepository<Product>('products');

// Get first 10 records
const topProducts = await productRepo
  .createQueryBuilder()
  .limit(10)
  .getMany();

// Get specific range (page 2, 10 per page)
const pageTwo = await productRepo
  .createQueryBuilder()
  .limit(10)
  .offset(10) // Skip first 10
  .getMany();

// Complete pagination pattern
const getPaginatedProducts = async (page: number, pageSize: number) => {
  return await productRepo
    .createQueryBuilder()
    .orderBy('created_at', 'DESC')
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .getMany();
};

const page2Products = await getPaginatedProducts(2, 10);
```

:::

## Common Query Patterns

### Get All Records

::: code-group

```typescript [PostgREST Syntax]
const getAllRecords = async (table: string) => {
  const result = await client
    .from(table)
    .select('*')
    .execute();
    
  return result.data;
};

// Usage
const allUsers = await getAllRecords('users');
const allProducts = await getAllRecords('products');
```

```typescript [Repository Pattern]
// Generic repository helper
const getAllRecords = async <T>(tableName: string) => {
  const repo = client.getRepository<T>(tableName);
  return await repo.find();
};

// Usage with type safety
const allUsers = await getAllRecords<User>('users');
const allProducts = await getAllRecords<Product>('products');

// Or direct repository usage
const userRepo = client.getRepository<User>('users');
const productRepo = client.getRepository<Product>('products');

const allUsers2 = await userRepo.find();
const allProducts2 = await productRepo.find();
```

:::

### Get Record by ID

::: code-group

```typescript [PostgREST Syntax]
const getRecordById = async (table: string, id: number) => {
  const result = await client
    .from(table)
    .select('*')
    .eq('id', id)
    .single()
    .execute();
    
  return result.data;
};

// Usage
const user = await getRecordById('users', 123);
const product = await getRecordById('products', 456);
```

```typescript [Repository Pattern]
// Generic repository helper
const getRecordById = async <T>(tableName: string, id: number) => {
  const repo = client.getRepository<T>(tableName);
  return await repo.findOne({ id });
};

// Usage with type safety
const user = await getRecordById<User>('users', 123);
const product = await getRecordById<Product>('products', 456);

// Or direct repository usage
const userRepo = client.getRepository<User>('users');
const productRepo = client.getRepository<Product>('products');

const user2 = await userRepo.findOne({ id: 123 });
const product2 = await productRepo.findOne({ id: 456 });

// Query builder approach
const user3 = await userRepo
  .createQueryBuilder()
  .where('id = :id', { id: 123 })
  .getOne();
```

:::

### Get Records with Pagination

::: code-group

```typescript [PostgREST Syntax]
const getPaginatedRecords = async (
  table: string,
  page: number = 0,
  pageSize: number = 10
) => {
  const start = page * pageSize;
  const end = start + pageSize - 1;
  
  const result = await client
    .from(table)
    .select('*', { count: 'exact' })
    .range(start, end)
    .execute();
    
  return {
    data: result.data,
    total: result.count,
    page,
    pageSize,
    totalPages: Math.ceil(result.count / pageSize)
  };
};

// Usage
const firstPage = await getPaginatedRecords('products', 0, 20);
console.log(`Page 1 of ${firstPage.totalPages}`);
```

```typescript [Repository Pattern]
// Repository pagination helper
const getPaginatedRecords = async <T>(
  tableName: string,
  page: number = 1, // 1-based page numbering
  pageSize: number = 10
) => {
  const repo = client.getRepository<T>(tableName);
  
  const [data, total] = await Promise.all([
    repo.createQueryBuilder()
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .getMany(),
    repo.createQueryBuilder().getCount()
  ]);
  
  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
};

// Usage with type safety
const firstPage = await getPaginatedRecords<Product>('products', 1, 20);
console.log(`Page 1 of ${firstPage.totalPages}`);

// Direct repository usage
const productRepo = client.getRepository<Product>('products');
const page2 = await productRepo
  .createQueryBuilder()
  .orderBy('created_at', 'DESC')
  .limit(20)
  .offset(20)
  .getMany();
```

:::
```

### Search Pattern

::: code-group

```typescript [PostgREST Syntax]
const searchRecords = async (
  table: string,
  searchColumn: string,
  searchTerm: string
) => {
  const result = await client
    .from(table)
    .select('*')
    .ilike(searchColumn, `%${searchTerm}%`)
    .execute();
    
  return result.data;
};

// Usage
const results = await searchRecords('products', 'name', 'laptop');
```

```typescript [Repository Pattern]
// Repository search helper
const searchRecords = async <T>(
  tableName: string,
  searchColumn: string,
  searchTerm: string
) => {
  const repo = client.getRepository<T>(tableName);
  
  return await repo
    .createQueryBuilder()
    .where(`${searchColumn} ILIKE :term`, { term: `%${searchTerm}%` })
    .getMany();
};

// Usage with type safety
const results = await searchRecords<Product>('products', 'name', 'laptop');

// Direct repository usage
const productRepo = client.getRepository<Product>('products');
const laptops = await productRepo
  .createQueryBuilder()
  .where('name ILIKE :term', { term: '%laptop%' })
  .getMany();

// Multiple column search
const searchResults = await productRepo
  .createQueryBuilder()
  .where('name ILIKE :term', { term: '%laptop%' })
  .orWhere('description ILIKE :term', { term: '%laptop%' })
  .getMany();
```

:::

### Get Recent Records

::: code-group

```typescript [PostgREST Syntax]
const getRecentRecords = async (
  table: string,
  dateColumn: string = 'created_at',
  limit: number = 10
) => {
  const result = await client
    .from(table)
    .select('*')
    .order(dateColumn, { ascending: false })
    .limit(limit)
    .execute();
    
  return result.data;
};

// Usage
const recentPosts = await getRecentRecords('posts', 'published_at', 5);
const recentUsers = await getRecentRecords('users', 'created_at', 20);
```

```typescript [Repository Pattern]
// Repository recent records helper
const getRecentRecords = async <T>(
  tableName: string,
  dateColumn: string = 'created_at',
  limit: number = 10
) => {
  const repo = client.getRepository<T>(tableName);
  
  return await repo
    .createQueryBuilder()
    .orderBy(dateColumn, 'DESC')
    .limit(limit)
    .getMany();
};

// Usage with type safety
const recentPosts = await getRecentRecords<Post>('posts', 'published_at', 5);
const recentUsers = await getRecentRecords<User>('users', 'created_at', 20);

// Direct repository usage
const postRepo = client.getRepository<Post>('posts');
const userRepo = client.getRepository<User>('users');

const recentPosts2 = await postRepo
  .createQueryBuilder()
  .orderBy('published_at', 'DESC')
  .limit(5)
  .getMany();

const recentUsers2 = await userRepo
  .createQueryBuilder()
  .orderBy('created_at', 'DESC')
  .limit(20)
  .getMany();
```

:::
```

## Response Handling

### Success Response Structure

```typescript
interface SuccessResponse<T> {
  data: T[];           // Array of results
  count?: number;      // Total count (if requested)
  status: 200;         // HTTP status
  statusText: 'OK';    // Status message
  error: null;         // No error
}

// Handle successful response
const handleSuccess = (response: SuccessResponse<any>) => {
  console.log(`Retrieved ${response.data.length} records`);
  
  if (response.count !== undefined) {
    console.log(`Total available: ${response.count}`);
  }
  
  // Process data
  response.data.forEach(item => {
    // Process each item
  });
};
```

### Error Response Structure

```typescript
interface ErrorResponse {
  data: null;          // No data on error
  count: null;         // No count on error
  status: number;      // HTTP error status
  statusText: string;  // Error message
  error: any;          // Error details
}

// Handle error response
const handleError = (response: ErrorResponse) => {
  console.error(`Query failed with status ${response.status}`);
  console.error(`Error: ${response.error}`);
  
  // Handle specific error codes
  switch (response.status) {
    case 404:
      console.log('Resource not found');
      break;
    case 401:
      console.log('Authentication required');
      break;
    case 403:
      console.log('Access denied');
      break;
    default:
      console.log('An error occurred');
  }
};
```

### Complete Response Handler

```typescript
const executeQuery = async (queryFn: () => Promise<any>) => {
  try {
    const response = await queryFn();
    
    if (response.error) {
      // Handle error response
      handleError(response);
      return null;
    }
    
    // Handle success response
    handleSuccess(response);
    return response.data;
    
  } catch (error) {
    // Handle network or other errors
    console.error('Query execution failed:', error);
    return null;
  }
};

// Usage
const users = await executeQuery(() =>
  client.from('users').select('*').execute()
);
```

## Query Building Best Practices

### Reusable Query Functions

```typescript
// Create a query builder class
class QueryHelper {
  constructor(private client: PostgRESTClient) {}
  
  // Generic getter
  async getAll<T>(table: string): Promise<T[]> {
    const result = await this.client
      .from(table)
      .select('*')
      .execute();
    return result.data;
  }
  
  // Generic finder
  async findById<T>(table: string, id: number): Promise<T | null> {
    const result = await this.client
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .execute();
    return result.data;
  }
  
  // Generic search
  async search<T>(
    table: string,
    column: string,
    term: string
  ): Promise<T[]> {
    const result = await this.client
      .from(table)
      .select('*')
      .ilike(column, `%${term}%`)
      .execute();
    return result.data;
  }
}

// Usage
const queryHelper = new QueryHelper(client);
const users = await queryHelper.getAll<User>('users');
const product = await queryHelper.findById<Product>('products', 123);
```

### Query Composition

```typescript
// Build queries incrementally
const buildUserQuery = (options: {
  includeProfile?: boolean;
  includeOrders?: boolean;
  activeOnly?: boolean;
}) => {
  let selectClause = 'id, name, email, created_at';
  
  if (options.includeProfile) {
    selectClause += ', profile:user_profiles(*)';
  }
  
  if (options.includeOrders) {
    selectClause += ', orders:orders(id, total, created_at)';
  }
  
  let query = client.from('users').select(selectClause);
  
  if (options.activeOnly) {
    query = query.eq('active', true);
  }
  
  return query;
};

// Usage
const activeUsersWithProfile = await buildUserQuery({
  includeProfile: true,
  activeOnly: true
}).execute();
```

### Type-Safe Queries

```typescript
// Define types for your tables
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

// Type-safe query function
async function getActiveUsers(): Promise<User[]> {
  const result = await client
    .from<User>('users')
    .select('*')
    .eq('active', true)
    .execute();
    
  return result.data;
}

// TypeScript ensures type safety
const users = await getActiveUsers();
users.forEach(user => {
  console.log(user.name); // TypeScript knows this exists
  // console.log(user.invalid); // TypeScript error
});
```

## Performance Considerations

### Select Only Required Columns

```typescript
// ❌ Bad: Selecting all columns when you only need a few
const inefficient = await client
  .from('users')
  .select('*')
  .execute();

// ✅ Good: Select only what you need
const efficient = await client
  .from('users')
  .select('id, name, email')
  .execute();
```

### Use Appropriate Limits

```typescript
// ❌ Bad: Fetching all records when you need few
const allProducts = await client
  .from('products')
  .select('*')
  .execute();
const topFive = allProducts.data.slice(0, 5);

// ✅ Good: Limit at database level
const topFive = await client
  .from('products')
  .select('*')
  .limit(5)
  .execute();
```

### Batch Operations

```typescript
// ❌ Bad: Multiple queries for related data
const user = await client.from('users').select('*').eq('id', 123).single().execute();
const profile = await client.from('profiles').select('*').eq('user_id', 123).single().execute();
const orders = await client.from('orders').select('*').eq('user_id', 123).execute();

// ✅ Good: Single query with relationships
const userData = await client
  .from('users')
  .select(`
    *,
    profile:profiles(*),
    orders:orders(*)
  `)
  .eq('id', 123)
  .single()
  .execute();
```

## Debugging Queries

### Log Query Details

```typescript
const debugQuery = async (query: any) => {
  console.log('Executing query...');
  console.time('Query execution');
  
  const result = await query.execute();
  
  console.timeEnd('Query execution');
  console.log('Status:', result.status);
  console.log('Row count:', result.data?.length || 0);
  
  if (result.error) {
    console.error('Error:', result.error);
  }
  
  return result;
};

// Usage
const result = await debugQuery(
  client.from('users').select('*').eq('active', true)
);
```

### Query Inspection

```typescript
// Build query without executing
const query = client
  .from('users')
  .select('id, name, email')
  .eq('active', true)
  .order('created_at', { ascending: false });

// Inspect query structure (conceptual - depends on implementation)
console.log('Table:', 'users');
console.log('Columns:', 'id, name, email');
console.log('Filters:', { active: true });
console.log('Order:', 'created_at DESC');

// Execute when ready
const result = await query.execute();
```

---

## Summary

Basic queries in PGRestify provide:

- **Dual Syntax Support**: Choose between PostgREST native syntax or ORM-style repositories
- **Simple API**: Intuitive chainable methods for building queries in both approaches
- **Type Safety**: Full TypeScript support for all operations with complete IntelliSense
- **Data Type Support**: Handle all PostgreSQL data types naturally
- **Flexible Patterns**: From simple selects to complex data retrieval
- **Performance**: Efficient query execution with proper optimization
- **Error Handling**: Comprehensive error information for debugging
- **Parameter Binding**: Safe, parameterized queries with the repository pattern
- **Method Chaining**: Fluent APIs in both PostgREST and ORM styles

### Which Approach to Choose?

**Use PostgREST Syntax when:**
- You want direct control over PostgREST features
- Working with simple queries
- You prefer the PostgREST query language
- Migrating from existing PostgREST applications

**Use Repository Pattern when:**
- You prefer ORM-style development
- Building complex queries with parameter binding
- You want automatic parameter escaping
- Coming from ORM or similar ORMs
- Building reusable query logic in custom repositories

Both approaches are equally powerful and can be mixed within the same application. Master these fundamental query patterns, and you'll have a solid foundation for building more complex database interactions with PGRestify.