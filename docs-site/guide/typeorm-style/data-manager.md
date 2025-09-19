# DataManager (EntityManager-Style)

The DataManager in PGRestify serves the same role as TypeORM's EntityManager, providing a centralized interface for managing repositories and coordinating database operations across multiple tables. It acts as a factory for repositories and provides transaction-like functionality within PostgREST's limitations.

## Overview

The DataManager provides:

- **Repository Factory**: Create and manage repository instances
- **Custom Repository Support**: Register and retrieve custom repository classes
- **Cache Management**: Centralized cache control across all repositories
- **Transaction Coordination**: Coordinate operations across multiple tables
- **Type Safety**: Full TypeScript support with generic repository creation

## Basic DataManager Usage

### Getting DataManager Instance

The DataManager is available through the main client:

```tsx
import { createClient } from '@webcoded/pgrestify';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  active: boolean;
  created_at: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  published: boolean;
  created_at: string;
}

// Create client
const client = createClient({ url: 'http://localhost:3000' });

// Get DataManager instance
const dataManager = client.dataManager;

// Get repositories for different tables
const userRepository = dataManager.getRepository<User>('users');
const postRepository = dataManager.getRepository<Post>('posts');
```

### Repository Management

DataManager creates and caches repository instances automatically:

```tsx
async function repositoryManagement() {
  // Get repositories (created and cached automatically)
  const userRepo1 = dataManager.getRepository<User>('users');
  const userRepo2 = dataManager.getRepository<User>('users');
  
  // Both variables reference the same repository instance
  console.log(userRepo1 === userRepo2); // true
  
  // Different tables get different repositories
  const postRepo = dataManager.getRepository<Post>('posts');
  console.log(userRepo1 === postRepo); // false
  
  // Use repositories for operations
  const users = await userRepo1.find();
  const posts = await postRepo.findBy({ published: true });
  
  console.log(`Found ${users.length} users and ${posts.length} published posts`);
}
```

## Advanced DataManager Features

### Multi-Table Operations

Coordinate operations across multiple tables:

```tsx
async function multiTableOperations() {
  const userRepository = dataManager.getRepository<User>('users');
  const postRepository = dataManager.getRepository<Post>('posts');
  
  // Create user and their first post
  const createUserWithPost = async (userData: Partial<User>, postData: Partial<Post>) => {
    try {
      // Create user first
      const createdUsers = await userRepository.insert(userData);
      const newUser = createdUsers[0];
      
      if (!newUser) {
        throw new Error('Failed to create user');
      }
      
      // Create post linked to new user
      const postWithAuthor = {
        ...postData,
        author_id: newUser.id
      };
      
      const createdPosts = await postRepository.insert(postWithAuthor);
      const newPost = createdPosts[0];
      
      return {
        user: newUser,
        post: newPost
      };
      
    } catch (error) {
      // In a real transaction, we'd rollback the user creation
      // PostgREST doesn't support transactions, so handle cleanup manually
      console.error('Failed to create user with post:', error);
      throw error;
    }
  };
  
  const result = await createUserWithPost(
    {
      email: 'author@example.com',
      first_name: 'John',
      last_name: 'Author',
      active: true
    },
    {
      title: 'My First Post',
      content: 'This is my first blog post!',
      published: true
    }
  );
  
  console.log('Created user and post:', result);
}
```

### Bulk Operations Across Tables

