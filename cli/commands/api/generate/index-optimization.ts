/**
 * @fileoverview Generate indexes using intelligent performance analysis
 * 
 * Creates optimized database indexes based on query patterns,
 * performance analysis, and PostgreSQL best practices.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../../../utils/logger.js';
import { fs } from '../../../utils/fs.js';
import { IndexGenerator, IndexAnalysis } from '../../../generators/IndexGenerator.js';
import { SchemaInspector } from '../../../generators/SchemaInspector.js';
import { writeTableSQL, SQL_FILE_TYPES, appendWithTimestamp, getCommandString } from '../../../utils/sql-structure.js';

/**
 * Create index optimization command
 */
export function createIndexOptimizationCommand(): Command {
  const command = new Command('index');
  
  command
    .description('Generate optimized indexes using performance analysis')
    .argument('<table>', 'Table name for index optimization')
    .option('--schema <name>', 'Schema name')
    .option('--columns <cols>', 'Specific columns to index (comma-separated)')
    .option('--type <type>', 'Index type (btree|gin|gist|hash)', 'btree')
    .option('--analyze-all', 'Analyze and optimize all tables')
    .option('--performance-only', 'Only create performance-critical indexes')
    .action(async (tableName, options) => {
      await generateIndexes(tableName, options);
    });
  
  return command;
}

/**
 * Generate optimized indexes for table
 */
async function generateIndexes(tableName: string, options: any) {
  logger.info(chalk.cyan(`📇 Generating Optimized Indexes for ${tableName}`));
  logger.newLine();
  
  if (options.analyzeAll) {
    await analyzeAndOptimizeAllTables(options);
    return;
  }
  
  try {
    const generator = new IndexGenerator(process.cwd());
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.warn('No database connection found. Using template-based generation.');
      const sql = await generateTemplateIndexes(tableName, options);
      await writeIndexesToTable(sql, tableName);
      displayIndexUsage(tableName, options);
      return;
    }
    
    logger.info(chalk.blue('🔍 Analyzing table performance and query patterns...'));
    
    // Perform comprehensive table analysis
    const analysis = await generator.analyzeTableIndexes(tableName, connection);
    
    if (!analysis || analysis.recommendations.length === 0) {
      logger.warn('No performance optimization opportunities found.');
      logger.info('This table may already be well-optimized, or needs more query data.');
      
      // Offer basic indexes anyway
      const sql = await generateTemplateIndexes(tableName, options);
      await writeIndexesToTable(sql, tableName);
      displayIndexUsage(tableName, options);
      return;
    }
    
    logger.success(`✅ Found ${analysis.recommendations.length} optimization opportunities`);
    logger.newLine();
    
    // Display analysis results
    displayIndexAnalysis(analysis);
    
    // Filter recommendations based on options
    let recommendations = analysis.recommendations;
    if (options.performanceOnly) {
      recommendations = recommendations.filter(rec => 
        rec.impact && ['HIGH', 'CRITICAL'].includes(rec.impact)
      );
      logger.info(chalk.yellow(`🎯 Filtered to ${recommendations.length} performance-critical indexes`));
    }
    
    if (recommendations.length === 0) {
      logger.info('No indexes match the specified criteria.');
      return;
    }
    
    // Ask user which indexes to create
    const { selectedIndexes } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedIndexes',
      message: 'Select indexes to create:',
      choices: recommendations.map((rec, index) => ({
        name: `${rec.indexName} (${rec.columns.join(', ')}) - ${rec.reason}${rec.impact ? ` [${rec.impact}]` : ''}`,
        value: index,
        checked: rec.impact && ['HIGH', 'CRITICAL'].includes(rec.impact)
      }))
    }]);
    
    if (selectedIndexes.length === 0) {
      logger.info('No indexes selected for creation.');
      return;
    }
    
    // Generate selected indexes
    let allSQL = generateIndexHeader();
    allSQL += `\n-- Performance-optimized indexes for ${tableName}\n`;
    allSQL += `-- Based on analysis of query patterns and table structure\n\n`;
    
    for (const index of selectedIndexes) {
      const recommendation = recommendations[index];
      const indexSQL = generateIndexFromRecommendation(tableName, options.schema, recommendation);
      allSQL += indexSQL + '\n\n';
      logger.success(`✅ Generated index: ${recommendation.indexName}`);
    }
    
    await writeIndexesToTable(allSQL, tableName);
    logger.success(`💾 Optimized indexes saved to: sql/schemas/${tableName}/indexes.sql`);
    displayAdvancedIndexUsage(tableName, selectedIndexes.length, options);
    
  } catch (error) {
    logger.error(`❌ Failed to generate indexes: ${error.message}`);
    logger.info('Falling back to template generation...');
    
    const sql = await generateTemplateIndexes(tableName, options);
    await writeIndexesToTable(sql, tableName);
    displayIndexUsage(tableName, options);
  }
}

