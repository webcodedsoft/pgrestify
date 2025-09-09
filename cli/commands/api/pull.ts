/**
 * @fileoverview Pull existing database schema into PGRestify folder structure
 * 
 * Extracts existing database objects (tables, policies, indexes, views, functions)
 * and organizes them into the standard PGRestify table-folder structure for 
 * existing databases.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../../utils/logger.js';
import { fs } from '../../utils/fs.js';
import { parsePostgreSQLTextArray, parsePostgreSQLArray } from '../../utils/postgres-array-parser.js';
import { SchemaInspector, DatabaseConnection } from '../../generators/SchemaInspector.js';
import { extractDatabaseConnection } from '../../utils/database-connection.js';
import { writeTableSQL, SQL_FILE_TYPES } from '../../utils/sql-structure.js';
import { 
  detectDatabaseCapabilities, 
  fetchViews, 
  fetchFunctions, 
  fetchRLSPolicies,
  validateIdentifier 
} from '../../utils/database-queries.js';
import { getPostgRESTConfig } from '../../utils/postgrest-config.js';

/**
 * Create pull command
 */
export function createPullCommand(): Command {
  const command = new Command('pull');
  
  command
    .description('Pull database objects (policies, indexes, triggers, views, functions) into organized table-folder structure')
    .option('--tables <tables>', 'Comma-separated list of tables to organize (default: all)')
    .option('--schema <schema>', 'Database schema to pull from (default: from postgrest.conf db-schemas)')
    .option('--output <path>', 'Output directory', './sql/schemas')
    .option('--dry-run', 'Preview what would be pulled without creating files')
    .option('--force', 'Overwrite existing files without confirmation')
    .action(async (options) => {
      await pullDatabaseSchema(options);
    });
  
  return command;
}

/**
 * Pull database schema into organized structure
 */
async function pullDatabaseSchema(options: any) {
  logger.info(chalk.cyan('📥 PGRestify Database Schema Pull'));
  logger.info('Extract existing database objects into organized table-folder structure');
  logger.newLine();
  
  // Get database connection
  const connection = await extractDatabaseConnection();
  if (!connection) {
    logger.error('❌ No database connection found. Ensure postgrest.conf, docker-compose.yml, or .env exists');
    return;
  }
  
  // Use schema from connection config if not provided as option
  if (!options.schema) {
    options.schema = connection.schema;
  }
  
  logger.info(`ℹ Using schema: ${options.schema}`);
  
  // Analyze database schema
  const schemaInspector = new SchemaInspector(process.cwd());
  const analysis = await analyzeExistingDatabase(schemaInspector, connection, options);
  
  if (!analysis) {
    logger.error('❌ Failed to analyze database schema');
    return;
  }
  
  // Show what will be pulled
  await showPullPreview(analysis, options);
  
  // Confirm before proceeding (unless dry-run or force)
  if (!options.dryRun && !options.force) {
    const confirm = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'Proceed with pulling database objects?',
      default: true
    }]);
    
    if (!confirm.proceed) {
      logger.info(chalk.blue('Pull operation cancelled'));
      return;
    }
  }
  
  // Pull the schema
  if (!options.dryRun) {
    await extractSchemaObjects(analysis, connection, options);
    logger.success('✅ Database schema pulled successfully!');
    
    // Generate roles after successful pull
    await generateAndPromptRolesForPull(connection, options);
    
    await showPostPullInstructions(analysis);
  } else {
    logger.info(chalk.yellow('👀 Dry run completed - no files were created'));
  }
}

/**
 * Analyze existing database to determine what can be pulled
 */
