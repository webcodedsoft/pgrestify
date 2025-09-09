/**
 * @fileoverview PostgreSQL views for PostgREST
 * 
 * Generates database views optimized for PostgREST APIs with
 * proper permissions, security, and common patterns.
 * Enhanced with intelligent database analysis and dynamic generation.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../../../utils/logger.js';
import { fs } from '../../../utils/fs.js';
import { ViewGenerator, ViewAnalysis, ViewConfig } from '../../../generators/ViewGenerator.js';
import { SchemaInspector } from '../../../generators/SchemaInspector.js';
import { DatabaseManager } from '../../../utils/database.js';
import { writeTableSQL, SQL_FILE_TYPES, appendWithTimestamp, getCommandString } from '../../../utils/sql-structure.js';
import { getPostgRESTConfig } from '../../../utils/postgrest-config.js';

/**
 * View templates for common patterns
 */
const VIEW_TEMPLATES = {
  aggregated: {
    name: 'Aggregated Data View',
    description: 'Aggregate data with counts, sums, averages',
    template: 'aggregated'
  },
  joined: {
    name: 'Multi-table Join View',
    description: 'Join multiple tables for complex queries',
    template: 'joined'
  },
  filtered: {
    name: 'Pre-filtered Data View',
    description: 'Pre-filter data based on conditions',
    template: 'filtered'
  },
  computed: {
    name: 'Computed Columns View',
    description: 'Add computed/calculated columns',
    template: 'computed'
  },
  security: {
    name: 'Security Layer View',
    description: 'Hide sensitive columns, apply security logic',
    template: 'security'
  }
};

/**
 * Create views command
 */
export function createViewsCommand(): Command {
  const command = new Command('views');
  
  command
    .description('Generate PostgreSQL views for PostgREST (Enhanced with intelligent analysis)')
    .addCommand(createGenerateViewCommand())
    .addCommand(createSuggestViewsCommand())
    .addCommand(createAnalyzeSchemaCommand())
    .addCommand(createListViewsCommand());
  
  return command;
}

/**
 * Create generate view command
 */
function createGenerateViewCommand(): Command {
  const command = new Command('generate');
  
  command
    .description('Generate a PostgreSQL view (with intelligent analysis)')
    .argument('<name>', 'View name')
    .option('--schema <name>', 'Schema name')
    .option('--template <type>', 'View template')
    .option('--dynamic', 'Use dynamic analysis from database')
    .option('--base-table <table>', 'Base table for view (determines table folder)')
    .option('--materialized', 'Create materialized view')
    .action(async (viewName, options) => {
      await generateView(viewName, options);
    });
  
  return command;
}

/**
 * Generate a PostgreSQL view (Enhanced with dynamic analysis)
 */
async function generateView(viewName: string, options: any) {
  logger.info(chalk.cyan(`👁️  Generating View: ${viewName}`));
  logger.newLine();
  
  let sql: string;
  let baseTable: string;
  
  if (options.dynamic) {
    // Use dynamic generator with database analysis
    const dynamicConfig = await generateDynamicViewConfig(viewName, options);
    sql = await generateDynamicView(viewName, options);
    baseTable = dynamicConfig.baseTable || extractBaseTableFromSQL(sql);
  } else {
    // Use template-based generation
    const config = await collectViewConfig(viewName, options);
    sql = await generateViewSQL(config);
    baseTable = (config as any).sourceTable || (config as any).baseTable || extractBaseTableFromSQL(sql);
  }
  
  // Determine which table this view belongs to
  if (!baseTable) {
    logger.warn(chalk.yellow('⚠️  Could not determine base table for view. Please specify with --base-table option.'));
    const { tableName } = await inquirer.prompt([{
      type: 'input',
      name: 'tableName',
      message: 'Which table should this view be associated with?',
      validate: (input) => input.trim().length > 0 || 'Table name is required'
    }]);
    baseTable = tableName.trim();
  }
  
  // Use table-folder structure
  const projectPath = process.cwd();
  const command = getCommandString();
  const timestampedSQL = appendWithTimestamp(sql, command);
  
  await writeTableSQL(projectPath, baseTable, SQL_FILE_TYPES.VIEWS, timestampedSQL, true);
  
  logger.success(`✅ View generated in: sql/schemas/${baseTable}/views.sql`);
  await displayEnhancedViewUsage(viewName, { ...options, baseTable });
}

