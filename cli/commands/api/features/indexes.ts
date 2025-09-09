/**
 * @fileoverview PostgreSQL indexes for PostgREST
 * 
 * Generates database indexes optimized for PostgREST query patterns
 * and RLS performance.
 * Enhanced with intelligent database analysis and performance recommendations.
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
 * Create indexes command
 */
export function createIndexesCommand(): Command {
  const command = new Command('indexes');
  
  command
    .description('Generate PostgreSQL indexes for PostgREST (Enhanced with performance analysis)')
    .addCommand(createAddIndexCommand())
    .addCommand(createSuggestIndexesCommand())
    .addCommand(createAnalyzePerformanceCommand())
    .addCommand(createAnalyzeCommand());
  
  return command;
}

/**
 * Create add index command
 */
function createAddIndexCommand(): Command {
  const command = new Command('add');
  
  command
    .description('Add index to table (with performance analysis)')
    .argument('<table>', 'Table name')
    .option('--schema <name>', 'Schema name')
    .option('--columns <cols>', 'Columns to index (comma-separated)')
    .option('--type <type>', 'Index type (btree|gin|gist|hash)')
    .option('--dynamic', 'Use performance analysis from database')
    .option('--all-tables', 'Add recommended indexes to all tables')
    .action(async (tableName, options) => {
      await addIndex(tableName, options);
    });
  
  return command;
}

/**
 * Add index to table (Enhanced with performance analysis)
 */
async function addIndex(tableName: string, options: any) {
  logger.info(chalk.cyan(`📇 Adding Index to ${tableName}`));
  logger.newLine();
  
  if (options.allTables) {
    await addIndexesToAllTables(options);
    return;
  }
  
  let sql: string;
  
  if (options.dynamic) {
    // Use performance analysis
    sql = await generateIntelligentIndexes(tableName, options);
  } else {
    // Use template-based generation
    const config = await collectIndexConfig(tableName, options);
    sql = generateIndexSQL(config);
  }
  
  // Use table-folder structure
  const projectPath = process.cwd();
  const command = getCommandString();
  const timestampedSQL = appendWithTimestamp(sql, command);
  
  await writeTableSQL(projectPath, tableName, SQL_FILE_TYPES.INDEXES, timestampedSQL, true);
  
  logger.success(`✅ Index generated in: sql/schemas/${tableName}/indexes.sql`);
  displayIndexUsage(tableName, { ...options, tableName });
}

/**
 * Collect index configuration
 */
async function collectIndexConfig(tableName: string, options: any) {
  const { columns, indexType, unique } = await inquirer.prompt([
    {
      type: 'input',
      name: 'columns',
      message: 'Columns to index (comma-separated):',
      default: options.columns || 'id',
      validate: (input) => input.trim().length > 0 || 'Columns are required'
    },
    {
      type: 'list',
      name: 'indexType',
      message: 'Index type:',
      choices: [
        { name: 'B-Tree (default, good for equality and range queries)', value: 'btree' },
        { name: 'GIN (good for JSONB and full-text search)', value: 'gin' },
        { name: 'GiST (good for geometric data)', value: 'gist' },
        { name: 'Hash (good for equality only)', value: 'hash' }
      ],
      default: options.type || 'btree'
    },
    {
      type: 'confirm',
      name: 'unique',
      message: 'Create unique index?',
      default: false
    }
  ]);
  
  return {
    tableName,
    schema: options.schema,
    columns: columns.split(',').map(col => col.trim()),
    indexType,
    unique,
    output: options.output
  };
}

/**
 * Generate index SQL
 */
function generateIndexSQL(config: any): string {
  const { tableName, schema, columns, indexType, unique } = config;
  const indexName = `idx_${tableName}_${columns.join('_').replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`;
  const uniqueKeyword = unique ? 'UNIQUE ' : '';
  const columnsList = columns.join(', ');
  
  const header = `-- Index for ${tableName} on columns: ${columnsList}
-- Generated: ${new Date().toISOString()}`;
  const indexSQL = generateBasicIndexSQL(tableName, schema, columns, indexType, unique);
  
  return `${header}\n\n${indexSQL}`;
}

/**
 * Generate basic index SQL
 */
function generateBasicIndexSQL(tableName: string, schema: string, columns: string[], indexType: string, unique: boolean): string {
  const indexName = `idx_${tableName}_${columns.join('_').replace(/[^a-z0-9_]/gi, '_').toLowerCase()}`;
  const uniqueKeyword = unique ? 'UNIQUE ' : '';
  const columnsList = columns.join(', ');
  
  return `CREATE ${uniqueKeyword}INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
  ON ${schema}.${tableName} USING ${indexType} (${columnsList});

-- Add comment
COMMENT ON INDEX ${indexName} IS 'Index for PostgREST queries on ${columnsList}';

-- Performance note: CONCURRENTLY allows non-blocking index creation
-- but may take longer and requires more disk space during creation.`;
}

