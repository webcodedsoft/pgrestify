# Table-Based Folder Structure

PGRestify uses a **mandatory table-based folder structure** for organizing SQL files. This provides better organization, maintainability, and team collaboration compared to the traditional numbered file approach.

## Why Table-Based Folders?

### Problems with Numbered Files (Old Structure)
```
sql/schemas/
├── 01_main.sql      # ALL tables mixed together
├── 02_rls.sql       # ALL RLS policies mixed together  
├── 03_views.sql     # ALL views mixed together
├── 04_triggers.sql  # ALL triggers mixed together
└── 05_indexes.sql   # ALL indexes mixed together
```

**Issues:**
- 😞 Hard to find table-specific code
- 😞 Large files become unwieldy
- 😞 Merge conflicts when multiple developers work on different tables
- 😞 Difficult to understand dependencies between tables
- 😞 No clear ownership of SQL components

### Benefits of Table-Based Folders (New Structure)
```
sql/schemas/
├── _setup/
│   └── table.sql          # Roles, extensions, permissions
├── users/
│   ├── table.sql          # Table definition
│   ├── rls.sql            # RLS policies for users
│   ├── triggers.sql       # User-specific triggers
│   ├── indexes.sql        # User table indexes
│   └── views.sql          # Views based on users table
├── posts/
│   ├── table.sql          # Posts table definition
│   ├── rls.sql            # Posts RLS policies
│   ├── triggers.sql       # Posts triggers
│   ├── indexes.sql        # Posts indexes
│   └── views.sql          # Posts-related views
└── [other_tables]/
    └── [same structure]
```

**Benefits:**
- ✅ **Easy Navigation**: Find all code related to a specific table
- ✅ **Better Organization**: Logical grouping of related SQL
- ✅ **Team Collaboration**: Different developers can work on different tables
- ✅ **Version Control Friendly**: Smaller, focused files reduce merge conflicts
- ✅ **Clear Dependencies**: Understand table relationships easily
- ✅ **Scalable**: Add new tables without cluttering existing files

## File Structure Explained

### Special Folders

#### `_setup/` Folder
Contains schema-wide setup code:
```sql
-- sql/schemas/_setup/table.sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pgjwt";

-- Schema
CREATE SCHEMA IF NOT EXISTS api;

-- Roles
CREATE ROLE web_anon NOLOGIN;
CREATE ROLE web_user NOLOGIN;
CREATE ROLE authenticator NOINHERIT LOGIN;

-- Permissions
GRANT web_anon TO authenticator;
GRANT web_user TO authenticator;
```

### Table-Specific Files

Each table gets its own folder with standardized file names:

#### `table.sql` - Table Definition
```sql
-- sql/schemas/users/table.sql
CREATE TABLE api.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE api.users ENABLE ROW LEVEL SECURITY;

-- Basic permissions
GRANT SELECT ON api.users TO web_anon;
GRANT ALL ON api.users TO web_user;
```

#### `rls.sql` - Row Level Security Policies
```sql
-- sql/schemas/users/rls.sql
-- Users can read their own data
CREATE POLICY "users_select_own" ON api.users
  FOR SELECT TO web_user
  USING (id = auth.current_user_id());

-- Users can update their own data
CREATE POLICY "users_update_own" ON api.users
  FOR UPDATE TO web_user
  USING (id = auth.current_user_id());

-- Allow user registration
CREATE POLICY "users_insert_self" ON api.users
  FOR INSERT TO web_anon
  WITH CHECK (true);
```

#### `indexes.sql` - Performance Indexes
```sql
-- sql/schemas/users/indexes.sql
-- Email lookup index
CREATE INDEX CONCURRENTLY idx_users_email ON api.users(email);

-- Created date index for sorting
CREATE INDEX CONCURRENTLY idx_users_created_at ON api.users(created_at DESC);

-- Active users partial index
CREATE INDEX CONCURRENTLY idx_users_active ON api.users(id) WHERE active = true;
```