/**
 * Collect view configuration
 */
async function collectViewConfig(viewName: string, options: any) {
  let template = options.template;
  
  if (!template) {
    const { selectedTemplate } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTemplate',
        message: 'Select view template:',
        choices: Object.entries(VIEW_TEMPLATES).map(([key, tmpl]) => ({
          name: `${tmpl.name} - ${tmpl.description}`,
          value: key
        }))
      }
    ]);
    template = selectedTemplate;
  }
  
  // Get template-specific configuration
  const templateConfig = await getViewTemplateConfig(template);
  
  return {
    viewName,
    schema: options.schema,
    template,
    output: options.output,
    ...templateConfig
  };
}

/**
 * Get view template-specific configuration
 */
async function getViewTemplateConfig(template: string) {
  switch (template) {
    case 'aggregated':
      return await getAggregatedConfig();
    case 'joined':
      return await getJoinedConfig();
    case 'filtered':
      return await getFilteredConfig();
    case 'computed':
      return await getComputedConfig();
    case 'security':
      return await getSecurityConfig();
    default:
      return {};
  }
}

/**
 * Get aggregated view configuration
 */
async function getAggregatedConfig() {
  const { sourceTable, groupBy, aggregations } = await inquirer.prompt([
    {
      type: 'input',
      name: 'sourceTable',
      message: 'Source table name:',
      validate: (input) => input.trim().length > 0 || 'Table name is required'
    },
    {
      type: 'input',
      name: 'groupBy',
      message: 'Group by columns (comma-separated):',
      default: 'user_id, created_at::date',
      validate: (input) => input.trim().length > 0 || 'Group by columns are required'
    },
    {
      type: 'input',
      name: 'aggregations',
      message: 'Aggregations (e.g., COUNT(*) as total, AVG(amount) as avg_amount):',
      default: 'COUNT(*) as total_count',
      validate: (input) => input.trim().length > 0 || 'At least one aggregation is required'
    }
  ]);
  
  return { 
    sourceTable, 
    groupBy: groupBy.split(',').map(col => col.trim()), 
    aggregations 
  };
}

/**
 * Get joined view configuration
 */
async function getJoinedConfig() {
  const { tables, joinConditions } = await inquirer.prompt([
    {
      type: 'input',
      name: 'tables',
      message: 'Tables to join (comma-separated):',
      default: 'users, posts, comments',
      validate: (input) => input.trim().length > 0 || 'At least one table is required'
    },
    {
      type: 'input',
      name: 'joinConditions',
      message: 'Join conditions:',
      default: 'users.id = posts.user_id AND posts.id = comments.post_id'
    }
  ]);
  
  return { 
    tables: tables.split(',').map(t => t.trim()), 
    joinConditions 
  };
}

/**
 * Get filtered view configuration
 */
async function getFilteredConfig() {
  const { sourceTable, conditions } = await inquirer.prompt([
    {
      type: 'input',
      name: 'sourceTable',
      message: 'Source table name:',
      validate: (input) => input.trim().length > 0 || 'Table name is required'
    },
    {
      type: 'input',
      name: 'conditions',
      message: 'Filter conditions (WHERE clause):',
      default: 'active = true AND created_at > NOW() - INTERVAL \'30 days\'',
      validate: (input) => input.trim().length > 0 || 'Filter conditions are required'
    }
  ]);
  
  return { sourceTable, conditions };
}

/**
 * Get computed columns view configuration
 */
