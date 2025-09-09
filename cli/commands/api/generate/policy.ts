/**
 * @fileoverview Generate RLS policies using intelligent analysis
 * 
 * Creates Row Level Security policies based on database schema analysis,
 * ownership pattern detection, and security best practices.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../../../utils/logger.js';
import { fs } from '../../../utils/fs.js';
import { PolicyGenerator, PolicyConfig } from '../../../generators/PolicyGenerator.js';
import { SchemaInspector, type DatabaseConnection, type PolicyInfo } from '../../../generators/SchemaInspector.js';
import { writeTableSQL, SQL_FILE_TYPES, appendWithTimestamp, getCommandString } from '../../../utils/sql-structure.js';
import { deduplicateSQL } from '../../../utils/deduplication.js';
import { getPostgRESTConfig } from '../../../utils/postgrest-config.js';

/**
 * Create policy generation command
 */
export function createPolicyCommand(): Command {
  const command = new Command('policy');
  
  command
    .description('Generate RLS policies with intelligent ownership detection')
    .argument('<table>', 'Table name for policy generation')
    .option('--schema <name>', 'Schema name (default: from postgrest.conf db-schemas)')
    .option('--pattern <type>', 'Policy pattern (user_specific|public_read|admin_only|custom)', 'auto-detect')
    .option('--owner-column <column>', 'Column that identifies record ownership')
    .option('--policy <name>', 'Update specific policy by name (replaces only that policy)')
    .option('--all-tables', 'Generate policies for all tables')
    .option('--enable-rls', 'Enable RLS on tables that don\'t have it')
    .option('--disable-rls', 'Disable RLS on specified tables (use with caution)')
    .option('--replace', 'Replace all existing policies (default: preserve existing)')
    .option('--merge', 'Merge with existing policies (default behavior)')
    .option('--dry-run', 'Preview changes without writing files')
    .option('--force', 'Apply changes without confirmation')
    .action(async (tableName, options) => {
      await generatePolicy(tableName, options);
    });
  
  return command;
}

/**
 * Generate RLS policy for table
 */
