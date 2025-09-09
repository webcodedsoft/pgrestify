# Project Templates

PGRestify CLI provides comprehensive project templates for rapid development. These templates include database schemas, authentication systems, and complete application structures optimized for different use cases.

## Overview

Templates provide:

- **Complete Database Schemas**: Tables, relationships, and constraints
- **Row Level Security (RLS)**: Pre-configured security policies
- **Authentication Systems**: JWT-based user management
- **Sample Data**: Realistic test data for development
- **API Configuration**: Optimized PostgREST settings
- **Frontend Integration**: Client-side code examples

## Available Templates

### Schema Templates

#### Basic Template
Simple authentication and user management system:

```bash
pgrestify api init --template basic
```

**Generated Structure:**
```
Database Schema:
- users (id, email, password_hash, created_at, updated_at)
- profiles (id, user_id, full_name, avatar_url, bio)
- sessions (id, user_id, token, expires_at)

Features:
✅ JWT authentication
✅ User profiles
✅ Session management
✅ Row Level Security
✅ Audit triggers
✅ Basic indexes

Use Cases:
- Simple web applications
- User authentication systems
- MVPs and prototypes
- Learning PostgREST basics
```

#### Blog Template
Complete blogging platform with content management:

```bash
pgrestify api init --template blog
```

**Generated Structure:**
```
Database Schema:
- users (authentication and profiles)
- posts (id, title, content, slug, published, author_id)
- categories (id, name, slug, description, parent_id)
- tags (id, name, slug, color)
- post_tags (post_id, tag_id) - many-to-many
- comments (id, post_id, author_id, content, approved)
- media (id, filename, url, alt_text, user_id)
- post_media (post_id, media_id, position)

Features:
✅ Multi-author blogging
✅ Hierarchical categories
✅ Tag system
✅ Comment moderation
✅ Media management
✅ SEO-friendly URLs (slugs)
✅ Publishing workflow
✅ Content relationships

Use Cases:
- Personal blogs
- Multi-author publications
- Content management systems
- News websites
- Documentation sites
```

#### E-commerce Template
Full e-commerce platform with orders and payments:

```bash
pgrestify api init --template ecommerce
```

**Generated Structure:**
```
Database Schema:
- users (customers and admins)
- products (id, name, description, price, stock, category_id)
- categories (hierarchical product categories)
- product_variants (size, color, etc.)
- cart (user_id, product_id, quantity, variant_id)
- orders (id, user_id, status, total, shipping_address)
- order_items (order_id, product_id, quantity, price, variant_id)
- payments (id, order_id, method, status, amount, transaction_id)
- reviews (id, product_id, user_id, rating, comment)
- coupons (id, code, discount_type, discount_value, expires_at)
- shipping_methods (id, name, price, estimated_days)
- addresses (id, user_id, type, street, city, postal_code)

Features:
✅ Product catalog management
✅ Shopping cart functionality
✅ Order processing workflow
✅ Payment integration ready
✅ Review and rating system
✅ Coupon and discount system
✅ Multiple shipping addresses
✅ Inventory management
✅ Customer accounts

Use Cases:
- Online stores
- Marketplaces
- B2B commerce platforms
- Subscription services
- Digital product sales
```

#### Custom Template
Minimal setup for custom requirements:

```bash
pgrestify api init --template custom
```

**Generated Structure:**
```
Database Schema:
- Basic authentication tables only
- Minimal RLS policies
- Essential functions

Features:
✅ Authentication framework
✅ Extensible structure
✅ Security foundation
✅ Configuration templates

Use Cases:
- Unique business requirements
- Complex domain models
- Learning and experimentation
- Custom implementations
```

## Template Customization

### Template Configuration

Templates can be customized during initialization:

```bash
# Interactive customization
pgrestify api init --template blog

? Enable user registration? (Y/n)
? Include comment system? (Y/n)  
? Add media management? (Y/n)
? Enable multi-author features? (Y/n)
? Include SEO features (slugs, meta)? (Y/n)
? Generate sample data? (Y/n)
? Number of sample records: (50)
```

### Environment-Specific Templates

Templates can be generated for different environments:

```bash
# Development template with sample data
pgrestify api init --template blog --env development --testing-data

# Production template with security hardening
pgrestify api init --template ecommerce --env production --no-testing-data

# Staging template with monitoring
pgrestify api init --template basic --env staging
```

## Function Templates

### Authentication Functions
JWT-based authentication with various patterns:

```bash
# Generate authentication functions
pgrestify api functions create login --template auth

# Options:
--auth-type jwt          # JWT token authentication (default)
--auth-type basic        # Basic username/password
--auth-type custom       # Custom authentication logic
```

Generated authentication functions:
- `login(email, password)` - User authentication
- `register(email, password, metadata)` - User registration  
- `refresh_token(refresh_token)` - Token refresh
- `logout(user_id)` - Session cleanup
- `reset_password(email)` - Password reset flow
- `change_password(old_password, new_password)` - Password update

### CRUD Helper Functions
Common database operations with enhanced features:

```bash
# Generate CRUD helpers
pgrestify api functions create search_posts --template crud

Generated functions:
- search_with_pagination(query, limit, offset)
- bulk_operations(table, action, data)
- soft_delete_with_restore(table, id)
- audit_changes(table, action, old_data, new_data)
```

### Search Functions
Full-text search with PostgreSQL's built-in capabilities:

```bash
# Generate search functions
pgrestify api functions create search_content --template search

Generated functions:
- full_text_search(query, table, columns)
- faceted_search(query, filters, facets)
- autocomplete_suggestions(partial_query, limit)
- search_with_rankings(query, boost_fields)
```

### Validation Functions
Data validation and business rule enforcement:

```bash
# Generate validation functions  
pgrestify api functions create validate_order --template validation

Generated functions:
- validate_email(email) -> boolean
- validate_phone(phone_number) -> boolean
- validate_business_rules(table, data) -> validation_result
- sanitize_input(input_data) -> sanitized_data
```

### Custom Business Logic
Template for domain-specific functions:

```bash
# Generate custom business logic
pgrestify api functions create calculate_shipping --template custom

Generated template includes:
- Function structure with proper error handling
- Input validation patterns
- Return value formatting
- Security considerations (SECURITY DEFINER)
- Permission grants for appropriate roles
```

## View Templates

### Aggregated Views
Pre-built aggregation patterns:

```bash
# Generate aggregated view
pgrestify api features views generate user_stats --template aggregated

Generated patterns:
- COUNT, SUM, AVG aggregations
- GROUP BY patterns
- Time-based groupings
- Statistical calculations
```

### Joined Views  
Complex multi-table relationships:

```bash
# Generate joined view
pgrestify api features views generate order_details --template joined

Generated patterns:
- LEFT/INNER JOIN patterns
- Nested relationships
- Computed columns from joins
- Performance-optimized joins
```

### Security Views
Safe data exposure patterns:

```bash
# Generate security view
pgrestify api features views generate public_profiles --template security

Generated patterns:
- Hidden sensitive columns
- Role-based data filtering
- Computed safe representations
- Privacy-compliant data exposure
```

## Template File Structure

### Generated Project Structure

All templates follow this organization:

```
my-project/
├── sql/                          # Database schema files
│   ├── 00-extensions.sql         # PostgreSQL extensions
│   ├── 01-schemas.sql           # Schema definitions
│   ├── 02-tables/               # Table definitions (folder-based)
│   │   ├── users/
│   │   │   ├── table.sql        # Table structure
│   │   │   ├── rls.sql          # Row Level Security
│   │   │   ├── triggers.sql     # Audit triggers
│   │   │   └── indexes.sql      # Performance indexes
│   │   └── [other-tables]/
│   ├── 03-functions.sql         # Custom functions
│   ├── 04-views.sql            # Database views
│   ├── 05-grants.sql           # Permission grants
│   └── testing_data.sql        # Sample data (optional)
├── config/
│   ├── postgrest.conf          # PostgREST configuration
│   └── nginx.conf             # Reverse proxy config (if needed)
├── docker/
│   ├── docker-compose.yml      # Development services
│   ├── docker-compose.prod.yml # Production services
│   └── Dockerfile.postgrest    # Custom PostgREST image (if needed)
├── scripts/
│   ├── setup.sh               # Initial setup
│   ├── migrate.sh             # Migration runner
│   ├── seed.sh                # Sample data loader
│   └── backup.sh              # Database backup
├── .env.example               # Environment variables template
├── .gitignore                # Git ignore rules
├── package.json              # npm scripts and dependencies
└── README.md                 # Project documentation
```

### Template SQL Structure

Each template generates SQL organized by type:

```sql
-- Example: Blog template table structure

-- Users table (02-tables/users/table.sql)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  avatar_url TEXT,
  role VARCHAR(20) DEFAULT 'user',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts table (02-tables/posts/table.sql)
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  author_id UUID NOT NULL REFERENCES users(id),
  category_id UUID REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Template Testing Data

### Realistic Sample Data

Templates can generate realistic test data:

```bash
# Generate template with sample data
pgrestify api init --template blog --testing-data --testing-records 100

# Generate additional test data later
pgrestify api testing-data generate --template blog --records 50
```

### Sample Data Features

- **Realistic Content**: Meaningful titles, descriptions, and text
- **Proper Relationships**: Valid foreign keys and associations
- **Varied Data Types**: Different data patterns and edge cases
- **Time Distribution**: Records spread across realistic time periods
- **User Hierarchy**: Different user roles and permission levels

### Testing Data Examples

```sql
-- Blog template sample data
INSERT INTO users (email, full_name, role) VALUES
  ('admin@example.com', 'Site Administrator', 'admin'),
  ('editor@example.com', 'Content Editor', 'editor'),
  ('author1@example.com', 'John Writer', 'author'),
  ('reader@example.com', 'Regular Reader', 'user');

INSERT INTO categories (name, slug, description) VALUES
  ('Technology', 'technology', 'Latest tech news and tutorials'),
  ('Programming', 'programming', 'Code examples and best practices'),
  ('Design', 'design', 'UI/UX design and inspiration');

INSERT INTO posts (title, slug, content, published, author_id, category_id) VALUES
  ('Getting Started with PostgREST', 'getting-started-postgrest', 
   'PostgREST is a powerful tool...', true,
   (SELECT id FROM users WHERE email = 'author1@example.com'),
   (SELECT id FROM categories WHERE slug = 'technology'));
```

## Best Practices

### Template Selection

1. **Start simple**: Use Basic template for MVPs and prototypes
2. **Match your domain**: Choose templates that align with your business model
3. **Consider growth**: Select templates with room for expansion
4. **Evaluate complexity**: Don't over-engineer for simple use cases

### Template Customization

1. **Review generated schema** before applying to production
2. **Customize RLS policies** for your specific security requirements
3. **Add business-specific constraints** and validation rules
4. **Optimize indexes** based on your query patterns
5. **Test thoroughly** with realistic data volumes

### Template Evolution

1. **Version your schema changes** for safe updates
2. **Document customizations** for future team members
3. **Create custom templates** for recurring patterns
4. **Share successful patterns** with the community

## Summary

PGRestify's template system accelerates development by providing production-ready database schemas, security policies, and application structures. From simple authentication systems to complex e-commerce platforms, these templates provide solid foundations that can be customized and extended to meet specific requirements.