async function getComputedConfig() {
  const { sourceTable, computedColumns } = await inquirer.prompt([
    {
      type: 'input',
      name: 'sourceTable',
      message: 'Source table name:',
      validate: (input) => input.trim().length > 0 || 'Table name is required'
    },
    {
      type: 'input',
      name: 'computedColumns',
      message: 'Computed columns (e.g., first_name || \' \' || last_name as full_name):',
      default: 'EXTRACT(year FROM created_at) as year, EXTRACT(month FROM created_at) as month',
      validate: (input) => input.trim().length > 0 || 'Computed columns are required'
    }
  ]);
  
  return { sourceTable, computedColumns };
}

/**
 * Get security view configuration
 */
async function getSecurityConfig() {
  const { sourceTable, hiddenColumns, securityLogic } = await inquirer.prompt([
    {
      type: 'input',
      name: 'sourceTable',
      message: 'Source table name:',
      validate: (input) => input.trim().length > 0 || 'Table name is required'
    },
    {
      type: 'input',
      name: 'hiddenColumns',
      message: 'Columns to hide (comma-separated):',
      default: 'password_hash, email_verified_token, reset_token',
      validate: (input) => input.trim().length > 0 || 'Hidden columns are required'
    },
    {
      type: 'input',
      name: 'securityLogic',
      message: 'Additional security logic (WHERE clause):',
      default: 'deleted_at IS NULL AND banned = false'
    }
  ]);
  
  return { 
    sourceTable, 
    hiddenColumns: hiddenColumns.split(',').map(col => col.trim()), 
    securityLogic 
  };
}

/**
 * Extract base table name from SQL
 */
function extractBaseTableFromSQL(sql: string): string | null {
  // Try to extract table name from FROM clause
  const fromMatch = sql.match(/FROM\s+(?:\w+\.)?(\w+)/i);
  if (fromMatch) {
    return fromMatch[1];
  }
  
  // Try to extract from JOIN clause as fallback
  const joinMatch = sql.match(/JOIN\s+(?:\w+\.)?(\w+)/i);
  if (joinMatch) {
    return joinMatch[1];
  }
  
  return null;
}

/**
 * Generate dynamic view configuration
 */
async function generateDynamicViewConfig(viewName: string, options: any) {
  if (options.baseTable) {
    return { baseTable: options.baseTable };
  }
  
  // If using dynamic generation, we can extract from the config
  return await collectDynamicViewConfig(viewName, options.baseTable, options);
}

/**
 * Generate view SQL
 */
async function generateViewSQL(config: any): Promise<string> {
  const header = `-- View: ${config.viewName}
-- Template: ${config.template}
-- Generated: ${new Date().toISOString()}`;
  
  const viewSQL = generateViewByTemplate(config);
  const permissions = await generateViewPermissions(config);
  
  return `${header}\n\n${viewSQL}\n\n${permissions}`;
}

/**
 * Generate view SQL by template
 */
function generateViewByTemplate(config: any): string {
  switch (config.template) {
    case 'aggregated':
      return generateAggregatedView(config);
    case 'joined':
      return generateJoinedView(config);
    case 'filtered':
      return generateFilteredView(config);
    case 'computed':
      return generateComputedView(config);
    case 'security':
      return generateSecurityView(config);
    default:
      return generateBasicView(config);
  }
}

/**
 * Generate aggregated view
 */
function generateAggregatedView(config: any): string {
  const { viewName, schema, sourceTable, groupBy, aggregations } = config;
  
  return `CREATE OR REPLACE VIEW ${schema}.${viewName} AS
SELECT 
  ${groupBy.join(', ')},
  ${aggregations}
FROM ${schema}.${sourceTable}
GROUP BY ${groupBy.join(', ')}
ORDER BY ${groupBy[0]};

-- Add comment
COMMENT ON VIEW ${schema}.${viewName} IS 'Aggregated data from ${sourceTable}';`;
}

/**
 * Generate joined view
 */
