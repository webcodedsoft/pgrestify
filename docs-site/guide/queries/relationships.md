# Relationships & Joins

Master relationship querying in PGRestify with one-to-one, one-to-many, and many-to-many relationships, nested resource fetching, and performance optimization.

## Overview

PGRestify leverages PostgREST's powerful relationship querying capabilities to fetch related data in a single request. Instead of multiple round trips to the database, you can retrieve complex nested data structures efficiently through foreign key relationships.

## Relationship Types

### One-to-One Relationships

#### Basic One-to-One

```typescript
// User has one profile
const usersWithProfiles = await client
  .from('users')
  .select(`
    id,
    name,
    email,
    profile:user_profiles(*)
  `)
  .execute();

// Result structure:
// {
//   id: 1,
//   name: "John",
//   email: "john@example.com",
//   profile: {
//     bio: "Developer",
//     avatar_url: "...",
//     birth_date: "1990-01-01"
//   }
// }
```

#### Specific Profile Fields

```typescript
// Select only specific profile fields
const users = await client
  .from('users')
  .select(`
    id,
    name,
    profile:user_profiles(bio, avatar_url)
  `)
  .execute();

// Aliasing the relationship
const users = await client
  .from('users')
  .select(`
    id,
    name,
    user_profile:user_profiles(bio, avatar_url)
  `)
  .execute();
```

#### Conditional One-to-One

```typescript
// Only include profiles that meet certain conditions
const users = await client
  .from('users')
  .select(`
    id,
    name,
    profile:user_profiles!inner(bio, avatar_url)
  `)
  .execute(); // Only returns users who have profiles

// With filtering on related table
const users = await client
  .from('users')
  .select(`
    id,
    name,
    profile:user_profiles(bio, avatar_url)
  `)
  .eq('user_profiles.is_public', true)
  .execute();
```

### One-to-Many Relationships

#### Basic One-to-Many

```typescript
// User has many posts
const usersWithPosts = await client
  .from('users')
  .select(`
    id,
    name,
    posts:posts(
      id,
      title,
      content,
      created_at
    )
  `)
  .execute();

// Result structure:
// {
//   id: 1,
//   name: "John",
//   posts: [
//     { id: 1, title: "First Post", content: "...", created_at: "..." },
//     { id: 2, title: "Second Post", content: "...", created_at: "..." }
//   ]
// }
```

#### Filtered One-to-Many

```typescript
// Get users with only their published posts
const usersWithPublishedPosts = await client
  .from('users')
  .select(`
    id,
    name,
    published_posts:posts(
      id,
      title,
      published_at
    )
  `)
  .eq('posts.status', 'published')
  .execute();

// Get users with recent posts only
const recentDate = new Date();
recentDate.setDate(recentDate.getDate() - 30);

const usersWithRecentPosts = await client
  .from('users')
  .select(`
    id,
    name,
    recent_posts:posts(
      id,
      title,
      created_at
    )
  `)
  .gte('posts.created_at', recentDate.toISOString())
  .execute();
```

#### Sorted One-to-Many

```typescript
// Get posts ordered by creation date
const usersWithSortedPosts = await client
  .from('users')
  .select(`
    id,
    name,
    posts:posts(
      id,
      title,
      created_at
    )
  `)
  .order('posts(created_at)', { ascending: false })
  .execute();

// Multiple sort criteria on related data
const usersWithPosts = await client
  .from('users')
  .select(`
    id,
    name,
    posts:posts(
      id,
      title,
      status,
      created_at
    )
  `)
  .order('posts(status)')
  .order('posts(created_at)', { ascending: false })
  .execute();
```

#### Limited One-to-Many

```typescript
// Get only the latest 5 posts per user
const usersWithLatestPosts = await client
  .from('users')
  .select(`
    id,
    name,
    latest_posts:posts(
      id,
      title,
      created_at
    )
  `)
  .order('posts(created_at)', { ascending: false })
  .limit(5) // Note: This limits the entire query, not per user
  .execute();

// For per-user limits, you may need to use RPC functions
const usersWithTopPosts = await client
  .rpc('get_users_with_top_posts', { 
    limit_per_user: 5 
  })
  .execute();
```