/**
 * Create analyze command
 */
function createAnalyzeCommand(): Command {
  const command = new Command('analyze');
  
  command
    .description('Generate index analysis queries')
    .argument('[table]', 'Table name (optional)')
    .option('--schema <name>', 'Schema name')
    .action(async (tableName, options) => {
      await generateIndexAnalysis(tableName, options);
    });
  
  return command;
}

/**
 * Generate index analysis
 */
async function generateIndexAnalysis(tableName: string, options: any) {
  logger.info(chalk.cyan('🔍 Generating Index Analysis'));
  logger.newLine();
  
  const sql = generateAnalysisSQL(tableName, options);
  
  if (tableName) {
    // Write to specific table's folder
    const projectPath = process.cwd();
    const command = getCommandString();
    const timestampedSQL = appendWithTimestamp(sql, command);
    
    await writeTableSQL(projectPath, tableName, 'analysis.sql' as any, timestampedSQL, true);
    logger.success(`✅ Analysis queries generated in: sql/schemas/${tableName}/analysis.sql`);
  } else {
    // Write to project root for global analysis
    const outputFile = './index_analysis.sql';
    await fs.writeFile(outputFile, sql);
    logger.success(`✅ Analysis queries generated: ${outputFile}`);
  }
  
  logger.info('Run these queries to analyze index usage and performance.');
}

/**
 * Generate analysis SQL
 */
function generateAnalysisSQL(tableName: string, options: any): string {
  const tableFilter = tableName ? `AND schemaname = '${options.schema}' AND tablename = '${tableName}'` : '';
  
  return `-- Index Analysis Queries
-- Generated: ${new Date().toISOString()}

-- 1. List all indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = '${options.schema}'${tableFilter}
ORDER BY tablename, indexname;

-- 2. Index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  idx_scan
FROM pg_stat_user_indexes 
WHERE schemaname = '${options.schema}'${tableFilter}
ORDER BY idx_scan DESC;

-- 3. Unused indexes (potential candidates for removal)
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan
FROM pg_stat_user_indexes 
WHERE schemaname = '${options.schema}'
  AND idx_scan = 0${tableFilter}
ORDER BY tablename, indexname;

-- 4. Index size analysis
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes 
WHERE schemaname = '${options.schema}'${tableFilter}
ORDER BY pg_relation_size(indexrelid) DESC;

-- 5. Table scan vs index scan ratio
SELECT 
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  CASE 
    WHEN seq_scan + idx_scan = 0 THEN 0
    ELSE ROUND((idx_scan::numeric / (seq_scan + idx_scan) * 100), 2)
  END AS index_scan_percentage
FROM pg_stat_user_tables 
WHERE schemaname = '${options.schema}'${tableFilter}
ORDER BY index_scan_percentage DESC;`;
}

/**
 * Generate intelligent indexes using performance analysis
 */
async function generateIntelligentIndexes(tableName: string, options: any): Promise<string> {
  try {
    const generator = new IndexGenerator(process.cwd());
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.warn('No database connection found. Using template generation.');
      const config = await collectIndexConfig(tableName, options);
      return generateIndexSQL(config);
    }
    
    logger.info(chalk.blue('🔍 Analyzing table performance and structure...'));
    
    // Analyze table for index recommendations
    const analysis = await generator.analyzeTableIndexes(tableName, connection);
    
    if (!analysis || analysis.recommendations.length === 0) {
      logger.info('No intelligent index recommendations for this table.');
      const config = await collectIndexConfig(tableName, options);
      return generateIndexSQL(config);
    }
    
    logger.success(`✅ Found ${analysis.recommendations.length} index recommendations`);
    logger.newLine();
    
    // Display recommendations
    logger.info(chalk.cyan('📋 Recommended Indexes:'));
    analysis.recommendations.forEach((rec, index) => {
      logger.info(`${index + 1}. ${chalk.green(rec.indexName)} on ${rec.columns.join(', ')}`);
      logger.info(`   Type: ${rec?.indexType?.toUpperCase()} | Reason: ${rec.reason}`);
      if (rec.impact) {
        logger.info(`   Expected impact: ${chalk.yellow(rec.impact)}`);
      }
    });
    logger.newLine();
    
    // Ask user which indexes to generate
    const { selectedIndexes } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectedIndexes',
      message: 'Select indexes to generate:',
      choices: analysis.recommendations.map((rec, index) => ({
        name: `${rec.indexName} (${rec.columns.join(', ')}) - ${rec.reason}`,
        value: index
      }))
    }]);
    
    if (selectedIndexes.length === 0) {
      logger.info('No indexes selected.');
      const config = await collectIndexConfig(tableName, options);
      return generateIndexSQL(config);
    }
    
    // Generate selected indexes
    let allSQL = `-- Intelligent indexes for ${tableName}\n`;
    allSQL += `-- Generated based on performance analysis\n`;
    allSQL += `-- Generated on ${new Date().toISOString()}\n\n`;
    
    for (const index of selectedIndexes) {
      const recommendation = analysis.recommendations[index];
      const specificSQL = generateSpecificIndexSQL(tableName, options.schema, recommendation);
      allSQL += specificSQL + '\n\n';
      logger.success(`✅ Generated index: ${recommendation.indexName}`);
    }
    
    return allSQL;
    
  } catch (error) {
    logger.warn(`⚠️  Performance analysis failed: ${error.message}`);
    logger.info('Falling back to template generation...');
    const config = await collectIndexConfig(tableName, options);
    return generateIndexSQL(config);
  }
}