function generateJoinedView(config: any): string {
  const { viewName, schema, tables, joinConditions } = config;
  const mainTable = tables[0];
  const otherTables = tables.slice(1);
  
  return `CREATE OR REPLACE VIEW ${schema}.${viewName} AS
SELECT 
  ${tables.map(table => `${table}.*`).join(', ')}
FROM ${schema}.${mainTable}
${otherTables.map(table => `  LEFT JOIN ${schema}.${table} ON ${joinConditions}`).join('\n')}
WHERE ${joinConditions || 'true'};

-- Add comment
COMMENT ON VIEW ${schema}.${viewName} IS 'Joined view combining ${tables.join(', ')}';`;
}

/**
 * Generate filtered view
 */
function generateFilteredView(config: any): string {
  const { viewName, schema, sourceTable, conditions } = config;
  
  return `CREATE OR REPLACE VIEW ${schema}.${viewName} AS
SELECT *
FROM ${schema}.${sourceTable}
WHERE ${conditions};

-- Add comment
COMMENT ON VIEW ${schema}.${viewName} IS 'Filtered view of ${sourceTable}';`;
}

/**
 * Generate computed columns view
 */
function generateComputedView(config: any): string {
  const { viewName, schema, sourceTable, computedColumns } = config;
  
  return `CREATE OR REPLACE VIEW ${schema}.${viewName} AS
SELECT 
  *,
  ${computedColumns}
FROM ${schema}.${sourceTable};

-- Add comment
COMMENT ON VIEW ${schema}.${viewName} IS 'View with computed columns for ${sourceTable}';`;
}

/**
 * Generate security layer view
 */
function generateSecurityView(config: any): string {
  const { viewName, schema, sourceTable, hiddenColumns, securityLogic } = config;
  
  // Get all columns except hidden ones
  const selectColumns = `-- Select all columns except: ${hiddenColumns.join(', ')}
  *  -- TODO: Replace with explicit column list excluding sensitive data`;
  
  return `CREATE OR REPLACE VIEW ${schema}.${viewName} AS
SELECT 
  ${selectColumns}
FROM ${schema}.${sourceTable}
WHERE ${securityLogic || 'true'};

-- Add comment
COMMENT ON VIEW ${schema}.${viewName} IS 'Security view hiding sensitive columns from ${sourceTable}';

-- Security note: Update the SELECT clause to explicitly list safe columns`;
}

/**
 * Generate basic view
 */
function generateBasicView(config: any): string {
  const { viewName, schema } = config;
  
  return `CREATE OR REPLACE VIEW ${schema}.${viewName} AS
SELECT *
FROM ${schema}.your_table
WHERE true;

-- Add comment
COMMENT ON VIEW ${schema}.${viewName} IS 'Basic view template - customize as needed';`;
}

/**
 * Generate view permissions
 */
async function generateViewPermissions(config: any): Promise<string> {
  const { viewName, schema } = config;
  const { generateGrantStatement, getPostgRESTConfig } = await import('../../../utils/postgrest-config.js');
  const postgrestConfig = await getPostgRESTConfig();
  
  return `-- Grant permissions on view
${generateGrantStatement('SELECT', `${schema}.${viewName}`, postgrestConfig, true)}

-- Optional: Grant additional permissions
-- GRANT INSERT, UPDATE, DELETE ON ${schema}.${viewName} TO authenticated;`;
}

/**
 * Generate views header
 */
function generateViewsHeader(): string {
  return `-- PostgreSQL Views for PostgREST
-- Generated by PGRestify
-- 
-- Apply these views to your database:
-- psql -d your_database -f views.sql
--
-- Views provide:
-- - Data aggregation and computed columns
-- - Security layer hiding sensitive data
-- - Complex joins for API endpoints
-- - Pre-filtered datasets for performance`;
}

/**
 * Create list views command
 */
function createListViewsCommand(): Command {
  const command = new Command('list');
  
  command
    .description('List existing views')
    .option('--schema <name>', 'Schema name')
    .action(async (options) => {
      await listViews(options);
    });
  
  return command;
}

