/**
 * Next.js App Router server-side utilities
 */

import { createServerClient } from './client';
import { isServer } from './utils';
import type { PostgRESTClient } from '../../types';
import type { 
  NextJSClientConfig,
  RouteHandlerContext,
  ServerActionContext
} from './types';

/**
 * Server Provider for App Router (Server Components only)
 */
export function PGRestifyServerProvider({ 
  children
}: { 
  children: React.ReactNode;
  config?: Partial<NextJSClientConfig>;
}) {
  if (!isServer()) {
    throw new Error('PGRestifyServerProvider can only be used in Server Components');
  }

  // Server components don't need a provider pattern like client components
  // This is mainly for consistency and future server context features
  return <>{children}</>;
}

/**
 * Hook for accessing PGRestify client in Server Components
 */
export function usePGRestifyServer(config?: Partial<NextJSClientConfig>): PostgRESTClient {
  if (!isServer()) {
    throw new Error('usePGRestifyServer can only be used in Server Components');
  }

  return createServerClient(config);
}

/**
 * Creates a Server Action with PGRestify integration
 */
export function createServerAction<T = any, R = any>(
  handler: (context: ServerActionContext<T>, client: PostgRESTClient) => Promise<R>,
  clientConfig?: Partial<NextJSClientConfig>
) {
  return async (formData: FormData) => {
    'use server';
    
    const client = createServerClient(clientConfig);
    
    // Parse form data
    const data = Object.fromEntries(formData.entries()) as T;
    
    const context: ServerActionContext<T> = {
      formData,
      data
    };

    try {
      return await handler(context, client);
    } catch (error) {
      console.error('Server Action error:', error);
      throw error;
    }
  };
}

/**
 * Creates a Route Handler with PGRestify integration
 */
export function createRouteHandler(
  handlers: {
    GET?: (request: Request, context: RouteHandlerContext, client: PostgRESTClient) => Promise<Response>;
    POST?: (request: Request, context: RouteHandlerContext, client: PostgRESTClient) => Promise<Response>;
    PUT?: (request: Request, context: RouteHandlerContext, client: PostgRESTClient) => Promise<Response>;
    DELETE?: (request: Request, context: RouteHandlerContext, client: PostgRESTClient) => Promise<Response>;
    PATCH?: (request: Request, context: RouteHandlerContext, client: PostgRESTClient) => Promise<Response>;
  },
  clientConfig?: Partial<NextJSClientConfig>
) {
  const createHandler = (handler: any) => async (request: Request, context: RouteHandlerContext) => {
    const client = createServerClient(clientConfig);
    
    try {
      return await handler(request, context, client);
    } catch (error) {
      console.error('Route Handler error:', error);
      
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };

  const routeHandlers: any = {};
  
  if (handlers.GET) routeHandlers.GET = createHandler(handlers.GET);
  if (handlers.POST) routeHandlers.POST = createHandler(handlers.POST);
  if (handlers.PUT) routeHandlers.PUT = createHandler(handlers.PUT);
  if (handlers.DELETE) routeHandlers.DELETE = createHandler(handlers.DELETE);
  if (handlers.PATCH) routeHandlers.PATCH = createHandler(handlers.PATCH);

  return routeHandlers;
}