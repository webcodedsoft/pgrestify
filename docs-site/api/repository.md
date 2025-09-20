# Repository API Reference

Comprehensive API documentation for PGRestify's ORM-style Repository pattern with full ORM-inspired functionality.

## Repository Types

PGRestify provides three repository types:

### 🏗️ SimpleRepository
Basic CRUD operations with type safety.

### 🔧 BaseRepository
Advanced repository with query builder support.

### 🚀 CustomRepositoryBase
Extensible repository for custom business logic.

---

## SimpleRepository Interface

```typescript
interface SimpleRepository<T extends Record<string, unknown> = Record<string, unknown>> {
  // Basic find methods
  find(): Promise<T[]>;
  findBy(where: Partial<T>): Promise<T[]>;
  findOne(where: Partial<T>): Promise<T | null>;
  findOneBy(where: Partial<T>): Promise<T | null>;

  // Create/Update methods
  save(entity: Partial<T>): Promise<T>;
  update(criteria: Partial<T>, updates: Partial<T>): Promise<T[]>;
  delete(criteria: Partial<T>): Promise<void>;

  // Advanced querying
  createQueryBuilder(): SelectQueryBuilder<T>;
  count(where?: Partial<T>): Promise<number>;
}
```

## BaseRepository Interface

```typescript
interface BaseRepository<T extends Record<string, unknown> = Record<string, unknown>> {
  // Find methods with options
  find(options?: FindManyOptions<T>): Promise<T[]>;
  findBy(where: FindOptionsWhere<T>): Promise<T[]>;
  findOne(options?: FindOneOptions<T>): Promise<T | null>;
  findOneBy(where: FindOptionsWhere<T>): Promise<T | null>;
  findOneOrFail(options?: FindOneOptions<T>): Promise<T>;

  // CRUD operations
  save(entity: Partial<T>): Promise<T>;
  create(entityData: Partial<T>): Promise<T>;
  update(criteria: Partial<T>, updates: Partial<T>): Promise<T[]>;
  delete(criteria: Partial<T>): Promise<void>;
  remove(entity: T): Promise<void>;

  // Utility methods
  count(where?: Partial<T>): Promise<number>;
  increment(criteria: Partial<T>, propertyPath: string, value: number): Promise<void>;
  decrement(criteria: Partial<T>, propertyPath: string, value: number): Promise<void>;

  // Query builder
  createQueryBuilder(alias?: string): SelectQueryBuilder<T>;
}
```

## CustomRepositoryBase Interface

```typescript
abstract class CustomRepositoryBase<T extends Record<string, unknown> = Record<string, unknown>> {
  protected tableName: string;
  protected httpClient: HttpClient;
  protected cache: QueryCache;
  protected auth: AuthManager;
  protected config: ClientConfig;

  // Inherited from BaseRepository
  find(options?: FindManyOptions<T>): Promise<T[]>;
  findBy(where: FindOptionsWhere<T>): Promise<T[]>;
  findOne(options?: FindOneOptions<T>): Promise<T | null>;
  findOneBy(where: FindOptionsWhere<T>): Promise<T | null>;
  findOneOrFail(options?: FindOneOptions<T>): Promise<T>;

  save(entity: Partial<T>): Promise<T>;
  create(entityData: Partial<T>): Promise<T>;
  update(criteria: Partial<T>, updates: Partial<T>): Promise<T[]>;
  delete(criteria: Partial<T>): Promise<void>;
  remove(entity: T): Promise<void>;

  count(where?: Partial<T>): Promise<number>;
  increment(criteria: Partial<T>, propertyPath: string, value: number): Promise<void>;
  decrement(criteria: Partial<T>, propertyPath: string, value: number): Promise<void>;

  // Query builder access
  createQueryBuilder(alias?: string): SelectQueryBuilder<T>;
  createAdvancedQuery(): SelectQueryBuilder<T>;
}
```

## Creating Repositories

```typescript
// Define your entity interface
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

// Create a simple repository
const userRepo = client.getRepository<User>('users');

// Create a custom repository
import { CustomRepositoryBase } from '@webcoded/pgrestify';

class UserRepository extends CustomRepositoryBase<User> {
  async findActiveUsers(): Promise<User[]> {
    return this.createQueryBuilder()
      .where('active = :active', { active: true })
      .andWhere('verified = :verified', { verified: true })
      .getMany();
  }
}

const customUserRepo = client.getCustomRepository(UserRepository, 'users');
```

## Find Methods