async function analyzeExistingDatabase(schemaInspector: SchemaInspector, connection: DatabaseConnection, options: any) {
  logger.info(chalk.blue('🔍 Analyzing existing database schema...'));
  
  try {
    const { Pool } = await import('pg');
    const pool = new Pool(connection);
    
    const analysis: any = {
      connection,
      tables: new Map(),
      views: [],
      functions: [],
      totalObjects: 0,
      databaseInfo: null
    };
    
    // Detect database capabilities first
    logger.info('🔍 Detecting database capabilities...');
    analysis.databaseInfo = await detectDatabaseCapabilities(pool);
    logger.debug(`Database: ${analysis.databaseInfo.version}`);
    
    // Validate schema name
    if (!validateIdentifier(options.schema)) {
      throw new Error(`Invalid schema name: ${options.schema}`);
    }
    
    const targetTables = options.tables ? options.tables.split(',').map((t: string) => t.trim()) : null;
    
    // Get all tables in the schema
    const tablesResult = await pool.query(`
      SELECT 
        t.table_name,
        t.table_type,
        obj_description(pgc.oid) as table_comment
      FROM information_schema.tables t
      LEFT JOIN pg_class pgc ON pgc.relname = t.table_name
      WHERE t.table_schema = $1 
        AND t.table_type = 'BASE TABLE'
        ${targetTables ? `AND t.table_name = ANY($2)` : ''}
      ORDER BY t.table_name
    `, targetTables ? [options.schema, targetTables] : [options.schema]);
    
    logger.info(`Found ${tablesResult.rows.length} tables in schema '${options.schema}'`);
    
    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;
      const tableInfo: any = {
        name: tableName,
        comment: tableRow.table_comment,
        columns: [],
        policies: [],
        indexes: [],
        triggers: [],
        constraints: [],
        functions: []
      };
      
      // Get RLS policies using robust method
      tableInfo.policies = await fetchRLSPolicies(pool, options.schema, tableName);
      
      // Check if RLS is enabled
      const rlsResult = await pool.query(`
        SELECT relrowsecurity as rls_enabled
        FROM pg_class 
        WHERE relname = $1 AND relnamespace = (
          SELECT oid FROM pg_namespace WHERE nspname = $2
        )
      `, [tableName, options.schema]);
      
      tableInfo.rlsEnabled = rlsResult.rows[0]?.rls_enabled || false;
      
      // Get indexes
      const indexesResult = await pool.query(`
        SELECT 
          i.indexname as index_name,
          i.indexdef as index_definition,
          idx.indisunique as is_unique,
          idx.indisprimary as is_primary
        FROM pg_indexes i
        LEFT JOIN pg_class pgc ON pgc.relname = i.indexname
        LEFT JOIN pg_index idx ON pgc.oid = idx.indexrelid
        WHERE i.schemaname = $1 AND i.tablename = $2
          AND NOT idx.indisprimary  -- Exclude primary key indexes
        ORDER BY i.indexname
      `, [options.schema, tableName]);
      
      tableInfo.indexes = indexesResult.rows;
      
      // Get triggers
      const triggersResult = await pool.query(`
        SELECT 
          t.trigger_name,
          t.event_manipulation,
          t.action_timing,
          t.action_statement,
          t.action_orientation
        FROM information_schema.triggers t
        WHERE t.trigger_schema = $1 AND t.event_object_table = $2
        ORDER BY t.trigger_name
      `, [options.schema, tableName]);
      
      tableInfo.triggers = triggersResult.rows;
      
      analysis.tables.set(tableName, tableInfo);
      analysis.totalObjects += 1 + tableInfo.policies.length + tableInfo.indexes.length + tableInfo.triggers.length;
    }
    
    // Get views using robust method
    analysis.views = await fetchViews(pool, options.schema, analysis.databaseInfo);
    analysis.totalObjects += analysis.views.length;
    
    // Get functions using robust method
    analysis.functions = await fetchFunctions(pool, options.schema, analysis.databaseInfo);
    analysis.totalObjects += analysis.functions.length;
    
    await pool.end();
    return analysis;
    
  } catch (error: any) {
    logger.error(`Failed to analyze database: ${error.message}`);
    
    // Provide specific guidance based on error type
    if (error.code === 'ECONNREFUSED') {
      logger.info('💡 Tip: Make sure your database is running and accessible');
    } else if (error.code === '42P01') {
      logger.info('💡 Tip: Table or view does not exist - check your schema name and permissions');
    } else if (error.code === '42501') {
      logger.info('💡 Tip: Permission denied - ensure your user has read access to system tables');
    } else if (error.code === '3D000') {
      logger.info('💡 Tip: Database does not exist - check your connection configuration');
    } else if (error.message.includes('column') && error.message.includes('does not exist')) {
      logger.info('💡 Tip: This PostgreSQL version may not support all system columns - using fallback queries');
    }
    
    logger.debug(`Debug info: Error code: ${error.code}, SQL State: ${error.sqlState}`);
    return null;
  }
}