```tsx
async function bulkOperationsAcrossTables() {
  const userRepository = dataManager.getRepository<User>('users');
  const postRepository = dataManager.getRepository<Post>('posts');
  
  // Get users and their post counts
  const getUsersWithPostCounts = async () => {
    const users = await userRepository.find();
    
    const usersWithCounts = await Promise.all(
      users.map(async (user) => {
        const postCount = await postRepository.count({ author_id: user.id });
        return {
          ...user,
          post_count: postCount
        };
      })
    );
    
    return usersWithCounts;
  };
  
  const usersWithCounts = await getUsersWithPostCounts();
  console.log('Users with post counts:', usersWithCounts);
  
  // Bulk update inactive users and unpublish their posts
  const deactivateUsersAndPosts = async (userIds: string[]) => {
    try {
      // Update users
      const updatedUsers = await userRepository
        .getQueryBuilder()
        .update({ active: false })
        .in('id', userIds)
        .execute();
      
      // Update their posts
      const updatedPosts = await postRepository
        .getQueryBuilder()
        .update({ published: false })
        .in('author_id', userIds)
        .execute();
      
      return {
        users: updatedUsers.data?.length || 0,
        posts: updatedPosts.data?.length || 0
      };
      
    } catch (error) {
      console.error('Bulk deactivation failed:', error);
      throw error;
    }
  };
  
  // Deactivate specific users
  const result = await deactivateUsersAndPosts(['user1', 'user2', 'user3']);
  console.log(`Deactivated ${result.users} users and unpublished ${result.posts} posts`);
}
```

## Custom Repository Support

### Registering Custom Repositories

DataManager can work with custom repository classes:

```tsx
import { Repository } from '@webcoded/pgrestify';

// Custom User Repository
class UserRepository extends Repository<User> {
  async findActiveUsers(): Promise<User[]> {
    return this.findBy({ active: true });
  }
  
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }
  
  async findUsersCreatedAfter(date: string): Promise<User[]> {
    return this.getQueryBuilder()
      .gte('created_at', date)
      .order('created_at', { ascending: false })
      .execute()
      .then(result => result.data || []);
  }
  
  async getUserStats(userId: string) {
    const postRepository = dataManager.getRepository<Post>('posts');
    
    const user = await this.findById(userId);
    if (!user) return null;
    
    const postCount = await postRepository.count({ author_id: userId });
    const publishedCount = await postRepository.count({ 
      author_id: userId, 
      published: true 
    });
    
    return {
      user,
      statistics: {
        total_posts: postCount,
        published_posts: publishedCount,
        draft_posts: postCount - publishedCount
      }
    };
  }
}

// Custom Post Repository
class PostRepository extends Repository<Post> {
  async findPublishedPosts(): Promise<Post[]> {
    return this.findBy({ published: true });
  }
  
  async findPostsByAuthor(authorId: string): Promise<Post[]> {
    return this.findBy({ author_id: authorId });
  }
  
  async findRecentPosts(limit: number = 10): Promise<Post[]> {
    return this.getQueryBuilder()
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(limit)
      .execute()
      .then(result => result.data || []);
  }
  
  async searchPosts(query: string): Promise<Post[]> {
    return this.getQueryBuilder()
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .execute()
      .then(result => result.data || []);
  }
}

// Using custom repositories
async function useCustomRepositories() {
  // Get custom repository instances
  const userRepo = dataManager.getCustomRepository(UserRepository, 'users');
  const postRepo = dataManager.getCustomRepository(PostRepository, 'posts');
  
  // Use custom methods
  const activeUsers = await userRepo.findActiveUsers();
  const recentPosts = await postRepo.findRecentPosts(5);
  const userStats = await userRepo.getUserStats('user-123');
  
  console.log('Active users:', activeUsers.length);
  console.log('Recent posts:', recentPosts.length);
  console.log('User stats:', userStats);
  
  // Search functionality
  const searchResults = await postRepo.searchPosts('typescript');
  console.log('Search results:', searchResults.length);
}
```

### Repository Inheritance Patterns

