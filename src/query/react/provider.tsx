/**
 * PGRestify React Provider
 * Context provider for the PGRestify client
 */

import React, { createContext, useContext, useRef, useEffect, useState } from 'react';
import type { PGRestifyClient } from '../core/types';

/**
 * Context for PGRestify client
 */
const PGRestifyContext = createContext<PGRestifyClient | undefined>(undefined);

/**
 * Context for SSR/hydration handling
 */
const PGRestifySSRContext = createContext<{
  isHydrating: boolean;
  setIsHydrating: (value: boolean) => void;
}>({
  isHydrating: false,
  setIsHydrating: () => {},
});

/**
 * Props for PGRestifyProvider
 */
export interface PGRestifyProviderProps {
  client: PGRestifyClient;
  children: React.ReactNode;
  
  // SSR options
  contextSharing?: boolean;
  
  // Error boundary options
  resetErrorBoundaryOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
  
  // Dev options
  devtools?: {
    enabled?: boolean;
    initialIsOpen?: boolean;
  };
}

/**
 * Provider component for PGRestify
 * Provides the client instance to all child components
 */
export function PGRestifyProvider({
  client,
  children,
  contextSharing = false,
  resetErrorBoundaryOnPropsChange = true,
  resetKeys,
  devtools,
}: Readonly<PGRestifyProviderProps>) {
  const clientRef = useRef(client);
  const [isHydrating, setIsHydrating] = useState(
    // Check if we're in a hydration environment
    typeof window !== 'undefined' && 
    typeof window.__PGRESTIFY_SSR_STATE__ !== 'undefined'
  );

  // Update client ref if client changes
  if (client !== clientRef.current) {
    clientRef.current = client;
  }

  // Mount/unmount client
  useEffect(() => {
    const currentClient = clientRef.current;
    currentClient.mount();
    
    return () => {
      currentClient.unmount();
    };
  }, []);

  // Handle hydration
  useEffect(() => {
    if (isHydrating) {
      // Hydrate the client with SSR state
      const ssrState = (window as any).__PGRESTIFY_SSR_STATE__;
      if (ssrState) {
        (client as any).hydrate?.(ssrState);
      }
      setIsHydrating(false);
    }
  }, [client, isHydrating]);

  // Setup devtools in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && devtools?.enabled !== false) {
      // PGRestify devtools will be implemented here
      // For now, devtools are disabled
      console.log('PGRestify devtools will be available in a future release');
    }
  }, [client, devtools]);

  // Error boundary reset handling
  const prevResetKeys = useRef(resetKeys);
  const [resetCount, setResetCount] = useState(0);
  
  useEffect(() => {
    if (resetErrorBoundaryOnPropsChange && resetKeys) {
      if (!prevResetKeys.current || 
          resetKeys.length !== prevResetKeys.current.length ||
          resetKeys.some((key, index) => key !== prevResetKeys.current![index])) {
        setResetCount(count => count + 1);
        prevResetKeys.current = resetKeys;
      }
    }
  }, [resetKeys, resetErrorBoundaryOnPropsChange]);

  const contextValue = contextSharing ? client : clientRef.current;
  const ssrContextValue = React.useMemo(() => ({
    isHydrating,
    setIsHydrating,
  }), [isHydrating]);

  return (
    <PGRestifyContext.Provider value={contextValue}>
      <PGRestifySSRContext.Provider value={ssrContextValue}>
        <ErrorBoundaryWithReset key={resetCount} client={contextValue}>
          {children}
        </ErrorBoundaryWithReset>
      </PGRestifySSRContext.Provider>
    </PGRestifyContext.Provider>
  );
}

/**
 * Hook to get the PGRestify client from context
 */
export function usePGRestifyClient(): PGRestifyClient {
  const client = useContext(PGRestifyContext);
  
  if (!client) {
    throw new Error(
      'usePGRestifyClient must be used within a PGRestifyProvider'
    );
  }
  
  return client;
}

/**
 * Hook to get SSR context
 */
export function usePGRestifySSR() {
  return useContext(PGRestifySSRContext);
}

