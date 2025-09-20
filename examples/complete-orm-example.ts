/**
 * Complete ORM Implementation Example
 * Demonstrates all the ORM functionality you requested
 */

import {
  createClient,
  SelectQueryBuilder,
  CustomRepositoryBase,
  Brackets,
} from '@webcoded/pgrestify';

// ============================================================================
// Type definitions
// ============================================================================

interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

interface Post {
  id: number;
  title: string;
  content: string;
  user_id: number;
  published: boolean;
  created_at: string;
}

// ============================================================================
// Create client (original PostgREST syntax still works)
// ============================================================================

const client = createClient({
  url: 'http://localhost:3000',
});

// ============================================================================
// 1. Original PostgREST syntax (UNCHANGED - still works exactly as before)
// ============================================================================

async function originalPostgRESTSyntax() {
  console.log('=== 1. Original PostgREST Syntax (UNCHANGED) ===');

  // All original syntax still works exactly as before
  const users = await client.from<User>('users').select('*').execute();
  console.log('All users:', users);

  const activeUsers = await client
    .from<User>('users')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(10)
    .execute();
  console.log('Active users:', activeUsers);

  const user = await client
    .from<User>('users')
    .select('*')
    .eq('id', 1)
    .single()
    .execute();
  console.log('Single user:', user);

  // All PostgREST features still work
  const userWithPosts = await client
    .from<User>('users')
    .select('*, posts(*)')
    .eq('id', 1)
    .single()
    .execute();
  console.log('User with posts (PostgREST):', userWithPosts);
}

// ============================================================================
// 2. NEW Repository Pattern (ORM-style CRUD operations)
// ============================================================================

async function repositoryPattern() {
  console.log('=== 2. NEW Repository Pattern ===');

  // Get repository for type-safe ORM operations
  const userRepository = client.getRepository<User>('users');

  // Find operations (like TypeORM)
  console.log('--- Repository Find Operations ---');
  
  const allUsers = await userRepository.find();
  console.log('All users (repo):', allUsers);

  const activeUsers = await userRepository.findBy({ active: true });
  console.log('Active users (repo):', activeUsers);

  const recentUsers = await userRepository.find({
    where: { active: true },
    order: { created_at: 'DESC' },
    take: 5
  });
  console.log('Recent users (repo):', recentUsers);

  const user = await userRepository.findOne({ where: { id: 1 } });
  console.log('Single user (repo):', user);

  const userOrFail = await userRepository.findOneOrFail({ where: { id: 1 } });
  console.log('User or fail (repo):', userOrFail);

  // Count operations
  console.log('--- Repository Count Operations ---');
  
  const totalCount = await userRepository.count();
  console.log('Total users:', totalCount);

  const activeCount = await userRepository.countBy({ active: true });
  console.log('Active users count:', activeCount);

  // CRUD operations
  console.log('--- Repository CRUD Operations ---');
  
  // Save (upsert)
  const savedUser = await userRepository.save({
    name: 'John Doe',
    email: 'john@example.com',
    active: true
  });
  console.log('Saved user:', savedUser);

  // Insert
  const insertedUser = await userRepository.insert({
    name: 'Jane Smith',
    email: 'jane@example.com',
    active: true
  });
  console.log('Inserted user:', insertedUser);

  // Update
  const updatedUsers = await userRepository.update(
    { id: 1 }, 
    { name: 'Updated Name' }
  );
  console.log('Updated users:', updatedUsers);

  // Delete
  const deletedUsers = await userRepository.delete({ id: 999 });
  console.log('Deleted users:', deletedUsers);

  // Utility operations
  const exists = await userRepository.exists({ email: 'john@example.com' });
  console.log('User exists:', exists);
}

// ============================================================================
// 3. NEW Advanced Query Builder (TypeORM-style)
// ============================================================================

