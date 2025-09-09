import chalk from 'chalk';
import { SchemaInspector, TableColumn, DatabaseConnection } from './SchemaInspector.js';
import { getPostgRESTConfig, generateGrantStatement } from '../utils/postgrest-config.js';

export interface FunctionParameter {
  name: string;
  type: string;
  defaultValue?: string;
}

export interface CustomFunctionConfig {
  name: string;
  parameters: FunctionParameter[];
  returnType: string;
  body: string;
  schema?: string;
  security?: 'DEFINER' | 'INVOKER';
  language?: 'plpgsql' | 'sql';
  volatility?: 'VOLATILE' | 'STABLE' | 'IMMUTABLE';
}

export interface AuthFunctionConfig {
  jwtSecret?: string;
  anonRole?: string;
  authenticatedRole?: string;
  adminRole?: string;
  jwtExpiresIn?: string;
  hashRounds?: number;
  enableRefreshTokens?: boolean;
  enableEmailVerification?: boolean;
  customClaims?: Record<string, any>;
  // PostgREST configuration
  schema?: string;
  serverHost?: string;
  serverPort?: number;
  preRequest?: string;
}

export class FunctionGenerator {
  private schemaInspector: SchemaInspector;

  constructor(private projectPath: string) {
    this.schemaInspector = new SchemaInspector(projectPath);
  }

  /**
   * Generate authentication functions
   */
  async generateAuthFunctions(options: AuthFunctionConfig, connection?: DatabaseConnection): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig(connection);
    const { 
      anonRole = postgrestConfig.anonRole, 
      authenticatedRole = 'authenticated', 
      adminRole = 'admin' 
    } = options;
    
