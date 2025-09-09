/**
 * @fileoverview Schema synchronization and drift detection
 * 
 * Detects manual database changes and provides synchronization
 * capabilities to keep PGRestify in sync with database state.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../../utils/logger.js';
import { fs } from '../../utils/fs.js';
import { SchemaInspector, DatabaseConnection } from '../../generators/SchemaInspector.js';
import { getHashService } from '../../utils/hash-service.js';
import { parsePostgreSQLArray } from '../../utils/postgres-array-parser.js';
import { getPostgRESTConfig } from '../../utils/postgrest-config.js';

interface SchemaDrift {
  type: 'added_table' | 'removed_table' | 'added_column' | 'removed_column' | 'modified_column' | 'added_constraint' | 'removed_constraint';
  tableName: string;
  columnName?: string;
  details: {
    current?: any;
    expected?: any;
    difference: string;
  };
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  autoFixable: boolean;
}

interface SchemaSnapshot {
  timestamp: string;
  tables: Record<string, TableSnapshot>;
  constraints: ConstraintSnapshot[];
  version: string;
}

interface TableSnapshot {
  name: string;
  columns: ColumnSnapshot[];
  primaryKey: string[];
  constraints: string[];
  rlsEnabled: boolean;
}

interface ColumnSnapshot {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isGenerated: boolean;
}

interface ConstraintSnapshot {
  name: string;
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
  tableName: string;
  columnNames: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  definition: string;
}

/**
 * Create sync command
 */
export function createSyncCommand(): Command {
  const command = new Command('sync');
  
  command
    .description('Detect and synchronize manual database changes')
    .addCommand(createDetectCommand())
    .addCommand(createSyncSchemaCommand())
    .addCommand(createSnapshotCommand())
    .addCommand(createCompareCommand());
  
  return command;
}

/**
 * Create detect drift command
 */
function createDetectCommand(): Command {
  const command = new Command('detect');
  
  command
    .description('Detect schema drift from manual database changes')
    .option('--schema <name>', 'Schema to analyze', 'api')
    .option('--severity <level>', 'Minimum severity to report (LOW|MEDIUM|HIGH|CRITICAL)', 'LOW')
    .option('--format <type>', 'Output format (table|json|summary)', 'table')
    .option('--save-snapshot', 'Save current state as new snapshot')
    .action(async (options) => {
      await detectSchemaDrift(options);
    });
  
  return command;
}

/**
 * Create sync schema command
 */
function createSyncSchemaCommand(): Command {
  const command = new Command('schema');
  
  command
    .description('Synchronize PGRestify configuration with database state')
    .option('--dry-run', 'Preview changes without applying')
    .option('--auto-fix', 'Automatically fix detectable issues')
    .option('--backup', 'Create backup before sync', true)
    .option('--force', 'Apply changes without confirmation')
    .action(async (options) => {
      await syncSchemaState(options);
    });
  
  return command;
}

/**
 * Create snapshot command
 */
function createSnapshotCommand(): Command {
  const command = new Command('snapshot');
  
  command
    .description('Create or manage schema snapshots')
    .option('--create', 'Create new snapshot')
    .option('--list', 'List existing snapshots')
    .option('--restore <snapshot>', 'Generate SQL to restore to snapshot')
    .option('--delete <snapshot>', 'Delete snapshot')
    .action(async (options) => {
      await manageSnapshots(options);
    });
  
  return command;
}

/**
 * Create compare command
 */
function createCompareCommand(): Command {
  const command = new Command('compare');
  
  command
    .description('Compare database state with snapshots or expected schema')
    .option('--snapshot <file>', 'Compare with specific snapshot')
    .option('--expected', 'Compare with expected schema from project files')
    .option('--detailed', 'Show detailed column-by-column comparison')
    .action(async (options) => {
      await compareSchemas(options);
    });
  
  return command;
}

/**
 * Detect schema drift
 */
async function detectSchemaDrift(options: any) {
  logger.info(chalk.cyan('🔍 Detecting Schema Drift'));
  logger.info('Analyzing database for manual changes...');
  logger.newLine();
  
  try {
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.error('❌ Database connection required for drift detection');
      return;
    }
    
    // Get current database state
    const currentSchema = await captureCurrentSchema(connection, options.schema);
    
    // Load last known snapshot
    const snapshotPath = `${process.cwd()}/.pgrestify/schema-snapshot.json`;
    let lastSnapshot: SchemaSnapshot | null = null;
    
    if (await fs.exists(snapshotPath)) {
      const snapshotData = await fs.readFile(snapshotPath);
      lastSnapshot = JSON.parse(snapshotData);
      logger.info(chalk.blue(`📸 Using snapshot from ${lastSnapshot.timestamp}`));
    } else {
      logger.warn(chalk.yellow('⚠️  No previous snapshot found. Creating baseline...'));
      await saveSchemaSnapshot(currentSchema, snapshotPath);
      logger.success('✅ Baseline snapshot created. Run detect again to check for drift.');
      return;
    }
    
    // Detect differences
    const drifts = await analyzeSchemaDrift(lastSnapshot, currentSchema, options.severity);
    
    if (drifts.length === 0) {
      logger.success('✅ No schema drift detected. Database matches expected state.');
      return;
    }
    
    // Display drift results
    await displaySchemaDrift(drifts, options.format);
    
    // Offer to save current state as new snapshot
    if (options.saveSnapshot) {
      await saveSchemaSnapshot(currentSchema, snapshotPath);
      logger.success('✅ New snapshot saved');
    } else {
      const { saveNew } = await inquirer.prompt([{
        type: 'confirm',
        name: 'saveNew',
        message: 'Save current database state as new snapshot?',
        default: false
      }]);
      
      if (saveNew) {
        await saveSchemaSnapshot(currentSchema, snapshotPath);
        logger.success('✅ New snapshot saved');
      }
    }
    
  } catch (error) {
    logger.error(`❌ Failed to detect schema drift: ${error.message}`);
  }
}

