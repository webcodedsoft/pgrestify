# TypeScript Integration

PGRestify's TanStack Query integration is built from the ground up with TypeScript in mind, providing comprehensive type safety, automatic type inference, and excellent developer experience. This guide covers advanced TypeScript patterns and best practices for using PGRestify with TanStack Query.

## Overview

TypeScript benefits in PGRestify TanStack Query integration:

- **Full Type Safety**: Complete type checking for queries, mutations, and cache operations
- **Automatic Type Inference**: Infer types from database schema and query results
- **Generic Query Factories**: Reusable, type-safe query builders
- **Enhanced Developer Experience**: IntelliSense, autocompletion, and compile-time error checking
- **Type-Safe Cache Management**: Strongly typed cache keys and data structures
- **RPC Function Types**: Type-safe stored procedure calls with argument and return type checking

## Basic Type Definitions

### Defining Table Types

Start by defining TypeScript interfaces for your database tables:

```tsx
// types/database.ts

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  active: boolean;
  role: 'user' | 'admin' | 'moderator';
  created_at: string;
  updated_at: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  published: boolean;
  author_id: string;
  category_id: string;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  sort_order: number;
  active: boolean;
}

// Union types for complex scenarios
export type DatabaseTable = User | Post | Category;
export type UserRole = User['role'];
export type PostStatus = Post['published'];
```

### Creating Typed Query Factories

Use your table types to create strongly-typed query factories:

```tsx
// hooks/queries.ts
import { createPostgRESTQueries, createTableQueries } from '@webcoded/pgrestify/tanstack-query';
import { createClient } from '@webcoded/pgrestify';
import type { User, Post, Category } from '../types/database';

const client = createClient({ url: 'http://localhost:3000' });

// Typed query factories
export const userQueries = createPostgRESTQueries<User>(client, 'users');
export const postQueries = createPostgRESTQueries<Post>(client, 'posts');
export const categoryQueries = createPostgRESTQueries<Category>(client, 'categories');

// Complete table integration with full typing
export const userTable = createTableQueries<User>(client, 'users');
export const postTable = createTableQueries<Post>(client, 'posts');
```

## Advanced Type Patterns

### Generic Query Hooks

Create reusable, generic query hooks:

```tsx
// hooks/useTypedQuery.ts
import { useQuery } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import type { QueryResponse } from '@webcoded/pgrestify';

// Generic typed query hook
export function useTypedQuery<
  TData extends Record<string, unknown>,
  TError = Error
>(
  queryConfig: UseQueryOptions<QueryResponse<TData>, TError>,
  options?: {
    enabled?: boolean;
    select?: (data: QueryResponse<TData>) => any;
  }
) {
  return useQuery<QueryResponse<TData>, TError>({
    ...queryConfig,
    enabled: options?.enabled,
    select: options?.select
  });
}

// Usage with strong typing
function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading, error } = useTypedQuery<User>(
    userQueries.detail(userId),
    {
      enabled: !!userId,
      select: (data) => data.data // Extract just the user data
    }
  );

  // data is now inferred as User | undefined
  // error is inferred as Error
  // Full IntelliSense support
}
```

### Conditional Type Queries

Use TypeScript's conditional types for advanced query patterns:

```tsx
// types/queries.ts
import type { QueryResponse, SingleQueryResponse } from '@webcoded/pgrestify';

// Conditional type for single vs multiple results
export type QueryResult<T, Single extends boolean = false> = Single extends true
  ? SingleQueryResponse<T>
  : QueryResponse<T>;

// Generic query factory with conditional return types
export function createTypedQuery<
  T extends Record<string, unknown>,
  Single extends boolean = false
>(
  single: Single
): Single extends true 
  ? UseQueryOptions<SingleQueryResponse<T>, Error>
  : UseQueryOptions<QueryResponse<T>, Error> {
  // Implementation would return appropriate type based on Single parameter
  return {} as any; // Placeholder
}

// Usage
const singleUserQuery = createTypedQuery<User, true>(true);   // Returns SingleQueryResponse<User>
const multipleUsersQuery = createTypedQuery<User, false>(false); // Returns QueryResponse<User>
```

### Column Selection with Type Safety

Create type-safe column selection:

```tsx
// types/column-selection.ts

// Extract column names as literal types
export type ColumnNames<T> = keyof T;

// Create union type from column names
export type UserColumns = ColumnNames<User>; // 'id' | 'email' | 'first_name' | etc.

// Type-safe column selection
export interface ColumnSelectionOptions<T extends Record<string, unknown>> {
  selectColumns?: Array<keyof T | string>; // Allow aliases with string
  filters?: Partial<T>;
  orderBy?: Array<{
    column: keyof T;
    ascending?: boolean;
  }>;
}

// Enhanced query function with column type safety
export function useTypedColumnQuery<
  T extends Record<string, unknown>,
  K extends keyof T
>(
  queries: ReturnType<typeof createPostgRESTQueries<T>>,
  options: {
    selectColumns?: K[];
    filters?: Partial<T>;
  }
) {
  return useQuery({
    ...queries.listWithOptions({
      selectColumns: options.selectColumns as string[],
      filters: options.filters
    }),
    select: (data): Pick<T, K>[] | undefined => {
      // Type-safe data transformation
      return data.data as Pick<T, K>[] | undefined;
    }
  });
}

// Usage with full type safety
function UserList() {
  const { data: users } = useTypedColumnQuery(userQueries, {
    selectColumns: ['id', 'email', 'first_name'], // IntelliSense for column names
    filters: { active: true }
  });
  
  // users is now typed as Pick<User, 'id' | 'email' | 'first_name'>[] | undefined
  users?.forEach(user => {
    console.log(user.id);         // ✅ Available
    console.log(user.email);      // ✅ Available
    console.log(user.first_name); // ✅ Available
    console.log(user.last_name);  // ❌ TypeScript error - not selected
  });
}
```

### RPC Function Type Safety

Create strongly-typed RPC function interfaces:

```tsx
// types/rpc.ts

// Define RPC function signatures
export interface RPCFunctions {
  get_user_stats: {
    args: { user_id: string; period: 'day' | 'week' | 'month' | 'year' };
    returns: {
      posts_count: number;
      comments_count: number;
      likes_received: number;
      followers_count: number;
    };
  };
  
  search_posts: {
    args: {
      query: string;
      category_ids?: string[];
      author_id?: string;
      published_only?: boolean;
      limit?: number;
      offset?: number;
    };
    returns: {
      posts: Post[];
      total_count: number;
      search_time_ms: number;
    };
  };
  
  process_order: {
    args: {
      user_id: string;
      items: Array<{ product_id: string; quantity: number }>;
      payment_method: string;
    };
    returns: {
      order_id: string;
      total_amount: number;
      status: 'pending' | 'confirmed' | 'failed';
    };
  };
}

// Type-safe RPC hook factory
export function createTypedRPCHook<K extends keyof RPCFunctions>(
  functionName: K
) {
  return function useTypedRPC(
    args: RPCFunctions[K]['args'],
    options?: { enabled?: boolean }
  ) {
    return useQuery({
      ...createRPCQuery<RPCFunctions[K]['args'], RPCFunctions[K]['returns']>(
        client,
        functionName,
        args
      ),
      enabled: options?.enabled
    });
  };
}

// Usage with full type safety
const useUserStats = createTypedRPCHook('get_user_stats');
const useSearchPosts = createTypedRPCHook('search_posts');

function UserStatsCard({ userId }: { userId: string }) {
  const { data: stats, isLoading } = useUserStats(
    { user_id: userId, period: 'month' }, // Full IntelliSense for args
    { enabled: !!userId }
  );
  
  // stats.data is fully typed as RPCFunctions['get_user_stats']['returns']
  return (
    <div>
      <p>Posts: {stats?.data?.posts_count}</p>
      <p>Comments: {stats?.data?.comments_count}</p>
    </div>
  );
}
```

## Advanced Typing Patterns

### Discriminated Unions for Multiple Table Types

Handle multiple table types in a single component:

```tsx
// types/table-unions.ts
export type TableData = 
  | { type: 'user'; data: User }
  | { type: 'post'; data: Post }
  | { type: 'category'; data: Category };

// Generic component with discriminated union
function DataDisplay<T extends TableData['type']>({ 
  type, 
  id 
}: { 
  type: T; 
  id: string 
}) {
  const query = useMemo(() => {
    switch (type) {
      case 'user':
        return userQueries.detail(id);
      case 'post':
        return postQueries.detail(id);
      case 'category':
        return categoryQueries.detail(id);
      default:
        throw new Error(`Unknown type: ${type}`);
    }
  }, [type, id]);

  const { data, isLoading } = useQuery(query);

  if (isLoading) return <div>Loading...</div>;

  // TypeScript narrows the type based on the discriminant
  switch (type) {
    case 'user':
      const userData = data?.data as User;
      return <UserCard user={userData} />;
    case 'post':
      const postData = data?.data as Post;
      return <PostCard post={postData} />;
    case 'category':
      const categoryData = data?.data as Category;
      return <CategoryCard category={categoryData} />;
  }
}
```

