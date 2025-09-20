# Column Aliasing

PGRestify provides flexible column aliasing capabilities, allowing you to rename and transform columns in your queries.

## Basic Column Aliasing

PGRestify supports column aliasing in multiple ways:

### Array Syntax with AS Keyword

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient('http://localhost:3000');

// Array syntax with aliases
const aliasedQuery = await client
  .from('users')
  .select([
    'id AS user_id', 
    'name AS full_name', 
    'email AS contact_email'
  ])
  .find();

// Mixed array syntax
const mixedAliases = await client
  .from('users')
  .select([
    'id AS user_id',
    'first_name AS firstName', 
    'last_name AS lastName',
    'email',  // No alias
    'created_at AS signupDate'
  ])
  .find();

// With relations and aliases
const aliasedRelations = await client
  .from('users')
  .select([
    'id AS user_id',
    'name AS full_name',
    'profile.bio AS userBio',
    'profile.avatar_url AS profileImage'
  ])
  .relations(['profile'])
  .find();
```

### String Syntax with AS Keyword

```typescript
// Traditional string syntax with aliases
const stringAliases = await client
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
// Array syntax with computed aliases
const computedAliases = await client
  .from('orders')
  .select([
    'id',
    'total',
    'total * 0.1 AS tax_amount',
    'total - (total * 0.1) AS final_total'
  ])
  .find();

// String syntax with computed aliases
const stringComputedAliases = await client
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
// Array syntax with aggregate aliases
const aggregateAliases = await client
  .from('products')
  .select([
    'category',
    'count(*) AS product_count',
    'avg(price) AS average_price',
    'max(price) AS highest_price'
  ])
  .groupBy('category')
  .find();

// String syntax with aggregate aliases
const stringAggregateAliases = await client
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

## Advanced Array Syntax Features

### Case-Insensitive AS Keyword

```typescript
// Case variations supported in array syntax
const caseVariations = await client
  .from('users')
  .select([
    'id AS user_id',        // Uppercase AS
    'name as full_name',    // Lowercase as
    'email As contact',     // Mixed case As
    'created_at aS signup'  // Mixed case aS
  ])
  .find();
```

### Complex Field Selection with Aliases

```typescript
// Complex field selection in arrays
const complexSelection = await client
  .from('users')
  .select([
    'id',
    'first_name AS firstName',
    'last_name AS lastName', 
    'CONCAT(first_name, \' \', last_name) AS full_name',
    'EXTRACT(YEAR FROM created_at) AS signup_year',
    'profile.bio AS user_bio',
    'profile.avatar_url AS profile_image',
    'posts.title AS latest_post'
  ])
  .relations(['profile', 'posts'])
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