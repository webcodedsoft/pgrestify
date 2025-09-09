/**
 * @fileoverview Generate PostgreSQL functions for PostgREST
 * 
 * Creates optimized database functions including authentication,
 * CRUD operations, utilities, and custom business logic.
 * 
 * @author PGRestify Team
 * @since 2.0.0
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { logger } from '../../../utils/logger.js';
import { fs } from '../../../utils/fs.js';
import { FunctionGenerator, AuthFunctionConfig } from '../../../generators/FunctionGenerator.js';
import { SchemaInspector } from '../../../generators/SchemaInspector.js';
import { getPostgRESTConfig } from '../../../utils/postgrest-config.js';

/**
 * Create function generation command
 */
export function createFunctionCommand(): Command {
  const command = new Command('function');
  
  command
    .description('Generate optimized PostgreSQL functions')
    .argument('<name>', 'Function name')
    .option('--schema <name>', 'Schema name')
    .option('--type <type>', 'Function type (auth|crud|utility|custom)')
    .option('--table <table>', 'Table name for CRUD functions')
    .option('--auth-type <type>', 'Authentication type (jwt|basic|custom)')
    .option('--generate-all', 'Generate all utility functions')
    .option('--output <file>', 'Output file', './sql/functions/generated.sql')
    .action(async (functionName, options) => {
      await generateFunction(functionName, options);
    });
  
  return command;
}

/**
 * Generate PostgreSQL function
 */
async function generateFunction(functionName: string, options: any) {
  logger.info(chalk.cyan(`⚙️  Generating Function: ${functionName}`));
  logger.newLine();
  
  if (options.generateAll) {
    await generateAllUtilityFunctions(options);
    return;
  }
  
  try {
    const generator = new FunctionGenerator(process.cwd());
    const inspector = new SchemaInspector(process.cwd());
    
    let functionType = options.type;
    
    // Auto-detect function type if not specified
    if (!functionType) {
      functionType = detectFunctionType(functionName);
      logger.info(chalk.blue(`🔍 Detected function type: ${chalk.yellow(functionType)}`));
    }
    
    let sql: string;
    
    switch (functionType) {
      case 'auth':
        sql = await generateAuthFunction(functionName, options, generator);
        break;
      case 'crud':
        sql = await generateCrudFunction(functionName, options, generator, inspector);
        break;
      case 'utility':
        sql = await generateUtilityFunction(functionName, options, generator);
        break;
      case 'custom':
      default:
        sql = await generateCustomFunction(functionName, options);
        break;
    }
    
    await fs.ensureDir(require('path').dirname(options.output));
    await writeFunction(sql, options.output);
    logger.success(`✅ Function generated: ${options.output}`);
    await displayFunctionUsage(functionName, functionType, options);
    
  } catch (error) {
    logger.error(`❌ Failed to generate function: ${error.message}`);
    logger.info('Falling back to custom template...');
    
    const sql = await generateCustomFunction(functionName, options);
    await fs.ensureDir(require('path').dirname(options.output));
    await writeFunction(sql, options.output);
    displayFunctionUsage(functionName, 'custom', options);
  }
}

/**
 * Auto-detect function type based on name patterns
 */
function detectFunctionType(functionName: string): string {
  const name = functionName.toLowerCase();
  
  if (['login', 'register', 'authenticate', 'verify', 'hash_password', 'check_password'].some(keyword => 
    name.includes(keyword)
  )) {
    return 'auth';
  }
  
  if (['create_', 'update_', 'delete_', 'get_', 'find_', 'list_'].some(keyword => 
    name.startsWith(keyword)
  )) {
    return 'crud';
  }
  
  if (['validate', 'format', 'calculate', 'convert', 'generate', 'send_'].some(keyword => 
    name.includes(keyword)
  )) {
    return 'utility';
  }
  
  return 'custom';
}

/**
 * Generate authentication function
 */