/**
 * Show preview of what will be pulled
 */
async function showPullPreview(analysis: any, options: any) {
  logger.info(chalk.cyan('📋 Pull Preview'));
  logger.newLine();
  
  logger.info(chalk.white(`Database Objects Found:`));
  logger.info(chalk.blue(`  📊 Tables: ${analysis.tables.size}`));
  logger.info(chalk.blue(`  👁️  Views: ${analysis.views.length}`));
  logger.info(chalk.blue(`  ⚙️  Functions: ${analysis.functions.length}`));
  
  let totalPolicies = 0;
  let totalIndexes = 0;
  let totalTriggers = 0;
  
  for (const [, tableInfo] of analysis.tables) {
    totalPolicies += tableInfo.policies.length;
    totalIndexes += tableInfo.indexes.length;
    totalTriggers += tableInfo.triggers.length;
  }
  
  logger.info(chalk.blue(`  🔐 RLS Policies: ${totalPolicies}`));
  logger.info(chalk.blue(`  ⚡ Indexes: ${totalIndexes}`));
  logger.info(chalk.blue(`  🔗 Triggers: ${totalTriggers}`));
  logger.newLine();
  
  // Show table breakdown
  if (analysis.tables.size > 0) {
    logger.info(chalk.cyan('📚 Tables with database objects:'));
    for (const [tableName, tableInfo] of analysis.tables) {
      const objects = [];
      if (tableInfo.policies.length > 0) objects.push(`${tableInfo.policies.length} policies`);
      if (tableInfo.indexes.length > 0) objects.push(`${tableInfo.indexes.length} indexes`);
      if (tableInfo.triggers.length > 0) objects.push(`${tableInfo.triggers.length} triggers`);
      
      if (objects.length > 0) {
        logger.info(chalk.white(`  📋 ${tableName}`) + chalk.gray(` (${objects.join(', ')})`));
      }
    }
    logger.newLine();
  }
  
  // Show output structure
  logger.info(chalk.cyan('📁 Output Structure:'));
  logger.info(chalk.gray('  sql/schemas/'));
  
  // Show sample table folders with actual objects
  let samplesShown = 0;
  for (const [tableName, tableInfo] of analysis.tables) {
    const hasObjects = tableInfo.policies.length > 0 || tableInfo.indexes.length > 0 || tableInfo.triggers.length > 0;
    if (hasObjects && samplesShown < 2) {
      logger.info(chalk.gray(`    ${tableName}/`));
      if (tableInfo.policies.length > 0) logger.info(chalk.gray(`      rls.sql        # RLS policies (${tableInfo.policies.length})`));
      if (tableInfo.indexes.length > 0) logger.info(chalk.gray(`      indexes.sql    # Performance indexes (${tableInfo.indexes.length})`));
      if (tableInfo.triggers.length > 0) logger.info(chalk.gray(`      triggers.sql   # Database triggers (${tableInfo.triggers.length})`));
      samplesShown++;
    }
  }
  
  if (analysis.views.length > 0) {
    logger.info(chalk.gray(`    views.sql      # Database views (${analysis.views.length})`));
  }
  
  if (analysis.functions.length > 0) {
    logger.info(chalk.gray(`    functions.sql  # PostgreSQL functions (${analysis.functions.length})`));
  }
  logger.newLine();
}

