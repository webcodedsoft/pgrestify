/**
 * @fileoverview Centralized Database Connection Utility
 * 
 * Provides a single, consistent way to extract database connection credentials
 * from various configuration sources. Handles both Docker and local setups
 * with automatic hostname resolution.
 * 
 * @author PGRestify Team
 * @since 3.0.0
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { logger } from './logger.js';

export interface DatabaseConnection {
  user: string;
  password?: string;
  host: string;
  port: number;
  database: string;
  schema: string;
  connectionString?: string;
  // PostgREST configuration
  anonRole?: string;      // db-anon-role
  jwtSecret?: string;     // jwt-secret
  serverHost?: string;    // server-host
  serverPort?: number;    // server-port
  preRequest?: string;    // db-pre-request
}

export interface DatabaseConnectionOptions {
  projectPath?: string;
  verbose?: boolean;
  preferDocker?: boolean;
}

/**
 * Extract database connection from project configuration files
 * This is the main function that should be used across all CLI commands
 */
export async function extractDatabaseConnection(
  options: DatabaseConnectionOptions = {}
): Promise<DatabaseConnection | null> {
  const { projectPath = process.cwd(), verbose = true } = options;
  
  if (verbose) {
    logger.info(chalk.blue('🔍 Looking for database connection configuration...'));
  }
  
  // Try multiple sources in order of preference
  const connection = 
    await tryParsePostgrestConf(projectPath) ||
    await tryParseDockerCompose(projectPath) ||
    await tryParseEnvFile(projectPath) ||
    await tryParseSetupScript(projectPath);
  
  if (connection) {
    if (verbose) {
      logger.info(chalk.green(`✅ Found database connection: ${connection.host}:${connection.port}/${connection.database}`));
    }
    return connection;
  }
  
  if (verbose) {
    logger.warn(chalk.yellow('⚠️  No database connection found in configuration files'));
    logger.info('Please ensure you have one of the following:');
    logger.list([
      'postgrest.conf with db-uri setting',
      'docker-compose.yml with PostgreSQL configuration', 
      '.env file with database variables',
      'setup.sh script with psql parameters'
    ]);
  }
  
  return null;
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(connection: DatabaseConnection): Promise<boolean> {
  try {
    logger.info(chalk.blue('🔗 Testing database connection...'));
    
    const { Pool } = await import('pg');
    const pool = new Pool({
      user: connection.user,
      password: connection.password,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 1000,
    });
    
    await pool.query('SELECT 1');
    await pool.end();
    
    logger.info(chalk.green('✅ Database connection successful'));
    return true;
  } catch (error) {
    logger.error(chalk.red(`❌ Database connection failed: ${error.message}`));
    return false;
  }
}

/**
 * Create a PostgreSQL connection pool with proper configuration
 */
export async function createConnectionPool(connection: DatabaseConnection, options: {
  maxConnections?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
} = {}) {
  const { Pool } = await import('pg');
  
  return new Pool({
    user: connection.user,
    password: connection.password,
    host: connection.host,
    port: connection.port,
    database: connection.database,
    max: options.maxConnections || 10,
    connectionTimeoutMillis: options.connectionTimeout || 10000,
    idleTimeoutMillis: options.idleTimeout || 5000,
  });
}

/**
 * Build connection string from connection object
 */
export function buildConnectionString(connection: DatabaseConnection): string {
  const { user, password, host, port, database } = connection;
  const auth = password ? `${user}:${password}` : user;
  return `postgresql://${auth}@${host}:${port}/${database}`;
}

// Private helper functions

/**
 * Try to parse PostgreSQL connection from postgrest.conf
 */
async function tryParsePostgrestConf(projectPath: string): Promise<DatabaseConnection | null> {
  const confPath = join(projectPath, 'postgrest.conf');
  
  if (!existsSync(confPath)) return null;
  
  try {
    const content = readFileSync(confPath, 'utf8');
    const dbUriMatch = content.match(/db-uri\s*=\s*"([^"]+)"/);
    const dbSchemasMatch = content.match(/db-schemas\s*=\s*"([^"]+)"/);
    const dbAnonRoleMatch = content.match(/db-anon-role\s*=\s*"([^"]+)"/);
    const jwtSecretMatch = content.match(/jwt-secret\s*=\s*"([^"]+)"/);
    const serverHostMatch = content.match(/server-host\s*=\s*"([^"]+)"/);
    const serverPortMatch = content.match(/server-port\s*=\s*(\d+)/);
    const preRequestMatch = content.match(/db-pre-request\s*=\s*"([^"]+)"/);
    
    if (!dbUriMatch) return null;
    
    const uri = dbUriMatch[1];
    const schema = dbSchemasMatch ? dbSchemasMatch[1] : 'api'; // Default to 'api' if not found
    
    const parsed = parseConnectionString(uri);
    
    if (parsed) {
      parsed.schema = schema;
      parsed.anonRole = dbAnonRoleMatch ? dbAnonRoleMatch[1] : 'web_anon';
      parsed.jwtSecret = jwtSecretMatch ? jwtSecretMatch[1] : undefined;
      parsed.serverHost = serverHostMatch ? serverHostMatch[1] : '0.0.0.0';
      parsed.serverPort = serverPortMatch ? parseInt(serverPortMatch[1]) : 3000;
      parsed.preRequest = preRequestMatch ? preRequestMatch[1] : undefined;
      
      logger.debug(`✅ Found connection in postgrest.conf (schema: ${schema}, anonRole: ${parsed.anonRole})`);
      return parsed;
    }
  } catch (error) {
    logger.debug(`Could not parse postgrest.conf: ${error.message}`);
  }
  
  return null;
}

