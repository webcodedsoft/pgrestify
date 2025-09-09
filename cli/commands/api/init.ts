/**
 * @fileoverview API initialization command
 * 
 * Complete PostgREST API setup with interactive configuration.
 * Combines schema generation, configuration setup, and deployment options
 * in a single comprehensive initialization flow.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { fs } from '../../utils/fs.js';
import { TestingDataGenerator, TestingDataConfig } from '../../generators/TestingDataGenerator.js';
import { 
  writeTableSQL, 
  SQL_FILE_TYPES,
  createTableFolderStructure,
  getSQLFilesForMigration 
} from '../../utils/sql-structure.js';
import { getHashService } from '../../utils/hash-service.js';
import { getPostgRESTConfig, generateGrantStatement, POSTGREST_DEFAULTS } from '../../utils/postgrest-config.js';

/**
 * Create API init command
 */
export function createInitCommand(): Command {
  const command = new Command('init');
  
  command
    .description('Initialize PostgREST API configuration in current directory')
    .option('--skip-prompts', 'Skip interactive prompts (use defaults)')
    .option('--template <type>', 'Schema template (basic|blog|ecommerce|custom)', 'basic')
    .option('--env <environment>', 'Target environment (development|production)', 'development')
    .option('--local', 'Use local PostgreSQL instead of Docker (default: Docker)')
    .option('--run-migrations', 'Automatically run database migrations after generation')
    .option('--testing-data', 'Generate realistic testing/dummy data and apply it automatically')
    .option('--testing-records <count>', 'Number of records to generate (default: 50)', '50')
    .option('--testing-with-images', 'Include image URLs in testing data where applicable')
    .action(async (options) => {
      await initializeAPI(options);
    });
  
  return command;
}

/**
 * Initialize PostgREST API configuration
 */
async function initializeAPI(options: any) {
  logger.info(chalk.cyan('🚀 Initializing PostgREST API Configuration'));
  logger.info(`Directory: ${chalk.bold(process.cwd())}`);
  logger.newLine();
  
  // Step 1: Collect configuration
  const config = await collectProjectConfig(options);
  
  // Step 2: Create necessary directories
  await createDirectoryStructure(config);
  
  // Step 3: Generate configuration files
  await generateConfigurationFiles(config);
  
  // Step 4: Generate testing data (if requested)
  if (config.generateTestingData) {
    await generateTestingData(config);
  }

  // Step 5: Prompt for role setup execution
  await promptRoleSetupExecution(config);

  // Step 6: Run database migrations (if requested)
  if (config.runMigrations) {
    await runDatabaseMigrations(config);
  }

  // Step 6: Attempt automatic setup (if testing data requested)
  if (config.autoSetup) {
    await attemptAutomaticSetup(config);
  }

  // Step 7: Display completion instructions
  displayCompletionInstructions(config);
}

/**
 * Collect project configuration
 */
async function collectProjectConfig(options: any) {
  if (options.skipPrompts) {
    return await getDefaultConfig(options);
  }
  
  logger.info(chalk.cyan('📋 PostgREST Configuration'));
  logger.info('Let\'s set up your PostgREST API configuration step by step.');
  logger.newLine();
  
  // Basic configuration
  const projectConfig = await inquirer.prompt([
    {
      type: 'list',
      name: 'template',
      message: 'Choose a schema template:',
      choices: [
        { name: 'Basic - Simple tables and authentication', value: 'basic' },
        { name: 'Blog - Posts, comments, categories', value: 'blog' },
        { name: 'E-commerce - Products, orders, customers', value: 'ecommerce' },
        { name: 'Custom - I\'ll define my own schema', value: 'custom' }
      ],
      default: options.template
    },
    {
      type: 'list',
      name: 'environment',
      message: 'Target environment:',
      choices: [
        { name: 'Development - Local development setup', value: 'development' },
        { name: 'Staging - Testing environment', value: 'staging' },
        { name: 'Production - Production deployment', value: 'production' }
      ],
      default: options.env
    },
    {
      type: 'confirm',
      name: 'useDocker',
      message: 'Use Docker for deployment?',
      default: true
    }
  ]);
  
  // Database configuration
  logger.newLine();
  logger.info(chalk.cyan('🔧 Database Configuration'));
  
  const dbConfig = await inquirer.prompt([
    {
      type: 'input',
      name: 'host',
      message: 'Database host:',
      default: projectConfig.useDocker ? 'postgres' : 'localhost',
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
      default: path.basename(process.cwd()).replace(/[^a-zA-Z0-9_]/g, '_'),
      validate: (input: string) => input.trim().length > 0 || 'Database name is required'
    },
    {
      type: 'input',
      name: 'username',
      message: 'Database username:',
      default: 'postgres',
      validate: (input: string) => input.trim().length > 0 || 'Username is required'
    },
    {
      type: 'password',
      name: 'password',
      message: 'Database password:',
      mask: '*',
      validate: (input: string) => {
        if (projectConfig.environment === 'production') {
          return input.length >= 12 || 'Production password must be at least 12 characters';
        }
        return input.length >= 6 || 'Password must be at least 6 characters';
      }
    }
  ]);
  
  // PostgREST configuration
  logger.newLine();
  logger.info(chalk.cyan('⚙️  PostgREST Configuration'));
  
  const postgrestConfig = await inquirer.prompt([
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
      name: 'authenticatedRole',
      message: 'Authenticated user role:',
      default: 'web_user',
      validate: (input: string) => input.trim().length > 0 || 'Authenticated role is required'
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
      message: 'Enable CORS?',
      default: projectConfig.environment === 'development'
    },
    {
      type: 'input',
      name: 'serverPort',
      message: 'PostgREST server port:',
      default: POSTGREST_DEFAULTS.serverPort.toString(),
      validate: (input: string) => {
        const port = parseInt(input);
        return (port > 0 && port < 65536) || 'Must be a valid port number';
      }
    }
  ]);
  
  // Generate JWT secret if not provided
  if (!postgrestConfig.jwtSecret) {
    const crypto = await import('crypto');
    postgrestConfig.jwtSecret = crypto.randomBytes(32).toString('base64');
    logger.info(chalk.yellow('✨ Generated JWT secret'));
  }
  
  // Additional features
  logger.newLine();
  logger.info(chalk.cyan('🔧 Additional Features'));
  
  const featuresConfig = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'includeRLS',
      message: 'Include Row Level Security policies?',
      default: true
    },
    {
      type: 'confirm',
      name: 'includeAuth',
      message: 'Include authentication functions?',
      default: true
    },
    {
      type: 'confirm',
      name: 'includeFunctions',
      message: 'Include utility functions?',
      default: true
    },
    {
      type: 'confirm',
      name: 'includeViews',
      message: 'Include database views?',
      default: projectConfig.template !== 'custom'
    },
    {
      type: 'confirm',
      name: 'includeTriggers',
      message: 'Include audit triggers?',
      default: projectConfig.environment === 'production'
    },
    {
      type: 'confirm',
      name: 'includeIndexes',
      message: 'Include performance indexes?',
      default: true
    },
    {
      type: 'confirm',
      name: 'runMigrations',
      message: 'Run database migrations now?',
      default: false
    },
    {
      type: 'confirm',
      name: 'generateTestingData',
      message: 'Generate realistic testing/dummy data?',
      default: false,
      when: (answers: any) => answers.template !== 'custom'
    },
    {
      type: 'input',
      name: 'testingRecordCount',
      message: 'How many records per table?',
      default: 50,
      when: (answers: any) => answers.generateTestingData,
      validate: (input: string) => {
        const count = parseInt(input);
        return (count > 0 && count <= 1000) || 'Must be between 1 and 1000';
      },
      filter: (input: string) => parseInt(input)
    },
    {
      type: 'confirm',
      name: 'includeTestingImages',
      message: 'Include placeholder images in testing data?',
      default: true,
      when: (answers: any) => answers.generateTestingData
    }
  ]);
  
  return {
    ...projectConfig,
    ...dbConfig,
    ...postgrestConfig,
    ...featuresConfig,
    apiSchemas: postgrestConfig.apiSchemas.split(',').map(s => s.trim()),
    currentDir: process.cwd()
  };
}

/**
 * Get default configuration for non-interactive mode
 */
async function getDefaultConfig(options: any) {
  const crypto = await import('crypto');
  
  return {
    template: options.template || 'basic',
    environment: options.env || 'development',
    useDocker: !options.local,
    
    // Database defaults
    host: options.local ? 'localhost' : 'postgres',
    port: '5432',
    database: path.basename(process.cwd()).replace(/[^a-zA-Z0-9_]/g, '_'),
    username: 'postgres',
    password: 'postgres',
    
    // PostgREST defaults (should match postgrest-config.ts defaults)
    apiSchemas: ['api'],
    anonRole: 'web_anon',
    authenticatedRole: 'authenticated',
    jwtSecret: crypto.randomBytes(32).toString('base64'),
    enableCors: options.env === 'development',
    serverPort: '3000',
    
    // Features defaults
    includeRLS: true,
    includeAuth: true,
    includeFunctions: true,
    includeViews: true,
    includeTriggers: options.env === 'production',
    includeIndexes: true,
    runMigrations: options.runMigrations || false,
    
    // Testing data defaults - when testing data is requested, auto-setup is enabled
    generateTestingData: options.testingData || false,
    includeTestingData: options.testingData || false,
    autoSetup: options.testingData || false, // Automatically setup when testing data is requested
    testingRecordCount: parseInt(options.testingRecords) || 50,
    includeTestingImages: options.testingWithImages || false,
    
    currentDir: process.cwd()
  };
}

/**
 * Create directory structure in current directory
 */
async function createDirectoryStructure(config: any) {
  logger.info(chalk.cyan('📁 Creating Directory Structure'));
  
  const currentPath = process.cwd();
  
  // Create directories in current directory
  const directories = [
    `${currentPath}/sql`,
    `${currentPath}/sql/schemas`,
    `${currentPath}/sql/functions`, 
    // `${currentPath}/sql/migrations`,
    `${currentPath}/scripts`
  ];
  
  if (config.useDocker) {
    directories.push(`${currentPath}/docker`);
  }
  
  for (const dir of directories) {
    await fs.ensureDir(dir);
    logger.info(`  📁 ${path.relative(currentPath, dir)}`);
  }
  
  config.currentPath = currentPath;
}

/**
 * Generate testing data
 */
async function generateTestingData(config: any) {
  logger.newLine();
  logger.info(chalk.cyan('🎲 Generating Testing Data'));
  logger.info(`Creating ${config.testingRecordCount} records per table...`);
  
  try {
    const testingDataGenerator = new TestingDataGenerator(config.currentPath);
    const testingDataConfig: TestingDataConfig = {
      template: config.template as 'basic' | 'blog' | 'ecommerce',
      recordCount: config.testingRecordCount || 50,
      includeImages: config.includeTestingImages || false,
      generateRealistic: true
    };
    
    const testingDataSQL = await testingDataGenerator.generateTestingData(testingDataConfig);
    
    // Write testing data to SQL file
    const testingDataPath = `${config.currentPath}/sql/testing_data.sql`;
    await fs.writeFile(testingDataPath, testingDataSQL);
    
    // Track the file write in hash service
    const hashService = getHashService(config.currentPath);
    await hashService.trackFileWrite(testingDataPath, testingDataSQL);
    
    logger.info(`  📄 Testing data saved to: sql/testing_data.sql`);
    logger.success('✅ Testing data generated successfully!');
    
  } catch (error) {
    logger.error(`Failed to generate testing data: ${error}`);
    logger.info('💡 You can generate testing data later using the pgrestify generate commands.');
  }
}

/**
 * Run database migrations
 */
