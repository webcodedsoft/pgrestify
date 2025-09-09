/**
 * Next.js client-side components and hooks
 */

'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { createClientClient } from './client';
import { isServer } from './utils';
import type { 
  NextJSClientConfig,
  OptimisticUpdateOptions
} from './types';
import type { PostgRESTClient } from '../../types';

// Client Context
const PGRestifyClientContext = createContext<PostgRESTClient | null>(null);

/**
 * Client Provider for App Router (Client Components only)
 */
export function PGRestifyClientProvider({ 
  children,
  config 
}: { 
  children: React.ReactNode;
  config?: Partial<NextJSClientConfig>;
}) {
  const [client] = useState(() => {
    if (isServer()) {
      return null; // Don't create client on server
    }
    return createClientClient(config);
  });

  if (isServer()) {
    // Return children without context on server
    return <>{children}</>;
  }

  return (
    <PGRestifyClientContext.Provider value={client}>
      {children}
    </PGRestifyClientContext.Provider>
  );
}

/**
 * Hook to access the PGRestify client from context
 */
export function usePGRestifyClient(): PostgRESTClient {
  const client = useContext(PGRestifyClientContext);
  
  if (!client) {
    throw new Error(
      'usePGRestifyClient must be used within a PGRestifyClientProvider or ' +
      'called in a Client Component with proper Next.js configuration'
    );
  }
  
  return client;
}

/**
 * Hook for hydrating server data on the client
 */
export function useServerData<T>(
  key: string,
  fallbackData?: T
): [T | null, (data: T) => void] {
  const [data, setData] = useState<T | null>(() => {
    if (isServer()) return null;
    
    // Try to get data from Next.js __NEXT_DATA__
    try {
      const nextData = (globalThis as any).__NEXT_DATA__;
      const serverData = nextData?.props?.pageProps?.[key] || 
                        nextData?.props?.[key];
      return serverData || fallbackData || null;
    } catch {
      return fallbackData || null;
    }
  });

  const updateData = useCallback((newData: T) => {
    setData(newData);
  }, []);

  return [data, updateData];
}

/**
 * Hook for optimistic updates in App Router
 */
export function useOptimisticUpdate<T>(
  initialData: T[],
  options: OptimisticUpdateOptions<T>
): [T[], (newData: T) => Promise<void>] {
  const [data, setData] = useState(initialData);
  const [isUpdating, setIsUpdating] = useState(false);

  const optimisticUpdate = useCallback(async (newData: T) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    
    // Apply optimistic update
    const optimisticData = options.updateFn(data, newData);
    setData(optimisticData);
    
    try {
      // Perform actual update (this would be implemented by the caller)
      // The caller should handle the actual API call
      
      setIsUpdating(false);
    } catch (error) {
      // Rollback on error
      if (options.rollbackFn) {
        const rolledBackData = options.rollbackFn(optimisticData, error as Error);
        setData(rolledBackData);
      } else {
        setData(initialData); // Simple rollback
      }
      
      setIsUpdating(false);
      throw error;
    }
  }, [data, isUpdating, options, initialData]);

  return [data, optimisticUpdate];
}