/**
 * @fileoverview RLS (Row Level Security) management commands
 * 
 * Provides tools to add, update, test, and manage Row Level Security
 * policies for PostgREST APIs with common patterns and best practices.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';
import { logger } from '../../../utils/logger.js';
import { fs } from '../../../utils/fs.js';
import { DatabaseManager } from '../../../utils/database.js';
import { writeTableSQL, SQL_FILE_TYPES, appendWithTimestamp, getCommandString } from '../../../utils/sql-structure.js';
import { getPostgRESTConfig, generateGrantStatement } from '../../../utils/postgrest-config.js';

/**
 * Common RLS policy patterns
 */
const RLS_PATTERNS = {
  user_owned: {
    name: 'User Owned Records',
    description: 'Users can only access their own records',
    template: 'user_owned'
  },
  public_read: {
    name: 'Public Read, User Write',
    description: 'Anyone can read, only owner can modify',
    template: 'public_read'
  },
  role_based: {
    name: 'Role-Based Access',
    description: 'Access based on user roles (admin, user, etc.)',
    template: 'role_based'
  },
  team_based: {
    name: 'Team/Organization Based',
    description: 'Access within team or organization boundaries',
    template: 'team_based'
  },
  custom: {
    name: 'Custom Policy',
    description: 'Write your own policy logic',
    template: 'custom'
  }
};

/**
 * Create RLS command
 */
export function createRLSCommand(): Command {
  const command = new Command('rls');
  
  command
    .description('Manage Row Level Security policies')
    .addCommand(createAddCommand())
    .addCommand(createUpdateCommand())
    .addCommand(createTestCommand())
    .addCommand(createListCommand())
    .addCommand(createFixAnonymousCommand());
  
  return command;
}

/**
 * Create add RLS policy command
 */
function createAddCommand(): Command {
  const command = new Command('add');
  
  command
    .description('Add RLS policy to table (table-based folder structure)')
    .argument('<table>', 'Table name')
    .option('--schema <name>', 'Schema name')
    .option('--pattern <type>', 'Policy pattern (user_owned|public_read|role_based|team_based|custom)')
    .option('--apply', 'Apply the policy to database immediately')
    .action(async (tableName, options) => {
      await addRLSPolicy(tableName, options);
    });
  
  return command;
}

/**
 * Add RLS policy to table
 */
async function addRLSPolicy(tableName: string, options: any) {
  logger.info(chalk.cyan(`🔒 Adding RLS Policy to ${tableName}`));
  logger.newLine();
  
  const config = await collectRLSConfig(tableName, options);
  const sql = generateRLSPolicy(config);
  
  // Always use table-folder structure (mandatory)
  const projectPath = process.cwd();
  const command = getCommandString();
  const timestampedSQL = appendWithTimestamp(sql, command);
  
  await writeTableSQL(projectPath, tableName, SQL_FILE_TYPES.RLS, timestampedSQL, true);
  
  logger.success(`✅ RLS policy added to: sql/schemas/${tableName}/rls.sql`);
  logger.info(chalk.gray(`📁 Using table-based folder structure`));
  
  // Auto-apply if requested
  if (options.apply) {
    logger.info(chalk.blue('🚀 Applying policy to database...'));
    await applyPolicyToDatabase(sql, config);
  } else {
    displayRLSUsage(config);
  }
}

/**
 * Collect RLS configuration
 */
async function collectRLSConfig(tableName: string, options: any) {
  let pattern = options.pattern;
  
  if (!pattern) {
    const { selectedPattern } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedPattern',
        message: 'Select RLS pattern:',
        choices: Object.entries(RLS_PATTERNS).map(([key, p]) => ({
          name: `${p.name} - ${p.description}`,
          value: key
        }))
      }
    ]);
    pattern = selectedPattern;
  }
  
  // Get pattern-specific configuration
  const patternConfig = await getPatternConfig(pattern, tableName);
  const postgrestConfig = await getPostgRESTConfig();
  
  return {
    tableName,
    schema: options.schema || postgrestConfig.dbSchemas,
    pattern,
    output: options.output,
    ...patternConfig
  };
}

/**
 * Get pattern-specific configuration
 */