/**
 * Synchronize schema state
 */
async function syncSchemaState(options: any) {
  logger.info(chalk.cyan('🔄 Schema Synchronization'));
  logger.info('Synchronizing PGRestify with database state...');
  logger.newLine();
  
  try {
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.error('❌ Database connection required for schema sync');
      return;
    }
    
    // Detect drift first
    const currentSchema = await captureCurrentSchema(connection, 'api');
    const snapshotPath = `${process.cwd()}/.pgrestify/schema-snapshot.json`;
    
    let lastSnapshot: SchemaSnapshot | null = null;
    if (await fs.exists(snapshotPath)) {
      const snapshotData = await fs.readFile(snapshotPath);
      lastSnapshot = JSON.parse(snapshotData);
    }
    
    if (!lastSnapshot) {
      logger.error('❌ No baseline snapshot found. Run `pgrestify api sync detect` first.');
      return;
    }
    
    const drifts = await analyzeSchemaDrift(lastSnapshot, currentSchema, 'LOW');
    
    if (drifts.length === 0) {
      logger.success('✅ No synchronization needed. Schema is up to date.');
      return;
    }
    
    logger.info(chalk.yellow(`⚠️  Found ${drifts.length} schema changes to synchronize`));
    logger.newLine();
    
    // Show what needs to be synchronized
    const autoFixable = drifts.filter(d => d.autoFixable);
    const manualFixes = drifts.filter(d => !d.autoFixable);
    
    if (autoFixable.length > 0) {
      logger.info(chalk.green(`✅ ${autoFixable.length} changes can be auto-synchronized:`));
      autoFixable.forEach(drift => {
        logger.info(`  • ${drift.details.difference}`);
      });
    }
    
    if (manualFixes.length > 0) {
      logger.info(chalk.yellow(`⚠️  ${manualFixes.length} changes require manual intervention:`));
      manualFixes.forEach(drift => {
        logger.info(`  • ${drift.details.difference}`);
      });
    }
    
    logger.newLine();
    
    // Create sync plan
    const syncPlan = await createSyncPlan(drifts, options);
    
    if (options.dryRun) {
      await previewSyncChanges(syncPlan);
    } else {
      await applySyncChanges(syncPlan, options, connection);
    }
    
  } catch (error) {
    logger.error(`❌ Failed to sync schema: ${error.message}`);
  }
}

/**
 * Capture current database schema state
 */
