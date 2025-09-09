# Database Features

PGRestify CLI provides advanced database features for PostgreSQL and PostgREST optimization. This includes views, triggers, indexes, and other performance enhancements designed specifically for PostgREST APIs.

## Overview

Database features enhance your PostgREST API with:

- **Database Views**: Simplify complex queries and hide implementation details
- **Audit Triggers**: Track changes with automatic audit logging
- **Performance Indexes**: Optimize query performance for common patterns
- **Computed Columns**: Add calculated fields without modifying base tables
- **Security Layers**: Hide sensitive data through views and permissions

## Available Features

### Views Management

Create and manage PostgreSQL views optimized for PostgREST:

```bash
# Generate view commands
pgrestify api features views generate user_profiles --template joined
pgrestify api features views suggest           # AI-suggested views
pgrestify api features views analyze           # Schema analysis
pgrestify api features views list             # List existing views
```

### Triggers Management

Create audit triggers and change tracking:

```bash
# Generate trigger commands
pgrestify api features triggers generate audit_log --table users
pgrestify api features triggers timestamps     # Created/updated timestamps
pgrestify api features triggers validate       # Data validation triggers
```

### Indexes Management

Create performance indexes for common query patterns:

```bash
# Generate index commands
pgrestify api features indexes generate posts --columns title,content
pgrestify api features indexes analyze         # Query analysis
pgrestify api features indexes recommend       # Performance recommendations
```

## Database Views

Views provide simplified interfaces to complex data and enable advanced PostgREST patterns.

### Generate Views

Create views with intelligent analysis:

```bash
# Generate view with template
pgrestify api features views generate user_profiles --template joined

# Generate with dynamic database analysis
pgrestify api features views generate post_stats --dynamic

# Generate materialized view for performance
pgrestify api features views generate popular_posts --materialized

# Generate with specific base table
pgrestify api features views generate user_summary --base-table users
```

#### View Generation Options

```bash
pgrestify api features views generate <name> [options]

Arguments:
  name                   View name

Options:
  --schema <name>        Schema name
  --template <type>      View template (aggregated|joined|filtered|computed|security)
  --dynamic              Use dynamic analysis from database
  --base-table <table>   Base table for view (determines table folder)
  --materialized         Create materialized view
```

### View Templates

#### Aggregated Data View
Creates views with aggregate functions:

```sql
-- Generated aggregated view
CREATE VIEW user_stats AS
SELECT 
  u.id,
  u.email,
  u.created_at,
  COUNT(p.id) as post_count,
  AVG(p.views) as avg_post_views,
  MAX(p.created_at) as last_post_date
FROM users u
LEFT JOIN posts p ON u.id = p.author_id
GROUP BY u.id, u.email, u.created_at;

-- PostgREST permissions
GRANT SELECT ON user_stats TO anon, authenticated;
```

#### Multi-table Join View
Combines related tables into a single view:

```sql
-- Generated joined view  
CREATE VIEW post_details AS
SELECT 
  p.id,
  p.title,
  p.content,
  p.published,
  p.created_at,
  u.email as author_email,
  u.full_name as author_name,
  c.name as category_name,
  COUNT(cm.id) as comment_count
FROM posts p
JOIN users u ON p.author_id = u.id
LEFT JOIN categories c ON p.category_id = c.id  
LEFT JOIN comments cm ON p.id = cm.post_id
GROUP BY p.id, u.email, u.full_name, c.name;

GRANT SELECT ON post_details TO anon, authenticated;
```

#### Security Layer View
Hides sensitive columns and applies security logic:

```sql
-- Generated security view
CREATE VIEW public_users AS
SELECT 
  id,
  email,
  full_name,
  created_at,
  -- Hide sensitive fields: password_hash, phone, etc.
  CASE 
    WHEN active = true THEN 'active'
    ELSE 'inactive'
  END as status
FROM users
WHERE deleted_at IS NULL;  -- Hide soft-deleted records

GRANT SELECT ON public_users TO anon;
```

### View Analysis and Suggestions

#### Suggest Views
AI-powered view suggestions based on your schema:

```bash
$ pgrestify api features views suggest

👁️  Analyzing schema for view opportunities...

📊 Suggested Views:

1. user_post_summary (aggregated)
   - Combines users with post statistics
   - Useful for: User profiles, dashboards
   - Tables: users, posts

2. order_details (joined)  
   - Complete order information with customer and items
   - Useful for: Order management, reporting
   - Tables: orders, users, order_items, products

3. public_product_catalog (security)
   - Product catalog without internal pricing
   - Useful for: Public API, frontend display
   - Tables: products, categories

? Generate these views? (Y/n)
```

#### Schema Analysis
Analyze your database for optimization opportunities:

```bash
$ pgrestify api features views analyze

🔍 Schema Analysis Report:

Tables Analyzed: 8
Relationships Found: 12
Complex Queries Detected: 5

Optimization Opportunities:
- 3 tables would benefit from aggregated views
- 5 join patterns could be simplified with views  
- 2 security concerns found (exposed sensitive columns)

Recommendations:
1. Create user_activity view (aggregated)
2. Create order_summary view (joined)
3. Create safe_user_profiles view (security)
```

## Database Triggers

Triggers provide automatic data processing and audit functionality.

### Audit Triggers

Create comprehensive audit logging:

```bash
# Generate audit trigger for specific table
pgrestify api features triggers generate audit_log --table users

# Generate audit triggers for all tables
pgrestify api features triggers generate audit_log --all-tables

# Generate with custom audit table
pgrestify api features triggers generate audit_log --table posts --audit-table post_audit
```

#### Generated Audit Trigger