/**
 * Extract schema objects and write to files
 */
async function extractSchemaObjects(analysis: any, connection: DatabaseConnection, options: any) {
  logger.info(chalk.blue('📤 Extracting database objects...'));
  
  const outputPath = options.output || './sql/schemas';
  await fs.ensureDir(outputPath);
  
  // Organize views and functions by table
  const viewsByTable = new Map();
  const functionsByTable = new Map();
  const schemaWideViews = [];
  const schemaWideFunctions = [];
  
  // Get table names for analysis
  const tableNames: string[] = Array.from(analysis.tables.keys());
  
  // Parse and organize views by analyzing their dependencies
  analysis.views.forEach(view => {
    let dependentTables = [];
    
    // Use database-provided dependencies if available
    if (view.dependent_tables && Array.isArray(view.dependent_tables) && view.dependent_tables.length > 0) {
      dependentTables = view.dependent_tables;
    } else {
      // Fallback to text analysis
      dependentTables = findTableDependencies(view.view_definition, tableNames, options.schema);
    }
    
    if (dependentTables.length === 1) {
      // Single table dependency - belongs to that table
      const tableName = dependentTables[0];
      if (analysis.tables.has(tableName)) {
        if (!viewsByTable.has(tableName)) viewsByTable.set(tableName, []);
        viewsByTable.get(tableName).push(view);
      } else {
        schemaWideViews.push(view);
      }
    } else {
      // Multiple or no table dependencies - schema-wide
      schemaWideViews.push(view);
    }
  });
  
  // Parse and organize functions by analyzing their dependencies
  analysis.functions.forEach(func => {
    let dependentTables = [];
    
    // Use database-provided dependencies if available
    if (func.dependent_tables && Array.isArray(func.dependent_tables) && func.dependent_tables.length > 0) {
      dependentTables = func.dependent_tables;
    } else {
      // Fallback to text analysis
      const functionText = func.full_definition || func.function_body || '';
      dependentTables = findTableDependencies(functionText, tableNames, options.schema);
    }
    
    if (dependentTables.length === 1) {
      // Single table dependency - belongs to that table
      const tableName = dependentTables[0];
      if (analysis.tables.has(tableName)) {
        if (!functionsByTable.has(tableName)) functionsByTable.set(tableName, []);
        functionsByTable.get(tableName).push(func);
      } else {
        schemaWideFunctions.push(func);
      }
    } else {
      // Multiple or no table dependencies - schema-wide
      schemaWideFunctions.push(func);
    }
  });
  
  // Process each table
  for (const [tableName, tableInfo] of analysis.tables) {
    logger.info(chalk.white(`📋 Processing table: ${tableName}`));
    
    const tableViews = viewsByTable.get(tableName) || [];
    const tableFunctions = functionsByTable.get(tableName) || [];
    
    await extractTableToFolder(tableName, tableInfo, outputPath, options, tableViews, tableFunctions);
  }
  
  // Extract schema-wide views and functions (only truly schema-wide ones)
  if (schemaWideViews.length > 0) {
    logger.info(chalk.white(`📋 Processing schema-wide views (${schemaWideViews.length} views)`));
    await extractViews(schemaWideViews, outputPath, options);
  }
  
  if (schemaWideFunctions.length > 0) {
    logger.info(chalk.white(`📋 Processing schema-wide functions (${schemaWideFunctions.length} functions)`));
    await extractFunctions(schemaWideFunctions, outputPath, options);
  }
}

/**
 * Find table dependencies in SQL text by analyzing FROM and JOIN clauses
 */
