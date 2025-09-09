/**
 * @fileoverview Configuration update command
 * 
 * Safely update PostgREST and Docker configurations with validation
 * and backup capabilities. Handles environment-specific updates.
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
import { POSTGREST_DEFAULTS, getPostgRESTConfig } from '../../../utils/postgrest-config.js';

/**
 * Create update config command
 */
export function createUpdateConfigCommand(): Command {
  const command = new Command('config');
  
  command
    .description('Update PostgREST and deployment configurations')
    .option('--target <type>', 'Configuration to update (postgrest|docker|env|all)')
    .option('--env <environment>', 'Target environment (development|staging|production)')
    .option('--backup', 'Create backup of existing config', true)
    .option('--validate', 'Validate configuration after update', true)
    .option('--restart', 'Restart services after configuration update')
    .option('--dry-run', 'Preview changes without applying')
    .action(async (options) => {
      await updateConfiguration(options);
    });
  
  return command;
}

/**
 * Update configuration files
 */
async function updateConfiguration(options: any) {
  logger.info(chalk.cyan('⚙️  PGRestify Configuration Update'));
  logger.info('Safely update your PostgREST and deployment configurations.');
  logger.newLine();
  
  // Analyze current configuration
  const currentConfig = await analyzeCurrentConfiguration();
  
  // Collect update preferences
  const config = await collectUpdateConfig(options, currentConfig);
  
  // Generate updated configurations
  const updates = await generateConfigurationUpdates(config);
  
  // Create backups if requested
  if (config.backup && !config.dryRun) {
    await createConfigurationBackups(config);
  }
  
  // Apply or preview changes
  if (config.dryRun) {
    await previewConfigurationChanges(config, updates);
  } else {
    await applyConfigurationChanges(config, updates);
  }
  
  // Validate updated configuration
  if (config.validate && !config.dryRun) {
    await validateUpdatedConfiguration(config);
  }
  
  // Restart services if requested
  if (config.restart && !config.dryRun) {
    await restartServices(config);
  }
}

/**
 * Analyze current configuration state
 */
async function analyzeCurrentConfiguration() {
  logger.info(chalk.blue('🔍 Analyzing current configuration...'));
  
  const config: any = {
    postgrestConf: null,
    dockerCompose: null,
    envFile: null,
    packageJson: null
  };
  
  // Check for existing configuration files
  const files = [
    { key: 'postgrestConf', path: './postgrest.conf' },
    { key: 'dockerCompose', path: './docker-compose.yml' },
    { key: 'envFile', path: './.env' },
    { key: 'packageJson', path: './package.json' }
  ];
  
  for (const file of files) {
    if (await fs.exists(file.path)) {
      try {
        const content = await fs.readFile(file.path);
        config[file.key] = {
          path: file.path,
          content: content,
          exists: true
        };
        logger.info(`  ✅ Found ${file.path}`);
      } catch (error) {
        logger.warn(`  ⚠️  Could not read ${file.path}: ${error.message}`);
      }
    } else {
      logger.info(`  ❌ Missing ${file.path}`);
    }
  }
  
  return config;
}

/**
 * Collect update configuration
 */
async function collectUpdateConfig(options: any, currentConfig: any) {
  const config: any = {
    target: options.target,
    environment: options.env || 'development',
    backup: options.backup !== false,
    validate: options.validate !== false,
    restart: options.restart || false,
    dryRun: options.dryRun || false,
    projectPath: process.cwd(),
    currentConfig
  };
  
  if (!config.target) {
    // Interactive mode to select what to update
    const targetSelection = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'targets',
        message: 'Select configurations to update:',
        choices: [
          { 
            name: 'PostgREST configuration (postgrest.conf)', 
            value: 'postgrest',
            checked: currentConfig.postgrestConf?.exists
          },
          { 
            name: 'Docker Compose (docker-compose.yml)', 
            value: 'docker',
            checked: currentConfig.dockerCompose?.exists
          },
          { 
            name: 'Environment variables (.env)', 
            value: 'env',
            checked: currentConfig.envFile?.exists
          },
          { 
            name: 'Package.json scripts', 
            value: 'package',
            checked: currentConfig.packageJson?.exists
          }
        ],
        validate: (input: string[]) => input.length > 0 || 'Select at least one configuration to update'
      }
    ]);
    
    config.targets = targetSelection.targets;
  } else {
    config.targets = config.target === 'all' 
      ? ['postgrest', 'docker', 'env', 'package']
      : [config.target];
  }
  
  // Collect specific update preferences
  for (const target of config.targets) {
    config[target] = await collectTargetSpecificConfig(target, config);
  }
  
  return config;
}

