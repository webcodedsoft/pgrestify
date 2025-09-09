/**
 * @fileoverview Docker configuration for PostgREST
 * 
 * Generates Docker Compose files with PostgreSQL + PostgREST
 * optimized for development and production deployments.
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
 * Create Docker config command
 */
export function createDockerCommand(): Command {
  const command = new Command('docker');
  
  command
    .description('Generate Docker configuration for PostgREST')
    .option('--output <file>', 'Output file', './docker-compose.yml')
    .option('--append-to <file>', 'Append to existing docker-compose file')
    .option('--env <environment>', 'Environment (development|production)', 'development')
    .option('--include-db', 'Include PostgreSQL service', true)
    .option('--db-version <version>', 'PostgreSQL version', '15')
    .option('--postgrest-version <version>', 'PostgREST version', 'latest')
    .action(async (options) => {
      await generateDockerConfig(options);
    });
  
  return command;
}

/**
 * Generate Docker configuration
 */
async function generateDockerConfig(options: any) {
  logger.info(chalk.cyan('🐳 Generating Docker Configuration for PostgREST'));
  logger.newLine();
  
  const config = await collectDockerConfig(options);
  
  if (options.appendTo) {
    await appendToDockerCompose(config, options.appendTo);
  } else {
    await createNewDockerCompose(config);
  }
  
  logger.success(`✅ Docker config generated: ${config.output}`);
  await displayDockerUsage(config);
}

/**
 * Collect Docker configuration
 */
async function collectDockerConfig(options: any) {
  logger.info(chalk.cyan('🐳 Docker Configuration'));
  logger.info('Configure your PostgREST Docker setup:');
  logger.newLine();
  
  const { services, networks, volumes } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'services',
      message: 'Select services to include:',
      choices: [
        { name: 'PostgreSQL Database', value: 'postgres', checked: options.includeDb },
        { name: 'PostgREST API', value: 'postgrest', checked: true },
        { name: 'Swagger UI (API docs)', value: 'swagger', checked: false },
        { name: 'pgAdmin (Database admin)', value: 'pgadmin', checked: false },
        { name: 'Redis (Caching)', value: 'redis', checked: false }
      ]
    },
    {
      type: 'confirm',
      name: 'networks',
      message: 'Create custom Docker network?',
      default: true
    },
    {
      type: 'confirm',
      name: 'volumes',
      message: 'Create persistent volumes?',
      default: true
    }
  ]);
  
  // Collect database credentials
  let dbCredentials = {};
  if (services.includes('postgres')) {
    logger.newLine();
    logger.info(chalk.cyan('🔧 Database Configuration'));
    logger.info('Set up your PostgreSQL database credentials:');
    logger.newLine();
    
    dbCredentials = await inquirer.prompt([
      {
        type: 'input',
        name: 'dbName',
        message: 'Database name:',
        default: 'postgres',
        validate: (input: string) => input.trim().length > 0 || 'Database name is required'
      },
      {
        type: 'input',
        name: 'dbUser',
        message: 'Database username:',
        default: 'postgres',
        validate: (input: string) => input.trim().length > 0 || 'Username is required'
      },
      {
        type: 'password',
        name: 'dbPassword',
        message: 'Database password:',
        mask: '*',
        validate: (input: string) => input.length >= 8 || 'Password must be at least 8 characters'
      }
    ]);
  }
  
  // Collect PostgREST configuration
  let postgrestConfig: any = {};
  if (services.includes('postgrest')) {
    logger.newLine();
    logger.info(chalk.cyan('⚙️  PostgREST Configuration'));
    
    postgrestConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiSchemas',
        message: 'API schemas (comma-separated):',
        default: POSTGREST_DEFAULTS.dbSchemas,
        validate: (input: string) => input.trim().length > 0 || 'At least one schema is required'
      },
      {
        type: 'input',
        name: 'anonRole',
        message: 'Anonymous role:',
        default: POSTGREST_DEFAULTS.dbAnonRole,
        validate: (input: string) => input.trim().length > 0 || 'Anonymous role is required'
      },
      {
        type: 'input',
        name: 'jwtSecret',
        message: 'JWT Secret (leave empty to generate one):',
        default: ''
      },
      {
        type: 'confirm',
        name: 'enableCors',
        message: 'Enable CORS for development?',
        default: options.env === 'development'
      }
    ]);
    
    // Generate JWT secret if not provided
    if (!postgrestConfig.jwtSecret) {
      const crypto = await import('crypto');
      postgrestConfig.jwtSecret = crypto.randomBytes(32).toString('base64');
      logger.info(chalk.yellow('✨ Generated JWT secret'));
    }
  }
  
  return {
    output: options.output,
    appendTo: options.appendTo,
    environment: options.env,
    services,
    networks,
    volumes,
    dbVersion: options.dbVersion,
    postgrestVersion: options.postgrestVersion,
    ...dbCredentials,
    ...postgrestConfig
  };
}

