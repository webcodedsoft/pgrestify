/**
 * Comprehensive examples of advanced query builder usage with PGRestify
 * 
 * This file demonstrates all the new advanced ORM-inspired features while maintaining
 * full compatibility with PostgREST APIs.
 */

import {
  createClient,
  AdvancedQueryBuilder,
  BaseRepository,
  CustomRepositoryBase,
  Brackets,
  NotBrackets,
  Entity,
  PrimaryColumn,
  Column,
  CustomRepository,
} from '@webcoded/pgrestify';

// ============================================================================
// 1. Entity Definitions (Advanced decorators for metadata)
// ============================================================================

@Entity('users')
class User {
  @PrimaryColumn()
  id!: number;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column()
  email!: string;

  @Column()
  active!: boolean;

  @Column()
  createdAt!: string;
}

@Entity('posts')
class Post {
  @PrimaryColumn()
  id!: number;

  @Column()
  title!: string;

  @Column()
  content!: string;

  @Column()
  authorId!: number;

  @Column()
  published!: boolean;

  @Column()
  createdAt!: string;
}

@Entity('categories')
class Category {
  @PrimaryColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  description!: string;
}

// ============================================================================
// 2. Client Setup
// ============================================================================

const client = createClient({
  url: 'http://localhost:3000',
  transformColumns: true, // Enable camelCase ↔ snake_case transformation
});

// ============================================================================
// 3. Basic Advanced Query Builder Usage
// ============================================================================

async function basicQueryBuilderExamples() {
  console.log('=== Basic Advanced Query Builder Examples ===');

  // Create Advanced query builder
  const userQB = client.createQueryBuilder<User>('users', 'user');

  // Basic select with where clause
  const activeUsers = await userQB
    .where('user.active = :active', { active: true })
    .getMany();
  
  console.log('Active users:', activeUsers);

  // Select with orderBy
  const recentUsers = await client
    .createQueryBuilder<User>('users', 'user')
    .where('user.active = :active', { active: true })
    .orderBy('user.created_at', 'DESC')
    .take(10)
    .getMany();
  
  console.log('Recent users:', recentUsers);

  // Get one user
  const user = await client
    .createQueryBuilder<User>('users', 'user')
    .where('user.email = :email', { email: 'john@example.com' })
    .getOne();
  
  console.log('User:', user);

  // Get one or fail
  try {
    const userOrFail = await client
      .createQueryBuilder<User>('users', 'user')
      .where('user.id = :id', { id: 999 })
      .getOneOrFail();
  } catch (error) {
    console.log('User not found:', error.message);
  }
}

// ============================================================================
// 4. Advanced WHERE Clauses with Brackets
// ============================================================================

async function advancedWhereExamples() {
  console.log('=== Advanced WHERE with Brackets Examples ===');

  // Complex conditions with Brackets
  const complexUsers = await client
    .createQueryBuilder<User>('users', 'user')
    .where(new Brackets(qb => {
      qb.where('user.firstName = :firstName', { firstName: 'John' })
        .orWhere('user.lastName = :lastName', { lastName: 'Doe' });
    }))
    .andWhere('user.active = :active', { active: true })
    .getMany();
  
  console.log('Complex query users:', complexUsers);

  // Nested Brackets
  const nestedConditionUsers = await client
    .createQueryBuilder<User>('users', 'user')
    .where(new Brackets(qb => {
      qb.where('user.active = :active', { active: true })
        .andWhere(new Brackets(subQb => {
          subQb.where('user.firstName LIKE :namePattern', { namePattern: '%John%' })
            .orWhere('user.email LIKE :emailPattern', { emailPattern: '%@company.com' });
        }));
    }))
    .getMany();
  
  console.log('Nested conditions users:', nestedConditionUsers);

  // NotBrackets for negation
  const excludedUsers = await client
    .createQueryBuilder<User>('users', 'user')
    .where('user.active = :active', { active: true })
    .andWhere(new NotBrackets(qb => {
      qb.where('user.email LIKE :domain1', { domain1: '%@spam.com' })
        .orWhere('user.email LIKE :domain2', { domain2: '%@fake.com' });
    }))
    .getMany();
  
  console.log('Users excluding spam domains:', excludedUsers);
}

// ============================================================================
// 5. JOIN Operations (Advanced)
// ============================================================================

async function joinExamples() {
  console.log('=== Advanced JOIN Examples ===');

  // leftJoinAndSelect - load users with their posts
  const usersWithPosts = await client
    .createQueryBuilder<User>('users', 'user')
    .leftJoinAndSelect('user.posts', 'post')
    .where('user.active = :active', { active: true })
    .getMany();
  
  console.log('Users with posts:', usersWithPosts);

  // innerJoinAndSelect - only users who have posts
  const usersWithPublishedPosts = await client
    .createQueryBuilder<User>('users', 'user')
    .innerJoinAndSelect('user.posts', 'post', 'post.published = :published', { published: true })
    .getMany();
  
  console.log('Users with published posts:', usersWithPublishedPosts);

  // Multiple joins
  const complexJoin = await client
    .createQueryBuilder<Post>('posts', 'post')
    .leftJoinAndSelect('post.author', 'author')
    .leftJoinAndSelect('post.category', 'category')
    .where('post.published = :published', { published: true })
    .orderBy('post.created_at', 'DESC')
    .take(5)
    .getMany();
  
  console.log('Posts with authors and categories:', complexJoin);
}