/**
 * Collect target-specific configuration
 */
async function collectTargetSpecificConfig(target: string, config: any) {
  logger.newLine();
  logger.info(chalk.cyan(`⚙️  ${target.charAt(0).toUpperCase() + target.slice(1)} Configuration`));
  
  switch (target) {
    case 'postgrest':
      return await collectPostgRESTConfig(config);
    case 'docker':
      return await collectDockerConfig(config);
    case 'env':
      return await collectEnvironmentConfig(config);
    case 'package':
      return await collectPackageConfig(config);
    default:
      return {};
  }
}

/**
 * Collect PostgREST configuration updates
 */
async function collectPostgRESTConfig(config: any) {
  const currentPostgREST = parsePostgRESTConfig(config.currentConfig.postgrestConf?.content || '');
  
  return await inquirer.prompt([
    {
      type: 'input',
      name: 'dbUri',
      message: 'Database URI:',
      default: currentPostgREST['db-uri'] || 'postgresql://postgres:postgres@localhost:5432/postgres',
      validate: (input: string) => input.includes('postgresql://') || 'Must be a valid PostgreSQL URI'
    },
    {
      type: 'input',
      name: 'dbSchemas',
      message: 'API schemas (comma-separated):',
      default: currentPostgREST['db-schemas'] || POSTGREST_DEFAULTS.dbSchemas
    },
    {
      type: 'input',
      name: 'anonRole',
      message: 'Anonymous role:',
      default: currentPostgREST['db-anon-role'] || POSTGREST_DEFAULTS.dbAnonRole
    },
    {
      type: 'input',
      name: 'authRole',
      message: 'Authenticated role:',
      default: currentPostgREST['db-authenticated-role'] || 'authenticated'
    },
    {
      type: 'input',
      name: 'serverPort',
      message: 'Server port:',
      default: currentPostgREST['server-port'] || '3000',
      validate: (input: string) => {
        const port = parseInt(input);
        return (port > 0 && port < 65536) || 'Must be a valid port number';
      }
    },
    {
      type: 'input',
      name: 'serverHost',
      message: 'Server host:',
      default: currentPostgREST['server-host'] || '0.0.0.0'
    },
    {
      type: 'confirm',
      name: 'enableCors',
      message: 'Enable CORS?',
      default: config.environment === 'development'
    },
    {
      type: 'input',
      name: 'corsOrigins',
      message: 'CORS allowed origins:',
      default: config.environment === 'development' ? '*' : '',
      when: (answers: any) => answers.enableCors
    },
    {
      type: 'input',
      name: 'dbPool',
      message: 'Database connection pool size:',
      default: config.environment === 'production' ? '100' : '10',
      validate: (input: string) => {
        const pool = parseInt(input);
        return (pool > 0 && pool <= 200) || 'Pool size must be between 1 and 200';
      }
    },
    {
      type: 'list',
      name: 'logLevel',
      message: 'Log level:',
      choices: ['error', 'warn', 'info', 'debug'],
      default: config.environment === 'production' ? 'error' : 'info'
    }
  ]);
}

/**
 * Collect Docker configuration updates
 */