async function generatePolicy(tableName: string, options: any) {
  logger.info(chalk.cyan(`🛡️  Generating RLS Policy for ${tableName}`));
  
  // Show stateful behavior info
  if (!options.replace) {
    logger.info(chalk.gray('💾 Existing policies will be preserved (use --replace to override)'));
  }
  logger.newLine();
  
  if (options.allTables) {
    await generatePoliciesForAllTables(options);
    return;
  }
  
  try {
    const generator = new PolicyGenerator(process.cwd());
    const inspector = new SchemaInspector(process.cwd());
    const connection = await inspector.extractDatabaseConnection();
    
    if (!connection) {
      logger.warn('No database connection found. Using template generation.');
      const config = await collectPolicyConfigTemplate(tableName, options);
      const sql = await generator.generatePolicies(config);
      
      if (options.dryRun) {
        await previewPolicyChanges(sql, tableName, options);
        return;
      }
      
      await writePolicyToTable(sql, tableName, options);
      await displayPolicyUsage(tableName, { ...options, tableName });
      return;
    }
    
    // Use schema from connection config if not provided as option
    if (!options.schema) {
      options.schema = connection.schema;
    }
    
    logger.info(`ℹ Using schema: ${options.schema}`);
    logger.info(chalk.blue('🔍 Analyzing table structure and ownership patterns...'));
    
    // Handle RLS enable/disable requests
    if (options.enableRls || options.disableRls) {
      await handleRLSStateChange(tableName, options, connection, inspector);
    }
    
    // Check for existing policies first (stateful behavior)
    const existingPolicies = await inspector.getTablePolicies(tableName, connection);
    if (existingPolicies.length > 0 && !options.replace && !options.policy) {
      logger.info(chalk.yellow(`📋 Found ${existingPolicies.length} existing policies for ${tableName}:`));
      existingPolicies.forEach(policy => {
        logger.info(`   • ${policy.name} (${policy.command})`);
      });
      logger.newLine();
    }
    
    // Handle specific policy updates
    if (options.policy) {
      await handleSpecificPolicyUpdate(tableName, options, existingPolicies, connection, inspector);
      return;
    }
    
    // Analyze table structure
    const columns = await inspector.analyzeTable(tableName, connection);
    const ownershipPatterns = await inspector.detectUserOwnershipPatterns(connection);
    
    // Determine the best policy pattern
    const detectedPattern = detectPolicyPattern(tableName, columns, ownershipPatterns, options);
    
    logger.success(`✅ Detected policy pattern: ${chalk.green(detectedPattern.pattern)}`);
    if (detectedPattern.ownerColumn) {
      logger.info(`   Owner column: ${chalk.yellow(detectedPattern.ownerColumn)}`);
    }
    if (detectedPattern.reason) {
      logger.info(`   Reason: ${chalk.gray(detectedPattern.reason)}`);
    }
    logger.newLine();
    
    // Ask for confirmation or customization
    const { confirmGeneration, customizePolicy } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmGeneration', 
        message: `Generate ${detectedPattern.pattern} policy for ${tableName}?`,
        default: true
      },
      {
        type: 'confirm',
        name: 'customizePolicy',
        message: 'Customize policy settings?',
        default: false,
        when: (answers) => answers.confirmGeneration
      }
    ]);
    
    if (!confirmGeneration) {
      logger.info('Policy generation cancelled.');
      return;
    }
    
    // Collect final configuration
    const config = customizePolicy
      ? await collectCustomPolicyConfig(tableName, detectedPattern, options)
      : createPolicyConfig(tableName, detectedPattern, options, connection);
    
    // Generate policy SQL
    const sql = await generator.generatePolicies(config);
    
    if (options.dryRun) {
      await previewPolicyChanges(sql, tableName, options);
      return;
    }
    
    await writePolicyToTable(sql, tableName, options);
    logger.success(`✅ RLS policy generated in: sql/schemas/${tableName}/rls.sql`);
    await displayPolicyUsage(tableName, { ...options, tableName });
    
  } catch (error) {
    logger.error(`❌ Failed to generate policy: ${error.message}`);
    logger.info('Falling back to template generation...');
    
    const config = await collectPolicyConfigTemplate(tableName, options);
    const generator = new PolicyGenerator(process.cwd());
    const sql = await generator.generatePolicies(config);
    
    if (options.dryRun) {
      await previewPolicyChanges(sql, tableName, options);
      return;
    }
    
    await writePolicyToTable(sql, tableName, options);
    await displayPolicyUsage(tableName, { ...options, tableName });
  }
}

/**
 * Detect the best policy pattern for a table
 */
function detectPolicyPattern(
  tableName: string, 
  columns: any[], 
  ownershipPatterns: Record<string, string>, 
  options: any
): PolicyPattern {
  // Check if pattern was explicitly specified
  if (options.pattern !== 'auto-detect') {
    return {
      pattern: options.pattern,
      ownerColumn: options.ownerColumn,
      reason: 'Explicitly specified by user'
    };
  }
  
  // Check ownership patterns from analysis
  if (ownershipPatterns[tableName]) {
    return {
      pattern: 'user_specific',
      ownerColumn: ownershipPatterns[tableName],
      reason: `Detected ownership column: ${ownershipPatterns[tableName]}`
    };
  }
  
  // Look for common ownership column patterns
  const ownershipColumns = columns.filter(col => 
    ['user_id', 'owner_id', 'created_by', 'author_id'].includes(col.name.toLowerCase()) &&
    (col.type.includes('uuid') || col.type.includes('integer'))
  );
  
  if (ownershipColumns.length > 0) {
    return {
      pattern: 'user_specific',
      ownerColumn: ownershipColumns[0].name,
      reason: `Found ownership column: ${ownershipColumns[0].name}`
    };
  }
  
  // Check for admin/system tables
  if (['admin', 'config', 'setting', 'system'].some(keyword => 
    tableName.toLowerCase().includes(keyword)
  )) {
    return {
      pattern: 'admin_only',
      reason: 'Administrative/configuration table detected'
    };
  }
  
  // Check for public/reference tables
  if (['category', 'tag', 'type', 'status', 'country', 'currency'].some(keyword =>
    tableName.toLowerCase().includes(keyword)
  )) {
    return {
      pattern: 'public_read',
      reason: 'Reference/lookup table detected'
    };
  }
  
  // Default to user-specific if unsure
  return {
    pattern: 'user_specific',
    reason: 'Default pattern for user data tables'
  };
}