```tsx
// Base repository with common functionality
abstract class BaseRepository<T extends Record<string, unknown>> extends Repository<T> {
  async findActive(): Promise<T[]> {
    return this.findBy({ active: true } as Partial<T>);
  }
  
  async findCreatedBetween(startDate: string, endDate: string): Promise<T[]> {
    return this.getQueryBuilder()
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false })
      .execute()
      .then(result => result.data || []);
  }
  
  async softDeleteWithTimestamp(where: Partial<T>): Promise<T[]> {
    return this.update(where, { 
      deleted_at: new Date().toISOString() 
    } as Partial<T>);
  }
}

// Specific repositories extending base
class EnhancedUserRepository extends BaseRepository<User> {
  async findAdmins(): Promise<User[]> {
    return this.findBy({ role: 'admin', active: true } as Partial<User>);
  }
}

class EnhancedPostRepository extends BaseRepository<Post> {
  async findFeaturedPosts(): Promise<Post[]> {
    return this.findBy({ featured: true, published: true } as Partial<Post>);
  }
}

// Usage
const enhancedUserRepo = dataManager.getCustomRepository(EnhancedUserRepository, 'users');
const enhancedPostRepo = dataManager.getCustomRepository(EnhancedPostRepository, 'posts');

const activeUsers = await enhancedUserRepo.findActive();
const adminUsers = await enhancedUserRepo.findAdmins();
const featuredPosts = await enhancedPostRepo.findFeaturedPosts();
```

## Transaction-Like Operations

While PostgREST doesn't support traditional database transactions, DataManager provides coordination mechanisms:

```tsx
async function transactionLikeOperations() {
  // Pseudo-transaction: coordinate multiple operations
  const executeAsTransaction = async <T>(
    operations: (manager: typeof dataManager) => Promise<T>
  ): Promise<T> => {
    try {
      // Execute operations
      const result = await operations(dataManager);
      
      // If we get here, all operations succeeded
      console.log('All operations completed successfully');
      return result;
      
    } catch (error) {
      // Log the error and re-throw
      console.error('Transaction-like operation failed:', error);
      
      // In a real transaction system, we'd rollback here
      // With PostgREST, you'd need to implement compensation logic
      
      throw error;
    }
  };
  
  // Use the pseudo-transaction
  const result = await executeAsTransaction(async (manager) => {
    const userRepo = manager.getRepository<User>('users');
    const postRepo = manager.getRepository<Post>('posts');
    
    // Create user
    const users = await userRepo.insert({
      email: 'transactional@example.com',
      first_name: 'Trans',
      last_name: 'Actional',
      active: true
    });
    
    const user = users[0];
    if (!user) throw new Error('Failed to create user');
    
    // Create post for user
    const posts = await postRepo.insert({
      title: 'Transactional Post',
      content: 'This post was created in a pseudo-transaction',
      author_id: user.id,
      published: true
    });
    
    const post = posts[0];
    if (!post) {
      // Cleanup: delete the user if post creation failed
      await userRepo.delete({ id: user.id });
      throw new Error('Failed to create post');
    }
    
    return { user, post };
  });
  
  console.log('Transaction result:', result);
}
```

## Cache Management

DataManager provides centralized cache control:

```tsx
async function cacheManagement() {
  // Clear all caches managed by DataManager
  dataManager.clearCache();
  
  // Get repositories after cache clear
  const userRepository = dataManager.getRepository<User>('users');
  const postRepository = dataManager.getRepository<Post>('posts');
  
  // Perform operations (will not use cached data)
  const users = await userRepository.find();
  const posts = await postRepository.find();
  
  console.log(`Fresh data: ${users.length} users, ${posts.length} posts`);
  
  // Repository-specific cache operations would use the underlying query builder's cache
  const cachedUsers = await userRepository.getQueryBuilder()
    .select('id, email, first_name, last_name')
    .execute();
  
  // The underlying cache handles individual query caching
}
```

## Error Handling and Best Practices

### Comprehensive Error Handling