async function collectDockerConfig(config: any) {
  const currentDocker = parseDockerCompose(config.currentConfig.dockerCompose?.content || '');
  
  return await inquirer.prompt([
    {
      type: 'input',
      name: 'postgresVersion',
      message: 'PostgreSQL version:',
      default: extractImageVersion(currentDocker.services?.postgres?.image) || '15-alpine'
    },
    {
      type: 'input',
      name: 'postgrestVersion',
      message: 'PostgREST version:',
      default: extractImageVersion(currentDocker.services?.postgrest?.image) || 'latest'
    },
    {
      type: 'confirm',
      name: 'includeAdminer',
      message: 'Include Adminer (database admin interface)?',
      default: !!currentDocker.services?.adminer
    },
    {
      type: 'confirm',
      name: 'includeNginx',
      message: 'Include Nginx reverse proxy?',
      default: !!currentDocker.services?.nginx
    },
    {
      type: 'confirm',
      name: 'enableSSL',
      message: 'Enable SSL/TLS configuration?',
      default: config.environment === 'production'
    },
    {
      type: 'input',
      name: 'postgresPort',
      message: 'PostgreSQL external port:',
      default: '5432',
      validate: (input: string) => {
        const port = parseInt(input);
        return (port > 0 && port < 65536) || 'Must be a valid port number';
      }
    },
    {
      type: 'input',
      name: 'postgrestPort',
      message: 'PostgREST external port:',
      default: '3000',
      validate: (input: string) => {
        const port = parseInt(input);
        return (port > 0 && port < 65536) || 'Must be a valid port number';
      }
    }
  ]);
}

/**
 * Collect environment configuration updates
 */
async function collectEnvironmentConfig(config: any) {
  const currentEnv = parseEnvFile(config.currentConfig.envFile?.content || '');
  
  return await inquirer.prompt([
    {
      type: 'input',
      name: 'postgresUser',
      message: 'PostgreSQL username:',
      default: currentEnv.POSTGRES_USER || 'postgres'
    },
    {
      type: 'password',
      name: 'postgresPassword',
      message: 'PostgreSQL password:',
      mask: '*',
      validate: (input: string) => {
        if (config.environment === 'production') {
          return input.length >= 12 || 'Production password must be at least 12 characters';
        }
        return input.length >= 6 || 'Password must be at least 6 characters';
      }
    },
    {
      type: 'input',
      name: 'postgresDB',
      message: 'PostgreSQL database name:',
      default: currentEnv.POSTGRES_DB || path.basename(process.cwd()).replace(/[^a-zA-Z0-9_]/g, '_')
    },
    {
      type: 'input',
      name: 'jwtSecret',
      message: 'JWT Secret (leave empty to generate new):',
      default: currentEnv.JWT_SECRET || ''
    }
  ]);
}

/**
 * Collect package.json configuration updates
 */
async function collectPackageConfig(config: any) {
  return await inquirer.prompt([
    {
      type: 'confirm',
      name: 'updateScripts',
      message: 'Update PGRestify scripts in package.json?',
      default: true
    },
    {
      type: 'confirm',
      name: 'addDevDependencies',
      message: 'Add recommended development dependencies?',
      default: false
    },
    {
      type: 'confirm',
      name: 'updateKeywords',
      message: 'Update package keywords?',
      default: false
    }
  ]);
}

/**
 * Generate configuration updates
 */
async function generateConfigurationUpdates(config: any) {
  logger.info(chalk.blue('📝 Generating configuration updates...'));
  
  const updates: any = {};
  
  for (const target of config.targets) {
    switch (target) {
      case 'postgrest':
        updates.postgrest = generatePostgRESTUpdate(config);
        break;
      case 'docker':
        updates.docker = generateDockerUpdate(config);
        break;
      case 'env':
        updates.env = generateEnvUpdate(config);
        break;
      case 'package':
        updates.package = await generatePackageUpdate(config);
        break;
    }
  }
  
  return updates;
}

/**
 * Generate PostgREST configuration update
 */
