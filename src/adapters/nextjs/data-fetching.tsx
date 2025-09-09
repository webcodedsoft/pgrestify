/**
 * Next.js data fetching utilities for Pages Router
 */

import { createNextJSClient } from './client';
import { serializeForProps } from './utils';
import type { 
  NextJSClientConfig,
  GetServerSidePropsContext,
  GetStaticPropsContext 
} from './types';

/**
 * Creates a type-safe getServerSideProps function with PGRestify client
 */
export function createGetServerSideProps<P = any>(
  handler: (context: GetServerSidePropsContext) => Promise<{ props: P }>,
  clientConfig?: Partial<NextJSClientConfig>
) {
  return async (context: any) => {
    const client = createNextJSClient({
      url: process.env.POSTGREST_URL || process.env.NEXT_PUBLIC_POSTGREST_URL!,
      router: 'pages',
      ...clientConfig
    });

    const enhancedContext: GetServerSidePropsContext = {
      ...context,
      client
    };

    try {
      const result = await handler(enhancedContext);
      
      // Serialize props to ensure they're JSON-safe
      return {
        ...result,
        props: serializeForProps(result.props)
      };
    } catch (error) {
      console.error('Error in getServerSideProps:', error);
      
      return {
        notFound: true
      };
    }
  };
}

/**
 * Creates a type-safe getStaticProps function with PGRestify client
 */
export function createGetStaticProps<P = any>(
  handler: (context: GetStaticPropsContext) => Promise<{ props: P; revalidate?: number | false }>,
  clientConfig?: Partial<NextJSClientConfig>
) {
  return async (context: any) => {
    const client = createNextJSClient({
      url: process.env.POSTGREST_URL || process.env.NEXT_PUBLIC_POSTGREST_URL!,
      router: 'pages',
      cache: { enabled: true, ttl: 3600 }, // Longer cache for static props
      ...clientConfig
    });

    const enhancedContext: GetStaticPropsContext = {
      ...context,
      client
    };

    try {
      const result = await handler(enhancedContext);
      
      return {
        ...result,
        props: serializeForProps(result.props)
      };
    } catch (error) {
      console.error('Error in getStaticProps:', error);
      
      return {
        notFound: true
      };
    }
  };
}

/**
 * Higher-order component that provides PGRestify client to page components
 */
export function withPGRestify<P = any>(
  Component: React.ComponentType<P & { client: any }>,
  clientConfig?: Partial<NextJSClientConfig>
) {
  const WrappedComponent = (props: P) => {
    const client = createNextJSClient({
      url: process.env.NEXT_PUBLIC_POSTGREST_URL!,
      router: 'pages',
      ...clientConfig
    });

    return <Component {...props} client={client} />;
  };

  WrappedComponent.displayName = `withPGRestify(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}