// ============================================================================
// 6. Repository Pattern Examples
// ============================================================================

async function repositoryExamples() {
  console.log('=== ORM Repository Pattern Examples ===');

  // Get Advanced repository
  const userRepository = client.getAdvancedRepository<User>('users');

  // Basic repository operations
  const allUsers = await userRepository.find();
  console.log('All users:', allUsers);

  // Find with options
  const activeUsers = await userRepository.find({
    where: { active: true },
    order: { createdAt: 'DESC' },
    take: 5
  });
  console.log('Active users (limited):', activeUsers);

  // Find by conditions
  const usersByEmail = await userRepository.findBy({ 
    email: 'john@example.com' 
  });
  console.log('Users by email:', usersByEmail);

  // Find one
  const oneUser = await userRepository.findOne({
    where: { id: 1 }
  });
  console.log('One user:', oneUser);

  // Find one by
  const userByEmail = await userRepository.findOneBy({
    email: 'jane@example.com'
  });
  console.log('User by email:', userByEmail);

  // Count
  const activeUserCount = await userRepository.count({
    where: { active: true }
  });
  console.log('Active user count:', activeUserCount);

  // Exist check
  const hasAdminUser = await userRepository.exist({
    where: { email: 'admin@example.com' }
  });
  console.log('Has admin user:', hasAdminUser);
}

// ============================================================================
// 7. Custom Repository with Advanced Methods
// ============================================================================

@CustomRepository('users')
class UserRepository extends CustomRepositoryBase<User> {
  /**
   * Find active users with complex criteria
   */
  async findActiveUsers(limit?: number): Promise<User[]> {
    let qb = this.createQueryBuilder()
      .where('active = :active', { active: true })
      .orderBy('created_at', 'DESC');
    
    if (limit) {
      qb = qb.take(limit);
    }
    
    return qb.getMany();
  }

  /**
   * Search users by name or email
   */
  async searchUsers(searchTerm: string): Promise<User[]> {
    return this.createQueryBuilder()
      .where(new Brackets(qb => {
        qb.where('first_name ILIKE :term', { term: `%${searchTerm}%` })
          .orWhere('last_name ILIKE :term', { term: `%${searchTerm}%` })
          .orWhere('email ILIKE :term', { term: `%${searchTerm}%` });
      }))
      .andWhere('active = :active', { active: true })
      .orderBy('created_at', 'DESC')
      .getMany();
  }

  /**
   * Find users with their post statistics
   */
  async findUsersWithPostStats(): Promise<User[]> {
    return this.createQueryBuilder()
      .leftJoinAndSelect('user.posts', 'posts')
      .where('user.active = :active', { active: true })
      .getMany();
  }

  /**
   * Advanced filtering with multiple conditions
   */
  async findByComplexCriteria(
    namePattern?: string, 
    emailDomain?: string,
    isActive: boolean = true
  ): Promise<User[]> {
    let qb = this.createQueryBuilder()
      .where('active = :active', { active: isActive });

    if (namePattern) {
      qb = qb.andWhere(new Brackets(subQb => {
        subQb.where('first_name ILIKE :pattern', { pattern: `%${namePattern}%` })
          .orWhere('last_name ILIKE :pattern', { pattern: `%${namePattern}%` });
      }));
    }

    if (emailDomain) {
      qb = qb.andWhere('email LIKE :domain', { domain: `%@${emailDomain}` });
    }

    return qb.orderBy('created_at', 'DESC').getMany();
  }

  /**
   * Bulk operations example
   */
  async deactivateOldUsers(daysSinceLogin: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLogin);

    await this.createQueryBuilder()
      .update({ active: false })
      .where('last_login < :cutoff', { cutoff: cutoffDate.toISOString() })
      .andWhere('active = :active', { active: true })
      .execute();
  }
}

async function customRepositoryExamples() {
  console.log('=== Custom Repository Examples ===');

  // Get custom repository instance
  const userRepo = client.getCustomORMRepository(UserRepository, 'users');

  // Use custom methods
  const activeUsers = await userRepo.findActiveUsers(10);
  console.log('Active users (custom method):', activeUsers);

  const searchResults = await userRepo.searchUsers('john');
  console.log('Search results:', searchResults);

  const usersWithStats = await userRepo.findUsersWithPostStats();
  console.log('Users with post stats:', usersWithStats);

  const complexResults = await userRepo.findByComplexCriteria(
    'doe', 
    'company.com', 
    true
  );
  console.log('Complex criteria results:', complexResults);
}

