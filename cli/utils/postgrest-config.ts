/**
 * @fileoverview PostgREST Configuration Utilities
 * 
 * Centralized utilities for accessing PostgREST configuration values
 * across all generators and commands. Ensures consistent configuration
 * reading and provides fallback defaults.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { DatabaseConnection, extractDatabaseConnection } from './database-connection.js';

/**
 * PostgREST configuration interface with all parameters
 */
export interface PostgRESTConfig {
  // Database connection
  dbUri?: string;
  dbSchemas: string;
  dbAnonRole: string;
  dbAuthenticatedRole: string;
  
  // Authentication
  jwtSecret?: string;
  jwtAud?: string;
  
  // Server configuration
  serverHost: string;
  serverPort: number;
  serverCorsAllowedOrigins: string;
  serverCorsAllowedHeaders?: string;
  serverCorsExposedHeaders?: string;
  
  // Connection pool
  dbPool: number;
  dbPoolTimeout: number;
  dbPoolAcquisitionTimeout?: number;
  
  // Logging
  logLevel: string;
  
  // Performance
  maxRows?: number;
  dbPreparedStatements?: boolean;
  dbTxEnd?: string;
  dbChannelEnabled?: boolean;
  
  // Legacy/compatibility aliases
  schema: string; // Alias for primary schema in dbSchemas
  anonRole: string; // Alias for dbAnonRole
  authenticatedRole: string; // Alias for dbAuthenticatedRole
  preRequest?: string; // db-pre-request
}

/**
 * Default PostgREST configuration values
 */
export const POSTGREST_DEFAULTS = {
  // Database
  dbSchemas: 'api',
  dbAnonRole: 'web_anon',
  dbAuthenticatedRole: 'authenticated',
  
  // Server
  serverHost: '0.0.0.0',
  serverPort: 3000,
  serverCorsAllowedOrigins: '', // Empty string enables CORS with default headers in PostgREST v13+
  
  // Connection pool
  dbPool: 10,
  dbPoolTimeout: 10,
  dbPoolAcquisitionTimeout: 10,
  
  // Logging
  logLevel: 'info',
  
  // Performance
  maxRows: 1000,
  dbPreparedStatements: false,
  dbTxEnd: 'commit-allow-override',
  dbChannelEnabled: true
};

/**
 * Get PostgREST configuration from database connection or defaults
 */
export async function getPostgRESTConfig(connection?: DatabaseConnection, environment?: string): Promise<PostgRESTConfig> {
  // If no connection provided, try to extract from project
  if (!connection) {
    connection = await extractDatabaseConnection() || undefined;
  }
  
  // Determine environment-specific defaults
  const isProduction = environment === 'production';
  
  return {
    // Database connection
    dbUri: connection ? `postgresql://${connection.user}:${connection.password}@${connection.host}:${connection.port}/${connection.database}` : undefined,
    dbSchemas: connection?.schema || POSTGREST_DEFAULTS.dbSchemas,
    dbAnonRole: connection?.anonRole || POSTGREST_DEFAULTS.dbAnonRole,
    dbAuthenticatedRole: POSTGREST_DEFAULTS.dbAuthenticatedRole,
    
    // Authentication
    jwtSecret: connection?.jwtSecret,
    jwtAud: connection?.anonRole || POSTGREST_DEFAULTS.dbAnonRole,
    
    // Server configuration
    serverHost: connection?.serverHost || POSTGREST_DEFAULTS.serverHost,
    serverPort: connection?.serverPort || POSTGREST_DEFAULTS.serverPort,
    serverCorsAllowedOrigins: isProduction ? '' : POSTGREST_DEFAULTS.serverCorsAllowedOrigins,
    
    // Connection pool (production gets higher pool size)
    dbPool: isProduction ? 100 : POSTGREST_DEFAULTS.dbPool,
    dbPoolTimeout: POSTGREST_DEFAULTS.dbPoolTimeout,
    dbPoolAcquisitionTimeout: POSTGREST_DEFAULTS.dbPoolAcquisitionTimeout,
    
    // Logging (production uses error level)
    logLevel: isProduction ? 'error' : POSTGREST_DEFAULTS.logLevel,
    
    // Performance
    maxRows: isProduction ? 1000 : 100,
    dbPreparedStatements: isProduction,
    dbTxEnd: isProduction ? 'commit-allow-override' : 'rollback-allow-override',
    dbChannelEnabled: !isProduction,
    
    // Legacy aliases for backward compatibility
    schema: connection?.schema || POSTGREST_DEFAULTS.dbSchemas,
    anonRole: connection?.anonRole || POSTGREST_DEFAULTS.dbAnonRole,
    authenticatedRole: POSTGREST_DEFAULTS.dbAuthenticatedRole,
    preRequest: connection?.preRequest
  };
}

/**
 * Helper function to get schema-qualified table name
 */
export function getQualifiedTableName(tableName: string, config: PostgRESTConfig): string {
  return `${config.schema}.${tableName}`;
}

/**
 * Helper function to generate GRANT statement with correct role
 */
export function generateGrantStatement(
  permission: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL' | 'EXECUTE' | 'USAGE' | 'SELECT, INSERT, UPDATE, DELETE',
  objectName: string,
  config: PostgRESTConfig | { anonRole?: string; schema?: string },
  includeAuthenticated: boolean = true
): string {
  const anonRole = 'anonRole' in config ? config.anonRole : (config as any).dbAnonRole || POSTGREST_DEFAULTS.dbAnonRole;
  let grants = `GRANT ${permission} ON ${objectName} TO ${anonRole};\n`;
  if (includeAuthenticated) {
    grants += `GRANT ${permission} ON ${objectName} TO authenticated;\n`;
  }
  return grants;
}

/**
 * Helper function to get schema from options or config
 */
export async function getSchemaFromOptions(options: any, connection?: DatabaseConnection): Promise<string> {
  if (options.schema) {
    return options.schema;
  }
  
  const config = await getPostgRESTConfig(connection);
  return config.schema;
}

/**
 * Helper function to get anon role from options or config
 */
export async function getAnonRoleFromOptions(options: any, connection?: DatabaseConnection): Promise<string> {
  if (options.anonRole) {
    return options.anonRole;
  }
  
  const config = await getPostgRESTConfig(connection);
  return config.anonRole;
}