```typescript
// Find all records
const allUsers = await userRepo.find();

// Find with criteria
const activeUsers = await userRepo.findBy({ active: true });

// Find single record
const user = await userRepo.findOne({ email: 'john@example.com' });
const userById = await userRepo.findOneBy({ id: 123 });

// Find or throw error
try {
  const requiredUser = await userRepo.findOneOrFail({ id: 999 });
} catch (error) {
  console.error('User not found');
}

// Find with options
const recentUsers = await userRepo.find({
  where: { active: true },
  order: { created_at: 'DESC' },
  take: 10,
  skip: 0
});
```

## Create and Update Methods

```typescript
// Create a new user
const newUser = await userRepo.save({
  name: 'John Doe',
  email: 'john@example.com',
  active: true
});

// Create with explicit method
const createdUser = await userRepo.create({
  name: 'Jane Doe',
  email: 'jane@example.com',
  active: true
});

// Update by criteria
const updatedUsers = await userRepo.update(
  { id: 123 }, 
  { name: 'Updated Name', active: false }
);

// Update multiple records
await userRepo.update(
  { active: false }, 
  { active: true }
);

// Increment/Decrement counters
await userRepo.increment({ id: 123 }, 'login_count', 1);
await userRepo.decrement({ id: 123 }, 'credit_balance', 50);
```

## Delete Methods

```typescript
// Remove a specific entity
await userRepo.remove(user);

// Delete by criteria
await userRepo.delete({ active: false });

// Delete inactive users older than 1 year
await userRepo.delete({ 
  active: false,
  // Note: Complex date conditions better handled with query builder
});
```

## Advanced Querying with SelectQueryBuilder

```typescript
// Basic query builder usage
const activeUsers = await userRepo
  .createQueryBuilder()
  .where('active = :active', { active: true })
  .orderBy('created_at', 'DESC')
  .getMany();

// Complex query with multiple conditions
const complexQuery = await userRepo
  .createQueryBuilder()
  .select(['id', 'name', 'email', 'created_at'])
  .where('active = :active', { active: true })
  .andWhere('age >= :minAge', { minAge: 18 })
  .andWhere('created_at >= :date', { date: '2024-01-01' })
  .orderBy('created_at', 'DESC')
  .addOrderBy('name', 'ASC')
  .limit(20)
  .offset(40)
  .getMany();

// Query with JOINs (PostgREST embedded resources)
const usersWithPosts = await userRepo
  .createQueryBuilder()
  .leftJoinAndSelect('posts', 'post')
  .leftJoinAndSelect('profile', 'profile')
  .where('active = :active', { active: true })
  .getMany();

// Using brackets for complex conditions
import { Brackets } from '@webcoded/pgrestify';

const complexConditions = await userRepo
  .createQueryBuilder()
  .where('active = :active', { active: true })
  .andWhere(new Brackets(qb => {
    qb.where('role = :admin', { admin: 'admin' })
      .orWhere('verified = :verified', { verified: true });
  }))
  .getMany();

// Subqueries with EXISTS
const usersWithPosts = await userRepo
  .createQueryBuilder()
  .whereExists(subQuery => {
    subQuery
      .select('1')
      .from('posts')
      .where('posts.user_id = users.id');
  })
  .getMany();

// Get single results
const singleUser = await userRepo
  .createQueryBuilder()
  .where('email = :email', { email: 'john@example.com' })
  .getOne(); // Returns User | null

const requiredUser = await userRepo
  .createQueryBuilder()
  .where('id = :id', { id: 123 })
  .getOneOrFail(); // Throws error if not found

// Get count
const activeUserCount = await userRepo
  .createQueryBuilder()
  .where('active = :active', { active: true })
  .getCount();
```

## Custom Repository Examples