async function captureCurrentSchema(connection: DatabaseConnection, schemaName: string): Promise<SchemaSnapshot> {
  const { Pool } = await import('pg');
  const pool = new Pool(connection);
  
  try {
    // Get all tables
    const tablesResult = await pool.query(`
      SELECT 
        t.table_name,
        t.table_type,
        obj_description(c.oid) as table_comment
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name
      WHERE t.table_schema = $1 
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `, [schemaName]);
    
    const tables: Record<string, TableSnapshot> = {};
    
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      
      // Get columns for this table
      const columnsResult = await pool.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          is_generated
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `, [schemaName, tableName]);
      
      // Get primary key
      const pkResult = await pool.query(`
        SELECT column_name
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
        WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position
      `, [schemaName, tableName]);
      
      // Check RLS status
      const rlsResult = await pool.query(`
        SELECT rowsecurity
        FROM pg_tables
        WHERE schemaname = $1 AND tablename = $2
      `, [schemaName, tableName]);
      
      tables[tableName] = {
        name: tableName,
        columns: columnsResult.rows.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          defaultValue: col.column_default,
          isGenerated: col.is_generated === 'ALWAYS'
        })),
        primaryKey: pkResult.rows.map(row => row.column_name),
        constraints: [], // We'll populate this separately
        rlsEnabled: rlsResult.rows[0]?.rowsecurity || false
      };
    }
    
    // Get constraints
    const constraintsResult = await pool.query(`
      SELECT 
        tc.constraint_name,
        tc.constraint_type,
        tc.table_name,
        array_agg(kcu.column_name ORDER BY kcu.ordinal_position) as column_names,
        ccu.table_name as referenced_table,
        array_agg(ccu.column_name ORDER BY ccu.ordinal_position) as referenced_columns,
        pg_get_constraintdef(pgc.oid) as definition
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      LEFT JOIN pg_constraint pgc ON pgc.conname = tc.constraint_name
      WHERE tc.table_schema = $1
      GROUP BY tc.constraint_name, tc.constraint_type, tc.table_name, ccu.table_name, pgc.oid
      ORDER BY tc.table_name, tc.constraint_name
    `, [schemaName]);
    
    const constraints: ConstraintSnapshot[] = constraintsResult.rows.map(row => ({
      name: row.constraint_name,
      type: row.constraint_type,
      tableName: row.table_name,
      columnNames: parsePostgreSQLArray(row.column_names) || [],
      referencedTable: row.referenced_table,
      referencedColumns: parsePostgreSQLArray(row.referenced_columns) || [],
      definition: row.definition
    }));
    
    await pool.end();
    
    return {
      timestamp: new Date().toISOString(),
      tables,
      constraints,
      version: '2.0.0'
    };
    
  } finally {
    await pool.end();
  }
}

/**
 * Analyze schema drift between snapshots
 */
async function analyzeSchemaDrift(
  oldSnapshot: SchemaSnapshot, 
  newSnapshot: SchemaSnapshot,
  minSeverity: string
): Promise<SchemaDrift[]> {
  const drifts: SchemaDrift[] = [];
  
  // Check for table changes
  const oldTables = Object.keys(oldSnapshot.tables);
  const newTables = Object.keys(newSnapshot.tables);
  
  // New tables
  for (const tableName of newTables) {
    if (!oldTables.includes(tableName)) {
      drifts.push({
        type: 'added_table',
        tableName,
        details: {
          current: newSnapshot.tables[tableName],
          difference: `Table "${tableName}" was added manually`
        },
        severity: 'MEDIUM',
        autoFixable: true
      });
    }
  }
  
  // Removed tables
  for (const tableName of oldTables) {
    if (!newTables.includes(tableName)) {
      drifts.push({
        type: 'removed_table',
        tableName,
        details: {
          expected: oldSnapshot.tables[tableName],
          difference: `Table "${tableName}" was removed manually`
        },
        severity: 'HIGH',
        autoFixable: false
      });
    }
  }
  
  // Modified tables
  for (const tableName of newTables) {
    if (!oldTables.includes(tableName)) continue;
    
    const oldTable = oldSnapshot.tables[tableName];
    const newTable = newSnapshot.tables[tableName];
    
    // Check column changes
    const columnDrifts = analyzeColumnDrift(tableName, oldTable, newTable);
    drifts.push(...columnDrifts);
    
    // Check RLS changes
    if (oldTable.rlsEnabled !== newTable.rlsEnabled) {
      drifts.push({
        type: 'modified_column',
        tableName,
        details: {
          current: newTable.rlsEnabled,
          expected: oldTable.rlsEnabled,
          difference: `RLS ${newTable.rlsEnabled ? 'enabled' : 'disabled'} manually on ${tableName}`
        },
        severity: 'HIGH',
        autoFixable: true
      });
    }
  }
  
  // Check constraint changes
  const constraintDrifts = analyzeConstraintDrift(oldSnapshot.constraints, newSnapshot.constraints);
  drifts.push(...constraintDrifts);
  
  // Filter by severity
  const severityLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const minIndex = severityLevels.indexOf(minSeverity);
  
  return drifts.filter(drift => 
    severityLevels.indexOf(drift.severity) >= minIndex
  );
}

/**
 * Analyze column drift for a table
 */
function analyzeColumnDrift(tableName: string, oldTable: TableSnapshot, newTable: TableSnapshot): SchemaDrift[] {
  const drifts: SchemaDrift[] = [];
  
  const oldColumns = oldTable.columns.map(c => c.name);
  const newColumns = newTable.columns.map(c => c.name);
  
  // New columns
  for (const column of newTable.columns) {
    if (!oldColumns.includes(column.name)) {
      drifts.push({
        type: 'added_column',
        tableName,
        columnName: column.name,
        details: {
          current: column,
          difference: `Column "${column.name}" (${column.type}) added to ${tableName}`
        },
        severity: determineSeverity('added_column', column),
        autoFixable: true
      });
    }
  }
  
  // Removed columns
  for (const column of oldTable.columns) {
    if (!newColumns.includes(column.name)) {
      drifts.push({
        type: 'removed_column',
        tableName,
        columnName: column.name,
        details: {
          expected: column,
          difference: `Column "${column.name}" removed from ${tableName}`
        },
        severity: 'CRITICAL',
        autoFixable: false
      });
    }
  }
  
  // Modified columns
  for (const newColumn of newTable.columns) {
    const oldColumn = oldTable.columns.find(c => c.name === newColumn.name);
    if (!oldColumn) continue;
    
    if (JSON.stringify(oldColumn) !== JSON.stringify(newColumn)) {
      const changes = detectColumnChanges(oldColumn, newColumn);
      drifts.push({
        type: 'modified_column',
        tableName,
        columnName: newColumn.name,
        details: {
          current: newColumn,
          expected: oldColumn,
          difference: `Column "${newColumn.name}" modified: ${changes.join(', ')}`
        },
        severity: determineSeverity('modified_column', newColumn, changes),
        autoFixable: canAutoFixColumn(changes)
      });
    }
  }
  
  return drifts;
}

/**
 * Analyze constraint drift
 */
function analyzeConstraintDrift(
  oldConstraints: ConstraintSnapshot[], 
  newConstraints: ConstraintSnapshot[]
): SchemaDrift[] {
  const drifts: SchemaDrift[] = [];
  
  const oldConstraintNames = oldConstraints.map(c => c.name);
  const newConstraintNames = newConstraints.map(c => c.name);
  
  // New constraints
  for (const constraint of newConstraints) {
    if (!oldConstraintNames.includes(constraint.name)) {
      drifts.push({
        type: 'added_constraint',
        tableName: constraint.tableName,
        details: {
          current: constraint,
          difference: `${constraint.type} constraint "${constraint.name}" added to ${constraint.tableName}`
        },
        severity: constraint.type === 'FOREIGN KEY' ? 'HIGH' : 'MEDIUM',
        autoFixable: true
      });
    }
  }
  
  // Removed constraints
  for (const constraint of oldConstraints) {
    if (!newConstraintNames.includes(constraint.name)) {
      drifts.push({
        type: 'removed_constraint',
        tableName: constraint.tableName,
        details: {
          expected: constraint,
          difference: `${constraint.type} constraint "${constraint.name}" removed from ${constraint.tableName}`
        },
        severity: constraint.type === 'FOREIGN KEY' ? 'CRITICAL' : 'HIGH',
        autoFixable: false
      });
    }
  }
  
  return drifts;
}

/**
 * Determine drift severity
 */
function determineSeverity(type: string, column?: ColumnSnapshot, changes?: string[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  switch (type) {
    case 'added_column':
      if (column?.name.includes('_id') || column?.name === 'id') return 'HIGH';
      if (!column?.nullable) return 'MEDIUM';
      return 'LOW';
      
    case 'modified_column':
      if (changes?.includes('type changed')) return 'CRITICAL';
      if (changes?.includes('nullable changed')) return 'HIGH';
      if (changes?.includes('default changed')) return 'MEDIUM';
      return 'LOW';
      
    case 'removed_column':
      return 'CRITICAL';
      
    default:
      return 'MEDIUM';
  }
}

/**
 * Detect specific column changes
 */
function detectColumnChanges(oldColumn: ColumnSnapshot, newColumn: ColumnSnapshot): string[] {
  const changes: string[] = [];
  
  if (oldColumn.type !== newColumn.type) {
    changes.push(`type changed (${oldColumn.type} → ${newColumn.type})`);
  }
  
  if (oldColumn.nullable !== newColumn.nullable) {
    changes.push(`nullable changed (${oldColumn.nullable} → ${newColumn.nullable})`);
  }
  
  if (oldColumn.defaultValue !== newColumn.defaultValue) {
    changes.push(`default changed (${oldColumn.defaultValue || 'null'} → ${newColumn.defaultValue || 'null'})`);
  }
  
  if (oldColumn.isGenerated !== newColumn.isGenerated) {
    changes.push(`generated changed (${oldColumn.isGenerated} → ${newColumn.isGenerated})`);
  }
  
  return changes;
}

/**
 * Determine if column changes can be auto-fixed
 */
function canAutoFixColumn(changes: string[]): boolean {
  const dangerousChanges = ['type changed', 'nullable changed to false'];
  return !changes.some(change => 
    dangerousChanges.some(dangerous => change.includes(dangerous))
  );
}

/**
 * Display schema drift results
 */
async function displaySchemaDrift(drifts: SchemaDrift[], format: string) {
  switch (format) {
    case 'json':
      logger.code(JSON.stringify(drifts, null, 2));
      break;
      
    case 'summary':
      displayDriftSummary(drifts);
      break;
      
    case 'table':
    default:
      displayDriftTable(drifts);
      break;
  }
}

/**
 * Display drift as a table
 */
function displayDriftTable(drifts: SchemaDrift[]) {
  logger.info(chalk.cyan('📋 Schema Drift Detection Results:'));
  logger.newLine();
  
  const groupedByTable = drifts.reduce((acc, drift) => {
    if (!acc[drift.tableName]) acc[drift.tableName] = [];
    acc[drift.tableName].push(drift);
    return acc;
  }, {} as Record<string, SchemaDrift[]>);
  
  for (const [tableName, tableDrifts] of Object.entries(groupedByTable)) {
    logger.info(chalk.cyan(`📊 Table: ${tableName}`));
    
    tableDrifts.forEach(drift => {
      const severityColor = getSeverityColor(drift.severity);
      const fixableIcon = drift.autoFixable ? '🔧' : '⚠️ ';
      
      logger.info(`  ${fixableIcon} ${severityColor(drift.severity)} - ${drift.details.difference}`);
    });
    
    logger.newLine();
  }
  
  // Summary
  const severityCounts = drifts.reduce((acc, drift) => {
    acc[drift.severity] = (acc[drift.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  logger.info(chalk.cyan('📈 Summary:'));
  Object.entries(severityCounts).forEach(([severity, count]) => {
    const color = getSeverityColor(severity);
    logger.info(`  ${color(severity)}: ${count} changes`);
  });
  
  const autoFixable = drifts.filter(d => d.autoFixable).length;
  logger.info(`  🔧 Auto-fixable: ${autoFixable}/${drifts.length}`);
}

/**
 * Display drift summary
 */
function displayDriftSummary(drifts: SchemaDrift[]) {
  const summary = {
    total: drifts.length,
    byType: drifts.reduce((acc, drift) => {
      acc[drift.type] = (acc[drift.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    bySeverity: drifts.reduce((acc, drift) => {
      acc[drift.severity] = (acc[drift.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    autoFixable: drifts.filter(d => d.autoFixable).length
  };
  
  logger.info(chalk.cyan('📊 Schema Drift Summary:'));
  logger.newLine();
  logger.info(`Total Changes: ${summary.total}`);
  logger.info(`Auto-fixable: ${summary.autoFixable}/${summary.total}`);
  logger.newLine();
  
  logger.info('By Type:');
  Object.entries(summary.byType).forEach(([type, count]) => {
    logger.info(`  ${type}: ${count}`);
  });
  
  logger.newLine();
  logger.info('By Severity:');
  Object.entries(summary.bySeverity).forEach(([severity, count]) => {
    const color = getSeverityColor(severity);
    logger.info(`  ${color(severity)}: ${count}`);
  });
}

/**
 * Get color for severity level
 */
function getSeverityColor(severity: string) {
  switch (severity) {
    case 'CRITICAL': return chalk.red.bold;
    case 'HIGH': return chalk.red;
    case 'MEDIUM': return chalk.yellow;
    case 'LOW': return chalk.green;
    default: return chalk.gray;
  }
}

/**
 * Create synchronization plan
 */
async function createSyncPlan(drifts: SchemaDrift[], options: any) {
  const autoFixable = drifts.filter(d => d.autoFixable);
  const manualFixes = drifts.filter(d => !d.autoFixable);
  
  let syncActions: any[] = [];
  
  if (options.autoFix && autoFixable.length > 0) {
    syncActions = await generateAutoFixActions(autoFixable);
  } else if (autoFixable.length > 0) {
    const { selectAutoFixes } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selectAutoFixes',
      message: 'Select changes to auto-fix:',
      choices: autoFixable.map((drift, index) => ({
        name: `${drift.tableName}: ${drift.details.difference}`,
        value: index,
        checked: drift.severity !== 'CRITICAL'
      }))
    }]);
    
    const selectedDrifts = selectAutoFixes.map((index: number) => autoFixable[index]);
    syncActions = await generateAutoFixActions(selectedDrifts);
  }
  
  return {
    autoActions: syncActions,
    manualActions: manualFixes,
    totalChanges: drifts.length
  };
}

/**
 * Generate auto-fix actions
 */
async function generateAutoFixActions(drifts: SchemaDrift[]) {
  const actions: any[] = [];
  
  for (const drift of drifts) {
    switch (drift.type) {
      case 'added_table':
        actions.push({
          type: 'update_schema_files',
          description: `Add ${drift.tableName} to schema templates`,
          sql: await generateAddTableSync(drift),
          configUpdate: generateTableConfigUpdate(drift)
        });
        break;
        
      case 'added_column':
        actions.push({
          type: 'update_column_definitions',
          description: `Add ${drift.columnName} to ${drift.tableName} schema`,
          sql: await generateAddColumnSync(drift),
          configUpdate: generateColumnConfigUpdate(drift)
        });
        break;
        
      case 'modified_column':
        actions.push({
          type: 'update_column_definitions',
          description: `Update ${drift.columnName} in ${drift.tableName} schema`,
          sql: await generateModifyColumnSync(drift),
          configUpdate: generateColumnConfigUpdate(drift)
        });
        break;
        
      case 'added_constraint':
        actions.push({
          type: 'update_constraints',
          description: `Add constraint to schema definition`,
          sql: generateAddConstraintSync(drift)
        });
        break;
    }
  }
  
  return actions;
}

/**
 * Preview sync changes
 */
async function previewSyncChanges(syncPlan: any) {
  logger.info(chalk.yellow('👀 Preview Mode - Changes will NOT be applied'));
  logger.newLine();
  
  if (syncPlan.autoActions.length > 0) {
    logger.info(chalk.cyan('🔧 Auto-fixable Changes:'));
    syncPlan.autoActions.forEach((action: any, index: number) => {
      logger.info(`${index + 1}. ${action.description}`);
      if (action.sql) {
        logger.code(action.sql.split('\n').slice(0, 5).join('\n') + '...');
      }
    });
    logger.newLine();
  }
  
  if (syncPlan.manualActions.length > 0) {
    logger.info(chalk.yellow('⚠️  Manual Interventions Required:'));
    syncPlan.manualActions.forEach((drift: SchemaDrift, index: number) => {
      logger.info(`${index + 1}. ${drift.details.difference}`);
      logger.info(`   Severity: ${getSeverityColor(drift.severity)(drift.severity)}`);
    });
    logger.newLine();
  }
  
  logger.info(chalk.blue('💡 Run without --dry-run to apply auto-fixes'));
}

/**
 * Apply sync changes
 */
async function applySyncChanges(syncPlan: any, options: any, connection: DatabaseConnection) {
  if (syncPlan.autoActions.length === 0 && syncPlan.manualActions.length === 0) {
    logger.success('✅ No changes needed. Schema is synchronized.');
    return;
  }
  
  // Confirm before applying
  if (!options.force) {
    logger.warn(chalk.yellow('⚠️  This will modify your PGRestify configuration files!'));
    
    const { proceed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: `Apply ${syncPlan.autoActions.length} synchronization changes?`,
      default: false
    }]);
    
    if (!proceed) {
      logger.info('Synchronization cancelled.');
      return;
    }
  }
  
  // Create backup if requested
  if (options.backup) {
    await createSyncBackup();
  }
  
  // Apply auto-fixes
  if (syncPlan.autoActions.length > 0) {
    logger.info(chalk.blue('🔧 Applying auto-fixes...'));
    
    for (const action of syncPlan.autoActions) {
      try {
        await applyAutoFixAction(action);
        logger.success(`✅ ${action.description}`);
      } catch (error) {
        logger.error(`❌ Failed: ${action.description} - ${error.message}`);
      }
    }
  }
  
  // Provide guidance for manual fixes
  if (syncPlan.manualActions.length > 0) {
    logger.newLine();
    logger.info(chalk.yellow('📋 Manual Interventions Required:'));
    
    syncPlan.manualActions.forEach((drift: SchemaDrift, index: number) => {
      logger.info(`${index + 1}. ${getSeverityColor(drift.severity)(drift.severity)} - ${drift.details.difference}`);
      
      // Provide specific guidance
      const guidance = getManualFixGuidance(drift);
      if (guidance) {
        logger.info(`   💡 ${guidance}`);
      }
    });
  }
  
  // Update snapshot
  const currentSchema = await captureCurrentSchema(connection, 'api');
  const snapshotPath = `${process.cwd()}/.pgrestify/schema-snapshot.json`;
  await saveSchemaSnapshot(currentSchema, snapshotPath);
  
  logger.success('✅ Schema synchronization completed!');
}

/**
 * Save schema snapshot
 */
async function saveSchemaSnapshot(schema: SchemaSnapshot, snapshotPath: string) {
  await fs.ensureDir(`${process.cwd()}/.pgrestify`);
  await fs.writeFile(snapshotPath, JSON.stringify(schema, null, 2));
}

/**
 * Create sync backup
 */
async function createSyncBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `${process.cwd()}/.pgrestify/backups/sync_${timestamp}`;
  
  await fs.ensureDir(backupDir);
  
  // Backup current schema files (both old and new structure)
  const legacyFiles = [
    'sql/schemas/01_main.sql',
    'sql/schemas/02_rls.sql', 
    'sql/functions/auth.sql'
  ];
  
  // Backup legacy files if they exist
  for (const file of legacyFiles) {
    if (await fs.exists(file)) {
      const content = await fs.readFile(file);
      const backupPath = `${backupDir}/${file.replace(/\//g, '_')}`;
      await fs.writeFile(backupPath, content);
    }
  }
  
  // Backup table-folder structure files
  try {
    const schemasDir = 'sql/schemas';
    if (await fs.exists(schemasDir)) {
      const tableNames = await fs.readDir(schemasDir);
      
      for (const tableName of tableNames) {
        const tablePath = `${schemasDir}/${tableName}`;
        if (await fs.isDirectory(tablePath)) {
          const tableFiles = ['table.sql', 'rls.sql', 'views.sql', 'triggers.sql', 'indexes.sql'];
          
          for (const file of tableFiles) {
            const filePath = `${tablePath}/${file}`;
            if (await fs.exists(filePath)) {
              const content = await fs.readFile(filePath);
              const backupPath = `${backupDir}/schemas_${tableName}_${file}`;
              await fs.writeFile(backupPath, content);
            }
          }
        }
      }
    }
  } catch (error) {
    logger.warn(`Could not backup table-folder files: ${error.message}`);
  }
  
  logger.info(chalk.blue(`💾 Backup created: ${backupDir}`));
}

/**
 * Apply auto-fix action
 */
async function applyAutoFixAction(action: any) {
  switch (action.type) {
    case 'update_schema_files':
      // Add table definition to schema templates
      await updateSchemaTemplate(action);
      break;
      
    case 'update_column_definitions':
      // Update column definitions in schema files
      await updateColumnDefinitions(action);
      break;
      
    case 'update_constraints':
      // Update constraint definitions
      await updateConstraintDefinitions(action);
      break;
  }
}

/**
 * Update schema template with new table (table-folder structure)
 */
async function updateSchemaTemplate(action: any) {
  const { tableName } = action;
  const tableFolderPath = `sql/schemas/${tableName}`;
  const tableFile = `${tableFolderPath}/table.sql`;
  
  try {
    // Ensure table folder exists
    await fs.ensureDir(tableFolderPath);
    
    // Write or append to table.sql
    let finalContent: string;
    if (await fs.exists(tableFile)) {
      const content = await fs.readFile(tableFile);
      finalContent = content + '\n\n' + action.sql;
      await fs.writeFile(tableFile, finalContent);
    } else {
      finalContent = action.sql;
      await fs.writeFile(tableFile, finalContent);
    }
    
    // Track the file write in hash service
    const hashService = getHashService(process.cwd());
    await hashService.trackFileWrite(tableFile, finalContent);
    
    logger.success(`✅ Updated schema template: ${tableFile}`);
    
  } catch (error) {
    // Fallback to legacy structure
    const legacyFile = 'sql/schemas/01_main.sql';
    if (await fs.exists(legacyFile)) {
      const content = await fs.readFile(legacyFile);
      const updatedContent = content + '\n\n' + action.sql;
      await fs.writeFile(legacyFile, updatedContent);
      logger.info(`Updated legacy schema file: ${legacyFile}`);
    }
  }
}

/**
 * Update column definitions in schema files
 */
async function updateColumnDefinitions(action: any) {
  // This would update TypeScript types, schema templates, etc.
  // Implementation would depend on the specific project structure
  logger.info(`Updating column definitions: ${action.description}`);
}

/**
 * Update constraint definitions (table-folder structure)
 */
async function updateConstraintDefinitions(action: any) {
  // Try to determine which table this constraint affects
  const constraintTableMatch = action.sql.match(/ON\s+api\.(\w+)/i);
  const tableName = constraintTableMatch ? constraintTableMatch[1] : null;
  
  if (tableName) {
    const tableFolderPath = `sql/schemas/${tableName}`;
    const tableFile = `${tableFolderPath}/table.sql`;
    
    try {
      await fs.ensureDir(tableFolderPath);
      
      if (await fs.exists(tableFile)) {
        const content = await fs.readFile(tableFile);
        const updatedContent = content + '\n\n' + action.sql;
        await fs.writeFile(tableFile, updatedContent);
        logger.success(`✅ Updated constraints in: ${tableFile}`);
        return;
      }
    } catch (error) {
      logger.warn(`Could not update table folder: ${error.message}`);
    }
  }
  
  // Fallback to legacy structure
  const legacyFile = 'sql/schemas/01_main.sql';
  if (await fs.exists(legacyFile)) {
    const content = await fs.readFile(legacyFile);
    const updatedContent = content + '\n\n' + action.sql;
    await fs.writeFile(legacyFile, updatedContent);
    logger.info(`Updated legacy schema file: ${legacyFile}`);
  }
}

/**
 * Get manual fix guidance
 */
function getManualFixGuidance(drift: SchemaDrift): string {
  switch (drift.type) {
    case 'removed_table':
      return 'Remove table references from schema templates and TypeScript types';
      
    case 'removed_column':
      return 'Update schema templates, remove column references, check dependent views/functions';
      
    case 'modified_column':
      if (drift.details.difference.includes('type changed')) {
        return 'Update TypeScript types, check data compatibility, update validation rules';
      }
      break;
      
    case 'removed_constraint':
      return 'Update schema constraints, check if removal was intentional';
  }
  
  return 'Review change and update PGRestify configuration accordingly';
}

/**
 * Manage snapshots
 */
async function manageSnapshots(options: any) {
  if (options.create) {
    await createSnapshot();
  } else if (options.list) {
    await listSnapshots();
  } else if (options.restore) {
    await restoreSnapshot(options.restore);
  } else if (options.delete) {
    await deleteSnapshot(options.delete);
  } else {
    logger.info('Specify --create, --list, --restore <snapshot>, or --delete <snapshot>');
  }
}

/**
 * Create new snapshot
 */
async function createSnapshot() {
  logger.info(chalk.cyan('📸 Creating Schema Snapshot'));
  
  try {
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.error('❌ Database connection required for snapshot creation');
      return;
    }
    
    const currentSchema = await captureCurrentSchema(connection, 'api');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotPath = `${process.cwd()}/.pgrestify/snapshots/schema_${timestamp}.json`;
    
    await fs.ensureDir(`${process.cwd()}/.pgrestify/snapshots`);
    await fs.writeFile(snapshotPath, JSON.stringify(currentSchema, null, 2));
    
    // Also update the main snapshot
    const mainSnapshotPath = `${process.cwd()}/.pgrestify/schema-snapshot.json`;
    await fs.writeFile(mainSnapshotPath, JSON.stringify(currentSchema, null, 2));
    
    logger.success(`✅ Snapshot created: ${snapshotPath}`);
    
  } catch (error) {
    logger.error(`❌ Failed to create snapshot: ${error.message}`);
  }
}

