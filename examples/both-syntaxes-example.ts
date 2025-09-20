/**
 * Example showing both PostgREST syntax and Repository pattern working together
 */

import {
  createClient,
  CustomRepositoryBase,
  Brackets,
} from '@webcoded/pgrestify';

// User interface
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

// Create client
const client = createClient({
  url: 'http://localhost:3000',
});

// ============================================================================
// 1. Original PostgREST syntax (still works exactly as before)
// ============================================================================

async function originalPostgRESTSyntax() {
  console.log('=== Original PostgREST Syntax ===');

  // Simple queries
  const users = await client.from<User>('users').select('*').execute();
  console.log('All users:', users);

  // Filtered queries
  const activeUsers = await client
    .from<User>('users')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(10)
    .execute();
  console.log('Active users:', activeUsers);

  // Single result
  const user = await client
    .from<User>('users')
    .select('*')
    .eq('id', 1)
    .single()
    .execute();
  console.log('Single user:', user);

  // Complex filters
  const complexQuery = await client
    .from<User>('users')
    .select('*')
    .like('name', '%john%')
    .eq('active', true)
    .gte('id', 10)
    .execute();
  console.log('Complex query:', complexQuery);

  // Mutations
  const newUser = await client
    .from<User>('users')
    .insert({
      name: 'Jane Doe',
      email: 'jane@example.com',
      active: true
    })
    .single()
    .execute();
  console.log('New user:', newUser);
}

// ============================================================================
// 2. Repository pattern (new, works alongside PostgREST syntax)
// ============================================================================

async function repositoryPattern() {
  console.log('=== Repository Pattern ===');

  // Get repository
  const userRepository = client.getRepository<User>('users');

  // Simple find operations
  const allUsers = await userRepository.find();
  console.log('All users (repo):', allUsers);

  // Find with conditions
  const activeUsers = await userRepository.findBy({ active: true });
  console.log('Active users (repo):', activeUsers);

  // Find with options
  const recentUsers = await userRepository.find({
    where: { active: true },
    order: { created_at: 'DESC' },
    take: 5
  });
  console.log('Recent users (repo):', recentUsers);

  // Find one
  const user = await userRepository.findOne({ where: { id: 1 } });
  console.log('Single user (repo):', user);

  // Count
  const count = await userRepository.count({ where: { active: true } });
  console.log('Active user count:', count);

  // Save (upsert)
  const savedUser = await userRepository.save({
    name: 'Bob Smith',
    email: 'bob@example.com',
    active: true
  });
  console.log('Saved user:', savedUser);

  // Update
  await userRepository.update({ id: 1 }, { name: 'Updated Name' });

  // Delete
  await userRepository.delete({ id: 999 });
}

// ============================================================================
// 3. Custom Repository with complex queries
// ============================================================================

class UserRepository extends CustomRepositoryBase<User> {
  /**
   * Find active users (simple example)
   */
  async findActiveUsers(): Promise<User[]> {
    return this.findBy({ active: true });
  }

  /**
   * Find users by search term using original PostgREST syntax
   */
  async searchUsers(searchTerm: string): Promise<User[]> {
    const result = await this.createQueryBuilder()
      .select('*')
      .or(`name.ilike.*${searchTerm}*,email.ilike.*${searchTerm}*`)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .execute();
    
    if (result.error) {
      throw result.error;
    }
    
    return Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
  }