async function generateAuthFunction(
  functionName: string, 
  options: any, 
  generator: FunctionGenerator
): Promise<string> {
  logger.info(chalk.blue('🔐 Generating authentication function...'));
  
  let authType = options.authType;
  
  if (!authType) {
    const { selectedAuthType } = await inquirer.prompt([{
      type: 'list',
      name: 'selectedAuthType',
      message: 'Select authentication type:',
      choices: [
        { name: 'JWT - JSON Web Token authentication', value: 'jwt' },
        { name: 'Basic - Username/password authentication', value: 'basic' },
        { name: 'Custom - Custom authentication logic', value: 'custom' }
      ]
    }]);
    authType = selectedAuthType;
  }
  
  const postgrestConfig = await getPostgRESTConfig();
  const config: AuthFunctionConfig = {
    jwtSecret: postgrestConfig.jwtSecret || 'your-jwt-secret-here',
    anonRole: postgrestConfig.anonRole,
    authenticatedRole: 'authenticated',
    jwtExpiresIn: '24h',
    hashRounds: 10,
    enableRefreshTokens: true,
    enableEmailVerification: true,
    customClaims: []
  };
  
  if (authType === 'custom') {
    const customConfig = await collectCustomAuthConfig();
    Object.assign(config, customConfig);
  }
  
  const sql = generator.generateAuthFunctions(config);
  
  return `-- Authentication function: ${functionName}
-- Type: ${authType}
-- Generated: ${new Date().toISOString()}

${sql}`;
}

/**
 * Generate CRUD function
 */
async function generateCrudFunction(
  functionName: string,
  options: any,
  generator: FunctionGenerator,
  inspector: SchemaInspector
): Promise<string> {
  logger.info(chalk.blue('📊 Generating CRUD function...'));
  
  let tableName = options.table;
  
  if (!tableName) {
    // Try to extract table name from function name
    const match = functionName.match(/^(create|update|delete|get|find|list)_(.+)$/);
    if (match) {
      tableName = match[2];
      logger.info(chalk.blue(`🔍 Detected table name: ${chalk.yellow(tableName)}`));
    } else {
      const { selectedTable } = await inquirer.prompt([{
        type: 'input',
        name: 'selectedTable',
        message: 'Enter table name for CRUD function:',
        validate: (input: string) => input.trim() !== '' || 'Table name is required'
      }]);
      tableName = selectedTable;
    }
  }
  
  // Try to get table structure if database connection is available
  try {
    const connection = await inspector.extractDatabaseConnection();
    if (connection) {
      logger.info(chalk.blue('🔍 Analyzing table structure...'));
      const columns = await inspector.analyzeTable(tableName, connection);
      logger.success(`✅ Found ${columns.length} columns in ${tableName}`);
    }
  } catch (error) {
    logger.warn(`⚠️  Could not analyze table structure: ${error.message}`);
  }
  
  const sql = await generator.generateCRUDFunctions(tableName);
  
  return `-- CRUD function: ${functionName}
-- Table: ${tableName}
-- Generated: ${new Date().toISOString()}

${sql}`;
}

/**
 * Generate utility function
 */
async function generateUtilityFunction(
  functionName: string,
  options: any,
  generator: FunctionGenerator
): Promise<string> {
  logger.info(chalk.blue('🛠️  Generating utility function...'));
  
  const { utilityType } = await inquirer.prompt([{
    type: 'list',
    name: 'utilityType',
    message: 'Select utility function type:',
    choices: [
      { name: 'Email Validation', value: 'email_validation' },
      { name: 'Phone Validation', value: 'phone_validation' },
      { name: 'Slug Generation', value: 'slug_generation' },
      { name: 'Random ID Generation', value: 'random_id' },
      { name: 'Timestamp Utilities', value: 'timestamp' },
      { name: 'Search Helper', value: 'search' },
      { name: 'Custom Utility', value: 'custom' }
    ]
  }]);
  
  const allUtilities = generator.generateUtilityFunctions();
  
  // Extract specific utility function
  let sql = '';
  switch (utilityType) {
    case 'email_validation':
      sql = generateEmailValidationFunction(functionName, options.schema);
      break;
    case 'phone_validation':
      sql = generatePhoneValidationFunction(functionName, options.schema);
      break;
    case 'slug_generation':
      sql = generateSlugFunction(functionName, options.schema);
      break;
    case 'random_id':
      sql = generateRandomIdFunction(functionName, options.schema);
      break;
    case 'timestamp':
      sql = generateTimestampUtilities(functionName, options.schema);
      break;
    case 'search':
      sql = generateSearchFunction(functionName, options.schema);
      break;
    default:
      sql = allUtilities; // Return all utilities
      break;
  }
  
  return `-- Utility function: ${functionName}
-- Type: ${utilityType}
-- Generated: ${new Date().toISOString()}

${sql}`;
}