/**
 * Generate specific index SQL from recommendation
 */
function generateSpecificIndexSQL(tableName: string, schema: string, recommendation: any): string {
  const { indexName, columns, indexType, unique = false, partialCondition } = recommendation;
  const uniqueKeyword = unique ? 'UNIQUE ' : '';
  const columnsList = columns.join(', ');
  const whereClause = partialCondition ? ` WHERE ${partialCondition}` : '';
  
  return `-- Index: ${indexName}
-- Reason: ${recommendation.reason}
CREATE ${uniqueKeyword}INDEX CONCURRENTLY IF NOT EXISTS ${indexName}
  ON ${schema}.${tableName} USING ${indexType} (${columnsList})${whereClause};

-- Performance comment
COMMENT ON INDEX ${indexName} IS '${recommendation.reason}';`;
}

/**
 * Add indexes to all tables based on analysis
 */
async function addIndexesToAllTables(options: any) {
  logger.info(chalk.cyan('📇 Adding recommended indexes to all tables'));
  logger.newLine();
  
  try {
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.error('Database connection required for --all-tables option');
      return;
    }
    
    const tableNames = await inspector.getTableNames(connection);
    
    if (tableNames.length === 0) {
      logger.warn('No tables found in the schema');
      return;
    }
    
    logger.info(`Found ${tableNames.length} tables: ${tableNames.join(', ')}`);
    logger.newLine();
    
    const generator = new IndexGenerator(process.cwd());
    const projectPath = process.cwd();
    const command = getCommandString();
    
    let totalRecommendations = 0;
    
    for (const tableName of tableNames) {
      try {
        logger.info(`Analyzing ${tableName}...`);
        const analysis = await generator.analyzeTableIndexes(tableName, connection);
        
        if (analysis && analysis.recommendations.length > 0) {
          let tableSQL = `-- Recommended indexes for ${tableName}\n`;
          tableSQL += `-- Generated based on performance analysis\n`;
          tableSQL += `-- Generated on ${new Date().toISOString()}\n\n`;
          
          for (const rec of analysis.recommendations) {
            const indexSQL = generateSpecificIndexSQL(tableName, options.schema, rec);
            tableSQL += indexSQL + '\n\n';
            totalRecommendations++;
          }
          
          const timestampedSQL = appendWithTimestamp(tableSQL, command);
          await writeTableSQL(projectPath, tableName, SQL_FILE_TYPES.INDEXES, timestampedSQL, true);
          
          logger.success(`✅ Generated ${analysis.recommendations.length} indexes for ${tableName} in sql/schemas/${tableName}/indexes.sql`);
        } else {
          logger.info(`ℹ️  No specific recommendations for ${tableName}`);
        }
      } catch (error) {
        logger.warn(`⚠️  Skipped ${tableName}: ${error.message}`);
      }
    }
    
    if (totalRecommendations === 0) {
      logger.warn('No index recommendations found for any tables.');
      return;
    }
    
    logger.success(`💾 Generated ${totalRecommendations} indexes saved to their respective table folders`);
    
    displayBulkIndexUsage(tableNames, totalRecommendations);
    
  } catch (error) {
    logger.error(`❌ Failed to generate bulk indexes: ${error.message}`);
  }
}

/**
 * Create suggest indexes command (NEW)
 */
