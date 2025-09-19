# Pagination

Master data pagination in PGRestify with page-based, offset-based, range-based, and cursor-based pagination patterns for efficient data retrieval.

## Overview

PGRestify provides comprehensive pagination support through PostgREST's built-in pagination capabilities. You can paginate results using page numbers, offsets, ranges, or cursors, with automatic metadata calculation for building pagination UIs.

## Basic Pagination Methods

### Page-Based Pagination

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000'
});

// Basic page-based pagination
const firstPage = await client
  .from('users')
  .select('*')
  .paginate({ 
    page: 1,     // Current page (1-based)
    pageSize: 10 // Number of items per page
  })
  .executeWithPagination();

console.log(firstPage.data);        // Array of user objects
console.log(firstPage.pagination);  // Pagination metadata

// Navigate to different pages
const secondPage = await client
  .from('users')
  .select('*')
  .paginate({ 
    page: 2, 
    pageSize: 10 
  })
  .executeWithPagination();
```

### Offset-Based Pagination

```typescript
// Direct offset and limit control
const offsetResults = await client
  .from('products')
  .select('*')
  .paginate({
    offset: 20,  // Skip first 20 records
    limit: 15    // Take 15 records
  })
  .executeWithPagination();

// Equivalent using offset() and limit() methods
const sameResults = await client
  .from('products')
  .select('*')
  .offset(20)
  .limit(15)
  .executeWithPagination();
```

### Range-Based Pagination

```typescript
// PostgREST range syntax (inclusive)
const rangeResults = await client
  .from('posts')
  .select('*')
  .range(0, 9)  // Records 1-10 (0-indexed, inclusive)
  .executeWithPagination();

// Next page
const nextPage = await client
  .from('posts')
  .select('*')
  .range(10, 19)  // Records 11-20
  .executeWithPagination();
```

## Pagination Metadata

```typescript
// PaginationResult structure
interface PaginationResult<T> {
  data: T[];           // Current page data
  pagination: {
    page: number;        // Current page number (1-based)
    pageSize: number;    // Items per page
    totalItems: number;  // Total number of items
    totalPages: number;  // Total number of pages
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    offset: number;      // Current offset
  };
}

// Example usage
const result = await client
  .from('users')
  .select('*')
  .paginate({ page: 2, pageSize: 20 })
  .executeWithPagination();

console.log(`Page ${result.pagination.page} of ${result.pagination.totalPages}`);
console.log(`Showing ${result.data.length} of ${result.pagination.totalItems} total items`);
console.log(`Has next page: ${result.pagination.hasNextPage}`);
```

## Cursor-Based Pagination

```typescript
// Cursor-based pagination for large datasets
// First page
const firstPage = await client
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(10)
  .executeWithPagination();

// Get last item's timestamp for cursor
const lastItem = firstPage.data[firstPage.data.length - 1];
const cursor = lastItem.created_at;

// Next page using cursor
const nextPage = await client
  .from('posts')
  .select('*')
  .lt('created_at', cursor)  // Items older than cursor
  .order('created_at', { ascending: false })
  .limit(10)
  .executeWithPagination();

// Helper function for cursor pagination
const getCursorPage = async (
  table: string,
  cursorColumn: string,
  cursorValue?: any,
  pageSize = 10
) => {
  let query = client
    .from(table)
    .select('*')
    .order(cursorColumn, { ascending: false })
    .limit(pageSize);

  if (cursorValue) {
    query = query.lt(cursorColumn, cursorValue);
  }

  return query.executeWithPagination();
};

// Usage
const page1 = await getCursorPage('posts', 'created_at');
const page2 = await getCursorPage('posts', 'created_at', 
  page1.data[page1.data.length - 1].created_at
);
```

## Infinite Scroll Implementation

```typescript
interface InfiniteScrollOptions {
  pageSize?: number;
  orderColumn?: string;
  orderDirection?: 'asc' | 'desc';
}

class InfiniteScroll<T> {
  private client: any;
  private table: string;
  private pageSize: number;
  private currentPage: number = 1;
  private orderColumn: string;
  private orderDirection: 'asc' | 'desc';
  private allData: T[] = [];
  private hasMoreData: boolean = true;

  constructor(
    client: any, 
    table: string, 
    options: InfiniteScrollOptions = {}
  ) {
    this.client = client;
    this.table = table;
    this.pageSize = options.pageSize || 20;
    this.orderColumn = options.orderColumn || 'created_at';
    this.orderDirection = options.orderDirection || 'desc';
  }