/**
 * Display detailed index analysis
 */
function displayIndexAnalysis(analysis: IndexAnalysis) {
  logger.info(chalk.cyan('📊 Performance Analysis Results:'));
  
  if (analysis.missingIndexes && analysis.missingIndexes.length > 0) {
    logger.info(chalk.yellow(`⚠️  Missing Indexes: ${analysis.missingIndexes.length}`));
    analysis.missingIndexes.slice(0, 3).forEach(index => {
      logger.info(`  • ${index}`);
    });
    if (analysis.missingIndexes.length > 3) {
      logger.info(`  ... and ${analysis.missingIndexes.length - 3} more`);
    }
  }
  
  if (analysis.redundantIndexes && analysis.redundantIndexes.length > 0) {
    logger.info(chalk.red(`🔄 Redundant Indexes: ${analysis.redundantIndexes.length}`));
    analysis.redundantIndexes.slice(0, 3).forEach(index => {
      logger.info(`  • ${index}`);
    });
  }
  
  if (analysis.performanceIssues && analysis.performanceIssues.length > 0) {
    logger.info(chalk.red(`🐌 Performance Issues: ${analysis.performanceIssues.length}`));
    analysis.performanceIssues.forEach(issue => {
      logger.info(`  • ${issue}`);
    });
  }
  
  logger.newLine();
  logger.info(chalk.cyan('💡 Recommendations:'));
  analysis.recommendations.forEach((rec, index) => {
    const impactColor = getImpactColor(rec.impact);
    logger.info(`${index + 1}. ${chalk.green(rec.indexName)} on ${rec.columns.join(', ')}`);
    logger.info(`   Type: ${rec?.indexType?.toUpperCase()} | Reason: ${rec.reason}`);
    if (rec.impact) {
      logger.info(`   Impact: ${impactColor(rec.impact)}`);
    }
  });
  logger.newLine();
}

/**
 * Get color function based on impact level
 */
function getImpactColor(impact?: string) {
  switch (impact) {
    case 'CRITICAL': return chalk.red.bold;
    case 'HIGH': return chalk.red;
    case 'MEDIUM': return chalk.yellow;
    case 'LOW': return chalk.green;
    default: return chalk.gray;
  }
}

/**
 * Generate index SQL from recommendation
 */
function generateIndexFromRecommendation(tableName: string, schema: string, recommendation: any): string {
  const { indexName, columns, indexType, unique = false, partialCondition, reason, impact } = recommendation;
  const uniqueKeyword = unique ? 'UNIQUE ' : '';
  const columnsList = columns.join(', ');
  const whereClause = partialCondition ? ` WHERE ${partialCondition}` : '';
  
  return `-- Index: ${indexName}
-- Columns: ${columnsList}
-- Type: ${indexType.toUpperCase()}
-- Reason: ${reason}${impact ? `\n-- Performance Impact: ${impact}` : ''}

CREATE ${uniqueKeyword}INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
  ON ${schema}.${tableName} USING ${indexType} (${columnsList})${whereClause};

-- Performance comment
COMMENT ON INDEX ${indexName} IS '${reason}${impact ? ` (Impact: ${impact})` : ''}';`;
}

/**
 * Analyze and optimize all tables
 */
