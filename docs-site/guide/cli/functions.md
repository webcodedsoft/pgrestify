# PostgreSQL Functions

PGRestify CLI provides comprehensive tools for generating and managing PostgreSQL functions optimized for PostgREST usage. This includes authentication functions, CRUD helpers, utilities, and custom business logic endpoints.

## Overview

PostgreSQL functions in PostgREST serve as:

- **RPC Endpoints**: Custom API endpoints beyond basic CRUD operations
- **Authentication Logic**: JWT-based login, registration, and token refresh
- **Business Logic**: Complex operations that require server-side processing
- **Data Validation**: Input validation and sanitization functions
- **Utility Functions**: Common operations like search, pagination, and formatting

## Function Commands

### Generate Functions from Schema

Generate multiple functions based on your database schema:

```bash
# Interactive function generation
pgrestify api functions generate

# Generate specific function types
pgrestify api functions generate --auth --crud --utils

# Generate with custom output location
pgrestify api functions generate --output ./sql/functions/generated.sql
```

#### Generate Options

```bash
pgrestify api functions generate [options]

Options:
  --schema <name>        Schema name
  --output <file>        Output file (default: ./sql/functions/generated.sql)
  --auth                 Include authentication functions (default: true)
  --crud                 Include CRUD helper functions (default: true)
  --utils                Include utility functions (default: true)
```

#### Interactive Generation

When running without flags, the CLI prompts for function types:

```bash
$ pgrestify api functions generate

⚡ Generating PostgREST Functions

? Select function types to generate:
 ◉ Authentication functions (login, register, refresh)
 ◉ CRUD helper functions (search, paginate, bulk operations)
 ◉ Utility functions (timestamps, validation, formatting)
 ◯ Custom endpoints (business logic functions)
```

### Create Individual Functions

Create specific functions with templates:

```bash
# Create an authentication function
pgrestify api functions create login --template auth

# Create a search function
pgrestify api functions create search_posts --template search

# Create a custom function
pgrestify api functions create calculate_order_total --template custom

# Create with specific return type and schema
pgrestify api functions create validate_user \
  --template validation \
  --returns boolean \
  --schema api
```

#### Create Options

```bash
pgrestify api functions create <name> [options]

Arguments:
  name                   Function name

Options:
  --template <type>      Function template (auth|crud|search|custom|validation)
  --schema <name>        Schema name
  --output <file>        Output file
  --returns <type>       Return type (default: JSON)
```

## Function Templates

### Authentication Functions

JWT-based authentication with login, registration, and token management:

```sql
-- Generated authentication functions
CREATE OR REPLACE FUNCTION auth.login(email TEXT, password TEXT)
RETURNS JSON AS $$
DECLARE
  user_record users%ROWTYPE;
  jwt_token TEXT;
BEGIN
  -- Validate credentials
  SELECT * INTO user_record
  FROM users
  WHERE users.email = login.email
    AND users.password_hash = crypt(login.password, users.password_hash);

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invalid credentials');
  END IF;

  -- Generate JWT token
  jwt_token := sign(
    json_build_object(
      'role', user_record.role,
      'user_id', user_record.id,
      'exp', extract(epoch from (now() + interval '24 hours'))
    ),
    current_setting('app.jwt_secret')
  );

  RETURN json_build_object(
    'token', jwt_token,
    'user', row_to_json(user_record)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.register(
  email TEXT,
  password TEXT,
  full_name TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  new_user users%ROWTYPE;
BEGIN
  -- Insert new user
  INSERT INTO users (email, password_hash, full_name)
  VALUES (
    register.email,
    crypt(register.password, gen_salt('bf')),
    register.full_name
  )
  RETURNING * INTO new_user;

  RETURN json_build_object(
    'success', true,
    'user', row_to_json(new_user)
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('error', 'Email already exists');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### CRUD Helper Functions

Functions for complex CRUD operations:

```sql
-- Search function with pagination
CREATE OR REPLACE FUNCTION search_posts(
  query TEXT DEFAULT '',
  page_limit INTEGER DEFAULT 10,
  page_offset INTEGER DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
  total_count INTEGER;
  posts_data JSON;
BEGIN
  -- Get total count
  SELECT count(*) INTO total_count
  FROM posts
  WHERE (query = '' OR title ILIKE '%' || query || '%' OR content ILIKE '%' || query || '%')
    AND published = true;

  -- Get paginated results
  SELECT json_agg(row_to_json(p)) INTO posts_data
  FROM (
    SELECT id, title, content, created_at, author_id
    FROM posts
    WHERE (query = '' OR title ILIKE '%' || query || '%' OR content ILIKE '%' || query || '%')
      AND published = true
    ORDER BY created_at DESC
    LIMIT page_limit
    OFFSET page_offset
  ) p;

  RETURN json_build_object(
    'data', COALESCE(posts_data, '[]'::json),
    'total', total_count,
    'page', page_offset / page_limit + 1,
    'per_page', page_limit,
    'total_pages', CEIL(total_count::DECIMAL / page_limit)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Bulk operations
CREATE OR REPLACE FUNCTION bulk_update_posts(
  post_ids UUID[],
  updates JSON
)
RETURNS JSON AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH updated_posts AS (
    UPDATE posts
    SET
      title = COALESCE((updates->>'title')::TEXT, title),
      published = COALESCE((updates->>'published')::BOOLEAN, published),
      updated_at = NOW()
    WHERE id = ANY(post_ids)
    RETURNING *
  )
  SELECT count(*) INTO updated_count FROM updated_posts;

  RETURN json_build_object(
    'success', true,
    'updated_count', updated_count
  );
END;
$$ LANGUAGE plpgsql;
```

### Search Functions

Full-text search with PostgreSQL's built-in capabilities:

```sql
-- Full-text search function
CREATE OR REPLACE FUNCTION full_text_search(
  search_query TEXT,
  search_table TEXT DEFAULT 'posts',
  page_limit INTEGER DEFAULT 10,
  page_offset INTEGER DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
  ts_query tsquery;
  results JSON;
  total_count INTEGER;
BEGIN
  -- Convert search query to tsquery
  ts_query := plainto_tsquery('english', search_query);
  
  -- Execute search based on table
  CASE search_table
    WHEN 'posts' THEN
      SELECT count(*) INTO total_count
      FROM posts
      WHERE to_tsvector('english', title || ' ' || content) @@ ts_query;
      
      SELECT json_agg(
        json_build_object(
          'id', id,
          'title', title,
          'content', left(content, 200),
          'rank', ts_rank(to_tsvector('english', title || ' ' || content), ts_query)
        )
      ) INTO results
      FROM posts
      WHERE to_tsvector('english', title || ' ' || content) @@ ts_query
      ORDER BY ts_rank(to_tsvector('english', title || ' ' || content), ts_query) DESC
      LIMIT page_limit
      OFFSET page_offset;
  END CASE;

  RETURN json_build_object(
    'results', COALESCE(results, '[]'::json),
    'total', total_count,
    'query', search_query
  );
END;
$$ LANGUAGE plpgsql STABLE;
```

### Validation Functions

Data validation and sanitization:

```sql
-- Email validation function
CREATE OR REPLACE FUNCTION validate_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Password strength validation
CREATE OR REPLACE FUNCTION validate_password_strength(password TEXT)
RETURNS JSON AS $$
DECLARE
  errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Length check
  IF length(password) < 8 THEN
    errors := array_append(errors, 'Password must be at least 8 characters long');
  END IF;
  
  -- Uppercase check
  IF password !~ '[A-Z]' THEN
    errors := array_append(errors, 'Password must contain at least one uppercase letter');
  END IF;
  
  -- Lowercase check  
  IF password !~ '[a-z]' THEN
    errors := array_append(errors, 'Password must contain at least one lowercase letter');
  END IF;
  
  -- Number check
  IF password !~ '[0-9]' THEN
    errors := array_append(errors, 'Password must contain at least one number');
  END IF;

  RETURN json_build_object(
    'valid', array_length(errors, 1) IS NULL,
    'errors', errors
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Custom Business Logic Functions

Template for custom business logic:

```sql
-- Custom function template
CREATE OR REPLACE FUNCTION calculate_order_total(order_id UUID)
RETURNS JSON AS $$
DECLARE
  order_record orders%ROWTYPE;
  total_amount DECIMAL;
  tax_amount DECIMAL;
  shipping_cost DECIMAL;
BEGIN
  -- Get order details
  SELECT * INTO order_record
  FROM orders
  WHERE id = order_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Order not found');
  END IF;
  
  -- Calculate subtotal
  SELECT COALESCE(SUM(quantity * price), 0) INTO total_amount
  FROM order_items oi
  JOIN products p ON oi.product_id = p.id
  WHERE oi.order_id = calculate_order_total.order_id;
  
  -- Calculate tax (example: 10%)
  tax_amount := total_amount * 0.10;
  
  -- Calculate shipping
  shipping_cost := CASE
    WHEN total_amount > 50 THEN 0  -- Free shipping over $50
    ELSE 5.99
  END;
  
  RETURN json_build_object(
    'order_id', order_id,
    'subtotal', total_amount,
    'tax', tax_amount,
    'shipping', shipping_cost,
    'total', total_amount + tax_amount + shipping_cost
  );
END;
$$ LANGUAGE plpgsql STABLE;
```

## Function Security and Permissions

### Security Definer Functions

Authentication functions use `SECURITY DEFINER` for elevated privileges:

```sql
-- Function runs with creator's privileges
CREATE OR REPLACE FUNCTION auth.login(email TEXT, password TEXT)
RETURNS JSON AS $$
-- Function body...
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to roles
GRANT EXECUTE ON FUNCTION auth.login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION auth.login(TEXT, TEXT) TO authenticated;
```

### Role-Based Access

Functions can check user roles and permissions:

```sql
CREATE OR REPLACE FUNCTION admin_only_function()
RETURNS JSON AS $$
BEGIN
  -- Check if current user has admin role
  IF current_setting('request.jwt.claim.role', true) != 'admin' THEN
    RETURN json_build_object('error', 'Admin access required');
  END IF;
  
  -- Admin-only logic here
  RETURN json_build_object('success', true, 'data', 'admin data');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Function Usage in PostgREST

### Calling Functions via HTTP

PostgREST exposes functions as RPC endpoints:

```bash
# Call authentication function
curl -X POST http://localhost:3000/rpc/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Call search function
curl -X POST http://localhost:3000/rpc/search_posts \
  -H "Content-Type: application/json" \
  -d '{"query": "postgresql", "page_limit": 5}'

# Call with authentication
curl -X POST http://localhost:3000/rpc/admin_only_function \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json"
```

### Client Library Integration

Using functions with PGRestify client:

```typescript
// Authentication
const { data: authResult } = await client
  .rpc('login', { 
    email: 'user@example.com', 
    password: 'password' 
  })
  .execute();

// Search with pagination
const { data: searchResults } = await client
  .rpc('search_posts', {
    query: 'postgresql',
    page_limit: 10,
    page_offset: 0
  })
  .execute();

// Custom business logic
const { data: orderTotal } = await client
  .rpc('calculate_order_total', { 
    order_id: 'uuid-here' 
  })
  .execute();
```

## Generated Function Structure

Functions are organized in the generated SQL:

```
sql/functions/
├── generated.sql           # Bulk-generated functions
├── auth.sql               # Authentication functions
├── search_posts.sql       # Individual search function
└── custom_functions.sql   # Custom business logic
```

### Generated SQL Structure

```sql
-- Generated Functions
-- Created: 2024-01-15T10:30:00Z
-- Schema: api

-- ====================
-- Authentication Functions
-- ====================

CREATE OR REPLACE FUNCTION auth.login(email TEXT, password TEXT)
RETURNS JSON AS $$ ... $$;

CREATE OR REPLACE FUNCTION auth.register(email TEXT, password TEXT, full_name TEXT DEFAULT NULL)
RETURNS JSON AS $$ ... $$;

-- ====================
-- CRUD Helper Functions  
-- ====================

CREATE OR REPLACE FUNCTION search_posts(query TEXT DEFAULT '', page_limit INTEGER DEFAULT 10)
RETURNS JSON AS $$ ... $$;

-- ====================
-- Utility Functions
-- ====================

CREATE OR REPLACE FUNCTION validate_email(email TEXT)
RETURNS BOOLEAN AS $$ ... $$;

-- ====================
-- Permissions
-- ====================

GRANT EXECUTE ON FUNCTION auth.login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION auth.register(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION search_posts(TEXT, INTEGER, INTEGER) TO anon, authenticated;
```

## Best Practices

### Function Design

1. **Use JSON returns** for complex data structures
2. **Include error handling** with proper exception blocks
3. **Validate inputs** at the function level
4. **Use appropriate security context** (DEFINER vs INVOKER)
5. **Document function parameters** and return values

### Performance Optimization

1. **Use STABLE or IMMUTABLE** when functions don't modify data
2. **Create indexes** for columns used in function queries
3. **Avoid complex loops** in SQL functions
4. **Use prepared statements** for repeated queries
5. **Consider function caching** for expensive operations

### Security Considerations

1. **Validate all inputs** to prevent SQL injection
2. **Use parameterized queries** instead of string concatenation
3. **Check user permissions** explicitly in functions
4. **Avoid exposing sensitive data** in return values
5. **Use SECURITY DEFINER** only when necessary

## Troubleshooting Functions

### Common Issues

#### Function Not Accessible
```bash
# Error: function not found
# Solution: Check permissions and schema
GRANT EXECUTE ON FUNCTION schema.function_name(param_types) TO role_name;
```

#### Permission Denied
```bash
# Error: permission denied for function
# Solution: Grant execute permissions
GRANT EXECUTE ON FUNCTION auth.login(TEXT, TEXT) TO anon;
```

#### Invalid Return Type
```bash
# Error: function must return JSON
# Solution: Ensure functions return proper JSON format
RETURN json_build_object('key', 'value');
```

### Testing Functions

Test functions directly in PostgreSQL:

```sql
-- Test authentication function
SELECT auth.login('user@example.com', 'password');

-- Test search function
SELECT search_posts('postgresql', 5, 0);

-- Test validation function
SELECT validate_email('test@example.com');
```

## Summary

PGRestify's function generation tools create comprehensive PostgreSQL functions optimized for PostgREST APIs. From authentication and CRUD helpers to custom business logic, these functions provide powerful server-side capabilities while maintaining security and performance best practices.