async function getPatternConfig(pattern: string, tableName: string) {
  switch (pattern) {
    case 'user_owned':
      return await getUserOwnedConfig(tableName);
    case 'public_read':
      return await getPublicReadConfig(tableName);
    case 'role_based':
      return await getRoleBasedConfig();
    case 'team_based':
      return await getTeamBasedConfig();
    case 'custom':
      return await getCustomConfig();
    default:
      return {};
  }
}

/**
 * Get user owned policy config
 */
async function getUserOwnedConfig(tableName: string) {
  const { userIdColumn } = await inquirer.prompt([
    {
      type: 'input',
      name: 'userIdColumn',
      message: 'User ID column name:',
      default: tableName.includes('user') ? 'id' : 'user_id',
      validate: (input) => input.trim().length > 0 || 'Column name is required'
    }
  ]);
  
  return { userIdColumn };
}

/**
 * Get public read policy config
 */
async function getPublicReadConfig(tableName: string) {
  const { includeWrites, restrictedFields } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'includeWrites',
      message: 'Allow anonymous users to INSERT/UPDATE records?',
      default: false
    },
    {
      type: 'input',
      name: 'restrictedFields',
      message: 'Fields to hide from anonymous users (comma-separated, optional):',
      default: tableName === 'users' ? 'password_hash, email' : ''
    }
  ]);
  
  return { 
    includeWrites,
    restrictedFields: restrictedFields ? restrictedFields.split(',').map(f => f.trim()) : []
  };
}

/**
 * Get role-based policy config
 */
async function getRoleBasedConfig() {
  const { roles } = await inquirer.prompt([
    {
      type: 'input',
      name: 'roles',
      message: 'Allowed roles (comma-separated):',
      default: 'admin, user',
      validate: (input) => input.trim().length > 0 || 'At least one role is required'
    }
  ]);
  
  return { roles: roles.split(',').map(r => r.trim()) };
}

/**
 * Get team-based policy config
 */
async function getTeamBasedConfig() {
  const { teamColumn } = await inquirer.prompt([
    {
      type: 'input',
      name: 'teamColumn',
      message: 'Team/Organization column name:',
      default: 'team_id',
      validate: (input) => input.trim().length > 0 || 'Column name is required'
    }
  ]);
  
  return { teamColumn };
}

/**
 * Get custom policy config
 */
async function getCustomConfig() {
  const { condition } = await inquirer.prompt([
    {
      type: 'input',
      name: 'condition',
      message: 'Custom condition (SQL WHERE clause):',
      default: 'true',
      validate: (input) => input.trim().length > 0 || 'Condition is required'
    }
  ]);
  
  return { condition };
}

/**
 * Generate RLS policy SQL
 */
function generateRLSPolicy(config: any): string {
  const header = `-- RLS Policy for ${config.tableName}
-- Pattern: ${config.pattern}
-- Generated: ${new Date().toISOString()}`;
  
  const enableRLS = `-- Enable RLS on table
ALTER TABLE ${config.schema}.${config.tableName} ENABLE ROW LEVEL SECURITY;`;
  
  const policies = generatePoliciesByPattern(config);
  
  return `${header}\n\n${enableRLS}\n\n${policies}`;
}

/**
 * Generate policies based on pattern
 */
async function generatePoliciesByPattern(config: any): Promise<string> {
  switch (config.pattern) {
    case 'user_owned':
      return await generateUserOwnedPolicies(config);
    case 'public_read':
      return await generatePublicReadPolicies(config);
    case 'role_based':
      return generateRoleBasedPolicies(config);
    case 'team_based':
      return generateTeamBasedPolicies(config);
    case 'custom':
      return generateCustomPolicies(config);
    default:
      return generateDefaultPolicies(config);
  }
}

/**
 * Generate user-owned record policies
 */
