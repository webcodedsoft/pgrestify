/**
 * @fileoverview Generate views using intelligent schema analysis
 * 
 * Creates database views based on schema relationships, query patterns,
 * and performance optimization opportunities.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../../../utils/logger.js';
import { fs } from '../../../utils/fs.js';
import { ViewGenerator, ViewConfig } from '../../../generators/ViewGenerator.js';
import { SchemaInspector } from '../../../generators/SchemaInspector.js';
import { writeTableSQL, SQL_FILE_TYPES, appendWithTimestamp, getCommandString } from '../../../utils/sql-structure.js';
import { deduplicateSQL } from '../../../utils/deduplication.js';
import { getPostgRESTConfig } from '../../../utils/postgrest-config.js';

/**
 * Create view generation command
 */
export function createViewCommand(): Command {
  const command = new Command('view');
  
  command
    .description('Generate optimized views using intelligent schema analysis')
    .argument('<name>', 'View name')
    .option('--schema <name>', 'Schema name (defaults to PostgREST config)')
    .option('--base-table <table>', 'Base table for view generation')
    .option('--materialized', 'Create materialized view for better performance')
    .option('--suggest-all', 'Generate all recommended views for the schema')
    .action(async (viewName, options) => {
      await generateView(viewName, options);
    });
  
  return command;
}

/**
 * Generate optimized view
 */
async function generateView(viewName: string, options: any) {
  logger.info(chalk.cyan(`👁️  Generating Optimized View: ${viewName}`));
  logger.newLine();
  
  // Resolve schema from options or PostgREST config
  if (!options.schema) {
    try {
      const postgrestConfig = await getPostgRESTConfig();
      options.schema = postgrestConfig.dbSchemas;
    } catch (error) {
      options.schema = 'api'; // fallback only if config can't be read
    }
  }
  
  if (options.suggestAll) {
    await generateAllRecommendedViews(options);
    return;
  }
  
  try {
    const generator = new ViewGenerator(process.cwd());
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.warn('No database connection found. Using interactive template mode.');
      const config = await collectViewConfigInteractive(viewName, options);
      const sql = await generator.generateView(config);
      await writeViewToTable(sql, config.baseTable);
      await displayViewUsage(viewName, { ...options, baseTable: config.baseTable });
      return;
    }
    
    logger.info(chalk.blue('🔍 Analyzing schema for optimal view generation...'));
    
    // Get schema analysis
    const schemaAnalysis = await inspector.analyzeSchema(connection);
    
    // Get view suggestions
    const viewAnalysis = await generator.suggestViews();
    
    if (!options.baseTable && viewAnalysis.suggestedViews.length === 0) {
      logger.info('No automatic suggestions found. Using interactive mode.');
      const config = await collectViewConfigInteractive(viewName, options);
      const sql = await generator.generateView(config);
      await writeViewToTable(sql, config.baseTable);
      await displayViewUsage(viewName, { ...options, baseTable: config.baseTable });
      return;
    }
    
    let selectedConfig: ViewConfig;
    
    if (options.baseTable) {
      // Generate view for specific table
      selectedConfig = await generateViewForTable(viewName, options.baseTable, options, generator, inspector);
    } else {
      // Let user choose from suggestions
      selectedConfig = await selectFromSuggestions(viewName, viewAnalysis, options);
    }
    
    // Generate the view
    const sql = await generator.generateView(selectedConfig);
    
    await writeViewToTable(sql, selectedConfig.baseTable);
    logger.success(`✅ Optimized view generated in: sql/schemas/${selectedConfig.baseTable}/views.sql`);
    await displayViewUsage(viewName, { ...options, baseTable: selectedConfig.baseTable });
    
  } catch (error) {
    logger.error(`❌ Failed to generate view: ${error.message}`);
    logger.info('Falling back to interactive mode...');
    
    const config = await collectViewConfigInteractive(viewName, options);
    const generator = new ViewGenerator(process.cwd());
    const sql = await generator.generateView(config);
    await writeViewToTable(sql, config.baseTable);
    await displayViewUsage(viewName, { ...options, baseTable: config.baseTable });
  }
}

/**
 * Generate view configuration for specific table
 */