async function advancedQueryBuilder() {
  console.log('=== 3. NEW Advanced Query Builder ===');

  // Create advanced query builder
  const userRepository = client.getRepository<User>('users');
  
  console.log('--- Basic Query Builder Operations ---');
  
  // TypeORM-style query building
  const users = await userRepository
    .createQueryBuilder('user')
    .select(['name', 'email', 'created_at'])
    .where('user.active = :active', { active: true })
    .andWhere('user.created_at > :date', { date: '2023-01-01' })
    .orderBy('user.created_at', 'DESC')
    .take(10)
    .getMany();
  
  console.log('Advanced query users:', users);

  console.log('--- Complex Conditions ---');
  
  // Complex WHERE conditions
  const complexUsers = await userRepository
    .createQueryBuilder('user')
    .where('user.name LIKE :name', { name: '%john%' })
    .orWhere('user.email LIKE :email', { email: '%@company.com' })
    .andWhere('user.active = :active', { active: true })
    .orderBy('user.name', 'ASC')
    .getMany();
  
  console.log('Complex query users:', complexUsers);

  console.log('--- Single Result Operations ---');
  
  // Single result operations
  const singleUser = await userRepository
    .createQueryBuilder('user')
    .where('user.id = :id', { id: 1 })
    .getOne();
  
  console.log('Single user from query builder:', singleUser);

  const singleUserOrFail = await userRepository
    .createQueryBuilder('user')
    .where('user.email = :email', { email: 'john@example.com' })
    .getOneOrFail();
  
  console.log('Single user or fail:', singleUserOrFail);

  console.log('--- Count and Aggregation ---');
  
  // Count operations
  const count = await userRepository
    .createQueryBuilder('user')
    .where('user.active = :active', { active: true })
    .getCount();
  
  console.log('Count from query builder:', count);

  // Get many and count together
  const [entities, totalCount] = await userRepository
    .createQueryBuilder('user')
    .where('user.active = :active', { active: true })
    .orderBy('user.created_at', 'DESC')
    .take(5)
    .getManyAndCount();
  
  console.log('Entities and count:', { entities, totalCount });

  console.log('--- Advanced WHERE Methods ---');
  
  // Advanced WHERE methods
  const advancedWhere = await userRepository
    .createQueryBuilder('user')
    .whereIn('user.id', [1, 2, 3])
    .andWhere('user.active = :active', { active: true })
    .getMany();
  
  console.log('WHERE IN results:', advancedWhere);

  const nullCheck = await userRepository
    .createQueryBuilder('user')
    .whereNotNull('user.email')
    .whereLike('user.name', '%john%')
    .getMany();
  
  console.log('NULL check results:', nullCheck);
}

// ============================================================================
// 4. NEW Join Operations (PostgREST embedded resources)
// ============================================================================

async function joinOperations() {
  console.log('=== 4. NEW Join Operations ===');

  const userRepository = client.getRepository<User>('users');
  
  console.log('--- Left Join and Select ---');
  
  // TypeORM-style joins (converted to PostgREST embedded resources)
  const usersWithPosts = await userRepository
    .createQueryBuilder('user')
    .leftJoinAndSelect('user.posts', 'posts')
    .where('user.active = :active', { active: true })
    .orderBy('user.created_at', 'DESC')
    .take(5)
    .getMany();
  
  console.log('Users with posts (joined):', usersWithPosts);

  console.log('--- Inner Join and Select ---');
  
  const usersWithPublishedPosts = await userRepository
    .createQueryBuilder('user')
    .innerJoinAndSelect('user.posts', 'posts', 'posts.published = :published', { published: true })
    .orderBy('user.name', 'ASC')
    .getMany();
  
  console.log('Users with published posts:', usersWithPublishedPosts);
}

// ============================================================================
// 5. NEW Custom Repository with Business Logic
// ============================================================================

class UserRepository extends CustomRepositoryBase<User> {
  /**
   * Find active users (simple business logic)
   */
  async findActiveUsers(): Promise<User[]> {
    return this.findBy({ active: true });
  }

  /**
   * Search users by name or email (complex query)
   */
  async searchUsers(searchTerm: string): Promise<User[]> {
    return this.createAdvancedQuery()
      .where('user.name LIKE :term', { term: `%${searchTerm}%` })
      .orWhere('user.email LIKE :term', { term: `%${searchTerm}%` })
      .andWhere('user.active = :active', { active: true })
      .orderBy('user.name', 'ASC')
      .getMany();
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<{ total: number; active: number; inactive: number }> {
    const total = await this.count();
    const active = await this.countBy({ active: true });
    const inactive = total - active;
    
    return { total, active, inactive };
  }

  /**
   * Find users created in the last N days
   */
  async findRecentUsers(days: number): Promise<User[]> {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);
    
    return this.createAdvancedQuery()
      .where('user.created_at >= :date', { date: dateThreshold.toISOString() })
      .orderBy('user.created_at', 'DESC')
      .getMany();
  }

  /**
   * Complex query with multiple conditions
   */
  async findByComplexCriteria(
    namePattern?: string, 
    emailDomain?: string, 
    isActive?: boolean
  ): Promise<User[]> {
    const query = this.createAdvancedQuery();

    if (namePattern) {
      query.where('user.name LIKE :name', { name: `%${namePattern}%` });
    }

    if (emailDomain) {
      query.andWhere('user.email LIKE :domain', { domain: `%@${emailDomain}` });
    }

    if (isActive !== undefined) {
      query.andWhere('user.active = :active', { active: isActive });
    }

    return query
      .orderBy('user.created_at', 'DESC')
      .getMany();
  }