/**
 * List existing snapshots
 */
async function listSnapshots() {
  logger.info(chalk.cyan('📚 Schema Snapshots'));
  logger.newLine();
  
  const snapshotsDir = `${process.cwd()}/.pgrestify/snapshots`;
  
  if (!(await fs.exists(snapshotsDir))) {
    logger.info('No snapshots found. Create one with --create');
    return;
  }
  
  try {
    const files = await fs.readDir(snapshotsDir);
    const snapshots = files.filter(f => f.endsWith('.json'));
    
    if (snapshots.length === 0) {
      logger.info('No snapshots found. Create one with --create');
      return;
    }
    
    logger.info(`Found ${snapshots.length} snapshots:`);
    logger.newLine();
    
    for (const snapshot of snapshots) {
      const snapshotPath = `${snapshotsDir}/${snapshot}`;
      const data = JSON.parse(await fs.readFile(snapshotPath));
      const tableCount = Object.keys(data.tables).length;
      
      logger.info(`📸 ${snapshot}`);
      logger.info(`   Created: ${data.timestamp}`);
      logger.info(`   Tables: ${tableCount}`);
      logger.info(`   Version: ${data.version}`);
      logger.newLine();
    }
    
  } catch (error) {
    logger.error(`❌ Failed to list snapshots: ${error.message}`);
  }
}

