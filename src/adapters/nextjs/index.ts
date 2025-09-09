/**
 * Next.js adapter for PGRestify
 * 
 * Provides optimized integration for both Pages Router and App Router architectures.
 * Includes SSR/SSG support, authentication helpers, and performance optimizations.
 * 
 * @example
 * ```tsx
 * // lib/client.ts
 * import { createNextJSClient } from 'pgrestify/nextjs';
 * 
 * export const client = createNextJSClient({
 *   url: process.env.NEXT_PUBLIC_POSTGREST_URL!,
 *   auth: {
 *     persistSession: true,
 *     autoRefreshToken: true
 *   }
 * });
 * 
 * // pages/users.tsx (Pages Router)
 * import { getServerSideProps } from 'pgrestify/nextjs';
 * 
 * export default function UsersPage({ users }) {
 *   return (
 *     <div>
 *       {users.map(user => <div key={user.id}>{user.name}</div>)}
 *     </div>
 *   );
 * }
 * 
 * export const getServerSideProps = createGetServerSideProps(async ({ client }) => {
 *   const users = await client.from('users').select('*').execute();
 *   return { props: { users: users.data } };
 * });
 * 
 * // app/users/page.tsx (App Router)
 * import { createServerClient } from 'pgrestify/nextjs';
 * 
 * export default async function UsersPage() {
 *   const client = createServerClient();
 *   const users = await client.from('users').select('*').execute();
 *   
 *   return (
 *     <div>
 *       {users.data?.map(user => <div key={user.id}>{user.name}</div>)}
 *     </div>
 *   );
 * }
 * ```
 */

// Core Next.js client creation
export { createNextJSClient, createServerClient, createClientClient } from './client';

// Data fetching helpers
export { 
  createGetServerSideProps,
  createGetStaticProps,
  withPGRestify 
} from './data-fetching';

// Server components and utilities
export {
  PGRestifyServerProvider,
  usePGRestifyServer,
  createServerAction,
  createRouteHandler
} from './server';

// Client components and hooks
export {
  PGRestifyClientProvider,
  usePGRestifyClient,
  useServerData,
  useOptimisticUpdate
} from './client-components';

// Authentication utilities
export {
  createAuthMiddleware,
  withAuth,
  getServerSession,
  useSession
} from './auth';

// Caching and performance
export {
  createCacheStrategy,
  usePGRestifyCache,
  revalidateTag,
  unstable_cache
} from './cache';

// Types
export type {
  NextJSClientConfig,
  GetServerSidePropsContext,
  GetStaticPropsContext,
  ServerComponentProps,
  AuthMiddlewareConfig,
  CacheStrategy,
  RouterType
} from './types';