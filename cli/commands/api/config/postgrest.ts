/**
 * @fileoverview PostgREST configuration file generator
 * 
 * Generates optimized PostgREST configuration files with security
 * best practices, proper role configuration, and production settings.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import { logger } from '../../../utils/logger.js';
import { fs } from '../../../utils/fs.js';
import { getPostgRESTConfig, POSTGREST_DEFAULTS } from '../../../utils/postgrest-config.js';

/**
 * PostgREST configuration environments
 */
const ENVIRONMENTS = {
  development: {
    name: 'Development',
    description: 'Local development with debug features',
    logLevel: POSTGREST_DEFAULTS.logLevel,
    dbPool: POSTGREST_DEFAULTS.dbPool,
    serverPort: POSTGREST_DEFAULTS.serverPort
  },
  staging: {
    name: 'Staging',
    description: 'Testing environment with production-like settings',
    logLevel: 'warn',
    dbPool: 20,
    serverPort: POSTGREST_DEFAULTS.serverPort
  },
  production: {
    name: 'Production',
    description: 'Production environment with security hardening',
    logLevel: 'error',
    dbPool: 100,
    serverPort: POSTGREST_DEFAULTS.serverPort
  }
};

/**
 * Create PostgREST config command
 */
export function createPostgrestCommand(): Command {
  const command = new Command('postgrest');
  
  command
    .description('Generate PostgREST configuration')
    .option('--output <file>', 'Output file', './postgrest.conf')
    .option('--env <environment>', 'Environment (development|staging|production)', 'development')
    .option('--port <port>', 'Server port', '3000')
    .option('--schema <schema>', 'API schema')
    .option('--db-uri <uri>', 'Database URI (will prompt if not provided)')
    .action(async (options) => {
      await generatePostgrestConfig(options);
    });
  
  return command;
}

/**
 * Generate PostgREST configuration
 */
async function generatePostgrestConfig(options: any) {
  logger.info(chalk.cyan('⚙️  Generating PostgREST Configuration'));
  logger.newLine();
  
  const config = await collectPostgrestConfig(options);
  const configContent = await generateConfigFile(config);
  
  await fs.writeFile(config.output, configContent);
  
  logger.success(`✅ PostgREST config generated: ${config.output}`);
  displayConfigUsage(config);
}

/**
 * Collect PostgREST configuration
 */
async function collectPostgrestConfig(options: any) {
  // Try to get existing configuration first
  const existingConfig = await getPostgRESTConfig().catch(() => null);
  
  const config = {
    output: options.output,
    environment: options.env,
    port: options.port || existingConfig?.serverPort || 3000,
    schema: options.schema || existingConfig?.schema || 'api',
    dbUri: options.dbUri
  };
  
  // Get additional configuration based on environment
  const envConfig = ENVIRONMENTS[config.environment] || ENVIRONMENTS.development;
  
  // Ask about deployment method first
  const { useDocker } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useDocker',
      message: 'Are you using Docker for deployment?',
      default: true
    }
  ]);
  
  // Prompt for database credentials if not provided
  let dbCredentials: any = {};
  
  if (!config.dbUri) {
    logger.info(chalk.cyan('🔧 Database Configuration'));
    logger.info('Enter your PostgreSQL database credentials:');
    logger.newLine();
    
    dbCredentials = await inquirer.prompt([
      {
        type: 'input',
        name: 'host',
        message: 'Database host:',
        default: useDocker ? 'postgres' : 'localhost',
        validate: (input: string) => input.trim().length > 0 || 'Host is required'
      },
      {
        type: 'input',
        name: 'port',
        message: 'Database port:',
        default: '5432',
        validate: (input: string) => {
          const port = parseInt(input);
          return (port > 0 && port < 65536) || 'Must be a valid port number (1-65535)';
        }
      },
      {
        type: 'input',
        name: 'database',
        message: 'Database name:',
        default: 'postgres',
        validate: (input: string) => input.trim().length > 0 || 'Database name is required'
      },
      {
        type: 'input',
        name: 'username',
        message: 'Database username:',
        default: 'authenticator',
        validate: (input: string) => input.trim().length > 0 || 'Username is required'
      },
      {
        type: 'password',
        name: 'password',
        message: 'Database password:',
        mask: '*',
        validate: (input: string) => input.trim().length > 0 || 'Password is required'
      }
    ]);
    
    // Construct database URI from credentials
    config.dbUri = `postgresql://${dbCredentials.username}:${dbCredentials.password}@${dbCredentials.host}:${dbCredentials.port}/${dbCredentials.database}`;
  }
  
  logger.newLine();
  logger.info(chalk.cyan('⚙️  PostgREST Configuration'));
  
  // Ask for PostgREST-specific configuration
  const postgrestConfig = await inquirer.prompt([
    {
      type: 'input',
      name: 'jwtSecret',
      message: 'JWT Secret (leave empty to use environment variable):',
      default: ''
    },
    {
      type: 'input',
      name: 'anonRole',
      message: 'Anonymous role:',
      default: existingConfig?.anonRole || 'web_anon',
      validate: (input: string) => input.trim().length > 0 || 'Anonymous role is required'
    },
    {
      type: 'input',
      name: 'authenticatedRole',
      message: 'Authenticated user role:',
      default: 'authenticated',
      validate: (input: string) => input.trim().length > 0 || 'Authenticated role is required'
    },
    {
      type: 'input',
      name: 'schemas',
      message: 'Exposed schemas (comma-separated):',
      default: config.schema,
      validate: (input: string) => input.trim().length > 0 || 'At least one schema is required'
    },
    {
      type: 'confirm',
      name: 'enableCors',
      message: 'Enable CORS?',
      default: config.environment === 'development'
    }
  ]);
  
  return {
    ...config,
    ...envConfig,
    ...dbCredentials,
    ...postgrestConfig,
    useDocker,
    serverHost: existingConfig?.serverHost,
    schemas: postgrestConfig.schemas.split(',').map(s => s.trim())
  };
}