/**
 * Try to parse connection from docker-compose.yml
 */
async function tryParseDockerCompose(projectPath: string): Promise<DatabaseConnection | null> {
  const composePaths = [
    join(projectPath, 'docker-compose.yml'),
    join(projectPath, 'docker-compose.yaml')
  ];
  
  for (const composePath of composePaths) {
    if (!existsSync(composePath)) continue;
    
    try {
      const content = readFileSync(composePath, 'utf8');
      
      // First try to extract from environment variables
      const connection = await extractFromDockerEnv(content, projectPath);
      if (connection) {
        logger.debug('✅ Found connection in docker-compose.yml');
        return connection;
      }
    } catch (error) {
      logger.debug(`Could not parse docker-compose.yml: ${error.message}`);
    }
  }
  
  return null;
}

/**
 * Extract database connection from Docker Compose environment variables
 */
async function extractFromDockerEnv(composeContent: string, projectPath: string): Promise<DatabaseConnection | null> {
  // Load .env file for variable resolution
  const envVars = await loadEnvVariables(projectPath);
  
  // Look for PostgreSQL service configuration
  const postgresDbMatch = composeContent.match(/POSTGRES_DB:\s*(.+)/);
  const postgresUserMatch = composeContent.match(/POSTGRES_USER:\s*(.+)/);
  const postgresPasswordMatch = composeContent.match(/POSTGRES_PASSWORD:\s*(.+)/);
  const postgresPortMatch = composeContent.match(/ports:\s*\n\s*-\s*["']?(\d+):5432["']?/) ||
                           composeContent.match(/["'](\d+):5432["']/);
  
  if (postgresDbMatch && postgresUserMatch) {
    const database = resolveEnvVariable(postgresDbMatch[1].trim(), envVars);
    const username = resolveEnvVariable(postgresUserMatch[1].trim(), envVars);
    const password = postgresPasswordMatch ? resolveEnvVariable(postgresPasswordMatch[1].trim(), envVars) : undefined;
    const port = postgresPortMatch ? parseInt(postgresPortMatch[1]) : 5432;
    
    if (database && username) {
      return {
        user: username,
        password,
        host: 'localhost', // Docker services are accessible via localhost from CLI
        port,
        database,
        schema: 'api', // Default schema for docker-compose parsing
        anonRole: 'web_anon', // Default anon role
        serverHost: '0.0.0.0', // Default server host
        serverPort: 3000 // Default server port
      };
    }
  }
  
  return null;
}

/**
 * Try to parse connection from .env files
 */
async function tryParseEnvFile(projectPath: string): Promise<DatabaseConnection | null> {
  const envPaths = [
    join(projectPath, '.env'),
    join(projectPath, '.env.local'),
    join(projectPath, '.env.development')
  ];
  
  for (const envPath of envPaths) {
    if (!existsSync(envPath)) continue;
    
    try {
      const vars = await loadEnvVariables(projectPath, envPath);
      
      // Try DATABASE_URL first (most common)
      const dbUrl = vars.DATABASE_URL || vars.POSTGRES_URL || vars.DB_URL;
      if (dbUrl) {
        const parsed = parseConnectionString(dbUrl);
        if (parsed) {
          logger.debug('✅ Found connection in .env file (DATABASE_URL)');
          return parsed;
        }
      }
      
      // Try individual PostgreSQL variables
      if (vars.POSTGRES_USER && vars.POSTGRES_DB) {
        logger.debug('✅ Found PostgreSQL variables in .env file');
        return {
          user: vars.POSTGRES_USER,
          password: vars.POSTGRES_PASSWORD,
          host: vars.POSTGRES_HOST || 'localhost',
          port: parseInt(vars.POSTGRES_PORT || '5432'),
          database: vars.POSTGRES_DB,
          schema: vars.DB_SCHEMA || vars.POSTGRES_SCHEMA || 'api', // Try to read schema from env
          anonRole: vars.DB_ANON_ROLE || 'web_anon', // Try to read anon role from env
          jwtSecret: vars.JWT_SECRET, // Read JWT secret from env
          serverHost: vars.SERVER_HOST || '0.0.0.0', // Read server host from env
          serverPort: parseInt(vars.SERVER_PORT || '3000'), // Read server port from env
          preRequest: vars.DB_PRE_REQUEST // Read pre-request function from env
        };
      }
      
      // Try generic database variables
      if (vars.DB_USER && vars.DB_NAME) {
        logger.debug('✅ Found database variables in .env file');
        return {
          user: vars.DB_USER,
          password: vars.DB_PASSWORD || vars.DB_PASS,
          host: vars.DB_HOST || 'localhost',
          port: parseInt(vars.DB_PORT || '5432'),
          database: vars.DB_NAME || vars.DB_DATABASE,
          schema: vars.DB_SCHEMA || 'api', // Try to read schema from env
          anonRole: vars.DB_ANON_ROLE || 'web_anon', // Try to read anon role from env
          jwtSecret: vars.JWT_SECRET, // Read JWT secret from env
          serverHost: vars.SERVER_HOST || '0.0.0.0', // Read server host from env
          serverPort: parseInt(vars.SERVER_PORT || '3000'), // Read server port from env
          preRequest: vars.DB_PRE_REQUEST // Read pre-request function from env
        };
      }
    } catch (error) {
      logger.debug(`Could not parse .env file: ${error.message}`);
    }
  }
  
  return null;
}

/**
 * Try to parse connection from setup scripts
 */
async function tryParseSetupScript(projectPath: string): Promise<DatabaseConnection | null> {
  const scriptPaths = [
    join(projectPath, 'scripts', 'setup.sh'),
    join(projectPath, 'setup.sh'),
    join(projectPath, 'bin', 'setup'),
    join(projectPath, 'scripts', 'db-setup.sh')
  ];
  
  for (const scriptPath of scriptPaths) {
    if (!existsSync(scriptPath)) continue;
    
    try {
      const content = readFileSync(scriptPath, 'utf8');
      
      // Look for psql connection parameters
      const patterns = [
        /psql\s+(?:.*\s+)?-h\s+(\S+)\s+(?:.*\s+)?-p\s+(\d+)\s+(?:.*\s+)?-U\s+(\S+)\s+(?:.*\s+)?-d\s+(\S+)/,
        /psql\s+"postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)"/,
        /PGHOST=(\S+).*PGPORT=(\d+).*PGUSER=(\S+).*PGDATABASE=(\S+)/
      ];
      
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          let connection: DatabaseConnection;
          
          if (pattern.source.includes('postgresql://')) {
            // Full connection string format
            const [, user, password, host, port, database] = match;
            connection = {
              user,
              password,
              host: resolveDockerHostname(host),
              port: parseInt(port),
              database,
              schema: 'api' // Default schema for setup script parsing
            };
          } else if (pattern.source.includes('PGHOST')) {
            // Environment variable format
            const [, host, port, user, database] = match;
            connection = {
              user,
              host: resolveDockerHostname(host),
              port: parseInt(port),
              database,
              schema: 'api' // Default schema for setup script parsing
            };
          } else {
            // psql parameter format
            const [, host, port, user, database] = match;
            connection = {
              user,
              host: resolveDockerHostname(host),
              port: parseInt(port),
              database,
              schema: 'api' // Default schema for setup script parsing
            };
          }
          
          logger.debug('✅ Found connection in setup script');
          return connection;
        }
      }
    } catch (error) {
      logger.debug(`Could not parse setup script: ${error.message}`);
    }
  }
  
  return null;
}

/**
 * Parse PostgreSQL connection string with Docker hostname resolution
 */
function parseConnectionString(uri: string): DatabaseConnection | null {
  try {
    // Handle postgresql:// and postgres:// URLs
    const match = uri.match(/postgres(?:ql)?:\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)\/(.+)/);
    
    if (!match) {
      return null;
    }
    
    const [, user, password, host, port, database] = match;
    
    // Convert Docker hostname to localhost for CLI access
    const resolvedHost = resolveDockerHostname(host);
    // Also update the connection string for consistency
    const resolvedUri = resolvedHost !== host ? uri.replace(`@${host}:`, `@${resolvedHost}:`) : uri;
    
    return {
      user: user || 'postgres',
      password: password || undefined,
      host: resolvedHost,
      port: parseInt(port),
      database,
      schema: 'api', // Default schema, can be overridden by specific parsers
      connectionString: resolvedUri,
      anonRole: 'web_anon', // Default anon role
      serverHost: '0.0.0.0', // Default server host
      serverPort: 3000 // Default server port
    };
  } catch (error) {
    logger.debug(`Failed to parse connection string: ${error.message}`);
    return null;
  }
}

/**
 * Resolve Docker internal hostnames to localhost for CLI access
 */
function resolveDockerHostname(host: string): string {
  // Common Docker hostname patterns that should be converted to localhost
  const dockerHostnames = [
    'postgres',           // Default PostgreSQL service name
    'postgresql',         // Alternative service name
    'database',          // Generic database service name
    'db',                // Short database service name
    'pgdb',              // PostgreSQL database service name
    'pg',                // Short PostgreSQL service name
    'postgrest-db',      // PostgREST specific database name
    'pgrestify-db',      // PGRestify specific database name
    'app-db',            // Application database service name
    'main-db',           // Main database service name
    'primary-db'         // Primary database service name
  ];
  
  // Convert known Docker hostnames to localhost
  if (dockerHostnames.includes(host.toLowerCase())) {
    logger.debug(chalk.yellow(`🔄 Converting Docker hostname '${host}' → 'localhost'`));
    return 'localhost';
  }
  
  // Check for hostname patterns that look like Docker internal names
  if (host.includes('_') || host.includes('-')) {
    // Check if it ends with common database suffixes
    const dbSuffixes = ['_db', '-db', '_postgres', '-postgres', '_postgresql', '-postgresql'];
    const lowerHost = host.toLowerCase();
    
    for (const suffix of dbSuffixes) {
      if (lowerHost.endsWith(suffix)) {
        logger.debug(chalk.yellow(`🔄 Converting Docker hostname '${host}' → 'localhost' (detected pattern: *${suffix})`));
        return 'localhost';
      }
    }
  }
  
  // Check for local development patterns
  if (host === '127.0.0.1' || host === '::1') {
    return 'localhost'; // Normalize IPv4/IPv6 localhost to hostname
  }
  
  // If it's not a recognized Docker hostname, return as-is
  return host;
}

/**
 * Load environment variables from .env file
 */
async function loadEnvVariables(projectPath: string, specificPath?: string): Promise<Record<string, string>> {
  const envPaths = specificPath ? [specificPath] : [
    join(projectPath, '.env'),
    join(projectPath, '.env.local'),
    join(projectPath, '.env.development')
  ];
  
  const vars: Record<string, string> = {};
  
  for (const envPath of envPaths) {
    if (!existsSync(envPath)) continue;
    
    try {
      const content = readFileSync(envPath, 'utf8');
      
      content.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = cleanEnvValue(match[2].trim());
          if (key && value) {
            vars[key] = value;
          }
        }
      });
    } catch (error) {
      logger.debug(`Could not read ${envPath}: ${error.message}`);
    }
  }
  
  return vars;
}