  /**
   * Deactivate users by criteria
   */
  async deactivateUsers(criteria: Partial<User>): Promise<User[]> {
    return this.update(criteria, { active: false });
  }

  /**
   * Get paginated users
   */
  async getPaginatedUsers(page: number, pageSize: number): Promise<{
    users: User[];
    total: number;
    hasMore: boolean;
  }> {
    const offset = (page - 1) * pageSize;
    
    const [users, total] = await this.createAdvancedQuery()
      .orderBy('user.created_at', 'DESC')
      .take(pageSize)
      .skip(offset)
      .getManyAndCount();

    return {
      users,
      total,
      hasMore: total > page * pageSize
    };
  }
}

async function customRepository() {
  console.log('=== 5. NEW Custom Repository ===');

  const userRepo = client.getCustomRepository(UserRepository, 'users');

  console.log('--- Custom Business Logic Methods ---');
  
  const activeUsers = await userRepo.findActiveUsers();
  console.log('Active users (custom):', activeUsers);

  const searchResults = await userRepo.searchUsers('john');
  console.log('Search results:', searchResults);

  const stats = await userRepo.getUserStats();
  console.log('User statistics:', stats);

  const recentUsers = await userRepo.findRecentUsers(30);
  console.log('Users from last 30 days:', recentUsers);

  console.log('--- Complex Query Methods ---');
  
  const complexResults = await userRepo.findByComplexCriteria(
    'john', 
    'company.com', 
    true
  );
  console.log('Complex criteria results:', complexResults);

  console.log('--- Pagination ---');
  
  const paginatedResult = await userRepo.getPaginatedUsers(1, 10);
  console.log('Paginated users:', paginatedResult);
}

// ============================================================================
// 6. Relation Method (Enhanced PostgREST syntax)
// ============================================================================

async function relationMethodExample() {
  console.log('=== 6. NEW Relation Method (Enhanced PostgREST) ===');

  console.log('--- Before: Original PostgREST embedded syntax ---');
  const userWithPostsOld = await client
    .from<User>('users')
    .select('*, posts(title, content)')
    .eq('id', 1)
    .single()
    .execute();
  console.log('Old syntax result:', userWithPostsOld);

  console.log('--- After: New relation() method syntax ---');
  const userWithPostsNew = await client
    .from<User>('users')
    .relation('posts', 'post')
    .select('*, posts.title, posts.content')
    .eq('id', 1)
    .single()
    .execute();
  console.log('New syntax result:', userWithPostsNew);

  console.log('--- Multiple relations ---');
  const userWithMultipleRelations = await client
    .from<User>('users')
    .relation('posts', 'post', ['title', 'content'])
    .relation('comments', 'comment', ['content'])
    .select('*, posts.title, posts.content, comments.content')
    .eq('id', 1)
    .single()
    .execute();
  console.log('Multiple relations:', userWithMultipleRelations);
}

// ============================================================================
// 7. Mixing All Syntaxes Together
// ============================================================================

async function mixedSyntaxExample() {
  console.log('=== 7. All Syntaxes Working Together ===');

  // 1. Use PostgREST for complex raw queries
  const complexQuery = await client
    .from<User>('users')
    .select('*, posts(title, content, comments(*))')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(3)
    .execute();
  
  console.log('Complex PostgREST query:', complexQuery);

  // 2. Use Repository for CRUD operations
  const userRepo = client.getRepository<User>('users');
  const userCount = await userRepo.count();
  console.log('Total users (repo):', userCount);

  // 3. Use Advanced Query Builder for complex logic
  const advancedResults = await userRepo
    .createQueryBuilder('user')
    .leftJoinAndSelect('user.posts', 'posts')
    .where('user.active = :active', { active: true })
    .andWhere('user.created_at > :date', { date: '2023-01-01' })
    .orderBy('user.name', 'ASC')
    .take(5)
    .getMany();
  
  console.log('Advanced query results:', advancedResults);

  // 4. Use Custom Repository for business logic
  const customRepo = client.getCustomRepository(UserRepository, 'users');
  const businessLogicResults = await customRepo.findByComplexCriteria('john', 'example.com', true);
  console.log('Business logic results:', businessLogicResults);

  // 5. Use new relation method for cleaner embedded resources
  const relationResults = await client
    .from<User>('users')
    .relation('posts', 'post')
    .select('name, email, posts.title')
    .eq('active', true)
    .limit(2)
    .execute();
  
  console.log('Relation method results:', relationResults);
}

