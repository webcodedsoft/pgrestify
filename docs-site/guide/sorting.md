# Sorting & Ordering

Master data sorting and ordering in PGRestify with single and multi-column sorting, null handling, and performance optimization techniques.

## Overview

Sorting is essential for presenting data in meaningful order. PGRestify provides comprehensive sorting capabilities that map directly to PostgreSQL's ORDER BY functionality, with support for multiple columns, custom directions, null handling, and performance optimization.

## Basic Sorting

### Single Column Sorting

#### Ascending Order (Default)

```typescript
// Sort users by name (ascending by default)
const users = await client
  .from('users')
  .select('*')
  .order('name')
  .execute();

// Explicitly specify ascending
const products = await client
  .from('products')
  .select('*')
  .order('price', { ascending: true })
  .execute();

// Sort by created date (oldest first)
const posts = await client
  .from('posts')
  .select('*')
  .order('created_at')
  .execute();
```

#### Descending Order

```typescript
// Most recent posts first
const recentPosts = await client
  .from('posts')
  .select('*')
  .order('created_at', { ascending: false })
  .execute();

// Highest priced products first
const expensiveProducts = await client
  .from('products')
  .select('*')
  .order('price', { ascending: false })
  .execute();

// Users by name Z-A
const users = await client
  .from('users')
  .select('*')
  .order('name', { ascending: false })
  .execute();
```

### Multiple Column Sorting

#### Basic Multi-Column Sorting

```typescript
// Sort by category, then by price within each category
const products = await client
  .from('products')
  .select('*')
  .order('category')
  .order('price', { ascending: false })
  .execute();

// Sort users by active status, then by name
const users = await client
  .from('users')
  .select('*')
  .order('is_active', { ascending: false })
  .order('name')
  .execute();

// Sort posts by published date, then by title
const posts = await client
  .from('posts')
  .select('*')
  .order('published_at', { ascending: false })
  .order('title')
  .execute();
```

#### Complex Multi-Column Sorting

```typescript
// Complex sorting: priority (high first), then due date, then alphabetical
const tasks = await client
  .from('tasks')
  .select('*')
  .order('priority', { ascending: false })
  .order('due_date')
  .order('title')
  .execute();

// Employee sorting: department, then salary (high first), then hire date
const employees = await client
  .from('employees')
  .select('*')
  .order('department')
  .order('salary', { ascending: false })
  .order('hire_date')
  .execute();
```

### String-based Sorting

```typescript
// Single sort as string (PostgREST format)
const products = await client
  .from('products')
  .select('*')
  .order('price.desc')  // Descending
  .execute();

// Multiple sorts as string
const users = await client
  .from('users')
  .select('*')
  .order('is_active.desc,name.asc')
  .execute();
```

## Data Type Specific Sorting

### Numeric Sorting

```typescript
// Integer sorting
const products = await client
  .from('products')
  .select('*')
  .order('quantity', { ascending: false })
  .execute();

// Decimal sorting
const transactions = await client
  .from('transactions')
  .select('*')
  .order('amount', { ascending: false })
  .execute();

// Percentage sorting
const performance = await client
  .from('performance_metrics')
  .select('*')
  .order('success_rate', { ascending: false })
  .execute();
```

### Date and Time Sorting

```typescript
// Date sorting (most recent first)
const events = await client
  .from('events')
  .select('*')
  .order('event_date', { ascending: false })
  .execute();

// Timestamp sorting with time component
const logs = await client
  .from('system_logs')
  .select('*')
  .order('created_at', { ascending: false })
  .execute();

// Time-only sorting
const schedules = await client
  .from('schedules')
  .select('*')
  .order('start_time')
  .execute();
```

### String Sorting

```typescript
// Alphabetical sorting
const categories = await client
  .from('categories')
  .select('*')
  .order('name')
  .execute();

// Case-sensitive vs case-insensitive depends on database collation
const products = await client
  .from('products')
  .select('*')
  .order('brand')  // Uses database collation rules
  .execute();

// Sort by string length (using computed column if available)
const descriptions = await client
  .from('products')
  .select('*, char_length(description) as desc_length')
  .order('desc_length', { ascending: false })
  .execute();
```

### Boolean Sorting

