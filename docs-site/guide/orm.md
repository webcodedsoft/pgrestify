<!-- TODO: ORM-Style API & Entity System temporarily disabled for security review

# ORM-Style API & Entity System

PGRestify provides a familiar, ORM-inspired API that makes database interactions intuitive and type-safe. It includes both a client API and a complete entity system with decorators for schema generation.

## Repository Pattern

The repository pattern allows you to interact with database tables using a consistent, object-oriented approach.

```typescript
import { createClient } from '@webcoded/pgrestify';

// Define your type
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

// Create a client
const client = createClient('http://localhost:3000');

// Get a repository for the users table
const userRepo = client.getRepository<User>('users');
```

## Basic CRUD Operations

### Finding Records

```typescript
// Find all users
const allUsers = await userRepo.find();

// Find users by specific criteria
const activeUsers = await userRepo.findBy({ active: true });

// Find a single user by ID
const user = await userRepo.findById(1);

// Find a single user with complex conditions
const specificUser = await userRepo.findOne({ 
  email: 'john@example.com',
  active: true 
});
```

### Creating Records

```typescript
// Create a new user
const newUser = await userRepo.save({
  name: 'John Doe',
  email: 'john@example.com',
  active: true
});

// Bulk insert
const newUsers = await userRepo.save([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' }
]);
```

### Updating Records

```typescript
// Update a user by ID
const updatedUser = await userRepo.update(1, {
  name: 'John Updated',
  active: false
});

// Update multiple records
await userRepo.update(
  { active: false }, 
  { lastLogin: new Date() }
);
```

### Deleting Records

```typescript
// Delete a user by ID
await userRepo.remove(1);

// Delete multiple users
await userRepo.remove([1, 2, 3]);

// Delete with conditions
await userRepo.removeBy({ active: false });
```

## Advanced Querying

```typescript
// Complex query with filtering and sorting
const advancedQuery = await userRepo
  .createQueryBuilder()
  .where('active = true')
  .andWhere('created_at > :date', { date: '2023-01-01' })
  .orderBy('created_at', 'DESC')
  .limit(10)
  .getMany();
```

## Type Safety

PGRestify ensures complete type safety throughout your queries:

```typescript
// TypeScript will provide autocomplete and type checking
const user = await userRepo.findOne({
  // Only allows properties of the User type
  name: 'John',  // ✅ Correct
  // invalidProperty: 'test'  // ❌ Type error
});
```

## Best Practices

- Always define interfaces for your database tables
- Use repositories for consistent data access
- Leverage TypeScript's type system for compile-time checks
- Handle potential errors with try-catch blocks

## Error Handling

```typescript
try {
  const user = await userRepo.findOneOrFail({ id: 999 });
} catch (error) {
  if (error.name === 'NotFoundError') {
    console.log('User not found');
  }
}
```

## Performance Considerations

- Repositories are lightweight wrappers around the query builder
- They provide a more intuitive interface without significant overhead
- Use `createQueryBuilder()` for complex, performance-critical queries

## Entity System & Schema Generation

PGRestify includes a complete ORM-like entity system for defining database schemas using TypeScript decorators.

### Generating Entities

Create new entity classes with the CLI:

```bash
# Generate a basic entity
pgrestify generate entity User

# Generate with specific columns
pgrestify generate entity Product --columns "name:varchar:required,price:decimal:required,description:text"

# Generate with full template (includes timestamps)
pgrestify generate entity Post --template full
```

### Entity Decorators

Define your database schema using familiar decorators:

```typescript
import 'reflect-metadata';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
  Index,
  Unique,
  Check
} from '@webcoded/pgrestify/schema';

@Entity({ 
  name: 'users',
  schema: 'api',
  comment: 'User accounts and profiles' 
})
@Index(['email'], { unique: true })
@Index(['created_at', 'status'])
@Unique(['email', 'username'])
@Check('age >= 0 AND age <= 150', 'valid_age')
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
    type: 'varchar', 
    length: 100,
    comment: 'Display name for the user'
  })
  username!: string;

  @Column({ 
    type: 'int',
    nullable: true,
    check: 'age >= 0 AND age <= 150'
  })
  age?: number;

  @Column({ 
    type: 'boolean',
    default: true,
    comment: 'Whether the user account is active'
  })
  active!: boolean;

  @Column({ 
    type: 'varchar',
    enum: ['pending', 'verified', 'suspended', 'banned'],
    default: 'pending',
    comment: 'User account status'
  })
  status!: string;

  @Column({ 
    type: 'jsonb',
    nullable: true,
    comment: 'User preferences and settings'
  })
  preferences?: object;

  @Column({ 
    type: 'timestamptz',
    default: 'CURRENT_TIMESTAMP',
    comment: 'Account creation timestamp'
  })
  created_at!: string;
}
```

### Supported Column Types

```typescript
// Basic types
@Column({ type: 'varchar', length: 255 })
@Column({ type: 'text' })
@Column({ type: 'int' })
@Column({ type: 'bigint' })
@Column({ type: 'decimal', precision: 10, scale: 2 })
@Column({ type: 'boolean' })

// Date/time types
@Column({ type: 'date' })
@Column({ type: 'timestamp' })
@Column({ type: 'timestamptz' })

// JSON types
@Column({ type: 'json' })
@Column({ type: 'jsonb' })

// Arrays
@Column({ type: 'varchar', array: true })

// Enums
@Column({ 
  type: 'varchar',
  enum: ['active', 'inactive', 'pending']
})

// UUID with auto-generation
@PrimaryGeneratedColumn('uuid')
@PrimaryGeneratedColumn('increment') // for serial/bigserial
```

