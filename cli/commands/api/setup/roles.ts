/**
 * @fileoverview Setup database roles command
 * 
 * Generates database roles based on PostgREST configuration and creates
 * the necessary SQL file for role setup.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import { join } from 'path';
import chalk from 'chalk';
import { logger } from '../../../utils/logger.js';
import { fs } from '../../../utils/fs.js';
import { RoleGenerator, type RoleConfig } from '../../../generators/RoleGenerator.js';

/**
 * Create roles setup command
 */
export function createRolesCommand(): Command {
  const command = new Command('roles');
  
  command
    .description('Generate database roles based on PostgREST configuration')
    .option('--output <path>', 'Output SQL file path', 'sql/roles.sql')
    .option('--dry-run', 'Show generated SQL without writing file')
    .option('--execute', 'Execute SQL against database directly')
    .action(async (options) => {
      await generateRoles(options);
    });
  
  return command;
}

/**
 * Generate database roles
 */
async function generateRoles(options: any) {
  logger.info(chalk.cyan('🔑 Generating Database Roles'));
  logger.newLine();
  
  try {
    const projectPath = process.cwd();
    const generator = new RoleGenerator(projectPath);
    
    // Get role configuration
    const roleConfig = await generator.getRoleConfig();
    generator.displayRoleInfo(roleConfig);
    
    // Generate SQL
    const roleSQL = await generator.generateRoleSetup();
    
    if (options.dryRun) {
      logger.newLine();
      logger.info(chalk.cyan('📋 Generated SQL (dry-run):'));
      logger.code(roleSQL);
      return;
    }
    
    // Write SQL file
    const outputPath = join(projectPath, options.output);
    await fs.ensureDir(join(projectPath, 'sql'));
    await fs.writeFile(outputPath, roleSQL);
    
    logger.success(`✅ Roles SQL generated: ${options.output}`);
    
    // Display usage instructions
    displayRolesUsage(options.output, roleConfig);
    
    if (options.execute) {
      await executeRoles(roleSQL, projectPath);
    }
    
  } catch (error: any) {
    logger.error(`❌ Failed to generate roles: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Execute roles SQL against database
 */
async function executeRoles(sql: string, projectPath: string) {
  logger.newLine();
  logger.info(chalk.blue('⚡ Executing roles setup...'));
  
  try {
    const { DatabaseManager } = await import('../../../utils/database.js');
    const dbManager = new DatabaseManager(projectPath);
    
    const connection = await dbManager.extractConnection();
    if (!connection) {
      logger.warn('No database connection found. Please run SQL manually.');
      return;
    }
    
    await dbManager.executeSQL(sql, connection);
    logger.success('✅ Roles setup completed successfully!');
    
  } catch (error: any) {
    logger.error(`❌ Failed to execute roles setup: ${error.message}`);
    logger.info('💡 You can run the SQL file manually against your database');
  }
}

/**
 * Display roles usage instructions
 */
function displayRolesUsage(outputPath: string, roleConfig: RoleConfig) {
  logger.newLine();
  logger.info(chalk.cyan('📋 Usage Instructions:'));
  
  logger.list([
    `Execute roles: psql -d your_database -f ${outputPath}`,
    'Or use Docker: docker compose exec -T postgres psql -U postgres -d your_db < ' + outputPath,
    'Or run with --execute flag for automatic execution'
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('🔗 PostgREST Integration:'));
  
  logger.list([
    `Anonymous requests use role: ${chalk.green(roleConfig.anonRole)}`,
    `Authenticated requests use role: ${chalk.green(roleConfig.authenticatedRole)}`,
    `Admin operations use role: ${chalk.green(roleConfig.adminRole)}`,
    'Roles are automatically used by PostgREST based on JWT claims'
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Next Steps:'));
  
  logger.list([
    'Execute the roles SQL in your database',
    'Restart PostgREST to pick up role changes',
    'Test your API endpoints with different authentication levels',
    'Update RLS policies to reference these roles',
    'Consider running pgrestify api migrate to apply all changes'
  ]);
}