```typescript
// Boolean sorting (false < true in PostgreSQL)
const users = await client
  .from('users')
  .select('*')
  .order('is_active', { ascending: false })  // Active users first
  .execute();

// Multiple boolean sorts
const products = await client
  .from('products')
  .select('*')
  .order('in_stock', { ascending: false })    // In stock first
  .order('featured', { ascending: false })    // Featured first
  .order('name')                              // Then alphabetical
  .execute();
```

## NULL Value Handling

### Default NULL Behavior

```typescript
// PostgreSQL default: NULLs come last in ASC, first in DESC
const users = await client
  .from('users')
  .select('*')
  .order('last_login')  // NULLs (never logged in) come last
  .execute();

const products = await client
  .from('products')
  .select('*')
  .order('discount_price', { ascending: false })  // NULLs come first
  .execute();
```

### Explicit NULL Handling

```typescript
// Force NULLs to appear last regardless of sort direction
const users = await client
  .from('users')
  .select('*')
  .order('last_login', { ascending: false, nullsFirst: false })
  .execute();

// Force NULLs to appear first
const products = await client
  .from('products')
  .select('*')
  .order('discount_price', { nullsFirst: true })
  .execute();
```

### NULL Handling Patterns

```typescript
// Handle optional dates properly
const events = await client
  .from('events')
  .select('*')
  .order('end_date', { nullsFirst: false })  // Ongoing events (NULL end_date) last
  .execute();

// Sort by optional numeric fields
const products = await client
  .from('products')
  .select('*')
  .order('rating', { ascending: false, nullsFirst: false })  // Unrated items last
  .execute();

// Complex NULL handling with multiple columns
const customers = await client
  .from('customers')
  .select('*')
  .order('last_purchase_date', { ascending: false, nullsFirst: false })  // Recent buyers first
  .order('created_at', { ascending: false })  // Then by registration date
  .execute();
```

## Advanced Sorting Patterns

### Computed Column Sorting

```typescript
// Sort by computed values
const users = await client
  .from('users')
  .select(`
    *,
    (orders_count * average_order_value) as lifetime_value
  `)
  .order('lifetime_value', { ascending: false })
  .execute();

// Sort by string operations
const products = await client
  .from('products')
  .select(`
    *,
    lower(name) as name_lower
  `)
  .order('name_lower')
  .execute();

// Sort by date calculations
const posts = await client
  .from('posts')
  .select(`
    *,
    extract(dow from created_at) as day_of_week
  `)
  .order('day_of_week')
  .execute();
```

### Conditional Sorting

```typescript
// Sort with CASE-like logic (using SQL expressions)
const products = await client
  .from('products')
  .select('*')
  .order(`
    case 
      when in_stock then 1 
      else 2 
    end
  `)  // In-stock items first
  .order('name')
  .execute();

// Priority-based sorting
const tasks = await client
  .from('tasks')
  .select('*')
  .order(`
    case priority
      when 'high' then 1
      when 'medium' then 2
      when 'low' then 3
      else 4
    end
  `)
  .execute();
```

### JSON/JSONB Field Sorting

```typescript
// Sort by JSON field
const users = await client
  .from('users')
  .select('*')
  .order('preferences->theme')
  .execute();

// Sort by nested JSON field
const products = await client
  .from('products')
  .select('*')
  .order('metadata->specs->weight', { ascending: false })
  .execute();

// Sort by JSON numeric field
const users = await client
  .from('users')
  .select('*')
  .order('stats->login_count', { ascending: false })
  .execute();
```

### Array Column Sorting

```typescript
// Sort by array length
const posts = await client
  .from('posts')
  .select('*')
  .order('array_length(tags, 1)', { ascending: false })  // Most tagged first
  .execute();

// Sort by first array element
const categories = await client
  .from('categories')
  .select('*')
  .order('path[1]')  // Sort by top-level category
  .execute();
```

## Dynamic Sorting

### User-Controlled Sorting

```typescript
interface SortOptions {
  column: string;
  direction: 'asc' | 'desc';
}

const getSortedProducts = async (sort: SortOptions) => {
  const ascending = sort.direction === 'asc';
  
  return client
    .from('products')
    .select('*')
    .order(sort.column, { ascending })
    .execute();
};

// Usage
const productsByPrice = await getSortedProducts({ 
  column: 'price', 
  direction: 'desc' 
});

const productsByName = await getSortedProducts({ 
  column: 'name', 
  direction: 'asc' 
});
```