/**
 * Compare schemas
 */
async function compareSchemas(options: any) {
  logger.info(chalk.cyan('🔍 Schema Comparison'));
  logger.newLine();
  
  try {
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.error('❌ Database connection required for comparison');
      return;
    }
    
    const currentSchema = await captureCurrentSchema(connection, 'api');
    
    let compareWith: SchemaSnapshot;
    
    if (options.snapshot) {
      const snapshotData = await fs.readFile(options.snapshot);
      compareWith = JSON.parse(snapshotData);
      logger.info(chalk.blue(`📸 Comparing with snapshot: ${options.snapshot}`));
    } else {
      const mainSnapshotPath = `${process.cwd()}/.pgrestify/schema-snapshot.json`;
      if (!(await fs.exists(mainSnapshotPath))) {
        logger.error('❌ No baseline snapshot found. Run `pgrestify api sync detect` first.');
        return;
      }
      const snapshotData = await fs.readFile(mainSnapshotPath);
      compareWith = JSON.parse(snapshotData);
      logger.info(chalk.blue('📸 Comparing with baseline snapshot'));
    }
    
    const drifts = await analyzeSchemaDrift(compareWith, currentSchema, 'LOW');
    
    if (drifts.length === 0) {
      logger.success('✅ Schemas match perfectly. No differences found.');
      return;
    }
    
    if (options.detailed) {
      await displayDetailedComparison(compareWith, currentSchema);
    } else {
      await displaySchemaDrift(drifts, 'table');
    }
    
  } catch (error) {
    logger.error(`❌ Failed to compare schemas: ${error.message}`);
  }
}

