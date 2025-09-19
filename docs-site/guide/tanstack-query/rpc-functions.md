# RPC Functions

PGRestify provides comprehensive support for calling PostgreSQL functions (stored procedures) through PostgREST's RPC (Remote Procedure Call) interface. The TanStack Query integration makes it easy to call these functions with proper caching, error handling, and type safety.

## Overview

PostgreSQL functions (stored procedures) are powerful database features that allow you to:

- **Execute complex business logic** directly in the database
- **Perform atomic operations** with multiple table interactions
- **Implement custom aggregations** and calculations
- **Handle authentication and authorization** logic
- **Process bulk operations** efficiently
- **Return custom data structures** with computed fields

## Basic RPC Function Calls

### Simple Function Call

Call a PostgreSQL function without arguments:

```tsx
import { useQuery } from '@tanstack/react-query';
import { createRPCQuery } from '@webcoded/pgrestify/tanstack-query';
import { createClient } from '@webcoded/pgrestify';

const client = createClient({ url: 'http://localhost:3000' });

// PostgreSQL function: get_total_users()
function TotalUsersWidget() {
  const { data: result, isLoading } = useQuery({
    ...createRPCQuery(client, 'get_total_users')
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="stat-card">
      <h3>Total Users</h3>
      <p className="stat-number">{result?.data}</p>
    </div>
  );
}
```

### Function Call with Arguments

Call a PostgreSQL function with typed arguments:

```tsx
interface GetUserStatsArgs {
  user_id: string;
  period: 'day' | 'week' | 'month' | 'year';
}

interface UserStats {
  posts_count: number;
  comments_count: number;
  likes_received: number;
  followers_count: number;
}

function UserStatsCard({ userId }: { userId: string }) {
  const { data: stats, isLoading } = useQuery({
    ...createRPCQuery<GetUserStatsArgs, UserStats>(
      client, 
      'get_user_stats', 
      { user_id: userId, period: 'month' }
    )
  });

  if (isLoading) return <div>Loading stats...</div>;

  return (
    <div className="stats-grid">
      <div className="stat">
        <span className="label">Posts</span>
        <span className="value">{stats?.data?.posts_count || 0}</span>
      </div>
      <div className="stat">
        <span className="label">Comments</span>
        <span className="value">{stats?.data?.comments_count || 0}</span>
      </div>
      <div className="stat">
        <span className="label">Likes</span>
        <span className="value">{stats?.data?.likes_received || 0}</span>
      </div>
      <div className="stat">
        <span className="label">Followers</span>
        <span className="value">{stats?.data?.followers_count || 0}</span>
      </div>
    </div>
  );
}
```

## Advanced RPC Patterns

### Dynamic Function Arguments

Create reusable RPC queries with dynamic arguments:

```tsx
function useUserAnalytics(userId: string, period: string) {
  return useQuery({
    ...createRPCQuery<GetUserStatsArgs, UserStats>(
      client, 
      'get_user_stats', 
      { user_id: userId, period: period as 'day' | 'week' | 'month' | 'year' }
    ),
    enabled: !!userId, // Only run when userId is available
    staleTime: 10 * 60 * 1000, // 10 minutes cache
  });
}

function AnalyticsDashboard({ userId }: { userId: string }) {
  const [period, setPeriod] = useState<string>('month');
  
  const { data: stats, isLoading, refetch } = useUserAnalytics(userId, period);

  return (
    <div>
      <div className="period-selector">
        <button 
          onClick={() => setPeriod('day')}
          className={period === 'day' ? 'active' : ''}
        >
          Day
        </button>
        <button 
          onClick={() => setPeriod('week')}
          className={period === 'week' ? 'active' : ''}
        >
          Week
        </button>
        <button 
          onClick={() => setPeriod('month')}
          className={period === 'month' ? 'active' : ''}
        >
          Month
        </button>
        <button 
          onClick={() => setPeriod('year')}
          className={period === 'year' ? 'active' : ''}
        >
          Year
        </button>
      </div>
      
      {isLoading ? (
        <div>Loading analytics...</div>
      ) : (
        <UserStatsCard stats={stats?.data} />
      )}
      
      <button onClick={() => refetch()}>Refresh Stats</button>
    </div>
  );
}
```

### Complex Data Transformations

Handle RPC functions that return complex data structures:

```tsx
interface SearchArgs {
  query: string;
  filters?: {
    category?: string;
    min_price?: number;
    max_price?: number;
    tags?: string[];
  };
  sort_by?: string;
  limit?: number;
  offset?: number;
}

interface SearchResult {
  items: {
    id: string;
    title: string;
    description: string;
    price: number;
    category: string;
    tags: string[];
    relevance_score: number;
  }[];
  total_count: number;
  facets: {
    categories: { name: string; count: number }[];
    price_ranges: { min: number; max: number; count: number }[];
    popular_tags: { tag: string; count: number }[];
  };
  search_time_ms: number;
}

function useAdvancedSearch(searchParams: SearchArgs) {
  return useQuery({
    ...createRPCQuery<SearchArgs, SearchResult>(
      client,
      'advanced_search',
      searchParams
    ),
    enabled: !!searchParams.query && searchParams.query.length >= 2,
    staleTime: 2 * 60 * 1000, // 2 minutes - search results change frequently
  });
}

function SearchResults({ query, filters }: { query: string; filters: any }) {
  const { data: results, isLoading, isError, error } = useAdvancedSearch({
    query,
    filters,
    limit: 20,
    offset: 0
  });

  if (isLoading) return <SearchSkeleton />;
  if (isError) return <div>Search error: {error?.message}</div>;
  if (!results?.data) return <div>No results found</div>;

  const { items, total_count, facets, search_time_ms } = results.data;

  return (
    <div className="search-results">
      <div className="search-meta">
        <p>Found {total_count} results in {search_time_ms}ms</p>
      </div>
      
      <div className="results-grid">
        <div className="facets">
          <h3>Categories</h3>
          {facets.categories.map(cat => (
            <div key={cat.name}>
              {cat.name} ({cat.count})
            </div>
          ))}
        </div>
        
        <div className="items">
          {items.map(item => (
            <div key={item.id} className="search-item">
              <h4>{item.title}</h4>
              <p>{item.description}</p>
              <div className="item-meta">
                <span className="price">${item.price}</span>
                <span className="relevance">Score: {item.relevance_score}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

## RPC Mutations

### Using RPC Functions for Data Modification

Some operations are better handled as stored procedures rather than simple CRUD:

```tsx
interface ProcessOrderArgs {
  user_id: string;
  items: { product_id: string; quantity: number }[];
  payment_method: string;
  shipping_address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
}

interface OrderResult {
  order_id: string;
  total_amount: number;
  estimated_delivery: string;
  tracking_number: string;
}

function useProcessOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderData: ProcessOrderArgs): Promise<QueryResponse<OrderResult>> => {
      const result = await client.rpc<ProcessOrderArgs, OrderResult>(
        'process_order', 
        orderData
      ).execute();
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      return result;
    },
    
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ 
        queryKey: ['pgrestify', 'tables', 'orders'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['pgrestify', 'tables', 'cart'] 
      });
      
      // Update user stats
      queryClient.invalidateQueries({ 
        queryKey: ['pgrestify', 'rpc', 'get_user_stats'] 
      });
    },
    
    onError: (error) => {
      console.error('Order processing failed:', error);
      // Handle specific error types
      if (error.message.includes('insufficient_inventory')) {
        // Handle inventory error
      } else if (error.message.includes('payment_failed')) {
        // Handle payment error
      }
    }
  });
}

