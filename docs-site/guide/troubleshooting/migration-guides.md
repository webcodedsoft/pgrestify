# Migration Guide - Old to New Structure

This guide helps you migrate existing PGRestify projects from the old numbered file structure to the new table-based folder structure.

## Overview

PGRestify has evolved from numbered SQL files to a table-based folder structure for better organization and maintainability.

### What's Changing

**From (Old Structure):**
```
sql/schemas/
├── 01_main.sql      # All tables
├── 02_rls.sql       # All RLS policies
├── 03_views.sql     # All views  
├── 04_triggers.sql  # All triggers
└── 05_indexes.sql   # All indexes
```

**To (New Structure):**
```
sql/schemas/
├── _setup/
│   └── table.sql          # Roles, extensions, permissions
├── users/
│   ├── table.sql          # Users table definition
│   ├── rls.sql            # Users RLS policies
│   ├── triggers.sql       # Users triggers
│   ├── indexes.sql        # Users indexes
│   └── views.sql          # Users-related views
└── [other_tables]/
    └── [same structure]
```

## Automatic Migration

### Using the Restructure Command

The safest way to migrate is using the built-in restructure command:

```bash
# 1. Preview the migration (recommended first step)
pgrestify api schema restructure --dry-run
```

**Example Output:**
```
🔍 Analyzing existing SQL structure...

Found old structure files:
✅ sql/schemas/01_main.sql (3 tables found)
✅ sql/schemas/02_rls.sql (8 policies found)  
✅ sql/schemas/03_views.sql (2 views found)
✅ sql/schemas/04_triggers.sql (3 triggers found)
✅ sql/schemas/05_indexes.sql (5 indexes found)

Proposed migration:
📁 sql/schemas/users/
  ├── table.sql    (CREATE TABLE users...)
  ├── rls.sql      (3 policies)
  ├── triggers.sql (1 trigger)
  └── indexes.sql  (2 indexes)

📁 sql/schemas/posts/  
  ├── table.sql    (CREATE TABLE posts...)
  ├── rls.sql      (4 policies)
  ├── views.sql    (1 view: user_posts)
  └── indexes.sql  (2 indexes)

📁 sql/schemas/comments/
  ├── table.sql    (CREATE TABLE comments...)
  ├── rls.sql      (1 policy)
  ├── triggers.sql (1 trigger)
  └── indexes.sql  (1 index)

📁 sql/schemas/_setup/
  └── table.sql    (Extensions, roles, permissions)

Use --backup flag to proceed with migration.
```

```bash
# 2. Perform migration with backup (recommended)
pgrestify api schema restructure --backup
```

**Migration Process:**
1. **Creates backup** of old structure in `sql/backup_YYYYMMDD_HHMMSS/`
2. **Analyzes** each numbered file to identify table ownership
3. **Creates** table folders with appropriate files
4. **Distributes** SQL statements to correct locations
5. **Preserves** comments and formatting
6. **Validates** new structure

```bash
# 3. Force migration (overwrite existing folders)
pgrestify api schema restructure --force
```

**Use `--force` when:**
- You've already tried migration and want to overwrite
- You have conflicting table folders to replace
- You're confident about overwriting existing work

## Manual Migration Steps

If you prefer manual migration or need to customize the process:

### Step 1: Analyze Your Current Structure

First, understand what you have:

```bash
# List your current SQL files
ls -la sql/schemas/

# Check file contents
head -20 sql/schemas/01_main.sql
head -20 sql/schemas/02_rls.sql
```

### Step 2: Identify Tables

Look through `01_main.sql` to identify all your tables:

```sql
-- Example 01_main.sql content:
CREATE TABLE api.users (...);
CREATE TABLE api.posts (...);  
CREATE TABLE api.comments (...);
```

### Step 3: Create Table Folders

```bash
# Create folder structure
mkdir -p sql/schemas/_setup
mkdir -p sql/schemas/users
mkdir -p sql/schemas/posts
mkdir -p sql/schemas/comments

# Create standard files
touch sql/schemas/_setup/table.sql
touch sql/schemas/users/{table,rls,triggers,indexes,views}.sql
touch sql/schemas/posts/{table,rls,triggers,indexes,views}.sql
touch sql/schemas/comments/{table,rls,triggers,indexes,views}.sql
```

### Step 4: Distribute SQL Content

**Extract Extensions and Roles (to `_setup/table.sql`):**
```sql
-- Move these from 01_main.sql to sql/schemas/_setup/table.sql:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE ROLE web_anon NOLOGIN;
CREATE ROLE web_user NOLOGIN;
-- etc.
```

**Extract Table Definitions:**
```sql
-- Move CREATE TABLE api.users from 01_main.sql 
-- to sql/schemas/users/table.sql

-- Move CREATE TABLE api.posts from 01_main.sql
-- to sql/schemas/posts/table.sql
```

**Extract RLS Policies:**
```sql
-- Move policies from 02_rls.sql to appropriate table folders:
-- Users policies → sql/schemas/users/rls.sql
-- Posts policies → sql/schemas/posts/rls.sql  
```

**Extract Views:**
```sql
-- Move views from 03_views.sql to primary table folders:
-- user_posts view → sql/schemas/users/views.sql (if primarily about users)
-- post_stats view → sql/schemas/posts/views.sql (if primarily about posts)
```

