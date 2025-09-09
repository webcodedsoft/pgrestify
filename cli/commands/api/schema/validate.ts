/**
 * @fileoverview Schema validation for PostgREST
 * 
 * Validates schema compatibility with PostgREST and checks
 * security policies, role configurations, and best practices.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from '../../../utils/logger.js';
import { fs } from '../../../utils/fs.js';
import { getAllTableFolders, getTableSQLFilePath, SQL_FILE_TYPES, getSQLFilesForMigration } from '../../../utils/sql-structure.js';
import { getPostgRESTConfig } from '../../../utils/postgrest-config.js';

/**
 * Create schema validate command
 */
export function createValidateCommand(): Command {
  const command = new Command('validate');
  
  command
    .description('Validate PostgREST schema (table-based folder structure)')
    .option('--single-file <file>', 'Validate specific schema file (legacy mode)')
    .option('--check-rls', 'Check RLS policies', true)
    .option('--check-roles', 'Check role configuration', true)
    .option('--check-permissions', 'Check permissions', true)
    .action(async (options) => {
      await validateSchema(options);
    });
  
  return command;
}

/**
 * Validate schema for PostgREST compatibility
 */
async function validateSchema(options: any) {
  logger.info(chalk.cyan('🔍 Validating PostgREST Schema'));
  logger.newLine();
  
  if (options.singleFile) {
    // Legacy single file validation
    await validateSingleFile(options.singleFile, options);
  } else {
    // Table-folder structure validation (default)
    await validateTableFolderStructure(options);
  }
}

/**
 * Validate single file (legacy mode)
 */