function generatePostgRESTUpdate(config: any) {
  const postgrestConfig = config.postgrest;
  
  return `# PostgREST Configuration
# Updated: ${new Date().toISOString()}
# Environment: ${config.environment}

# Database connection
db-uri = "${postgrestConfig.dbUri}"
db-schemas = "${postgrestConfig.dbSchemas}"
db-anon-role = "${postgrestConfig.anonRole}"
db-authenticated-role = "${postgrestConfig.authRole}"

# Authentication
jwt-secret = "${postgrestConfig.jwtSecret || generateJWTSecret()}"

# Server configuration
server-host = "${postgrestConfig.serverHost}"
server-port = ${postgrestConfig.serverPort}
${postgrestConfig.enableCors ? `server-cors-allowed-origins = "${postgrestConfig.corsOrigins}"` : '# CORS disabled'}

# Performance
db-pool = ${postgrestConfig.dbPool}
db-pool-timeout = ${POSTGREST_DEFAULTS.dbPoolTimeout}
db-pool-acquisition-timeout = ${POSTGREST_DEFAULTS.dbPoolAcquisitionTimeout * 1000}

# Logging
log-level = "${postgrestConfig.logLevel}"

# Security (Production settings)
${config.environment === 'production' ? `
# Production security settings
db-use-legacy-gucs = false
db-max-rows = 1000
db-pre-request = "request.check_rate_limit"
openapi-server-proxy-uri = "https://api.yourapp.com"
` : '# Development settings - relaxed security'}
`;
}

/**
 * Generate Docker Compose update
 */
function generateDockerUpdate(config: any) {
  const dockerConfig = config.docker;
  
  let compose = `# Docker Compose Configuration
# Updated: ${new Date().toISOString()}
# Environment: ${config.environment}

version: '3.8'

services:
  postgres:
    image: postgres:${dockerConfig.postgresVersion}
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: \${POSTGRES_DB}
    ports:
      - "\${POSTGRES_PORT:-${dockerConfig.postgresPort}}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./sql:/docker-entrypoint-initdb.d:ro
    networks:
      - api-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  postgrest:
    image: postgrest/postgrest:${dockerConfig.postgrestVersion}
    restart: unless-stopped
    environment:
      PGRST_DB_URI: postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/\${POSTGRES_DB}
      PGRST_DB_SCHEMAS: \${API_SCHEMAS}
      PGRST_DB_ANON_ROLE: \${ANON_ROLE}
      PGRST_JWT_SECRET: \${JWT_SECRET}
      PGRST_SERVER_PORT: 3000
      PGRST_SERVER_HOST: 0.0.0.0
      ${config.environment === 'production' ? 'PGRST_LOG_LEVEL: error' : 'PGRST_LOG_LEVEL: info'}
    ports:
      - "\${POSTGREST_PORT:-${dockerConfig.postgrestPort}}:3000"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - api-network`;

  // Add Adminer if requested
  if (dockerConfig.includeAdminer) {
    compose += `

  adminer:
    image: adminer:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      ADMINER_DEFAULT_SERVER: postgres
    depends_on:
      - postgres
    networks:
      - api-network`;
  }

  // Add Nginx if requested
  if (dockerConfig.includeNginx) {
    compose += `

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      ${dockerConfig.enableSSL ? '- "443:443"' : ''}
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      ${dockerConfig.enableSSL ? '- ./nginx/ssl:/etc/nginx/ssl:ro' : ''}
    depends_on:
      - postgrest
    networks:
      - api-network`;
  }

  compose += `

volumes:
  postgres_data:

networks:
  api-network:
    driver: bridge`;

  return compose;
}

/**
 * Generate environment file update
 */
function generateEnvUpdate(config: any) {
  const envConfig = config.env;
  
  // Generate JWT secret if not provided
  const jwtSecret = envConfig.jwtSecret || generateJWTSecret();
  
  return `# Environment Configuration
# Updated: ${new Date().toISOString()}
# Environment: ${config.environment}

# Database
POSTGRES_USER=${envConfig.postgresUser}
POSTGRES_PASSWORD=${envConfig.postgresPassword}
POSTGRES_DB=${envConfig.postgresDB}
POSTGRES_PORT=${config.docker?.postgresPort || '5432'}

# PostgREST
POSTGREST_PORT=${config.docker?.postgrestPort || '3000'}
API_SCHEMAS=${config.postgrest?.dbSchemas || 'api'}
ANON_ROLE=${config.postgrest?.anonRole || 'web_anon'}
JWT_SECRET=${jwtSecret}

# Environment-specific settings
NODE_ENV=${config.environment}
LOG_LEVEL=${config.postgrest?.logLevel || 'info'}

${config.environment === 'production' ? `
# Production settings
SSL_ENABLED=true
FORCE_HTTPS=true
RATE_LIMIT_ENABLED=true
` : `
# Development settings
SSL_ENABLED=false
DEBUG=true
`}

# Security note: Keep this file secure and never commit production secrets
`;
}