/**
 * Generate custom function
 */
async function generateCustomFunction(functionName: string, options: any): Promise<string> {
  logger.info(chalk.blue('🎨 Generating custom function template...'));
  
  const { parameters, returnType, language, securityDefiner } = await inquirer.prompt([
    {
      type: 'input',
      name: 'parameters',
      message: 'Function parameters (e.g., param1 TEXT, param2 INTEGER):',
      default: ''
    },
    {
      type: 'input',
      name: 'returnType',
      message: 'Return type:',
      default: 'TEXT'
    },
    {
      type: 'list',
      name: 'language',
      message: 'Function language:',
      choices: ['plpgsql', 'sql'],
      default: 'plpgsql'
    },
    {
      type: 'confirm',
      name: 'securityDefiner',
      message: 'Use SECURITY DEFINER (run with elevated privileges)?',
      default: false
    }
  ]);
  
  const securityClause = securityDefiner ? 'SECURITY DEFINER' : '';
  const paramsList = parameters || '';
  
  return `-- Custom function: ${functionName}
-- Generated: ${new Date().toISOString()}

CREATE OR REPLACE FUNCTION ${options.schema}.${functionName}(${paramsList})
RETURNS ${returnType} AS $$
BEGIN
  -- Add your custom function logic here
  -- Example:
  -- RETURN 'Hello World';
  
  -- For plpgsql functions, you can use:
  -- - Variables: DECLARE var_name TYPE;
  -- - Conditionals: IF condition THEN ... END IF;
  -- - Loops: FOR i IN 1..10 LOOP ... END LOOP;
  -- - Queries: SELECT ... INTO variable FROM table;
  -- - Exceptions: RAISE EXCEPTION 'Error message';
  
  RETURN 'Function ${functionName} executed successfully';
END;
$$ LANGUAGE ${language} ${securityClause};

-- Grant permissions
GRANT EXECUTE ON FUNCTION ${options.schema}.${functionName}(${paramsList}) TO web_anon, web_user;

-- Add comment
COMMENT ON FUNCTION ${options.schema}.${functionName}(${paramsList}) IS 'Custom function - ${functionName}';`;
}

/**
 * Generate all utility functions
 */
async function generateAllUtilityFunctions(options: any) {
  logger.info(chalk.cyan('⚙️  Generating all utility functions'));
  logger.newLine();
  
  try {
    const generator = new FunctionGenerator(process.cwd());
    const sql = generator.generateUtilityFunctions();
    
    const header = `-- PostgreSQL Utility Functions
-- Generated by PGRestify CLI
-- 
-- Apply these functions to your database:
-- psql -d your_database -f functions.sql
--
-- Functions provide:
-- - Data validation helpers
-- - String manipulation utilities  
-- - Date/time helpers
-- - Search and formatting functions

`;
    
    await fs.ensureDir(require('path').dirname(options.output));
    await writeFunction(header + sql, options.output);
    logger.success(`💾 All utility functions saved to: ${options.output}`);
    
    displayBulkFunctionUsage(options.output);
    
  } catch (error) {
    logger.error(`❌ Failed to generate utility functions: ${error.message}`);
  }
}

/**
 * Collect custom authentication configuration
 */
async function collectCustomAuthConfig() {
  const { enableRefreshTokens, enableEmailVerification, jwtExpiresIn } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enableRefreshTokens',
      message: 'Enable refresh tokens?',
      default: true
    },
    {
      type: 'confirm', 
      name: 'enableEmailVerification',
      message: 'Enable email verification?',
      default: true
    },
    {
      type: 'input',
      name: 'jwtExpiresIn',
      message: 'JWT expiration time:',
      default: '24h'
    }
  ]);
  
  return {
    enableRefreshTokens,
    enableEmailVerification,
    jwtExpiresIn
  };
}

/**
 * Write function SQL to file
 */
async function writeFunction(sql: string, outputFile: string) {
  if (await fs.exists(outputFile)) {
    const existing = await fs.readFile(outputFile);
    await fs.writeFile(outputFile, existing + '\n\n' + sql);
  } else {
    await fs.writeFile(outputFile, sql);
  }
}

/**
 * Display function usage instructions
 */