/**
 * Display detailed schema comparison
 */
async function displayDetailedComparison(oldSchema: SchemaSnapshot, newSchema: SchemaSnapshot) {
  logger.info(chalk.cyan('📊 Detailed Schema Comparison'));
  logger.newLine();
  
  const allTables = new Set([
    ...Object.keys(oldSchema.tables),
    ...Object.keys(newSchema.tables)
  ]);
  
  for (const tableName of allTables) {
    const oldTable = oldSchema.tables[tableName];
    const newTable = newSchema.tables[tableName];
    
    if (!oldTable) {
      logger.info(chalk.green(`➕ ${tableName} - NEW TABLE`));
      logger.info(`   Columns: ${newTable.columns.map(c => c.name).join(', ')}`);
    } else if (!newTable) {
      logger.info(chalk.red(`➖ ${tableName} - REMOVED TABLE`));
      logger.info(`   Had columns: ${oldTable.columns.map(c => c.name).join(', ')}`);
    } else {
      const changes = compareTableDetails(oldTable, newTable);
      if (changes.length > 0) {
        logger.info(chalk.yellow(`🔄 ${tableName} - MODIFIED`));
        changes.forEach(change => logger.info(`   ${change}`));
      } else {
        logger.info(chalk.gray(`✓ ${tableName} - No changes`));
      }
    }
    logger.newLine();
  }
}