async function generateUserOwnedPolicies(config: any): Promise<string> {
  const { tableName, schema, userIdColumn } = config;
  const postgrestConfig = await getPostgRESTConfig();
  
  return `-- User can only see their own records
CREATE POLICY "${tableName}_select_own" ON ${schema}.${tableName}
  FOR SELECT TO authenticated
  USING (${userIdColumn} = ${postgrestConfig.schema}.current_user_id());

-- User can only insert records with their user_id
CREATE POLICY "${tableName}_insert_own" ON ${schema}.${tableName}
  FOR INSERT TO authenticated
  WITH CHECK (${userIdColumn} = ${postgrestConfig.schema}.current_user_id());

-- User can only update their own records
CREATE POLICY "${tableName}_update_own" ON ${schema}.${tableName}
  FOR UPDATE TO authenticated
  USING (${userIdColumn} = ${postgrestConfig.schema}.current_user_id())
  WITH CHECK (${userIdColumn} = ${postgrestConfig.schema}.current_user_id());

-- User can only delete their own records
CREATE POLICY "${tableName}_delete_own" ON ${schema}.${tableName}
  FOR DELETE TO authenticated
  USING (${userIdColumn} = ${postgrestConfig.schema}.current_user_id());`;
}

/**
 * Generate public read policies
 */
async function generatePublicReadPolicies(config: any): Promise<string> {
  const { tableName, schema } = config;
  const postgrestConfig = await getPostgRESTConfig();
  const anonRole = postgrestConfig.anonRole;
  
  return `-- Anonymous users can read all records
CREATE POLICY "${tableName}_select_public" ON ${schema}.${tableName}
  FOR SELECT TO ${anonRole}
  USING (true);

-- Authenticated users can read all records
CREATE POLICY "${tableName}_select_user" ON ${schema}.${tableName}
  FOR SELECT TO authenticated
  USING (true);

-- Only authenticated users can insert
CREATE POLICY "${tableName}_insert_auth" ON ${schema}.${tableName}
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Only record owner can update
CREATE POLICY "${tableName}_update_own" ON ${schema}.${tableName}
  FOR UPDATE TO authenticated
  USING (user_id = ${schema}.current_user_id())
  WITH CHECK (user_id = ${schema}.current_user_id());

-- Only record owner can delete
CREATE POLICY "${tableName}_delete_own" ON ${schema}.${tableName}
  FOR DELETE TO authenticated
  USING (user_id = ${schema}.current_user_id());`;
}

/**
 * Generate role-based policies
 */
function generateRoleBasedPolicies(config: any): string {
  const { tableName, schema, roles } = config;
  const roleList = roles.map(r => `'${r}'`).join(', ');
  
  return `-- Role-based access control
CREATE POLICY "${tableName}_select_role" ON ${schema}.${tableName}
  FOR SELECT TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json->>'role') IN (${roleList})
  );

-- Admins can insert anything, users can insert their own records
CREATE POLICY "${tableName}_insert_role" ON ${schema}.${tableName}
  FOR INSERT TO authenticated
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
    OR user_id = ${schema}.current_user_id()
  );

-- Admins can update anything, users can update their own records
CREATE POLICY "${tableName}_update_role" ON ${schema}.${tableName}
  FOR UPDATE TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
    OR user_id = ${schema}.current_user_id()
  )
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
    OR user_id = ${schema}.current_user_id()
  );

-- Admins can delete anything, users can delete their own records
CREATE POLICY "${tableName}_delete_role" ON ${schema}.${tableName}
  FOR DELETE TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json->>'role') = 'admin'
    OR user_id = ${schema}.current_user_id()
  );`;
}

/**
 * Generate team-based policies
 */
function generateTeamBasedPolicies(config: any): string {
  const { tableName, schema, teamColumn } = config;
  
  return `-- Team/organization based access
CREATE POLICY "${tableName}_select_team" ON ${schema}.${tableName}
  FOR SELECT TO authenticated
  USING (
    ${teamColumn} IN (
      SELECT team_id FROM ${schema}.user_teams 
      WHERE user_id = ${schema}.current_user_id()
    )
  );

-- Users can insert records in their teams
CREATE POLICY "${tableName}_insert_team" ON ${schema}.${tableName}
  FOR INSERT TO authenticated
  WITH CHECK (
    ${teamColumn} IN (
      SELECT team_id FROM ${schema}.user_teams 
      WHERE user_id = ${schema}.current_user_id()
    )
  );

-- Users can update records in their teams
CREATE POLICY "${tableName}_update_team" ON ${schema}.${tableName}
  FOR UPDATE TO authenticated
  USING (
    ${teamColumn} IN (
      SELECT team_id FROM ${schema}.user_teams 
      WHERE user_id = ${schema}.current_user_id()
    )
  )
  WITH CHECK (
    ${teamColumn} IN (
      SELECT team_id FROM ${schema}.user_teams 
      WHERE user_id = ${schema}.current_user_id()
    )
  );

-- Users can delete records in their teams
CREATE POLICY "${tableName}_delete_team" ON ${schema}.${tableName}
  FOR DELETE TO authenticated
  USING (
    ${teamColumn} IN (
      SELECT team_id FROM ${schema}.user_teams 
      WHERE user_id = ${schema}.current_user_id()
    )
  );`;
}