### Multi-Column Dynamic Sorting

```typescript
interface MultiSortOptions {
  sorts: Array<{
    column: string;
    direction: 'asc' | 'desc';
    nullsFirst?: boolean;
  }>;
}

const getMultiSortedData = async (
  table: string,
  options: MultiSortOptions
) => {
  let query = client.from(table).select('*');
  
  options.sorts.forEach(sort => {
    query = query.order(sort.column, {
      ascending: sort.direction === 'asc',
      nullsFirst: sort.nullsFirst
    });
  });
  
  return query.execute();
};

// Usage
const complexSort = await getMultiSortedData('users', {
  sorts: [
    { column: 'is_active', direction: 'desc' },
    { column: 'last_login', direction: 'desc', nullsFirst: false },
    { column: 'name', direction: 'asc' }
  ]
});
```

### Sortable Table Columns

```typescript
interface TableSortConfig {
  [column: string]: {
    sortable: boolean;
    defaultDirection?: 'asc' | 'desc';
    dataType?: 'string' | 'number' | 'date' | 'boolean';
  };
}

const userTableConfig: TableSortConfig = {
  name: { sortable: true, dataType: 'string' },
  email: { sortable: true, dataType: 'string' },
  created_at: { sortable: true, dataType: 'date', defaultDirection: 'desc' },
  is_active: { sortable: true, dataType: 'boolean', defaultDirection: 'desc' },
  age: { sortable: true, dataType: 'number', defaultDirection: 'desc' }
};

const getSortedTableData = async (
  column: string,
  direction: 'asc' | 'desc'
) => {
  const config = userTableConfig[column];
  
  if (!config?.sortable) {
    throw new Error(`Column ${column} is not sortable`);
  }
  
  return client
    .from('users')
    .select('*')
    .order(column, { ascending: direction === 'asc' })
    .execute();
};
```

## Sorting with Relationships

### Sorting Main Table by Related Data

```typescript
// Sort products by category name (requires join)
const products = await client
  .from('products')
  .select(`
    *,
    categories(name)
  `)
  .order('categories(name)')
  .execute();

// Sort users by their latest order date
const users = await client
  .from('users')
  .select(`
    *,
    orders(created_at)
  `)
  .order('orders(created_at)', { ascending: false })
  .execute();

// Sort posts by author name
const posts = await client
  .from('posts')
  .select(`
    *,
    authors(name)
  `)
  .order('authors(name)')
  .execute();
```

### Nested Relationship Sorting

```typescript
// Sort categories with their products pre-sorted
const categoriesWithProducts = await client
  .from('categories')
  .select(`
    *,
    products(*, price)
  `)
  .order('name')  // Sort categories by name
  .execute();

// Note: To sort nested products, you need separate queries or use views

// Alternative: Use RPC for complex nested sorting
const sortedData = await client
  .rpc('get_categories_with_sorted_products')
  .execute();
```

## Performance Considerations

### Index-Aware Sorting

```typescript
// Use indexed columns for sorting
const efficientSort = await client
  .from('users')
  .select('*')
  .order('created_at', { ascending: false })  // created_at is typically indexed
  .execute();

// Composite index usage
const efficientCompositeSort = await client
  .from('orders')
  .select('*')
  .order('user_id')           // Part of composite index
  .order('created_at')        // Part of same composite index
  .execute();
```

### Limit Sorting Impact

```typescript
// Combine sorting with LIMIT for better performance
const recentProducts = await client
  .from('products')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(10)  // Only sort what we need
  .execute();

// Use range for pagination with sorting
const pageTwo = await client
  .from('products')
  .select('*')
  .order('name')
  .range(20, 39)  // Items 21-40
  .execute();
```

### Avoid Expensive Sorts

```typescript
// ❌ Expensive: Sorting by computed values without index
const expensive = await client
  .from('products')
  .select('*')
  .order('length(description)', { ascending: false })
  .execute();

// ✅ Better: Pre-compute and store sortable values
const efficient = await client
  .from('products')
  .select('*')
  .order('description_length', { ascending: false })
  .execute();

// ❌ Expensive: Sorting by JSON field extraction
const expensiveJson = await client
  .from('users')
  .select('*')
  .order('metadata->stats->login_count')
  .execute();

// ✅ Better: Use generated columns or materialized views
const efficientJson = await client
  .from('user_stats_view')
  .select('*')
  .order('login_count', { ascending: false })
  .execute();
```