async function runDatabaseMigrations(config: any) {
  logger.newLine();
  logger.info(chalk.cyan('🗄️  Running Database Migrations'));
  logger.info('Applying generated schema to the database...');
  
  try {
    const dbUri = `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
    
    // Check if psql is available
    try {
      await fs.exec('psql --version');
    } catch {
      logger.error('❌ psql command not found. Please install PostgreSQL client tools.');
      logger.info('💡 Alternative: Run the SQL files manually or use Docker');
      return;
    }
    
    // Get migration files using the new table-folder structure
    const migrationFiles = await getSQLFilesForMigration(config.currentPath);
    
    // Add auth functions (still in old location)
    const authFunctionsPath = `${config.currentPath}/sql/functions/auth.sql`;
    if (await fs.exists(authFunctionsPath)) {
      migrationFiles.unshift(authFunctionsPath); // Add at beginning
    }
    
    // Add setup file first if it exists
    const setupPath = `${config.currentPath}/sql/schemas/_setup/table.sql`;
    if (await fs.exists(setupPath)) {
      const setupIndex = migrationFiles.indexOf(setupPath);
      if (setupIndex > -1) {
        migrationFiles.splice(setupIndex, 1); // Remove from current position
        migrationFiles.unshift(setupPath); // Add at beginning
      }
    }
    
    // Add testing data if generated
    if (config.includeTestingData && await fs.exists(`${config.currentPath}/sql/testing_data.sql`)) {
      migrationFiles.push('sql/testing_data.sql');
    }
    
    if (migrationFiles.length === 0) {
      logger.warn('⚠️  No migration files found');
      logger.info('💡 Make sure the schema files were generated correctly');
      return;
    }
    
    logger.info(`📋 Found ${migrationFiles.length} migration files to apply`);
    
    for (const file of migrationFiles) {
      const filePath = file.startsWith('/') ? file : `${config.currentPath}/${file}`;
      const relativeFile = file.replace(config.currentPath + '/', '');
      
      if (await fs.exists(filePath)) {
        logger.info(`  📄 Applying ${relativeFile}...`);
        try {
          await fs.exec(`psql "${dbUri}" -f "${filePath}" -q`);
          logger.info(`  ✅ Applied ${relativeFile}`);
        } catch (error) {
          logger.error(`  ❌ Failed to apply ${relativeFile}: ${error}`);
          logger.warn('💡 You may need to run the migrations manually.');
          break;
        }
      }
    }
    
    logger.success('✅ Database migrations completed!');
    
  } catch (error) {
    logger.error(`Failed to run migrations: ${error}`);
    logger.info('💡 You can run the migrations manually using: npm run pgrestify:migrate');
  }
}

/**
 * Attempt automatic setup - tries to run setup but gracefully falls back
 */
async function attemptAutomaticSetup(config: any) {
  logger.newLine();
  logger.info(chalk.cyan('🚀 Attempting Automatic Setup'));
  logger.info('Trying to initialize database and apply testing data automatically...');
  
  try {
    // Check if setup script exists
    const setupScriptPath = `${config.currentPath}/scripts/setup.sh`;
    if (!(await fs.exists(setupScriptPath))) {
      logger.info('📝 Setup script will be available for manual execution');
      return;
    }

    // Make sure script is executable
    await fs.exec(`chmod +x "${setupScriptPath}"`);
    
    // Execute the setup script with timeout
    logger.info('🎯 Starting database services and applying schema...');
    
    if (config.useDocker) {
      logger.info('🐳 Checking Docker environment...');
    } else {
      logger.info('💻 Checking local PostgreSQL...');
    }
    
    // Run the setup script with a reasonable timeout  
    await fs.exec(`cd "${config.currentPath}" && ./scripts/setup.sh`);
    
    logger.success('✅ Automatic setup completed successfully!');
    config.setupCompleted = true; // Mark setup as completed
    
    if (config.includeTestingData) {
      logger.info(chalk.green('🎲 Testing data has been loaded into your database'));
      logger.info('📊 Your API is ready to use with sample data');
    }
    
  } catch (error) {
    // Don't treat this as an error - just inform user about manual setup
    logger.info('ℹ️  Automatic setup not available (database services not running)');
    logger.info('💡 No worries! You can set up everything manually with one command.');
  }
}

/**
 * Generate configuration files
 */
async function generateConfigurationFiles(config: any) {
  logger.newLine();
  logger.info(chalk.cyan('📝 Generating Project Files'));
  
  // Generate schema files
  if (config.template !== 'custom') {
    await generateSchemaFiles(config);
  }
  
  // Generate database roles
  await generateRolesFile(config);
  
  // Generate PostgREST configuration
  await generatePostgRESTConfig(config);
  
  // Generate Docker configuration (if selected)
  if (config.useDocker) {
    await generateDockerConfig(config);
  }
  
  // Generate additional SQL files
  await generateAdditionalSQLFiles(config);
  
  // Generate package.json and scripts
  await generatePackageConfig(config);
}

/**
 * Generate schema files based on template
 */
async function generateSchemaFiles(config: any) {
  logger.info('  📄 Schema files (new table-folder structure)');
  
  // Generate schema setup SQL (roles, grants, etc.) in a special _setup folder
  const setupSQL = generateSchemaSetup(config);
  await createTableFolderStructure(config.currentPath, '_setup');
  await writeTableSQL(config.currentPath, '_setup', SQL_FILE_TYPES.TABLE, setupSQL);
  
  // Generate table-specific files based on template
  switch (config.template) {
    case 'basic':
      await generateBasicTableFiles(config);
      break;
    case 'blog':
      await generateBlogTableFiles(config);
      break;
    case 'ecommerce':
      await generateEcommerceTableFiles(config);
      break;
    default:
      await generateBasicTableFiles(config);
  }
}

/**
 * Generate PostgREST configuration
 */
async function generatePostgRESTConfig(config: any) {
  logger.info('  ⚙️  PostgREST configuration');
  
  const postgrestConf = await generatePostgRESTConfigFile(config);
  await fs.writeFile(`${config.currentPath}/postgrest.conf`, postgrestConf);
}

/**
 * Generate Docker configuration
 */
async function generateDockerConfig(config: any) {
  logger.info('  🐳 Docker configuration');
  
  const dockerCompose = generateDockerComposeFile(config);
  await fs.writeFile(`${config.currentPath}/docker-compose.yml`, dockerCompose);
  
  const envFile = generateEnvFile(config);
  await fs.writeFile(`${config.currentPath}/.env.example`, envFile);
  
  // Create .env with actual values for immediate use
  await fs.writeFile(`${config.currentPath}/.env`, envFile);
}

/**
 * Generate schema setup (roles, grants, etc.)
 */
function generateSchemaSetup(config: any): string {
  const schema = config.schemaName || 'api';
  
  return `-- Schema Setup
-- Generated: ${new Date().toISOString()}
-- Template: ${config.template}

-- Create schemas
CREATE SCHEMA IF NOT EXISTS ${schema};
CREATE SCHEMA IF NOT EXISTS private;

-- Create roles
CREATE ROLE ${config.anonRole} NOLOGIN;
CREATE ROLE ${config.authenticatedRole} NOLOGIN;

-- Grant usage on schemas
GRANT USAGE ON SCHEMA ${schema} TO ${config.anonRole}, ${config.authenticatedRole};

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT SELECT ON TABLES TO ${config.anonRole};
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${config.authenticatedRole};
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT USAGE ON SEQUENCES TO ${config.authenticatedRole};`;
}

/**
 * Generate basic template table files
 */
async function generateBasicTableFiles(config: any) {
  const postgrestConfig = await getPostgRESTConfig();
  const schema = config.schemaName || postgrestConfig.schema;
  const anonRole = config.anonRole || postgrestConfig.anonRole;
  const authRole = config.authenticatedRole || 'authenticated';
  
  // Users table
  const usersTableSQL = `CREATE TABLE ${schema}.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ${schema}.users ENABLE ROW LEVEL SECURITY;

-- Grant table permissions
GRANT SELECT ON ${schema}.users TO ${anonRole};
GRANT ALL ON ${schema}.users TO ${authRole};`;

  await writeTableSQL(config.currentPath, 'users', SQL_FILE_TYPES.TABLE, usersTableSQL);

  // Users RLS policies
  if (config.includeRLS) {
    const usersRLSSQL = `-- Users policies
CREATE POLICY "Anyone can view user profiles"
  ON ${schema}.users FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON ${schema}.users FOR UPDATE
  USING (id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

CREATE POLICY "Allow user registration"
  ON ${schema}.users FOR INSERT
  WITH CHECK (true);`;

    await writeTableSQL(config.currentPath, 'users', SQL_FILE_TYPES.RLS, usersRLSSQL);
  }

  // Users indexes
  const usersIndexesSQL = `-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON ${schema}.users (email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON ${schema}.users (created_at);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON ${schema}.users (updated_at);`;

  await writeTableSQL(config.currentPath, 'users', SQL_FILE_TYPES.INDEXES, usersIndexesSQL);

  // Profiles table
  const profilesTableSQL = `CREATE TABLE ${schema}.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ${schema}.users(id) ON DELETE CASCADE,
  bio TEXT,
  website TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE ${schema}.profiles ENABLE ROW LEVEL SECURITY;

-- Grant table permissions
GRANT SELECT ON ${schema}.profiles TO ${anonRole};
GRANT ALL ON ${schema}.profiles TO ${authRole};`;

  await writeTableSQL(config.currentPath, 'profiles', SQL_FILE_TYPES.TABLE, profilesTableSQL);

  // Profiles RLS policies
  if (config.includeRLS) {
    const profilesRLSSQL = `-- Profiles policies  
CREATE POLICY "Anyone can view profile data"
  ON ${schema}.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own profile data"
  ON ${schema}.profiles FOR ALL
  USING (user_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);`;

    await writeTableSQL(config.currentPath, 'profiles', SQL_FILE_TYPES.RLS, profilesRLSSQL);
  }

  // Profiles indexes
  const profilesIndexesSQL = `-- Profiles table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON ${schema}.profiles (user_id);`;

  await writeTableSQL(config.currentPath, 'profiles', SQL_FILE_TYPES.INDEXES, profilesIndexesSQL);

  // Create a combined view
  if (config.includeViews) {
    const viewSQL = `-- User profiles view (combines users and profiles)
CREATE OR REPLACE VIEW ${schema}.user_profiles AS
SELECT 
  u.id,
  u.email,
  u.name,
  u.avatar_url,
  u.created_at,
  u.updated_at,
  p.bio,
  p.website,
  p.location
FROM ${schema}.users u
LEFT JOIN ${schema}.profiles p ON u.id = p.user_id;

-- Grant view permissions
GRANT SELECT ON ${schema}.user_profiles TO ${anonRole}, ${authRole};`;

    // This view references both users and profiles, so we put it in users folder
    await writeTableSQL(config.currentPath, 'users', SQL_FILE_TYPES.VIEWS, viewSQL);
  }
}

/**
 * Generate blog template table files
 */
async function generateBlogTableFiles(config: any) {
  const postgrestConfig = await getPostgRESTConfig();
  const schema = config.schemaName || postgrestConfig.schema;
  const anonRole = config.anonRole || postgrestConfig.anonRole;
  const authRole = config.authenticatedRole || 'authenticated';
  
  // Authors table
  const authorsTableSQL = `CREATE TABLE ${schema}.authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
  name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  website TEXT,
  twitter_handle TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ${schema}.authors ENABLE ROW LEVEL SECURITY;

-- Grant table permissions
GRANT SELECT ON ${schema}.authors TO ${anonRole};
GRANT ALL ON ${schema}.authors TO ${authRole};`;

  await writeTableSQL(config.currentPath, 'authors', SQL_FILE_TYPES.TABLE, authorsTableSQL);

  // Categories table
  const categoriesTableSQL = `CREATE TABLE ${schema}.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ${schema}.categories ENABLE ROW LEVEL SECURITY;

-- Grant table permissions
GRANT SELECT ON ${schema}.categories TO ${anonRole};
GRANT ALL ON ${schema}.categories TO ${authRole};`;

  await writeTableSQL(config.currentPath, 'categories', SQL_FILE_TYPES.TABLE, categoriesTableSQL);

  // Posts table
  const postsTableSQL = `CREATE TABLE ${schema}.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  featured_image TEXT,
  author_id UUID NOT NULL REFERENCES ${schema}.authors(id) ON DELETE CASCADE,
  category_id UUID REFERENCES ${schema}.categories(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ${schema}.posts ENABLE ROW LEVEL SECURITY;

-- Grant table permissions
GRANT SELECT ON ${schema}.posts TO ${anonRole};
GRANT ALL ON ${schema}.posts TO ${authRole};`;

  await writeTableSQL(config.currentPath, 'posts', SQL_FILE_TYPES.TABLE, postsTableSQL);

  // Comments table
  const commentsTableSQL = `CREATE TABLE ${schema}.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES ${schema}.posts(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL CHECK (author_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'spam')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ${schema}.comments ENABLE ROW LEVEL SECURITY;

-- Grant table permissions
GRANT SELECT ON ${schema}.comments TO ${anonRole};
GRANT ALL ON ${schema}.comments TO ${authRole};`;

  await writeTableSQL(config.currentPath, 'comments', SQL_FILE_TYPES.TABLE, commentsTableSQL);

  // Tags table
  const tagsTableSQL = `CREATE TABLE ${schema}.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post-tag junction table
CREATE TABLE ${schema}.post_tags (
  post_id UUID NOT NULL REFERENCES ${schema}.posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES ${schema}.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Enable RLS
ALTER TABLE ${schema}.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.post_tags ENABLE ROW LEVEL SECURITY;

-- Grant table permissions
GRANT SELECT ON ${schema}.tags TO ${anonRole};
GRANT ALL ON ${schema}.tags TO ${authRole};
GRANT SELECT ON ${schema}.post_tags TO ${anonRole};
GRANT ALL ON ${schema}.post_tags TO ${authRole};`;

  await writeTableSQL(config.currentPath, 'tags', SQL_FILE_TYPES.TABLE, tagsTableSQL);

  // Generate RLS policies if enabled
  if (config.includeRLS) {
    await generateBlogRLSPolicies(config, schema, anonRole, authRole);
  }

  // Generate indexes
  await generateBlogIndexes(config, schema);

  // Generate views if enabled
  if (config.includeViews) {
    await generateBlogViews(config, schema, anonRole, authRole);
  }
}

/**
 * Generate blog template RLS policies
 */
async function generateBlogRLSPolicies(config: any, schema: string, anonRole: string, authRole: string) {
  // Authors RLS
  const authorsRLSSQL = `-- Authors policies
CREATE POLICY "Anyone can view author profiles"
  ON ${schema}.authors FOR SELECT
  USING (true);

CREATE POLICY "Authors can update their own profile"
  ON ${schema}.authors FOR UPDATE
  USING (id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);`;

  await writeTableSQL(config.currentPath, 'authors', SQL_FILE_TYPES.RLS, authorsRLSSQL);

  // Categories RLS
  const categoriesRLSSQL = `-- Categories policies
CREATE POLICY "Anyone can view categories"
  ON ${schema}.categories FOR SELECT
  USING (true);

CREATE POLICY "Only authenticated users can manage categories"
  ON ${schema}.categories FOR ALL
  USING (auth.role() = 'admin');`;

  await writeTableSQL(config.currentPath, 'categories', SQL_FILE_TYPES.RLS, categoriesRLSSQL);

  // Posts RLS
  const postsRLSSQL = `-- Posts policies
CREATE POLICY "Anyone can view published posts"
  ON ${schema}.posts FOR SELECT
  USING (status = 'published');

CREATE POLICY "Authors can view their own posts"
  ON ${schema}.posts FOR SELECT
  USING (author_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

CREATE POLICY "Authors can manage their own posts"
  ON ${schema}.posts FOR ALL
  USING (author_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);`;

  await writeTableSQL(config.currentPath, 'posts', SQL_FILE_TYPES.RLS, postsRLSSQL);

  // Comments RLS
  const commentsRLSSQL = `-- Comments policies
CREATE POLICY "Anyone can view approved comments"
  ON ${schema}.comments FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Anyone can add comments"
  ON ${schema}.comments FOR INSERT
  WITH CHECK (true);`;

  await writeTableSQL(config.currentPath, 'comments', SQL_FILE_TYPES.RLS, commentsRLSSQL);

  // Tags RLS
  const tagsRLSSQL = `-- Tags policies
CREATE POLICY "Anyone can view tags"
  ON ${schema}.tags FOR SELECT
  USING (true);

-- Post-tags policies
CREATE POLICY "Anyone can view post-tag relationships"
  ON ${schema}.post_tags FOR SELECT
  USING (true);`;

  await writeTableSQL(config.currentPath, 'tags', SQL_FILE_TYPES.RLS, tagsRLSSQL);
}

/**
 * Generate blog template indexes
 */
async function generateBlogIndexes(config: any, schema: string) {
  // Authors indexes
  const authorsIndexesSQL = `-- Authors table indexes
CREATE INDEX IF NOT EXISTS idx_authors_email ON ${schema}.authors (email);
CREATE INDEX IF NOT EXISTS idx_authors_created_at ON ${schema}.authors (created_at);`;

  await writeTableSQL(config.currentPath, 'authors', SQL_FILE_TYPES.INDEXES, authorsIndexesSQL);

  // Categories indexes
  const categoriesIndexesSQL = `-- Categories table indexes
CREATE INDEX IF NOT EXISTS idx_categories_slug ON ${schema}.categories (slug);
CREATE INDEX IF NOT EXISTS idx_categories_name ON ${schema}.categories (name);`;

  await writeTableSQL(config.currentPath, 'categories', SQL_FILE_TYPES.INDEXES, categoriesIndexesSQL);

  // Posts indexes
  const postsIndexesSQL = `-- Posts table indexes
CREATE INDEX IF NOT EXISTS idx_posts_slug ON ${schema}.posts (slug);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON ${schema}.posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_category_id ON ${schema}.posts (category_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON ${schema}.posts (status);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON ${schema}.posts (published_at);
CREATE INDEX IF NOT EXISTS idx_posts_featured ON ${schema}.posts (featured);`;

  await writeTableSQL(config.currentPath, 'posts', SQL_FILE_TYPES.INDEXES, postsIndexesSQL);

  // Comments indexes
  const commentsIndexesSQL = `-- Comments table indexes
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON ${schema}.comments (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON ${schema}.comments (status);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON ${schema}.comments (created_at);`;

  await writeTableSQL(config.currentPath, 'comments', SQL_FILE_TYPES.INDEXES, commentsIndexesSQL);

  // Tags indexes
  const tagsIndexesSQL = `-- Tags table indexes
CREATE INDEX IF NOT EXISTS idx_tags_slug ON ${schema}.tags (slug);
CREATE INDEX IF NOT EXISTS idx_tags_name ON ${schema}.tags (name);

-- Post-tags indexes
CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON ${schema}.post_tags (post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON ${schema}.post_tags (tag_id);`;

  await writeTableSQL(config.currentPath, 'tags', SQL_FILE_TYPES.INDEXES, tagsIndexesSQL);
}

/**
 * Generate blog template views
 */
async function generateBlogViews(config: any, schema: string, anonRole: string, authRole: string) {
  // Published posts view (put in posts folder since it's mainly about posts)
  const publishedPostsViewSQL = `-- Published posts with author info
CREATE OR REPLACE VIEW ${schema}.published_posts AS
SELECT 
  p.id,
  p.title,
  p.slug,
  p.content,
  p.excerpt,
  p.featured_image,
  p.featured,
  p.view_count,
  p.published_at,
  p.created_at,
  a.name as author_name,
  a.bio as author_bio,
  a.avatar_url as author_avatar,
  c.name as category_name,
  c.slug as category_slug
FROM ${schema}.posts p
LEFT JOIN ${schema}.authors a ON p.author_id = a.id
LEFT JOIN ${schema}.categories c ON p.category_id = c.id
WHERE p.status = 'published'
ORDER BY p.published_at DESC;

-- Grant view permissions
GRANT SELECT ON ${schema}.published_posts TO ${anonRole}, ${authRole};`;

  await writeTableSQL(config.currentPath, 'posts', SQL_FILE_TYPES.VIEWS, publishedPostsViewSQL);

  // Author stats view (put in authors folder)
  const authorStatsViewSQL = `-- Author statistics
CREATE OR REPLACE VIEW ${schema}.author_stats AS
SELECT 
  a.id,
  a.name,
  a.bio,
  a.avatar_url,
  COUNT(p.id) as post_count,
  COUNT(CASE WHEN p.status = 'published' THEN 1 END) as published_count,
  MAX(p.published_at) as last_published
FROM ${schema}.authors a
LEFT JOIN ${schema}.posts p ON a.id = p.author_id
GROUP BY a.id, a.name, a.bio, a.avatar_url;

-- Grant view permissions
GRANT SELECT ON ${schema}.author_stats TO ${anonRole}, ${authRole};`;

  await writeTableSQL(config.currentPath, 'authors', SQL_FILE_TYPES.VIEWS, authorStatsViewSQL);
}

/**
 * Generate ecommerce template table files
 */
async function generateEcommerceTableFiles(config: any) {
  const postgrestConfig = await getPostgRESTConfig();
  const schema = config.schemaName || postgrestConfig.schema;
  const anonRole = config.anonRole || postgrestConfig.anonRole;
  const authRole = config.authenticatedRole || 'authenticated';
  
  // Customers table
  const customersTableSQL = `CREATE TABLE ${schema}.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ${schema}.customers ENABLE ROW LEVEL SECURITY;

-- Grant table permissions
GRANT SELECT ON ${schema}.customers TO ${anonRole};
GRANT ALL ON ${schema}.customers TO ${authRole};`;

  await writeTableSQL(config.currentPath, 'customers', SQL_FILE_TYPES.TABLE, customersTableSQL);

  // Categories table
  const categoriesTableSQL = `CREATE TABLE ${schema}.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES ${schema}.categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ${schema}.categories ENABLE ROW LEVEL SECURITY;

-- Grant table permissions
GRANT SELECT ON ${schema}.categories TO ${anonRole};
GRANT ALL ON ${schema}.categories TO ${authRole};`;

  await writeTableSQL(config.currentPath, 'categories', SQL_FILE_TYPES.TABLE, categoriesTableSQL);

  // Products table
  const productsTableSQL = `CREATE TABLE ${schema}.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  compare_at_price DECIMAL(10,2) CHECK (compare_at_price >= price),
  category_id UUID REFERENCES ${schema}.categories(id) ON DELETE SET NULL,
  sku TEXT UNIQUE,
  inventory_quantity INTEGER DEFAULT 0 CHECK (inventory_quantity >= 0),
  track_inventory BOOLEAN DEFAULT true,
  weight DECIMAL(8,2),
  active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  tags TEXT[],
  images TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ${schema}.products ENABLE ROW LEVEL SECURITY;

-- Grant table permissions
GRANT SELECT ON ${schema}.products TO ${anonRole};
GRANT ALL ON ${schema}.products TO ${authRole};`;

  await writeTableSQL(config.currentPath, 'products', SQL_FILE_TYPES.TABLE, productsTableSQL);

  // Orders table
  const ordersTableSQL = `CREATE TABLE ${schema}.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES ${schema}.customers(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  shipping_amount DECIMAL(10,2) DEFAULT 0 CHECK (shipping_amount >= 0),
  tax_amount DECIMAL(10,2) DEFAULT 0 CHECK (tax_amount >= 0),
  shipping_address JSONB,
  billing_address JSONB,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ${schema}.orders ENABLE ROW LEVEL SECURITY;

-- Grant table permissions - customers can only see their own orders
GRANT SELECT ON ${schema}.orders TO ${authRole};`;

  await writeTableSQL(config.currentPath, 'orders', SQL_FILE_TYPES.TABLE, ordersTableSQL);

  // Order items table
  const orderItemsTableSQL = `CREATE TABLE ${schema}.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ${schema}.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES ${schema}.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ${schema}.order_items ENABLE ROW LEVEL SECURITY;

-- Grant table permissions
GRANT SELECT ON ${schema}.order_items TO ${authRole};`;

  await writeTableSQL(config.currentPath, 'order_items', SQL_FILE_TYPES.TABLE, orderItemsTableSQL);

  // Generate RLS policies if enabled
  if (config.includeRLS) {
    await generateEcommerceRLSPolicies(config, schema, anonRole, authRole);
  }

  // Generate indexes
  await generateEcommerceIndexes(config, schema);

  // Generate views if enabled
  if (config.includeViews) {
    await generateEcommerceViews(config, schema, anonRole, authRole);
  }
}

/**
 * Generate e-commerce template RLS policies
 */
async function generateEcommerceRLSPolicies(config: any, schema: string, anonRole: string, authRole: string) {
  // Customers RLS
  const customersRLSSQL = `-- Customers policies
CREATE POLICY "Customers can view their own profile"
  ON ${schema}.customers FOR SELECT
  USING (id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

CREATE POLICY "Allow customer registration"
  ON ${schema}.customers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Customers can update their own profile"
  ON ${schema}.customers FOR UPDATE
  USING (id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);`;

  await writeTableSQL(config.currentPath, 'customers', SQL_FILE_TYPES.RLS, customersRLSSQL);

  // Categories RLS
  const categoriesRLSSQL = `-- Categories policies
CREATE POLICY "Anyone can view active categories"
  ON ${schema}.categories FOR SELECT
  USING (active = true);`;

  await writeTableSQL(config.currentPath, 'categories', SQL_FILE_TYPES.RLS, categoriesRLSSQL);

  // Products RLS
  const productsRLSSQL = `-- Products policies
CREATE POLICY "Anyone can view active products"
  ON ${schema}.products FOR SELECT
  USING (active = true);`;

  await writeTableSQL(config.currentPath, 'products', SQL_FILE_TYPES.RLS, productsRLSSQL);

  // Orders RLS
  const ordersRLSSQL = `-- Orders policies
CREATE POLICY "Customers can view their own orders"
  ON ${schema}.orders FOR SELECT
  USING (customer_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

CREATE POLICY "Customers can create orders"
  ON ${schema}.orders FOR INSERT
  WITH CHECK (customer_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);`;

  await writeTableSQL(config.currentPath, 'orders', SQL_FILE_TYPES.RLS, ordersRLSSQL);

  // Order items RLS
  const orderItemsRLSSQL = `-- Order items policies
CREATE POLICY "Customers can view their own order items"
  ON ${schema}.order_items FOR SELECT
  USING (order_id IN (
    SELECT id FROM ${schema}.orders 
    WHERE customer_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid
  ));`;

  await writeTableSQL(config.currentPath, 'order_items', SQL_FILE_TYPES.RLS, orderItemsRLSSQL);
}

/**
 * Generate e-commerce template indexes
 */
async function generateEcommerceIndexes(config: any, schema: string) {
  // Customers indexes
  const customersIndexesSQL = `-- Customers table indexes
CREATE INDEX IF NOT EXISTS idx_customers_email ON ${schema}.customers (email);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON ${schema}.customers (created_at);`;

  await writeTableSQL(config.currentPath, 'customers', SQL_FILE_TYPES.INDEXES, customersIndexesSQL);

  // Categories indexes
  const categoriesIndexesSQL = `-- Categories table indexes
CREATE INDEX IF NOT EXISTS idx_categories_slug ON ${schema}.categories (slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON ${schema}.categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON ${schema}.categories (active);`;

  await writeTableSQL(config.currentPath, 'categories', SQL_FILE_TYPES.INDEXES, categoriesIndexesSQL);

  // Products indexes
  const productsIndexesSQL = `-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_slug ON ${schema}.products (slug);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON ${schema}.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON ${schema}.products (sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON ${schema}.products (active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON ${schema}.products (featured);
CREATE INDEX IF NOT EXISTS idx_products_price ON ${schema}.products (price);`;

  await writeTableSQL(config.currentPath, 'products', SQL_FILE_TYPES.INDEXES, productsIndexesSQL);

  // Orders indexes
  const ordersIndexesSQL = `-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON ${schema}.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON ${schema}.orders (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON ${schema}.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON ${schema}.orders (created_at);`;

  await writeTableSQL(config.currentPath, 'orders', SQL_FILE_TYPES.INDEXES, ordersIndexesSQL);

  // Order items indexes
  const orderItemsIndexesSQL = `-- Order items table indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON ${schema}.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON ${schema}.order_items (product_id);`;

  await writeTableSQL(config.currentPath, 'order_items', SQL_FILE_TYPES.INDEXES, orderItemsIndexesSQL);
}

/**
 * Generate e-commerce template views
 */
async function generateEcommerceViews(config: any, schema: string, anonRole: string, authRole: string) {
  // Product catalog view (put in products folder)
  const catalogViewSQL = `-- Product catalog with category info
CREATE OR REPLACE VIEW ${schema}.product_catalog AS
SELECT 
  p.id,
  p.name,
  p.slug,
  p.description,
  p.price,
  p.compare_at_price,
  p.sku,
  p.inventory_quantity,
  p.images,
  p.featured,
  c.name as category_name,
  c.slug as category_slug
FROM ${schema}.products p
LEFT JOIN ${schema}.categories c ON p.category_id = c.id
WHERE p.active = true;

-- Grant view permissions
GRANT SELECT ON ${schema}.product_catalog TO ${anonRole}, ${authRole};`;

  await writeTableSQL(config.currentPath, 'products', SQL_FILE_TYPES.VIEWS, catalogViewSQL);

  // Order summary view (put in orders folder)
  const orderSummaryViewSQL = `-- Order summary with items
CREATE OR REPLACE VIEW ${schema}.order_summary AS
SELECT 
  o.id,
  o.order_number,
  o.status,
  o.total_amount,
  o.created_at,
  c.first_name || ' ' || c.last_name as customer_name,
  c.email as customer_email,
  COUNT(oi.id) as item_count
FROM ${schema}.orders o
JOIN ${schema}.customers c ON o.customer_id = c.id
LEFT JOIN ${schema}.order_items oi ON o.id = oi.order_id
GROUP BY o.id, o.order_number, o.status, o.total_amount, o.created_at, c.first_name, c.last_name, c.email;

-- Grant view permissions (customers can only see their own orders via RLS)
GRANT SELECT ON ${schema}.order_summary TO ${authRole};`;

  await writeTableSQL(config.currentPath, 'orders', SQL_FILE_TYPES.VIEWS, orderSummaryViewSQL);
}

/**
 * Generate database roles file
 */
async function generateRolesFile(config: any) {
  logger.info('  🔑 Database roles');
  
  const { RoleGenerator } = await import('../../generators/RoleGenerator.js');
  const generator = new RoleGenerator(config.currentPath);
  
  // Generate roles SQL
  const rolesSQL = await generator.generateRoleSetup();
  
  // Write to sql/roles.sql
  const rolesPath = `${config.currentPath}/sql/roles.sql`;
  await fs.writeFile(rolesPath, rolesSQL);
  
  // Track the file write in hash service
  const hashService = getHashService(config.currentPath);
  await hashService.trackFileWrite(rolesPath, rolesSQL);
  
  // Store for later use
  config.rolesGenerated = true;
  config.rolesPath = rolesPath;
}

/**
 * Prompt user to execute role setup
 */
async function promptRoleSetupExecution(config: any) {
  if (!config.rolesGenerated || config.skipPrompts) {
    return;
  }
  
  logger.newLine();
  logger.info(chalk.cyan('🔑 Database Roles Setup'));
  logger.info('A roles.sql file has been generated with the necessary database roles.');
  logger.newLine();
  
  const { RoleGenerator } = await import('../../generators/RoleGenerator.js');
  const generator = new RoleGenerator(config.currentPath);
  const roleConfig = await generator.getRoleConfig();
  
  logger.info(chalk.yellow('📋 Roles to be created:'));
  logger.list([
    `${chalk.green(roleConfig.anonRole)} - Anonymous users (read-only)`,
    `${chalk.green(roleConfig.authenticatedRole)} - Authenticated users (CRUD)`, 
    `${chalk.green(roleConfig.adminRole)} - Admin users (full access)`,
    `Target schema: ${chalk.green(roleConfig.schema)}`
  ]);
  
  const { executeRoles } = await inquirer.prompt([{
    type: 'confirm',
    name: 'executeRoles',
    message: 'Execute roles setup now?',
    default: true
  }]);
  
  if (executeRoles) {
    await executeRoleSetup(config);
  } else {
    displayRoleSetupInstructions(config, roleConfig);
  }
}

/**
 * Execute role setup against database
 */
async function executeRoleSetup(config: any) {
  try {
    logger.info(chalk.blue('⚡ Executing role setup...'));
    
    const { DatabaseManager } = await import('../../utils/database.js');
    const dbManager = new DatabaseManager(config.currentPath);
    
    const connection = await dbManager.extractConnection();
    if (!connection) {
      logger.warn('❌ No database connection found.');
      displayRoleSetupInstructions(config, null);
      return;
    }
    
    // Read and execute roles SQL
    const rolesSQL = await fs.readFile(config.rolesPath);
    await dbManager.executeSQL(rolesSQL, connection);
    
    logger.success('✅ Database roles setup completed successfully!');
    logger.info('🔒 Your PostgREST API now has proper role-based access control.');
    
  } catch (error: any) {
    if (error.message.includes('permission denied to create role')) {
      logger.error(`❌ Database user lacks permission to create roles`);
      logger.info('💡 This is common with managed databases (AWS RDS, Heroku, etc.)');
      logger.info('📖 Ask your database administrator to create these roles:');
      logger.list([
        'CREATE ROLE web_anon NOLOGIN;',
        'CREATE ROLE authenticated NOLOGIN;', 
        'CREATE ROLE web_admin NOLOGIN;'
      ]);
      logger.info('Or run the sql/roles.sql file with a privileged user.');
    } else if (error.message.includes('role') && error.message.includes('already exists')) {
      logger.warn('⚠️  Some roles already exist - this is usually fine');
      logger.info('💡 Continuing with existing roles...');
    } else {
      logger.error(`❌ Failed to execute role setup: ${error.message}`);
    }
    displayRoleSetupInstructions(config, null);
  }
}

/**
 * Display instructions for manual role setup
 */
function displayRoleSetupInstructions(config: any, roleConfig: any) {
  logger.newLine();
  logger.info(chalk.cyan('📖 Manual Role Setup Instructions:'));
  
  const databaseCmd = config.useDocker 
    ? `docker compose exec -T postgres psql -U ${config.username} -d ${config.database} < sql/roles.sql`
    : `psql -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database} -f sql/roles.sql`;
  
  logger.list([
    'Execute the roles SQL manually:',
    `  ${chalk.green(databaseCmd)}`,
    'Or run: pgrestify api setup roles --execute',
    'Then restart PostgREST to apply role changes'
  ]);
  
  if (roleConfig) {
    logger.newLine();
    logger.info(chalk.yellow('💡 Why roles are important:'));
    logger.list([
      'Roles control who can access what data via your API',
      'Anonymous users get read-only access to public data',
      'Authenticated users can perform CRUD operations', 
      'Without roles, you may get "permission denied" errors'
    ]);
  }
  
  logger.newLine();
  logger.info(chalk.blue('🔄 Next steps after setting up roles:'));
  logger.list([
    'Run your setup script: npm run pgrestify:setup',
    'Or manually migrate: pgrestify api migrate',
    'Test your API endpoints',
    'Configure RLS policies as needed'
  ]);
}

/**
 * Generate additional SQL files
 */
async function generateAdditionalSQLFiles(config: any) {
  if (config.includeAuth || config.includeFunctions) {
    logger.info('  🔧 Function files');
    const functionsSQL = generateFunctions(config);
    const authFilePath = `${config.currentPath}/sql/functions/auth.sql`;
    await fs.writeFile(authFilePath, functionsSQL);
    
    // Track the file write in hash service
    const hashService = getHashService(config.currentPath);
    await hashService.trackFileWrite(authFilePath, functionsSQL);
  }
  
  // Views, triggers, and indexes are now generated in table-specific folders
  // during the generateBasicTableFiles/generateBlogTableFiles/etc. functions
  logger.debug('Views, triggers, and indexes generated in table-specific folders');
}

/**
 * Generate migration commands for new structure
 */
function generateMigrationCommands(config: any, isDocker: boolean = true): string {
  let commands = `echo "🗄️  Running database migrations..."`;

  // Setup schema first
  const setupCommand = isDocker 
    ? `docker compose exec -T postgres psql -U ${config.username} -d ${config.database} < sql/schemas/_setup/table.sql || echo "⚠️  Setup schema not found"`
    : `psql -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database} -f sql/schemas/_setup/table.sql || echo "⚠️  Setup schema not found"`;
  commands += `\n${setupCommand}`;

  // Functions
  if (config.includeAuth || config.includeFunctions) {
    const functionCommand = isDocker 
      ? `docker compose exec -T postgres psql -U ${config.username} -d ${config.database} < sql/functions/auth.sql || echo "⚠️  Functions not found"`
      : `psql -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database} -f sql/functions/auth.sql || echo "⚠️  Functions not found"`;
    commands += `\n${functionCommand}`;
  }

  // Dynamic table discovery and execution in proper order
  const fileTypes = ['table.sql', 'indexes.sql', 'rls.sql', 'triggers.sql', 'views.sql'];
  
  for (const fileType of fileTypes) {
    commands += `\necho "📋 Running ${fileType} files..."`;
    
    if (isDocker) {
      // Docker: Use shell globbing to find all matching files
      commands += `\nfor file in sql/schemas/*/${fileType}; do`;
      commands += `\n  if [ -f "$file" ]; then`;
      commands += `\n    echo "  → $file"`;
      commands += `\n    docker compose exec -T postgres psql -U ${config.username} -d ${config.database} < "$file" || echo "    ⚠️  Failed: $file"`;
      commands += `\n  fi`;
      commands += `\ndone`;
    } else {
      // Local: Use shell globbing to find all matching files
      commands += `\nfor file in sql/schemas/*/${fileType}; do`;
      commands += `\n  if [ -f "$file" ]; then`;
      commands += `\n    echo "  → $file"`;
      commands += `\n    psql -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database} -f "$file" || echo "    ⚠️  Failed: $file"`;
      commands += `\n  fi`;
      commands += `\ndone`;
    }
  }

  // Testing data
  if (config.includeTestingData) {
    const testDataCommand = isDocker 
      ? `docker compose exec -T postgres psql -U ${config.username} -d ${config.database} < sql/testing_data.sql || echo "⚠️  Testing data not found"`
      : `psql -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database} -f sql/testing_data.sql || echo "⚠️  Testing data not found"`;
    commands += `\n\necho "🎲 Loading testing data..."\n${testDataCommand}`;
  }

  return commands;
}


/**
 * Generate package configuration
 */
async function generatePackageConfig(config: any) {
  logger.info('  📦 Package configuration');
  
  // Check if package.json exists and merge scripts
  const packageJsonPath = `${config.currentPath}/package.json`;
  let existingPackageJson: any = {};
  
  if (await fs.exists(packageJsonPath)) {
    try {
      const content = await fs.readFile(packageJsonPath);
      existingPackageJson = JSON.parse(content);
      logger.info('    📝 Merging with existing package.json');
    } catch (error) {
      logger.warn('    ⚠️  Could not parse existing package.json, creating new one');
    }
  }
  
  // Generate and merge package.json
  const updatedPackageJson = await generateAndMergePackageJson(config, existingPackageJson);
  await fs.writeFile(packageJsonPath, JSON.stringify(updatedPackageJson, null, 2));
  
  const scripts = generateUtilityScripts(config);
  await fs.writeFile(`${config.currentPath}/scripts/setup.sh`, scripts);
  
  // Make setup script executable
  const fs_node = await import('fs');
  await fs_node.promises.chmod(`${config.currentPath}/scripts/setup.sh`, 0o755);
}

// Template generation functions
function generateTemplateSchema(config: any): string {
  const dirName = path.basename(process.cwd());
  const schema = config.apiSchemas[0];
  
  let sql = `-- Generated schema for ${dirName}
-- Template: ${config.template}
-- Generated: ${new Date().toISOString()}

-- Create schemas
CREATE SCHEMA IF NOT EXISTS ${schema};
CREATE SCHEMA IF NOT EXISTS private;

-- Create roles
CREATE ROLE ${config.anonRole} NOLOGIN;
CREATE ROLE ${config.authenticatedRole} NOLOGIN;

-- Grant usage on schemas
GRANT USAGE ON SCHEMA ${schema} TO ${config.anonRole}, ${config.authenticatedRole};

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT SELECT ON TABLES TO ${config.anonRole};
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${config.authenticatedRole};
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT USAGE ON SEQUENCES TO ${config.authenticatedRole};

`;

  // Add template-specific tables
  switch (config.template) {
    case 'basic':
      sql += generateBasicTables(schema, config);
      break;
    case 'blog':
      sql += generateBlogTables(schema, config);
      break;
    case 'ecommerce':
      sql += generateEcommerceTables(schema, config);
      break;
    default:
      sql += generateBasicTables(schema, config);
  }

  return sql;
}

// Template-specific table generators
function generateBasicTables(schema: string, config?: any): string {
  const anonRole = config?.anonRole || POSTGREST_DEFAULTS.dbAnonRole;
  const authRole = config?.authenticatedRole || POSTGREST_DEFAULTS.dbAuthenticatedRole;
  return `
-- Basic template tables
CREATE TABLE ${schema}.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ${schema}.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ${schema}.users(id) ON DELETE CASCADE,
  bio TEXT,
  website TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE ${schema}.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.profiles ENABLE ROW LEVEL SECURITY;

-- Grant table permissions
GRANT SELECT ON ${schema}.users TO ${anonRole};
GRANT ALL ON ${schema}.users TO ${authRole};
GRANT SELECT ON ${schema}.profiles TO ${anonRole};
GRANT ALL ON ${schema}.profiles TO ${authRole};
`;
}

function generateBlogTables(schema: string, config?: any): string {
  const anonRole = config?.anonRole || POSTGREST_DEFAULTS.dbAnonRole;
  const authRole = config?.authenticatedRole || POSTGREST_DEFAULTS.dbAuthenticatedRole;
  return `
-- Blog template tables
CREATE TABLE ${schema}.authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
  name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ${schema}.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ${schema}.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT,
  excerpt TEXT,
  featured_image TEXT,
  author_id UUID NOT NULL REFERENCES ${schema}.authors(id) ON DELETE CASCADE,
  category_id UUID REFERENCES ${schema}.categories(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ${schema}.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES ${schema}.posts(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ${schema}.authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.comments ENABLE ROW LEVEL SECURITY;

-- Grant table permissions
GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO ${anonRole};
GRANT ALL ON ALL TABLES IN SCHEMA ${schema} TO ${authRole};
`;
}

function generateEcommerceTables(schema: string, config?: any): string {
  const anonRole = config?.anonRole || POSTGREST_DEFAULTS.dbAnonRole;
  const authRole = config?.authenticatedRole || POSTGREST_DEFAULTS.dbAuthenticatedRole;
  return `
-- E-commerce template tables
CREATE TABLE ${schema}.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ${schema}.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES ${schema}.customers(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'shipping' CHECK (type IN ('shipping', 'billing')),
  street TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ${schema}.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES ${schema}.categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ${schema}.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  category_id UUID REFERENCES ${schema}.categories(id) ON DELETE SET NULL,
  sku TEXT UNIQUE,
  stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
  images TEXT[],
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ${schema}.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES ${schema}.customers(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  shipping_address_id UUID REFERENCES ${schema}.addresses(id),
  billing_address_id UUID REFERENCES ${schema}.addresses(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ${schema}.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ${schema}.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES ${schema}.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ${schema}.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ${schema}.order_items ENABLE ROW LEVEL SECURITY;

-- Grant table permissions
GRANT SELECT ON ${schema}.categories, ${schema}.products TO ${anonRole};
GRANT ALL ON ALL TABLES IN SCHEMA ${schema} TO ${authRole};
`;
}

function generateRLSPolicies(config: any): string {
  const schema = config.apiSchemas[0];
  
  let sql = `-- Row Level Security policies
-- Template: ${config.template}
-- Generated: ${new Date().toISOString()}

`;

  switch (config.template) {
    case 'basic':
      sql += generateBasicRLSPolicies(schema, config);
      break;
    case 'blog':
      sql += generateBlogRLSPolicies_ForOldSystem(schema, config);
      break;
    case 'ecommerce':
      sql += generateEcommerceRLSPolicies_ForOldSystem(schema, config);
      break;
    default:
      sql += generateBasicRLSPolicies(schema, config);
  }

  return sql;
}

// RLS Policy generators
function generateBasicRLSPolicies(schema: string, config: any): string {
  return `-- Basic template RLS policies

-- Users policies
CREATE POLICY "Anyone can view user profiles"
  ON ${schema}.users FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON ${schema}.users FOR UPDATE
  USING (id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

CREATE POLICY "Allow user registration"
  ON ${schema}.users FOR INSERT
  WITH CHECK (true);

-- Profiles policies  
CREATE POLICY "Anyone can view profile data"
  ON ${schema}.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own profile data"
  ON ${schema}.profiles FOR ALL
  USING (user_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);
`;
}

function generateBlogRLSPolicies_ForOldSystem(schema: string, config: any): string {
  return `-- Blog template RLS policies

-- Authors policies
CREATE POLICY "Authors can view their own data"
  ON ${schema}.authors FOR SELECT
  USING (id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

CREATE POLICY "Authors can update their own data"
  ON ${schema}.authors FOR UPDATE
  USING (id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

-- Categories policies (public read)
CREATE POLICY "Anyone can view categories"
  ON ${schema}.categories FOR SELECT
  USING (true);

CREATE POLICY "Only authenticated users can manage categories"
  ON ${schema}.categories FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'authenticated');

-- Posts policies
CREATE POLICY "Anyone can view published posts"
  ON ${schema}.posts FOR SELECT
  USING (status = 'published' OR author_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

CREATE POLICY "Authors can manage their own posts"
  ON ${schema}.posts FOR ALL
  USING (author_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

-- Comments policies
CREATE POLICY "Anyone can view approved comments"
  ON ${schema}.comments FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Anyone can create comments"
  ON ${schema}.comments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authors can manage comments on their posts"
  ON ${schema}.comments FOR UPDATE
  USING (post_id IN (
    SELECT id FROM ${schema}.posts 
    WHERE author_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid
  ));
`;
}

function generateEcommerceRLSPolicies_ForOldSystem(schema: string, config: any): string {
  return `-- E-commerce template RLS policies

-- Customers policies
CREATE POLICY "Customers can view their own data"
  ON ${schema}.customers FOR SELECT
  USING (id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

CREATE POLICY "Customers can update their own data"
  ON ${schema}.customers FOR UPDATE
  USING (id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

-- Addresses policies
CREATE POLICY "Customers can manage their own addresses"
  ON ${schema}.addresses FOR ALL
  USING (customer_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

-- Categories policies (public read)
CREATE POLICY "Anyone can view categories"
  ON ${schema}.categories FOR SELECT
  USING (true);

-- Products policies (public read)
CREATE POLICY "Anyone can view active products"
  ON ${schema}.products FOR SELECT
  USING (status = 'active');

-- Orders policies
CREATE POLICY "Customers can view their own orders"
  ON ${schema}.orders FOR SELECT
  USING (customer_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

CREATE POLICY "Customers can create orders"
  ON ${schema}.orders FOR INSERT
  WITH CHECK (customer_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid);

CREATE POLICY "Customers can update their pending orders"
  ON ${schema}.orders FOR UPDATE
  USING (customer_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid AND status = 'pending');

-- Order items policies
CREATE POLICY "Customers can view their own order items"
  ON ${schema}.order_items FOR SELECT
  USING (order_id IN (
    SELECT id FROM ${schema}.orders 
    WHERE customer_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid
  ));

CREATE POLICY "Customers can manage items in their pending orders"
  ON ${schema}.order_items FOR ALL
  USING (order_id IN (
    SELECT id FROM ${schema}.orders 
    WHERE customer_id = (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid 
    AND status = 'pending'
  ));
`;
}

async function generatePostgRESTConfigFile(config: any): Promise<string> {
  const dirName = path.basename(process.cwd());
  
  // Get full PostgREST configuration with environment-specific defaults
  const postgrestConfig = await getPostgRESTConfig(undefined, config.environment);
  
  return `# PostgREST Configuration
# Generated: ${new Date().toISOString()}
# Project: ${dirName}

# Database connection
db-uri = "postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}"
db-schemas = "${config.apiSchemas.join(', ')}"
db-anon-role = "${config.anonRole || postgrestConfig.dbAnonRole}"
db-authenticated-role = "${config.authenticatedRole || postgrestConfig.dbAuthenticatedRole}"

# Authentication
jwt-secret = "${config.jwtSecret}"

# Server configuration  
server-host = "${config.serverHost || postgrestConfig.serverHost}"
server-port = ${config.serverPort || postgrestConfig.serverPort}
server-cors-allowed-origins = "${config.enableCors ? postgrestConfig.serverCorsAllowedOrigins : ''}"

# Performance
db-pool = ${postgrestConfig.dbPool}
db-pool-timeout = ${postgrestConfig.dbPoolTimeout}

# Logging
log-level = "${postgrestConfig.logLevel}"
`;
}

function generateDockerComposeFile(config: any): string {
  const dirName = path.basename(process.cwd());
  return `# Docker Compose for ${dirName}
# Generated: ${new Date().toISOString()}

version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: \${POSTGRES_DB}
    ports:
      - "\${POSTGRES_PORT:-5432}:5432"
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
    image: postgrest/postgrest:latest
    restart: unless-stopped
    environment:
      PGRST_DB_URI: postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/\${POSTGRES_DB}
      PGRST_DB_SCHEMAS: \${API_SCHEMAS}
      PGRST_DB_ANON_ROLE: \${ANON_ROLE}
      PGRST_JWT_SECRET: \${JWT_SECRET}
      PGRST_SERVER_PORT: 3000
    ports:
      - "\${POSTGREST_PORT:-3000}:3000"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - api-network

volumes:
  postgres_data:

networks:
  api-network:
    driver: bridge
`;
}

function generateEnvFile(config: any): string {
  const dirName = path.basename(process.cwd());
  return `# Environment variables for ${dirName}
# Generated: ${new Date().toISOString()}

# Database
POSTGRES_USER=${config.username}
POSTGRES_PASSWORD=${config.password}
POSTGRES_DB=${config.database}
POSTGRES_PORT=${config.port}

# PostgREST
POSTGREST_PORT=${config.serverPort}
API_SCHEMAS=${config.apiSchemas.join(',')}
ANON_ROLE=${config.anonRole}
JWT_SECRET=${config.jwtSecret}

# Security note: Keep this file secure and never commit real secrets
`;
}

function generateFunctions(config: any): string {
  const schema = config.apiSchemas[0];
  
  let sql = `-- Authentication and utility functions
-- Generated: ${new Date().toISOString()}

-- JWT token type
CREATE TYPE ${schema}.jwt_token AS (
  token text
);

-- Function to get current user ID from JWT
CREATE OR REPLACE FUNCTION ${schema}.current_user_id()
RETURNS uuid AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has specific role
CREATE OR REPLACE FUNCTION ${schema}.has_role(role_name text)
RETURNS boolean AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::json->>'role' = role_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

`;

  // Add template-specific functions
  if (config.includeAuth) {
    switch (config.template) {
      case 'basic':
        sql += generateBasicAuthFunctions(schema);
        break;
      case 'blog':
        sql += generateBlogAuthFunctions(schema);
        break;
      case 'ecommerce':
        sql += generateEcommerceAuthFunctions(schema);
        break;
      default:
        sql += generateBasicAuthFunctions(schema);
    }
  }

  // Add utility functions
  sql += generateUtilityFunctions(schema);

  return sql;
}

// Template-specific authentication functions
function generateBasicAuthFunctions(schema: string): string {
  return `-- Basic authentication functions

-- Function to register new user
CREATE OR REPLACE FUNCTION ${schema}.register_user(
  email text,
  name text,
  password text
)
RETURNS ${schema}.jwt_token AS $$
DECLARE
  new_user_id uuid;
  token text;
BEGIN
  -- Insert new user (password hashing should be handled by your auth service)
  INSERT INTO ${schema}.users (email, name) 
  VALUES (email, name) 
  RETURNING id INTO new_user_id;

  -- Create basic profile
  INSERT INTO ${schema}.profiles (user_id) 
  VALUES (new_user_id);

  -- Generate JWT token (simplified - use proper JWT library in production)
  SELECT sign(
    json_build_object(
      'user_id', new_user_id,
      'email', email,
      'role', 'authenticated',
      'exp', extract(epoch from now() + interval '7 days')
    ),
    current_setting('app.jwt_secret')
  ) INTO token;

  RETURN (token)::${schema}.jwt_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user profile
CREATE OR REPLACE FUNCTION ${schema}.update_profile(
  user_bio text DEFAULT NULL,
  user_website text DEFAULT NULL,
  user_location text DEFAULT NULL
)
RETURNS ${schema}.profiles AS $$
DECLARE
  current_user_id uuid;
  updated_profile ${schema}.profiles;
BEGIN
  current_user_id := ${schema}.current_user_id();
  
  UPDATE ${schema}.profiles 
  SET 
    bio = COALESCE(user_bio, bio),
    website = COALESCE(user_website, website),
    location = COALESCE(user_location, location),
    updated_at = NOW()
  WHERE user_id = current_user_id
  RETURNING * INTO updated_profile;
  
  RETURN updated_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;
}

function generateBlogAuthFunctions(schema: string): string {
  return `-- Blog authentication functions

-- Function to create author profile
CREATE OR REPLACE FUNCTION ${schema}.create_author(
  email text,
  name text,
  bio text DEFAULT NULL
)
RETURNS ${schema}.authors AS $$
DECLARE
  new_author ${schema}.authors;
BEGIN
  INSERT INTO ${schema}.authors (email, name, bio) 
  VALUES (email, name, bio) 
  RETURNING * INTO new_author;
  
  RETURN new_author;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create new post
CREATE OR REPLACE FUNCTION ${schema}.create_post(
  title text,
  content text,
  excerpt text DEFAULT NULL,
  category_id uuid DEFAULT NULL
)
RETURNS ${schema}.posts AS $$
DECLARE
  current_author_id uuid;
  post_slug text;
  new_post ${schema}.posts;
BEGIN
  current_author_id := ${schema}.current_user_id();
  
  -- Generate slug from title
  post_slug := lower(regexp_replace(title, '[^a-zA-Z0-9\\s]', '', 'g'));
  post_slug := regexp_replace(post_slug, '\\s+', '-', 'g');
  
  -- Make slug unique
  WHILE EXISTS(SELECT 1 FROM ${schema}.posts WHERE slug = post_slug) LOOP
    post_slug := post_slug || '-' || floor(random() * 1000)::text;
  END LOOP;
  
  INSERT INTO ${schema}.posts (title, slug, content, excerpt, author_id, category_id)
  VALUES (title, post_slug, content, excerpt, current_author_id, category_id)
  RETURNING * INTO new_post;
  
  RETURN new_post;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to publish post
CREATE OR REPLACE FUNCTION ${schema}.publish_post(post_id uuid)
RETURNS ${schema}.posts AS $$
DECLARE
  current_author_id uuid;
  updated_post ${schema}.posts;
BEGIN
  current_author_id := ${schema}.current_user_id();
  
  UPDATE ${schema}.posts 
  SET 
    status = 'published',
    published_at = NOW(),
    updated_at = NOW()
  WHERE id = post_id AND author_id = current_author_id
  RETURNING * INTO updated_post;
  
  IF updated_post IS NULL THEN
    RAISE EXCEPTION 'Post not found or access denied';
  END IF;
  
  RETURN updated_post;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;
}

function generateEcommerceAuthFunctions(schema: string): string {
  return `-- E-commerce authentication functions

-- Function to create customer profile
CREATE OR REPLACE FUNCTION ${schema}.create_customer(
  email text,
  first_name text,
  last_name text,
  phone text DEFAULT NULL
)
RETURNS ${schema}.customers AS $$
DECLARE
  new_customer ${schema}.customers;
BEGIN
  INSERT INTO ${schema}.customers (email, first_name, last_name, phone) 
  VALUES (email, first_name, last_name, phone) 
  RETURNING * INTO new_customer;
  
  RETURN new_customer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add customer address
CREATE OR REPLACE FUNCTION ${schema}.add_address(
  address_type text,
  street text,
  city text,
  state text,
  postal_code text,
  country text,
  is_default boolean DEFAULT false
)
RETURNS ${schema}.addresses AS $$
DECLARE
  current_customer_id uuid;
  new_address ${schema}.addresses;
BEGIN
  current_customer_id := ${schema}.current_user_id();
  
  -- If setting as default, unset other defaults
  IF is_default THEN
    UPDATE ${schema}.addresses 
    SET is_default = false 
    WHERE customer_id = current_customer_id AND type = address_type;
  END IF;
  
  INSERT INTO ${schema}.addresses (customer_id, type, street, city, state, postal_code, country, is_default)
  VALUES (current_customer_id, address_type, street, city, state, postal_code, country, is_default)
  RETURNING * INTO new_address;
  
  RETURN new_address;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create order
CREATE OR REPLACE FUNCTION ${schema}.create_order(
  items json,
  shipping_address_id uuid,
  billing_address_id uuid DEFAULT NULL
)
RETURNS ${schema}.orders AS $$
DECLARE
  current_customer_id uuid;
  order_number text;
  total_amount decimal(10,2) := 0;
  new_order ${schema}.orders;
  item json;
BEGIN
  current_customer_id := ${schema}.current_user_id();
  
  -- Generate unique order number
  order_number := 'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-' || 
                  lpad(floor(random() * 10000)::text, 4, '0');
  
  -- Calculate total from items
  FOR item IN SELECT * FROM json_array_elements(items) LOOP
    total_amount := total_amount + (item->>'quantity')::integer * (item->>'unit_price')::decimal(10,2);
  END LOOP;
  
  -- Create order
  INSERT INTO ${schema}.orders (
    customer_id, order_number, total_amount, 
    shipping_address_id, billing_address_id
  )
  VALUES (
    current_customer_id, order_number, total_amount,
    shipping_address_id, COALESCE(billing_address_id, shipping_address_id)
  )
  RETURNING * INTO new_order;
  
  -- Create order items
  FOR item IN SELECT * FROM json_array_elements(items) LOOP
    INSERT INTO ${schema}.order_items (
      order_id, product_id, quantity, unit_price, total_price
    ) VALUES (
      new_order.id,
      (item->>'product_id')::uuid,
      (item->>'quantity')::integer,
      (item->>'unit_price')::decimal(10,2),
      (item->>'quantity')::integer * (item->>'unit_price')::decimal(10,2)
    );
  END LOOP;
  
  RETURN new_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;
}

function generateUtilityFunctions(schema: string): string {
  return `-- Utility functions

-- Function to update timestamps
CREATE OR REPLACE FUNCTION private.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate slug from text
CREATE OR REPLACE FUNCTION ${schema}.slugify(text_input text)
RETURNS text AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(text_input, '[^a-zA-Z0-9\\s]', '', 'g'),
      '\\s+', '-', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate email format
CREATE OR REPLACE FUNCTION ${schema}.is_valid_email(email text)
RETURNS boolean AS $$
BEGIN
  RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;
`;
}

function generateViews(config: any): string {
  const schema = config.apiSchemas[0];
  
  let sql = `-- Database views for API
-- Template: ${config.template}
-- Generated: ${new Date().toISOString()}

`;

  // Add template-specific views
  switch (config.template) {
    case 'basic':
      sql += generateBasicViews(schema, config);
      break;
    case 'blog':
      sql += generateBlogViews_ForOldSystem(schema, config);
      break;
    case 'ecommerce':
      sql += generateEcommerceViews_ForOldSystem(schema, config);
      break;
    default:
      sql += generateBasicViews(schema, config);
  }

  return sql;
}

// Template-specific view generators
function generateBasicViews(schema: string, config?: any): string {
  return `-- Basic template views

-- User profiles view (combines users and profiles)
CREATE OR REPLACE VIEW ${schema}.user_profiles AS
SELECT 
  u.id,
  u.email,
  u.name,
  u.avatar_url,
  u.created_at,
  u.updated_at,
  p.bio,
  p.website,
  p.location
FROM ${schema}.users u
LEFT JOIN ${schema}.profiles p ON u.id = p.user_id;

-- Grant view permissions
GRANT SELECT ON ${schema}.user_profiles TO ${config?.anonRole || POSTGREST_DEFAULTS.dbAnonRole}, ${config?.authenticatedRole || POSTGREST_DEFAULTS.dbAuthenticatedRole};
`;
}

function generateBlogViews_ForOldSystem(schema: string, config?: any): string {
  return `-- Blog template views

-- Published posts with author info
CREATE OR REPLACE VIEW ${schema}.published_posts AS
SELECT 
  p.id,
  p.title,
  p.slug,
  p.content,
  p.excerpt,
  p.featured_image,
  p.published_at,
  p.created_at,
  p.updated_at,
  a.name as author_name,
  a.bio as author_bio,
  a.avatar_url as author_avatar,
  c.name as category_name,
  c.slug as category_slug
FROM ${schema}.posts p
LEFT JOIN ${schema}.authors a ON p.author_id = a.id
LEFT JOIN ${schema}.categories c ON p.category_id = c.id
WHERE p.status = 'published';

-- Post summaries (for listing pages)
CREATE OR REPLACE VIEW ${schema}.post_summaries AS
SELECT 
  p.id,
  p.title,
  p.slug,
  p.excerpt,
  p.featured_image,
  p.published_at,
  a.name as author_name,
  c.name as category_name,
  c.slug as category_slug,
  (SELECT COUNT(*) FROM ${schema}.comments co WHERE co.post_id = p.id AND co.status = 'approved') as comment_count
FROM ${schema}.posts p
LEFT JOIN ${schema}.authors a ON p.author_id = a.id
LEFT JOIN ${schema}.categories c ON p.category_id = c.id
WHERE p.status = 'published'
ORDER BY p.published_at DESC;

-- Categories with post counts
CREATE OR REPLACE VIEW ${schema}.categories_with_counts AS
SELECT 
  c.id,
  c.name,
  c.slug,
  c.description,
  c.created_at,
  COUNT(p.id) as post_count
FROM ${schema}.categories c
LEFT JOIN ${schema}.posts p ON c.id = p.category_id AND p.status = 'published'
GROUP BY c.id, c.name, c.slug, c.description, c.created_at
ORDER BY c.name;

-- Grant view permissions
GRANT SELECT ON ${schema}.published_posts TO ${config?.anonRole || POSTGREST_DEFAULTS.dbAnonRole}, ${config?.authenticatedRole || POSTGREST_DEFAULTS.dbAuthenticatedRole};
GRANT SELECT ON ${schema}.post_summaries TO ${config?.anonRole || POSTGREST_DEFAULTS.dbAnonRole}, ${config?.authenticatedRole || POSTGREST_DEFAULTS.dbAuthenticatedRole};
GRANT SELECT ON ${schema}.categories_with_counts TO ${config?.anonRole || POSTGREST_DEFAULTS.dbAnonRole}, ${config?.authenticatedRole || POSTGREST_DEFAULTS.dbAuthenticatedRole};
`;
}

function generateEcommerceViews_ForOldSystem(schema: string, config?: any): string {
  return `-- E-commerce template views

-- Product catalog view
CREATE OR REPLACE VIEW ${schema}.product_catalog AS
SELECT 
  p.id,
  p.name,
  p.slug,
  p.description,
  p.price,
  p.sku,
  p.stock_quantity,
  p.images,
  p.status,
  p.created_at,
  p.updated_at,
  c.name as category_name,
  c.slug as category_slug
FROM ${schema}.products p
LEFT JOIN ${schema}.categories c ON p.category_id = c.id
WHERE p.status = 'active';

-- Customer order history
CREATE OR REPLACE VIEW ${schema}.customer_orders AS
SELECT 
  o.id,
  o.order_number,
  o.status,
  o.total_amount,
  o.created_at,
  o.updated_at,
  COUNT(oi.id) as item_count,
  json_agg(
    json_build_object(
      'product_name', p.name,
      'quantity', oi.quantity,
      'unit_price', oi.unit_price,
      'total_price', oi.total_price
    )
  ) as items
FROM ${schema}.orders o
LEFT JOIN ${schema}.order_items oi ON o.id = oi.order_id
LEFT JOIN ${schema}.products p ON oi.product_id = p.id
GROUP BY o.id, o.order_number, o.status, o.total_amount, o.created_at, o.updated_at;

-- Category tree (for hierarchical categories)
CREATE OR REPLACE VIEW ${schema}.category_tree AS
WITH RECURSIVE category_hierarchy AS (
  -- Base case: root categories
  SELECT 
    id, name, slug, description, parent_id, created_at,
    0 as level,
    ARRAY[name] as path
  FROM ${schema}.categories 
  WHERE parent_id IS NULL
  
  UNION ALL
  
  -- Recursive case: child categories
  SELECT 
    c.id, c.name, c.slug, c.description, c.parent_id, c.created_at,
    ch.level + 1,
    ch.path || c.name
  FROM ${schema}.categories c
  JOIN category_hierarchy ch ON c.parent_id = ch.id
)
SELECT * FROM category_hierarchy ORDER BY path;

-- Grant view permissions
GRANT SELECT ON ${schema}.product_catalog TO ${config?.anonRole || POSTGREST_DEFAULTS.dbAnonRole}, ${config?.authenticatedRole || POSTGREST_DEFAULTS.dbAuthenticatedRole};
GRANT SELECT ON ${schema}.customer_orders TO ${config?.authenticatedRole || POSTGREST_DEFAULTS.dbAuthenticatedRole};
GRANT SELECT ON ${schema}.category_tree TO ${config?.anonRole || POSTGREST_DEFAULTS.dbAnonRole}, ${config?.authenticatedRole || POSTGREST_DEFAULTS.dbAuthenticatedRole};
`;
}

function generateTriggers(config: any): string {
  const schema = config.apiSchemas[0];
  
  let sql = `-- Database triggers
-- Template: ${config.template}
-- Generated: ${new Date().toISOString()}

-- Updated_at trigger for all tables with updated_at column
`;

  // Add triggers based on template
  switch (config.template) {
    case 'basic':
      sql += generateBasicTriggers(schema);
      break;
    case 'blog':
      sql += generateBlogTriggers(schema);
      break;
    case 'ecommerce':
      sql += generateEcommerceTriggers(schema);
      break;
    default:
      sql += generateBasicTriggers(schema);
  }

  return sql;
}

// Template-specific trigger generators
function generateBasicTriggers(schema: string): string {
  return `
-- Basic template triggers

-- Users table
CREATE TRIGGER users_updated_at_trigger
  BEFORE UPDATE ON ${schema}.users
  FOR EACH ROW
  EXECUTE FUNCTION private.update_updated_at_column();

-- Profiles table
CREATE TRIGGER profiles_updated_at_trigger
  BEFORE UPDATE ON ${schema}.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.update_updated_at_column();
`;
}

function generateBlogTriggers(schema: string): string {
  return `
-- Blog template triggers

-- Authors table
CREATE TRIGGER authors_updated_at_trigger
  BEFORE UPDATE ON ${schema}.authors
  FOR EACH ROW
  EXECUTE FUNCTION private.update_updated_at_column();

-- Posts table
CREATE TRIGGER posts_updated_at_trigger
  BEFORE UPDATE ON ${schema}.posts
  FOR EACH ROW
  EXECUTE FUNCTION private.update_updated_at_column();

-- Auto-generate slug for posts
CREATE OR REPLACE FUNCTION private.generate_post_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := ${schema}.slugify(NEW.title);
    
    -- Make slug unique
    WHILE EXISTS(SELECT 1 FROM ${schema}.posts WHERE slug = NEW.slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')) LOOP
      NEW.slug := NEW.slug || '-' || floor(random() * 1000)::text;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_generate_slug_trigger
  BEFORE INSERT OR UPDATE ON ${schema}.posts
  FOR EACH ROW
  EXECUTE FUNCTION private.generate_post_slug();
`;
}

function generateEcommerceTriggers(schema: string): string {
  return `
-- E-commerce template triggers

-- Customers table
CREATE TRIGGER customers_updated_at_trigger
  BEFORE UPDATE ON ${schema}.customers
  FOR EACH ROW
  EXECUTE FUNCTION private.update_updated_at_column();

-- Products table
CREATE TRIGGER products_updated_at_trigger
  BEFORE UPDATE ON ${schema}.products
  FOR EACH ROW
  EXECUTE FUNCTION private.update_updated_at_column();

-- Orders table
CREATE TRIGGER orders_updated_at_trigger
  BEFORE UPDATE ON ${schema}.orders
  FOR EACH ROW
  EXECUTE FUNCTION private.update_updated_at_column();

-- Auto-generate product slug
CREATE OR REPLACE FUNCTION private.generate_product_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := ${schema}.slugify(NEW.name);
    
    -- Make slug unique
    WHILE EXISTS(SELECT 1 FROM ${schema}.products WHERE slug = NEW.slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')) LOOP
      NEW.slug := NEW.slug || '-' || floor(random() * 1000)::text;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_generate_slug_trigger
  BEFORE INSERT OR UPDATE ON ${schema}.products
  FOR EACH ROW
  EXECUTE FUNCTION private.generate_product_slug();

-- Update order total when items change
CREATE OR REPLACE FUNCTION private.update_order_total()
RETURNS trigger AS $$
DECLARE
  order_id uuid;
  new_total decimal(10,2);
BEGIN
  -- Get the order ID
  IF TG_OP = 'DELETE' THEN
    order_id := OLD.order_id;
  ELSE
    order_id := NEW.order_id;
  END IF;
  
  -- Calculate new total
  SELECT COALESCE(SUM(total_price), 0) 
  INTO new_total
  FROM ${schema}.order_items 
  WHERE order_items.order_id = order_id;
  
  -- Update order total
  UPDATE ${schema}.orders 
  SET total_amount = new_total, updated_at = NOW()
  WHERE id = order_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_items_update_total_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ${schema}.order_items
  FOR EACH ROW
  EXECUTE FUNCTION private.update_order_total();
`;
}

function generateIndexes(config: any): string {
  const schema = config.apiSchemas[0];
  
  let sql = `-- Performance indexes
-- Template: ${config.template}
-- Generated: ${new Date().toISOString()}

-- Common indexes for all templates
CREATE INDEX IF NOT EXISTS idx_updated_at ON ${schema}.users (updated_at);
CREATE INDEX IF NOT EXISTS idx_created_at ON ${schema}.users (created_at);

`;

  // Add template-specific indexes
  switch (config.template) {
    case 'basic':
      sql += generateBasicIndexes(schema);
      break;
    case 'blog':
      sql += generateBlogIndexes_ForOldSystem(schema);
      break;
    case 'ecommerce':
      sql += generateEcommerceIndexes_ForOldSystem(schema);
      break;
    default:
      sql += generateBasicIndexes(schema);
  }

  return sql;
}

// Template-specific index generators
function generateBasicIndexes(schema: string): string {
  return `-- Basic template indexes

-- Users table
CREATE INDEX IF NOT EXISTS idx_users_email ON ${schema}.users (email);

-- Profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON ${schema}.profiles (user_id);
`;
}

function generateBlogIndexes_ForOldSystem(schema: string): string {
  return `-- Blog template indexes

-- Authors table
CREATE INDEX IF NOT EXISTS idx_authors_email ON ${schema}.authors (email);

-- Categories table
CREATE INDEX IF NOT EXISTS idx_categories_slug ON ${schema}.categories (slug);

-- Posts table
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON ${schema}.posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_category_id ON ${schema}.posts (category_id);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON ${schema}.posts (slug);
CREATE INDEX IF NOT EXISTS idx_posts_status ON ${schema}.posts (status);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON ${schema}.posts (published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_posts_status_published_at ON ${schema}.posts (status, published_at DESC);

-- Comments table
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON ${schema}.comments (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_status ON ${schema}.comments (status);
CREATE INDEX IF NOT EXISTS idx_comments_post_status ON ${schema}.comments (post_id, status);
`;
}

function generateEcommerceIndexes_ForOldSystem(schema: string): string {
  return `-- E-commerce template indexes

-- Customers table
CREATE INDEX IF NOT EXISTS idx_customers_email ON ${schema}.customers (email);

-- Addresses table
CREATE INDEX IF NOT EXISTS idx_addresses_customer_id ON ${schema}.addresses (customer_id);
CREATE INDEX IF NOT EXISTS idx_addresses_customer_type ON ${schema}.addresses (customer_id, type);

-- Categories table
CREATE INDEX IF NOT EXISTS idx_categories_slug ON ${schema}.categories (slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON ${schema}.categories (parent_id);

-- Products table
CREATE INDEX IF NOT EXISTS idx_products_category_id ON ${schema}.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON ${schema}.products (slug);
CREATE INDEX IF NOT EXISTS idx_products_sku ON ${schema}.products (sku);
CREATE INDEX IF NOT EXISTS idx_products_status ON ${schema}.products (status);
CREATE INDEX IF NOT EXISTS idx_products_price ON ${schema}.products (price);

-- Orders table
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON ${schema}.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON ${schema}.orders (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON ${schema}.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON ${schema}.orders (customer_id, created_at DESC);

-- Order items table
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON ${schema}.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON ${schema}.order_items (product_id);
`;
}

async function generateAndMergePackageJson(config: any, existingPackageJson: any = {}) {
  const dirName = path.basename(process.cwd());
  
  // PGRestify scripts to add/update
  const pgrestifyScripts = {
    // Core operations
    "pgrestify:setup": "./scripts/setup.sh",
    "pgrestify:start": config.useDocker ? "docker compose up -d" : "postgrest postgrest.conf",
    "pgrestify:stop": config.useDocker ? "docker compose down" : "pkill -f postgrest",
    "pgrestify:logs": config.useDocker ? "docker compose logs -f postgrest" : "tail -f postgrest.log",
    
    // Database operations
    "pgrestify:migrate": "pgrestify api migrate",
    "pgrestify:migrate:skip-data": "pgrestify api migrate --skip-testing-data",
    
    // Generate commands
    "pgrestify:generate:testing-data": `pgrestify api testing-data --template ${config.template}`,
    "pgrestify:generate:policy": "pgrestify api generate policy",
    "pgrestify:generate:view": "pgrestify api generate view",
    "pgrestify:generate:function": "pgrestify api generate function",
    
    // Feature commands
    "pgrestify:features:indexes": "pgrestify api features indexes suggest --dynamic",
    "pgrestify:features:views": "pgrestify api features views suggest",
    "pgrestify:features:triggers": "pgrestify api features triggers suggest",
    
    // Validation and maintenance
    "pgrestify:validate": "pgrestify validate --all",
    "pgrestify:validate:security": "pgrestify validate --security",
    "pgrestify:validate:performance": "pgrestify validate --performance"
  };

  // Create base package.json structure
  const basePackage = {
    name: existingPackageJson.name || dirName,
    version: existingPackageJson.version || "1.0.0",
    description: existingPackageJson.description || `PostgREST API generated with PGRestify (${config.template} template)`,
    ...existingPackageJson,
    scripts: {
      ...existingPackageJson.scripts,
      ...pgrestifyScripts
    }
  };

  // Only add keywords if they don't exist
  if (!basePackage.keywords || basePackage.keywords.length === 0) {
    basePackage.keywords = ["postgrest", "api", "postgresql", "rest"];
  } else {
    // Merge keywords, avoiding duplicates
    const existingKeywords = new Set(basePackage.keywords);
    ["postgrest", "api", "postgresql", "rest"].forEach(keyword => {
      if (!existingKeywords.has(keyword)) {
        basePackage.keywords.push(keyword);
      }
    });
  }

  // Only set author if not already set
  if (!basePackage.author) {
    basePackage.author = "Generated by PGRestify";
  }

  // Only set license if not already set
  if (!basePackage.license) {
    basePackage.license = "MIT";
  }

  return basePackage;
}

function generateUtilityScripts(config: any): string {
  const dirName = path.basename(process.cwd());
  return `#!/bin/bash
# Setup script for ${dirName}
# Generated: ${new Date().toISOString()}

set -e

echo "🚀 Setting up ${dirName}..."

${config.useDocker ? `
# Docker setup
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker."
    exit 1
fi

# Check for Docker Compose (v2)
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose not found. Please install Docker with Compose plugin."
    exit 1
fi

echo "🐳 Starting Docker services..."
docker compose up -d

echo "⏳ Waiting for database to be ready..."
sleep 10

echo "🔑 Setting up database roles..."
if [ -f "sql/roles.sql" ]; then
    docker compose exec -T postgres psql -U ${config.username} -d ${config.database} < sql/roles.sql || echo "⚠️  Roles setup failed, continuing..."
else
    echo "⚠️  No roles.sql found, skipping role setup"
fi

${generateMigrationCommands(config, true)}

echo "🔍 Testing API..."
curl -f http://localhost:${config.serverPort}/ || echo "⚠️  API not ready yet, try again in a few seconds"
` : `
# Local setup
echo "🔍 Checking PostgreSQL connection..."
psql -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database} -c "SELECT version();"

echo "🔑 Setting up database roles..."
if [ -f "sql/roles.sql" ]; then
    psql -h ${config.host} -p ${config.port} -U ${config.username} -d ${config.database} -f sql/roles.sql || echo "⚠️  Roles setup failed, continuing..."
else
    echo "⚠️  No roles.sql found, skipping role setup"
fi

${generateMigrationCommands(config, false)}

echo "🚀 Starting PostgREST..."
postgrest postgrest.conf &

sleep 5

echo "🔍 Testing API..."
curl -f http://localhost:${config.serverPort}/
`}

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Review the generated SQL files in sql/"
echo "2. Customize your database schema"
echo "3. Test your API endpoints"
echo ""
echo "🌐 API URL: http://localhost:${config.serverPort}/"
echo ""
echo "📌 Useful commands:"
echo "  npm run pgrestify:logs    # View API logs"
echo "  npm run pgrestify:stop    # Stop services"
echo "  npm run pgrestify:reset   # Reset and restart everything"
`;
}

/**
 * Display completion instructions
 */
function displayCompletionInstructions(config: any) {
  logger.newLine();
  logger.success(chalk.green('🎉 PostgREST API Configuration Created Successfully!'));
  logger.newLine();
  
  logger.info(chalk.cyan('📁 Location:'));
  logger.info(`  ${config.currentPath}`);
  logger.newLine();
  
  logger.info(chalk.cyan('🔧 Configuration Summary:'));
  logger.list([
    `Template: ${config.template}`,
    `Environment: ${config.environment}`,
    `Deployment: ${config.useDocker ? 'Docker' : 'Local'}`,
    `Database: ${config.database}`,
    `API Port: ${config.serverPort}`,
    `Schemas: ${config.apiSchemas.join(', ')}`
  ]);
  
  logger.newLine();
  
  if (config.autoSetup && config.setupCompleted) {
    logger.info(chalk.green('🎉 Automatic Setup Complete!'));
    logger.info('Your database has been initialized with schema and testing data.');
    
    if (config.includeTestingData) {
      logger.info('🎲 Sample data is ready for testing your API endpoints.');
    }
    
    logger.newLine();
    logger.info(chalk.cyan('🚀 Your API is ready to use:'));
    logger.info(`  🌐 API URL: http://localhost:${config.serverPort}/`);
    
  } else if (config.includeTestingData) {
    logger.info(chalk.cyan('🎲 Testing Data Ready!'));
    logger.info('Run this single command to set up everything:');
    logger.newLine();
    logger.code('npm run pgrestify:setup');
    logger.newLine();
    logger.info('This will automatically:');
    logger.list([
      '🏗️  Create database schema',
      '🔒 Apply security policies',
      '🎲 Load your testing data',
      '🚀 Start the API server'
    ]);
    
  } else if (!config.runMigrations) {
    logger.info(chalk.yellow('⚠️  Database Setup Required:'));
    logger.info('Before starting PostgREST, you need to run the database migrations:');
    logger.newLine();
    
    if (config.useDocker) {
      logger.code(`# Start Docker services first
docker compose up -d

# Wait for database to be ready, then run migrations (new table-folder structure)
${generateMigrationCommands(config, true)}

# Or simply run the setup script:
npm run pgrestify:setup`);
    } else {
      logger.code(`# Run migrations manually (new table-folder structure)
${generateMigrationCommands(config, false)}

# Or simply run the setup script:
npm run pgrestify:setup`);
    }
    logger.newLine();
  }
  
  logger.info(chalk.cyan('🚀 Quick Start:'));
  logger.code(`# Step 1: Setup and run migrations
npm run pgrestify:setup

# Step 2: Start the API server
npm run pgrestify:start

# Step 3: View logs (optional)
npm run pgrestify:logs

# View API documentation
open http://localhost:${config.serverPort}/`);
  
  logger.newLine();
  logger.info(chalk.yellow('📚 What\'s Generated:'));
  logger.list([
    '📄 Database schema files (sql/schemas/)',
    config.includeFunctions ? '🔧 Authentication functions (sql/functions/)' : null,
    config.includeTestingData ? '🎲 Realistic testing data (sql/testing_data.sql)' : null,
    '⚙️  PostgREST configuration (postgrest.conf)',
    config.useDocker ? '🐳 Docker Compose setup (docker-compose.yml + .env)' : null,
    '📦 Package.json with useful scripts',
    '🛠️  Setup script (scripts/setup.sh)'
  ].filter(Boolean));
  
  logger.newLine();
  logger.info(chalk.cyan('🔧 Available Scripts:'));
  logger.code(`# Core operations
npm run pgrestify:setup                    # Initial setup with migrations
npm run pgrestify:start                    # Start entire stack (DB + API)
npm run pgrestify:stop                     # Stop entire stack
npm run pgrestify:logs                     # View PostgREST logs

# Database operations  
npm run pgrestify:migrate                  # Run database migrations
npm run pgrestify:migrate:skip-data        # Run migrations without testing data

# Generate new resources
npm run pgrestify:generate:testing-data    # Generate fresh testing data
npm run pgrestify:generate:policy          # Generate RLS policies
npm run pgrestify:generate:view            # Generate database views
npm run pgrestify:generate:function        # Generate database functions

# Performance and features
npm run pgrestify:features:indexes         # Suggest performance indexes
npm run pgrestify:validate                 # Validate entire setup`);
  
  if (config.environment === 'production') {
    logger.newLine();
    logger.warn(chalk.red('🔒 Production Security Reminders:'));
    logger.list([
      'Review all generated passwords and secrets',
      'Configure proper CORS origins',
      'Set up HTTPS/TLS termination',
      'Enable database connection encryption',
      'Set up monitoring and backups',
      'Review and test all security policies'
    ]);
  }
  
  logger.newLine();
  logger.info(chalk.green('Happy coding! 🎈'));
}