async function validateSingleFile(filePath: string, options: any) {
  logger.info(chalk.blue('📄 Validating single file (legacy mode)'));
  
  if (!await fs.exists(filePath)) {
    logger.error(`Schema file not found: ${filePath}`);
    process.exit(1);
  }
  
  try {
    const schemaContent = await fs.readFile(filePath);
    const results = await performValidation(schemaContent, options);
    
    displayValidationResults(results);
    
    if (results.errors.length > 0) {
      process.exit(1);
    }
    
  } catch (error: any) {
    logger.error(`Validation failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Validate table-folder structure
 */
async function validateTableFolderStructure(options: any) {
  logger.info(chalk.blue('📁 Validating table-folder structure'));
  logger.newLine();
  
  const projectPath = process.cwd();
  const tables = await getAllTableFolders(projectPath);
  
  if (tables.length === 0) {
    logger.error('❌ No table folders found in sql/schemas/');
    logger.info('💡 Run "pgrestify api init" to create a project or "pgrestify api schema generate" to create tables');
    process.exit(1);
  }
  
  logger.info(`📋 Found ${tables.length} table(s): ${tables.join(', ')}`);
  logger.newLine();
  
  const results = {
    errors: [] as string[],
    warnings: [] as string[],
    info: [] as string[]
  };
  
  // Validate each table folder
  for (const table of tables) {
    await validateTableFolder(projectPath, table, results, options);
  }
  
  // Validate overall structure
  await validateProjectStructure(projectPath, results, options);
  
  displayValidationResults(results);
  
  if (results.errors.length > 0) {
    process.exit(1);
  }
}

/**
 * Perform schema validation
 */
async function performValidation(content: string, options: any) {
  const results = {
    errors: [] as string[],
    warnings: [] as string[],
    info: [] as string[]
  };
  
  // Check required extensions
  validateExtensions(content, results);
  
  // Check roles
  if (options.checkRoles) {
    await validateRoles(content, results);
  }
  
  // Check RLS
  if (options.checkRls) {
    await validateRLS(content, results);
  }
  
  // Check permissions
  if (options.checkPermissions) {
    validatePermissions(content, results);
  }
  
  return results;
}

/**
 * Validate required extensions
 */
function validateExtensions(content: string, results: any) {
  const requiredExtensions = ['uuid-ossp', 'pgcrypto'];
  const recommendedExtensions = ['pgjwt'];
  
  for (const ext of requiredExtensions) {
    if (!content.includes(`"${ext}"`)) {
      results.errors.push(`Missing required extension: ${ext}`);
    }
  }
  
  for (const ext of recommendedExtensions) {
    if (!content.includes(`"${ext}"`)) {
      results.warnings.push(`Missing recommended extension: ${ext}`);
    }
  }
}

/**
 * Validate PostgREST roles
 */
async function validateRoles(content: string, results: any) {
  const postgrestConfig = await getPostgRESTConfig();
  const anonRole = postgrestConfig.anonRole;
  const authenticatedRole = 'authenticated';
  const authenticatorRole = 'authenticator';
  
  const requiredRoles = [anonRole, authenticatedRole, authenticatorRole];
  
  for (const role of requiredRoles) {
    if (!content.includes(role)) {
      results.errors.push(`Missing required role: ${role}`);
    }
  }
  
  // Check role grants
  if (!content.includes(`GRANT ${anonRole} TO ${authenticatorRole}`)) {
    results.errors.push(`Missing role grant: ${anonRole} TO ${authenticatorRole}`);
  }
  
  if (!content.includes(`GRANT ${authenticatedRole} TO ${authenticatorRole}`)) {
    results.errors.push(`Missing role grant: ${authenticatedRole} TO ${authenticatorRole}`);
  }
}

/**
 * Validate RLS policies
 */
async function validateRLS(content: string, results: any) {
  // Check if RLS is enabled
  if (!content.includes('ENABLE ROW LEVEL SECURITY')) {
    results.warnings.push('No RLS policies found - consider enabling RLS for security');
    return;
  }
  
  // Check for basic policy patterns
  const hasSelectPolicy = content.includes('FOR SELECT');
  const hasInsertPolicy = content.includes('FOR INSERT');
  const hasUpdatePolicy = content.includes('FOR UPDATE');
  const hasDeletePolicy = content.includes('FOR DELETE');
  
  if (!hasSelectPolicy) {
    results.warnings.push('No SELECT policies found');
  }
  
  if (!hasInsertPolicy) {
    results.warnings.push('No INSERT policies found');
  }
  
  if (!hasUpdatePolicy) {
    results.warnings.push('No UPDATE policies found');
  }
  
  if (!hasDeletePolicy) {
    results.warnings.push('No DELETE policies found');
  }
  
  // Check for secure default policies using configured role
  const postgrestConfig = await getPostgRESTConfig();
  const anonRole = postgrestConfig.anonRole;
  
  if (content.includes('USING (true)') && content.includes(`TO ${anonRole}`)) {
    results.warnings.push('Found permissive policy for anonymous role - review security implications');
  }
}

/**
 * Validate permissions
 */
function validatePermissions(content: string, results: any) {
  // Check schema grants
  if (!content.includes('GRANT USAGE ON SCHEMA')) {
    results.errors.push('Missing schema usage grants');
  }
  
  // Check table permissions
  if (!content.includes('GRANT SELECT ON ALL TABLES')) {
    results.warnings.push('Missing table permissions');
  }
  
  // Check default privileges
  if (!content.includes('ALTER DEFAULT PRIVILEGES')) {
    results.warnings.push('Missing default privileges - future objects may not have correct permissions');
  }
}

/**
 * Display validation results
 */
function displayValidationResults(results: any) {
  if (results.errors.length > 0) {
    logger.error(chalk.red('❌ Validation Errors:'));
    results.errors.forEach((error: string) => {
      logger.error(`  • ${error}`);
    });
    logger.newLine();
  }
  
  if (results.warnings.length > 0) {
    logger.warn(chalk.yellow('⚠️  Validation Warnings:'));
    results.warnings.forEach((warning: string) => {
      logger.warn(`  • ${warning}`);
    });
    logger.newLine();
  }
  
  if (results.info.length > 0) {
    logger.info(chalk.blue('ℹ️  Information:'));
    results.info.forEach((info: string) => {
      logger.info(`  • ${info}`);
    });
    logger.newLine();
  }
  
  if (results.errors.length === 0) {
    if (results.warnings.length === 0) {
      logger.success('✅ Schema validation passed!');
    } else {
      logger.success('✅ Schema validation passed with warnings');
    }
  } else {
    logger.error('❌ Schema validation failed');
  }
}

/**
 * Validate individual table folder
 */
async function validateTableFolder(projectPath: string, tableName: string, results: any, options: any) {
  logger.info(`🔍 Validating table: ${chalk.green(tableName)}`);
  
  // Check required table.sql file
  const tableFile = getTableSQLFilePath(projectPath, tableName, SQL_FILE_TYPES.TABLE);
  if (!await fs.exists(tableFile)) {
    results.errors.push(`Missing required table.sql file for ${tableName}`);
    return;
  }
  
  // Read and validate table SQL
  const tableContent = await fs.readFile(tableFile);
  
  // Check for CREATE TABLE statement
  if (!tableContent.includes('CREATE TABLE')) {
    results.errors.push(`No CREATE TABLE statement found in ${tableName}/table.sql`);
  }
  
  // Check for RLS if enabled
  if (options.checkRls) {
    const rlsFile = getTableSQLFilePath(projectPath, tableName, SQL_FILE_TYPES.RLS);
    if (await fs.exists(rlsFile)) {
      const rlsContent = await fs.readFile(rlsFile);
      validateTableRLS(tableName, rlsContent, results);
    } else {
      results.warnings.push(`No RLS policies found for ${tableName} - consider adding security policies`);
    }
  }
  
  // Check for indexes
  const indexFile = getTableSQLFilePath(projectPath, tableName, SQL_FILE_TYPES.INDEXES);
  if (await fs.exists(indexFile)) {
    const indexContent = await fs.readFile(indexFile);
    validateTableIndexes(tableName, indexContent, results);
  } else {
    results.info.push(`No indexes defined for ${tableName}`);
  }
  
  // Check optional files
  const triggerFile = getTableSQLFilePath(projectPath, tableName, SQL_FILE_TYPES.TRIGGERS);
  if (await fs.exists(triggerFile)) {
    results.info.push(`Triggers configured for ${tableName}`);
  }
  
  const viewFile = getTableSQLFilePath(projectPath, tableName, SQL_FILE_TYPES.VIEWS);
  if (await fs.exists(viewFile)) {
    results.info.push(`Views configured for ${tableName}`);
  }
}

/**
 * Validate project structure
 */
async function validateProjectStructure(projectPath: string, results: any, options: any) {
  logger.info('🔍 Validating project structure');
  
  // Check for schema setup
  const setupFile = getTableSQLFilePath(projectPath, '_schema_setup', SQL_FILE_TYPES.TABLE);
  const altSetupFile = getTableSQLFilePath(projectPath, '_setup', SQL_FILE_TYPES.TABLE);
  
  if (await fs.exists(setupFile) || await fs.exists(altSetupFile)) {
    const setupContent = await fs.readFile(await fs.exists(setupFile) ? setupFile : altSetupFile);
    
    if (options.checkRoles) {
      await validateRoles(setupContent, results);
    }
    validateExtensions(setupContent, results);
    
    if (options.checkPermissions) {
      validatePermissions(setupContent, results);
    }
  } else {
    results.errors.push('Missing schema setup file (_schema_setup/table.sql or _setup/table.sql)');
  }
  
  // Check for functions directory
  const functionsDir = `${projectPath}/sql/functions`;
  if (await fs.exists(functionsDir)) {
    results.info.push('Functions directory found');
  } else {
    results.info.push('No functions directory found');
  }
}

/**
 * Validate table-specific RLS policies
 */
function validateTableRLS(tableName: string, content: string, results: any) {
  // Check if RLS is enabled
  if (!content.includes('ENABLE ROW LEVEL SECURITY')) {
    results.warnings.push(`RLS not enabled for ${tableName}`);
    return;
  }
  
  // Check for basic policy patterns
  const hasSelectPolicy = content.includes('FOR SELECT');
  const hasInsertPolicy = content.includes('FOR INSERT');
  
  if (!hasSelectPolicy) {
    results.warnings.push(`No SELECT policy found for ${tableName}`);
  }
  
  if (!hasInsertPolicy) {
    results.warnings.push(`No INSERT policy found for ${tableName}`);
  }
  
  results.info.push(`RLS policies configured for ${tableName}`);
}

/**
 * Validate table indexes
 */
function validateTableIndexes(tableName: string, content: string, results: any) {
  const indexCount = (content.match(/CREATE INDEX/g) || []).length;
  
  if (indexCount === 0) {
    results.info.push(`No indexes defined for ${tableName}`);
  } else {
    results.info.push(`${indexCount} index(es) defined for ${tableName}`);
  }
  
  // Check for common timestamp indexes
  if (!content.includes('created_at') && !content.includes('updated_at')) {
    results.warnings.push(`Consider adding timestamp indexes for ${tableName}`);
  }
}