async function displayFunctionUsage(functionName: string, functionType: string, options: any) {
  logger.newLine();
  logger.info(chalk.cyan('Usage:'));
  logger.list([
    `Apply function: pgrestify api migrate (or manually: psql -d your_db -f ${options.output})`,
    `Call via POST /rpc/${functionName}`,
    'Functions are exposed as RPC endpoints in PostgREST',
    'Pass parameters in request body as JSON'
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Function Tips:'));
  logger.list([
    `Generated ${functionType} function with best practices`,
    'Functions run with database-level security',
    'Use SECURITY DEFINER for privileged operations',
    'Add proper input validation and error handling',
    'Monitor function performance and optimize as needed'
  ]);
  
  logger.newLine();
  logger.info(chalk.cyan('Example API call:'));
  
  const postgrestConfig = await getPostgRESTConfig();
  const serverPort = postgrestConfig.serverPort;
  
  logger.code(`# Call your function via PostgREST
curl -X POST "http://localhost:${serverPort}/rpc/${functionName}" \\
     -H "Content-Type: application/json" \\
     -d '{"param1": "value1", "param2": "value2"}'`);
}

/**
 * Display bulk function usage instructions
 */
function displayBulkFunctionUsage(outputFile: string) {
  logger.newLine();
  logger.info(chalk.cyan('🚀 Generated Functions Usage:'));
  logger.list([
    `Apply all functions: psql -d your_db -f ${outputFile}`,
    'All functions are available as RPC endpoints',
    'Use /rpc/<function_name> to call each function'
  ]);
  
  logger.newLine();
  logger.info(chalk.yellow('💡 Next Steps:'));
  logger.list([
    'Test your functions with sample data',
    'Add proper input validation',
    'Monitor function performance',
    'Document function parameters and return values',
    'Set up appropriate authentication for sensitive functions'
  ]);
}

// Individual utility function generators

function generateEmailValidationFunction(functionName: string, schema: string): string {
  return `CREATE OR REPLACE FUNCTION ${schema}.${functionName}(email_input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN email_input ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;`;
}

function generatePhoneValidationFunction(functionName: string, schema: string): string {
  return `CREATE OR REPLACE FUNCTION ${schema}.${functionName}(phone_input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Remove all non-numeric characters and check length
  RETURN length(regexp_replace(phone_input, '[^0-9]', '', 'g')) BETWEEN 10 AND 15;
END;
$$ LANGUAGE plpgsql IMMUTABLE;`;
}

function generateSlugFunction(functionName: string, schema: string): string {
  return `CREATE OR REPLACE FUNCTION ${schema}.${functionName}(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    trim(
      regexp_replace(
        regexp_replace(input_text, '[^a-zA-Z0-9\\s-]', '', 'g'),
        '\\s+', '-', 'g'
      ), 
      '-'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;`;
}

function generateRandomIdFunction(functionName: string, schema: string): string {
  return `CREATE OR REPLACE FUNCTION ${schema}.${functionName}(length_param INTEGER DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length_param LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;`;
}

function generateTimestampUtilities(functionName: string, schema: string): string {
  return `CREATE OR REPLACE FUNCTION ${schema}.${functionName}_start_of_day(input_timestamp TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN date_trunc('day', input_timestamp);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION ${schema}.${functionName}_end_of_day(input_timestamp TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN date_trunc('day', input_timestamp) + INTERVAL '23 hours 59 minutes 59 seconds';
END;
$$ LANGUAGE plpgsql IMMUTABLE;`;
}

function generateSearchFunction(functionName: string, schema: string): string {
  return `CREATE OR REPLACE FUNCTION ${schema}.${functionName}(
  search_query TEXT,
  table_name TEXT,
  search_columns TEXT[]
)
RETURNS TABLE(score NUMERIC, result JSONB) AS $$
DECLARE
  query_sql TEXT;
BEGIN
  -- Build dynamic search query with ranking
  query_sql := format(
    'SELECT 
       ts_rank(to_tsvector(''english'', %s), plainto_tsquery(''english'', $1)) as score,
       row_to_json(%I) as result
     FROM %I
     WHERE to_tsvector(''english'', %s) @@ plainto_tsquery(''english'', $1)
     ORDER BY score DESC',
    array_to_string(search_columns, ' || '' '' || '),
    table_name,
    table_name,
    array_to_string(search_columns, ' || '' '' || ')
  );
  
  RETURN QUERY EXECUTE query_sql USING search_query;
END;
$$ LANGUAGE plpgsql;`;
}