### Many-to-Many Relationships

#### Basic Many-to-Many

```typescript
// Posts have many tags through post_tags junction table
const postsWithTags = await client
  .from('posts')
  .select(`
    id,
    title,
    tags:post_tags(
      tag:tags(
        id,
        name,
        color
      )
    )
  `)
  .execute();

// Flattened structure approach
const postsWithTags = await client
  .from('posts')
  .select(`
    id,
    title,
    post_tags(
      tags(name, color)
    )
  `)
  .execute();
```

#### Many-to-Many with Junction Data

```typescript
// Include data from the junction table
const usersWithRoles = await client
  .from('users')
  .select(`
    id,
    name,
    user_roles(
      assigned_at,
      assigned_by,
      role:roles(
        name,
        permissions
      )
    )
  `)
  .execute();

// Result includes junction table data:
// {
//   id: 1,
//   name: "John",
//   user_roles: [
//     {
//       assigned_at: "2024-01-01",
//       assigned_by: 123,
//       role: { name: "admin", permissions: [...] }
//     }
//   ]
// }
```

#### Filtered Many-to-Many

```typescript
// Get posts with only active tags
const postsWithActiveTags = await client
  .from('posts')
  .select(`
    id,
    title,
    post_tags(
      tag:tags(name, color)
    )
  `)
  .eq('tags.active', true)
  .execute();

// Get users with specific role types
const usersWithAdminRoles = await client
  .from('users')
  .select(`
    id,
    name,
    user_roles(
      role:roles(name, level)
    )
  `)
  .in('roles.type', ['admin', 'moderator'])
  .execute();
```

## Nested Resource Fetching

### Multi-Level Nesting

```typescript
// Three levels deep: User -> Posts -> Comments -> Author
const usersWithPostsAndComments = await client
  .from('users')
  .select(`
    id,
    name,
    posts(
      id,
      title,
      comments(
        id,
        content,
        created_at,
        author:users(name, avatar)
      )
    )
  `)
  .execute();
```

### Complex Nested Relationships

```typescript
// E-commerce example: Order with items, products, and customer
const orderDetails = await client
  .from('orders')
  .select(`
    id,
    order_number,
    status,
    created_at,
    customer:customers(
      id,
      name,
      email,
      shipping_address:addresses(*)
    ),
    order_items(
      quantity,
      unit_price,
      product:products(
        name,
        description,
        category:categories(name)
      )
    ),
    payments(
      amount,
      method,
      status
    )
  `)
  .eq('id', orderId)
  .single()
  .execute();
```

### Selective Deep Fetching

```typescript
// Fetch different levels of detail based on conditions
const getPostDetails = async (postId: number, includeComments = false) => {
  let selectClause = `
    id,
    title,
    content,
    author:users(name, avatar),
    category:categories(name, slug)
  `;

  if (includeComments) {
    selectClause += `,
    comments(
      id,
      content,
      created_at,
      author:users(name, avatar)
    )`;
  }

  return client
    .from('posts')
    .select(selectClause)
    .eq('id', postId)
    .single()
    .execute();
};
```

## Join Types and Behavior

### Inner Joins

```typescript
// Only return users who have profiles (inner join behavior)
const usersWithProfiles = await client
  .from('users')
  .select(`
    id,
    name,
    profile:user_profiles!inner(bio, avatar_url)
  `)
  .execute();

// Multiple inner joins
const postsWithAuthorsAndCategories = await client
  .from('posts')
  .select(`
    id,
    title,
    author:users!inner(name),
    category:categories!inner(name)
  `)
  .execute(); // Only posts that have both author and category
```

### Left Joins (Default)

```typescript
// Default behavior - includes all users, even without profiles
const allUsersWithOptionalProfiles = await client
  .from('users')
  .select(`
    id,
    name,
    profile:user_profiles(bio, avatar_url)
  `)
  .execute();

// Explicitly specify left join
const usersWithOptionalPosts = await client
  .from('users')
  .select(`
    id,
    name,
    posts:posts!left(title, created_at)
  `)
  .execute();
```