```typescript
import { CustomRepositoryBase, Brackets } from '@webcoded/pgrestify';

class UserRepository extends CustomRepositoryBase<User> {
  // Find active verified users
  async findActiveUsers(): Promise<User[]> {
    return this.createQueryBuilder()
      .where('active = :active', { active: true })
      .andWhere('verified = :verified', { verified: true })
      .orderBy('created_at', 'DESC')
      .getMany();
  }

  // Find users by role with complex conditions
  async findUsersByRole(role: string, includeInactive = false): Promise<User[]> {
    const query = this.createQueryBuilder()
      .where('role = :role', { role });

    if (!includeInactive) {
      query.andWhere('active = :active', { active: true });
    }

    return query
      .leftJoinAndSelect('profile', 'profile')
      .orderBy('name', 'ASC')
      .getMany();
  }

  // Complex search with multiple criteria
  async searchUsers(searchTerm: string, filters: {
    role?: string;
    active?: boolean;
    ageRange?: { min?: number; max?: number };
  }): Promise<User[]> {
    const query = this.createQueryBuilder();

    // Text search
    if (searchTerm) {
      query.where(new Brackets(qb => {
        qb.where('name ILIKE :search', { search: `%${searchTerm}%` })
          .orWhere('email ILIKE :search', { search: `%${searchTerm}%` });
      }));
    }

    // Apply filters
    if (filters.role) {
      query.andWhere('role = :role', { role: filters.role });
    }

    if (filters.active !== undefined) {
      query.andWhere('active = :active', { active: filters.active });
    }

    if (filters.ageRange) {
      if (filters.ageRange.min) {
        query.andWhere('age >= :minAge', { minAge: filters.ageRange.min });
      }
      if (filters.ageRange.max) {
        query.andWhere('age <= :maxAge', { maxAge: filters.ageRange.max });
      }
    }

    return query
      .orderBy('name', 'ASC')
      .getMany();
  }

  // Find users with recent activity
  async findUsersWithRecentActivity(days: number): Promise<User[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.createQueryBuilder()
      .where('last_login >= :cutoff', { cutoff: cutoffDate.toISOString() })
      .orWhere('updated_at >= :cutoff', { cutoff: cutoffDate.toISOString() })
      .orderBy('last_login', 'DESC')
      .getMany();
  }

  // Pagination example
  async findUsersPaginated(page: number, pageSize: number): Promise<{
    users: User[];
    total: number;
    hasMore: boolean;
  }> {
    const [users, total] = await Promise.all([
      this.createQueryBuilder()
        .where('active = :active', { active: true })
        .orderBy('created_at', 'DESC')
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .getMany(),
      this.createQueryBuilder()
        .where('active = :active', { active: true })
        .getCount()
    ]);

    return {
      users,
      total,
      hasMore: (page * pageSize) < total
    };
  }
}

// Use the custom repository
const customUserRepo = client.getCustomRepository(UserRepository, 'users');

// Use custom methods
const activeUsers = await customUserRepo.findActiveUsers();
const admins = await customUserRepo.findUsersByRole('admin');
const searchResults = await customUserRepo.searchUsers('john', {
  role: 'user',
  active: true,
  ageRange: { min: 18, max: 65 }
});
```

## Repository Factory

```typescript
// Using the RepositoryFactory for multiple repositories
const repositoryFactory = client.repositoryFactory;

// Create multiple repositories
const userRepo = repositoryFactory.getRepository<User>('users');
const postRepo = repositoryFactory.getRepository<Post>('posts');
const commentRepo = repositoryFactory.getRepository<Comment>('comments');

// Create custom repositories
const customUserRepo = repositoryFactory.getCustomRepository(UserRepository, 'users');
```

## Data Manager

```typescript
// Using the DataManager for coordinated operations
const dataManager = client.manager;

// Perform related operations
async function createUserWithProfile(userData: Partial<User>, profileData: any) {
  // Create user
  const user = await dataManager.getRepository<User>('users').save(userData);
  
  // Create related profile
  const profile = await dataManager.getRepository('profiles').save({
    ...profileData,
    user_id: user.id
  });

  return { user, profile };
}
```

## Type Safety and Error Handling

```typescript
// Complete type safety with TypeScript
const typeSafeUser = await userRepo.save({
  name: 'John Doe',              // ✅ Correct type
  email: 'john@example.com',     // ✅ Correct type
  active: true,                  // ✅ Correct type
  // age: '30'                   // ❌ TypeScript error - wrong type
});

// Proper error handling
try {
  const user = await userRepo.findOneOrFail({ id: 999 });
  console.log('Found user:', user.name);
} catch (error) {
  console.error('User not found:', error.message);
}

// Handle validation errors
try {
  await userRepo.save({
    name: '',  // Invalid empty name
    email: 'invalid-email'  // Invalid email format
  });
} catch (error) {
  if (error.name === 'ValidationError') {
    console.error('Validation failed:', error.details);
  }
}
```

## Query Performance and Best Practices

```typescript
// ✅ Good: Select only needed columns
const lightUsers = await userRepo
  .createQueryBuilder()
  .select(['id', 'name', 'email'])
  .where('active = :active', { active: true })
  .getMany();

// ✅ Good: Use parameter binding for security
const searchUsers = await userRepo
  .createQueryBuilder()
  .where('name ILIKE :search', { search: `%${searchTerm}%` })
  .getMany();

// ✅ Good: Use pagination for large datasets
const paginatedUsers = await userRepo
  .createQueryBuilder()
  .orderBy('created_at', 'DESC')
  .limit(20)
  .offset(page * 20)
  .getMany();

// ✅ Good: Use appropriate JOINs
const usersWithProfiles = await userRepo
  .createQueryBuilder()
  .leftJoinAndSelect('profile', 'profile')
  .where('active = :active', { active: true })
  .getMany();

// ❌ Avoid: Too many unfiltered queries
// const allUsers = await userRepo.find(); // Could return millions of records
```