async function generateViewForTable(
  viewName: string,
  baseTable: string,
  options: any,
  generator: ViewGenerator,
  inspector: SchemaInspector
): Promise<ViewConfig> {
  const connection = await inspector.extractDatabaseConnection();
  
  if (!connection) {
    throw new Error('Database connection required for table analysis');
  }
  
  // Analyze the base table
  const columns = await inspector.analyzeTable(baseTable, connection);
  const schemaAnalysis = await inspector.analyzeSchema(connection);
  
  // Find relationships to this table
  const relatedTables = schemaAnalysis.relations
    .filter(rel => rel.fromTable === baseTable || rel.toTable === baseTable)
    .map(rel => rel.fromTable === baseTable ? rel.toTable : rel.fromTable);
  
  logger.success(`✅ Found ${relatedTables.length} related tables: ${relatedTables.join(', ')}`);
  logger.newLine();
  
  // Ask user what type of view to create
  const { viewType, includeJoins, aggregations } = await inquirer.prompt([
    {
      type: 'list',
      name: 'viewType',
      message: 'What type of view would you like to create?',
      choices: [
        { name: 'Simple - Just column selection and filtering', value: 'simple' },
        { name: 'Joined - Include related table data', value: 'joined' },
        { name: 'Aggregated - Summary/statistics view', value: 'aggregated' },
        { name: 'Computed - Add calculated columns', value: 'computed' }
      ]
    },
    {
      type: 'checkbox',
      name: 'includeJoins',
      message: 'Include data from which related tables?',
      choices: relatedTables.map(table => ({ name: table, value: table })),
      when: (answers) => answers.viewType === 'joined' && relatedTables.length > 0
    },
    {
      type: 'input',
      name: 'aggregations',
      message: 'Aggregation functions (e.g., COUNT(*) as total, AVG(amount) as avg_amount):',
      when: (answers) => answers.viewType === 'aggregated'
    }
  ]);
  
  // Build view configuration
  const config: ViewConfig = {
    name: viewName,
    baseTable: baseTable,
    selectColumns: columns.slice(0, 10).map(col => col.name), // Limit columns for demo
    joinTables: [],
    materialized: options.materialized || false
  };
  
  // Add joins if requested
  if (viewType === 'joined' && includeJoins && includeJoins.length > 0) {
    config.joinTables = includeJoins.map((table: string) => {
      const relation = schemaAnalysis.relations.find(rel => 
        (rel.fromTable === baseTable && rel.toTable === table) ||
        (rel.fromTable === table && rel.toTable === baseTable)
      );
      
      return {
        table: table,
        joinType: 'LEFT',
        condition: relation ? 
          `${relation.fromTable}.${relation.fromColumn} = ${relation.toTable}.${relation.toColumn}` :
          `${baseTable}.id = ${table}.${baseTable}_id` // fallback assumption
      };
    });
  }
  
  return config;
}

/**
 * Select configuration from view suggestions
 */
async function selectFromSuggestions(
  viewName: string, 
  viewAnalysis: any, 
  options: any
): Promise<ViewConfig> {
  logger.info(chalk.cyan(`📋 Found ${viewAnalysis.suggestedViews.length} view suggestions:`));
  viewAnalysis.suggestedViews.forEach((view: any, index: number) => {
    logger.info(`${index + 1}. ${chalk.green(view.name)} (based on ${view.baseTable})`);
    logger.info(`   Columns: ${view.selectColumns.slice(0, 3).join(', ')}${view.selectColumns.length > 3 ? '...' : ''}`);
  });
  logger.newLine();
  
  const { selectedView } = await inquirer.prompt([{
    type: 'list',
    name: 'selectedView',
    message: 'Select a view suggestion or create custom:',
    choices: [
      ...viewAnalysis.suggestedViews.map((view: any, index: number) => ({
        name: `${view.name} (${view.baseTable}) - ${view.selectColumns.length} columns`,
        value: index
      })),
      { name: 'Create custom view', value: 'custom' }
    ]
  }]);
  
  if (selectedView === 'custom') {
    return await collectViewConfigInteractive(viewName, options);
  } else {
    const suggestion = viewAnalysis.suggestedViews[selectedView];
    // Use suggestion but override name
    return {
      ...suggestion,
      name: viewName,
      materialized: options.materialized || false
    };
  }
}

/**
 * Collect view configuration interactively
 */