### Cache Key Type Safety

Create type-safe cache key management:

```tsx
// types/cache.ts
import { createQueryKeys } from '@webcoded/pgrestify/tanstack-query';

// Extend query keys with table-specific methods
export function createTypedQueryKeys<T extends Record<string, unknown>>(
  tableName: string
) {
  const baseKeys = createQueryKeys();
  
  return {
    ...baseKeys,
    
    // Type-safe table operations
    tableList: (filters?: Partial<T>) => 
      baseKeys.tableData(tableName, filters) as const,
    
    tableDetail: (id: T extends { id: infer U } ? U : string) => 
      baseKeys.tableItem(tableName, id as string) as const,
    
    // Custom query patterns
    userPosts: (userId: string) => 
      [...baseKeys.table('posts'), 'by-user', userId] as const,
    
    activeRecords: () => 
      [...baseKeys.table(tableName), 'active-only'] as const,
  };
}

// Usage
const userKeys = createTypedQueryKeys<User>('users');
const postKeys = createTypedQueryKeys<Post>('posts');

function useUserCache() {
  const queryClient = useQueryClient();
  
  const invalidateUserData = (userId: string) => {
    // Type-safe cache invalidation
    queryClient.invalidateQueries({ 
      queryKey: userKeys.tableDetail(userId) 
    });
  };
  
  const invalidateActiveUsers = () => {
    queryClient.invalidateQueries({ 
      queryKey: userKeys.activeRecords() 
    });
  };

  return { invalidateUserData, invalidateActiveUsers };
}
```

### Mutation Type Safety

Create type-safe mutations with proper input/output typing:

```tsx
// hooks/mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationOptions } from '@tanstack/react-query';

// Generic typed mutation hook
export function useTypedMutation<
  TData extends Record<string, unknown>,
  TVariables,
  TError = Error
>(
  mutationFn: (variables: TVariables) => Promise<QueryResponse<TData>>,
  options?: UseMutationOptions<QueryResponse<TData>, TError, TVariables>
) {
  return useMutation<QueryResponse<TData>, TError, TVariables>({
    mutationFn,
    ...options
  });
}

// Specific mutation hooks with full typing
export function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useTypedMutation<User, Partial<User>>(
    async (userData) => {
      const result = await client.from<User>('users').insert(userData).execute();
      if (result.error) throw result.error;
      return result;
    },
    {
      onSuccess: (data) => {
        // data is typed as QueryResponse<User>
        queryClient.invalidateQueries({ queryKey: userKeys.tableList() });
        
        // Add to cache
        if (data.data?.[0]) {
          queryClient.setQueryData(
            userKeys.tableDetail(data.data[0].id),
            data
          );
        }
      }
    }
  );
}

export function useUpdatePost() {
  return useTypedMutation<Post, { id: string; updates: Partial<Post> }>(
    async ({ id, updates }) => {
      const result = await client
        .from<Post>('posts')
        .update(updates)
        .eq('id', id)
        .execute();
      if (result.error) throw result.error;
      return result;
    }
  );
}

// Usage with full type safety
function UserForm() {
  const createUser = useCreateUser();
  const updatePost = useUpdatePost();
  
  const handleSubmit = async (formData: Partial<User>) => {
    try {
      const result = await createUser.mutateAsync(formData);
      // result is fully typed
      console.log('Created user:', result.data?.[0]?.email);
    } catch (error) {
      // error is typed as Error
      console.error('Failed to create user:', error.message);
    }
  };
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit({
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
        active: true,
        role: 'user' // IntelliSense shows valid role values
      });
    }}>
      {/* Form fields */}
    </form>
  );
}
```

## Type Utilities and Helpers

### Schema Type Generation

Generate types from your database schema:

```tsx
// types/database-generated.ts (generated from database schema)

// Utility types for database operations
export type InsertUser = Omit<User, 'id' | 'created_at' | 'updated_at'>;
export type UpdateUser = Partial<Omit<User, 'id' | 'created_at'>>;
export type SelectUser = Partial<User>;

// Relationship types
export type UserWithPosts = User & {
  posts: Post[];
};

export type PostWithAuthor = Post & {
  author: Pick<User, 'id' | 'first_name' | 'last_name' | 'email'>;
};

export type PostWithCategory = Post & {
  category: Pick<Category, 'id' | 'name' | 'slug'>;
};

// Complex relationship types
export type PostWithRelations = Post & {
  author: Pick<User, 'id' | 'first_name' | 'last_name'>;
  category: Pick<Category, 'id' | 'name' | 'slug'>;
  tags: Array<{ id: string; name: string }>;
};

// Helper type for query results
export type QueryResult<T> = {
  data: T[] | null;
  error: Error | null;
  statusCode: number;
};

// Helper type for single query results
export type SingleQueryResult<T> = {
  data: T | null;
  error: Error | null;
  statusCode: number;
};
```