function createSuggestIndexesCommand(): Command {
  const command = new Command('suggest');
  
  command
    .description('Analyze performance and suggest optimal indexes')
    .option('--schema <name>', 'Schema name')
    .action(async (options) => {
      await suggestIndexes(options);
    });
  
  return command;
}

/**
 * Suggest indexes based on performance analysis
 */
async function suggestIndexes(options: any) {
  logger.info(chalk.cyan('🔍 Analyzing database performance for index suggestions...'));
  logger.newLine();
  
  try {
    const generator = new IndexGenerator(process.cwd());
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.warn('No database connection found. Please configure your database connection.');
      return;
    }
    
    const analysis = await inspector.analyzeSchema(connection);
    const allRecommendations = new Map<string, any[]>();
    
    // Analyze each table for index recommendations
    for (const tableName of Object.keys(analysis.tables)) {
      try {
        const tableAnalysis = await generator.analyzeTableIndexes(tableName, connection);
        if (tableAnalysis && tableAnalysis.recommendations.length > 0) {
          allRecommendations.set(tableName, tableAnalysis.recommendations);
        }
      } catch (error) {
        logger.warn(`Skipped analysis for ${tableName}: ${error.message}`);
      }
    }
    
    if (allRecommendations.size === 0) {
      logger.warn('No index suggestions found. Your database might already be well-optimized.');
      return;
    }
    
    const totalRecommendations = Array.from(allRecommendations.values()).reduce((sum, arr) => sum + arr.length, 0);
    logger.success(`✅ Found ${totalRecommendations} index suggestions across ${allRecommendations.size} tables`);
    logger.newLine();
    
    // Display suggestions by table
    for (const [tableName, recommendations] of allRecommendations) {
      logger.info(chalk.cyan(`📋 ${tableName}:`));
      recommendations.forEach((rec, index) => {
        logger.info(`  ${index + 1}. ${chalk.green(rec.indexName)} on ${rec.columns.join(', ')}`);
        logger.info(`     Type: ${rec.indexType.toUpperCase()} | Reason: ${rec.reason}`);
        if (rec.impact) {
          logger.info(`     Expected impact: ${chalk.yellow(rec.impact)}`);
        }
      });
      logger.newLine();
    }
    
    // Ask user which suggestions to implement
    const { generateSuggestions } = await inquirer.prompt([{
      type: 'confirm',
      name: 'generateSuggestions',
      message: 'Generate SQL for all suggested indexes?',
      default: true
    }]);
    
    if (!generateSuggestions) {
      logger.info('Index suggestions not generated.');
      return;
    }
    
    // Generate all suggested indexes using table-folder structure
    const projectPath = process.cwd();
    const command = getCommandString();
    
    for (const [tableName, recommendations] of allRecommendations) {
      let tableSQL = `-- Suggested indexes for ${tableName}\n`;
      tableSQL += `-- Generated based on performance analysis\n`;
      tableSQL += `-- Generated on ${new Date().toISOString()}\n\n`;
      
      for (const rec of recommendations) {
        const indexSQL = generateSpecificIndexSQL(tableName, options.schema, rec);
        tableSQL += indexSQL + '\n\n';
        logger.success(`✅ Generated index: ${rec.indexName}`);
      }
      
      const timestampedSQL = appendWithTimestamp(tableSQL, command);
      await writeTableSQL(projectPath, tableName, SQL_FILE_TYPES.INDEXES, timestampedSQL, true);
      logger.success(`✅ Indexes saved to: sql/schemas/${tableName}/indexes.sql`);
    }
    
    logger.success(`💾 All ${totalRecommendations} suggested indexes saved to their respective table folders`);
    
    displayBulkIndexUsage(Array.from(allRecommendations.keys()), totalRecommendations);
    
  } catch (error) {
    logger.error(`❌ Failed to analyze performance: ${error.message}`);
  }
}

/**
 * Create analyze performance command (NEW)
 */
function createAnalyzePerformanceCommand(): Command {
  const command = new Command('performance');
  
  command
    .description('Analyze current index performance and usage')
    .option('--schema <name>', 'Schema name')
    .action(async (options) => {
      await analyzeIndexPerformance(options);
    });
  
  return command;
}

/**
 * Analyze index performance
 */