/**
 * Generate custom policies
 */
function generateCustomPolicies(config: any): string {
  const { tableName, schema, condition } = config;
  
  return `-- Custom policy condition
CREATE POLICY "${tableName}_custom" ON ${schema}.${tableName}
  FOR ALL TO authenticated
  USING (${condition})
  WITH CHECK (${condition});`;
}

/**
 * Generate default policies
 */
function generateDefaultPolicies(config: any): string {
  const { tableName, schema } = config;
  
  return `-- Default restrictive policy
CREATE POLICY "${tableName}_default" ON ${schema}.${tableName}
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);`;
}

/**
 * Generate RLS header
 */
function generateRLSHeader(): string {
  return `-- Row Level Security Policies
-- Generated by PGRestify
-- 
-- Apply these policies to your database:
-- psql -d your_database -f rls_policies.sql
--
-- Security Notes:
-- - Test all policies thoroughly
-- - Use least privilege principle
-- - Monitor query performance with RLS
-- - Document policy logic for your team`;
}

/**
 * Create update RLS policy command
 */
function createUpdateCommand(): Command {
  const command = new Command('update');
  
  command
    .description('Update existing RLS policy')
    .argument('<table>', 'Table name')
    .argument('<policy>', 'Policy name')
    .option('--schema <name>', 'Schema name')
    .action(async (tableName, policyName, options) => {
      logger.info(`Updating RLS policy ${policyName} for ${tableName}`);
      // Implementation would go here
    });
  
  return command;
}

/**
 * Create test RLS policies command
 */
function createTestCommand(): Command {
  const command = new Command('test');
  
  command
    .description('Generate RLS policy tests')
    .argument('<table>', 'Table name')
    .option('--schema <name>', 'Schema name')
    .action(async (tableName, options) => {
      await generateRLSTests(tableName, options);
    });
  
  return command;
}

/**
 * Generate RLS policy tests
 */
async function generateRLSTests(tableName: string, options: any) {
  logger.info(chalk.cyan(`🧪 Generating RLS Tests for ${tableName}`));
  
  const tests = await generateTestSQL(tableName, options);
  
  // Write tests to table folder
  const projectPath = process.cwd();
  const command = getCommandString();
  const timestampedSQL = appendWithTimestamp(tests, command);
  
  await writeTableSQL(projectPath, tableName, SQL_FILE_TYPES.RLS, timestampedSQL, true);
  
  logger.success(`✅ RLS tests generated in: sql/schemas/${tableName}/rls.sql`);
}

/**
 * Generate test SQL
 */
async function generateTestSQL(tableName: string, options: any): Promise<string> {
  const postgrestConfig = await getPostgRESTConfig();
  const schema = options.schema || postgrestConfig.dbSchemas;
  
  return `-- RLS Policy Tests for ${tableName}
-- Run these tests to verify your RLS policies work correctly

-- Test 1: Anonymous access
SET ROLE web_anon;
SELECT 'Testing anonymous access' AS test_name;
SELECT * FROM ${schema}.${tableName} LIMIT 1;

-- Test 2: Authenticated user access
SET ROLE web_user;
SET request.jwt.claims = '{"sub": "user-id-123", "role": "user"}';
SELECT 'Testing authenticated user access' AS test_name;
SELECT * FROM ${schema}.${tableName} WHERE user_id = 'user-id-123' LIMIT 1;

-- Test 3: Admin access
SET request.jwt.claims = '{"sub": "admin-id-456", "role": "admin"}';
SELECT 'Testing admin access' AS test_name;
SELECT * FROM ${schema}.${tableName} LIMIT 5;

-- Reset role
RESET ROLE;
SELECT 'Tests completed' AS result;`;
}

/**
 * Create list RLS policies command
 */