/**
 * Resolve environment variable references like ${VAR} or ${VAR:-default}
 */
function resolveEnvVariable(value: string, envVars: Record<string, string>): string {
  const cleaned = cleanEnvValue(value);
  
  // Handle ${VAR} or ${VAR:-default} syntax
  const envMatch = cleaned.match(/^\$\{([^}]+)\}$/);
  if (envMatch) {
    const varExpression = envMatch[1];
    
    // Check for default value syntax: VAR:-default
    const defaultMatch = varExpression.match(/^([^:]+):?-(.*)$/);
    if (defaultMatch) {
      const [, varName, defaultValue] = defaultMatch;
      return envVars[varName] || defaultValue;
    }
    
    // Simple variable reference
    return envVars[varExpression] || '';
  }
  
  return cleaned;
}

/**
 * Clean environment variable value (remove quotes, etc.)
 */
function cleanEnvValue(value: string): string {
  return value.replace(/^["']|["']$/g, '').trim();
}

/**
 * Validate database connection configuration
 */
export function validateConnection(connection: DatabaseConnection): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!connection.user) {
    errors.push('Missing database user');
  }
  
  if (!connection.host) {
    errors.push('Missing database host');
  }
  
  if (!connection.port || connection.port < 1 || connection.port > 65535) {
    errors.push('Invalid database port');
  }
  
  if (!connection.database) {
    errors.push('Missing database name');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}