/**
 * Create new Docker Compose file
 */
async function createNewDockerCompose(config: any) {
  const compose = generateDockerCompose(config);
  await fs.writeFile(config.output, compose);
  
  // Also generate .env file
  const envFile = generateEnvFile(config);
  await fs.writeFile('.env.example', envFile);
}

/**
 * Append PostgREST services to existing docker-compose.yml
 */
async function appendToDockerCompose(config: any, existingFile: string) {
  if (!await fs.exists(existingFile)) {
    logger.error(`File not found: ${existingFile}`);
    process.exit(1);
  }
  
  const existingContent = await fs.readFile(existingFile);
  const services = generatePostgrestServices(config);
  
  // Simple append - in production this should parse YAML properly
  const appendContent = `\n  # PostgREST services added by PGRestify\n${services}`;
  
  await fs.writeFile(existingFile, existingContent + appendContent);
  config.output = existingFile;
}

/**
 * Generate complete Docker Compose file
 */
function generateDockerCompose(config: any): string {
  const services = generateAllServices(config);
  const networks = config.networks ? generateNetworks() : '';
  const volumes = config.volumes ? generateVolumes(config) : '';
  
  return `# Docker Compose for PostgREST
# Generated: ${new Date().toISOString()}
# Environment: ${config.environment}
#
# Usage: docker compose up -d
# Stop: docker compose down

version: '3.8'

services:
${services}
${networks}
${volumes}`;
}

/**
 * Generate all selected services
 */