// ============================================================================
// 8. Raw Query Examples
// ============================================================================

async function rawQueryExamples() {
  console.log('=== Raw Query Examples ===');

  // Raw PostgREST query with Advanced builder
  const userQB = client.createQueryBuilder<User>('users');
  
  // Get raw results
  const rawUsers = await userQB.getRawMany<{
    id: number;
    full_name: string;
    email: string;
    post_count: number;
  }>();
  
  console.log('Raw query results:', rawUsers);

  // Raw query with parameters
  const customQuery = await userQB.rawQuery<User>(
    'users?select=*&active=eq.true&order=created_at.desc&limit=5'
  );
  
  console.log('Custom raw query:', customQuery);
}

// ============================================================================
// 9. Parameter Binding and Security
// ============================================================================

async function parameterBindingExamples() {
  console.log('=== Parameter Binding Examples ===');

  // Safe parameter binding prevents SQL injection
  const userInput = "'; DROP TABLE users; --";
  
  const safeQuery = await client
    .createQueryBuilder<User>('users', 'user')
    .where('user.email = :email', { email: userInput })
    .getMany();
  
  console.log('Safe query with user input:', safeQuery);

  // Multiple parameters
  const multiParamQuery = await client
    .createQueryBuilder<User>('users', 'user')
    .where('user.created_at BETWEEN :startDate AND :endDate', {
      startDate: '2023-01-01',
      endDate: '2023-12-31'
    })
    .andWhere('user.active = :active', { active: true })
    .getMany();
  
  console.log('Multi-parameter query:', multiParamQuery);

  // Array parameters
  const arrayParamQuery = await client
    .createQueryBuilder<User>('users', 'user')
    .where('user.id IN (:...ids)', { ids: [1, 2, 3, 4, 5] })
    .getMany();
  
  console.log('Array parameter query:', arrayParamQuery);
}

// ============================================================================
// 10. Relation Loading Examples
// ============================================================================

async function relationExamples() {
  console.log('=== Relation Loading Examples ===');

  // Load relations using the relation() method
  const userQB = client.createQueryBuilder<User>('users', 'user');
  
  // Load specific relation
  const userWithPosts = await userQB
    .where('user.id = :id', { id: 1 })
    .relation('posts')
    .of(await userQB.getOne())
    .loadMany();
  
  console.log('User with posts (relation method):', userWithPosts);

  // Using repository pattern for relations
  const userRepo = client.getAdvancedRepository<User>('users');
  const user = await userRepo.findOne({ where: { id: 1 } });
  
  if (user) {
    const posts = await userRepo
      .createQueryBuilder()
      .relation('posts')
      .of(user)
      .loadMany();
    
    console.log('Posts for user:', posts);
  }
}

// ============================================================================
// 11. Migration from PostgREST to ORM Syntax
// ============================================================================

async function migrationExamples() {
  console.log('=== Migration Examples (PostgREST → ORM) ===');

  // OLD PostgREST style
  const oldStyleQuery = await client
    .from<User>('users')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(10)
    .execute();
  
  console.log('Old PostgREST style:', oldStyleQuery);

  // NEW ORM style (equivalent)
  const newStyleQuery = await client
    .createQueryBuilder<User>('users', 'user')
    .where('user.active = :active', { active: true })
    .orderBy('user.created_at', 'DESC')
    .take(10)
    .getMany();
  
  console.log('New ORM style:', newStyleQuery);

  // Complex migration example
  // OLD: Complex PostgREST join
  const oldComplexQuery = await client
    .from<User>('users')
    .select('*, posts(title, content)')
    .eq('active', true)
    .leftJoin('posts', { select: ['title', 'content'] })
    .execute();

  // NEW: ORM equivalent
  const newComplexQuery = await client
    .createQueryBuilder<User>('users', 'user')
    .leftJoinAndSelect('user.posts', 'post')
    .where('user.active = :active', { active: true })
    .getMany();
  
  console.log('Complex query migration:', { old: oldComplexQuery, new: newComplexQuery });
}

// ============================================================================
// 12. Main execution function
// ============================================================================

async function runAllExamples() {
  try {
    await basicQueryBuilderExamples();
    await advancedWhereExamples();
    await joinExamples();
    await repositoryExamples();
    await customRepositoryExamples();
    await rawQueryExamples();
    await parameterBindingExamples();
    await relationExamples();
    await migrationExamples();
    
    console.log('\n✅ All Advanced examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Export for use in other files
export {
  runAllExamples,
  User,
  Post,
  Category,
  UserRepository,
  basicQueryBuilderExamples,
  advancedWhereExamples,
  joinExamples,
  repositoryExamples,
  customRepositoryExamples,
  rawQueryExamples,
  parameterBindingExamples,
  relationExamples,
  migrationExamples,
};

// Run examples if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  runAllExamples();
}