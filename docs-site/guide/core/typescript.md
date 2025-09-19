# TypeScript Integration

Learn how to leverage PGRestify's comprehensive TypeScript support for type-safe database operations.

## Overview

PGRestify is built with TypeScript-first design, providing complete type safety throughout your database interactions. From query building to response handling, every aspect of the library is designed to catch errors at compile time and provide excellent IntelliSense support.

## Database Schema Types

### Defining Database Types

Start by defining TypeScript interfaces that match your database schema:

```typescript
// types/database.ts
export interface Database {
  users: {
    id: number;
    name: string;
    email: string;
    age: number | null;
    active: boolean;
    created_at: string;
    updated_at: string | null;
  };
  
  posts: {
    id: number;
    title: string;
    content: string;
    user_id: number;
    published: boolean;
    view_count: number;
    tags: string[];
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string | null;
  };
  
  categories: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    parent_id: number | null;
    created_at: string;
  };
  
  comments: {
    id: number;
    post_id: number;
    user_id: number;
    content: string;
    approved: boolean;
    created_at: string;
  };
}

// Extract individual table types
export type User = Database['users'];
export type Post = Database['posts'];
export type Category = Database['categories'];
export type Comment = Database['comments'];
```

### Column Name Transformation

When using column transformation, define both snake_case and camelCase types:

```typescript
// Database column types (snake_case)
interface UserRow {
  id: number;
  first_name: string;
  last_name: string;
  email_address: string;
  phone_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

// Client-side types (camelCase) - after transformation
interface User {
  id: number;
  firstName: string;
  lastName: string;
  emailAddress: string;
  phoneNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

// Use with client configuration
const client = createClient({
  url: 'http://localhost:3000',
  transformColumns: true // Enables automatic transformation
});
```

## Type-Safe Client Creation

### Basic Typed Client

Create a client with full database typing:

```typescript
import { createClient, PostgRESTClient } from '@webcoded/pgrestify';
import type { Database } from './types/database';

// Create typed client
const client: PostgRESTClient<Database> = createClient({
  url: 'http://localhost:3000',
  transformColumns: true
});

// Now all operations are fully typed
const users = await client.from('users').select('*').execute();
// users.data is typed as User[]
```

### Generic Client Factory

Create reusable typed client factories:

```typescript
// utils/client.ts
import { createClient, PostgRESTClient } from '@webcoded/pgrestify';
import type { Database } from '../types/database';

export function createTypedClient(url: string): PostgRESTClient<Database> {
  return createClient<Database>({
    url,
    transformColumns: true,
    auth: {
      autoRefresh: true,
      storage: 'localStorage'
    }
  });
}

// Environment-specific clients
export const devClient = createTypedClient('http://localhost:3000');
export const prodClient = createTypedClient(process.env.PROD_API_URL!);
```

## Type-Safe Queries

### Select Queries with Type Inference

The query builder provides intelligent type inference:

```typescript
// Fully typed select - IntelliSense works perfectly
const users = await client
  .from('users')
  .select('id, name, email, active')
  .eq('active', true)
  .execute();

// TypeScript knows users.data is:
// Array<{ id: number; name: string; email: string; active: boolean }>

// Single record with full typing
const user = await client
  .from('users')
  .select('*')
  .eq('id', 123)
  .single()
  .execute();

// TypeScript knows user.data is User | null
```

### Column Selection with Type Safety

Use type-safe column selection patterns:

```typescript
// Define reusable column selections
type UserSummary = Pick<User, 'id' | 'name' | 'email'>;
type UserProfile = Pick<User, 'id' | 'name' | 'email' | 'age' | 'active'>;

// Helper function for type-safe selections
function selectUserSummary() {
  return client
    .from('users')
    .select('id, name, email');
}

function selectUserProfile() {
  return client
    .from('users')
    .select('id, name, email, age, active');
}

// Usage with perfect typing
const summaries: UserSummary[] = (await selectUserSummary().execute()).data;
const profiles: UserProfile[] = (await selectUserProfile().execute()).data;
```