function findTableDependencies(sqlText: string, availableTables: string[], schema: string): string[] {
  if (!sqlText) return [];
  
  // Convert to lowercase for matching but preserve original table names
  const lowerSql = sqlText.toLowerCase();
  const foundTables = new Set<string>();
  
  // Look for table references in FROM and JOIN clauses
  availableTables.forEach(tableName => {
    const lowerTableName = tableName.toLowerCase();
    
    // Match patterns like:
    // FROM table_name
    // JOIN table_name  
    // FROM schema.table_name
    // JOIN schema.table_name
    const patterns = [
      new RegExp(`\\bfrom\\s+(?:${schema}\\.)?${lowerTableName}\\b`, 'i'),
      new RegExp(`\\bjoin\\s+(?:${schema}\\.)?${lowerTableName}\\b`, 'i'),
      new RegExp(`\\binto\\s+(?:${schema}\\.)?${lowerTableName}\\b`, 'i'),
      new RegExp(`\\bupdate\\s+(?:${schema}\\.)?${lowerTableName}\\b`, 'i'),
      new RegExp(`\\bdelete\\s+from\\s+(?:${schema}\\.)?${lowerTableName}\\b`, 'i')
    ];
    
    if (patterns.some(pattern => pattern.test(lowerSql))) {
      foundTables.add(tableName);
    }
  });
  
  return Array.from(foundTables);
}

/**
 * Extract table objects to organized table folder
 */
async function extractTableToFolder(tableName: string, tableInfo: any, outputPath: string, options: any, tableViews: any[] = [], tableFunctions: any[] = []) {
  const tablePath = `${outputPath}/${tableName}`;
  let hasObjects = false;
  
  // Extract RLS policies
  if (tableInfo.policies.length > 0 || tableInfo.rlsEnabled) {
    await fs.ensureDir(tablePath); // Create folder only when needed
    const rlsSQL = await generateRLSSQL(tableName, tableInfo);
    const rlsFilePath = `${tablePath}/rls.sql`;
    await fs.writeFile(rlsFilePath, rlsSQL);
    logger.info(chalk.green(`  ✅ RLS policies → ${tableName}/rls.sql (${tableInfo.policies.length} policies)`));
    hasObjects = true;
  }
  
  // Extract indexes
  if (tableInfo.indexes.length > 0) {
    await fs.ensureDir(tablePath); // Create folder only when needed
    const indexesSQL = generateIndexesSQL(tableName, tableInfo);
    const indexesFilePath = `${tablePath}/indexes.sql`;
    await fs.writeFile(indexesFilePath, indexesSQL);
    logger.info(chalk.green(`  ✅ Indexes → ${tableName}/indexes.sql (${tableInfo.indexes.length} indexes)`));
    hasObjects = true;
  }
  
  // Extract triggers
  if (tableInfo.triggers.length > 0) {
    await fs.ensureDir(tablePath); // Create folder only when needed
    const triggersSQL = await generateTriggersSQL(tableName, tableInfo);
    const triggersFilePath = `${tablePath}/triggers.sql`;
    await fs.writeFile(triggersFilePath, triggersSQL);
    logger.info(chalk.green(`  ✅ Triggers → ${tableName}/triggers.sql (${tableInfo.triggers.length} triggers)`));
    hasObjects = true;
  }
  
  // Extract table-specific views
  if (tableViews.length > 0) {
    await fs.ensureDir(tablePath); // Create folder only when needed
    const viewsSQL = await generateTableViewsSQL(tableViews, options);
    const viewsFilePath = `${tablePath}/views.sql`;
    await fs.writeFile(viewsFilePath, viewsSQL);
    logger.info(chalk.green(`  ✅ Views → ${tableName}/views.sql (${tableViews.length} views)`));
    hasObjects = true;
  }
  
  // Extract table-specific functions
  if (tableFunctions.length > 0) {
    await fs.ensureDir(tablePath); // Create folder only when needed
    const functionsSQL = await generateTableFunctionsSQL(tableFunctions, options);
    const functionsFilePath = `${tablePath}/functions.sql`;
    await fs.writeFile(functionsFilePath, functionsSQL);
    logger.info(chalk.green(`  ✅ Functions → ${tableName}/functions.sql (${tableFunctions.length} functions)`));
    hasObjects = true;
  }
  
  // Only create folder structure if we actually have objects to organize
  if (!hasObjects) {
    logger.info(chalk.gray(`  ⏭️  Skipped ${tableName} (no database objects to organize)`));
  }
}


