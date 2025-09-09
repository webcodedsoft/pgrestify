/**
 * Robust database query utilities
 * Handles different PostgreSQL versions and configurations gracefully
 */

import chalk from 'chalk';
import { logger } from './logger.js';
import { parsePostgreSQLArray, parsePostgreSQLTextArray } from './postgres-array-parser.js';

export interface DatabaseInfo {
  version: string;
  majorVersion: number;
  hasInformationSchemaViews: boolean;
  hasViewTableUsage: boolean;
  hasRoutineTableUsage: boolean;
}

/**
 * Detect PostgreSQL version and capabilities
 */
export async function detectDatabaseCapabilities(pool: any): Promise<DatabaseInfo> {
  try {
    const versionResult = await pool.query('SELECT version()');
    const versionString = versionResult.rows[0].version;
    const majorVersion = parseInt(versionString.match(/PostgreSQL (\d+)/)?.[1] || '0');
    
    logger.debug(`Detected PostgreSQL version: ${versionString}`);
    
    // Test for table existence
    const hasViewTableUsage = await tableExists(pool, 'information_schema', 'view_table_usage');
    const hasRoutineTableUsage = await tableExists(pool, 'information_schema', 'routine_table_usage');
    
    return {
      version: versionString,
      majorVersion,
      hasInformationSchemaViews: true, // Always present in modern PostgreSQL
      hasViewTableUsage,
      hasRoutineTableUsage
    };
  } catch (error) {
    logger.warn(`Could not detect database capabilities: ${error.message}`);
    // Return minimal safe defaults
    return {
      version: 'Unknown',
      majorVersion: 12, // Safe assumption for modern PostgreSQL
      hasInformationSchemaViews: true,
      hasViewTableUsage: false,
      hasRoutineTableUsage: false
    };
  }
}

/**
 * Check if a table exists in the database
 */