### Custom Type Guards

Create type guards for runtime type checking:

```tsx
// utils/type-guards.ts

// Type guard functions
export function isUser(obj: any): obj is User {
  return obj && 
         typeof obj.id === 'string' &&
         typeof obj.email === 'string' &&
         typeof obj.first_name === 'string' &&
         typeof obj.last_name === 'string' &&
         typeof obj.active === 'boolean' &&
         ['user', 'admin', 'moderator'].includes(obj.role);
}

export function isPost(obj: any): obj is Post {
  return obj &&
         typeof obj.id === 'string' &&
         typeof obj.title === 'string' &&
         typeof obj.content === 'string' &&
         typeof obj.published === 'boolean' &&
         typeof obj.author_id === 'string';
}

export function isQueryResponse<T>(
  obj: any,
  typeGuard: (item: any) => item is T
): obj is QueryResponse<T> {
  return obj &&
         Array.isArray(obj.data) &&
         obj.data.every(typeGuard) &&
         (obj.error === null || obj.error instanceof Error) &&
         typeof obj.statusCode === 'number';
}

// Usage with type narrowing
function DataProcessor({ data }: { data: unknown }) {
  if (isQueryResponse(data, isUser)) {
    // data is now typed as QueryResponse<User>
    data.data?.forEach(user => {
      console.log(user.email); // Full type safety
    });
  } else if (isQueryResponse(data, isPost)) {
    // data is now typed as QueryResponse<Post>
    data.data?.forEach(post => {
      console.log(post.title); // Full type safety
    });
  }
}
```

## Best Practices

### Type Organization

```tsx
// types/index.ts - Central type exports

// Database table types
export type { User, Post, Category } from './database';

// Generated utility types
export type { 
  InsertUser, 
  UpdateUser, 
  UserWithPosts,
  PostWithAuthor 
} from './database-generated';

// Query and mutation types
export type { 
  QueryResult, 
  SingleQueryResult,
  MutationVariables 
} from './queries';

// RPC function types
export type { RPCFunctions } from './rpc';

// Component prop types
export interface UserCardProps {
  user: User;
  showActions?: boolean;
  onEdit?: (user: User) => void;
  onDelete?: (userId: string) => void;
}

export interface PostListProps {
  posts: Post[];
  loading?: boolean;
  onLoadMore?: () => void;
}
```

### Type-Safe Configuration

```tsx
// config/queries.ts - Type-safe query configuration

interface QueryConfig {
  staleTime: number;
  cacheTime: number;
  refetchOnWindowFocus: boolean;
  retry: number | ((failureCount: number, error: Error) => boolean);
}

const queryConfigs: Record<string, QueryConfig> = {
  user: {
    staleTime: 5 * 60 * 1000,      // 5 minutes
    cacheTime: 15 * 60 * 1000,     // 15 minutes
    refetchOnWindowFocus: false,
    retry: 3
  },
  post: {
    staleTime: 2 * 60 * 1000,      // 2 minutes
    cacheTime: 10 * 60 * 1000,     // 10 minutes
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      return failureCount < 2 && !error.message.includes('404');
    }
  },
  realtime: {
    staleTime: 30 * 1000,          // 30 seconds
    cacheTime: 2 * 60 * 1000,      // 2 minutes
    refetchOnWindowFocus: true,
    retry: 1
  }
} as const;

export function getQueryConfig(type: keyof typeof queryConfigs): QueryConfig {
  return queryConfigs[type];
}
```

## Summary

PGRestify's TypeScript integration with TanStack Query provides comprehensive type safety throughout your application:

- **Complete Type Coverage**: From database types to query results and cache operations
- **Developer Experience**: Full IntelliSense, autocompletion, and compile-time error checking
- **Type Inference**: Automatic type inference reduces boilerplate while maintaining safety
- **Generic Patterns**: Reusable, type-safe query and mutation patterns
- **Runtime Safety**: Type guards and validation for robust error handling
- **Scalable Architecture**: Well-organized type definitions that grow with your application

These TypeScript features help you build robust, maintainable React applications with confidence in your data layer's type safety.