/**
 * Create policy configuration from detected pattern
 */
function createPolicyConfig(tableName: string, pattern: PolicyPattern, options: any, connection?: DatabaseConnection): PolicyConfig {
  return {
    tableName,
    columns: [], // Will be populated by the PolicyGenerator
    accessPattern: pattern.pattern as any,
    schema: options.schema,
    pattern: pattern.pattern,
    ownerColumn: pattern.ownerColumn,
    customConditions: [],
    enableRLS: true,
    generateSelect: true,
    generateInsert: true,
    generateUpdate: true,
    generateDelete: true,
    // PostgREST configuration from connection
    anonRole: connection?.anonRole,
    jwtSecret: connection?.jwtSecret,
    serverHost: connection?.serverHost,
    serverPort: connection?.serverPort,
    preRequest: connection?.preRequest
  };
}

/**
 * Collect custom policy configuration
 */
async function collectCustomPolicyConfig(
  tableName: string, 
  detectedPattern: PolicyPattern, 
  options: any
): Promise<PolicyConfig> {
  const questions = [
    {
      type: 'list',
      name: 'pattern',
      message: 'Select policy pattern:',
      choices: [
        { name: 'User Specific - Users can only access their own records', value: 'user_specific' },
        { name: 'Public Read - Anyone can read, owners can modify', value: 'public_read' },
        { name: 'Admin Only - Only administrators can access', value: 'admin_only' },
        { name: 'Custom - Define custom conditions', value: 'custom' }
      ],
      default: detectedPattern.pattern
    },
    {
      type: 'input',
      name: 'ownerColumn',
      message: 'Owner column name:',
      default: detectedPattern.ownerColumn || 'user_id',
      when: (answers) => answers.pattern === 'user_specific' || answers.pattern === 'public_read'
    },
    {
      type: 'checkbox',
      name: 'operations',
      message: 'Generate policies for which operations:',
      choices: [
        { name: 'SELECT (read)', value: 'select', checked: false },
        { name: 'INSERT (create)', value: 'insert', checked: false },
        { name: 'UPDATE (modify)', value: 'update', checked: false },
        { name: 'DELETE (remove)', value: 'delete', checked: false }
      ],
      validate: function(answer) {
        if (answer.length < 1) {
          return 'You must choose at least one operation.';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'customConditions',
      message: 'Additional conditions (comma-separated):',
      default: '',
      when: (answers) => answers.pattern === 'custom'
    }
  ];
  
  const answers = await inquirer.prompt(questions);
  
  // Debug: log the selected operations
  console.log(`🐛 DEBUG - Selected operations: ${JSON.stringify(answers.operations)}`);
  console.log(`🐛 DEBUG - All answers: ${JSON.stringify(answers)}`);
  
  const config = {
    tableName,
    columns: [], // Will be populated by the PolicyGenerator
    accessPattern: answers.pattern as any,
    schema: options.schema,
    pattern: answers.pattern,
    ownerColumn: answers.ownerColumn,
    customConditions: answers.customConditions ? 
      answers.customConditions.split(',').map((c: string) => c.trim()) : [],
    enableRLS: true,
    generateSelect: answers.operations ? answers.operations.includes('select') : false,
    generateInsert: answers.operations ? answers.operations.includes('insert') : false,
    generateUpdate: answers.operations ? answers.operations.includes('update') : false,
    generateDelete: answers.operations ? answers.operations.includes('delete') : false
  };
  
  // Debug: log the final config flags
  console.log(`🐛 DEBUG - Policy config flags:`);
  console.log(`  generateSelect: ${config.generateSelect}`);
  console.log(`  generateInsert: ${config.generateInsert}`);
  console.log(`  generateUpdate: ${config.generateUpdate}`);
  console.log(`  generateDelete: ${config.generateDelete}`);
  
  return config;
}

/**
 * Collect policy configuration for template mode
 */
async function collectPolicyConfigTemplate(tableName: string, options: any): Promise<PolicyConfig> {
  const { pattern, ownerColumn, operations } = await inquirer.prompt([
    {
      type: 'list',
      name: 'pattern',
      message: 'Select policy pattern:',
      choices: [
        { name: 'User Specific - Users can only access their own records', value: 'user_specific' },
        { name: 'Public Read - Anyone can read, owners can modify', value: 'public_read' },
        { name: 'Admin Only - Only administrators can access', value: 'admin_only' },
        { name: 'Custom - Define custom conditions', value: 'custom' }
      ],
      default: 'user_specific'
    },
    {
      type: 'input',
      name: 'ownerColumn',
      message: 'Owner column name:',
      default: 'user_id',
      when: (answers) => answers.pattern === 'user_specific' || answers.pattern === 'public_read'
    },
    {
      type: 'checkbox',
      name: 'operations',
      message: 'Generate policies for which operations:',
      choices: [
        { name: 'SELECT (read)', value: 'select', checked: false },
        { name: 'INSERT (create)', value: 'insert', checked: false },
        { name: 'UPDATE (modify)', value: 'update', checked: false },
        { name: 'DELETE (remove)', value: 'delete', checked: false }
      ],
      validate: function(answer) {
        if (answer.length < 1) {
          return 'You must choose at least one operation.';
        }
        return true;
      }
    }
  ]);
  
  return {
    tableName,
    columns: [], // Will be populated by the PolicyGenerator
    accessPattern: pattern as any,
    schema: options.schema,
    pattern,
    ownerColumn,
    customConditions: [],
    enableRLS: true,
    generateSelect: operations ? operations.includes('select') : false,
    generateInsert: operations ? operations.includes('insert') : false,
    generateUpdate: operations ? operations.includes('update') : false,
    generateDelete: operations ? operations.includes('delete') : false
  };
}

/**
 * Generate policies for all tables
 */
async function generatePoliciesForAllTables(options: any) {
  logger.info(chalk.cyan('🛡️  Generating RLS policies for all tables'));
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
    
    // Detect ownership patterns across all tables
    const ownershipPatterns = await inspector.detectUserOwnershipPatterns(connection);
    
    const generator = new PolicyGenerator(process.cwd());
    let policiesGenerated = 0;
    
    for (const tableName of tableNames) {
      try {
        logger.info(`Analyzing ${tableName}...`);
        const columns = await inspector.analyzeTable(tableName, connection);
        const detectedPattern = detectPolicyPattern(tableName, columns, ownershipPatterns, options);
        
        const config = createPolicyConfig(tableName, detectedPattern, options, connection);
        const policySQL = await generator.generatePolicies(config);
        
        await writePolicyToTable(policySQL, tableName);
        
        policiesGenerated++;
        logger.success(`✅ Generated ${detectedPattern.pattern} policy for ${tableName} in sql/schemas/${tableName}/rls.sql`);
      } catch (error) {
        logger.warn(`⚠️  Skipped ${tableName}: ${error.message}`);
      }
    }
    
    if (policiesGenerated === 0) {
      logger.warn('No policies generated for any tables.');
      return;
    }
    
    logger.success(`💾 Generated ${policiesGenerated} policies saved to their respective table folders`);
    
    displayBulkPolicyUsage(tableNames.slice(0, policiesGenerated));
    
  } catch (error) {
    logger.error(`❌ Failed to generate bulk policies: ${error.message}`);
  }
}

/**
 * Preview policy changes without writing files
 */
async function previewPolicyChanges(sql: string, tableName: string, options: any) {
  logger.info(chalk.yellow('👀 DRY RUN - Preview Mode (no files will be changed)'));
  logger.newLine();
  
  logger.info(chalk.cyan(`📋 Generated policies for ${tableName}:`));
  logger.newLine();
  
  // Extract policy names from SQL for preview
  const policyMatches = sql.match(/CREATE POLICY "([^"]+)"/g) || [];
  policyMatches.forEach(match => {
    const policyName = match.match(/"([^"]+)"/)?.[1];
    if (policyName) {
      logger.info(`   ✨ ${policyName}`);
    }
  });
  
  logger.newLine();
  logger.info(chalk.gray('📄 Generated SQL:'));
  logger.newLine();
  logger.code(sql);
  logger.newLine();
  
  logger.info(chalk.cyan('💡 To apply these policies:'));
  logger.list([
    `Remove --dry-run flag: pgrestify api generate policy ${tableName} --pattern ${options.pattern || 'auto-detect'}`,
    `Then apply: pgrestify api migrate`
  ]);
}

