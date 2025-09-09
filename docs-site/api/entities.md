<!-- TODO: Entity Decorators API temporarily disabled for security review

# Entity Decorators API

PGRestify provides a complete TypeORM-style decorator system for defining database schemas with TypeScript classes.

## Overview

Entity decorators allow you to define your database schema using TypeScript classes, similar to TypeORM. This approach provides:

- **Type Safety**: Full TypeScript inference and validation
- **Code Generation**: Automatic migration and seeder generation
- **Developer Experience**: Familiar decorator syntax
- **Database Features**: Complete PostgreSQL feature support

## Getting Started

```bash
# Generate a new entity
pgrestify generate entity User --template full

# Generate migration from entities
pgrestify migration:generate --entities "src/entities/**/*.ts"

# Generate seed data
pgrestify seed:generate --entities "src/entities/**/*.ts" --realistic
```

## Class Decorators

### @Entity()

Defines a database table.

```typescript
@Entity({
  name: 'users',
  schema: 'api',
  comment: 'User accounts and profiles'
})
export class User {
  // Entity definition...
}
```

**Parameters:**
- `name: string` - Table name
- `options?: EntityOptions`
  - `schema?: string` - Database schema (default: 'api')
  - `comment?: string` - Table comment

### @Index()

Creates database indexes for performance.

```typescript
@Entity('users')
@Index(['email'])                    // Simple index
@Index(['created_at', 'status'])     // Composite index
@Index(['email'], { unique: true })  // Unique index
export class User {
  // Entity definition...
}
```

**Parameters:**
- `columns: string[]` - Columns to index
- `options?: IndexOptions`
  - `name?: string` - Custom index name
  - `unique?: boolean` - Create unique index
  - `concurrent?: boolean` - Create concurrently
  - `using?: string` - Index method (btree, gin, gist, etc.)
  - `where?: string` - Partial index condition

### @Unique()

Creates unique constraints across multiple columns.

```typescript
@Entity('users')
@Unique(['email', 'username'])
@Unique(['social_id', 'provider'])
export class User {
  // Entity definition...
}
```

### @Check()

Adds table-level check constraints.

```typescript
@Entity('products')
@Check('price > 0', 'positive_price')
@Check('stock_quantity >= 0', 'non_negative_stock')
export class Product {
  // Entity definition...
}
```

## Property Decorators

### @PrimaryGeneratedColumn()

Defines auto-generated primary key columns.

```typescript
// UUID primary key
@PrimaryGeneratedColumn('uuid')
id!: string;

// Auto-increment integer
@PrimaryGeneratedColumn('increment')
id!: number;

// Identity column
@PrimaryGeneratedColumn('identity')
id!: number;
```

**Parameters:**
- `strategy: 'uuid' | 'increment' | 'identity'`
- `options?: ColumnOptions`

### @Column()

Defines regular table columns.

```typescript
// Basic column
@Column()
name!: string;

// Typed column with options
@Column({
  type: 'varchar',
  length: 255,
  nullable: false,
  unique: true,
  default: 'Unknown',
  comment: 'User display name'
})
username!: string;

// Numeric column
@Column({
  type: 'decimal',
  precision: 10,
  scale: 2,
  check: 'price > 0'
})
price!: number;
```

**Options:**
- `type?: ColumnType` - PostgreSQL column type
- `length?: number` - Column length (for varchar/char)
- `precision?: number` - Numeric precision
- `scale?: number` - Numeric scale
- `nullable?: boolean` - Allow NULL values
- `unique?: boolean` - Unique constraint
- `default?: any` - Default value
- `check?: string` - Check constraint expression
- `comment?: string` - Column comment
- `array?: boolean` - Array type
- `enum?: string[] | object` - Enum values
- `collation?: string` - Text collation

## Column Types

### Text Types

```typescript
@Column({ type: 'varchar', length: 255 })
name!: string;

@Column({ type: 'char', length: 10 })
code!: string;

@Column({ type: 'text' })
description!: string;
```

### Numeric Types

```typescript
@Column({ type: 'int' })
count!: number;

@Column({ type: 'bigint' })
largeNumber!: number;

@Column({ type: 'decimal', precision: 10, scale: 2 })
price!: number;

@Column({ type: 'real' })
rating!: number;

@Column({ type: 'double precision' })
coordinate!: number;
```

### Date/Time Types

```typescript
@Column({ type: 'date' })
birthday!: string;

@Column({ type: 'timestamp' })
event_time!: string;

@Column({ type: 'timestamptz', default: 'CURRENT_TIMESTAMP' })
created_at!: string;

@Column({ type: 'time' })
daily_reminder!: string;
```

### Boolean Type

```typescript
@Column({ type: 'boolean', default: true })
active!: boolean;

@Column({ type: 'bool' })
verified!: boolean;
```

### JSON Types

```typescript
@Column({ type: 'json' })
settings!: object;

@Column({ type: 'jsonb' })
metadata!: object;
```

### Array Types

```typescript
@Column({ type: 'varchar', array: true })
tags!: string[];

@Column({ type: 'int', array: true })
scores!: number[];
```

### Enum Types

```typescript
@Column({
  type: 'varchar',
  enum: ['pending', 'verified', 'suspended', 'banned'],
  default: 'pending'
})
status!: string;

// Using TypeScript enum
enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator'
}

@Column({ enum: UserRole, default: UserRole.USER })
role!: UserRole;
```

### UUID Type

```typescript
@Column({ type: 'uuid' })
external_id!: string;

@PrimaryGeneratedColumn('uuid')
id!: string;
```

### PostgreSQL Geometric Types

```typescript
@Column({ type: 'point' })
location!: string;

@Column({ type: 'polygon' })
area!: string;

@Column({ type: 'circle' })
radius!: string;
```