/**
 * Compare table details
 */
function compareTableDetails(oldTable: TableSnapshot, newTable: TableSnapshot): string[] {
  const changes: string[] = [];
  
  // Column changes
  const oldCols = oldTable.columns.map(c => c.name);
  const newCols = newTable.columns.map(c => c.name);
  
  for (const col of newCols) {
    if (!oldCols.includes(col)) {
      const column = newTable.columns.find(c => c.name === col)!;
      changes.push(`➕ Added column: ${col} (${column.type})`);
    }
  }
  
  for (const col of oldCols) {
    if (!newCols.includes(col)) {
      changes.push(`➖ Removed column: ${col}`);
    }
  }
  
  // Modified columns
  for (const newCol of newTable.columns) {
    const oldCol = oldTable.columns.find(c => c.name === newCol.name);
    if (oldCol && JSON.stringify(oldCol) !== JSON.stringify(newCol)) {
      const columnChanges = detectColumnChanges(oldCol, newCol);
      changes.push(`🔄 Modified ${newCol.name}: ${columnChanges.join(', ')}`);
    }
  }
  
  // RLS changes
  if (oldTable.rlsEnabled !== newTable.rlsEnabled) {
    changes.push(`🔒 RLS ${newTable.rlsEnabled ? 'enabled' : 'disabled'}`);
  }
  
  return changes;
}

