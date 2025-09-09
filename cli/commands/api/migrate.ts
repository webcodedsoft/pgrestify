/**
 * @fileoverview Database migration utilities
 * 
 * Standalone migration runner for applying generated SQL schemas
 * to PostgreSQL databases. Supports both local and Docker deployments.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../../utils/logger.js';
import { fs } from '../../utils/fs.js';
import { getSQLFilesForMigration, getAllTableFolders, SQL_EXECUTION_ORDER, SQL_FILE_TYPES } from '../../utils/sql-structure.js';
import { extractDatabaseConnection, buildConnectionString } from '../../utils/database-connection.js';

/**
 * Create migrate command
 */
export function createMigrateCommand(): Command {
  const command = new Command('migrate');
  
  command
    .description('Run database migrations')
    .option('--db-uri <uri>', 'Database connection URI')
    .option('--host <host>', 'Database host', 'localhost')
    .option('--port <port>', 'Database port', '5432')
    .option('--database <database>', 'Database name')
    .option('--username <username>', 'Database username', 'postgres')
    .option('--password <password>', 'Database password')
    .option('--docker', 'Use Docker to run migrations')
    .option('--force', 'Force migrations even if some fail')
    .option('--skip-testing-data', 'Skip testing data insertion (schema only)')
    .action(async (options) => {
      await runMigrations(options);
    });
  
  return command;
}

/**
 * Run database migrations
 */
async function runMigrations(options: any) {
  logger.info(chalk.cyan('🗄️  Database Migration Runner'));
  logger.newLine();
  
  // Collect database credentials if not provided
  const config = await collectMigrationConfig(options);
  
  // Check if migration files exist
  let migrationFiles = await findMigrationFiles();
  
  // Filter out testing data if --skip-testing-data flag is used
  if (options.skipTestingData) {
    migrationFiles = migrationFiles.filter(file => !file.includes('testing_data.sql'));
    logger.info(chalk.gray('📝 Skipping testing data (--skip-testing-data flag used)'));
  }
  
  if (migrationFiles.length === 0) {
    logger.error('❌ No migration files found in sql/ directory');
    logger.info('💡 Make sure you\'re in a project directory with generated SQL files');
    return;
  }
  
  logger.info(chalk.cyan('📋 Found Migration Files:'));
  const schemaFiles = [];
  const testingDataFiles = [];
  
  migrationFiles.forEach(file => {
    if (file.includes('testing_data.sql')) {
      testingDataFiles.push(file);
      logger.info(`  🎲 ${file} ${chalk.yellow('(testing data)')}`);
    } else {
      schemaFiles.push(file);
      logger.info(`  📄 ${file}`);
    }
  });
  logger.newLine();
  
  // Confirm before running
  if (!options.force) {
    const prompts = [
      {
        type: 'confirm',
        name: 'confirmMigration',
        message: 'Run these migrations against the database?',
        default: false
      }
    ];
    
    // Add specific warning for testing data (only if not already skipped by flag)
    if (testingDataFiles.length > 0 && !options.skipTestingData) {
      logger.warn(chalk.yellow('⚠️  Testing data will insert sample records into your database.'));
      logger.info(chalk.gray('   This is useful for development but should NOT be used in production.'));
      logger.newLine();
      
      prompts.push({
        type: 'confirm',
        name: 'includeTestingData',
        message: 'Include testing data in this migration?',
        default: true
      });
    }
    
    const answers = await inquirer.prompt(prompts);
    
    if (!answers.confirmMigration) {
      logger.info('Migration cancelled.');
      return;
    }
    
    // Filter out testing data if user declined
    if (testingDataFiles.length > 0 && !answers.includeTestingData) {
      const filteredFiles = migrationFiles.filter(file => !file.includes('testing_data.sql'));
      logger.info(chalk.gray('📝 Skipping testing data files.'));
      await applyMigrations(config, filteredFiles);
      return;
    }
  }
  
  // Run migrations
  await applyMigrations(config, migrationFiles);
}

/**
 * Collect migration configuration
 */
async function collectMigrationConfig(options: any) {
  if (options.dbUri) {
    return { ...options, dbUri: options.dbUri };
  }
  
  // Try to extract database credentials using centralized utility
  const connection = await extractDatabaseConnection({ verbose: false });
  if (connection) {
    logger.info(chalk.gray('📋 Found database credentials in configuration'));
    const dbUri = buildConnectionString(connection);
    return { 
      ...options, 
      dbUri,
      username: connection.user,
      password: connection.password,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      docker: connection.host === 'localhost' // Assume Docker if using localhost
    };
  }
  
  // Fallback to prompting for missing credentials
  const prompts = [];
  
  if (!options.database) {
    prompts.push({
      type: 'input',
      name: 'database',
      message: 'Database name:',
      validate: (input: string) => input.trim().length > 0 || 'Database name is required'
    });
  }
  
  if (!options.password) {
    prompts.push({
      type: 'password',
      name: 'password',
      message: 'Database password:',
      mask: '*'
    });
  }
  
  if (prompts.length > 0) {
    const answers = await inquirer.prompt(prompts);
    Object.assign(options, answers);
  }
  
  return options;
}

/**
 * Find migration files in the current directory
 */