### Relationship Queries with Nested Types

Define types for relationship queries:

```typescript
// Define nested query result types
interface PostWithAuthor extends Omit<Post, 'user_id'> {
  author: {
    id: number;
    name: string;
    email: string;
  };
}

interface PostWithDetails extends Post {
  author: User;
  category: Category;
  comments: Comment[];
}

// Type-safe relationship queries
const postsWithAuthor = await client
  .from('posts')
  .select(`
    id,
    title,
    content,
    published,
    created_at,
    author:users (
      id,
      name,
      email
    )
  `)
  .execute();

// TypeScript infers the correct nested structure
```

## Type-Safe Mutations

### Insert Operations

Type-safe record creation:

```typescript
// Define input types for mutations
type CreateUserInput = Omit<User, 'id' | 'created_at' | 'updated_at'>;
type UpdateUserInput = Partial<Omit<User, 'id' | 'created_at'>>;

// Type-safe insert
const createUser = async (userData: CreateUserInput): Promise<User> => {
  const result = await client
    .from('users')
    .insert(userData)
    .select('*')
    .single()
    .execute();
    
  if (!result.data) {
    throw new Error('Failed to create user');
  }
  
  return result.data; // Fully typed as User
};

// Usage
const newUser = await createUser({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  active: true
});
```

### Update Operations

Type-safe record updates:

```typescript
const updateUser = async (
  id: number, 
  updates: UpdateUserInput
): Promise<User> => {
  const result = await client
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select('*')
    .single()
    .execute();
    
  if (!result.data) {
    throw new Error('User not found or update failed');
  }
  
  return result.data;
};

// TypeScript ensures only valid fields can be updated
const updatedUser = await updateUser(123, {
  name: 'Jane Doe',
  age: 31
  // email: 123 // ❌ TypeScript error - wrong type
  // invalid_field: 'test' // ❌ TypeScript error - field doesn't exist
});
```

## Repository Pattern with Types

### Typed Repository Class

Create a type-safe repository pattern:

```typescript
// repositories/BaseRepository.ts
export abstract class BaseRepository<T, TInsert = Omit<T, 'id'>, TUpdate = Partial<T>> {
  constructor(
    protected client: PostgRESTClient,
    protected tableName: string
  ) {}
  
  async findById(id: number): Promise<T | null> {
    const result = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .execute();
      
    return result.data as T | null;
  }
  
  async findAll(): Promise<T[]> {
    const result = await this.client
      .from(this.tableName)
      .select('*')
      .execute();
      
    return result.data as T[];
  }
  
  async create(data: TInsert): Promise<T> {
    const result = await this.client
      .from(this.tableName)
      .insert(data)
      .select('*')
      .single()
      .execute();
      
    if (!result.data) {
      throw new Error('Failed to create record');
    }
    
    return result.data as T;
  }
  
  async update(id: number, data: TUpdate): Promise<T> {
    const result = await this.client
      .from(this.tableName)
      .update(data)
      .eq('id', id)
      .select('*')
      .single()
      .execute();
      
    if (!result.data) {
      throw new Error('Record not found or update failed');
    }
    
    return result.data as T;
  }
  
  async delete(id: number): Promise<boolean> {
    const result = await this.client
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .execute();
      
    return result.data.length > 0;
  }
}
```

### Specific Repository Implementation

