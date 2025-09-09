# Aggregate Functions

PGRestify provides comprehensive support for PostgreSQL aggregate functions, enabling powerful data analysis and reporting.

## Basic Aggregates

```typescript
import { createClient } from 'pgrestify';

const client = createClient('http://localhost:3000');

// Simple aggregate functions
const stats = await client
  .from('products')
  .select(`
    count(*) as total_products,
    sum(price) as total_value,
    avg(price) as average_price,
    min(price) as lowest_price,
    max(price) as highest_price
  `)
  .execute();
```

## Grouped Aggregates

```typescript
// Group by with aggregates
const categoryStats = await client
  .from('products')
  .select(`
    category,
    count(*) as product_count,
    sum(price) as total_category_value,
    avg(price) as average_category_price
  `)
  .groupBy('category')
  .order('total_category_value', { ascending: false })
  .execute();
```

## Conditional Aggregates

```typescript
// Conditional aggregation
const conditionalStats = await client
  .from('orders')
  .select(`
    count(*) as total_orders,
    sum(case when status = 'completed' then total else 0 end) as completed_revenue,
    sum(case when status = 'pending' then total else 0 end) as pending_revenue
  `)
  .execute();
```

## Advanced Aggregation Techniques

### Having Clause

```typescript
// Filtering grouped results
const popularCategories = await client
  .from('products')
  .select(`
    category,
    count(*) as product_count,
    avg(price) as average_price
  `)
  .groupBy('category')
  .having('count(*) > 10')
  .order('product_count', { ascending: false })
  .execute();
```

### Window Functions

```typescript
// Ranking and window functions
const rankedProducts = await client
  .from('products')
  .select(`
    *,
    rank() over (partition by category order by price desc) as price_rank,
    dense_rank() over (partition by category order by price desc) as dense_price_rank
  `)
  .limit(50)
  .execute();
```

## Time-Based Aggregations

```typescript
// Time-based aggregation
const monthlySales = await client
  .from('orders')
  .select(`
    date_trunc('month', created_at) as month,
    count(*) as order_count,
    sum(total) as total_revenue,
    avg(total) as average_order_value
  `)
  .groupBy('date_trunc(month, created_at)')
  .order('month')
  .execute();
```

## Statistical Functions

```typescript
// Advanced statistical aggregates
const statistics = await client
  .from('products')
  .select(`
    percentile_cont(0.5) within group (order by price) as median_price,
    percentile_cont(0.25) within group (order by price) as q1_price,
    percentile_cont(0.75) within group (order by price) as q3_price,
    mode() within group (order by category) as most_common_category
  `)
  .execute();
```

## Type-Safe Aggregation

```typescript
interface ProductStats {
  category: string;
  product_count: number;
  total_value: number;
  average_price: number;
}

// Type-safe aggregation
const typeSafeStats = await client
  .from<ProductStats>('products')
  .select(`
    category,
    count(*) as product_count,
    sum(price) as total_value,
    avg(price) as average_price
  `)
  .groupBy('category')
  .execute();
```

## Combining Aggregates with Filters

```typescript
// Complex aggregation with filtering
const filteredStats = await client
  .from('orders')
  .select(`
    category,
    count(*) as order_count,
    sum(total) as total_revenue
  `)
  .eq('status', 'completed')
  .gte('created_at', '2023-01-01')
  .groupBy('category')
  .having('sum(total) > 10000')
  .order('total_revenue', { ascending: false })
  .execute();
```

## Performance Optimization

```typescript
// Optimize aggregate queries
const optimizedStats = await client
  .from('large_table')
  .select(`
    category,
    count(*) as item_count
  `)
  .groupBy('category')
  .limit(100)  // Limit result set
  .execute();
```

## Error Handling

```typescript
try {
  const stats = await client
    .from('products')
    .select('count(*) as product_count')
    .execute();
} catch (error) {
  if (error.name === 'AggregationError') {
    console.log('Aggregation failed:', error.message);
  }
}
```

## Best Practices

- Use indexes on columns used in aggregations
- Limit result sets for large tables
- Avoid complex aggregations on frequently updated tables
- Use appropriate PostgreSQL aggregate functions
- Consider materialized views for complex, static aggregations

## Advanced Configuration

```typescript
const client = createClient({
  aggregates: {
    // Global aggregation settings
    maxGroupSize: 1000,
    defaultPrecision: 2
  }
});
```

## Performance Considerations

- Aggregations can be computationally expensive
- Use server-side aggregation when possible
- Create appropriate indexes
- Consider caching aggregate results
- Monitor query performance