/**
 * Generate package.json update
 */
async function generatePackageUpdate(config: any) {
  const packageConfig = config.package;
  
  if (!packageConfig.updateScripts && !packageConfig.addDevDependencies && !packageConfig.updateKeywords) {
    return null; // No changes requested
  }
  
  const currentPackage = JSON.parse(config.currentConfig.packageJson?.content || '{}');
  const updatedPackage = { ...currentPackage };
  
  if (packageConfig.updateScripts) {
    updatedPackage.scripts = {
      ...updatedPackage.scripts,
      "pgrestify:start": config.docker ? "docker compose up -d" : "postgrest postgrest.conf",
      "pgrestify:stop": config.docker ? "docker compose down" : "pkill -f postgrest",
      "pgrestify:restart": config.docker ? "docker compose restart" : "pkill -f postgrest && postgrest postgrest.conf &",
      "pgrestify:logs": config.docker ? "docker compose logs -f postgrest" : "tail -f postgrest.log",
      "pgrestify:setup": "./scripts/setup.sh",
      "pgrestify:migrate": "pgrestify api migrate",
      "pgrestify:validate": "pgrestify validate",
      "pgrestify:backup": config.docker 
        ? "docker compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%Y%m%d_%H%M%S).sql"
        : "pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql"
    };
  }
  
  if (packageConfig.addDevDependencies) {
    updatedPackage.devDependencies = {
      ...updatedPackage.devDependencies,
      "@types/node": "^20.0.0",
      "typescript": "^5.0.0",
      "tsx": "^4.0.0",
      "vitest": "^1.0.0"
    };
  }
  
  if (packageConfig.updateKeywords) {
    const existingKeywords = new Set(updatedPackage.keywords || []);
    const newKeywords = ["postgrest", "api", "postgresql", "rest", "typescript"];
    
    newKeywords.forEach(keyword => {
      if (!existingKeywords.has(keyword)) {
        updatedPackage.keywords = [...(updatedPackage.keywords || []), keyword];
      }
    });
  }
  
  return JSON.stringify(updatedPackage, null, 2);
}

/**
 * Create configuration backups
 */
async function createConfigurationBackups(config: any) {
  logger.info(chalk.blue('💾 Creating configuration backups...'));
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `${config.projectPath}/backups/config_${timestamp}`;
  
  await fs.ensureDir(backupDir);
  
  for (const target of config.targets) {
    const currentConfig = config.currentConfig;
    
    switch (target) {
      case 'postgrest':
        if (currentConfig.postgrestConf?.exists) {
          await fs.copyFile('./postgrest.conf', `${backupDir}/postgrest.conf`);
          logger.info(`  📄 Backed up postgrest.conf`);
        }
        break;
        
      case 'docker':
        if (currentConfig.dockerCompose?.exists) {
          await fs.copyFile('./docker-compose.yml', `${backupDir}/docker-compose.yml`);
          logger.info(`  🐳 Backed up docker-compose.yml`);
        }
        break;
        
      case 'env':
        if (currentConfig.envFile?.exists) {
          await fs.copyFile('./.env', `${backupDir}/.env`);
          logger.info(`  🔧 Backed up .env`);
        }
        break;
        
      case 'package':
        if (currentConfig.packageJson?.exists) {
          await fs.copyFile('./package.json', `${backupDir}/package.json`);
          logger.info(`  📦 Backed up package.json`);
        }
        break;
    }
  }
  
  config.backupDir = backupDir;
  logger.success(`✅ Backups created in: ${backupDir}`);
}

/**
 * Preview configuration changes
 */
async function previewConfigurationChanges(config: any, updates: any) {
  logger.info(chalk.yellow('👀 Preview Mode - Changes will NOT be applied'));
  logger.newLine();
  
  for (const target of config.targets) {
    if (updates[target]) {
      logger.info(chalk.cyan(`📄 ${target.charAt(0).toUpperCase() + target.slice(1)} Configuration:`));
      logger.newLine();
      
      // Show preview of changes
      const preview = updates[target].split('\n').slice(0, 20).join('\n');
      logger.code(preview);
      
      if (updates[target].split('\n').length > 20) {
        logger.info(chalk.gray('... (truncated)'));
      }
      
      logger.newLine();
    }
  }
  
  logger.info(chalk.blue('💡 Run without --dry-run to apply these changes'));
}