/**
 * List existing views
 */
async function listViews(options: any) {
  logger.info(chalk.cyan('📋 Database Views'));
  logger.newLine();
  
  try {
    // Try to connect to database and execute query
    const dbManager = new DatabaseManager(process.cwd());
    const connection = await dbManager.extractConnection();
    
    if (!connection) {
      logger.warn('❌ No database connection found in configuration files');
      logger.info('Please ensure you have either:');
      logger.list([
        'postgrest.conf with db-uri setting',
        'docker-compose.yml with PostgreSQL configuration',
        '.env file with database variables'
      ]);
      
      // Fallback: show the query for manual execution
      logger.newLine();
      logger.info(chalk.yellow('💡 Manual Query:'));
      const query = generateViewsListQuery(options);
      logger.code(query, 'sql');
      return;
    }
    
    // Test connection
    const isConnected = await dbManager.testConnection(connection);
    if (!isConnected) {
      logger.warn('❌ Could not connect to database');
      logger.info('Please check that your database is running and accessible.');
      
      // Fallback: show the query for manual execution  
      logger.newLine();
      logger.info(chalk.yellow('💡 Manual Query:'));
      const query = generateViewsListQuery(options);
      logger.code(query, 'sql');
      return;
    }
    
    // Execute the query and display results
    const query = generateViewsListQuery(options);
    const { Pool } = await import('pg');
    const pool = new Pool(connection);
    
    try {
      const result = await pool.query(query);
      const views = result.rows;
      
      if (views.length === 0) {
        logger.info(`📭 No views found in schema '${options.schema}'`);
        logger.info('Views will appear here after you create them.');
        return;
      }
      
      logger.success(`✅ Found ${views.length} view(s) in schema '${options.schema}':`);
      logger.newLine();
      
      views.forEach((view, index) => {
        logger.info(`${index + 1}. ${chalk.green(view.view_name)}`);
        logger.info(`   Schema: ${view.schema_name}`);
        logger.info(`   Owner: ${view.owner}`);
        if (view.definition) {
          const shortDef = view.definition.length > 100 
            ? view.definition.substring(0, 100) + '...'
            : view.definition;
          logger.info(`   Definition: ${chalk.gray(shortDef)}`);
        }
        logger.newLine();
      });
      
      logger.info(chalk.cyan('💡 API Access:'));
      logger.info('Each view can be accessed as a regular table via PostgREST:');
      views.forEach(view => {
        logger.info(`  GET /${view.view_name}`);
      });
      
    } finally {
      await pool.end();
    }
    
  } catch (error) {
    logger.error(`❌ Failed to list views: ${error.message}`);
    
    // Fallback: show the query for manual execution
    logger.newLine();
    logger.info(chalk.yellow('💡 Manual Query (if needed):'));
    const query = generateViewsListQuery(options);
    logger.code(query, 'sql');
  }
}

/**
 * Generate views list query
 */
function generateViewsListQuery(options: any): string {
  return `-- List views in schema
SELECT 
  schemaname AS schema_name,
  viewname AS view_name,
  definition,
  viewowner AS owner
FROM pg_views 
WHERE schemaname = '${options.schema}'
ORDER BY viewname;`;
}

/**
 * Generate dynamic view using database analysis
 */
async function generateDynamicView(viewName: string, options: any): Promise<string> {
  try {
    const generator = new ViewGenerator(process.cwd());
    
    if (options.baseTable) {
      // Generate view based on specific table
      const viewConfig = await collectDynamicViewConfig(viewName, options.baseTable, options);
      return await generator.generateView(viewConfig as ViewConfig);
    } else {
      // Suggest views based on schema analysis
      logger.info(chalk.blue('🔍 Analyzing database schema for view suggestions...'));
      const analysis = await generator.suggestViews();
      
      const { selectedView } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedView',
        message: 'Select a suggested view or create custom:',
        choices: [
          ...analysis.suggestedViews.map(view => ({
            name: `${view.name} (${view.baseTable})`,
            value: view
          })),
          { name: 'Create custom view', value: 'custom' }
        ]
      }]);
      
      if (selectedView === 'custom') {
        const customConfig = await collectDynamicViewConfig(viewName, null, options);
        return await generator.generateView(customConfig as ViewConfig);
      } else {
        // Use suggested view but rename it
        selectedView.name = viewName;
        return await generator.generateView(selectedView);
      }
    }
  } catch (error) {
    logger.warn(`⚠️  Dynamic analysis failed: ${error.message}`);
    logger.info('Falling back to template-based generation...');
    
    const config = await collectViewConfig(viewName, options);
    return await generateViewSQL(config);
  }
}