    return `-- Authentication helper functions
-- Generated on ${new Date().toISOString()}

-- Create auth schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS auth;

-- Get current user ID from JWT
CREATE OR REPLACE FUNCTION auth.current_user_id() RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'sub')::uuid,
    (current_setting('request.jwt.claims', true)::json->>'user_id')::uuid,
    (current_setting('request.jwt.claims', true)::json->>'id')::uuid
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get current user role from JWT  
CREATE OR REPLACE FUNCTION auth.current_user_role() RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'role',
    CASE 
      WHEN auth.current_user_id() IS NOT NULL THEN '${authenticatedRole}'
      ELSE '${anonRole}'
    END
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get current user email from JWT
CREATE OR REPLACE FUNCTION auth.current_user_email() RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'email';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION auth.is_admin() RETURNS BOOLEAN AS $$
  SELECT auth.current_user_role() IN ('${adminRole}', 'admin', 'superuser');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if current user is authenticated
CREATE OR REPLACE FUNCTION auth.is_authenticated() RETURNS BOOLEAN AS $$
  SELECT auth.current_user_id() IS NOT NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user owns a resource
CREATE OR REPLACE FUNCTION auth.owns_resource(resource_user_id UUID) RETURNS BOOLEAN AS $$
  SELECT resource_user_id = auth.current_user_id() OR auth.is_admin();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if user can access resource (owner or admin)
CREATE OR REPLACE FUNCTION auth.can_access_user_data(target_user_id UUID) RETURNS BOOLEAN AS $$
  SELECT target_user_id = auth.current_user_id() OR auth.is_admin();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Hash password function
CREATE OR REPLACE FUNCTION auth.encrypt_password(password TEXT) RETURNS TEXT AS $$
BEGIN
  IF password IS NULL OR length(trim(password)) = 0 THEN
    RAISE EXCEPTION 'Password cannot be empty';
  END IF;
  
  RETURN crypt(password, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify password function
CREATE OR REPLACE FUNCTION auth.verify_password(password TEXT, hash TEXT) RETURNS BOOLEAN AS $$
BEGIN
  IF password IS NULL OR hash IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN hash = crypt(password, hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate secure random token
CREATE OR REPLACE FUNCTION auth.generate_token(length INTEGER DEFAULT 32) RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER := 0;
BEGIN
  IF length < 1 THEN
    RAISE EXCEPTION 'Token length must be positive';
  END IF;
  
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars))::int + 1, 1);
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Validate email format
CREATE OR REPLACE FUNCTION auth.is_valid_email(email TEXT) RETURNS BOOLEAN AS $$
BEGIN
  RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- Password strength validation
CREATE OR REPLACE FUNCTION auth.is_strong_password(password TEXT) RETURNS BOOLEAN AS $$
BEGIN
  RETURN length(password) >= 8 
    AND password ~ '[a-z]'      -- lowercase
    AND password ~ '[A-Z]'      -- uppercase  
    AND password ~ '[0-9]'      -- number
    AND password ~ '[^a-zA-Z0-9]'; -- special character
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- Rate limiting check (requires rate_limits table)
CREATE OR REPLACE FUNCTION auth.check_rate_limit(
  identifier TEXT,
  action_type TEXT,
  max_attempts INTEGER DEFAULT 5,
  window_minutes INTEGER DEFAULT 15
) RETURNS BOOLEAN AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  -- Count attempts in the time window
  SELECT COUNT(*) INTO attempt_count
  FROM auth.rate_limits 
  WHERE rate_limit_key = identifier || ':' || action_type
    AND created_at > NOW() - INTERVAL '1 minute' * window_minutes;
    
  -- Log this attempt
  INSERT INTO auth.rate_limits (rate_limit_key, action_type, identifier, created_at)
  VALUES (identifier || ':' || action_type, action_type, identifier, NOW())
  ON CONFLICT (rate_limit_key) DO UPDATE SET 
    created_at = NOW(),
    attempt_count = auth.rate_limits.attempt_count + 1;
    
  RETURN attempt_count < max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create rate limits table if it doesn't exist
CREATE TABLE IF NOT EXISTS auth.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_limit_key TEXT UNIQUE NOT NULL,
  action_type TEXT NOT NULL,
  identifier TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ GENERATED ALWAYS AS (created_at + INTERVAL '1 hour') STORED
);

-- Create index for cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires 
  ON auth.rate_limits (expires_at);

-- Cleanup function for expired rate limits
CREATE OR REPLACE FUNCTION auth.cleanup_rate_limits() RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM auth.rate_limits 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
${generateGrantStatement('ALL', 'ALL FUNCTIONS IN SCHEMA auth', { anonRole, schema: 'auth' }, true)}
GRANT USAGE ON SCHEMA auth TO ${anonRole};
GRANT USAGE ON SCHEMA auth TO ${authenticatedRole};

-- Grant table permissions for rate limiting
${generateGrantStatement('SELECT, INSERT, UPDATE, DELETE', 'auth.rate_limits', { anonRole }, true)}

`;
  }

  /**
   * Generate utility functions
   */
  generateUtilityFunctions(): string {
    return `-- Utility functions
-- Generated on ${new Date().toISOString()}

-- Create utils schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS utils;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION utils.update_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Generate slug from text
CREATE OR REPLACE FUNCTION utils.slugify(text_input TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        trim(text_input), 
        '[^a-zA-Z0-9\\s-]', '', 'g'
      ), 
      '\\s+', '-', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Generate unique slug with counter
CREATE OR REPLACE FUNCTION utils.generate_unique_slug(
  base_text TEXT,
  table_name TEXT,
  slug_column TEXT DEFAULT 'slug'
) RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
  exists_query TEXT;
  slug_exists BOOLEAN;
BEGIN
  base_slug := utils.slugify(base_text);
  final_slug := base_slug;
  
  LOOP
    -- Build dynamic query to check existence
    exists_query := format('SELECT EXISTS(SELECT 1 FROM %I WHERE %I = $1)', table_name, slug_column);
    
    EXECUTE exists_query USING final_slug INTO slug_exists;
    
    IF NOT slug_exists THEN
      EXIT;
    END IF;
    
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Generate random string with customizable character set
CREATE OR REPLACE FUNCTION utils.random_string(
  length INTEGER DEFAULT 32,
  character_set TEXT DEFAULT 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
) RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
  i INTEGER := 0;
  chars_length INTEGER;
BEGIN
  IF length < 0 THEN
    RAISE EXCEPTION 'Length cannot be negative';
  END IF;
  
  chars_length := length(character_set);
  
  FOR i IN 1..length LOOP
    result := result || substr(character_set, floor(random() * chars_length)::int + 1, 1);
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Generate URL-safe random string
CREATE OR REPLACE FUNCTION utils.random_url_safe(length INTEGER DEFAULT 32) RETURNS TEXT AS $$
BEGIN
  RETURN utils.random_string(length, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_');
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Audit trigger function
CREATE OR REPLACE FUNCTION utils.audit_trigger() RETURNS TRIGGER AS $$
DECLARE
  audit_row RECORD;
BEGIN
  -- Create audit record
  IF TG_OP = 'DELETE' THEN
    INSERT INTO utils.audit_log (
      table_name, operation, user_id, old_data, new_data, created_at
    ) VALUES (
      TG_TABLE_NAME, TG_OP, auth.current_user_id(), to_jsonb(OLD), NULL, NOW()
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO utils.audit_log (
      table_name, operation, user_id, old_data, new_data, created_at
    ) VALUES (
      TG_TABLE_NAME, TG_OP, auth.current_user_id(), to_jsonb(OLD), to_jsonb(NEW), NOW()
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO utils.audit_log (
      table_name, operation, user_id, old_data, new_data, created_at
    ) VALUES (
      TG_TABLE_NAME, TG_OP, auth.current_user_id(), NULL, to_jsonb(NEW), NOW()
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit log table
CREATE TABLE IF NOT EXISTS utils.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  user_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON utils.audit_log (table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON utils.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON utils.audit_log (user_id);

-- Full-text search function
CREATE OR REPLACE FUNCTION utils.search_text(
  search_term TEXT,
  table_name TEXT,
  search_columns TEXT[]
) RETURNS TABLE(id UUID, rank REAL, headline TEXT) AS $$
DECLARE
  query TEXT;
  col TEXT;
  search_vector TEXT;
BEGIN
  -- Build search vector from columns
  search_vector := array_to_string(
    array(SELECT format('COALESCE(%I, '''')', col) FROM unnest(search_columns) AS col),
    ' || \' \' || '
  );
  
  -- Build dynamic search query
  query := format('
    SELECT id, 
           ts_rank(to_tsvector(''english'', %s), plainto_tsquery($1)) as rank,
           ts_headline(''english'', %s, plainto_tsquery($1)) as headline
    FROM %I 
    WHERE to_tsvector(''english'', %s) @@ plainto_tsquery($1)
    ORDER BY rank DESC
    LIMIT 100',
    search_vector, search_vector, table_name, search_vector
  );
  
  RETURN QUERY EXECUTE query USING search_term;
END;
$$ LANGUAGE plpgsql;

-- JSON validation function
CREATE OR REPLACE FUNCTION utils.is_valid_json(json_text TEXT) RETURNS BOOLEAN AS $$
BEGIN
  BEGIN
    PERFORM json_text::json;
    RETURN true;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- JSONB validation function
CREATE OR REPLACE FUNCTION utils.is_valid_jsonb(jsonb_text TEXT) RETURNS BOOLEAN AS $$
BEGIN
  BEGIN
    PERFORM jsonb_text::jsonb;
    RETURN true;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- URL validation function
CREATE OR REPLACE FUNCTION utils.is_valid_url(url TEXT) RETURNS BOOLEAN AS $$
BEGIN
  RETURN url ~* '^https?://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(/.*)?$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Phone number validation function (basic)
CREATE OR REPLACE FUNCTION utils.is_valid_phone(phone TEXT) RETURNS BOOLEAN AS $$
BEGIN
  -- Remove all non-digit characters for validation
  RETURN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[0-9]{10,15}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION utils.calculate_distance(
  lat1 DECIMAL, lon1 DECIMAL, 
  lat2 DECIMAL, lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  R DECIMAL := 6371; -- Earth's radius in kilometers
  dLat DECIMAL;
  dLon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  dLat := radians(lat2 - lat1);
  dLon := radians(lon2 - lon1);
  
  a := sin(dLat/2) * sin(dLat/2) + 
       cos(radians(lat1)) * cos(radians(lat2)) * 
       sin(dLon/2) * sin(dLon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Pagination helper function
CREATE OR REPLACE FUNCTION utils.paginate(
  total_count BIGINT,
  page_size INTEGER DEFAULT 20,
  current_page INTEGER DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
  total_pages INTEGER;
  offset_val INTEGER;
  has_next BOOLEAN;
  has_prev BOOLEAN;
BEGIN
  total_pages := CEIL(total_count::DECIMAL / page_size);
  offset_val := (current_page - 1) * page_size;
  has_next := current_page < total_pages;
  has_prev := current_page > 1;
  
  RETURN jsonb_build_object(
    'total_count', total_count,
    'page_size', page_size,
    'current_page', current_page,
    'total_pages', total_pages,
    'offset', offset_val,
    'has_next', has_next,
    'has_previous', has_prev
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant execute permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA utils TO authenticated;
GRANT USAGE ON SCHEMA utils TO authenticated;
GRANT USAGE ON SCHEMA utils TO web_anon;

-- Grant table permissions for audit log
GRANT SELECT, INSERT ON utils.audit_log TO authenticated;
GRANT SELECT ON utils.audit_log TO web_anon;

`;
  }

  /**
   * Generate custom function
   */
  async generateCustomFunction(config: CustomFunctionConfig): Promise<string> {
    const postgrestConfig = await getPostgRESTConfig();
    const { 
      name, 
      parameters, 
      returnType, 
      body, 
      schema = postgrestConfig.dbSchemas, 
      security = 'DEFINER',
      language = 'plpgsql',
      volatility = 'VOLATILE'
    } = config;
    
    const paramList = parameters.map(p => 
      `${p.name} ${p.type}${p.defaultValue ? ` DEFAULT ${p.defaultValue}` : ''}`
    ).join(', ');
    
    return `-- Custom function: ${name}
-- Generated on ${new Date().toISOString()}

CREATE OR REPLACE FUNCTION ${schema}.${name}(${paramList})
RETURNS ${returnType} AS $$
${body}
$$ LANGUAGE ${language} ${volatility} SECURITY ${security};

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION ${schema}.${name}(${parameters.map(p => p.type).join(', ')}) TO authenticated;

-- Add function comment
COMMENT ON FUNCTION ${schema}.${name} IS 'Custom function generated by PGRestify CLI';

`;
  }

  /**
   * Generate CRUD functions for a table
   */
  async generateCRUDFunctions(tableName: string, connection?: DatabaseConnection): Promise<string> {
    const dbConnection = connection || await this.schemaInspector.extractDatabaseConnection();
    if (!dbConnection) {
      throw new Error('Database connection required for CRUD function generation');
    }
    const postgrestConfig = await getPostgRESTConfig(dbConnection);

    const columns = await this.schemaInspector.analyzeTable(tableName, dbConnection);
    const pkColumn = columns.find(c => c.isPrimaryKey);
    
    if (!pkColumn) {
      throw new Error(`Table ${tableName} has no primary key`);
    }

    const insertColumns = columns.filter(c => !c.isPrimaryKey || c.name !== 'id');
    const updateColumns = columns.filter(c => !c.isPrimaryKey && c.name !== 'created_at');

    return `-- CRUD functions for ${tableName}
-- Generated on ${new Date().toISOString()}

-- Create function
CREATE OR REPLACE FUNCTION ${postgrestConfig.schema}.create_${tableName}(
  ${insertColumns.map(c => `${c.name} ${c.type}`).join(',\n  ')}
) RETURNS ${postgrestConfig.schema}.${tableName} AS $$
DECLARE
  new_record ${postgrestConfig.schema}.${tableName};
BEGIN
  INSERT INTO ${postgrestConfig.schema}.${tableName} (
    ${insertColumns.map(c => c.name).join(', ')}
  ) VALUES (
    ${insertColumns.map(c => c.name).join(', ')}
  ) RETURNING * INTO new_record;
  
  RETURN new_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Read function
CREATE OR REPLACE FUNCTION ${postgrestConfig.schema}.get_${tableName}(
  ${pkColumn.name}_param ${pkColumn.type}
) RETURNS ${postgrestConfig.schema}.${tableName} AS $$
DECLARE
  record_result ${postgrestConfig.schema}.${tableName};
BEGIN
  SELECT * INTO record_result
  FROM ${postgrestConfig.schema}.${tableName}
  WHERE ${pkColumn.name} = ${pkColumn.name}_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION '${tableName} not found with ${pkColumn.name}: %', ${pkColumn.name}_param;
  END IF;
  
  RETURN record_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update function
CREATE OR REPLACE FUNCTION ${postgrestConfig.schema}.update_${tableName}(
  ${pkColumn.name}_param ${pkColumn.type},
  ${updateColumns.map(c => `${c.name} ${c.type} DEFAULT NULL`).join(',\n  ')}
) RETURNS ${postgrestConfig.schema}.${tableName} AS $$
DECLARE
  updated_record ${postgrestConfig.schema}.${tableName};
BEGIN
  UPDATE ${postgrestConfig.schema}.${tableName} SET
    ${updateColumns.map(c => 
      `${c.name} = COALESCE(${c.name}, ${postgrestConfig.schema}.${tableName}.${c.name})`
    ).join(',\n    ')},
    updated_at = NOW()
  WHERE ${pkColumn.name} = ${pkColumn.name}_param
  RETURNING * INTO updated_record;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION '${tableName} not found with ${pkColumn.name}: %', ${pkColumn.name}_param;
  END IF;
  
  RETURN updated_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete function
CREATE OR REPLACE FUNCTION ${postgrestConfig.schema}.delete_${tableName}(
  ${pkColumn.name}_param ${pkColumn.type}
) RETURNS BOOLEAN AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ${postgrestConfig.schema}.${tableName}
  WHERE ${pkColumn.name} = ${pkColumn.name}_param;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  IF deleted_count = 0 THEN
    RAISE EXCEPTION '${tableName} not found with ${pkColumn.name}: %', ${pkColumn.name}_param;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
${generateGrantStatement('EXECUTE', `FUNCTION ${postgrestConfig.schema}.create_${tableName}`, postgrestConfig, false)}
${generateGrantStatement('EXECUTE', `FUNCTION ${postgrestConfig.schema}.get_${tableName}`, postgrestConfig, false)}
${generateGrantStatement('EXECUTE', `FUNCTION ${postgrestConfig.schema}.update_${tableName}`, postgrestConfig, false)}
${generateGrantStatement('EXECUTE', `FUNCTION ${postgrestConfig.schema}.delete_${tableName}`, postgrestConfig, false)}

`;
  }

  /**
   * Generate validation functions based on table columns
   */
  async generateValidationFunctions(tableName: string, connection?: DatabaseConnection): Promise<string> {
    const dbConnection = connection || await this.schemaInspector.extractDatabaseConnection();
    if (!dbConnection) {
      throw new Error('Database connection required for validation function generation');
    }
    const postgrestConfig = await getPostgRESTConfig(dbConnection);

    const columns = await this.schemaInspector.analyzeTable(tableName, dbConnection);
    
    let functions = `-- Validation functions for ${tableName}\n`;
    functions += `-- Generated on ${new Date().toISOString()}\n\n`;

    // Generate validation function for the entire record
    functions += `CREATE OR REPLACE FUNCTION ${postgrestConfig.schema}.validate_${tableName}(
  data JSONB
) RETURNS JSONB AS $$
DECLARE
  errors JSONB := '[]'::JSONB;
  field_value TEXT;
BEGIN
  -- Validate required fields
  ${columns.filter(c => !c.nullable).map(c => `
  IF NOT (data ? '${c.name}') OR (data->>'${c.name}') IS NULL OR trim(data->>'${c.name}') = '' THEN
    errors := errors || jsonb_build_object('field', '${c.name}', 'message', '${c.name} is required');
  END IF;`).join('')}

  -- Validate data types and formats
  ${columns.map(c => this.generateColumnValidation(c)).filter(v => v).join('\n')}

  RETURN jsonb_build_object('valid', jsonb_array_length(errors) = 0, 'errors', errors);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

${generateGrantStatement('EXECUTE', `FUNCTION ${postgrestConfig.schema}.validate_${tableName}`, postgrestConfig, false)}

`;

    return functions;
  }

  /**
   * Generate column-specific validation
   */
  private generateColumnValidation(column: TableColumn): string {
    const validations: string[] = [];

    switch (column.type.toUpperCase()) {
      case 'UUID':
        validations.push(`
  -- Validate ${column.name} UUID format
  field_value := data->>'${column.name}';
  IF field_value IS NOT NULL AND field_value !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    errors := errors || jsonb_build_object('field', '${column.name}', 'message', '${column.name} must be a valid UUID');
  END IF;`);
        break;

      case 'TEXT':
      case 'VARCHAR':
        if (column.name.toLowerCase().includes('email')) {
          validations.push(`
  -- Validate ${column.name} email format
  field_value := data->>'${column.name}';
  IF field_value IS NOT NULL AND NOT auth.is_valid_email(field_value) THEN
    errors := errors || jsonb_build_object('field', '${column.name}', 'message', '${column.name} must be a valid email address');
  END IF;`);
        } else if (column.name.toLowerCase().includes('url')) {
          validations.push(`
  -- Validate ${column.name} URL format
  field_value := data->>'${column.name}';
  IF field_value IS NOT NULL AND NOT utils.is_valid_url(field_value) THEN
    errors := errors || jsonb_build_object('field', '${column.name}', 'message', '${column.name} must be a valid URL');
  END IF;`);
        } else if (column.maxLength) {
          validations.push(`
  -- Validate ${column.name} length
  field_value := data->>'${column.name}';
  IF field_value IS NOT NULL AND length(field_value) > ${column.maxLength} THEN
    errors := errors || jsonb_build_object('field', '${column.name}', 'message', '${column.name} cannot exceed ${column.maxLength} characters');
  END IF;`);
        }
        break;

      case 'INTEGER':
      case 'BIGINT':
        validations.push(`
  -- Validate ${column.name} numeric format
  field_value := data->>'${column.name}';
  IF field_value IS NOT NULL AND field_value !~ '^-?[0-9]+$' THEN
    errors := errors || jsonb_build_object('field', '${column.name}', 'message', '${column.name} must be a valid integer');
  END IF;`);
        break;

      case 'BOOLEAN':
        validations.push(`
  -- Validate ${column.name} boolean format
  field_value := data->>'${column.name}';
  IF field_value IS NOT NULL AND field_value NOT IN ('true', 'false', '1', '0') THEN
    errors := errors || jsonb_build_object('field', '${column.name}', 'message', '${column.name} must be a valid boolean');
  END IF;`);
        break;

      case 'JSONB':
      case 'JSON':
        validations.push(`
  -- Validate ${column.name} JSON format
  field_value := data->>'${column.name}';
  IF field_value IS NOT NULL AND NOT utils.is_valid_json(field_value) THEN
    errors := errors || jsonb_build_object('field', '${column.name}', 'message', '${column.name} must be valid JSON');
  END IF;`);
        break;
    }

    return validations.join('\n');
  }
}