  async loadNextPage(): Promise<{ 
    data: T[]; 
    newItems: T[];
    hasMore: boolean;
    totalLoaded: number;
  }> {
    if (!this.hasMoreData) {
      return {
        data: this.allData,
        newItems: [],
        hasMore: false,
        totalLoaded: this.allData.length
      };
    }

    const result = await this.client
      .from(this.table)
      .select('*')
      .order(this.orderColumn, { ascending: this.orderDirection === 'asc' })
      .paginate({
        page: this.currentPage,
        pageSize: this.pageSize
      })
      .executeWithPagination();

    if (result.error) {
      throw new Error(`Failed to load page ${this.currentPage}: ${result.error}`);
    }

    this.allData.push(...result.data);
    this.currentPage++;
    this.hasMoreData = result.pagination.hasNextPage;

    return {
      data: this.allData,
      newItems: result.data,
      hasMore: this.hasMoreData,
      totalLoaded: this.allData.length
    };
  }

  async reset(): Promise<void> {
    this.currentPage = 1;
    this.allData = [];
    this.hasMoreData = true;
  }

  getCurrentData(): T[] {
    return [...this.allData];
  }
}

// Usage
interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

const userScroll = new InfiniteScroll<User>(client, 'users', {
  pageSize: 15,
  orderColumn: 'created_at',
  orderDirection: 'desc'
});

// Load first page
const firstLoad = await userScroll.loadNextPage();
console.log(`Loaded ${firstLoad.newItems.length} users`);

// Load more when user scrolls
const secondLoad = await userScroll.loadNextPage();
console.log(`Total users loaded: ${secondLoad.totalLoaded}`);
console.log(`Has more data: ${secondLoad.hasMore}`);
```

## Advanced Pagination Techniques

### Filtered Pagination

```typescript
// Pagination with filters
const filteredPagination = await client
  .from('products')
  .select('*')
  .eq('category', 'electronics')
  .gte('price', 100)
  .paginate({
    page: 2,
    pageSize: 15
  })
  .executeWithPagination();

// Complex filter pagination
const complexFiltered = await client
  .from('orders')
  .select(`
    id,
    total_amount,
    status,
    created_at,
    customer:customers(name, email)
  `)
  .in('status', ['pending', 'processing'])
  .gte('total_amount', 50)
  .order('created_at', { ascending: false })
  .paginate({ page: 1, pageSize: 25 })
  .executeWithPagination();
```

### Sorted Pagination

```typescript
// Single column sorting with pagination
const sortedPagination = await client
  .from('orders')
  .select('*')
  .order('total_amount', { ascending: false })
  .paginate({
    page: 1,
    pageSize: 20
  })
  .executeWithPagination();

// Multi-column sorting with pagination
const multiSortPagination = await client
  .from('users')
  .select('*')
  .order('is_active', { ascending: false })  // Active users first
  .order('last_login', { ascending: false }) // Then by recent login
  .order('name')  // Then alphabetically
  .paginate({ page: 1, pageSize: 30 })
  .executeWithPagination();
```

### Search with Pagination

```typescript
// Text search with pagination
const searchResults = await client
  .from('posts')
  .select('*')
  .fts('search_vector', 'javascript tutorial')
  .order('created_at', { ascending: false })
  .paginate({ page: 1, pageSize: 10 })
  .executeWithPagination();

// Pattern matching with pagination
const patternResults = await client
  .from('users')
  .select('*')
  .ilike('name', '%john%')
  .order('name')
  .paginate({ page: 1, pageSize: 20 })
  .executeWithPagination();
```

## Performance Optimization

### Efficient Field Selection

```typescript
// ❌ Bad: Loading all fields when you only need a few
const inefficient = await client
  .from('large_table')
  .select('*')
  .paginate({ page: 1, pageSize: 50 })
  .executeWithPagination();

// ✅ Good: Select only required fields
const efficient = await client
  .from('large_table')
  .select('id, name, created_at')
  .paginate({ page: 1, pageSize: 50 })
  .executeWithPagination();
```

### Optimal Page Sizes

```typescript
// Choose appropriate page sizes based on use case
const tableView = await client
  .from('products')
  .select('*')
  .paginate({ page: 1, pageSize: 25 })  // Good for table views
  .executeWithPagination();

const cardView = await client
  .from('products')
  .select('*')
  .paginate({ page: 1, pageSize: 12 })  // Good for card grids
  .executeWithPagination();

const mobileView = await client
  .from('products')
  .select('*')
  .paginate({ page: 1, pageSize: 8 })   // Good for mobile
  .executeWithPagination();