  /**
   * Find users with complex conditions using Brackets
   */
  async findByComplexCriteria(namePattern: string, domain: string): Promise<User[]> {
    const advancedQuery = this.createAdvancedQuery();
    
    return advancedQuery
      .whereWithBrackets(new Brackets(_qb => {
        // This would be expanded in a full implementation
        // For now, fall back to PostgREST syntax
      }))
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
}

async function customRepository() {
  console.log('=== Custom Repository ===');

  const userRepo = client.getCustomRepository(UserRepository, 'users');

  // Use custom methods
  const activeUsers = await userRepo.findActiveUsers();
  console.log('Active users (custom):', activeUsers);

  const searchResults = await userRepo.searchUsers('john');
  console.log('Search results:', searchResults);

  const stats = await userRepo.getUserStats();
  console.log('User statistics:', stats);
}

// ============================================================================
// 4. New relation() method demonstration
// ============================================================================

async function relationMethodExample() {
  console.log('=== Relation Method Example ===');

  // OLD WAY: Using PostgREST's embedded resource syntax
  console.log('--- Old PostgREST embedded syntax ---');
  const userWithPostsOld = await client
    .from<User>('users')
    .select('*, posts(title, content)')
    .eq('id', 1)
    .single()
    .execute();
  console.log('Old syntax result:', userWithPostsOld);

  // NEW WAY: Using the relation() method for cleaner syntax
  console.log('--- New relation() method syntax ---');
  const userWithPostsNew = await client
    .from<User>('users')
    .relation('posts', 'post')  // Define the relation with alias
    .select('*, posts.title, posts.content')  // Use dot notation for relation columns
    .eq('id', 1)
    .single()
    .execute();
  console.log('New syntax result:', userWithPostsNew);

  // Multiple relations example
  console.log('--- Multiple relations ---');
  const userWithMultipleRelations = await client
    .from<User>('users')
    .relation('posts', 'post', ['title', 'content', 'created_at'])
    .relation('comments', 'comment', ['content', 'created_at'])
    .select('*, posts.title, posts.content, comments.content')
    .eq('id', 1)
    .single()
    .execute();
  console.log('Multiple relations result:', userWithMultipleRelations);

  // Relation with all columns
  console.log('--- Relation with all columns ---');
  const userWithAllPostColumns = await client
    .from<User>('users')
    .relation('posts')  // No alias, all columns
    .select('name, email, posts.*')  // posts.* gets all post columns
    .eq('id', 1)
    .single()
    .execute();
  console.log('All post columns:', userWithAllPostColumns);
}

// ============================================================================
// 5. Mixing both syntaxes in the same function
// ============================================================================

async function mixedSyntax() {
  console.log('=== Mixed Syntax Example ===');

  // Use PostgREST for complex queries
  const complexPostgRESTQuery = await client
    .from<User>('users')
    .select('*, posts(*)')  // Join with posts
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(5)
    .execute();
  
  console.log('Complex PostgREST query:', complexPostgRESTQuery);

  // Use repository for simple operations
  const userRepo = client.getRepository<User>('users');
  const userCount = await userRepo.count();
  console.log('Total users (repo):', userCount);

  // Use PostgREST for mutations
  if (complexPostgRESTQuery.data && complexPostgRESTQuery.data.length > 0) {
    const firstUser = complexPostgRESTQuery.data[0];
    
    // Update using PostgREST
    await client
      .from<User>('users')
      .update({ name: `${firstUser.name} (updated)` })
      .eq('id', firstUser.id)
      .execute();

    // Verify using repository
    const updatedUser = await userRepo.findOne({ where: { id: firstUser.id } });
    console.log('Updated user:', updatedUser);
  }
}

// ============================================================================
// 5. Performance comparison and when to use each
// ============================================================================

async function performanceComparison() {
  console.log('=== Performance & Usage Guidelines ===');

  // PostgREST syntax: Better for complex queries, joins, raw SQL-like operations
  const startPostgREST = Date.now();
  const complexQuery = await client
    .from<User>('users')
    .select('*, posts(title, content), comments(content)')
    .eq('active', true)
    .gte('id', 100)
    .order('created_at', { ascending: false })
    .limit(20)
    .execute();
  const postgrestTime = Date.now() - startPostgREST;
  console.log(`PostgREST complex query took: ${postgrestTime}ms`);

  // Repository pattern: Better for CRUD operations, business logic
  const userRepo = client.getRepository<User>('users');
  const startRepo = Date.now();
  const repoUsers = await userRepo.find({
    where: { active: true },
    order: { created_at: 'DESC' },
    take: 20
  });
  const repoTime = Date.now() - startRepo;
  console.log(`Repository query took: ${repoTime}ms`);

  console.log('\n=== When to use each approach ===');
  console.log('PostgREST syntax:');
  console.log('- Complex joins and relations');
  console.log('- Raw SQL-like queries');
  console.log('- Performance-critical queries');
  console.log('- Direct PostgREST feature access');
  
  console.log('\nRepository pattern:');
  console.log('- CRUD operations');
  console.log('- Business logic encapsulation');
  console.log('- Type-safe queries');
  console.log('- Domain-driven design');
}

// ============================================================================
// Main execution
// ============================================================================

async function main() {
  try {
    await originalPostgRESTSyntax();
    await repositoryPattern();
    await customRepository();
    await relationMethodExample();
    await mixedSyntax();
    await performanceComparison();
    
    console.log('\n✅ All examples completed successfully!');
    console.log('\n📝 Summary:');
    console.log('- Original PostgREST syntax: client.from("table").select("*").execute()');
    console.log('- Repository pattern: client.getRepository("table").find()');
    console.log('- New relation() method: client.from("table").relation("posts").select("*, posts.title")');
    console.log('- All syntaxes can be used together in the same application');
    console.log('- No breaking changes to existing code');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  }
}

// Export for use in other files
export {
  main,
  originalPostgRESTSyntax,
  repositoryPattern,
  customRepository,
  relationMethodExample,
  mixedSyntax,
  performanceComparison,
  UserRepository,
};

// Run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  main();
}