/**
 * Generate PostgREST configuration file
 */
async function generateConfigFile(config: any): Promise<string> {
  const deploymentNote = config.useDocker ? 
    '# Docker deployment configuration' : 
    '# Local/VM deployment configuration';
  
  return `# PostgREST Configuration
# Generated: ${new Date().toISOString()}
# Environment: ${config.environment}
# ${deploymentNote}
#
# This configuration is optimized for ${config.environment} usage.
# Review and customize based on your specific requirements.

# Database connection
${config.useDocker ? 
  `db-uri = "postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}"` :
  `db-uri = "${config.dbUri}"`
}
db-schemas = "${config.schemas.join(', ')}"
db-anon-role = "${config.anonRole}"
${config.authenticatedRole ? `db-authenticated-role = "${config.authenticatedRole}"` : ''}

# Authentication
${config.jwtSecret ? `jwt-secret = "${config.jwtSecret}"` : 'jwt-secret = "${JWT_SECRET}"  # Use environment variable'}
jwt-aud = "${config.anonRole}"

# Server configuration
server-host = "${config.serverHost || '0.0.0.0'}"
server-port = ${config.port}
${config.enableCors ? generateCorsConfiguration(config) : '# CORS disabled'}

# Connection pool
db-pool = ${config.dbPool}
db-pool-timeout = ${POSTGREST_DEFAULTS.dbPoolTimeout}
${config.useDocker ? `db-pool-acquisition-timeout = ${POSTGREST_DEFAULTS.dbPoolAcquisitionTimeout}` : ''}

# Logging
log-level = "${config.logLevel}"

# Security settings
${config.environment === 'production' ? await generateProductionSettings(config) : await generateDevelopmentSettings(config)}

# OpenAPI documentation
openapi-mode = "follow-privileges"
openapi-security-active = true

# Performance settings
${generatePerformanceSettings(config)}

${config.useDocker ? generateDockerSpecificSettings(config) : generateLocalSpecificSettings(config)}`;
}

/**
 * Generate production-specific settings
 */
async function generateProductionSettings(config: any): Promise<string> {
  const postgrestConfig = await getPostgRESTConfig(undefined, 'production');
  return `# Production security settings
raw-media-types = ""  # Disable raw media types for security
max-rows = ${postgrestConfig.maxRows}  # Limit response size
db-prepared-statements = ${postgrestConfig.dbPreparedStatements}  # Enable prepared statements
db-tx-end = "${postgrestConfig.dbTxEnd}"  # Production transaction handling
${config.useDocker ? 'db-channel-enabled = false  # Disable listen/notify for Docker' : `db-channel-enabled = ${postgrestConfig.dbChannelEnabled}`}`;
}

/**
 * Generate development-specific settings
 */
async function generateDevelopmentSettings(config: any): Promise<string> {
  const postgrestConfig = await getPostgRESTConfig(undefined, 'development');
  return `# Development settings
max-rows = ${postgrestConfig.maxRows}  # Smaller limit for development
db-prepared-statements = ${postgrestConfig.dbPreparedStatements}  # Disable for easier debugging
db-tx-end = "${postgrestConfig.dbTxEnd}"  # Development transaction handling
db-channel-enabled = ${postgrestConfig.dbChannelEnabled}  # Enable listen/notify for development`;
}

/**
 * Generate CORS configuration based on environment
 */
function generateCorsConfiguration(config: any): string {
  const isDevelopment = config.environment === 'development';
  
  return `# CORS configuration
# PostgREST v13+ requires empty string to enable CORS with default headers
# Use "" for development (allows all origins with default headers)
# Use specific origins for production
server-cors-allowed-origins = "${isDevelopment ? '' : 'https://yourdomain.com'}"`;
}

/**
 * Generate performance settings based on environment
 */
function generatePerformanceSettings(config: any): string {
  if (config.environment === 'production') {
    return `# Production performance settings
db-pre-request = "authenticator"
db-root-spec = false  # Disable root spec for performance
db-plan-enabled = true  # Enable query plan optimization`;
  } else {
    return `# Development performance settings
db-root-spec = true  # Enable root spec for API exploration
db-plan-enabled = false  # Disable for easier debugging`;
  }
}

/**
 * Generate Docker-specific settings
 */