function createListCommand(): Command {
  const command = new Command('list');
  
  command
    .description('List RLS policies for table')
    .argument('[table]', 'Table name (optional)')
    .option('--schema <name>', 'Schema name')
    .action(async (tableName, options) => {
      await listRLSPolicies(tableName, options);
    });
  
  return command;
}

/**
 * List RLS policies
 */
async function listRLSPolicies(tableName: string, options: any) {
  const postgrestConfig = await getPostgRESTConfig();
  const schema = options.schema || postgrestConfig.dbSchemas;
  const tableDesc = tableName ? `for table '${tableName}'` : 'in schema';
  logger.info(chalk.cyan(`📋 RLS Policies ${tableDesc}`));
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
      const query = await generateListQuery(tableName, options);
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
      const query = await generateListQuery(tableName, options);
      logger.code(query, 'sql');
      return;
    }
    
    // Execute the query and display results
    const query = await generateListQuery(tableName, options);
    const { Pool } = await import('pg');
    const pool = new Pool(connection);
    
    try {
      const result = await pool.query(query);
      const policies = result.rows;
      
      if (policies.length === 0) {
        const scopeMsg = tableName ? `table '${tableName}'` : `schema '${schema}'`;
        logger.info(`📭 No RLS policies found for ${scopeMsg}`);
        logger.info('RLS policies will appear here after you create them.');
        return;
      }
      
      logger.success(`✅ Found ${policies.length} RLS policy(ies):`);
      logger.newLine();
      
      policies.forEach((policy, index) => {
        logger.info(`${index + 1}. ${chalk.green(policy.policy_name)}`);
        logger.info(`   Table: ${policy.schema_name}.${policy.table_name}`);
        logger.info(`   Command: ${chalk.blue(policy.cmd)}`);
        logger.info(`   Permissive: ${policy.permissive ? 'Yes' : 'No'}`);
        if (policy.roles && policy.roles !== '{}') {
          logger.info(`   Roles: ${policy.roles}`);
        }
        if (policy.qual) {
          const shortQual = policy.qual.length > 80 
            ? policy.qual.substring(0, 80) + '...'
            : policy.qual;
          logger.info(`   Using: ${chalk.gray(shortQual)}`);
        }
        if (policy.with_check) {
          const shortCheck = policy.with_check.length > 80 
            ? policy.with_check.substring(0, 80) + '...'
            : policy.with_check;
          logger.info(`   Check: ${chalk.gray(shortCheck)}`);
        }
        logger.newLine();
      });
      
      logger.info(chalk.cyan('💡 RLS Policy Management:'));
      logger.list([
        'Policies control row-level access to data',
        'Each policy applies to specific SQL commands (SELECT, INSERT, UPDATE, DELETE)',
        'Use USING clause for read access, WITH CHECK for write validation',
        'Test policies carefully with different user roles'
      ]);
      
    } finally {
      await pool.end();
    }
    
  } catch (error) {
    logger.error(`❌ Failed to list RLS policies: ${error.message}`);
    
    // Fallback: show the query for manual execution
    logger.newLine();
    logger.info(chalk.yellow('💡 Manual Query (if needed):'));
    const query = await generateListQuery(tableName, options);
    logger.code(query, 'sql');
  }
}

/**
 * Generate list query
 */
async function generateListQuery(tableName: string, options: any): Promise<string> {
  const postgrestConfig = await getPostgRESTConfig();
  const schema = options.schema || postgrestConfig.dbSchemas;
  const tableFilter = tableName ? `AND c.relname = '${tableName}'` : '';
  
  return `-- List RLS policies
SELECT 
  n.nspname AS schema_name,
  c.relname AS table_name,
  pol.polname AS policy_name,
  pol.polcmd AS command,
  pg_get_expr(pol.polqual, pol.polrelid) AS using_expression,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expression,
  CASE WHEN pol.polroles = '{0}' THEN 'PUBLIC' 
       ELSE array_to_string(ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(pol.polroles)), ', ')
  END AS roles
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = '${schema}'
${tableFilter}
ORDER BY n.nspname, c.relname, pol.polname;`;
}

/**
 * Display RLS usage instructions
 */