### Network Types

```typescript
@Column({ type: 'inet' })
ip_address!: string;

@Column({ type: 'cidr' })
network!: string;

@Column({ type: 'macaddr' })
mac_address!: string;
```

## Relation Decorators

### @OneToMany()

One-to-many relationships.

```typescript
@Entity('users')
export class User {
  @OneToMany(() => Post, post => post.author)
  posts!: Post[];
}

@Entity('posts')
export class Post {
  @ManyToOne(() => User, user => user.posts)
  author!: User;
}
```

### @ManyToOne()

Many-to-one relationships.

```typescript
@Entity('posts')
export class Post {
  @ManyToOne(() => User, user => user.posts, {
    nullable: false,
    onDelete: 'CASCADE'
  })
  author!: User;
  
  @ManyToOne(() => Category, category => category.posts)
  category!: Category;
}
```

**Options:**
- `nullable?: boolean` - Allow NULL foreign keys
- `onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT'` - Delete behavior
- `onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT'` - Update behavior

### @OneToOne()

One-to-one relationships.

```typescript
@Entity('users')
export class User {
  @OneToOne(() => Profile, profile => profile.user)
  profile!: Profile;
}

@Entity('profiles')
export class Profile {
  @OneToOne(() => User, user => user.profile)
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
```

### @ManyToMany()

Many-to-many relationships with join tables.

```typescript
@Entity('posts')
export class Post {
  @ManyToMany(() => Tag, tag => tag.posts)
  @JoinTable({
    name: 'post_tags',
    joinColumn: { name: 'post_id' },
    inverseJoinColumn: { name: 'tag_id' }
  })
  tags!: Tag[];
}

@Entity('tags')
export class Tag {
  @ManyToMany(() => Post, post => post.tags)
  posts!: Post[];
}
```

## Migration Generation

### Automatic SQL Generation

When you run `pgrestify migration:generate`, the system:

1. **Scans Entity Files** - Finds all `@Entity` decorated classes
2. **Extracts Metadata** - Reads decorators and builds table definitions
3. **Generates SQL** - Creates complete CREATE TABLE statements
4. **Creates Rollbacks** - Generates proper DROP statements
5. **Handles Relations** - Creates foreign keys and join tables

### Generated Features

- ✅ **CREATE TABLE** statements with all columns
- ✅ **Primary keys** and auto-generation
- ✅ **Indexes** for performance
- ✅ **Constraints** (unique, check, foreign key)
- ✅ **Enums** and custom types
- ✅ **Comments** for documentation
- ✅ **Rollback scripts** for safe migrations

### Example Generated Migration

```sql
-- Up Migration
CREATE TYPE user_status_enum AS ENUM ('pending', 'verified', 'suspended');

CREATE TABLE IF NOT EXISTS "api"."users" (
  "id" UUID DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) NOT NULL,
  "username" VARCHAR(100) NOT NULL,
  "status" user_status_enum DEFAULT 'pending' NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("email")
);

CREATE INDEX "idx_users_email" ON "api"."users" ("email");

-- Down Migration
DROP INDEX IF EXISTS "idx_users_email";
DROP TABLE IF EXISTS "api"."users" CASCADE;
DROP TYPE IF EXISTS user_status_enum;
```

## Seeder Generation

### Intelligent Data Generation

The seeder system generates realistic test data by:

1. **Column Name Analysis** - Recognizes patterns like `email`, `name`, `phone`
2. **Type-Aware Generation** - Respects column types and constraints
3. **Relationship Handling** - Maintains referential integrity
4. **Realistic Values** - Uses smart fake data patterns

### Seeder Features

```bash
# Basic seeder generation
pgrestify seed:generate --entities "src/entities/**/*.ts" --count 20

# Realistic data patterns
pgrestify seed:generate --realistic --count 100
# ✅ email: user123@example.com
# ✅ first_name: John, Jane, Mike
# ✅ phone: +1234567890
# ✅ age: 18-80

# Multiple output formats
pgrestify seed:generate --format sql    # SQL INSERT statements
pgrestify seed:generate --format json   # JSON data
pgrestify seed:generate --format csv    # CSV format
```

## Best Practices

### Entity Design

```typescript
// ✅ Good entity design
@Entity('users', { comment: 'User accounts' })
@Index(['email'], { unique: true })
@Index(['created_at'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ 
    type: 'varchar', 
    length: 255, 
    unique: true,
    comment: 'User email address'
  })
  email!: string;

  @Column({ 
    type: 'timestamptz', 
    default: 'CURRENT_TIMESTAMP'
  })
  created_at!: string;

  @Column({ 
    type: 'timestamptz', 
    default: 'CURRENT_TIMESTAMP'
  })
  updated_at!: string;
}
```

### Migration Workflow

1. **Create/Edit Entities** - Define your schema with decorators
2. **Generate Migration** - Let the system create SQL
3. **Review Migration** - Check generated SQL before applying
4. **Test Migration** - Run in development environment first
5. **Apply to Production** - Deploy with confidence

### Development Tips

```bash
# Always preview migrations first
pgrestify migration:generate --dry-run

# Use realistic data for better testing
pgrestify seed:generate --realistic

# Generate schema diffs when making changes
pgrestify migration:diff --entities "src/entities/**/*.ts"

# Keep entities in sync with database
pgrestify schema:sync --dry-run  # Preview changes first
```

## Next Steps

- 📖 [TypeORM-Style API Guide](./typeorm-style.md)
- 🔧 [CLI Reference](../guide/cli.md)
- 🏗️ [Migration Guide](../guide/getting-started.md)
- 🌱 [Seeding Guide](../examples/basic-usage.md)

-->