```

### Index-Aware Pagination

```typescript
// Use indexed columns for sorting
const indexedSort = await client
  .from('orders')
  .select('*')
  .order('created_at', { ascending: false })  // created_at is typically indexed
  .paginate({ page: 1, pageSize: 20 })
  .executeWithPagination();

// Avoid sorting by non-indexed columns for large datasets
// ❌ This might be slow on large tables
const slowSort = await client
  .from('large_table')
  .select('*')
  .order('description')  // If not indexed, this could be slow
  .paginate({ page: 1, pageSize: 20 })
  .executeWithPagination();
```

## Error Handling and Edge Cases

```typescript
// Handle pagination errors gracefully
const safePaginate = async (
  table: string, 
  page: number, 
  pageSize: number
) => {
  try {
    // Validate inputs
    if (page < 1) {
      throw new Error('Page number must be 1 or greater');
    }
    if (pageSize < 1 || pageSize > 100) {
      throw new Error('Page size must be between 1 and 100');
    }

    const result = await client
      .from(table)
      .select('*')
      .paginate({ page, pageSize })
      .executeWithPagination();

    // Handle empty results
    if (result.data.length === 0 && page > 1) {
      console.warn(`Page ${page} has no data. Total pages: ${result.pagination.totalPages}`);
    }

    return result;
  } catch (error) {
    console.error('Pagination error:', error);
    
    // Return empty result structure for consistency
    return {
      data: [],
      pagination: {
        page: page,
        pageSize: pageSize,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        offset: 0
      },
      error: error.message
    };
  }
};

// Usage
const result = await safePaginate('users', 999, 10);
if (result.error) {
  console.log('Pagination failed:', result.error);
} else {
  console.log('Data loaded successfully:', result.data.length, 'items');
}
```

### Handling Large Page Numbers

```typescript
// Check if requested page exists
const getPageSafely = async (
  table: string,
  requestedPage: number,
  pageSize: number
) => {
  // First, get total count
  const countResult = await client
    .from(table)
    .select('*', { count: 'exact', head: true })
    .execute();

  const totalItems = countResult.count || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Adjust page number if necessary
  const safePage = Math.min(Math.max(1, requestedPage), totalPages || 1);

  const result = await client
    .from(table)
    .select('*')
    .paginate({ page: safePage, pageSize })
    .executeWithPagination();

  return {
    ...result,
    requestedPage,
    actualPage: safePage,
    wasAdjusted: requestedPage !== safePage
  };
};
```

## Type Safety and TypeScript Integration

```typescript
// Define your data types
interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  created_at: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
}

// Type-safe pagination
const productPage = await client
  .from<Product>('products')
  .select('*')
  .paginate({ page: 1, pageSize: 10 })
  .executeWithPagination();

// TypeScript knows the exact types
productPage.data.forEach(product => {
  console.log(product.name);     // ✓ TypeScript knows this is string
  console.log(product.price);    // ✓ TypeScript knows this is number
  // console.log(product.invalid); // ❌ TypeScript error
});

// Generic pagination helper with types
interface PaginationParams {
  page?: number;
  pageSize?: number;
}

const paginateTable = async <T>(
  tableName: string,
  params: PaginationParams = {}
): Promise<import('../types').PaginationResult<T>> => {
  const { page = 1, pageSize = 20 } = params;
  
  return client
    .from<T>(tableName)
    .select('*')
    .paginate({ page, pageSize })
    .executeWithPagination();
};

// Usage with type inference
const users = await paginateTable<User>('users', { page: 2, pageSize: 15 });
const products = await paginateTable<Product>('products');
```

## Best Practices

- Use appropriate page sizes (typically 10-50 items)
- Implement server-side pagination
- Cache pagination results when possible
- Provide clear pagination controls in UI
- Handle edge cases (empty pages, invalid page numbers)

## Advanced Integration Patterns

### Pagination with Complex Queries

```typescript
// Pagination with joins and filtering
const complexPagination = await client
  .from('orders')
  .select(`
    id,
    order_number,
    total_amount,
    status,
    created_at,
    customer:customers!inner(
      name,
      email,
      tier
    ),
    items:order_items(
      quantity,
      unit_price,
      product:products(name)
    )
  `)
  .eq('customers.tier', 'premium')
  .in('status', ['pending', 'processing', 'shipped'])
  .gte('total_amount', 100)
  .order('created_at', { ascending: false })
  .paginate({ page: 1, pageSize: 25 })
  .executeWithPagination();