/**
 * Apply configuration changes
 */
async function applyConfigurationChanges(config: any, updates: any) {
  logger.info(chalk.blue('🔧 Applying configuration changes...'));
  
  // Confirm unless force flag is used
  if (!config.force) {
    const confirm = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'Apply configuration changes?',
      default: false
    }]);
    
    if (!confirm.proceed) {
      logger.info(chalk.blue('Operation cancelled.'));
      return;
    }
  }
  
  // Apply each configuration update
  for (const target of config.targets) {
    if (updates[target]) {
      try {
        switch (target) {
          case 'postgrest':
            await fs.writeFile('./postgrest.conf', updates.postgrest);
            logger.info(`  ✅ Updated postgrest.conf`);
            break;
            
          case 'docker':
            await fs.writeFile('./docker-compose.yml', updates.docker);
            logger.info(`  ✅ Updated docker-compose.yml`);
            break;
            
          case 'env':
            await fs.writeFile('./.env', updates.env);
            logger.info(`  ✅ Updated .env`);
            break;
            
          case 'package':
            await fs.writeFile('./package.json', updates.package);
            logger.info(`  ✅ Updated package.json`);
            break;
        }
      } catch (error) {
        logger.error(`  ❌ Failed to update ${target}: ${error.message}`);
      }
    }
  }
  
  logger.success('✅ Configuration updates applied!');
}

/**
 * Validate updated configuration
 */
async function validateUpdatedConfiguration(config: any) {
  logger.info(chalk.blue('🔍 Validating updated configuration...'));
  
  try {
    // Use the validation command to check configuration
    await fs.exec('pgrestify validate --config --security');
    logger.success('✅ Configuration validation passed!');
  } catch (error) {
    logger.error(`❌ Configuration validation failed: ${error.message}`);
    logger.info('💡 Review the configuration files and fix any issues.');
  }
}

/**
 * Restart services after configuration changes
 */
async function restartServices(config: any) {
  logger.info(chalk.blue('🔄 Restarting services...'));
  
  try {
    if (await fs.exists('./docker-compose.yml')) {
      // Docker-based restart
      logger.info('  🐳 Restarting Docker services...');
      await fs.exec('docker compose down');
      await fs.exec('docker compose up -d');
      
      // Wait for services to be ready
      logger.info('  ⏳ Waiting for services to be ready...');
      await fs.exec('sleep 10');
      
      // Test API connectivity
      try {
        const postgrestPort = config.docker?.postgrestPort || '3000';
        await fs.exec(`curl -f http://localhost:${postgrestPort}/`);
        logger.success('  ✅ PostgREST API is responding');
      } catch {
        logger.warn('  ⚠️  PostgREST API not ready yet');
      }
      
    } else {
      // Local restart
      logger.info('  🔄 Restarting local PostgREST...');
      await fs.exec('pkill -f postgrest || true');
      await fs.exec('postgrest postgrest.conf &');
      
      logger.info('  ⏳ Waiting for PostgREST to start...');
      await fs.exec('sleep 5');
    }
    
    logger.success('✅ Services restarted successfully!');
    
  } catch (error) {
    logger.error(`❌ Failed to restart services: ${error.message}`);
    logger.info('💡 You may need to restart services manually.');
  }
}

// Utility functions for parsing existing configurations

function parsePostgRESTConfig(content: string): Record<string, string> {
  const config: Record<string, string> = {};
  
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        config[key.trim()] = valueParts.join('=').trim().replace(/"/g, '');
      }
    }
  });
  
  return config;
}

function parseDockerCompose(content: string): any {
  try {
    const yaml = require('js-yaml');
    return yaml.load(content) || {};
  } catch {
    return {};
  }
}

function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return env;
}

function extractImageVersion(image: string): string {
  if (!image) return '';
  const parts = image.split(':');
  return parts.length > 1 ? parts[1] : 'latest';
}

function generateJWTSecret(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('base64');
}