/**
 * Collect dynamic view configuration
 */
async function collectDynamicViewConfig(viewName: string, baseTable: string | null, options: any) {
  let table = baseTable;
  
  if (!table) {
    const { selectedTable } = await inquirer.prompt([{
      type: 'input',
      name: 'selectedTable',
      message: 'Enter base table name:',
      validate: (input: string) => input.trim() !== '' || 'Table name is required'
    }]);
    table = selectedTable;
  }
  
  const { joinTables, selectColumns, whereCondition, orderBy } = await inquirer.prompt([
    {
      type: 'input',
      name: 'selectColumns',
      message: 'Columns to select (comma-separated, or * for all):',
      default: '*'
    },
    {
      type: 'confirm',
      name: 'addJoins',
      message: 'Add table joins?',
      default: false
    },
    {
      type: 'input',
      name: 'whereCondition',
      message: 'WHERE condition (optional):',
      when: (answers) => true
    },
    {
      type: 'input',
      name: 'orderBy',
      message: 'ORDER BY clause (optional):',
      when: (answers) => true
    }
  ]);
  
  let joins: any[] = [];
  const answers = await inquirer.prompt([{ type: 'confirm', name: 'addJoins', message: 'Add table joins?', default: false }]);
  
  if (answers.addJoins) {
    joins = await collectJoinConfiguration();
  }
  
  return {
    name: viewName,
    baseTable: table,
    joinTables: joins,
    selectColumns: selectColumns === '*' ? ['*'] : selectColumns.split(',').map((col: string) => col.trim()),
    whereCondition: whereCondition || undefined,
    orderBy: orderBy || undefined,
    materialized: options.materialized || false
  };
}

/**
 * Collect JOIN configuration
 */
async function collectJoinConfiguration(): Promise<any[]> {
  const joins: any[] = [];
  let addMore = true;
  
  while (addMore) {
    const joinConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'table',
        message: 'Table to join:',
        validate: (input: string) => input.trim() !== '' || 'Table name is required'
      },
      {
        type: 'list',
        name: 'joinType',
        message: 'Join type:',
        choices: ['LEFT', 'RIGHT', 'INNER', 'FULL'],
        default: 'LEFT'
      },
      {
        type: 'input',
        name: 'condition',
        message: 'Join condition (e.g., table1.id = table2.table1_id):',
        validate: (input: string) => input.trim() !== '' || 'Join condition is required'
      }
    ]);
    
    joins.push(joinConfig);
    
    const { continueAdding } = await inquirer.prompt([{
      type: 'confirm',
      name: 'continueAdding',
      message: 'Add another join?',
      default: false
    }]);
    
    addMore = continueAdding;
  }
  
  return joins;
}

/**
 * Create suggest views command (NEW)
 */
function createSuggestViewsCommand(): Command {
  const command = new Command('suggest');
  
  command
    .description('Analyze schema and suggest useful views')
    .option('--schema <name>', 'Schema name')
    .action(async (options) => {
      await suggestViews(options);
    });
  
  return command;
}

/**
 * Suggest views based on schema analysis
 */