## Sorting Utilities and Helpers

### Reusable Sort Functions

```typescript
class SortHelper {
  static byDate(
    column: string, 
    newest = true
  ): { column: string; options: any } {
    return {
      column,
      options: { ascending: !newest }
    };
  }

  static byName(column = 'name'): { column: string; options: any } {
    return {
      column,
      options: { ascending: true }
    };
  }

  static byPriority(
    column: string,
    highFirst = true
  ): { column: string; options: any } {
    return {
      column,
      options: { ascending: !highFirst }
    };
  }
}

// Usage
const recentPosts = await client
  .from('posts')
  .select('*')
  .order(SortHelper.byDate('created_at', true).column, 
         SortHelper.byDate('created_at', true).options)
  .execute();
```

### Sort Validation

```typescript
const validateSortColumn = (
  table: string, 
  column: string, 
  allowedColumns: string[]
): boolean => {
  return allowedColumns.includes(column);
};

const safeSortedQuery = async (
  table: string,
  column: string,
  direction: 'asc' | 'desc',
  allowedColumns: string[]
) => {
  if (!validateSortColumn(table, column, allowedColumns)) {
    throw new Error(`Invalid sort column: ${column}`);
  }

  if (!['asc', 'desc'].includes(direction)) {
    throw new Error(`Invalid sort direction: ${direction}`);
  }

  return client
    .from(table)
    .select('*')
    .order(column, { ascending: direction === 'asc' })
    .execute();
};

// Usage
const allowedUserSorts = ['name', 'email', 'created_at', 'last_login'];
const sortedUsers = await safeSortedQuery(
  'users',
  'name',
  'asc',
  allowedUserSorts
);
```

### Sort State Management

```typescript
interface SortState {
  column: string | null;
  direction: 'asc' | 'desc';
}

class TableSortManager {
  private sortState: SortState = {
    column: null,
    direction: 'asc'
  };

  toggleSort(column: string): SortState {
    if (this.sortState.column === column) {
      // Same column: toggle direction
      this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      // New column: start with ascending
      this.sortState.column = column;
      this.sortState.direction = 'asc';
    }
    return { ...this.sortState };
  }

  getCurrentSort(): SortState {
    return { ...this.sortState };
  }

  async applySortToQuery(query: any): Promise<any> {
    if (this.sortState.column) {
      return query.order(
        this.sortState.column, 
        { ascending: this.sortState.direction === 'asc' }
      );
    }
    return query;
  }
}

// Usage
const sortManager = new TableSortManager();
const newSortState = sortManager.toggleSort('name');
const query = client.from('users').select('*');
const sortedQuery = await sortManager.applySortToQuery(query);
const results = await sortedQuery.execute();
```

## Common Sorting Patterns

### Leaderboard Sorting

```typescript
const getLeaderboard = async (limit = 10) => {
  return client
    .from('users')
    .select('name, score, rank')
    .order('score', { ascending: false })
    .order('updated_at')  // Tie-breaker
    .limit(limit)
    .execute();
};
```

### Timeline Sorting

```typescript
const getTimeline = async (userId: number) => {
  return client
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .execute();
};
```

### Alphabetical Directory

```typescript
const getAlphabeticalDirectory = async () => {
  return client
    .from('contacts')
    .select('*')
    .order('last_name')
    .order('first_name')
    .execute();
};
```

### Priority Queue

```typescript
const getPriorityQueue = async () => {
  return client
    .from('tasks')
    .select('*')
    .order('priority', { ascending: false })
    .order('due_date')
    .order('created_at')
    .execute();
};
```

---

## Summary

PGRestify's sorting capabilities provide:

- **Simple API**: Intuitive methods for single and multi-column sorting
- **Full Control**: Complete control over sort direction and null handling
- **Data Type Support**: Proper sorting for all PostgreSQL data types
- **Dynamic Sorting**: Runtime sort configuration and user-controlled sorting
- **Relationship Support**: Sort by related table data with joins
- **Performance Awareness**: Index-conscious sorting patterns
- **Utility Functions**: Reusable helpers for common sorting scenarios
- **Type Safety**: Full TypeScript support for all sorting operations

Master these sorting techniques to present your data in the most meaningful order for your users and applications.