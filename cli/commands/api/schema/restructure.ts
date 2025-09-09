/**
 * @fileoverview SQL Structure Restructuring Command
 * 
 * Migrates existing projects from old numbered SQL files 
 * (01_main.sql, 02_rls.sql, etc.) to the new table-based
 * folder structure.
 * 
 * @author PGRestify Team
 * @since 3.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../../../utils/logger.js';
import { fs } from '../../../utils/fs.js';
import { migrateToNewStructure, validateStructure } from '../../../utils/sql-structure.js';

/**
 * Create restructure command
 */
export function createRestructureCommand(): Command {
  const command = new Command('restructure');
  
  command
    .description('Migrate SQL files from old numbered structure to new table-based folders')
    .option('--force', 'Skip confirmation and force migration')
    .option('--backup-dir <dir>', 'Custom backup directory location')
    .option('--dry-run', 'Preview changes without applying them')
    .action(async (options) => {
      await restructureSQLFiles(options);
    });
  
  return command;
}

/**
 * Main restructuring function
 */
async function restructureSQLFiles(options: any) {
  logger.info(chalk.cyan('🔄 SQL Structure Migration'));
  logger.newLine();
  
  const projectPath = process.cwd();
  
  // Check if old structure exists
  const oldFiles = [
    'sql/schemas/01_main.sql',
    'sql/schemas/02_rls.sql', 
    'sql/schemas/03_views.sql',
    'sql/schemas/04_triggers.sql',
    'sql/schemas/05_indexes.sql'
  ];
  
  let foundOldFiles = 0;
  const existingFiles: string[] = [];
  
  for (const file of oldFiles) {
    if (await fs.exists(file)) {
      foundOldFiles++;
      existingFiles.push(file);
    }
  }
  
  if (foundOldFiles === 0) {
    logger.info(chalk.green('✅ No old structure files found.'));
    logger.info('This project is either already using the new structure or has no schema files.');
    
    // Check if new structure exists
    const newStructureExists = await checkNewStructureExists(projectPath);
    if (newStructureExists) {
      logger.info(chalk.blue('📁 New table-based structure is already in use.'));
      const isValid = await validateStructure(projectPath);
      if (isValid) {
        logger.success('✅ Structure validation passed.');
      } else {
        logger.warn('⚠️  Structure validation found issues. Check table folders have table.sql files.');
      }
    } else {
      logger.info(chalk.gray('No SQL structure found. This might be a new project.'));
    }
    return;
  }
  
  logger.info(chalk.blue(`📋 Found ${foundOldFiles} old structure files:`));
  existingFiles.forEach(file => {
    logger.info(`  📄 ${file}`);
  });
  logger.newLine();
  
  if (options.dryRun) {
    await previewRestructuring(existingFiles);
    return;
  }
  
  // Confirm migration unless --force is used
  if (!options.force) {
    logger.warn(chalk.yellow('⚠️  This will restructure your SQL files into table-based folders.'));
    logger.info(chalk.gray('   A backup will be created automatically.'));
    logger.info(chalk.gray('   The migration preserves all your SQL content.'));
    logger.newLine();
    
    const { confirmMigration } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmMigration',
      message: 'Proceed with SQL structure migration?',
      default: false
    }]);
    
    if (!confirmMigration) {
      logger.info('Migration cancelled.');
      return;
    }
  }
  
  // Perform the migration
  try {
    logger.info(chalk.cyan('🚀 Starting migration...'));
    logger.newLine();
    
    await migrateToNewStructure(projectPath);
    
    logger.newLine();
    logger.success('🎉 Migration completed successfully!');
    
    // Validate the new structure
    logger.info('🔍 Validating new structure...');
    const isValid = await validateStructure(projectPath);
    
    if (isValid) {
      logger.success('✅ New structure validation passed.');
      logger.newLine();
      
      // Show next steps
      logger.info(chalk.cyan('📋 Next Steps:'));
      logger.list([
        'Review the migrated files in sql/schemas/[table_name]/ folders',
        'Run "pgrestify api migrate" to test the new structure',
        'Check backup files in case you need to revert',
        'Update any custom scripts that referenced the old file paths'
      ]);
    } else {
      logger.warn('⚠️  Structure validation found issues. Please review the migrated files.');
    }
    
  } catch (error) {
    logger.error(`❌ Migration failed: ${error.message}`);
    logger.info('💡 Check the backup files and try again, or report this issue.');
  }
}

/**
 * Check if new structure exists
 */
async function checkNewStructureExists(projectPath: string): Promise<boolean> {
  const schemasPath = `${projectPath}/sql/schemas`;
  
  if (!await fs.exists(schemasPath)) {
    return false;
  }
  
  const entries = await fs.readDir(schemasPath);
  
  // Look for directories (table folders)
  for (const entry of entries) {
    const fullPath = `${schemasPath}/${entry}`;
    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()) {
      // Check if it has table.sql file
      const tableFile = `${fullPath}/table.sql`;
      if (await fs.exists(tableFile)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Preview restructuring without applying changes
 */
async function previewRestructuring(existingFiles: string[]) {
  logger.info(chalk.yellow('👀 Dry Run Mode - No changes will be made'));
  logger.newLine();
  
  logger.info(chalk.cyan('📋 Migration Preview:'));
  logger.newLine();
  
  for (const file of existingFiles) {
    logger.info(`📄 Processing ${chalk.bold(file)}:`);
    
    try {
      const content = await fs.readFile(file);
      const tables = await parseTablesFromSQL(content);
      
      if (tables.length > 0) {
        logger.info(`  🔍 Found ${tables.length} table(s):`);
        tables.forEach(table => {
          logger.info(`    📁 sql/schemas/${table}/`);
          
          if (file.includes('01_main')) {
            logger.info(`      ├── table.sql (table definitions)`);
          } else if (file.includes('02_rls')) {
            logger.info(`      ├── rls.sql (row level security)`);
          } else if (file.includes('03_views')) {
            logger.info(`      ├── views.sql (database views)`);
          } else if (file.includes('04_triggers')) {
            logger.info(`      ├── triggers.sql (database triggers)`);
          } else if (file.includes('05_indexes')) {
            logger.info(`      ├── indexes.sql (database indexes)`);
          }
        });
      } else {
        logger.info(`  ⚠️  No table names detected in this file`);
      }
      
      logger.newLine();
    } catch (error) {
      logger.warn(`  ❌ Could not parse ${file}: ${error.message}`);
    }
  }
  
  logger.info(chalk.blue('💡 Run without --dry-run to apply these changes'));
}

/**
 * Parse table names from SQL content
 */
async function parseTablesFromSQL(sqlContent: string): Promise<string[]> {
  const tables = new Set<string>();
  
  // Find CREATE TABLE statements
  const createTableMatches = sqlContent.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:\w+\.)?(\w+)/gi);
  for (const match of createTableMatches) {
    tables.add(match[1]);
  }
  
  // Find ALTER TABLE statements
  const alterTableMatches = sqlContent.matchAll(/ALTER TABLE\s+(?:\w+\.)?(\w+)/gi);
  for (const match of alterTableMatches) {
    tables.add(match[1]);
  }
  
  // Find CREATE POLICY statements
  const policyMatches = sqlContent.matchAll(/CREATE POLICY\s+\S+\s+ON\s+(?:\w+\.)?(\w+)/gi);
  for (const match of policyMatches) {
    tables.add(match[1]);
  }
  
  return Array.from(tables);
}