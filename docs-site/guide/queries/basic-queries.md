# Basic Queries

Learn the fundamentals of querying data with PGRestify, from simple selects to working with different data types and response patterns.

## Overview

Basic queries form the foundation of data retrieval in PGRestify. This guide covers essential query operations, data type handling, and common patterns you'll use throughout your application. Every query in PGRestify follows a consistent, chainable pattern that maps directly to PostgREST's capabilities.

## Getting Started with Queries

### Your First Query

The simplest query retrieves all records from a table:

```typescript
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

### Understanding the Query Structure

Every query in PGRestify follows this pattern:

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

## SELECT Operations

### Selecting All Columns

Use the wildcard `*` to select all columns:

```typescript
const allData = await client
  .from('products')
  .select('*')
  .execute();

// Returns all columns for all products
// { id, name, price, description, created_at, ... }
```

### Selecting Specific Columns

Specify exact columns to retrieve:

```typescript
// String format
const products = await client
  .from('products')
  .select('id, name, price')
  .execute();

// Returns only: { id, name, price }

// Array format (when dynamically building)
const columns = ['id', 'name', 'price'];
const products = await client
  .from('products')
  .select(columns.join(', '))
  .execute();
```

### Column Aliases

Rename columns in your query results:

```typescript
const products = await client
  .from('products')
  .select(`
    id,
    name:product_name,
    price:unit_price,
    created_at:date_added
  `)
  .execute();

// Returns: { id, product_name, unit_price, date_added }
```

### Computed Columns

Select computed or virtual columns:

```typescript
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

```typescript
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

### Single Record Queries

```typescript
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

### Count Queries

```typescript
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

### Limited Queries

```typescript
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

## Common Query Patterns

### Get All Records

```typescript
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

### Get Record by ID

```typescript
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

### Get Records with Pagination

```typescript
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

### Search Pattern

```typescript
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

### Get Recent Records

```typescript
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

- **Simple API**: Intuitive chainable methods for building queries
- **Type Safety**: Full TypeScript support for all operations
- **Data Type Support**: Handle all PostgreSQL data types naturally
- **Flexible Patterns**: From simple selects to complex data retrieval
- **Performance**: Efficient query execution with proper optimization
- **Error Handling**: Comprehensive error information for debugging

Master these fundamental query patterns, and you'll have a solid foundation for building more complex database interactions with PGRestify.