# Defining Database Types

Comprehensive guide to defining and working with types in PGRestify.

## Why Type Definitions Matter

Type definitions are crucial for:
- Compile-time type checking
- Intellisense and autocompletion
- Runtime type validation
- Improved developer experience

## Basic Type Definition

```typescript
// Define interfaces that match your database schema
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

interface Post {
  id: number;
  user_id: number;
  title: string;
  content: string;
  published: boolean;
  created_at: string;
}
```

## Advanced Type Techniques

### Nullable and Optional Fields

```typescript
interface Profile {
  id: number;
  user_id: number;
  bio?: string;  // Optional field
  avatar_url: string | null;  // Nullable field
  social_links?: {
    twitter?: string;
    linkedin?: string;
  };
}
```

### Union Types for Enums

```typescript
type UserRole = 'admin' | 'user' | 'moderator';

interface User {
  id: number;
  name: string;
  role: UserRole;
}
```

## Type-Safe Queries

```typescript
// Type-safe query with generics
const users = await client
  .from<User>('users')
  .select('*')
  .eq('role', 'admin');  // TypeScript ensures type safety
```

## Relationship Types

```typescript
// Define relationships between types
interface UserWithPosts extends User {
  posts: Post[];
}

// Fetch users with their posts
const usersWithPosts = await client
  .from<UserWithPosts>('users')
  .select(`
    *,
    posts:posts(*)
  `);
```

## Type Inference

```typescript
// PGRestify helps with type inference
const client = createClient('http://localhost:3000');

// TypeScript knows the return type
const user = await client
  .from('users')
  .select('*')
  .eq('id', 1)
  .single();  // Inferred type based on table schema
```

## Runtime Type Validation

```typescript
// Create a type guard for runtime validation
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' && 
    obj !== null &&
    'id' in obj &&
    'name' in obj &&
    'email' in obj
  );
}

// Use in your code
function processUser(data: unknown) {
  if (isUser(data)) {
    // data is now typed as User
    console.log(data.name);
  }
}
```

## Utility Types

```typescript
// Partial type - make all fields optional
type PartialUser = Partial<User>;

// Pick specific fields
type UserSummary = Pick<User, 'id' | 'name'>;

// Omit specific fields
type UserWithoutTimestamp = Omit<User, 'created_at'>;
```

## Database Schema Synchronization

```typescript
// Generate types from database schema
import { generateTypesFromSchema } from '@webcoded/pgrestify/schema';

async function syncTypes() {
  const types = await generateTypesFromSchema({
    connectionString: process.env.DATABASE_URL,
    outputFile: 'src/types/database.ts'
  });
}
```

## Complex Type Scenarios

```typescript
// Nested and complex types
interface Order {
  id: number;
  user_id: number;
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  items: Array<{
    product_id: number;
    quantity: number;
    price: number;
  }>;
  user: User;
}
```

## Performance Considerations

```typescript
// Optimize type definitions
interface LargeTable {
  // Use primitive types
  id: number;
  name: string;
  
  // Avoid complex nested objects in large tables
  metadata?: Record<string, unknown>;
}
```

## Best Practices

- Match types exactly to database schema
- Use strict TypeScript configuration
- Leverage type inference
- Create type guards for runtime validation
- Keep types simple and focused
- Use utility types for flexibility
- Generate types from database schema when possible

## Common Pitfalls

- Avoid `any` type
- Don't use type assertions (`as`) unnecessarily
- Be careful with `unknown` type
- Validate external data
- Keep types up-to-date with schema changes

## Integration with ORM and Query Builders

```typescript
// Works with various query methods
const userRepo = client.getRepository<User>('users');

// Type-safe repository methods
const user = await userRepo.findById(1);
const newUser = await userRepo.save({
  name: 'John Doe',
  email: 'john@example.com'
});
```

## Debugging Type Issues

```typescript
// TypeScript compiler flags for strict typing
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true
  }
}
```

## Advanced Type Validation

```typescript
// Create a comprehensive type validator
function validateUserSchema(data: unknown): data is User {
  if (typeof data !== 'object' || data === null) return false;

  const requiredFields: (keyof User)[] = ['id', 'name', 'email'];
  
  return requiredFields.every(field => {
    const value = (data as User)[field];
    
    switch (field) {
      case 'id':
        return typeof value === 'number';
      case 'name':
      case 'email':
        return typeof value === 'string';
      default:
        return true;
    }
  });
}
```

## Recommended Tools

- TypeScript Language Server
- ESLint with TypeScript plugin
- Visual Studio Code
- Prettier for formatting

## Continuous Type Checking

```bash
# Add to package.json scripts
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch"
  }
}
```

## Conclusion

Proper type definitions are the cornerstone of a robust, type-safe application. They provide compile-time checks, improve developer experience, and help prevent runtime errors.