/**
 * Write policy SQL to table folder
 */
async function writePolicyToTable(sql: string, tableName: string, options: any = {}) {
  const projectPath = process.cwd();
  const command = getCommandString();
  
  // Handle replace mode - skip deduplication
  if (options.replace) {
    logger.info(chalk.yellow('🔄 Replace mode: existing policies will be overwritten'));
    const timestampedSQL = appendWithTimestamp(sql, command);
    await writeTableSQL(projectPath, tableName, SQL_FILE_TYPES.RLS, timestampedSQL, true);
    return;
  }
  
  // Use generic deduplication utility for merge mode (default)
  const result = await deduplicateSQL(sql, tableName, SQL_FILE_TYPES.RLS, projectPath, 'policies');
  
  if (!result.sql) {
    logger.info('No new policies to add');
    return;
  }
  
  const timestampedSQL = appendWithTimestamp(result.sql, command);
  await writeTableSQL(projectPath, tableName, SQL_FILE_TYPES.RLS, timestampedSQL, true);
}


/**
 * Generate policies header
 */
function generatePoliciesHeader(): string {
  return `-- PostgreSQL Row Level Security (RLS) Policies
-- Generated by PGRestify CLI
-- 
-- Apply these policies to your database:
-- psql -d your_database -f policies.sql
--
-- RLS provides:
-- - Fine-grained access control
-- - Automatic data filtering
-- - Security at the database level
-- - Multi-tenant data isolation`;
}