function CheckoutForm({ cartItems, userId }: { cartItems: any[]; userId: string }) {
  const processOrder = useProcessOrder();
  
  const handleSubmit = async (formData: any) => {
    try {
      const result = await processOrder.mutateAsync({
        user_id: userId,
        items: cartItems.map(item => ({
          product_id: item.id,
          quantity: item.quantity
        })),
        payment_method: formData.paymentMethod,
        shipping_address: formData.shippingAddress
      });
      
      // Redirect to success page
      router.push(`/order-confirmation/${result.data?.order_id}`);
      
    } catch (error) {
      // Error handled by mutation's onError
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button 
        type="submit" 
        disabled={processOrder.isPending}
      >
        {processOrder.isPending ? 'Processing...' : 'Place Order'}
      </button>
    </form>
  );
}
```

### Batch Operations with RPC

Handle batch operations efficiently:

```tsx
interface BatchUpdateArgs {
  updates: {
    id: string;
    values: Record<string, any>;
  }[];
}

interface BatchUpdateResult {
  updated_count: number;
  failed_updates: { id: string; error: string }[];
  success_ids: string[];
}

function useBatchUpdateUsers() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (batchData: BatchUpdateArgs): Promise<QueryResponse<BatchUpdateResult>> => {
      const result = await client.rpc<BatchUpdateArgs, BatchUpdateResult>(
        'batch_update_users',
        batchData
      ).execute();
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      return result;
    },
    
    onSuccess: (data, variables) => {
      // Optimistic updates for successful items
      data.data?.success_ids.forEach(id => {
        const update = variables.updates.find(u => u.id === id);
        if (update) {
          queryClient.setQueryData(
            ['pgrestify', 'tables', 'users', 'item', id],
            (oldData: any) => {
              if (!oldData) return oldData;
              return {
                ...oldData,
                data: { ...oldData.data, ...update.values }
              };
            }
          );
        }
      });
      
      // Invalidate user list
      queryClient.invalidateQueries({ 
        queryKey: ['pgrestify', 'tables', 'users', 'data'] 
      });
    }
  });
}

function BulkUserEditor({ selectedUsers }: { selectedUsers: User[] }) {
  const batchUpdate = useBatchUpdateUsers();
  
  const handleBulkUpdate = async (commonUpdates: Partial<User>) => {
    const updates = selectedUsers.map(user => ({
      id: user.id,
      values: commonUpdates
    }));
    
    const result = await batchUpdate.mutateAsync({ updates });
    
    if (result.data?.failed_updates.length) {
      console.warn('Some updates failed:', result.data.failed_updates);
      // Show partial success message
    }
  };

  return (
    <div>
      <h3>Bulk Edit {selectedUsers.length} Users</h3>
      {/* Bulk edit form */}
      <button 
        onClick={() => handleBulkUpdate({ active: true })}
        disabled={batchUpdate.isPending}
      >
        Activate All Selected
      </button>
    </div>
  );
}
```

## Caching RPC Results

### RPC-Specific Cache Management

```tsx
import { createQueryKeys } from '@webcoded/pgrestify/tanstack-query';

const keys = createQueryKeys();

function useRPCCacheManagement() {
  const queryClient = useQueryClient();
  
  const invalidateRPCCache = (functionName: string, args?: Record<string, unknown>) => {
    queryClient.invalidateQueries({ 
      queryKey: keys.rpc(functionName, args) 
    });
  };
  
  const invalidateAllRPC = () => {
    queryClient.invalidateQueries({ 
      queryKey: [...keys.all(), 'rpc'] 
    });
  };
  
  const preloadRPCData = async (functionName: string, args?: Record<string, unknown>) => {
    await queryClient.prefetchQuery({
      ...createRPCQuery(client, functionName, args),
      staleTime: 10 * 60 * 1000 // 10 minutes
    });
  };

  return { invalidateRPCCache, invalidateAllRPC, preloadRPCData };
}

// Usage example
function DashboardPage() {
  const { preloadRPCData } = useRPCCacheManagement();
  
  useEffect(() => {
    // Preload dashboard data
    preloadRPCData('get_dashboard_stats');
    preloadRPCData('get_recent_activities', { limit: 10 });
  }, [preloadRPCData]);

  return <DashboardContent />;
}
```

### Cache Dependencies

Handle cache dependencies between RPC calls and regular queries:

```tsx
function useOrderProcessing() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderData: ProcessOrderArgs) => {
      return await client.rpc<ProcessOrderArgs, OrderResult>(
        'process_order',
        orderData
      ).execute();
    },
    
    onSuccess: (data, variables) => {
      // Invalidate all related data
      const invalidations = [
        // User-specific data
        keys.rpc('get_user_stats', { user_id: variables.user_id }),
        keys.rpc('get_user_orders', { user_id: variables.user_id }),
        
        // Product inventory data
        ...variables.items.map(item => 
          keys.table('products').concat(['item', item.product_id])
        ),
        
        // General stats
        keys.rpc('get_dashboard_stats'),
        keys.table('orders'),
        keys.table('order_items')
      ];
      
      invalidations.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });
      
      // Update cart to empty state
      queryClient.setQueryData(
        keys.table('cart').concat(['data', { user_id: variables.user_id }]),
        { data: [], error: null, statusCode: 200 }
      );
    }
  });
}
```

## Error Handling for RPC Functions

### PostgreSQL Function Error Handling

```tsx
function useRPCWithErrorHandling<TArgs, TReturn>(
  functionName: string, 
  args?: TArgs
) {
  return useQuery({
    ...createRPCQuery<TArgs, TReturn>(client, functionName, args),
    
    retry: (failureCount, error) => {
      // Don't retry certain PostgreSQL errors
      if (error.message.includes('function does not exist')) {
        return false; // Function doesn't exist
      }
      if (error.message.includes('insufficient_privileges')) {
        return false; // Permission error
      }
      if (error.message.includes('invalid_parameter')) {
        return false; // Invalid arguments
      }
      
      // Retry server errors up to 3 times
      return failureCount < 3;
    },
    
    onError: (error) => {
      // Log RPC-specific errors
      console.error(`RPC ${functionName} failed:`, {
        error: error.message,
        args,
        timestamp: new Date().toISOString()
      });
      
      // Handle specific function errors
      if (error.message.includes('business_rule_violation')) {
        // Show user-friendly message for business rule violations
        toast.error('Operation not allowed due to business rules');
      }
    }
  });
}

