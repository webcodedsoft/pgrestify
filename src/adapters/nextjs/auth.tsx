/**
 * Next.js authentication utilities
 */

import React from 'react';
import { createServerClient } from './client';
import { isServer } from './utils';
import type { 
  AuthMiddlewareConfig,
  NextJSClientConfig
} from './types';

/**
 * Creates authentication middleware for Next.js
 * Returns a middleware function that can be used in middleware.ts
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  return async (request: any): Promise<Response | void> => {
    try {
      const url = request.nextUrl || new URL(request.url);
      const pathname = url.pathname;
      
      // Skip auth for public paths
      if (config.publicPaths?.some(path => pathname.startsWith(path))) {
        return;
      }
      
      // Check if path requires authentication
      const requiresAuth = config.protectedPaths?.some(path => pathname.startsWith(path));
      
      if (!requiresAuth) {
        return;
      }
      
      // Custom auth validation
      if (config.validateAuth) {
        const isAuthenticated = await config.validateAuth(request);
        
        if (!isAuthenticated) {
          const signInUrl = config.signInUrl || '/auth/signin';
          return Response.redirect(new URL(signInUrl, request.url).toString());
        }
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
    }
  };
}

/**
 * Higher-order component that requires authentication
 */
export function withAuth<P extends object = any>(
  Component: React.ComponentType<P>,
  options?: {
    redirectTo?: string;
    loadingComponent?: React.ComponentType;
  }
) {
  const AuthenticatedComponent = (props: P) => {
    const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);
    
    React.useEffect(() => {
      // Check authentication status
      const checkAuth = async () => {
        try {
          const client = createServerClient();
          const session = await client.auth.getSession();
          setIsAuthenticated(!!session?.user);
        } catch {
          setIsAuthenticated(false);
        }
      };
      
      checkAuth();
    }, []);
    
    if (isAuthenticated === null) {
      return options?.loadingComponent ? <options.loadingComponent /> : <div>Loading...</div>;
    }
    
    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = options?.redirectTo || '/auth/signin';
      }
      return null;
    }
    
    return <Component {...props} />;
  };
  
  AuthenticatedComponent.displayName = `withAuth(${Component.displayName || Component.name})`;
  
  return AuthenticatedComponent;
}

/**
 * Gets the current session on the server
 */
export async function getServerSession(clientConfig?: Partial<NextJSClientConfig>) {
  if (!isServer()) {
    throw new Error('getServerSession can only be used on the server');
  }
  
  const client = createServerClient(clientConfig);
  
  try {
    const session = await client.auth.getSession();
    return session;
  } catch {
    return null;
  }
}

/**
 * Hook for session management in client components
 */
export function useSession() {
  const [session, setSession] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  
  React.useEffect(() => {
    const client = createServerClient();
    
    const loadSession = async () => {
      try {
        const currentSession = await client.auth.getSession();
        setSession(currentSession);
      } catch {
        setSession(null);
      } finally {
        setLoading(false);
      }
    };
    
    loadSession();
    
    // Listen for auth changes
    let subscription: any;
    try {
      subscription = client.auth.onAuthStateChange((session: any) => {
        setSession(session);
        setLoading(false);
      });
    } catch {
      // Auth change listener not available
    }
    
    return () => {
      subscription?.unsubscribe?.();
    };
  }, []);
  
  return { session, loading };
}