```typescript
// repositories/UserRepository.ts
export class UserRepository extends BaseRepository<User, CreateUserInput, UpdateUserInput> {
  constructor(client: PostgRESTClient) {
    super(client, 'users');
  }
  
  // Additional type-safe methods specific to users
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.client
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle()
      .execute();
      
    return result.data as User | null;
  }
  
  async findActiveUsers(): Promise<User[]> {
    const result = await this.client
      .from('users')
      .select('*')
      .eq('active', true)
      .execute();
      
    return result.data as User[];
  }
  
  async getUserStats(): Promise<{ total: number; active: number }> {
    const [totalResult, activeResult] = await Promise.all([
      this.client.from('users').select('*', { count: 'exact', head: true }).execute(),
      this.client.from('users').select('*', { count: 'exact', head: true }).eq('active', true).execute()
    ]);
    
    return {
      total: totalResult.count || 0,
      active: activeResult.count || 0
    };
  }
}

// Usage
const userRepo = new UserRepository(client);
const activeUsers = await userRepo.findActiveUsers(); // Fully typed as User[]
```

## Advanced TypeScript Patterns

### Generic Query Builders

Create reusable, type-safe query builders:

```typescript
// utils/queryBuilders.ts
export class TypedQueryBuilder<T> {
  constructor(
    private client: PostgRESTClient,
    private tableName: string
  ) {}
  
  // Paginated queries with full typing
  async paginate(
    page: number = 0,
    pageSize: number = 10,
    filters?: Partial<T>
  ): Promise<{ data: T[]; total: number; hasMore: boolean }> {
    let query = this.client
      .from(this.tableName)
      .select('*', { count: 'exact' })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    // Apply filters if provided
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.eq(key, value);
        }
      });
    }
    
    const result = await query.execute();
    
    return {
      data: result.data as T[],
      total: result.count || 0,
      hasMore: result.data.length === pageSize
    };
  }
  
  // Search with type safety
  async search(
    searchTerm: string,
    searchFields: (keyof T)[],
    limit: number = 20
  ): Promise<T[]> {
    const orConditions = searchFields
      .map(field => `${String(field)}.ilike.%${searchTerm}%`)
      .join(',');
    
    const result = await this.client
      .from(this.tableName)
      .select('*')
      .or(orConditions)
      .limit(limit)
      .execute();
    
    return result.data as T[];
  }
}

// Usage
const userQueryBuilder = new TypedQueryBuilder<User>(client, 'users');

const userPage = await userQueryBuilder.paginate(0, 10, { active: true });
const searchResults = await userQueryBuilder.search('john', ['name', 'email']);
```

### Conditional Types for Queries

Use TypeScript's conditional types for advanced query building:

```typescript
// Define conditional types based on query operations
type SelectFields<T> = {
  [K in keyof T]?: boolean;
};

type FilterConditions<T> = {
  [K in keyof T]?: T[K] | {
    eq?: T[K];
    neq?: T[K];
    gt?: T[K];
    gte?: T[K];
    lt?: T[K];
    lte?: T[K];
    in?: T[K][];
    like?: string;
    ilike?: string;
  };
};

// Advanced query builder with conditional types
export class AdvancedQueryBuilder<T> {
  constructor(
    private client: PostgRESTClient,
    private tableName: string
  ) {}
  
  async query<K extends keyof T>(options: {
    select?: SelectFields<T>;
    where?: FilterConditions<T>;
    orderBy?: {
      column: K;
      ascending?: boolean;
    };
    limit?: number;
  }): Promise<Partial<T>[]> {
    let query = this.client.from(this.tableName);
    
    // Build select clause
    if (options.select) {
      const selectedFields = Object.keys(options.select)
        .filter(key => options.select![key])
        .join(', ');
      query = query.select(selectedFields || '*');
    } else {
      query = query.select('*');
    }
    
    // Apply where conditions
    if (options.where) {
      Object.entries(options.where).forEach(([key, condition]) => {
        if (typeof condition === 'object' && condition !== null) {
          Object.entries(condition).forEach(([op, value]) => {
            switch (op) {
              case 'eq':
                query = query.eq(key, value);
                break;
              case 'neq':
                query = query.neq(key, value);
                break;
              case 'gt':
                query = query.gt(key, value);
                break;
              // ... other operators
            }
          });
        } else {
          query = query.eq(key, condition);
        }
      });
    }
    
    // Apply ordering
    if (options.orderBy) {
      query = query.order(String(options.orderBy.column), {
        ascending: options.orderBy.ascending ?? true
      });
    }
    
    // Apply limit
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const result = await query.execute();
    return result.data as Partial<T>[];
  }
}
```