/**
 * Generate RLS policies SQL
 */
async function generateRLSSQL(tableName: string, tableInfo: any): Promise<string> {
  const postgrestConfig = await getPostgRESTConfig();
  const schema = postgrestConfig.dbSchemas;
  
  let sql = `-- RLS Policies for: ${tableName}\n`;
  sql += `-- Pulled from existing database\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;
  
  // Enable RLS if it was enabled
  if (tableInfo.rlsEnabled) {
    sql += `-- Enable Row Level Security\n`;
    sql += `ALTER TABLE ${schema}.${tableName} ENABLE ROW LEVEL SECURITY;\n\n`;
  }
  
  // Add existing policies
  tableInfo.policies.forEach((policy: any) => {
    sql += `-- Policy: ${policy.policy_name}\n`;
    sql += `CREATE POLICY ${policy.policy_name}\n`;
    sql += `  ON ${schema}.${tableName}\n`;
    
    if (policy.permissive === 'PERMISSIVE') {
      sql += `  AS PERMISSIVE\n`;
    } else {
      sql += `  AS RESTRICTIVE\n`;
    }
    
    sql += `  FOR ${policy.command}\n`;
    
    if (policy.roles) {
      // Parse PostgreSQL array format for roles (handles quoted role names)
      const rolesArray = parsePostgreSQLTextArray(policy.roles);
      
      if (rolesArray.length > 0) {
        const roles = rolesArray.map((role: string) => `"${role}"`).join(', ');
        sql += `  TO ${roles}\n`;
      }
    }
    
    if (policy.using_expression) {
      sql += `  USING (${policy.using_expression})\n`;
    }
    
    if (policy.with_check_expression) {
      sql += `  WITH CHECK (${policy.with_check_expression})\n`;
    }
    
    sql += ';\n\n';
  });
  
  return sql;
}

/**
 * Generate indexes SQL
 */
function generateIndexesSQL(tableName: string, tableInfo: any): string {
  let sql = `-- Performance Indexes for: ${tableName}\n`;
  sql += `-- Pulled from existing database\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;
  
  tableInfo.indexes.forEach((index: any) => {
    sql += `-- Index: ${index.index_name}\n`;
    sql += `${index.index_definition};\n\n`;
  });
  
  return sql;
}

/**
 * Generate triggers SQL
 */
async function generateTriggersSQL(tableName: string, tableInfo: any): Promise<string> {
  const postgrestConfig = await getPostgRESTConfig();
  const schema = postgrestConfig.dbSchemas;
  
  let sql = `-- Database Triggers for: ${tableName}\n`;
  sql += `-- Pulled from existing database\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;
  
  tableInfo.triggers.forEach((trigger: any) => {
    sql += `-- Trigger: ${trigger.trigger_name}\n`;
    sql += `CREATE TRIGGER ${trigger.trigger_name}\n`;
    sql += `  ${trigger.action_timing} ${trigger.event_manipulation}\n`;
    sql += `  ON ${schema}.${tableName}\n`;
    sql += `  FOR EACH ${trigger.action_orientation}\n`;
    sql += `  ${trigger.action_statement};\n\n`;
  });
  
  return sql;
}

/**
 * Generate views SQL for a specific table
 */
async function generateTableViewsSQL(views: any[], options: any): Promise<string> {
  const postgrestConfig = await getPostgRESTConfig();
  const schema = postgrestConfig.dbSchemas;
  
  let sql = `-- Table-specific Views\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;
  
  views.forEach((view: any) => {
    sql += `-- View: ${view.view_name}\n`;
    if (view.view_comment) {
      sql += `-- ${view.view_comment}\n`;
    }
    sql += `CREATE OR REPLACE VIEW ${schema}.${view.view_name} AS\n`;
    sql += `${view.view_definition};\n\n`;
    
    if (view.view_comment) {
      sql += `COMMENT ON VIEW ${schema}.${view.view_name} IS '${view.view_comment}';\n\n`;
    }
  });
  
  return sql;
}

