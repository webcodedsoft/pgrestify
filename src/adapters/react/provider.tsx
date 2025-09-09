/**
 * React Provider for PGRestify
 */

import React, { createContext, useContext, ReactNode } from 'react';
import type { PostgRESTClient } from '../../types';

// Runtime check for React availability
if (typeof React === 'undefined') {
  throw new Error(
    'PGRestify React adapter requires React to be installed. ' +
    'Please install React: npm install react'
  );
}

interface PGRestifyContextValue {
  client: PostgRESTClient;
}

const PGRestifyContext = createContext<PGRestifyContextValue | null>(null);

export interface PGRestifyProviderProps {
  /** PGRestify client instance */
  client: PostgRESTClient;
  /** Child components */
  children: ReactNode;
}

/**
 * Provider component that makes PGRestify client available to all hooks
 */
export function PGRestifyProvider({ client, children }: PGRestifyProviderProps) {
  const value: PGRestifyContextValue = {
    client,
  };

  return (
    <PGRestifyContext.Provider value={value}>
      {children}
    </PGRestifyContext.Provider>
  );
}

/**
 * Hook to get the PGRestify client from context
 */
export function usePGRestifyClient(): PostgRESTClient {
  const context = useContext(PGRestifyContext);
  
  if (!context) {
    throw new Error(
      'usePGRestifyClient must be used within a PGRestifyProvider. ' +
      'Make sure to wrap your app with <PGRestifyProvider client={client}>.'
    );
  }
  
  return context.client;
}

/**
 * Higher-order component that provides PGRestify client
 */
export function withPGRestify<P extends object>(
  Component: React.ComponentType<P & { client: PostgRESTClient }>
) {
  const WrappedComponent = (props: P) => {
    const client = usePGRestifyClient();
    return <Component {...props} client={client} />;
  };

  WrappedComponent.displayName = `withPGRestify(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}