# 🔄 Migration Guide: PostgREST to Advanced Query Syntax

This guide helps you migrate from PGRestify's standard PostgREST syntax to the new advanced query builder syntax, providing better developer experience while maintaining full PostgREST compatibility.

## 🚀 Quick Start

Both syntaxes work simultaneously - you can gradually migrate or use them side by side:

```typescript
import { createClient } from '@webcoded/pgrestify';

const client = createClient({
  url: 'http://localhost:3000',
  transformColumns: true // Recommended for Advanced-style usage
});

// PostgREST style (still supported)
const users1 = await client.from('users').select('*').eq('active', true).execute();

// Advanced style (new)
const users2 = await client.createQueryBuilder('users').where('active = :active', { active: true }).getMany();
```

## 📊 Syntax Comparison Table

| Operation | PostgREST Style | Advanced Style |
|-----------|----------------|---------------|
| **Basic Select** | `.from('users').select('*').execute()` | `.createQueryBuilder('users').getMany()` |
| **Where Conditions** | `.eq('active', true)` | `.where('active = :active', { active: true })` |
| **Multiple Conditions** | `.eq('active', true).like('name', '%john%')` | `.where('active = :active', { active: true }).andWhere('name LIKE :name', { name: '%john%' })` |
| **OR Conditions** | `.or('active.eq.true,name.like.*john*')` | `.where(new Brackets(qb => qb.where('active = :active', { active: true }).orWhere('name LIKE :name', { name: '%john%' })))` |
| **Ordering** | `.order('created_at', { ascending: false })` | `.orderBy('created_at', 'DESC')` |
| **Pagination** | `.limit(10).offset(20)` | `.take(10).skip(20)` |
| **Single Result** | `.single().execute()` | `.getOne()` |
| **Joins** | `.leftJoin('posts', { select: ['title'] })` | `.leftJoinAndSelect('user.posts', 'post')` |

## 🔍 Detailed Migration Examples

### 1. Basic Queries

#### PostgREST Style
```typescript
// Simple select
const users = await client.from('users').select('*').execute();

// With filters
const activeUsers = await client.from('users')
  .select('id, name, email')
  .eq('active', true)
  .gte('age', 18)
  .execute();

// Ordering and pagination
const recentUsers = await client.from('users')
  .select('*')
  .eq('active', true)
  .order('created_at', { ascending: false })
  .limit(10)
  .offset(0)
  .execute();
```

#### Advanced Style
```typescript
// Simple select
const users = await client.createQueryBuilder('users').getMany();

// With filters
const activeUsers = await client.createQueryBuilder('users', 'user')
  .select(['user.id', 'user.name', 'user.email'])
  .where('user.active = :active', { active: true })
  .andWhere('user.age >= :age', { age: 18 })
  .getMany();

// Ordering and pagination
const recentUsers = await client.createQueryBuilder('users', 'user')
  .where('user.active = :active', { active: true })
  .orderBy('user.created_at', 'DESC')
  .take(10)
  .skip(0)
  .getMany();
```

### 2. Complex WHERE Conditions

#### PostgREST Style
```typescript
// Complex OR conditions require manual string building
const users = await client.from('users')
  .or('and(active.eq.true,age.gte.18),and(role.eq.admin,verified.eq.true)')
  .execute();
```

#### Advanced Style
```typescript
// Much cleaner with Brackets
const users = await client.createQueryBuilder('users', 'user')
  .where(new Brackets(qb => {
    qb.where('user.active = :active AND user.age >= :age', { active: true, age: 18 })
      .orWhere('user.role = :role AND user.verified = :verified', { role: 'admin', verified: true });
  }))
  .getMany();
```

### 3. JOIN Operations

#### PostgREST Style
```typescript
// Embedded resources (PostgREST joins)
const usersWithPosts = await client.from('users')
  .select('*, posts(id, title, content)')
  .eq('active', true)
  .execute();

// More complex join with filters
const usersWithPublishedPosts = await client.from('users')
  .select('*, posts!inner(title, published)')
  .eq('active', true)
  .execute();
```