/**
 * Generate functions SQL for a specific table
 */
async function generateTableFunctionsSQL(functions: any[], options: any): Promise<string> {
  const config = await getPostgRESTConfig();
  const schema = config.schema;
  
  let sql = `-- Table-specific Functions\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;
  
  functions.forEach((func: any) => {
    sql += `-- Function: ${func.function_name}\n`;
    if (func.function_comment) {
      sql += `-- ${func.function_comment}\n`;
    }
    sql += `-- Type: ${func.routine_type}\n`;
    if (func.return_type) {
      sql += `-- Return type: ${func.return_type}\n`;
      sql += `-- Security: ${func.security_type}\n\n`;
    }
    
    if (func.full_definition) {
      sql += `${func.full_definition};\n\n`;
    } else {
      sql += `-- Function definition not available\n\n`;
    }
  });
  
  return sql;
}

/**
 * Extract schema-wide views to views.sql
 */
async function extractViews(views: any[], outputPath: string, options: any) {
  if (views.length === 0) return;
  
  const config = await getPostgRESTConfig();
  const schema = config.schema;
  
  let sql = `-- Database Views\n`;
  sql += `-- Pulled from existing database\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;
  
  views.forEach((view: any) => {
    sql += `-- View: ${view.view_name}\n`;
    if (view.view_comment) {
      sql += `-- ${view.view_comment}\n`;
    }
    sql += `CREATE OR REPLACE VIEW ${schema}.${view.view_name} AS\n`;
    sql += `${view.view_definition};\n\n`;
    
    if (view.view_comment) {
      sql += `COMMENT ON VIEW ${schema}.${view.view_name} IS '${view.view_comment}';\n\n`;
    }
  });
  
  const viewsPath = `${outputPath}/views.sql`;
  await fs.writeFile(viewsPath, sql);
  logger.info(chalk.green(`  ✅ Views → schemas/views.sql (${views.length} views)`));
}

/**
 * Extract schema-wide functions to functions.sql
 */