/**
 * Display policy usage instructions
 */
async function displayPolicyUsage(tableName: string, options: any) {
  logger.newLine();
  logger.info(chalk.cyan('Usage:'));
  logger.list([
    `Apply policies: pgrestify api migrate (or manually: psql -d your_db -f sql/schemas/${tableName}/rls.sql)`,
    `RLS will automatically filter ${tableName} data`,
    'Policies work transparently with PostgREST',
    'Test with different user contexts'
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Security Tips:'));
  logger.list([
    'Test policies thoroughly before production',
    'Use EXPLAIN to verify policy performance',
    'Consider adding indexes on policy columns',
    'Monitor RLS performance impact',
    'Document policy logic for your team'
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('Example API testing:'));
  const postgrestConfig = await getPostgRESTConfig();
  const serverPort = postgrestConfig.serverPort;
  
  logger.code(`# Test with different user contexts
curl -H "Authorization: Bearer <user_token>" \\
     "http://localhost:${serverPort}/${tableName}"
     
# Should only return records accessible to that user`);
}

/**
 * Display bulk policy usage
 */
function displayBulkPolicyUsage(tables: string[]) {
  logger.newLine();
  logger.info(chalk.cyan('🚀 Generated Policies Usage:'));
  logger.list([
    `Apply all policies: pgrestify api migrate`,
    `RLS policies created for ${tables.length} tables in their respective folders`,
    'All tables now have intelligent access control'
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('📋 Tables with RLS Policies:'));
  tables.forEach(table => {
    logger.info(`  • ${table} - Protected with intelligent RLS (sql/schemas/${table}/rls.sql)`);
  });
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Next Steps:'));
  logger.list([
    'Test policies with different user roles',
    'Add indexes on ownership/filter columns',
    'Monitor query performance',
    'Set up proper JWT token claims',
    'Document access patterns for your team'
  ]);
}

/**
 * Handle RLS state changes (enable/disable)
 */
async function handleRLSStateChange(
  tableName: string, 
  options: any, 
  connection: DatabaseConnection, 
  inspector: SchemaInspector
) {
  const rlsStatus = await inspector.checkRLSStatus(connection);
  const currentStatus = rlsStatus[tableName];
  
  if (options.enableRls && !currentStatus) {
    logger.info(chalk.blue(`🔒 Enabling RLS on ${tableName}...`));
    
    if (!options.dryRun) {
      const postgrestConfig = await getPostgRESTConfig();
      const schema = postgrestConfig.dbSchemas;
      const enableSQL = `ALTER TABLE ${schema}.${tableName} ENABLE ROW LEVEL SECURITY;`;
      const projectPath = process.cwd();
      const command = getCommandString();
      const timestampedSQL = appendWithTimestamp(enableSQL, command);
      await writeTableSQL(projectPath, tableName, SQL_FILE_TYPES.RLS, timestampedSQL, false);
    }
    
    logger.success(`✅ RLS will be enabled on ${tableName}`);
  } else if (options.disableRls && currentStatus) {
    logger.warn(chalk.yellow(`⚠️  Disabling RLS on ${tableName} - this removes all security protections!`));
    
    if (!options.force) {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to disable RLS on ${tableName}?`,
        default: false
      }]);
      
      if (!confirm) {
        logger.info('RLS disable cancelled.');
        return;
      }
    }
    
    if (!options.dryRun) {
      const postgrestConfig = await getPostgRESTConfig();
      const schema = postgrestConfig.dbSchemas;
      const disableSQL = `ALTER TABLE ${schema}.${tableName} DISABLE ROW LEVEL SECURITY;`;
      const projectPath = process.cwd();
      const command = getCommandString();
      const timestampedSQL = appendWithTimestamp(disableSQL, command);
      await writeTableSQL(projectPath, tableName, SQL_FILE_TYPES.RLS, timestampedSQL, false);
    }
    
    logger.success(`✅ RLS will be disabled on ${tableName}`);
  } else if (options.enableRls && currentStatus) {
    logger.info(chalk.gray(`ℹ️  RLS is already enabled on ${tableName}`));
  } else if (options.disableRls && !currentStatus) {
    logger.info(chalk.gray(`ℹ️  RLS is already disabled on ${tableName}`));
  }
}

/**
 * Handle specific policy updates by name
 */
async function handleSpecificPolicyUpdate(
  tableName: string,
  options: any,
  existingPolicies: PolicyInfo[],
  connection: DatabaseConnection,
  inspector: SchemaInspector
) {
  const targetPolicy = existingPolicies.find(p => p.name === options.policy);
  
  if (!targetPolicy) {
    logger.error(`❌ Policy '${options.policy}' not found on table ${tableName}`);
    logger.info('Available policies:');
    existingPolicies.forEach(policy => {
      logger.info(`   • ${policy.name} (${policy.command})`);
    });
    return;
  }
  
  logger.info(chalk.cyan(`🎯 Updating specific policy: ${options.policy}`));
  logger.info(`   Current: ${targetPolicy.command} - ${targetPolicy.using}`);
  logger.newLine();
  
  // Generate replacement policy
  const generator = new PolicyGenerator(process.cwd());
  const columns = await inspector.analyzeTable(tableName, connection);
  const ownershipPatterns = await inspector.detectUserOwnershipPatterns(connection);
  const detectedPattern = detectPolicyPattern(tableName, columns, ownershipPatterns, options);
  
  const config = createPolicyConfig(tableName, detectedPattern, options, connection);
  const sql = await generator.generatePolicies(config);
  
  if (options.dryRun) {
    await previewPolicyChanges(sql, tableName, options);
    return;
  }
  
  // Remove the specific policy and add the new one
  const projectPath = process.cwd();
  const sqlFilePath = `${projectPath}/sql/schemas/${tableName}/rls.sql`;
  
  if (await fs.exists(sqlFilePath)) {
    const content = await fs.readFile(sqlFilePath);
    const updatedContent = removeSpecificPolicyFromSQL(content, options.policy);
    await fs.writeFile(sqlFilePath, updatedContent);
  }
  
  const command = getCommandString();
  const timestampedSQL = appendWithTimestamp(sql, command);
  await writeTableSQL(projectPath, tableName, SQL_FILE_TYPES.RLS, timestampedSQL, false);
  
  logger.success(`✅ Policy '${options.policy}' updated in: sql/schemas/${tableName}/rls.sql`);
}

/**
 * Remove a specific policy from SQL content
 */
function removeSpecificPolicyFromSQL(sqlContent: string, policyName: string): string {
  const policyPattern = new RegExp(`--[^\\n]*${policyName}[^\\n]*\\n[\\s\\S]*?CREATE POLICY\\s+"${policyName}"[^;]*;\\s*`, 'gi');
  return sqlContent.replace(policyPattern, '');
}

// Types
interface PolicyPattern {
  pattern: string;
  ownerColumn?: string;
  reason: string;
}