#### Advanced Style
```typescript
// Clean join syntax
const usersWithPosts = await client.createQueryBuilder('users', 'user')
  .leftJoinAndSelect('user.posts', 'post')
  .where('user.active = :active', { active: true })
  .getMany();

// Join with conditions
const usersWithPublishedPosts = await client.createQueryBuilder('users', 'user')
  .innerJoinAndSelect('user.posts', 'post', 'post.published = :published', { published: true })
  .where('user.active = :active', { active: true })
  .getMany();
```

### 4. Repository Pattern

#### PostgREST Style
```typescript
// Direct client usage
const users = await client.from('users').select('*').eq('active', true).execute();
const user = await client.from('users').select('*').eq('id', 1).single().execute();

// Custom functions
async function findActiveUsers() {
  return client.from('users').select('*').eq('active', true).execute();
}

async function findUserByEmail(email: string) {
  return client.from('users').select('*').eq('email', email).single().execute();
}
```

#### Advanced Style
```typescript
// Repository pattern
const userRepository = client.getAdvancedRepository<User>('users');

// Standard repository methods
const users = await userRepository.find({ where: { active: true } });
const user = await userRepository.findOne({ where: { id: 1 } });

// Custom repository class
@CustomRepository('users')
class UserRepository extends CustomRepositoryBase<User> {
  async findActiveUsers(): Promise<User[]> {
    return this.createQueryBuilder()
      .where('active = :active', { active: true })
      .getMany();
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.createQueryBuilder()
      .where('email = :email', { email })
      .getOne();
  }
}

const customUserRepo = client.getCustomAdvancedRepository(UserRepository, 'users');
```

## 🎯 Migration Strategy

### 1. Gradual Migration Approach

Start by identifying the most complex queries that would benefit from Advanced syntax:

```typescript
// Step 1: Keep simple queries as PostgREST style
const simpleUsers = await client.from('users').select('*').execute();

// Step 2: Migrate complex queries to Advanced style
const complexUsers = await client.createQueryBuilder('users', 'user')
  .where(new Brackets(qb => {
    qb.where('user.name LIKE :name', { name: '%john%' })
      .orWhere('user.email LIKE :email', { email: '%@company.com' });
  }))
  .andWhere('user.active = :active', { active: true })
  .leftJoinAndSelect('user.posts', 'post', 'post.published = :published', { published: true })
  .orderBy('user.created_at', 'DESC')
  .take(10)
  .getMany();

// Step 3: Gradually convert more queries as needed
```

### 2. Repository-First Approach

Start with repositories for new features:

```typescript
// New features use Advanced-style repositories
const postRepository = client.getAdvancedRepository<Post>('posts');

// Existing code continues to use PostgREST style
const legacyUsers = await client.from('users').select('*').execute();
```

### 3. Feature-by-Feature Migration

Migrate one feature/module at a time:

```typescript
// user.service.ts - Migrated to Advanced style
export class UserService {
  private userRepository = client.getAdvancedRepository<User>('users');

  async findActiveUsers(): Promise<User[]> {
    return this.userRepository.find({ where: { active: true } });
  }

  async searchUsers(query: string): Promise<User[]> {
    return this.userRepository.createQueryBuilder()
      .where(new Brackets(qb => {
        qb.where('first_name ILIKE :query', { query: `%${query}%` })
          .orWhere('last_name ILIKE :query', { query: `%${query}%` })
          .orWhere('email ILIKE :query', { query: `%${query}%` });
      }))
      .getMany();
  }
}

// post.service.ts - Still using PostgREST style (will migrate later)
export class PostService {
  async findPosts() {
    return client.from('posts').select('*').execute();
  }
}
```

## 🔧 Configuration Changes

### Column Transformation

Enable column transformation for better Advanced experience:

```typescript
const client = createClient({
  url: 'http://localhost:3000',
  transformColumns: true, // Enables camelCase ↔ snake_case transformation
});

// Now you can use camelCase in your TypeScript code
interface User {
  id: number;
  firstName: string;    // Maps to first_name in database
  lastName: string;     // Maps to last_name in database
  createdAt: string;    // Maps to created_at in database
}
```

### Type Definitions

Update your TypeScript interfaces to match Advanced conventions:

```typescript
// Before (PostgREST style)
interface User {
  id: number;
  first_name: string;
  last_name: string;
  created_at: string;
}

// After (Advanced style with decorators)
@Entity('users')
class User {
  @PrimaryColumn()
  id!: number;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column()
  createdAt!: string;
}
```

## 📈 Benefits of Migration

### 1. Better Type Safety
```typescript
// PostgREST: String-based, prone to typos
client.from('users').eq('first_nam', 'John'); // Typo not caught

// Advanced: Strongly typed, IDE support
client.createQueryBuilder<User>('users', 'user')
  .where('user.firstName = :name', { name: 'John' }); // Autocomplete & type checking
```

### 2. Parameter Safety
```typescript
// PostgREST: Manual value handling
const userInput = "'; DROP TABLE users; --";
client.from('users').eq('name', userInput); // Potential injection

// Advanced: Automatic parameter binding
client.createQueryBuilder('users')
  .where('name = :name', { name: userInput }); // Safe parameter binding
```

### 3. Complex Query Readability
```typescript
// PostgREST: Hard to read complex conditions
client.from('users')
  .or('and(active.eq.true,role.eq.admin),and(verified.eq.true,age.gte.18)')

// Advanced: Clear, nested structure
client.createQueryBuilder('users', 'user')
  .where(new Brackets(qb => {
    qb.where('user.active = :active AND user.role = :role', { active: true, role: 'admin' })
      .orWhere('user.verified = :verified AND user.age >= :age', { verified: true, age: 18 });
  }))
```

### 4. Repository Organization
```typescript
// PostgREST: Scattered query logic
async function getUserPosts(userId: number) {
  return client.from('posts').eq('author_id', userId).execute();
}

async function getUserComments(userId: number) {
  return client.from('comments').eq('author_id', userId).execute();
}

// Advanced: Organized in repositories
@CustomRepository('users')
class UserRepository extends CustomRepositoryBase<User> {
  async getUserPosts(userId: number): Promise<Post[]> {
    return this.createQueryBuilder()
      .relation('posts')
      .of({ id: userId })
      .loadMany();
  }

  async getUserComments(userId: number): Promise<Comment[]> {
    return this.createQueryBuilder()
      .relation('comments')
      .of({ id: userId })
      .loadMany();
  }
}
```

## ⚠️ Migration Considerations

### 1. Learning Curve
- Team members need to learn Advanced syntax
- Consider training sessions for complex queries
- Start with simple migrations

### 2. Performance
- Both syntaxes generate equivalent PostgREST queries
- No performance difference at runtime
- Advanced style may have slight overhead in query building

### 3. Backwards Compatibility
- All existing PostgREST syntax continues to work
- No breaking changes
- Can mix both styles in the same application

### 4. Testing Strategy
```typescript
// Test both old and new implementations during migration
describe('User queries', () => {
  it('should return same results for PostgREST and Advanced styles', async () => {
    // Old PostgREST style
    const oldResult = await client.from('users')
      .select('*')
      .eq('active', true)
      .execute();

    // New Advanced style
    const newResult = await client.createQueryBuilder('users')
      .where('active = :active', { active: true })
      .getMany();

    expect(newResult).toEqual(oldResult.data);
  });
});
```

## 🎉 Success Checklist

- [ ] Enable `transformColumns: true` in client configuration
- [ ] Create Advanced-style entity interfaces/classes
- [ ] Identify complex queries that benefit from Advanced syntax
- [ ] Start with repository pattern for new features
- [ ] Gradually migrate existing complex queries
- [ ] Update tests to verify equivalent behavior
- [ ] Train team on Advanced syntax and Brackets usage
- [ ] Document any custom repository patterns
- [ ] Set up TypeScript strict mode for better type safety

## 📚 Additional Resources

- [Advanced Query Builder Documentation](https://typeorm.io/select-query-builder)
- [PostgREST API Reference](https://postgrest.org/en/stable/api.html)
- [PGRestify Advanced Examples](./examples/typeorm-examples.ts)
- [Advanced Queries Guide](./advanced-queries.md)

---

**Need Help?** Check out our [comprehensive examples](./examples/typeorm-examples.ts) or create an issue on GitHub for specific migration questions!