function generateDockerSpecificSettings(_config: any): string {
  return `
# Docker deployment settings
# These settings are optimized for containerized environments

# Health check endpoint
server-health-check-enabled = true

# Container resource limits
db-pool-max-lifetime = 3600  # Max connection lifetime in seconds

# Docker networking
# Note: Host should be '0.0.0.0' to accept connections from other containers
# Database host should match your Docker Compose service name

# Environment variables for Docker:
# - JWT_SECRET (required)
# - DATABASE_URL (optional override)
# - PGRST_DB_SCHEMAS (optional override)`;
}

/**
 * Generate local deployment settings
 */
function generateLocalSpecificSettings(_config: any): string {
  return `
# Local deployment settings  
# These settings are optimized for local/VM deployments

# Security binding
# Note: Host is '127.0.0.1' for local access only
# Change to '0.0.0.0' if you need external access

# Local file paths
# Place sensitive files outside web root
# Ensure proper file permissions (600 for config files)

# Environment variables for local deployment:
# - JWT_SECRET (required)
# - Set in your shell profile or systemd service`;
}

/**
 * Display configuration usage instructions
 */
function displayConfigUsage(config: any) {
  logger.newLine();
  logger.info(chalk.cyan(`📋 ${config.useDocker ? 'Docker' : 'Local'} Deployment Instructions`));
  
  if (config.useDocker) {
    displayDockerUsage(config);
  } else {
    displayLocalUsage(config);
  }
  
  logger.newLine();
  logger.info(chalk.yellow('🔐 Database Connection:'));
  logger.list([
    `Host: ${config.host || 'from URI'}`,
    `Port: ${config.port || 'from URI'}`,
    `Database: ${config.database || 'from URI'}`,
    `Username: ${config.username || 'from URI'}`,
    'Password: [PROTECTED]'
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow('⚙️  Environment Variables:'));
  logger.list([
    'JWT_SECRET - JWT signing secret (required)',
    config.useDocker ? 'DATABASE_URL - Override database connection' : 'DATABASE_URL - Alternative to db-uri',
    'PGRST_DB_SCHEMAS - Override exposed schemas',
    'PGRST_SERVER_PORT - Override server port'
  ]);
  
  if (config.environment === 'production') {
    logger.newLine();
    logger.warn(chalk.red('🔒 Production Security Checklist:'));
    logger.list([
      'Use strong JWT secrets (64+ characters)',
      'Configure specific CORS origins (not *)',
      'Enable HTTPS/TLS termination',
      'Set up proper database roles and RLS policies',
      'Monitor API usage and set rate limits',
      'Regular security updates',
      'Enable database connection encryption',
      'Restrict network access to database',
      'Use secret management for credentials'
    ]);
  }
}

/**
 * Display Docker-specific usage instructions
 */
function displayDockerUsage(config: any) {
  logger.list([
    'Use with Docker Compose (recommended)',
    `PostgREST will be available on port ${config.port}`,
    'Database host should match Docker service name',
    'Set JWT_SECRET in Docker environment'
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('🐳 Docker Commands:'));
  logger.code(`# Run with Docker Compose
version: '3.8'
services:
  postgrest:
    image: postgrest/postgrest:latest
    ports:
      - "${config.port}:${config.port}"
    volumes:
      - ./${config.output}:/etc/postgrest.conf
    environment:
      - JWT_SECRET=\${JWT_SECRET}
    depends_on:
      - postgres
  
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=${config.database || 'postgres'}
      - POSTGRES_USER=${config.username || 'authenticator'}
      - POSTGRES_PASSWORD=${config.password || 'your-password'}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:`);
  
  logger.newLine();
  logger.info(chalk.cyan('Start Commands:'));
  logger.code(`# Set JWT secret and start
export JWT_SECRET="your-super-secret-jwt-key"
docker compose up -d

# View logs
docker compose logs -f postgrest

# Test API
curl http://localhost:${config.port}/`);
}

/**
 * Display local deployment usage instructions
 */
function displayLocalUsage(config: any) {
  logger.list([
    `Start PostgREST: postgrest ${config.output}`,
    'Ensure PostgreSQL is running and accessible',
    'Set environment variables before starting',
    `Access API at http://127.0.0.1:${config.port}`
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('🖥️  Local Commands:'));
  logger.code(`# Set environment variables
export JWT_SECRET="your-super-secret-jwt-key"

# Start PostgREST
postgrest ${config.output}

# Or start as background service
nohup postgrest ${config.output} > postgrest.log 2>&1 &`);
  
  if (config.environment === 'production') {
    logger.newLine();
    logger.info(chalk.cyan('🔧 Systemd Service (Production):'));
    logger.code(`# Create /etc/systemd/system/postgrest.service
[Unit]
Description=PostgREST API Server
After=network.target postgresql.service

[Service]
Type=simple
User=postgrest
Group=postgrest
WorkingDirectory=/opt/postgrest
ExecStart=/usr/local/bin/postgrest /opt/postgrest/postgrest.conf
Environment=JWT_SECRET=your-secret-here
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target

# Enable and start
sudo systemctl enable postgrest
sudo systemctl start postgrest`);
  }
}