function displayRLSUsage(config: any) {
  logger.newLine();
  logger.info(chalk.cyan('Usage:'));
  logger.list([
    `Apply policies: psql -d your_db -f ${config.output}`,
    'Test policies with different user roles',
    'Monitor query performance after applying RLS',
    'Use pgrestify schema rls test to generate test cases'
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow('⚡ Performance Tips:'));
  logger.list([
    'Add indexes on columns used in RLS conditions',
    'Keep RLS expressions simple for better performance',
    'Test with realistic data volumes',
    'Monitor slow query logs'
  ]);
}

/**
 * Create fix anonymous access command
 */
function createFixAnonymousCommand(): Command {
  const command = new Command('fix-anonymous');
  
  command
    .description('Quick fix for anonymous access issues (empty array responses)')
    .option('--schema <name>', 'Schema name')
    .option('--table <name>', 'Specific table to fix (default: all tables)')
    .option('--apply', 'Apply the fix to database immediately')
    .option('--safe', 'Use safe public read (excludes sensitive fields)', true)
    .action(async (options) => {
      await fixAnonymousAccess(options);
    });
  
  return command;
}

/**
 * Fix anonymous access issues
 */
async function fixAnonymousAccess(options: any) {
  logger.info(chalk.cyan('🔧 Fixing Anonymous Access Issues'));
  logger.newLine();
  
  logger.info('This will help resolve empty array responses for anonymous users.');
  logger.info('Common issue: RLS policies are too restrictive for public endpoints.');
  logger.newLine();
  
  try {
    // Get database connection to inspect current state
    const dbManager = new DatabaseManager(process.cwd());
    const connection = await dbManager.extractConnection();
    
    if (!connection && !options.apply) {
      logger.warn('⚠️  No database connection found. Will generate SQL file only.');
      logger.info('Use --apply flag to apply policies directly when database is available.');
      logger.newLine();
    }
    
    const postgrestConfig = await getPostgRESTConfig();
    const schema = options.schema || postgrestConfig.dbSchemas;
    let tables: string[] = [];
    
    if (options.table) {
      tables = [options.table];
    } else if (connection) {
      // Get tables from database
      tables = await getTablesWithRLS(connection, schema);
    } else {
      // Common tables for basic template
      tables = ['users', 'profiles'];
      logger.info(`🔍 No database connection. Using common tables: ${tables.join(', ')}`);
    }
    
    if (tables.length === 0) {
      logger.warn('❌ No tables found with RLS enabled.');
      return;
    }
    
    logger.info(`📋 Tables to fix: ${chalk.green(tables.join(', '))}`);
    logger.newLine();
    
    // Ask user what type of fix they want
    const { fixType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'fixType',
        message: 'What type of anonymous access do you want to enable?',
        choices: [
          {
            name: '🔓 Public Read Access (Recommended) - Allow anonymous users to read all data',
            value: 'public_read'
          },
          {
            name: '🔒 Safe Public Read - Create public views excluding sensitive fields',
            value: 'safe_public'
          },
          {
            name: '📝 Custom Policy - Define your own policy conditions',
            value: 'custom'
          }
        ]
      }
    ]);
    
    let sql = generateAnonymousFixHeader();
    
    for (const table of tables) {
      logger.info(`Processing table: ${chalk.blue(table)}`);
      
      if (fixType === 'public_read') {
        sql += await generatePublicReadPolicy(table, schema);
      } else if (fixType === 'safe_public') {
        sql += await generateSafePublicView(table, schema);
      } else {
        const customPolicy = await getCustomPolicyConfig(table);
        sql += await generateCustomPolicy(table, schema, customPolicy);
      }
    }
    
    // Always use table-folder structure (mandatory)
    const projectPath = process.cwd();
    const command = getCommandString();
    
    // Apply to each table's RLS file
    for (const table of tables) {
      let tableSQL = '';
      if (fixType === 'public_read') {
        tableSQL = await generatePublicReadPolicy(table, schema);
      } else if (fixType === 'safe_public') {
        tableSQL = await generateSafePublicView(table, schema);
      } else {
        const customPolicy = await getCustomPolicyConfig(table);
        tableSQL = await generateCustomPolicy(table, schema, customPolicy);
      }
      
      const timestampedSQL = appendWithTimestamp(tableSQL, command);
      await writeTableSQL(projectPath, table, SQL_FILE_TYPES.RLS, timestampedSQL, true);
    }
    
    logger.success(`✅ Anonymous access fix applied to ${tables.length} table RLS files`);
    logger.info(chalk.gray(`📁 Updated files in sql/schemas/[table]/rls.sql`));
    
    // Apply if requested
    if (options.apply && connection) {
      logger.info(chalk.blue('🚀 Applying fix to database...'));
      await applyPolicyToDatabase(sql, { schema: schema });
      
      logger.newLine();
      logger.success('🎉 Anonymous access fix applied successfully!');
      logger.info('Test your API endpoints now:');
      logger.list([
        'curl http://localhost:3000/users',
        'curl http://localhost:3000/profiles',
        'Check that you get data instead of empty arrays'
      ]);
      
    } else {
      await displayTableFolderFixUsage(tables, fixType);
    }
    
  } catch (error) {
    logger.error(`❌ Failed to fix anonymous access: ${error.message}`);
  }
}