### Hint-based Joins

```typescript
// Use hints to optimize join performance
const optimizedQuery = await client
  .from('orders')
  .select(`
    id,
    customer:customers!customer_orders_fk(name, email)
  `)
  .execute();

// Specify relationship name for clarity
const productsWithCategories = await client
  .from('products')
  .select(`
    id,
    name,
    category:categories!product_category_fk(name)
  `)
  .execute();
```

## Performance Optimization

### Selective Field Loading

```typescript
// ❌ Bad: Loading all fields from related tables
const inefficient = await client
  .from('users')
  .select(`
    *,
    posts(*),
    profile(*)
  `)
  .execute();

// ✅ Good: Only load required fields
const efficient = await client
  .from('users')
  .select(`
    id,
    name,
    posts(id, title, created_at),
    profile(bio, avatar_url)
  `)
  .execute();
```

### Limit Related Data

```typescript
// Limit the number of related records
const usersWithRecentPosts = await client
  .from('users')
  .select(`
    id,
    name,
    recent_posts:posts(
      id,
      title,
      created_at
    )
  `)
  .order('posts(created_at)', { ascending: false })
  .limit(10) // Be careful - this limits total results
  .execute();

// Better approach for per-user limits
const getUsersWithLimitedPosts = async () => {
  // First get users
  const users = await client
    .from('users')
    .select('id, name')
    .execute();

  // Then get limited posts for each (if needed)
  // Or use a custom RPC function
  return client
    .rpc('get_users_with_limited_posts', { post_limit: 5 })
    .execute();
};
```

### Index Considerations

```typescript
// Ensure foreign keys are indexed for efficient joins
// This is a database design consideration, not query syntax

// Use specific field selection to utilize covering indexes
const optimizedUserPosts = await client
  .from('users')
  .select(`
    id,
    name,
    posts(id, title, status)
  `)
  .eq('posts.status', 'published') // If there's an index on status
  .execute();
```

## Dynamic Relationship Building

### Conditional Relationship Loading

```typescript
interface QueryOptions {
  includePosts?: boolean;
  includeProfile?: boolean;
  includeComments?: boolean;
}

const buildUserQuery = (options: QueryOptions) => {
  let selectClause = 'id, name, email, created_at';

  if (options.includeProfile) {
    selectClause += ', profile:user_profiles(bio, avatar_url)';
  }

  if (options.includePosts) {
    let postSelect = 'posts(id, title, created_at, status)';
    
    if (options.includeComments) {
      postSelect = 'posts(id, title, created_at, status, comments(id, content, author:users(name)))';
    }
    
    selectClause += `, ${postSelect}`;
  }

  return client
    .from('users')
    .select(selectClause);
};

// Usage
const usersWithPosts = await buildUserQuery({
  includePosts: true,
  includeProfile: true
}).execute();
```

### Relationship Builder Pattern

```typescript
class RelationshipBuilder {
  private relationships: string[] = [];
  
  withProfile(fields = '*') {
    this.relationships.push(`profile:user_profiles(${fields})`);
    return this;
  }
  
  withPosts(fields = '*', limit?: number) {
    let relation = `posts(${fields})`;
    this.relationships.push(relation);
    return this;
  }
  
  withRoles() {
    this.relationships.push(`
      user_roles(
        role:roles(name, permissions),
        assigned_at
      )
    `);
    return this;
  }
  
  build(baseFields = '*') {
    const allSelects = [baseFields, ...this.relationships];
    return allSelects.join(', ');
  }
}

// Usage
const relationBuilder = new RelationshipBuilder()
  .withProfile('bio, avatar_url')
  .withPosts('id, title, created_at')
  .withRoles();

const users = await client
  .from('users')
  .select(relationBuilder.build('id, name, email'))
  .execute();
```

## Common Relationship Patterns

### User Activity Feed