async function extractFunctions(functions: any[], outputPath: string, options: any) {
  if (functions.length === 0) return;
  
  let sql = `-- Database Functions\n`;
  sql += `-- Pulled from existing database\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;
  
  functions.forEach((func: any) => {
    sql += `-- Function: ${func.function_name}\n`;
    if (func.function_comment) {
      sql += `-- ${func.function_comment}\n`;
    }
    
    if (func.full_definition) {
      sql += `${func.full_definition};\n\n`;
    } else {
      // Fallback if full definition is not available
      sql += `-- NOTE: Full function definition not available\n`;
      sql += `-- Manual recreation required for: ${func.function_name}\n`;
      sql += `-- Return type: ${func.return_type}\n`;
      sql += `-- Security: ${func.security_type}\n\n`;
    }
  });
  
  const functionsPath = `${outputPath}/functions.sql`;
  await fs.writeFile(functionsPath, sql);
  logger.info(chalk.green(`  ✅ Functions → schemas/functions.sql (${functions.length} functions)`));
}

/**
 * Generate roles and prompt for execution after pull
 */
async function generateAndPromptRolesForPull(connection: DatabaseConnection, options: any) {
  try {
    logger.newLine();
    logger.info(chalk.cyan('🔑 Generating Database Roles'));
    
    // Generate roles file
    const { RoleGenerator } = await import('../../generators/RoleGenerator.js');
    const generator = new RoleGenerator(process.cwd());
    const rolesSQL = await generator.generateRoleSetup();
    
    // Write to sql/roles.sql
    const rolesPath = './sql/roles.sql';
    await fs.writeFile(rolesPath, rolesSQL);
    
    logger.success('✅ Generated sql/roles.sql');
    
    // Get role configuration for display
    const roleConfig = await generator.getRoleConfig();
    
    logger.info(chalk.yellow('📋 Roles to be created:'));
    logger.list([
      `${chalk.green(roleConfig.anonRole)} - Anonymous users (read-only)`,
      `${chalk.green(roleConfig.authenticatedRole)} - Authenticated users (CRUD)`,
      `${chalk.green(roleConfig.adminRole)} - Admin users (full access)`,
      `Target schema: ${chalk.green(roleConfig.schema)}`
    ]);
    
    // Prompt for execution
    const { executeRoles } = await inquirer.prompt([{
      type: 'confirm',
      name: 'executeRoles',
      message: 'Execute roles setup now?',
      default: true
    }]);
    
    if (executeRoles) {
      await executeRoleSetupForPull(connection, rolesSQL);
    } else {
      displayRoleSetupInstructionsForPull(roleConfig);
    }
    
  } catch (error: any) {
    logger.warn(`⚠️  Could not generate roles: ${error.message}`);
  }
}

/**
 * Execute role setup for pull command
 */
async function executeRoleSetupForPull(connection: DatabaseConnection, rolesSQL: string) {
  try {
    logger.info(chalk.blue('⚡ Executing role setup...'));
    
    const { DatabaseManager } = await import('../../utils/database.js');
    const dbManager = new DatabaseManager(process.cwd());
    
    await dbManager.executeSQL(rolesSQL, connection);
    logger.success('✅ Database roles setup completed successfully!');
    logger.info('🔒 Your PostgREST API now has proper role-based access control.');
    
  } catch (error: any) {
    logger.error(`❌ Failed to execute role setup: ${error.message}`);
    displayRoleSetupInstructionsForPull(null);
  }
}

/**
 * Display manual role setup instructions for pull command
 */
function displayRoleSetupInstructionsForPull(roleConfig: any) {
  logger.newLine();
  logger.info(chalk.cyan('📖 Manual Role Setup Instructions:'));
  
  logger.list([
    'Execute the roles SQL manually:',
    `  ${chalk.green('psql -d your_database -f sql/roles.sql')}`,
    'Or run: pgrestify api setup roles --execute',
    'Then restart PostgREST to apply role changes'
  ]);
  
  if (roleConfig) {
    logger.newLine();
    logger.info(chalk.yellow('💡 Why roles are important:'));
    logger.list([
      'Roles control who can access what data via your API',
      'Without proper roles, you may get "permission denied" errors',
      'Roles work with RLS policies to provide secure data access'
    ]);
  }
}

/**
 * Show post-pull instructions
 */
async function showPostPullInstructions(analysis: any) {
  logger.newLine();
  logger.info(chalk.cyan('🎉 Database schema successfully pulled!'));
  logger.newLine();
  
  logger.info(chalk.white('📋 Next steps:'));
  logger.info(chalk.blue('  1. Review organized database objects in sql/schemas/'));
  logger.info(chalk.blue('  2. Modify policies, indexes, or triggers as needed'));
  logger.info(chalk.blue('  3. Use `pgrestify api generate policy <table>` to add new policies'));
  logger.info(chalk.blue('  4. Use `pgrestify api apply` to apply changes back to database'));
  logger.newLine();
  
  logger.info(chalk.white('🔧 Available commands:'));
  logger.info(chalk.gray('  pgrestify api generate policy users --pattern user_specific  # Add new RLS policies'));
  logger.info(chalk.gray('  pgrestify api features indexes suggest --performance-only   # Optimize performance'));
  logger.info(chalk.gray('  pgrestify api apply --dry-run                              # Preview changes'));
  logger.newLine();
  
  if (analysis.tables.size > 0) {
    logger.info(chalk.green(`✅ Successfully pulled ${analysis.tables.size} tables with organized structure`));
    logger.info(chalk.yellow('💡 Your tables remain unchanged - only database objects were organized'));
  }
}