/**
 * Apply policy to database
 */
async function applyPolicyToDatabase(sql: string, config: any) {
  try {
    const dbManager = new DatabaseManager(process.cwd());
    const connection = await dbManager.extractConnection();
    
    if (!connection) {
      logger.error('❌ No database connection found');
      logger.info('Please ensure your database configuration is available.');
      return;
    }
    
    // Test connection
    const isConnected = await dbManager.testConnection(connection);
    if (!isConnected) {
      logger.error('❌ Could not connect to database');
      logger.info('Please ensure your database is running and accessible.');
      return;
    }
    
    // Apply the policy
    await dbManager.executeSQL(sql, connection);
    logger.success('✅ Policy applied successfully to database');
    
  } catch (error) {
    logger.error(`❌ Failed to apply policy: ${error.message}`);
    throw error;
  }
}

/**
 * Get tables with RLS enabled
 */
async function getTablesWithRLS(connection: any, schema: string): Promise<string[]> {
  const { Pool } = await import('pg');
  const pool = new Pool(connection);
  
  try {
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = $1 
        AND c.relrowsecurity = true
      ORDER BY tablename
    `, [schema]);
    
    return result.rows.map(row => row.tablename);
  } finally {
    await pool.end();
  }
}

/**
 * Generate anonymous fix header
 */
function generateAnonymousFixHeader(): string {
  return `-- Anonymous Access Fix for RLS Policies
-- Generated by PGRestify on ${new Date().toISOString()}
-- 
-- This fixes empty array responses for anonymous users
-- by adding appropriate RLS policies for public access.
--

`;
}

/**
 * Generate public read policy
 */
async function generatePublicReadPolicy(table: string, schema: string): Promise<string> {
  const postgrestConfig = await getPostgRESTConfig();
  const anonRole = postgrestConfig.anonRole;
  
  return `-- Allow anonymous read access to ${table}
DROP POLICY IF EXISTS "Anonymous read access" ON ${schema}.${table};
CREATE POLICY "Anonymous read access"
  ON ${schema}.${table} FOR SELECT TO ${anonRole}
  USING (true);

`;
}

/**
 * Generate safe public view
 */
async function generateSafePublicView(table: string, schema: string): Promise<string> {
  const postgrestConfig = await getPostgRESTConfig();
  const anonRole = postgrestConfig.anonRole;
  const viewName = `${table}_public`;
  
  return `-- Create safe public view for ${table}
CREATE OR REPLACE VIEW ${schema}.${viewName} AS
SELECT 
  id,
  CASE 
    WHEN '${table}' = 'users' THEN name
    ELSE NULL 
  END as name,
  created_at,
  updated_at
  -- Add other safe fields as needed
FROM ${schema}.${table};

-- Grant access to public view
GRANT SELECT ON ${schema}.${viewName} TO ${anonRole}, authenticated;

-- Block direct access to main table for anonymous users
DROP POLICY IF EXISTS "Block anonymous access to ${table}" ON ${schema}.${table};
CREATE POLICY "Block anonymous access to ${table}"
  ON ${schema}.${table} FOR SELECT TO ${anonRole}
  USING (false);

`;
}

/**
 * Generate custom policy
 */
async function generateCustomPolicy(table: string, schema: string, config: any): Promise<string> {
  const postgrestConfig = await getPostgRESTConfig();
  const anonRole = postgrestConfig.anonRole;
  
  return `-- Custom policy for ${table}
DROP POLICY IF EXISTS "${config.policyName}" ON ${schema}.${table};
CREATE POLICY "${config.policyName}"
  ON ${schema}.${table} FOR SELECT TO ${anonRole}
  USING (${config.condition});

`;
}

/**
 * Get custom policy configuration
 */
async function getCustomPolicyConfig(table: string): Promise<any> {
  const { policyName, condition } = await inquirer.prompt([
    {
      type: 'input',
      name: 'policyName',
      message: `Policy name for ${table}:`,
      default: `Custom anonymous access for ${table}`
    },
    {
      type: 'input',
      name: 'condition',
      message: 'Policy condition (USING clause):',
      default: 'true',
      validate: (input) => input.trim().length > 0 || 'Condition is required'
    }
  ]);
  
  return { policyName, condition };
}

/**
 * Display anonymous fix usage
 */
async function displayAnonymousFixUsage(outputFile: string, fixType: string) {
  logger.newLine();
  logger.info(chalk.cyan('🔧 Next Steps:'));
  
  const postgrestConfig = await getPostgRESTConfig();
  const serverPort = postgrestConfig.serverPort;
  
  logger.list([
    `Apply the fix: psql -d your_database -f ${outputFile}`,
    'Or use: npm run pgrestify:migrate to apply with other migrations',
    `Test your endpoints: curl http://localhost:${serverPort}/users`,
    'Verify you get data instead of empty arrays'
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow(`💡 About ${fixType === 'public_read' ? 'Public Read' : 'Safe Public'} Access:`));
  
  if (fixType === 'public_read') {
    logger.list([
      'Anonymous users can now read all table data',
      'Consider if you need to hide sensitive fields',
      'Use safe_public option for production if needed',
      'Monitor for potential data exposure'
    ]);
  } else {
    logger.list([
      'Created safe public views excluding sensitive fields',
      'Direct table access blocked for anonymous users',
      'Use /tablename_public endpoints for anonymous access',
      'Customize views to show exactly what you want public'
    ]);
  }
  
  logger.newLine();
  logger.info(chalk.green('🚀 Quick Test:'));
  logger.code(`# Test anonymous access
curl "http://localhost:3000/users"
curl "http://localhost:3000/profiles"

# Should return data instead of []`);
}