```typescript
const getUserActivityFeed = async (userId: number) => {
  return client
    .from('users')
    .select(`
      id,
      name,
      activities:user_activities(
        id,
        type,
        created_at,
        target_post:posts(id, title),
        target_comment:comments(id, content)
      )
    `)
    .eq('id', userId)
    .order('user_activities(created_at)', { ascending: false })
    .single()
    .execute();
};
```

### Product Catalog with Variants

```typescript
const getProductCatalog = async () => {
  return client
    .from('products')
    .select(`
      id,
      name,
      base_price,
      category:categories(name, slug),
      variants:product_variants(
        id,
        sku,
        price,
        attributes:variant_attributes(
          attribute:attributes(name, value)
        )
      ),
      images:product_images(url, alt_text, is_primary)
    `)
    .eq('active', true)
    .order('name')
    .execute();
};
```

### Forum Thread with Nested Replies

```typescript
const getThreadWithReplies = async (threadId: number) => {
  return client
    .from('threads')
    .select(`
      id,
      title,
      created_at,
      author:users(name, avatar),
      posts:thread_posts(
        id,
        content,
        created_at,
        author:users(name, avatar),
        replies:post_replies(
          id,
          content,
          created_at,
          author:users(name, avatar)
        )
      )
    `)
    .eq('id', threadId)
    .order('thread_posts(created_at)')
    .order('post_replies(created_at)')
    .single()
    .execute();
};
```

### E-commerce Order Summary

```typescript
const getOrderSummary = async (orderId: number) => {
  return client
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      total_amount,
      created_at,
      customer:customers(
        name,
        email,
        billing_address:addresses!billing_address_id(*),
        shipping_address:addresses!shipping_address_id(*)
      ),
      items:order_items(
        quantity,
        unit_price,
        total_price,
        product:products(
          name,
          sku,
          image_url
        )
      ),
      payments:order_payments(
        amount,
        method,
        status,
        processed_at
      )
    `)
    .eq('id', orderId)
    .single()
    .execute();
};
```

## Advanced Relationship Techniques

### Aggregated Relationships

```typescript
// Include count of related records
const usersWithCounts = await client
  .from('users')
  .select(`
    id,
    name,
    post_count:posts(count),
    comment_count:comments(count)
  `)
  .execute();

// Include calculated fields from relationships
const categoriesWithStats = await client
  .from('categories')
  .select(`
    id,
    name,
    products(count),
    total_value:products(sum(price))
  `)
  .execute();
```

### Conditional Relationship Fields

```typescript
// Include different fields based on user role
const getPostsForUser = async (userId: number, userRole: string) => {
  let selectClause = `
    id,
    title,
    content,
    author:users(name, avatar)
  `;

  if (userRole === 'admin') {
    selectClause += `,
    draft_notes,
    internal_tags,
    moderation_history:post_moderations(
      action,
      moderator:users(name),
      created_at
    )`;
  }

  return client
    .from('posts')
    .select(selectClause)
    .eq('author_id', userId)
    .execute();
};
```

### Recursive Relationships

```typescript
// Categories with subcategories (self-referential)
const getCategoryTree = async () => {
  // Note: PostgREST has limitations with recursive queries
  // You might need to use RPC functions for deep trees
  
  return client
    .from('categories')
    .select(`
      id,
      name,
      parent_id,
      subcategories:categories!parent_id(
        id,
        name,
        parent_id
      )
    `)
    .is('parent_id', null) // Only root categories
    .execute();
};

// For deeper recursion, use RPC
const getFullCategoryTree = async () => {
  return client
    .rpc('get_category_tree')
    .execute();
};
```

---

## Summary

PGRestify's relationship querying provides:

- **Efficient Data Fetching**: Retrieve complex nested data in single requests
- **Flexible Relationships**: Support for all relationship types (1:1, 1:many, many:many)
- **Deep Nesting**: Multi-level nested resource fetching
- **Join Control**: Inner and outer joins with explicit control
- **Performance Optimization**: Field selection and query optimization
- **Dynamic Building**: Runtime relationship construction
- **Type Safety**: Full TypeScript support for nested data structures

Master these relationship patterns to build efficient, maintainable data access layers that minimize database round trips while providing exactly the data your application needs.