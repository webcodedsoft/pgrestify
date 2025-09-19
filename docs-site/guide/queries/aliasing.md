# Column Aliasing

PGRestify provides flexible column aliasing capabilities, allowing you to rename and transform columns in your queries.

## Basic Column Aliasing

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient('http://localhost:3000');

// Simple column aliasing
const aliasedQuery = await client
  .from('users')
  .select(`
    id as user_id, 
    name as full_name, 
    email as contact_email
  `)
  .find();
```

## Computed Column Aliases

```typescript
// Computed column aliases
const computedAliases = await client
  .from('orders')
  .select(`
    id,
    total,
    tax_amount:total * 0.1 as tax,
    discounted_total:total - (total * 0.1) as final_total
  `)
  .find();
```

## Aggregate Function Aliases

```typescript
// Aggregate function aliases
const aggregateAliases = await client
  .from('products')
  .select(`
    category,
    total_products:count(*) as product_count,
    average_price:avg(price) as avg_price,
    max_price:max(price) as highest_price
  `)
  .groupBy('category')
  .find();
```

## Nested Resource Aliasing

```typescript
// Aliasing in nested resources
const nestedAliases = await client
  .from('users')
  .select(`
    id,
    name,
    user_posts:posts(
      post_id:id,
      post_title:title,
      post_content:content
    )
  `)
  .find();
```

## Type-Safe Aliasing

```typescript
interface UserWithAliases {
  user_id: number;
  full_name: string;
  contact_email: string;
}

// Type-safe aliased query
const typeSafeAliases = await client
  .from<UserWithAliases>('users')
  .select(`
    id as user_id, 
    name as full_name, 
    email as contact_email
  `)
  .find();
```

## Conditional Aliasing

```typescript
// Conditional column aliasing
const conditionalAliases = await client
  .from('orders')
  .select(`
    id,
    total,
    status_label:case 
      when status = 'completed' then 'Paid'
      when status = 'pending' then 'Awaiting Payment'
      else 'Unknown'
    end as order_status
  `)
  .find();
```

## Advanced Aliasing Techniques

```typescript
// Complex aliasing with functions
const complexAliases = await client
  .from('users')
  .select(`
    id,
    full_name:concat(first_name, ' ', last_name) as display_name,
    registration_year:extract(year from created_at) as signup_year,
    age_group:case 
      when age < 18 then 'Minor'
      when age between 18 and 35 then 'Young Adult'
      else 'Adult'
    end as demographic_group
  `)
  .find();
```

## Joining with Aliases

```typescript
// Aliasing in joined queries
const joinWithAliases = await client
  .from('orders')
  .select(`
    id as order_id,
    total as order_total,
    customer:users(
      user_id:id,
      full_name:name,
      contact:email
    )
  `)
  .find();
```

## Performance Considerations

```typescript
// Optimize aliased queries
const optimizedAliases = await client
  .from('large_table')
  .select(`
    id,
    computed_field:some_complex_calculation(column) as optimized_field
  `)
  .limit(100)
  .find();
```

## Error Handling

```typescript
try {
  const aliasedData = await client
    .from('users')
    .select(`
      id as user_id, 
      name as full_name
    `)
    .find();
} catch (error) {
  if (error.name === 'AliasingError') {
    console.log('Column aliasing failed:', error.message);
  }
}
```

## Best Practices

- Use meaningful and consistent alias names
- Avoid overly complex computed columns
- Be mindful of performance with complex aliases
- Use type-safe interfaces for aliased queries
- Document complex aliases for team understanding

## Advanced Configuration

```typescript
const client = createClient({
  aliasing: {
    // Global aliasing configuration
    maxComputedColumns: 5,
    allowedFunctions: ['concat', 'extract', 'lower', 'upper']
  }
});
```

## Security Considerations

```typescript
// Sanitize user-provided alias inputs
function sanitizeAlias(alias: string): string {
  // Implement alias sanitization logic
  return alias.replace(/[^a-zA-Z0-9_]/g, '');
}
```

## Combining with Other Features

```typescript
// Aliasing with filtering and pagination
const combinedFeatures = await client
  .from('products')
  .select(`
    id as product_id,
    name as product_name,
    discounted_price:price * 0.9 as sale_price
  `)
  .eq('category', 'electronics')
  .order('sale_price', { ascending: true })
  .paginate({ page: 1, pageSize: 20 })
  .executeWithPagination();
```

## Performance Implications

- Simple aliases have minimal performance overhead
- Complex computed columns can impact query performance
- Use database indexes for computed columns
- Avoid excessive function calls in aliases
- Profile and optimize complex aliasing scenarios