## Error Handling with Types

### Typed Error Handling

Create type-safe error handling patterns:

```typescript
// Define result types for operations
type OperationResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
  errorCode?: string;
};

// Type-safe operation wrapper
async function safeOperation<T>(
  operation: () => Promise<T>
): Promise<OperationResult<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    if (error instanceof PGRestifyError) {
      return {
        success: false,
        error: error.message,
        errorCode: error.code
      };
    }
    return {
      success: false,
      error: 'An unexpected error occurred'
    };
  }
}

// Usage
const userResult = await safeOperation(() =>
  client
    .from('users')
    .select('*')
    .eq('id', 123)
    .single()
    .execute()
);

if (userResult.success) {
  console.log('User:', userResult.data); // Fully typed
} else {
  console.error('Error:', userResult.error);
}
```

## Type Generation Tools

### Automatic Type Generation

Generate types from your database schema:

```typescript
// scripts/generate-types.ts
import { createClient } from '@webcoded/pgrestify';

async function generateTypes() {
  const client = createClient({
    url: process.env.DATABASE_URL!
  });
  
  // This is a conceptual example - in practice, you'd use tools like
  // Supabase CLI or custom scripts to generate types from your schema
  
  const tableInfo = await client
    .from('information_schema.tables')
    .select('table_name, column_name, data_type, is_nullable')
    .eq('table_schema', 'public')
    .execute();
  
  // Generate TypeScript interfaces from table info
  // ... implementation details
}
```

### Schema Validation

Validate your types against the actual database schema:

```typescript
// utils/validation.ts
export function validateSchema<T>(
  data: unknown,
  validator: (obj: any) => obj is T
): data is T {
  return validator(data);
}

// Type guards for runtime validation
export function isUser(obj: any): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'number' &&
    typeof obj.name === 'string' &&
    typeof obj.email === 'string' &&
    typeof obj.active === 'boolean'
  );
}

// Usage in API responses
const userData = await client.from('users').select('*').single().execute();
if (validateSchema(userData.data, isUser)) {
  // userData.data is now typed as User
  console.log(userData.data.name);
}
```

## Best Practices

### Type Organization

Structure your types for maintainability:

```typescript
// types/database/
// ├── index.ts          // Main exports
// ├── tables.ts         // Table definitions
// ├── views.ts          // View definitions
// ├── functions.ts      // Stored function types
// └── enums.ts          // Database enums

// types/database/index.ts
export * from './tables';
export * from './views';
export * from './functions';
export * from './enums';

// types/api/
// ├── requests.ts       // API request types
// ├── responses.ts      // API response types
// └── filters.ts        // Filter types

// types/index.ts - Main type exports
export * from './database';
export * from './api';
```

### Generic Utilities

Create reusable type utilities:

```typescript
// types/utils.ts
export type NonNullable<T> = T extends null | undefined ? never : T;
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

export type CreateInput<T> = Omit<T, 'id' | 'created_at' | 'updated_at'>;
export type UpdateInput<T> = Partial<Omit<T, 'id' | 'created_at'>>;

// Usage
type CreateUserInput = CreateInput<User>;
type UpdateUserInput = UpdateInput<User>;
```

---

## Summary

TypeScript integration with PGRestify provides:

- **Complete Type Safety**: From database schema to API responses
- **Intelligent IntelliSense**: Full autocomplete and error detection
- **Compile-time Validation**: Catch errors before runtime
- **Maintainable Code**: Strong typing makes refactoring safer
- **Developer Experience**: Excellent tooling support and documentation
- **Flexible Patterns**: Support for various TypeScript patterns and architectures

The key to effective TypeScript usage with PGRestify is to define your database schema types upfront and leverage the library's built-in type inference throughout your application.