/**
 * Hook to check if we're currently hydrating
 */
export function useIsHydrating(): boolean {
  const { isHydrating } = usePGRestifySSR();
  return isHydrating;
}

/**
 * Error boundary component with reset capability
 */
interface ErrorBoundaryProps {
  client: PGRestifyClient;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundaryWithReset extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PGRestify Error Boundary caught an error:', error, errorInfo);
    
    // Log to external service if configured
    if (process.env.NODE_ENV === 'production') {
      // You could add error reporting here
    }
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { client } = this.props;
    const { hasError } = this.state;
    
    // Reset error boundary when client changes
    if (hasError && prevProps.client !== client) {
      this.setState({ hasError: false });
    }
  }

  override render() {
    const { hasError, error } = this.state;
    const { children, client } = this.props;

    if (hasError) {
      return (
        <ErrorFallback 
          error={error!} 
          resetErrorBoundary={() => {
            this.setState({ hasError: false });
            client.clear(); // Clear all queries on reset
          }}
        />
      );
    }

    return children;
  }
}

/**
 * Default error fallback component
 */
interface ErrorFallbackProps {
  error?: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div role="alert" style={{
      padding: '20px',
      border: '1px solid #ff6b6b',
      borderRadius: '4px',
      backgroundColor: '#ffe0e0',
      color: '#d63031',
      margin: '20px',
      fontFamily: 'monospace',
    }}>
      <h2>Something went wrong:</h2>
      <details style={{ whiteSpace: 'pre-wrap', marginBottom: '10px' }}>
        <summary>Error details</summary>
        {error?.stack || error?.message || 'Unknown error'}
      </details>
      <button 
        onClick={resetErrorBoundary}
        style={{
          padding: '8px 16px',
          backgroundColor: '#d63031',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}

/**
 * Higher-order component to provide PGRestify client
 */
export function withPGRestify<P extends {}>(
  Component: React.ComponentType<P & { client: PGRestifyClient }>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => {
    const client = usePGRestifyClient();
    return <Component {...props} client={client} />;
  };

  WrappedComponent.displayName = `withPGRestify(${
    Component.displayName || Component.name || 'Component'
  })`;

  return WrappedComponent;
}

/**
 * Helper to create a PGRestify provider with default settings
 */
export function createPGRestifyProvider(defaultClient?: PGRestifyClient) {
  return function DefaultPGRestifyProvider({
    client = defaultClient,
    ...props
  }: Partial<PGRestifyProviderProps>) {
    if (!client) {
      throw new Error(
        'createPGRestifyProvider requires a default client or client prop'
      );
    }

    return <PGRestifyProvider client={client} {...props as any} />;
  };
}

/**
 * Hook for Next.js App Router compatibility
 */
export function useNextjsAppRouter() {
  const [isAppRouter, setIsAppRouter] = useState(false);

  useEffect(() => {
    // Detect Next.js App Router
    const isNext = typeof window !== 'undefined' && 
      (window as any).__NEXT_DATA__?.nextExport === false;
    
    const isUsingAppRouter = isNext && 
      typeof (window as any).__NEXT_ROUTER_BASEPATH__ !== 'undefined';
    
    setIsAppRouter(isUsingAppRouter);
  }, []);

  return isAppRouter;
}

/**
 * Development-only hooks for debugging
 */
export function usePGRestifyDevtools() {
  const client = usePGRestifyClient();
  
  if (process.env.NODE_ENV !== 'development') {
    return {};
  }

  return {
    queryCache: client.getQueryCache(),
    mutationCache: client.getMutationCache(),
    invalidateQueries: client.invalidateQueries.bind(client),
    resetQueries: client.resetQueries.bind(client),
    clearCache: client.clear.bind(client),
    getQueriesData: client.getQueriesData.bind(client),
  };
}

// Re-export commonly used types
export type { PGRestifyClient };

// Global type augmentation for window
declare global {
  interface Window {
    __PGRESTIFY_SSR_STATE__?: any;
    __NEXT_DATA__?: any;
    __NEXT_ROUTER_BASEPATH__?: string;
  }
}