```tsx
import { PostgRESTError } from '@webcoded/pgrestify';

async function robustDataOperations() {
  const userRepository = dataManager.getRepository<User>('users');
  const postRepository = dataManager.getRepository<Post>('posts');
  
  try {
    // Validate input
    const email = 'test@example.com';
    if (!email || !email.includes('@')) {
      throw new Error('Valid email required');
    }
    
    // Check if user exists
    const existingUser = await userRepository.findOne({ email });
    if (existingUser) {
      throw new Error('User already exists');
    }
    
    // Create user with error handling
    const users = await userRepository.insert({
      email,
      first_name: 'Test',
      last_name: 'User',
      active: true
    });
    
    if (!users || users.length === 0) {
      throw new Error('Failed to create user');
    }
    
    const user = users[0];
    console.log('Created user:', user.email);
    
    // Create welcome post
    const posts = await postRepository.insert({
      title: 'Welcome!',
      content: 'Welcome to our platform!',
      author_id: user.id,
      published: true
    });
    
    return { user, post: posts[0] };
    
  } catch (error) {
    if (error instanceof PostgRESTError) {
      // Handle PostgREST-specific errors
      switch (error.statusCode) {
        case 400:
          console.error('Bad request:', error.message);
          break;
        case 401:
          console.error('Unauthorized:', error.message);
          break;
        case 403:
          console.error('Forbidden:', error.message);
          break;
        case 409:
          console.error('Conflict (likely unique constraint):', error.message);
          break;
        default:
          console.error('PostgREST error:', error);
      }
    } else {
      // Handle application errors
      console.error('Application error:', error);
    }
    
    throw error; // Re-throw for caller to handle
  }
}
```

### Performance Optimization

```tsx
async function optimizedOperations() {
  const userRepository = dataManager.getRepository<User>('users');
  const postRepository = dataManager.getRepository<Post>('posts');
  
  // Batch operations instead of loops
  const userIds = ['id1', 'id2', 'id3', 'id4', 'id5'];
  
  // Efficient: single query
  const users = await userRepository.findByIds(userIds);
  
  // Efficient: single query with joins
  const postsWithAuthors = await postRepository
    .getQueryBuilder()
    .select('*, author:users!author_id(id, first_name, last_name)')
    .in('author_id', userIds)
    .execute();
  
  // Group posts by author
  const postsByAuthor = (postsWithAuthors.data || []).reduce((acc, post) => {
    const authorId = post.author_id;
    if (!acc[authorId]) acc[authorId] = [];
    acc[authorId].push(post);
    return acc;
  }, {} as Record<string, Post[]>);
  
  console.log('Users:', users.length);
  console.log('Posts by author:', Object.keys(postsByAuthor).length);
}
```

## DataManager vs Direct Repository Usage

### When to Use DataManager

```tsx
// Good: Complex operations across multiple tables
async function complexBusinessLogic() {
  const userRepo = dataManager.getRepository<User>('users');
  const postRepo = dataManager.getRepository<Post>('posts');
  const commentRepo = dataManager.getRepository('comments');
  
  // Coordinate operations across tables
  return { userRepo, postRepo, commentRepo };
}

// Good: Custom repository management
async function customRepositoryUsage() {
  const customUserRepo = dataManager.getCustomRepository(UserRepository, 'users');
  return customUserRepo.findActiveUsers();
}
```

### When Direct Repository Creation Might Be Better

```tsx
// Simple: Single table operations
async function simpleUserOperation() {
  // Could create repository directly if you prefer
  const client = createClient({ url: 'http://localhost:3000' });
  
  // But DataManager is still recommended for consistency
  const userRepo = client.dataManager.getRepository<User>('users');
  return userRepo.find();
}
```

## Summary

The DataManager provides:

- **Centralized Repository Management**: Factory pattern for repository creation and caching
- **Custom Repository Support**: Register and use domain-specific repository classes
- **Multi-Table Coordination**: Orchestrate operations across multiple tables
- **Cache Management**: Centralized control over caching behavior
- **Type Safety**: Full TypeScript support with generic repository creation
- **Error Handling**: Consistent error handling patterns across repositories

The DataManager is the recommended way to work with multiple repositories and coordinate complex operations in PGRestify, providing a familiar EntityManager-like interface for developers coming from TypeORM.