// Usage with error handling
function ReportGenerator({ reportType }: { reportType: string }) {
  const { data, isLoading, isError, error } = useRPCWithErrorHandling<
    { report_type: string; date_range: string },
    { report_data: any[]; summary: any }
  >('generate_report', {
    report_type: reportType,
    date_range: 'last_30_days'
  });

  if (isError) {
    if (error?.message.includes('insufficient_data')) {
      return <div>Not enough data to generate this report</div>;
    }
    return <div>Error generating report: {error?.message}</div>;
  }

  if (isLoading) return <ReportSkeleton />;

  return <ReportDisplay data={data?.data} />;
}
```

## Common PostgreSQL Function Patterns

### Authentication and Authorization Functions

```tsx
// Login function
interface LoginArgs {
  email: string;
  password: string;
}

interface LoginResult {
  token: string;
  user: User;
  expires_at: string;
}

function useLogin() {
  return useMutation({
    mutationFn: async (credentials: LoginArgs): Promise<QueryResponse<LoginResult>> => {
      return await client.rpc<LoginArgs, LoginResult>('authenticate_user', credentials).execute();
    },
    
    onSuccess: (data) => {
      if (data.data) {
        // Store auth token
        localStorage.setItem('auth_token', data.data.token);
        // Redirect or update auth state
      }
    }
  });
}

// Permission check function
interface CheckPermissionArgs {
  user_id: string;
  resource: string;
  action: string;
}

function usePermissionCheck(userId: string, resource: string, action: string) {
  return useQuery({
    ...createRPCQuery<CheckPermissionArgs, boolean>(
      client,
      'check_permission',
      { user_id: userId, resource, action }
    ),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Cache permissions for 5 minutes
  });
}
```

### Analytics and Reporting Functions

```tsx
interface AnalyticsArgs {
  metric: string;
  start_date: string;
  end_date: string;
  granularity: 'hour' | 'day' | 'week' | 'month';
  filters?: Record<string, any>;
}

interface AnalyticsResult {
  data_points: { timestamp: string; value: number }[];
  total: number;
  change_percent: number;
  trend: 'up' | 'down' | 'stable';
}

function useAnalytics(params: AnalyticsArgs) {
  return useQuery({
    ...createRPCQuery<AnalyticsArgs, AnalyticsResult>(
      client,
      'get_analytics_data',
      params
    ),
    staleTime: 10 * 60 * 1000, // 10 minutes cache for analytics
    select: (data) => ({
      ...data,
      data: data.data ? {
        ...data.data,
        // Transform data for charting
        chartData: data.data.data_points.map(point => ({
          x: new Date(point.timestamp),
          y: point.value
        }))
      } : null
    })
  });
}
```

## Summary

PGRestify's RPC function support with TanStack Query provides a powerful way to leverage PostgreSQL's stored procedures in your React applications. This integration offers:

- **Type-safe function calls** with full TypeScript support
- **Automatic caching** with customizable cache strategies
- **Error handling** optimized for PostgreSQL function errors
- **Mutation support** for data-modifying functions
- **Cache management** with smart invalidation strategies
- **Performance optimization** through pre-loading and caching

Use RPC functions for complex business logic, batch operations, analytics, authentication, and any operations that benefit from database-side processing.