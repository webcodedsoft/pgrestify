/**
 * React adapter for PGRestify
 * 
 * @example
 * ```tsx
 * import { PGRestifyProvider, useQuery, useMutation, MutationOperation } from 'pgrestify/react';
 * import { createClient } from 'pgrestify';
 * 
 * const client = createClient({ url: 'http://localhost:3000' });
 * 
 * function App() {
 *   return (
 *     <PGRestifyProvider client={client}>
 *       <UserList />
 *     </PGRestifyProvider>
 *   );
 * }
 * 
 * function UserList() {
 *   const { data: users, loading, error } = useQuery({
 *     from: 'users',
 *     select: '*',
 *     filter: { active: true }
 *   });
 * 
 *   // Type-safe mutation with operation
 *   const { mutate: createUser } = useMutation('users', {
 *     operation: MutationOperation.INSERT,
 *     onSuccess: () => console.log('User created!')
 *   });
 * 
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 * 
 *   return (
 *     <div>
 *       {users?.map(user => (
 *         <div key={user.id}>{user.name}</div>
 *       ))}
 *       <button onClick={() => createUser({ name: 'New User', email: 'new@example.com' })}>
 *         Add User
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

// Provider and context
export { PGRestifyProvider, usePGRestifyClient, withPGRestify } from './provider';

// Context-aware hooks (recommended - automatically use client from context)
export {
  useQuery,
  useQueryLegacy,
  useSingleQuery,
  useInfiniteQuery, // Context-aware version
  useMutation,
  useInsert,
  useUpdate,
  useDelete,
  useUpsert,
  useAuth,
  useRealtimeSubscription,
  useClient,
  useRepository,
  useRawQuery,
  useRawMutation,
  useQueryBuilder,
} from './context-hooks';

// Additional infinite query hooks (TanStack Query compatible - require provider)
export {
  useInfinitePosts,
  useInfiniteComments,
  useInfiniteUsers,
  useInfiniteSearch,
  useInfiniteFeed,
} from '../../query/react/hooks/useInfiniteQuery';

// Additional type exports  
export type {
  QueryConfig,
  InfiniteQueryConfig,
  MutationOperationType,
  PaginationType,
} from './context-hooks';

// Mutation operation enum
export {
  MutationOperation,
} from './context-hooks';

// Base hooks (require client parameter - for advanced usage)
export {
  useQuery as useQueryWithClient,
  useSingleQuery as useSingleQueryWithClient,
  useMutation as useMutationWithClient,
  useInsert as useInsertWithClient,
  useUpdate as useUpdateWithClient,
  useDelete as useDeleteWithClient,
  useUpsert as useUpsertWithClient,
  useAuth as useAuthWithClient,
  useRealtimeSubscription as useRealtimeSubscriptionWithClient,
  useClient as useClientWithClient,
  useRawQuery as useRawQueryWithClient,
  useRawMutation as useRawMutationWithClient,
  useQueryBuilder as useQueryBuilderWithClient,
} from './hooks';

// Types
export type {
  UseQueryOptions,
  UseQueryResult,
  UseSingleQueryResult,
  UseMutationOptions,
  UseMutationResult,
} from './hooks';

export type {
  UseTanStackInfiniteQueryOptions,
  UseTableInfiniteQueryOptions,
  UseStandardInfiniteQueryOptions,
  UseInfiniteQueryResult,
  InfiniteData,
} from '../../query/react/hooks/useInfiniteQuery';

export type {
  UseTanStackQueryOptions,
} from '../../query/react/hooks/useQuery';

export type { PGRestifyProviderProps } from './provider';