async function analyzeIndexPerformance(options: any) {
  logger.info(chalk.cyan('🔍 Analyzing index performance...'));
  logger.newLine();
  
  try {
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.warn('No database connection found. Please configure your database connection.');
      return;
    }
    
    const analysis = await inspector.analyzeSchema(connection);
    
    // Display current index status
    logger.info(chalk.cyan('📊 Current Index Status:'));
    logger.info(`📇 Total indexes: ${analysis.indexes.length}`);
    
    if (analysis.indexes.length > 0) {
      logger.info('Current indexes:');
      analysis.indexes.forEach(index => {
        logger.info(`  • ${index}`);
      });
    } else {
      logger.warn('No indexes found beyond primary keys.');
    }
    
    logger.newLine();
    
    // Analyze performance issues
    const generator = new IndexGenerator(process.cwd());
    const performanceIssues: string[] = [];
    const recommendations: string[] = [];
    
    for (const tableName of Object.keys(analysis.tables)) {
      try {
        const tableAnalysis = await generator.analyzeTableIndexes(tableName, connection);
        
        if (tableAnalysis) {
          if (tableAnalysis.missingIndexes && tableAnalysis.missingIndexes.length > 0) {
            performanceIssues.push(`${tableName}: Missing ${tableAnalysis.missingIndexes.length} recommended indexes`);
          }
          
          if (tableAnalysis.redundantIndexes && tableAnalysis.redundantIndexes.length > 0) {
            performanceIssues.push(`${tableName}: Has ${tableAnalysis.redundantIndexes.length} potentially redundant indexes`);
          }
          
          if (tableAnalysis.recommendations.length > 0) {
            recommendations.push(`${tableName}: ${tableAnalysis.recommendations.length} optimization opportunities`);
          }
        }
      } catch (error) {
        // Skip individual table errors
      }
    }
    
    if (performanceIssues.length > 0) {
      logger.info(chalk.yellow('⚠️  Performance Issues Found:'));
      performanceIssues.forEach(issue => {
        logger.info(`  • ${issue}`);
      });
    } else {
      logger.success('✅ No major performance issues detected');
    }
    
    logger.newLine();
    
    if (recommendations.length > 0) {
      logger.info(chalk.cyan('💡 Optimization Opportunities:'));
      recommendations.forEach(rec => {
        logger.info(`  • ${rec}`);
      });
      
      logger.newLine();
      logger.info(`Run ${chalk.cyan('pgrestify api features indexes suggest')} to generate specific recommendations.`);
    } else {
      logger.success('✅ No additional optimizations recommended based on current analysis.');
    }
    
  } catch (error) {
    logger.error(`❌ Failed to analyze performance: ${error.message}`);
  }
}

/**
 * Generate indexes header
 */
function generateIndexesHeader(): string {
  return `-- PostgreSQL Indexes for PostgREST Performance
-- Generated by PGRestify CLI
-- 
-- Apply these indexes to your database:
-- psql -d your_database -f indexes.sql
--
-- Indexes provide:
-- - Faster query performance
-- - Efficient RLS policy enforcement
-- - Optimized JOIN operations
-- - Reduced sequential scans`;
}

/**
 * Display index usage instructions
 */
function displayIndexUsage(tableName: string, options: any) {
  logger.newLine();
  logger.info(chalk.cyan('Usage:'));
  logger.list([
    `Apply indexes: pgrestify api migrate (or manually: psql -d your_db -f sql/schemas/${tableName}/indexes.sql)`,
    `Indexes will speed up queries on ${tableName}`,
    'CONCURRENTLY option prevents table locking',
    'Monitor query performance after applying'
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Performance Tips:'));
  logger.list([
    'Use --dynamic flag for intelligent recommendations',
    'Indexes speed up SELECTs but slow down INSERTs/UPDATEs',
    'Monitor index usage with pg_stat_user_indexes',
    'Drop unused indexes to save space',
    options.dynamic ? 'Generated with performance analysis' : 'Consider using --dynamic for smarter indexes'
  ]);
}

/**
 * Display bulk index usage
 */
function displayBulkIndexUsage(tables: string[], indexCount: number) {
  logger.newLine();
  logger.info(chalk.cyan('🚀 Generated Indexes Usage:'));
  logger.list([
    `Apply all indexes: pgrestify api migrate`,
    `${indexCount} performance indexes created for ${tables.length} tables`,
    'Indexes will improve query performance across your API'
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('📋 Tables with New Indexes:'));
  tables.forEach(table => {
    logger.info(`  • ${table} - Optimized with performance indexes (sql/schemas/${table}/indexes.sql)`);
  });
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Next Steps:'));
  logger.list([
    'Monitor query performance improvements',
    'Use EXPLAIN ANALYZE to verify index usage',
    'Consider composite indexes for complex queries',
    'Regularly analyze and maintain indexes'
  ]);
}

// Types for enhanced functionality
interface IndexRecommendation {
  indexName: string;
  columns: string[];
  indexType: string;
  reason: string;
  impact?: string;
  unique?: boolean;
  partialCondition?: string;
}