async function collectViewConfigInteractive(viewName: string, options: any): Promise<ViewConfig> {
  const { baseTable, selectColumns, joinTables, whereCondition, orderBy } = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseTable',
      message: 'Base table name:',
      validate: (input: string) => input.trim() !== '' || 'Base table is required'
    },
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
    },
    {
      type: 'input',
      name: 'orderBy',
      message: 'ORDER BY clause (optional):'
    }
  ]);
  
  let joins: any[] = [];
  const addJoinsAnswer = await inquirer.prompt([{ 
    type: 'confirm', 
    name: 'addJoins', 
    message: 'Add table joins?', 
    default: false 
  }]);
  
  if (addJoinsAnswer.addJoins) {
    joins = await collectJoinConfiguration();
  }
  
  return {
    name: viewName,
    baseTable: baseTable,
    selectColumns: selectColumns === '*' ? ['*'] : selectColumns.split(',').map((col: string) => col.trim()),
    joinTables: joins,
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
 * Generate all recommended views for schema
 */
async function generateAllRecommendedViews(options: any) {
  logger.info(chalk.cyan('👁️  Generating all recommended views for schema'));
  logger.newLine();
  
  try {
    const generator = new ViewGenerator(process.cwd());
    const viewAnalysis = await generator.suggestViews();
    
    if (!viewAnalysis || viewAnalysis.suggestedViews.length === 0) {
      logger.warn('No view recommendations found for the current schema.');
      return;
    }
    
    logger.success(`✅ Found ${viewAnalysis.suggestedViews.length} view recommendations`);
    logger.newLine();
    
    // Display all suggestions
    logger.info(chalk.cyan('📋 Recommended Views:'));
    viewAnalysis.suggestedViews.forEach((view: any, index: number) => {
      logger.info(`${index + 1}. ${chalk.green(view.name)} (${view.baseTable})`);
      logger.info(`   Columns: ${view.selectColumns.slice(0, 3).join(', ')}${view.selectColumns.length > 3 ? '...' : ''}`);
    });
    logger.newLine();
    
    // Ask for confirmation
    const { generateAll } = await inquirer.prompt([{
      type: 'confirm',
      name: 'generateAll',
      message: 'Generate SQL for all recommended views?',
      default: true
    }]);
    
    if (!generateAll) {
      logger.info('View generation cancelled.');
      return;
    }
    
    // Generate all views using table-folder structure
    for (const viewConfig of viewAnalysis.suggestedViews) {
      const sql = await generator.generateView(viewConfig);
      await writeViewToTable(sql, viewConfig.baseTable);
      logger.success(`✅ Generated view: ${viewConfig.name} in sql/schemas/${viewConfig.baseTable}/views.sql`);
    }
    
    logger.success(`💾 All ${viewAnalysis.suggestedViews.length} recommended views saved to their respective table folders`);
    
    displayBulkViewUsage(viewAnalysis.suggestedViews);
    
  } catch (error) {
    logger.error(`❌ Failed to generate recommended views: ${error.message}`);
  }
}

/**
 * Write view SQL to table folder
 */
async function writeViewToTable(sql: string, baseTable: string) {
  const projectPath = process.cwd();
  const command = getCommandString();
  
  // Use generic deduplication utility
  const result = await deduplicateSQL(sql, baseTable, SQL_FILE_TYPES.VIEWS, projectPath, 'views');
  
  if (!result.sql) {
    logger.info('No new views to add');
    return;
  }
  
  const timestampedSQL = appendWithTimestamp(result.sql, command);
  await writeTableSQL(projectPath, baseTable, SQL_FILE_TYPES.VIEWS, timestampedSQL, true);
}

/**
 * Generate views header
 */
function generateViewsHeader(): string {
  return `-- PostgreSQL Views for PostgREST
-- Generated by PGRestify CLI (Generate Command)
-- 
-- Apply these views to your database:
-- psql -d your_database -f views.sql
--
-- Views provide:
-- - Simplified API endpoints
-- - Complex JOIN operations
-- - Data aggregation and computed columns
-- - Performance optimization with materialized views`;
}

/**
 * Display view usage instructions
 */
async function displayViewUsage(viewName: string, options: any) {
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
    const postgrestConfig = await getPostgRESTConfig();
    const schema = postgrestConfig.dbSchemas;
    
    logger.newLine();
    logger.info(chalk.blue('🔄 Materialized View:'));
    logger.list([
      `Refresh data: REFRESH MATERIALIZED VIEW ${schema}.${viewName}`,
      'Better performance for complex queries',
      'Consider scheduling regular refreshes'
    ]);
  }
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Optimization Tips:'));
  logger.list([
    'Generated using intelligent schema analysis',
    'Add indexes on underlying tables for performance',
    'Use materialized views for heavy aggregations',
    'Monitor view performance with EXPLAIN',
    'Document complex views for your team'
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('Example API call:'));
  const postgrestConfig = await getPostgRESTConfig();
  const serverPort = postgrestConfig.serverPort;
  
  logger.code(`# Get data from your optimized view
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
    `${views.length} optimized views created in their respective table folders`,
    'Each view provides a specialized API endpoint'
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('📋 Your Optimized Views:'));
  views.forEach((view: any) => {
    logger.info(`  • GET /${view.name} - ${view.baseTable} based view (sql/schemas/${view.baseTable}/views.sql)`);
  });
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Next Steps:'));
  logger.list([
    'Test your views with PostgREST',
    'Add appropriate RLS policies if needed',
    'Consider adding indexes for performance',
    'Monitor query execution plans',
    'Document the purpose of each view'
  ]);
}