function generateAllServices(config: any): string {
  const serviceGenerators = {
    postgres: generatePostgresService,
    postgrest: generatePostgrestService,
    swagger: generateSwaggerService,
    pgadmin: generatePgAdminService,
    redis: generateRedisService
  };
  
  return config.services
    .map(service => serviceGenerators[service]?.(config))
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Generate PostgreSQL service
 */
function generatePostgresService(config: any): string {
  return `  postgres:
    image: postgres:${config.dbVersion}-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: \${POSTGRES_DB:-postgres}
      POSTGRES_INITDB_ARGS: "--auth-local=trust --auth-host=md5"
    ports:
      - "\${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./sql/init:/docker-entrypoint-initdb.d:ro
    networks:
      - postgrest-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5`;
}

/**
 * Generate PostgREST service
 */
function generatePostgrestService(config: any): string {
  return `  postgrest:
    image: postgrest/postgrest:${config.postgrestVersion}
    restart: unless-stopped
    environment:
      PGRST_DB_URI: \${DATABASE_URL:-postgresql://postgres:postgres@postgres:5432/postgres}
      PGRST_DB_SCHEMAS: \${PGRST_DB_SCHEMAS:-api}
      PGRST_DB_ANON_ROLE: \${PGRST_DB_ANON_ROLE:-web_anon}
      PGRST_JWT_SECRET: \${JWT_SECRET}
      PGRST_SERVER_PORT: 3000
      PGRST_SERVER_CORS_ALLOWED_ORIGINS: "\${CORS_ORIGINS:-*}"
      PGRST_OPENAPI_MODE: follow-privileges
      PGRST_OPENAPI_SECURITY_ACTIVE: true
      PGRST_LOG_LEVEL: \${LOG_LEVEL:-info}
    ports:
      - "\${POSTGREST_PORT:-3000}:3000"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - postgrest-network
    volumes:
      - ./postgrest.conf:/etc/postgrest.conf:ro
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:\${PGRST_SERVER_PORT:-3000}/ || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5`;
}

/**
 * Generate Swagger UI service
 */
function generateSwaggerService(config: any): string {
  return `  swagger:
    image: swaggerapi/swagger-ui:latest
    restart: unless-stopped
    environment:
      API_URL: http://localhost:\${POSTGREST_PORT:-3000}/
    ports:
      - "\${SWAGGER_PORT:-8080}:8080"
    depends_on:
      - postgrest
    networks:
      - postgrest-network`;
}

/**
 * Generate pgAdmin service
 */
function generatePgAdminService(config: any): string {
  return `  pgadmin:
    image: dpage/pgadmin4:latest
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: \${PGADMIN_EMAIL:-admin@example.com}
      PGADMIN_DEFAULT_PASSWORD: \${PGADMIN_PASSWORD:-admin}
      PGADMIN_LISTEN_PORT: 5050
    ports:
      - "\${PGADMIN_PORT:-5050}:5050"
    depends_on:
      - postgres
    networks:
      - postgrest-network
    volumes:
      - pgadmin_data:/var/lib/pgadmin`;
}

/**
 * Generate Redis service
 */
function generateRedisService(config: any): string {
  return `  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass \${REDIS_PASSWORD:-redis}
    ports:
      - "\${REDIS_PORT:-6379}:6379"
    networks:
      - postgrest-network
    volumes:
      - redis_data:/data`;
}

/**
 * Generate networks section
 */
function generateNetworks(): string {
  return `
networks:
  postgrest-network:
    driver: bridge`;
}

/**
 * Generate volumes section
 */
function generateVolumes(config: any): string {
  const volumeList = ['postgres_data'];
  
  if (config.services.includes('pgadmin')) {
    volumeList.push('pgadmin_data');
  }
  
  if (config.services.includes('redis')) {
    volumeList.push('redis_data');
  }
  
  return `
volumes:
  ${volumeList.map(vol => `${vol}:`).join('\n  ')}`;
}

/**
 * Generate PostgREST services for appending
 */
function generatePostgrestServices(config: any): string {
  return generateAllServices(config);
}

/**
 * Generate environment file
 */
function generateEnvFile(config: any): string {
  const dbUser = config.dbUser || 'postgres';
  const dbPassword = config.dbPassword || 'your-secure-postgres-password';
  const dbName = config.dbName || 'postgres';
  const jwtSecret = config.jwtSecret || 'your-jwt-secret-must-be-at-least-32-characters-long';
  const apiSchemas = config.apiSchemas || 'api';
  const anonRole = config.anonRole || POSTGREST_DEFAULTS.dbAnonRole;
  const corsOrigins = config.enableCors ? '*' : '';
  
  return `# PostgREST Environment Variables
# Copy to .env and customize for your environment
# Generated: ${new Date().toISOString()}
# Environment: ${config.environment}

# Database Configuration
POSTGRES_USER=${dbUser}
POSTGRES_PASSWORD=${dbPassword}
POSTGRES_DB=${dbName}
POSTGRES_PORT=5432
DATABASE_URL=postgresql://${dbUser}:${dbPassword}@postgres:5432/${dbName}

# PostgREST Configuration
POSTGREST_PORT=3000
PGRST_DB_SCHEMAS=${apiSchemas}
PGRST_DB_ANON_ROLE=${anonRole}
JWT_SECRET=${jwtSecret}
CORS_ORIGINS=${corsOrigins}
LOG_LEVEL=${config.environment === 'production' ? 'error' : 'info'}

# Optional Services
${config.services.includes('swagger') ? `SWAGGER_PORT=8080` : `# SWAGGER_PORT=8080`}
${config.services.includes('pgadmin') ? `PGADMIN_PORT=5050
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=admin` : `# PGADMIN_PORT=5050
# PGADMIN_EMAIL=admin@example.com
# PGADMIN_PASSWORD=admin`}
${config.services.includes('redis') ? `REDIS_PORT=6379
REDIS_PASSWORD=redis` : `# REDIS_PORT=6379
# REDIS_PASSWORD=redis`}

# Security Notes for ${config.environment}:
${config.environment === 'production' ? 
`# - These are PRODUCTION credentials - keep them secure!
# - Use strong, unique passwords for all services
# - Set specific CORS origins (not *)
# - Enable HTTPS/TLS
# - Regular security updates
# - Monitor access logs` :
`# - These are DEVELOPMENT credentials
# - Change passwords for production
# - JWT secret should be 64+ characters for production
# - CORS is set to * for development convenience`}
# - Never commit this file with real secrets to version control`;
}

/**
 * Display Docker usage instructions
 */
async function displayDockerUsage(config: any) {
  logger.newLine();
  logger.info(chalk.cyan('🚀 Docker Setup Complete'));
  
  if (config.services.includes('postgres')) {
    logger.newLine();
    logger.info(chalk.yellow('🔐 Database Configuration:'));
    logger.list([
      `Database: ${config.dbName || 'postgres'}`,
      `Username: ${config.dbUser || 'postgres'}`,
      'Password: [PROTECTED]',
      'Port: 5432 (mapped to host)'
    ]);
  }
  
  if (config.services.includes('postgrest')) {
    logger.newLine();
    logger.info(chalk.yellow('⚙️  PostgREST Configuration:'));
    logger.list([
      `API Schemas: ${config.apiSchemas || 'api'}`,
      `Anonymous Role: ${config.anonRole || 'web_anon'}`,
      `CORS: ${config.enableCors ? 'Enabled (*)' : 'Disabled'}`,
      'JWT Secret: [PROTECTED]'
    ]);
  }
  
  logger.newLine();
  logger.info(chalk.cyan('📋 Usage Instructions:'));
  logger.list([
    'Review and customize .env.example file',
    'Copy .env.example to .env',
    'Run: docker compose up -d',
    'View logs: docker compose logs -f',
    'Stop: docker compose down'
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow('🌐 Service URLs:'));
  
  const postgrestConfig = await getPostgRESTConfig();
  const serverPort = postgrestConfig.serverPort;
  
  const urls = [
    `PostgREST API: http://localhost:${serverPort}`,
    `OpenAPI Schema: http://localhost:${serverPort}/`
  ];
  
  if (config.services.includes('swagger')) {
    urls.push('Swagger UI: http://localhost:8080');
  }
  
  if (config.services.includes('pgadmin')) {
    urls.push('pgAdmin: http://localhost:5050');
  }
  
  if (config.services.includes('redis')) {
    urls.push('Redis: localhost:6379');
  }
  
  logger.list(urls);
  
  logger.newLine();
  logger.info(chalk.cyan('🐳 Docker Commands:'));
  logger.code(`# Start all services
docker compose up -d

# View PostgREST logs
docker compose logs -f postgrest

# View all logs
docker compose logs -f

# Stop all services  
docker compose down

# Reset everything (⚠️  deletes data)
docker compose down -v

# Rebuild after changes
docker compose up -d --build`);
  
  logger.newLine();
  logger.info(chalk.cyan('🔧 Testing Your API:'));
  logger.code(`# Test API connection
curl http://localhost:${serverPort}/

# Test with schema
curl http://localhost:${serverPort}/${config.apiSchemas || 'api'}/`);
  
  if (config.environment === 'production') {
    logger.newLine();
    logger.warn(chalk.red('🔒 Production Security:'));
    logger.list([
      'Review all passwords and secrets in .env',
      'Set specific CORS origins (not *)',
      'Enable HTTPS/TLS termination',
      'Configure firewall rules',
      'Set up log monitoring',
      'Regular PostgreSQL backups',
      'Security updates for all images'
    ]);
  } else {
    logger.newLine();
    logger.info(chalk.yellow('💡 Development Tips:'));
    logger.list([
      'JWT secret has been generated for you',
      'CORS is enabled for local development',
      'Database data persists in Docker volumes',
      'Check logs if API returns errors',
      'Use pgAdmin to inspect your database'
    ]);
  }
}