// Pagination with full-text search
const searchPagination = await client
  .from('posts')
  .select(`
    id,
    title,
    content,
    created_at,
    author:users(name, avatar),
    category:categories(name)
  `)
  .fts('search_vector', 'javascript tutorial')
  .eq('published', true)
  .order('created_at', { ascending: false })
  .paginate({ page: 1, pageSize: 10 })
  .executeWithPagination();
```

### Multi-Table Pagination Coordination

```typescript
// Paginate related data together
interface DashboardData {
  users: import('../types').PaginationResult<User>;
  orders: import('../types').PaginationResult<Order>;
  products: import('../types').PaginationResult<Product>;
}

const getDashboardData = async (page = 1): Promise<DashboardData> => {
  const pageSize = 20;
  
  // Fetch all paginated data in parallel
  const [users, orders, products] = await Promise.all([
    client
      .from<User>('users')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .paginate({ page, pageSize })
      .executeWithPagination(),
      
    client
      .from<Order>('orders')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .paginate({ page, pageSize })
      .executeWithPagination(),
      
    client
      .from<Product>('products')
      .select('*')
      .eq('featured', true)
      .order('popularity_score', { ascending: false })
      .paginate({ page, pageSize })
      .executeWithPagination()
  ]);

  return { users, orders, products };
};
```

## Performance Considerations and Optimization

### Database-Level Optimizations

```sql
-- Create indexes for commonly paginated queries
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_orders_status_created_at ON orders(status, created_at DESC);
CREATE INDEX idx_products_category_price ON products(category, price DESC);

-- Composite index for filtered pagination
CREATE INDEX idx_posts_published_created_at ON posts(published, created_at DESC) 
WHERE published = true;
```

### Pagination Performance Tips

```typescript
// ✅ Good: Efficient pagination patterns
const efficientPatterns = {
  // Use specific field selection
  async selectiveFields() {
    return client
      .from('large_table')
      .select('id, name, created_at')  // Only needed fields
      .paginate({ page: 1, pageSize: 50 })
      .executeWithPagination();
  },

  // Use indexed sorting
  async indexedSorting() {
    return client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })  // Indexed column
      .paginate({ page: 1, pageSize: 25 })
      .executeWithPagination();
  },

  // Combine filters with pagination efficiently
  async efficientFiltering() {
    return client
      .from('products')
      .select('*')
      .eq('category_id', 1)  // Indexed filter first
      .gte('price', 100)     // Then range filter
      .paginate({ page: 1, pageSize: 20 })
      .executeWithPagination();
  }
};

// ❌ Avoid: Inefficient pagination patterns
const inefficientPatterns = {
  // Avoid very high page numbers with offset
  async avoidHighOffsets() {
    // This gets slower as page number increases
    return client
      .from('large_table')
      .select('*')
      .paginate({ page: 1000, pageSize: 20 })  // offset = 19,980
      .executeWithPagination();
  },

  // Avoid sorting by non-indexed columns
  async avoidUnindexedSorts() {
    return client
      .from('products')
      .select('*')
      .order('description')  // If not indexed, this is slow
      .paginate({ page: 1, pageSize: 20 })
      .executeWithPagination();
  }
};
```

### When to Use Different Pagination Types

```typescript
// Guidelines for pagination method selection
const paginationGuidelines = {
  // Page-based: Good for UI with page numbers
  pageBasedScenarios: [
    'Data tables with page controls',
    'Search results',
    'Admin panels',
    'Reports with navigation'
  ],

  // Cursor-based: Good for real-time and large datasets
  cursorBasedScenarios: [
    'Social media feeds',
    'Chat message history',
    'Activity streams',
    'Very large datasets (millions of rows)'
  ],

  // Range-based: Good for API integration
  rangeBasedScenarios: [
    'REST API responses',
    'Batch processing',
    'Data synchronization',
    'Custom pagination logic'
  ]
};
```

---

## Summary

PGRestify's pagination system provides:

- **Multiple Methods**: Page-based, offset-based, range-based, and cursor-based pagination
- **Rich Metadata**: Complete pagination information for building UIs
- **Performance Optimization**: Efficient patterns for large datasets
- **Type Safety**: Full TypeScript support with generic types
- **Advanced Features**: Integration with filtering, sorting, and search
- **Caching Support**: Built-in patterns for performance optimization
- **Error Handling**: Graceful handling of edge cases and errors
- **UI Integration**: Helper patterns for common pagination controls

Choose the right pagination method based on your use case: page-based for traditional UIs, cursor-based for real-time feeds, and range-based for API integrations. Always consider performance implications and use appropriate indexes for your sorting columns.