async function tableExists(pool: any, schema: string, tableName: string): Promise<boolean> {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
      ) as exists
    `, [schema, tableName]);
    
    return result.rows[0]?.exists || false;
  } catch (error) {
    logger.debug(`Error checking table existence for ${schema}.${tableName}: ${error.message}`);
    return false;
  }
}

/**
 * Robustly fetch views with dependency information
 */
export async function fetchViews(pool: any, schema: string, dbInfo: DatabaseInfo): Promise<any[]> {
  try {
    logger.debug('Fetching views...');
    
    // Start with basic view query that always works
    let query = `
      SELECT 
        v.table_name as view_name,
        v.view_definition,
        v.is_updatable,
        COALESCE(obj_description(pgc.oid), '') as view_comment
      FROM information_schema.views v
      LEFT JOIN pg_class pgc ON pgc.relname = v.table_name AND pgc.relnamespace = (
        SELECT oid FROM pg_namespace WHERE nspname = $1
      )
      WHERE v.table_schema = $1
      ORDER BY v.table_name
    `;
    
    const result = await pool.query(query, [schema]);
    logger.debug(`Found ${result.rows.length} views`);
    
    // Try to add dependency information if supported
    if (dbInfo.hasViewTableUsage) {
      return await enhanceViewsWithDependencies(pool, schema, result.rows);
    }
    
    return result.rows;
    
  } catch (error) {
    logger.warn(`Error fetching views: ${error.message}`);
    
    // Fallback to minimal query
    try {
      const fallbackResult = await pool.query(`
        SELECT 
          table_name as view_name,
          view_definition,
          'YES' as is_updatable,
          '' as view_comment
        FROM information_schema.views
        WHERE table_schema = $1
        ORDER BY table_name
      `, [schema]);
      
      logger.info(`Using fallback view query, found ${fallbackResult.rows.length} views`);
      return fallbackResult.rows;
      
    } catch (fallbackError) {
      logger.error(`Fallback view query also failed: ${fallbackError.message}`);
      return [];
    }
  }
}

/**
 * Robustly fetch functions with dependency information
 */
export async function fetchFunctions(pool: any, schema: string, dbInfo: DatabaseInfo): Promise<any[]> {
  try {
    logger.debug('Fetching functions...');
    
    // Start with basic function query that always works
    let query = `
      SELECT 
        r.routine_name as function_name,
        COALESCE(r.routine_definition, '') as function_body,
        r.routine_type,
        COALESCE(r.data_type, 'void') as return_type,
        COALESCE(r.security_type, 'DEFINER') as security_type,
        COALESCE(obj_description(p.oid), '') as function_comment,
        COALESCE(pg_get_functiondef(p.oid), '') as full_definition
      FROM information_schema.routines r
      LEFT JOIN pg_proc p ON p.proname = r.routine_name AND p.pronamespace = (
        SELECT oid FROM pg_namespace WHERE nspname = $1
      )
      WHERE r.routine_schema = $1
        AND r.routine_type IN ('FUNCTION', 'PROCEDURE')
      ORDER BY r.routine_name
    `;
    
    const result = await pool.query(query, [schema]);
    logger.debug(`Found ${result.rows.length} functions`);
    
    // Try to add dependency information if supported
    if (dbInfo.hasRoutineTableUsage) {
      return await enhanceFunctionsWithDependencies(pool, schema, result.rows);
    }
    
    return result.rows;
    
  } catch (error) {
    logger.warn(`Error fetching functions: ${error.message}`);
    
    // Fallback to minimal query
    try {
      const fallbackResult = await pool.query(`
        SELECT 
          routine_name as function_name,
          '' as function_body,
          routine_type,
          'void' as return_type,
          'DEFINER' as security_type,
          '' as function_comment,
          '' as full_definition
        FROM information_schema.routines
        WHERE routine_schema = $1
          AND routine_type IN ('FUNCTION', 'PROCEDURE')  
        ORDER BY routine_name
      `, [schema]);
      
      logger.info(`Using fallback function query, found ${fallbackResult.rows.length} functions`);
      return fallbackResult.rows;
      
    } catch (fallbackError) {
      logger.error(`Fallback function query also failed: ${fallbackError.message}`);
      return [];
    }
  }
}

/**
 * Enhance views with dependency information (when available)
 */
async function enhanceViewsWithDependencies(pool: any, schema: string, views: any[]): Promise<any[]> {
  try {
    logger.debug('Enhancing views with dependency information...');
    
    const dependencyQuery = `
      SELECT 
        dep.view_name,
        array_agg(DISTINCT dep.table_name) FILTER (WHERE dep.table_name IS NOT NULL) as dependent_tables
      FROM information_schema.view_table_usage dep
      WHERE dep.view_schema = $1
      GROUP BY dep.view_name
    `;
    
    const depResult = await pool.query(dependencyQuery, [schema]);
    const dependencyMap = new Map();
    
    depResult.rows.forEach(row => {
      const tables = parsePostgreSQLArray(row.dependent_tables);
      dependencyMap.set(row.view_name, tables);
    });
    
    // Merge dependency info with views
    return views.map(view => ({
      ...view,
      dependent_tables: dependencyMap.get(view.view_name) || []
    }));
    
  } catch (error) {
    logger.warn(`Could not enhance views with dependencies: ${error.message}`);
    return views.map(view => ({ ...view, dependent_tables: [] }));
  }
}

/**
 * Enhance functions with dependency information (when available)
 */
async function enhanceFunctionsWithDependencies(pool: any, schema: string, functions: any[]): Promise<any[]> {
  try {
    logger.debug('Enhancing functions with dependency information...');
    
    const dependencyQuery = `
      SELECT 
        dep.routine_name as function_name,
        array_agg(DISTINCT dep.table_name) FILTER (WHERE dep.table_name IS NOT NULL) as dependent_tables
      FROM information_schema.routine_table_usage dep
      WHERE dep.routine_schema = $1
      GROUP BY dep.routine_name
    `;
    
    const depResult = await pool.query(dependencyQuery, [schema]);
    const dependencyMap = new Map();
    
    depResult.rows.forEach(row => {
      const tables = parsePostgreSQLArray(row.dependent_tables);
      dependencyMap.set(row.function_name, tables);
    });
    
    // Merge dependency info with functions
    return functions.map(func => ({
      ...func,
      dependent_tables: dependencyMap.get(func.function_name) || []
    }));
    
  } catch (error) {
    logger.warn(`Could not enhance functions with dependencies: ${error.message}`);
    return functions.map(func => ({ ...func, dependent_tables: [] }));
  }
}

/**
 * Robust RLS policies fetch with error handling
 */
export async function fetchRLSPolicies(pool: any, schema: string, tableName: string): Promise<any[]> {
  try {
    logger.debug(`Fetching RLS policies for ${tableName}...`);
    
    const result = await pool.query(`
      SELECT 
        p.policyname as policy_name,
        p.cmd as command,
        p.permissive,
        p.roles,
        p.qual as using_expression,
        p.with_check as with_check_expression
      FROM pg_policies p
      WHERE p.schemaname = $1 AND p.tablename = $2
      ORDER BY p.policyname
    `, [schema, tableName]);
    
    // Safely parse roles arrays
    return result.rows.map(policy => ({
      ...policy,
      roles: parsePostgreSQLTextArray(policy.roles)
    }));
    
  } catch (error) {
    logger.warn(`Error fetching RLS policies for ${tableName}: ${error.message}`);
    return [];
  }
}

/**
 * Validate and sanitize database object names
 */
export function validateIdentifier(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  
  // PostgreSQL identifier rules: start with letter or underscore, contain letters, digits, underscores, dollar signs
  const validPattern = /^[a-zA-Z_][a-zA-Z0-9_$]*$/;
  
  return validPattern.test(name) && name.length <= 63; // PostgreSQL identifier limit
}

/**
 * Safely escape SQL identifiers
 */
export function escapeIdentifier(name: string): string {
  if (!validateIdentifier(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  
  // Use double quotes for case-sensitive or special identifiers
  return `"${name.replace(/"/g, '""')}"`;
}