async function suggestViews(options: any) {
  logger.info(chalk.cyan('🔍 Analyzing database schema for view suggestions...'));
  logger.newLine();
  
  try {
    const generator = new ViewGenerator(process.cwd());
    const analysis = await generator.suggestViews();
    
    if (analysis.suggestedViews.length === 0) {
      logger.warn('No view suggestions found. Ensure your database connection is configured and tables exist.');
      return;
    }
    
    logger.success(`✅ Found ${analysis.suggestedViews.length} view suggestions`);
    logger.newLine();
    
    // Display suggestions
    logger.info(chalk.cyan('📋 Suggested Views:'));
    analysis.suggestedViews.forEach((view, index) => {
      logger.info(`${index + 1}. ${chalk.green(view.name)}`);
      logger.info(`   Base table: ${view.baseTable}`);
      logger.info(`   Columns: ${view.selectColumns.slice(0, 3).join(', ')}${view.selectColumns.length > 3 ? '...' : ''}`);
      if (view.joinTables && view.joinTables.length > 0) {
        logger.info(`   Joins: ${view.joinTables.length} table(s)`);
      }
      logger.newLine();
    });
    
    // Ask user which views to generate
    const { selectedViews } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedViews',
      message: 'Select views to generate:',
      choices: analysis.suggestedViews.map((view, index) => ({
        name: `${view.name} (${view.baseTable})`,
        value: index
      }))
    }]);
    
    if (selectedViews.length === 0) {
      logger.info('No views selected.');
      return;
    }
    
    // Generate selected views using table-folder structure
    const projectPath = process.cwd();
    const command = getCommandString();
    
    for (const index of selectedViews) {
      const view = analysis.suggestedViews[index];
      const sql = await generator.generateView(view);
      const timestampedSQL = appendWithTimestamp(sql, command);
      
      // Write to appropriate table folder
      await writeTableSQL(projectPath, view.baseTable, SQL_FILE_TYPES.VIEWS, timestampedSQL, true);
      logger.success(`✅ Generated view: ${view.name} in sql/schemas/${view.baseTable}/views.sql`);
    }
    
    logger.success(`💾 All ${selectedViews.length} views saved to their respective table folders`);
    
    displayBulkViewUsage(selectedViews.map(i => analysis.suggestedViews[i]));
    
  } catch (error) {
    logger.error(`❌ Failed to analyze schema: ${error.message}`);
    logger.info('Make sure your database connection is configured and accessible.');
  }
}

/**
 * Create analyze schema command (NEW)
 */
function createAnalyzeSchemaCommand(): Command {
  const command = new Command('analyze');
  
  command
    .description('Analyze database schema and relationships')
    .option('--schema <name>', 'Schema name')
    .action(async (options) => {
      await analyzeSchema(options);
    });
  
  return command;
}

/**
 * Analyze database schema
 */
async function analyzeSchema(options: any) {
  logger.info(chalk.cyan('🔍 Analyzing database schema...'));
  logger.newLine();
  
  try {
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.warn('No database connection found. Please configure your database connection.');
      return;
    }
    
    const analysis = await inspector.analyzeSchema(connection);
    
    // Display schema analysis
    logger.info(chalk.cyan('📊 Schema Analysis Results:'));
    logger.newLine();
    
    logger.info(`📋 Tables: ${Object.keys(analysis.tables).length}`);
    Object.entries(analysis.tables).forEach(([tableName, columns]) => {
      logger.info(`  • ${tableName} (${columns.length} columns)`);
    });
    
    logger.newLine();
    logger.info(`🔗 Relationships: ${analysis.relations.length}`);
    analysis.relations.slice(0, 5).forEach(rel => {
      logger.info(`  • ${rel.fromTable}.${rel.fromColumn} → ${rel.toTable}.${rel.toColumn}`);
    });
    if (analysis.relations.length > 5) {
      logger.info(`  ... and ${analysis.relations.length - 5} more`);
    }
    
    logger.newLine();
    logger.info(`📈 Indexes: ${analysis.indexes.length}`);
    logger.info(`👁️  Views: ${analysis.views.length}`);
    logger.info(`⚙️  Functions: ${analysis.functions.length}`);
    logger.info(`🔥 Triggers: ${analysis.triggers.length}`);
    
    // Provide recommendations
    logger.newLine();
    logger.info(chalk.yellow('💡 View Recommendations:'));
    
    if (analysis.tables.users && Object.keys(analysis.tables).length > 1) {
      logger.list([
        'Consider user activity summary views',
        'Create joined views for related user data',
        'Add filtered views for common queries'
      ]);
    }
    
    if (analysis.relations.length > 0) {
      logger.list([
        'Create views to simplify complex joins',
        'Add aggregation views for reporting',
        'Consider materialized views for performance'
      ]);
    }
    
    logger.newLine();
    logger.info(`Run ${chalk.cyan('pgrestify api features views suggest')} to generate specific suggestions.`);
    
  } catch (error) {
    logger.error(`❌ Failed to analyze schema: ${error.message}`);
  }
}