async function findMigrationFiles(): Promise<string[]> {
  const foundFiles = [];
  const projectPath = process.cwd();
  
  // First, check if we have the old structure and warn about it
  const oldFiles = [
    'sql/schemas/01_main.sql',
    'sql/schemas/02_rls.sql', 
    'sql/schemas/03_views.sql',
    'sql/schemas/04_triggers.sql',
    'sql/schemas/05_indexes.sql'
  ];
  
  let hasOldStructure = false;
  for (const oldFile of oldFiles) {
    if (await fs.exists(oldFile)) {
      hasOldStructure = true;
      break;
    }
  }
  
  if (hasOldStructure) {
    logger.warn(chalk.yellow('⚠️  Old SQL structure detected!'));
    logger.info(chalk.gray('   The migration system now uses table-based folders.'));
    logger.info(chalk.gray('   Run "pgrestify api schema restructure" to migrate to the new structure.'));
    logger.newLine();
    
    // Fall back to old structure for backward compatibility
    for (const file of oldFiles) {
      if (await fs.exists(file)) {
        foundFiles.push(file);
      }
    }
  } else {
    // Use new table-folder structure
    logger.info(chalk.gray('📁 Using table-based SQL structure'));
    
    const sqlFiles = await getSQLFilesForMigration(projectPath);
    foundFiles.push(...sqlFiles);
  }
  
  // Always check for auth functions and testing data (these remain in the old locations)
  const additionalFiles = [
    'sql/functions/auth.sql',
    'sql/testing_data.sql'
  ];
  
  for (const file of additionalFiles) {
    if (await fs.exists(file)) {
      foundFiles.push(file);
    }
  }
  
  return foundFiles;
}



/**
 * Apply migrations to the database
 */
async function applyMigrations(config: any, migrationFiles: string[]) {
  try {
    // Check if psql is available (unless using Docker)
    if (!config.docker) {
      try {
        await fs.exec('psql --version');
      } catch {
        logger.error('❌ psql command not found. Please install PostgreSQL client tools.');
        logger.info('💡 Or use --docker flag to run migrations via Docker');
        return;
      }
    }
    
    const dbUri = config.dbUri || 
      `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const file of migrationFiles) {
      // Provide specific messaging for different file types
      if (file.includes('testing_data.sql')) {
        logger.info(`🎲 Loading testing data from ${chalk.bold(file)}...`);
      } else if (file.includes('auth.sql')) {
        logger.info(`🔑 Installing authentication functions from ${chalk.bold(file)}...`);
      } else if (file.includes('01_main.sql')) {
        // Old structure - table definitions
        logger.info(`🏗️  Creating tables and schemas from ${chalk.bold(file)}...`);
      } else if (file.includes('02_rls.sql')) {
        // Old structure - RLS policies
        logger.info(`🔒 Applying row-level security from ${chalk.bold(file)}...`);
      } else if (file.includes('03_views.sql')) {
        // Old structure - views
        logger.info(`👁️  Creating database views from ${chalk.bold(file)}...`);
      } else if (file.includes('04_triggers.sql')) {
        // Old structure - triggers
        logger.info(`⚡ Installing database triggers from ${chalk.bold(file)}...`);
      } else if (file.includes('05_indexes.sql')) {
        // Old structure - indexes
        logger.info(`📇 Creating database indexes from ${chalk.bold(file)}...`);
      } else if (file.includes('table.sql')) {
        // New structure - table definitions
        const tableName = file.split('/').slice(-2)[0]; // Extract table name from path
        logger.info(`🏗️  Creating table ${chalk.bold(tableName)} from ${chalk.bold(file)}...`);
      } else if (file.includes('rls.sql')) {
        // New structure - RLS policies
        const tableName = file.split('/').slice(-2)[0];
        logger.info(`🔒 Applying RLS policies for ${chalk.bold(tableName)} from ${chalk.bold(file)}...`);
      } else if (file.includes('views.sql')) {
        // New structure - views
        const tableName = file.split('/').slice(-2)[0];
        logger.info(`👁️  Creating views for ${chalk.bold(tableName)} from ${chalk.bold(file)}...`);
      } else if (file.includes('triggers.sql')) {
        // New structure - triggers
        const tableName = file.split('/').slice(-2)[0];
        logger.info(`⚡ Installing triggers for ${chalk.bold(tableName)} from ${chalk.bold(file)}...`);
      } else if (file.includes('indexes.sql')) {
        // New structure - indexes
        const tableName = file.split('/').slice(-2)[0];
        logger.info(`📇 Creating indexes for ${chalk.bold(tableName)} from ${chalk.bold(file)}...`);
      } else {
        logger.info(`📄 Applying ${chalk.bold(file)}...`);
      }
      
      try {
        if (config.docker) {
          // Use Docker to run the migration
          await fs.exec(`docker compose exec -T postgres psql -U ${config.username} -d ${config.database} < ${file}`);
        } else {
          // Use local psql
          await fs.exec(`psql "${dbUri}" -f "${file}" -q`);
        }
        
        if (file.includes('testing_data.sql')) {
          logger.success(`✅ Testing data loaded successfully`);
        } else {
          logger.success(`✅ Applied ${file}`);
        }
        successCount++;
      } catch (error) {
        logger.error(`❌ Failed to apply ${file}:`);
        logger.error(`   ${error}`);
        failureCount++;
        
        if (!config.force) {
          logger.warn('💡 Use --force to continue applying remaining migrations');
          break;
        }
      }
    }
    
    logger.newLine();
    if (failureCount === 0) {
      logger.success(`🎉 All ${successCount} migrations applied successfully!`);
    } else {
      logger.warn(`⚠️  Migration completed with ${successCount} successes and ${failureCount} failures`);
    }
    
  } catch (error) {
    logger.error(`Failed to run migrations: ${error}`);
  }
}