async function analyzeAndOptimizeAllTables(options: any) {
  logger.info(chalk.cyan('📇 Analyzing and optimizing all tables'));
  logger.newLine();
  
  try {
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.error('Database connection required for --analyze-all option');
      return;
    }
    
    const tableNames = await inspector.getTableNames(connection);
    
    if (tableNames.length === 0) {
      logger.warn('No tables found in the schema');
      return;
    }
    
    logger.info(`Found ${tableNames.length} tables to analyze: ${tableNames.join(', ')}`);
    logger.newLine();
    
    const generator = new IndexGenerator(process.cwd());
    const allAnalyses = new Map<string, IndexAnalysis>();
    
    // Analyze each table
    for (const tableName of tableNames) {
      try {
        logger.info(`Analyzing ${tableName}...`);
        const analysis = await generator.analyzeTableIndexes(tableName, connection);
        
        if (analysis && analysis.recommendations.length > 0) {
          allAnalyses.set(tableName, analysis);
          logger.success(`✅ Found ${analysis.recommendations.length} opportunities for ${tableName}`);
        } else {
          logger.info(`ℹ️  ${tableName} is already well-optimized`);
        }
      } catch (error) {
        logger.warn(`⚠️  Skipped ${tableName}: ${error.message}`);
      }
    }
    
    if (allAnalyses.size === 0) {
      logger.success('✅ All tables are already well-optimized!');
      return;
    }
    
    // Display summary
    const totalRecommendations = Array.from(allAnalyses.values())
      .reduce((sum, analysis) => sum + analysis.recommendations.length, 0);
    
    logger.newLine();
    logger.success(`🎯 Analysis complete: ${totalRecommendations} optimization opportunities across ${allAnalyses.size} tables`);
    logger.newLine();
    
    // Show summary by table
    for (const [tableName, analysis] of allAnalyses) {
      logger.info(chalk.cyan(`📋 ${tableName} (${analysis.recommendations.length} recommendations):`));
      analysis.recommendations.forEach(rec => {
        const impact = rec.impact ? ` [${rec.impact}]` : '';
        logger.info(`  • ${rec.indexName} - ${rec.reason}${impact}`);
      });
      logger.newLine();
    }
    
    // Ask which tables to optimize
    const { selectedTables } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedTables',
      message: 'Select tables to optimize:',
      choices: Array.from(allAnalyses.keys()).map(tableName => ({
        name: `${tableName} (${allAnalyses.get(tableName)!.recommendations.length} indexes)`,
        value: tableName,
        checked: true
      }))
    }]);
    
    if (selectedTables.length === 0) {
      logger.info('No tables selected for optimization.');
      return;
    }
    
    // Generate indexes for selected tables
    let allSQL = generateIndexHeader();
    allSQL += `\n-- Performance optimization for ${selectedTables.length} tables\n`;
    allSQL += `-- Generated based on comprehensive schema analysis\n\n`;
    
    let totalIndexes = 0;
    
    for (const tableName of selectedTables) {
      const analysis = allAnalyses.get(tableName)!;
      
      // Filter to performance-critical if requested
      let recommendations = analysis.recommendations;
      if (options.performanceOnly) {
        recommendations = recommendations.filter(rec => 
          rec.impact && ['HIGH', 'CRITICAL'].includes(rec.impact)
        );
      }
      
      if (recommendations.length === 0) continue;
      
      allSQL += `-- Optimized indexes for ${tableName}\n`;
      
      for (const rec of recommendations) {
        const indexSQL = generateIndexFromRecommendation(tableName, options.schema, rec);
        allSQL += indexSQL + '\n\n';
        totalIndexes++;
      }
      
      logger.success(`✅ Generated ${recommendations.length} indexes for ${tableName}`);
    }
    
    // Write indexes to individual table folders
    const tableIndexes = new Map<string, string>();
    
    // Parse the allSQL and write to appropriate table folders
    for (const tableName of selectedTables) {
      const analysis = allAnalyses.get(tableName)!;
      
      // Filter to performance-critical if requested
      let recommendations = analysis.recommendations;
      if (options.performanceOnly) {
        recommendations = recommendations.filter(rec => 
          rec.impact && ['HIGH', 'CRITICAL'].includes(rec.impact)
        );
      }
      
      if (recommendations.length === 0) continue;
      
      let tableSQL = generateIndexHeader();
      tableSQL += `\n-- Optimized indexes for ${tableName}\n`;
      
      for (const rec of recommendations) {
        const indexSQL = generateIndexFromRecommendation(tableName, options.schema, rec);
        tableSQL += indexSQL + '\n\n';
      }
      
      await writeIndexesToTable(tableSQL, tableName);
      logger.success(`✅ Generated indexes for ${tableName} in sql/schemas/${tableName}/indexes.sql`);
    }
    
    logger.success(`💾 Generated ${totalIndexes} optimized indexes saved to their respective table folders`);
    
    displayBulkIndexUsage(selectedTables, totalIndexes);
    
  } catch (error) {
    logger.error(`❌ Failed to analyze tables: ${error.message}`);
  }
}

/**
 * Generate template indexes when no database connection
 */