**Extract Triggers and Indexes:**
```sql
-- Move from 04_triggers.sql and 05_indexes.sql to table folders
-- Based on which table they operate on
```

### Step 5: Validate Migration

```bash
# Test the new structure
pgrestify api migrate --dry-run

# If successful, run actual migration
pgrestify api migrate --docker
```

## Common Migration Scenarios

### Scenario 1: Basic Blog Project

**Before:**
```
sql/schemas/
├── 01_main.sql     (users, posts, comments tables)
├── 02_rls.sql      (8 mixed policies)
└── 03_views.sql    (user_posts view)
```

**After:**
```
sql/schemas/
├── _setup/table.sql      (extensions, roles)
├── users/
│   ├── table.sql         (users table)
│   ├── rls.sql           (3 user policies)
│   └── views.sql         (user_posts view)
├── posts/
│   ├── table.sql         (posts table)
│   └── rls.sql           (4 post policies)
└── comments/
    ├── table.sql         (comments table)
    └── rls.sql           (1 comment policy)
```

### Scenario 2: E-commerce Platform

**Before:**
```
sql/schemas/
├── 01_main.sql     (customers, products, orders, order_items)
├── 02_rls.sql      (15 mixed policies)
├── 04_triggers.sql (audit triggers)
└── 05_indexes.sql  (performance indexes)
```

**After:**
```
sql/schemas/
├── _setup/table.sql
├── customers/
│   ├── table.sql, rls.sql, triggers.sql, indexes.sql
├── products/  
│   ├── table.sql, rls.sql, indexes.sql, views.sql
├── orders/
│   ├── table.sql, rls.sql, triggers.sql, views.sql
└── order_items/
    ├── table.sql, rls.sql, indexes.sql
```

## Post-Migration Tasks

### 1. Update Scripts

Update any custom scripts that reference old paths:

**Before:**
```bash
# Old script
psql -f sql/schemas/01_main.sql
psql -f sql/schemas/02_rls.sql
```

**After:**
```bash
# Use migration command instead
pgrestify api migrate --docker
```

### 2. Update Documentation

Update project README and documentation:

```markdown
## Database Schema

Our database schema is organized in table-based folders:

- `sql/schemas/users/` - User management
- `sql/schemas/posts/` - Content management  
- `sql/schemas/comments/` - Comment system

To apply schema: `pgrestify api migrate`
```

### 3. Update CI/CD

Update deployment scripts:

**Before:**
```yaml
# Old CI/CD
- run: psql $DATABASE_URL -f sql/schemas/01_main.sql
- run: psql $DATABASE_URL -f sql/schemas/02_rls.sql
```

**After:**
```yaml
# New CI/CD
- run: pgrestify api migrate --docker
```

### 4. Team Communication

Inform your team about the new structure:

1. **Pull latest changes** with new structure
2. **Run migration** on their local environment
3. **Update their scripts** and workflows
4. **Use new commands** for adding features

## Rollback Strategy

If you need to rollback the migration:

### 1. Restore from Backup

```bash
# Restore from automatic backup
cp -r sql/backup_20250831_143045/* sql/schemas/

# Remove new structure
rm -rf sql/schemas/users/
rm -rf sql/schemas/posts/
# etc.
```

### 2. Manual Rollback

Create a single file from table folders:

```bash
# Combine all table.sql files
cat sql/schemas/*/table.sql > sql/schemas/01_main.sql

# Combine all rls.sql files  
cat sql/schemas/*/rls.sql > sql/schemas/02_rls.sql

# etc.
```

## Validation

### Before Migration

Verify your current setup works:

```bash
# Test current migrations
psql $DATABASE_URL -f sql/schemas/01_main.sql
psql $DATABASE_URL -f sql/schemas/02_rls.sql
```

### After Migration

Verify the new structure works:

```bash
# Test new migrations
pgrestify api migrate --dry-run
pgrestify api migrate --docker
```

### Validation Checklist

- [ ] All tables migrate successfully
- [ ] All RLS policies are preserved
- [ ] Foreign key relationships work
- [ ] Views execute without errors
- [ ] Triggers fire correctly
- [ ] Indexes are created
- [ ] Application connects and works
- [ ] Authentication still works
- [ ] All team members can migrate

## Getting Help

If you encounter issues during migration:

```bash
# Validate your project
pgrestify validate

# Check for common issues
pgrestify validate --check-rls --check-permissions

# Get detailed help
pgrestify api schema restructure --help
```

**Common Issues:**
- **Parse errors**: Complex SQL might not parse correctly - review and manually adjust
- **Dependency conflicts**: Foreign keys in wrong order - the system handles this automatically
- **Missing files**: Some table folders might be empty - this is normal for tables without triggers/views
- **Permission issues**: File system permissions - ensure write access to sql/ directory

---

## Next Steps

After successful migration:

- **[Table-Based Folder Structure](../table-folders.md)** - Understanding the new structure
- **[CLI Complete Reference](../cli.md)** - All available commands
- **[Complete Features](../complete-features.md)** - Full library capabilities

The table-based structure will make your PGRestify project more maintainable and team-friendly!