/**
 * Check if project uses new table-folder structure
 */
async function checkForNewStructure(projectPath: string): Promise<boolean> {
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
      // Check if it has table.sql file (indicates new structure)
      const tableFile = `${fullPath}/table.sql`;
      if (await fs.exists(tableFile)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Display table folder fix usage instructions
 */
async function displayTableFolderFixUsage(tables: string[], fixType: string) {
  logger.newLine();
  logger.info(chalk.cyan('📁 Table-based Structure Updated:'));
  
  logger.info('Updated files:');
  logger.list(tables.map(table => `sql/schemas/${table}/rls.sql`));
  
  const postgrestConfig = await getPostgRESTConfig();
  const serverPort = postgrestConfig.serverPort;
  
  logger.newLine();
  logger.info(chalk.cyan('🚀 Next Steps:'));
  logger.list([
    'Run migrations: pgrestify api migrate',
    `Test your endpoints: curl http://localhost:${serverPort}/users`,
    'Verify you get data instead of empty arrays',
    'Review the updated RLS policies in each table folder'
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow(`💡 About ${fixType === 'public_read' ? 'Public Read' : 'Safe Public'} Access:`));
  
  if (fixType === 'public_read') {
    logger.list([
      'Anonymous users can now read all table data',
      'Each table has its own RLS policies in table/rls.sql',
      'Consider if you need to hide sensitive fields',
      'Monitor for potential data exposure'
    ]);
  } else {
    logger.list([
      'Created safe public views excluding sensitive fields',
      'Direct table access blocked for anonymous users',
      'Use /tablename_public endpoints for anonymous access',
      'Each table folder contains its specific policies'
    ]);
  }
  
  logger.newLine();
  logger.info(chalk.green('🚀 Quick Test:'));
  logger.code(`# Test anonymous access
curl "http://localhost:${serverPort}/users"
curl "http://localhost:${serverPort}/profiles"

# Should return data instead of []`);
}