/**
 * Display enhanced view usage instructions
 */
async function displayEnhancedViewUsage(viewName: string, options: any) {
  logger.newLine();
  logger.info(chalk.cyan('Usage:'));
  const baseTable = options.baseTable || 'your_table';
  logger.list([
    `Apply view: pgrestify api migrate (or manually: psql -d your_db -f sql/schemas/${baseTable}/views.sql)`,
    `Access via GET /${viewName}`,
    'Views appear as regular tables in PostgREST',
    'Test with curl or your frontend client'
  ]);
  
  if (options.materialized) {
    logger.newLine();
    logger.info(chalk.blue('🔄 Materialized View:'));
    logger.list([
      `Refresh data: REFRESH MATERIALIZED VIEW ${options.schema}.${viewName}`,
      'Better performance for complex queries',
      'Consider scheduling regular refreshes'
    ]);
  }
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Enhanced Tips:'));
  logger.list([
    'Use --dynamic flag for intelligent view generation',
    'Add indexes on underlying tables for performance',
    'Use SECURITY DEFINER for privileged access',
    'Document complex views for your team',
    options.dynamic ? 'Generated with database analysis' : 'Consider using --dynamic for smarter views'
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('Example API call:'));
  const postgrestConfig = await getPostgRESTConfig();
  const serverPort = postgrestConfig.serverPort;
  
  logger.code(`# Get data from your view
curl "http://localhost:${serverPort}/${viewName}?limit=10"`);
}

/**
 * Display bulk view usage instructions
 */
function displayBulkViewUsage(views: any[]) {
  logger.newLine();
  logger.info(chalk.cyan('🚀 Generated Views Usage:'));
  logger.list([
    `Apply all views: pgrestify api migrate`,
    `${views.length} views created in their respective table folders`,
    'Each view appears as a regular table in PostgREST'
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('📋 Your Views:'));
  views.forEach(view => {
    logger.info(`  • GET /${view.name} - ${view.baseTable} based view (sql/schemas/${view.baseTable}/views.sql)`);
  });
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Next Steps:'));
  logger.list([
    'Test your views with PostgREST',
    'Add appropriate RLS policies if needed',
    'Consider adding indexes for performance',
    'Document the purpose of each view'
  ]);
}

/**
 * Display view usage instructions
 */
async function displayViewUsage(config: any) {
  logger.newLine();
  logger.info(chalk.cyan('Usage:'));
  logger.list([
    `Apply view: psql -d your_db -f ${config.output}`,
    `Access via GET /${config.viewName}`,
    'Views appear as regular tables in PostgREST',
    'Test with curl or your frontend client'
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Tips:'));
  logger.list([
    'Views are read-only by default',
    'Add indexes on underlying tables for performance',
    'Use SECURITY DEFINER for privileged access',
    'Document complex views for your team'
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('Example API call:'));
  const postgrestConfig = await getPostgRESTConfig();
  const serverPort = postgrestConfig.serverPort;
  
  logger.code(`# Get data from your view
curl "http://localhost:${serverPort}/${config.viewName}?limit=10"`);
}