### Migration Generation from Entities

Once you've defined your entities, generate migrations automatically:

```bash
# Generate migration from all entities
pgrestify migration:generate --entities "src/entities/**/*.ts" --name "create_initial_schema"

# Preview generated SQL (dry run)
pgrestify migration:generate --entities "src/entities/**/*.ts" --dry-run

# Generate migration for specific schema
pgrestify migration:generate --entities "src/entities/**/*.ts" --schema "api" --name "add_user_tables"
```

**Generated Migration Example:**
```sql
-- Migration: create_users_table
-- Generated: 2025-08-24T02:00:00.000Z
-- Type: entity-based
-- Entities: User

-- Up:
CREATE TYPE user_status_enum AS ENUM ('pending', 'verified', 'suspended', 'banned');

CREATE TABLE IF NOT EXISTS "api"."users" (
  "id" UUID DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) NOT NULL,
  "username" VARCHAR(100) NOT NULL,
  "age" INTEGER CHECK (age >= 0 AND age <= 150),
  "active" BOOLEAN DEFAULT TRUE NOT NULL,
  "status" user_status_enum DEFAULT 'pending' NOT NULL,
  "preferences" JSONB,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY ("id"),
  UNIQUE ("email"),
  CONSTRAINT "valid_age" CHECK (age >= 0 AND age <= 150)
);

CREATE UNIQUE INDEX "idx_users_0" ON "api"."users" ("email");
CREATE INDEX "idx_users_1" ON "api"."users" ("created_at", "status");

-- Down:
DROP INDEX IF EXISTS "idx_users_1";
DROP INDEX IF EXISTS "idx_users_0";
DROP TABLE IF EXISTS "api"."users" CASCADE;
DROP TYPE IF EXISTS user_status_enum;
```

### Seeder Generation from Entities

Generate realistic test data based on your entity definitions:

```bash
# Generate seeders for all entities
pgrestify seed:generate --entities "src/entities/**/*.ts" --count 20

# Generate realistic data using smart naming patterns
pgrestify seed:generate --entities "src/entities/**/*.ts" --realistic --count 50

# Generate seeder for specific entity
pgrestify seed:generate --entity User --count 100 --format sql

# Preview generated data
pgrestify seed:generate --entities "src/entities/**/*.ts" --dry-run --realistic
```

**Generated Seeder Example:**
```sql
-- Seed data for users
-- Generated: 2025-08-24T02:00:00.000Z
-- Records: 10

INSERT INTO "api"."users" ("email", "username", "first_name", "last_name", "age", "active", "status") VALUES
  ('user0@example.com', 'user_0', 'John', 'Smith', 28, TRUE, 'verified'),
  ('user1@example.com', 'user_1', 'Jane', 'Johnson', 35, TRUE, 'pending'),
  ('user2@example.com', 'user_2', 'Mike', 'Brown', 42, FALSE, 'suspended');

-- Rollback (delete seed data)
-- DELETE FROM "api"."users" WHERE email LIKE 'user%@example.com';
```

### Complete Workflow

The typical development workflow with entities:

1. **Generate Entity**
   ```bash
   pgrestify generate entity User --template full
   ```

2. **Edit Entity** (customize columns, add relations)
   ```typescript
   // Add custom fields, indexes, constraints
   @Column({ type: 'varchar', length: 50, unique: true })
   username!: string;
   
   @OneToMany(() => Post, post => post.author)
   posts!: Post[];
   ```

3. **Generate Migration**
   ```bash
   pgrestify migration:generate --entities "src/entities/**/*.ts" --name "create_user_schema"
   ```

4. **Run Migration**
   ```bash
   pgrestify migrate
   ```

5. **Generate Seed Data**
   ```bash
   pgrestify seed:generate --entities "src/entities/**/*.ts" --realistic --count 25
   ```

6. **Run Seeders**
   ```bash
   pgrestify seed
   ```

### Schema Comparison & Diffing

Compare your entities with the current database schema:

```bash
# Generate migration with only the differences
pgrestify migration:diff --entities "src/entities/**/*.ts" --name "schema_updates"

# Synchronize schema directly (⚠️ destructive)
pgrestify schema:sync --entities "src/entities/**/*.ts" --confirm
```

## Entity Relations

Define relationships between entities:

```typescript
@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  // Many-to-One relation
  @ManyToOne(() => User, user => user.posts)
  author!: User;

  // Many-to-Many relation
  @ManyToMany(() => Tag, tag => tag.posts)
  tags!: Tag[];
}

@Entity('users')  
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // One-to-Many relation
  @OneToMany(() => Post, post => post.author)
  posts!: Post[];
}
```

## Advanced Features

### Custom Constraints

```typescript
@Entity('products')
@Check('price > 0', 'positive_price')
@Check('stock_quantity >= 0', 'non_negative_stock')
export class Product {
  @Column({ 
    type: 'decimal', 
    precision: 10, 
    scale: 2,
    check: 'price > 0'
  })
  price!: number;
}
```

### Composite Indexes

```typescript
@Entity('user_sessions')
@Index(['user_id', 'created_at'])
@Index(['session_token'], { unique: true })
@Unique(['user_id', 'device_id'])
export class UserSession {
  // Entity definition...
}
```

### Custom Table Names

```typescript
@Entity('user_profiles', {
  schema: 'profiles',
  comment: 'Extended user profile information'
})
export class UserProfile {
  // Entity definition...
}
```

-->