async function generateTemplateIndexes(tableName: string, options: any): Promise<string> {
  let columns = options.columns;
  let indexType = options.type;
  
  if (!columns) {
    const { selectedColumns, selectedType, unique } = await inquirer.prompt([
      {
        type: 'input',
        name: 'selectedColumns',
        message: 'Columns to index (comma-separated):',
        default: 'id',
        validate: (input: string) => input.trim() !== '' || 'At least one column is required'
      },
      {
        type: 'list',
        name: 'selectedType',
        message: 'Index type:',
        choices: [
          { name: 'B-Tree (default, good for equality and range queries)', value: 'btree' },
          { name: 'GIN (good for JSONB and full-text search)', value: 'gin' },
          { name: 'GiST (good for geometric data)', value: 'gist' },
          { name: 'Hash (good for equality only)', value: 'hash' }
        ],
        default: indexType
      },
      {
        type: 'confirm',
        name: 'unique',
        message: 'Create unique index?',
        default: false
      }
    ]);
    
    columns = selectedColumns;
    indexType = selectedType;
  }
  
  const columnsList = columns.split(',').map((col: string) => col.trim());
  const indexName = `idx_${tableName}_${columnsList.join('_').replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`;
  
  return `-- Template index for ${tableName}
-- Generated: ${new Date().toISOString()}

CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
  ON ${options.schema}.${tableName} USING ${indexType} (${columnsList.join(', ')});

-- Add comment
COMMENT ON INDEX ${indexName} IS 'Template index for ${columnsList.join(', ')}';`;
}

/**
 * Write indexes SQL to table folder
 */
async function writeIndexesToTable(sql: string, tableName: string) {
  const projectPath = process.cwd();
  const command = getCommandString();
  const timestampedSQL = appendWithTimestamp(sql, command);
  
  await writeTableSQL(projectPath, tableName, SQL_FILE_TYPES.INDEXES, timestampedSQL, true);
}

/**
 * Generate index header
 */
function generateIndexHeader(): string {
  return `-- PostgreSQL Performance Indexes
-- Generated by PGRestify CLI (Generate Command)
-- 
-- Apply these indexes to your database:
-- psql -d your_database -f indexes.sql
--
-- Performance indexes provide:
-- - Faster query execution
-- - Reduced sequential scans
-- - Optimized JOIN operations
-- - Better RLS policy performance`;
}

/**
 * Display index usage instructions
 */
function displayIndexUsage(tableName: string, options: any) {
  logger.newLine();
  logger.info(chalk.cyan('Usage:'));
  logger.list([
    `Apply indexes: pgrestify api migrate (or manually: psql -d your_db -f sql/schemas/${tableName}/indexes.sql)`,
    `Indexes will optimize queries on ${tableName}`,
    'CONCURRENTLY option prevents table locking during creation',
    'Monitor performance improvements with EXPLAIN'
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Performance Tips:'));
  logger.list([
    'Generated using intelligent performance analysis',
    'Indexes improve SELECT performance but slow INSERTs',
    'Monitor index usage with pg_stat_user_indexes',
    'Consider composite indexes for multi-column queries'
  ]);
}

/**
 * Display advanced index usage instructions
 */
function displayAdvancedIndexUsage(tableName: string, indexCount: number, options: any) {
  logger.newLine();
  logger.info(chalk.cyan('🚀 Performance Optimization Results:'));
  logger.list([
    `Apply optimized indexes: pgrestify api migrate (or manually: psql -d your_db -f sql/schemas/${tableName}/indexes.sql)`,
    `${indexCount} performance-critical indexes created for ${tableName}`,
    'Indexes are optimized based on real performance analysis'
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow('📊 Performance Monitoring:'));
  logger.list([
    'Use EXPLAIN ANALYZE to verify index usage',
    'Monitor with pg_stat_user_indexes view',
    'Check for unused indexes periodically',
    'Benchmark query performance before/after'
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('Example performance testing:'));
  logger.code(`# Test query performance
EXPLAIN ANALYZE SELECT * FROM ${tableName} WHERE column_name = 'value';

# Check index usage
SELECT * FROM pg_stat_user_indexes WHERE schemaname = '${options.schema}';`);
}

/**
 * Display bulk index usage instructions  
 */
function displayBulkIndexUsage(tables: string[], indexCount: number) {
  logger.newLine();
  logger.info(chalk.cyan('🚀 Schema Optimization Complete:'));
  logger.list([
    `Apply all indexes: pgrestify api migrate`,
    `${indexCount} performance indexes created across ${tables.length} tables in their respective folders`,
    'Your entire schema is now optimized for performance'
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('📋 Optimized Tables:'));
  tables.forEach(table => {
    logger.info(`  • ${table} - Performance optimized (sql/schemas/${table}/indexes.sql)`);
  });
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Next Steps:'));
  logger.list([
    'Monitor query performance improvements',
    'Set up regular performance analysis',
    'Update indexes as query patterns change',
    'Document optimization decisions for your team'
  ]);
}