## Advanced Repository Patterns

```typescript
// Repository with caching
class CachedUserRepository extends CustomRepositoryBase<User> {
  private cache = new Map<string, User[]>();

  async findActiveUsers(): Promise<User[]> {
    const cacheKey = 'active_users';
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const users = await this.createQueryBuilder()
      .where('active = :active', { active: true })
      .getMany();

    this.cache.set(cacheKey, users);
    
    // Clear cache after 5 minutes
    setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);
    
    return users;
  }
}

// Repository with validation
class ValidatedUserRepository extends CustomRepositoryBase<User> {
  async save(userData: Partial<User>): Promise<User> {
    // Custom validation
    if (userData.email && !this.isValidEmail(userData.email)) {
      throw new Error('Invalid email format');
    }

    if (userData.age && (userData.age < 0 || userData.age > 150)) {
      throw new Error('Invalid age range');
    }

    // Pre-process data
    if (userData.email) {
      userData.email = userData.email.toLowerCase().trim();
    }

    return super.save(userData);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
```

## Repository Factory and Management

```typescript
// Central repository management
class UserService {
  private userRepo: UserRepository;
  private profileRepo: SimpleRepository<Profile>;

  constructor(private client: PostgRESTClient) {
    this.userRepo = client.getCustomRepository(UserRepository, 'users');
    this.profileRepo = client.getRepository<Profile>('profiles');
  }

  async createUserWithProfile(userData: Partial<User>, profileData: Partial<Profile>) {
    // Create user first
    const user = await this.userRepo.save(userData);
    
    // Then create profile
    const profile = await this.profileRepo.save({
      ...profileData,
      user_id: user.id
    });

    return { user, profile };
  }

  async getUserDashboard(userId: number) {
    const [user, recentActivity, stats] = await Promise.all([
      this.userRepo.findOneOrFail({ id: userId }),
      this.userRepo.findUsersWithRecentActivity(30),
      this.getUserStats(userId)
    ]);

    return { user, recentActivity, stats };
  }

  private async getUserStats(userId: number) {
    // Custom statistics using query builder
    return this.userRepo
      .createQueryBuilder()
      .select(['COUNT(*) as total_posts'])
      .leftJoinAndSelect('posts', 'post')
      .where('id = :userId', { userId })
      .getOne();
  }
}
```

## Testing Repository Methods

```typescript
// Example unit test for custom repository
describe('UserRepository', () => {
  let userRepo: UserRepository;
  let mockClient: jest.Mocked<PostgRESTClient>;

  beforeEach(() => {
    // Setup mocked client
    mockClient = createMockClient();
    userRepo = mockClient.getCustomRepository(UserRepository, 'users');
  });

  it('should find active users', async () => {
    // Mock the expected response
    const mockUsers = [
      { id: 1, name: 'John', active: true, verified: true }
    ];

    jest.spyOn(userRepo, 'createQueryBuilder').mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(mockUsers)
    } as any);

    const result = await userRepo.findActiveUsers();
    
    expect(result).toEqual(mockUsers);
    expect(userRepo.createQueryBuilder).toHaveBeenCalled();
  });
});
```

## Best Practices Summary

### ✅ DO:
- Use TypeScript generics for type safety
- Implement parameter binding for security
- Use custom repositories for business logic
- Apply proper error handling
- Use pagination for large datasets
- Select only required columns
- Implement proper validation
- Use appropriate JOINs for related data
- Cache frequently accessed data
- Write unit tests for repository methods

### ❌ DON'T:
- Query without filters on large tables
- Concatenate user input into queries
- Return all columns when only few are needed
- Ignore error handling
- Fetch all records without pagination
- Put business logic in controllers
- Skip input validation
- Use eager loading excessively
- Query inside loops
- Forget to handle edge cases

### 🚀 Performance Tips:
- Use database indexes for frequently queried columns
- Implement caching strategies for read-heavy operations
- Use connection pooling for high-traffic applications
- Monitor query performance with logging
- Use EXPLAIN ANALYZE for query optimization
- Batch multiple operations when possible
- Consider read replicas for read-heavy workloads