// ============================================================================
// 8. Performance Comparison
// ============================================================================

async function performanceComparison() {
  console.log('=== 8. Performance & Usage Guidelines ===');

  console.log('--- When to use each approach ---');
  
  console.log('Original PostgREST syntax:');
  console.log('✓ Complex joins and relations');
  console.log('✓ Raw SQL-like queries');
  console.log('✓ Performance-critical queries');
  console.log('✓ Direct PostgREST feature access');
  console.log('✓ Migrations from existing PostgREST code');
  
  console.log('\\nRepository pattern:');
  console.log('✓ Simple CRUD operations');
  console.log('✓ Type-safe database operations');
  console.log('✓ Quick data access methods');
  console.log('✓ Standard ORM patterns');
  
  console.log('\\nAdvanced Query Builder:');
  console.log('✓ Complex business logic');
  console.log('✓ Dynamic query building');
  console.log('✓ Parameter binding and security');
  console.log('✓ TypeORM-style query patterns');
  
  console.log('\\nCustom Repository:');
  console.log('✓ Business logic encapsulation');
  console.log('✓ Domain-driven design');
  console.log('✓ Reusable query methods');
  console.log('✓ Application-specific operations');

  console.log('\\nRelation Method:');
  console.log('✓ Cleaner embedded resource syntax');
  console.log('✓ Better developer experience');
  console.log('✓ Type-safe relation handling');
  console.log('✓ Simplified PostgREST joins');

  // Performance timing example
  const startTime = Date.now();
  
  // Run parallel operations to show they all work together
  const [
    postgrestResult,
    repoResult,
    queryBuilderResult,
    customRepoResult
  ] = await Promise.all([
    // PostgREST
    client.from<User>('users').select('*').eq('active', true).limit(5).execute(),
    
    // Repository
    client.getRepository<User>('users').find({ 
      where: { active: true }, 
      take: 5 
    }),
    
    // Query Builder
    client.getRepository<User>('users')
      .createQueryBuilder('user')
      .where('user.active = :active', { active: true })
      .take(5)
      .getMany(),
    
    // Custom Repository
    client.getCustomRepository(UserRepository, 'users').findActiveUsers()
  ]);
  
  const endTime = Date.now();
  console.log(`\\nAll four approaches completed in parallel: ${endTime - startTime}ms`);
  console.log('Results count:', {
    postgrest: postgrestResult.data?.length || 0,
    repository: repoResult.length,
    queryBuilder: queryBuilderResult.length,
    customRepo: customRepoResult.length
  });
}

// ============================================================================
// Main execution function
// ============================================================================

async function main() {
  console.log('🚀 Complete ORM Implementation Example');
  console.log('=====================================\\n');

  try {
    await originalPostgRESTSyntax();
    console.log('\\n' + '='.repeat(50) + '\\n');
    
    await repositoryPattern();
    console.log('\\n' + '='.repeat(50) + '\\n');
    
    await advancedQueryBuilder();
    console.log('\\n' + '='.repeat(50) + '\\n');
    
    await joinOperations();
    console.log('\\n' + '='.repeat(50) + '\\n');
    
    await customRepository();
    console.log('\\n' + '='.repeat(50) + '\\n');
    
    await relationMethodExample();
    console.log('\\n' + '='.repeat(50) + '\\n');
    
    await mixedSyntaxExample();
    console.log('\\n' + '='.repeat(50) + '\\n');
    
    await performanceComparison();
    
    console.log('\\n' + '='.repeat(50));
    console.log('\\n✅ Complete ORM Implementation Example Finished!');
    console.log('\\n📋 Summary of ALL Available Features:');
    console.log('   1. ✅ Original PostgREST syntax (unchanged)');
    console.log('   2. ✅ Repository pattern (find, findOne, save, etc.)');
    console.log('   3. ✅ Advanced Query Builder (where, leftJoinAndSelect, getMany, etc.)');
    console.log('   4. ✅ Join operations (leftJoinAndSelect, innerJoinAndSelect)');
    console.log('   5. ✅ Custom repositories with business logic');
    console.log('   6. ✅ Enhanced relation method for cleaner syntax');
    console.log('   7. ✅ All syntaxes work together seamlessly');
    console.log('   8. ✅ No breaking changes - backward compatible');
    console.log('\\n🎯 You now have a complete ORM with all the features you requested!');
    
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Export for use in other files
export {
  main,
  originalPostgRESTSyntax,
  repositoryPattern,
  advancedQueryBuilder,
  joinOperations,
  customRepository,
  relationMethodExample,
  mixedSyntaxExample,
  performanceComparison,
  UserRepository,
};

// Run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  main();
}