```sql
-- Audit table creation
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,  -- INSERT, UPDATE, DELETE
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET
);

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    table_name, 
    operation, 
    record_id,
    old_data,
    new_data,
    changed_by,
    changed_at
  ) VALUES (
    TG_TABLE_NAME::TEXT,
    TG_OP::TEXT,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    current_setting('request.jwt.claim.user_id', true)::UUID,
    NOW()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to table
CREATE TRIGGER users_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_function();
```

### Timestamp Triggers

Automatic created_at/updated_at management:

```bash
# Add timestamp triggers to table
pgrestify api features triggers timestamps --table posts

# Add to all tables
pgrestify api features triggers timestamps --all-tables
```

#### Generated Timestamp Trigger

```sql
-- Timestamp trigger function
CREATE OR REPLACE FUNCTION update_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to table
CREATE TRIGGER posts_updated_at_trigger
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamps();
```

## Performance Indexes

Optimize query performance with intelligent index generation.

### Generate Indexes

Create indexes for common query patterns:

```bash
# Generate indexes for specific columns
pgrestify api features indexes generate posts --columns title,created_at

# Generate full-text search indexes
pgrestify api features indexes generate posts --full-text title,content

# Generate composite indexes
pgrestify api features indexes generate orders --composite "user_id,status,created_at"

# Generate with performance analysis
pgrestify api features indexes analyze --recommend
```

#### Index Generation Options

```bash
pgrestify api features indexes generate <table> [options]

Arguments:
  table                  Table name

Options:
  --columns <list>       Comma-separated column names
  --full-text <list>     Full-text search columns
  --composite <list>     Composite index columns
  --unique               Create unique index
  --partial <condition>  Partial index condition
  --gin                  Use GIN index for JSONB/arrays
```

### Generated Index Examples

#### B-tree Indexes
```sql
-- Single column indexes
CREATE INDEX posts_title_idx ON posts (title);
CREATE INDEX posts_created_at_idx ON posts (created_at DESC);

-- Composite index
CREATE INDEX posts_author_status_idx ON posts (author_id, published, created_at);

-- Unique index
CREATE UNIQUE INDEX users_email_idx ON users (email);
```

#### Full-text Search Indexes
```sql
-- GIN index for full-text search
CREATE INDEX posts_search_idx ON posts 
  USING GIN (to_tsvector('english', title || ' ' || content));

-- Weighted search index  
CREATE INDEX posts_weighted_search_idx ON posts
  USING GIN (
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', content), 'B')
  );
```

#### JSONB Indexes
```sql
-- GIN index for JSONB columns
CREATE INDEX users_metadata_idx ON users USING GIN (metadata);

-- Specific JSONB key index
CREATE INDEX users_preferences_theme_idx ON users 
  USING BTREE ((metadata->>'theme'));
```

### Performance Analysis

Analyze query performance and recommend indexes:

```bash
$ pgrestify api features indexes analyze

📊 Query Performance Analysis:

Slow Queries Detected:
1. SELECT * FROM posts WHERE author_id = ? AND published = true
   - Missing index: (author_id, published)
   - Avg execution: 245ms
   - Recommendation: Composite index

2. SELECT * FROM users WHERE email ILIKE '%example%'  
   - Missing index: Full-text search
   - Avg execution: 892ms
   - Recommendation: GIN index with trigram

Index Recommendations:
✓ Create posts_author_published_idx
✓ Create users_email_gin_idx  
✓ Create orders_status_created_idx

? Generate recommended indexes? (Y/n)
```

## File Organization

Generated features are organized in the SQL structure:

```
sql/
├── 02-tables/
│   ├── users/
│   │   ├── table.sql
│   │   ├── views.sql          # User-related views
│   │   ├── triggers.sql       # User triggers
│   │   └── indexes.sql        # User indexes
│   └── posts/
│       ├── table.sql  
│       ├── views.sql          # Post-related views
│       ├── triggers.sql       # Post triggers
│       └── indexes.sql        # Post indexes
├── 04-views.sql              # Global views
├── 06-triggers.sql           # Global triggers  
└── 07-indexes.sql            # Global indexes
```

## Best Practices

### View Design
1. **Use meaningful names** that describe the view's purpose
2. **Include necessary columns only** to avoid performance issues
3. **Add proper permissions** for PostgREST access
4. **Document complex views** with comments
5. **Consider materialized views** for expensive queries

### Trigger Design
1. **Keep trigger logic simple** to avoid performance impact
2. **Use appropriate timing** (BEFORE vs AFTER)
3. **Handle errors gracefully** with proper exception handling
4. **Avoid recursive triggers** that could cause loops
5. **Test trigger behavior** thoroughly

### Index Design
1. **Create indexes for query patterns** not just individual columns
2. **Use composite indexes** for multi-column queries
3. **Consider partial indexes** for filtered queries
4. **Monitor index usage** and remove unused indexes
5. **Balance query performance** vs write performance

## Integration with PostgREST

### View Access
Views appear as regular tables in PostgREST:

```bash
# Query view via PostgREST API
curl http://localhost:3000/user_stats
curl http://localhost:3000/post_details?author_email=eq.user@example.com
```

### Trigger Integration
Triggers work automatically with PostgREST operations:

```bash
# Insert triggers fire automatically
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "New Post", "content": "Content here"}'
# → Audit log entry created automatically
# → Timestamps set automatically
```

## Summary

PGRestify's database features provide comprehensive tools for creating advanced PostgreSQL functionality optimized for PostgREST APIs. From intelligent view generation to automatic audit triggers and performance indexes, these features enhance your API with minimal manual configuration.