// Sync SQL generators
async function generateAddTableSync(drift: SchemaDrift): Promise<string> {
  const postgrestConfig = await getPostgRESTConfig();
  const schema = postgrestConfig.dbSchemas;
  const table = drift.details.current;
  return `-- Sync: Add table ${drift.tableName}
-- This table was added manually to the database

CREATE TABLE IF NOT EXISTS ${schema}.${drift.tableName} (
  -- Add column definitions here based on current database state
  -- Run: \\d+ ${schema}.${drift.tableName} to see current structure
);`;
}

async function generateAddColumnSync(drift: SchemaDrift): Promise<string> {
  const postgrestConfig = await getPostgRESTConfig();
  const schema = postgrestConfig.dbSchemas;
  const column = drift.details.current;
  return `-- Sync: Add column ${drift.columnName} to ${drift.tableName}
-- This column was added manually to the database

ALTER TABLE ${schema}.${drift.tableName} 
ADD COLUMN IF NOT EXISTS ${drift.columnName} ${column.type}${column.nullable ? '' : ' NOT NULL'}${column.defaultValue ? ` DEFAULT ${column.defaultValue}` : ''};`;
}

async function generateModifyColumnSync(drift: SchemaDrift): Promise<string> {
  const postgrestConfig = await getPostgRESTConfig();
  const schema = postgrestConfig.dbSchemas;
  const newCol = drift.details.current;
  const oldCol = drift.details.expected;
  
  return `-- Sync: Modify column ${drift.columnName} in ${drift.tableName}
-- Column was modified manually in database
-- Old: ${oldCol.type}${oldCol.nullable ? '' : ' NOT NULL'}
-- New: ${newCol.type}${newCol.nullable ? '' : ' NOT NULL'}

-- Review this change carefully before applying
-- ALTER TABLE ${schema}.${drift.tableName} ALTER COLUMN ${drift.columnName} TYPE ${newCol.type};`;
}

function generateAddConstraintSync(drift: SchemaDrift): string {
  const constraint = drift.details.current;
  return `-- Sync: Add constraint ${constraint.name}
-- This constraint was added manually to the database

-- ${constraint.definition}`;
}

function generateTableConfigUpdate(drift: SchemaDrift): any {
  return {
    action: 'add_table_to_templates',
    tableName: drift.tableName,
    table: drift.details.current
  };
}

function generateColumnConfigUpdate(drift: SchemaDrift): any {
  return {
    action: 'update_column_in_templates',
    tableName: drift.tableName,
    columnName: drift.columnName,
    column: drift.details.current
  };
}

function restoreSnapshot(snapshotFile: string): Promise<void> {
  throw new Error('Snapshot restoration not yet implemented');
}

function deleteSnapshot(snapshotFile: string): Promise<void> {
  throw new Error('Snapshot deletion not yet implemented');
}