#### `triggers.sql` - Database Triggers
```sql
-- sql/schemas/users/triggers.sql
-- Update timestamp trigger
CREATE OR REPLACE FUNCTION api.update_users_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_timestamp
  BEFORE UPDATE ON api.users
  FOR EACH ROW EXECUTE FUNCTION api.update_users_timestamp();

-- Audit trail trigger
CREATE TRIGGER audit_users_changes
  AFTER INSERT OR UPDATE OR DELETE ON api.users
  FOR EACH ROW EXECUTE FUNCTION api.audit_table_changes();
```

#### `views.sql` - Table-Related Views
```sql
-- sql/schemas/users/views.sql
-- Public user profile view
CREATE VIEW api.user_profiles AS
SELECT 
  id,
  name,
  avatar_url,
  created_at
FROM api.users
WHERE active = true;

-- User statistics view
CREATE VIEW api.user_stats AS
SELECT 
  u.id,
  u.name,
  COUNT(p.id) AS post_count,
  MAX(p.created_at) AS last_post_date
FROM api.users u
LEFT JOIN api.posts p ON u.id = p.author_id
GROUP BY u.id, u.name;
```

## How Commands Use Table Folders

### When Adding Features

All CLI commands automatically determine the correct table folder:

```bash
# Add RLS policy - writes to sql/schemas/users/rls.sql
pgrestify api generate policy users --pattern user_specific

# Add index - writes to sql/schemas/posts/indexes.sql  
pgrestify api features indexes add posts --column title

# Add view - determines base table and writes accordingly
pgrestify api features views generate user_posts --base-table users
# Writes to: sql/schemas/users/views.sql

# Add trigger - writes to sql/schemas/orders/triggers.sql
pgrestify api features triggers add orders --type audit
```

### Timestamp Tracking

When appending to existing files, commands add timestamp comments:

```sql
-- sql/schemas/users/indexes.sql

-- Table definition indexes
CREATE INDEX idx_users_email ON api.users(email);

-- Added by pgrestify api features indexes add users --column name
-- Generated: 2025-08-31T14:30:45.123Z  
CREATE INDEX CONCURRENTLY idx_users_name ON api.users(name);

-- Added by pgrestify api features indexes add users --column created_at
-- Generated: 2025-08-31T15:45:22.456Z
CREATE INDEX CONCURRENTLY idx_users_created_at ON api.users(created_at DESC);
```

## Migration Order

The table-based structure uses a **conservative migration order** to handle dependencies:

### 1. Schema Setup Phase
```bash
# First: Extensions, roles, permissions
sql/schemas/_setup/table.sql
```

### 2. Table Creation Phase  
```bash
# All table definitions (handles foreign keys properly)
sql/schemas/users/table.sql
sql/schemas/categories/table.sql
sql/schemas/posts/table.sql      # Can reference users and categories
sql/schemas/comments/table.sql   # Can reference posts and users
```

### 3. Performance Phase
```bash
# All indexes (after tables exist)
sql/schemas/users/indexes.sql
sql/schemas/posts/indexes.sql
sql/schemas/comments/indexes.sql
```

### 4. Security Phase
```bash
# All RLS policies (after tables and indexes)
sql/schemas/users/rls.sql
sql/schemas/posts/rls.sql
sql/schemas/comments/rls.sql
```

### 5. Automation Phase
```bash
# All triggers (after tables, indexes, RLS)
sql/schemas/users/triggers.sql
sql/schemas/posts/triggers.sql
sql/schemas/comments/triggers.sql
```

### 6. Views Phase
```bash
# All views last (may depend on everything else)
sql/schemas/users/views.sql
sql/schemas/posts/views.sql
sql/schemas/comments/views.sql
```

### 7. Functions Phase
```bash
# Shared functions (not table-specific)
sql/functions/auth.sql
sql/functions/utilities.sql
```

## Working with Dependencies

### Cross-Table Views

When a view depends on multiple tables, it's written to the **primary table's folder**:

```bash
# View that joins users and posts
pgrestify api features views generate user_posts --base-table users
# Written to: sql/schemas/users/views.sql

# View primarily about posts (even if it includes user data)
pgrestify api features views generate post_analytics --base-table posts  
# Written to: sql/schemas/posts/views.sql
```

### Foreign Key Handling

Foreign key constraints are defined in the **referencing table**:

```sql
-- sql/schemas/posts/table.sql
CREATE TABLE api.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES api.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES api.categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

The migration system handles this by:
1. Creating `users` table first
2. Creating `categories` table  
3. Creating `posts` table (can now reference users and categories)

### Complex Relationships

For many-to-many relationships, junction tables follow the same pattern:

```sql
-- sql/schemas/post_tags/table.sql
CREATE TABLE api.post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES api.posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES api.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, tag_id)
);
```

## Best Practices

### Naming Conventions

**Table Folders:**
- Use singular table names: `user/`, `post/`, `comment/`
- Use snake_case: `order_item/`, `user_preference/`
- Avoid spaces and special characters

**File Names:**
- Always use: `table.sql`, `rls.sql`, `triggers.sql`, `indexes.sql`, `views.sql`
- Never rename these files - commands depend on exact names

### File Organization

**Keep Files Focused:**
- `table.sql` - Only table definition and basic permissions
- `rls.sql` - Only RLS policies for this table
- `triggers.sql` - Only triggers that fire on this table
- `indexes.sql` - Only indexes on this table
- `views.sql` - Only views where this table is the primary focus

**Cross-Table Code:**
- Views spanning multiple tables: Put in primary table's folder
- Shared functions: Put in `sql/functions/`
- Complex constraints: Document in both affected tables

### Version Control

**Advantages for Git:**
- Smaller files = fewer merge conflicts
- Table-specific changes = cleaner diffs
- Team members can work on different tables simultaneously
- Easy to track changes per table over time

**Git Best Practices:**
```bash
# Commit table-specific changes together
git add sql/schemas/users/
git commit -m "Add user authentication and audit triggers"

# Separate commits for different tables
git add sql/schemas/posts/
git commit -m "Add post indexing and view optimizations"
```

## Migration from Old Structure

If you have an existing project with numbered files, use the restructure command:

```bash
# Preview the migration
pgrestify api schema restructure --dry-run

# Perform migration with backup
pgrestify api schema restructure --backup

# Force migration (overwrite existing folders)
pgrestify api schema restructure --force
```

**What the Migration Does:**
1. **Analyzes** existing numbered files (`01_main.sql`, `02_rls.sql`, etc.)
2. **Parses** SQL to determine which table each statement belongs to
3. **Creates** table folders and appropriate files
4. **Moves** SQL statements to correct locations
5. **Preserves** comments and formatting
6. **Creates** backup of old structure
7. **Validates** new structure works correctly

**Manual Steps After Migration:**
1. Review generated table folders
2. Test migrations: `pgrestify api migrate --dry-run`
3. Update any custom scripts that reference old file paths
4. Remove old numbered files after validation

## Troubleshooting

### Common Questions

**Q: Can I still use numbered files?**
A: No, the table-based structure is mandatory. Use `pgrestify api schema restructure` to migrate.

**Q: Where should I put views that span multiple tables?**
A: Put them in the folder of the **primary/main table** the view is about.

**Q: What if I have shared functions?**
A: Shared functions go in `sql/functions/` - they're not table-specific.

**Q: How do I handle complex table dependencies?**
A: The migration system handles this automatically with conservative ordering.

**Q: Can I customize the folder structure?**
A: No, the structure is standardized for consistency and tool compatibility.

### File Path References

When referencing files in documentation or scripts, use these paths:

```bash
# Table definitions
sql/schemas/{table}/table.sql

# RLS policies  
sql/schemas/{table}/rls.sql

# Performance indexes
sql/schemas/{table}/indexes.sql

# Audit triggers
sql/schemas/{table}/triggers.sql

# Table-specific views
sql/schemas/{table}/views.sql

# Shared functions
sql/functions/{function_name}.sql

# Schema setup
sql/schemas/_setup/table.sql
```

---

## Next Steps

- **[CLI Complete Reference](./cli.md)** - All available commands
- **[Migration Guide](./troubleshooting/migration-guides.md)** - Migrating existing projects  
- **[Complete Features](./complete-features.md)** - All library capabilities
- **[Getting Started](./getting-started.md)** - Setup walkthrough

The table-based folder structure makes PGRestify projects more maintainable, collaborative, and scalable. All new projects use this structure by default, and existing projects can be easily migrated.