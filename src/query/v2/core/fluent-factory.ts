/**
 * V2 Fluent API Factory Functions
 * Creates QueryBuilder and MutationBuilder instances for fluent chaining
 */

import { QueryBuilder } from '../../../core/query-builder';
import { MutationBuilder } from './mutation-builder';
import type { PGRestifyClient } from '../../core/types';

/**
 * Global client reference for factory functions
 * Will be set by the React provider or client initialization
 */
let globalClient: PGRestifyClient | null = null;

/**
 * Set the global client for factory functions
 * Called by the React provider or when initializing the client
 */
export function setGlobalClient(client: PGRestifyClient): void {
  globalClient = client;
}

/**
 * Get the global client, throwing an error if not set
 */
function getClient(): PGRestifyClient {
  if (!globalClient) {
    throw new Error(
      'PGRestify client not initialized. ' +
      'Make sure you have wrapped your app with PGRestifyProvider or called setGlobalClient()'
    );
  }
  return globalClient;
}

/**
 * Create a new QueryBuilder for fluent query building
 * @returns FluentQueryBuilder instance for method chaining
 * 
 * @example
 * const users = await query()
 *   .from('users')
 *   .select(['id', 'name', 'email'])
 *   .eq('active', true)
 *   .orderBy('created_at', 'DESC')
 *   .limit(10)
 *   .execute();
 */
export function query(): FluentQueryBuilder {
  // Return a simple FluentQueryBuilder that will delegate to the client
  return new FluentQueryBuilder();
}

/**
 * Create a new MutationBuilder for fluent mutation building
 * @returns MutationBuilder instance for method chaining
 * 
 * @example
 * const newUser = await mutation()
 *   .insertInto('users')
 *   .values({ name: 'John', email: 'john@example.com' })
 *   .returning(['id', 'name'])
 *   .execute();
 */
export function mutation<T = Record<string, unknown>>(): MutationBuilder<T> {
  const client = getClient();
  
  return new MutationBuilder<T>(client);
}

/**
 * Enhanced QueryBuilder that sets the table name via .from()
 * This allows the fluent factory pattern: query().from('table')
 */
class FluentQueryBuilder {
  /**
   * Set the table name for this query
   * @param tableName The table to query
   * @returns QueryBuilder instance for continued chaining
   */
  from<TTable = Record<string, unknown>>(tableName: string): QueryBuilder<TTable> {
    // Use the global client to create a proper QueryBuilder
    const client = getClient();
    return client.from(tableName) as QueryBuilder<TTable>;
  }
}

