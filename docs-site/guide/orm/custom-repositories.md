# Custom Repositories

PGRestify supports custom repositories that extend the CustomRepositoryBase class with domain-specific methods and business logic. This allows you to encapsulate complex queries, add validation logic, and create reusable components that follow the repository pattern established by ORM.

## Overview

Custom repositories in PGRestify provide:

- **Domain-Specific Methods**: Add business logic methods to repositories
- **Query Encapsulation**: Hide complex query logic behind simple method names
- **Type Safety**: Full TypeScript support with generic type parameters
- **Inheritance Support**: Extend base repository with custom functionality
- **DataManager Integration**: Seamless integration with the DataManager pattern
- **Decorator Support**: Optional EntityRepository decorator for clean syntax

## Creating Custom Repositories

### Basic Custom Repository

Extend the base Repository class with custom methods:

```typescript
import { CustomRepositoryBase, createClient } from '@webcoded/pgrestify';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  active: boolean;
  role: 'user' | 'admin' | 'moderator';
  last_login?: string;
  created_at: string;
  updated_at: string;
}

class UserRepository extends CustomRepositoryBase<User> {
  /**
   * Find active users only
   */
  async findActiveUsers(): Promise<User[]> {
    return this.findBy({ active: true });
  }
  
  /**
   * Find user by email address
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email });
  }
  
  /**
   * Find users by role
   */
  async findByRole(role: User['role']): Promise<User[]> {
    return this.findBy({ role, active: true });
  }
  
  /**
   * Find recently active users
   */
  async findRecentlyActive(days: number = 30): Promise<User[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.createQueryBuilder()
      .where('active = :active', { active: true })
      .andWhere('last_login >= :cutoff', { cutoff: cutoffDate.toISOString() })
      .orderBy('last_login', 'DESC')
      .getMany();
  }
  
  /**
   * Get user statistics
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: Record<string, number>;
  }> {
    const allUsers = await this.find();
    const activeUsers = allUsers.filter(u => u.active);
    const inactiveUsers = allUsers.filter(u => !u.active);
    
    const byRole = allUsers.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      total: allUsers.length,
      active: activeUsers.length,
      inactive: inactiveUsers.length,
      byRole
    };
  }
  
  /**
   * Create user with validation
   */
  async createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    // Validation
    if (!userData.email || !userData.email.includes('@')) {
      throw new Error('Valid email address is required');
    }
    
    if (!userData.first_name || !userData.last_name) {
      throw new Error('First name and last name are required');
    }
    
    // Check for duplicate email
    const existingUser = await this.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    
    // Create user with timestamps
    const newUser = {
      ...userData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const created = await this.insert(newUser);
    return created[0];
  }
  
  /**
   * Update user's last login
   */
  async updateLastLogin(userId: string): Promise<User | null> {
    const updated = await this.update(
      { id: userId },
      { 
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    );
    
    return updated[0] || null;
  }
  
  /**
   * Deactivate user
   */
  async deactivateUser(userId: string, reason?: string): Promise<User | null> {
    const updateData: Partial<User> = {
      active: false,
      updated_at: new Date().toISOString()
    };
    
    // If reason is provided, you could store it in a separate audit table
    if (reason) {
      // Log deactivation reason (implement audit logging as needed)
      console.log(`User ${userId} deactivated: ${reason}`);
    }
    
    const updated = await this.update({ id: userId }, updateData);
    return updated[0] || null;
  }
}

// Usage
const client = createClient({ url: 'http://localhost:3000' });

// Get custom repository instance
const userRepository = client.getCustomRepository(UserRepository, 'users');

// Use custom methods
const activeUsers = await userRepository.findActiveUsers();
const adminUsers = await userRepository.findByRole('admin');
const stats = await userRepository.getUserStats();
```

### Advanced Custom Repository

Create more complex repositories with relationships and advanced queries:

```typescript
interface Post {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  author_id: string;
  category_id: string;
  published: boolean;
  featured: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

class PostRepository extends CustomRepositoryBase<Post> {
  /**
   * Find published posts with pagination
   */
  async findPublished(options: {
    page?: number;
    limit?: number;
    featured?: boolean;
  } = {}): Promise<{
    posts: Post[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    const { page = 1, limit = 20, featured } = options;
    const offset = (page - 1) * limit;
    
    let query = this.getQueryBuilder()
      .eq('published', true);
    
    if (featured !== undefined) {
      query = query.eq('featured', featured);
    }
    
    // Get total count for pagination
    const totalCount = await query.getCount();
    
    // Get paginated results
    const result = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
      .execute();
    
    return {
      posts: result.data || [],
      pagination: {
        page,
        limit,
        total: totalCount,
        hasMore: offset + limit < totalCount
      }
    };
  }
  
  /**
   * Find posts by author with author information
   */
  async findByAuthorWithDetails(authorId: string): Promise<any[]> {
    const result = await this.getQueryBuilder()
      .select(`
        id,
        title,
        excerpt,
        published,
        featured,
        view_count,
        created_at,
        author:users!author_id(
          id,
          first_name,
          last_name,
          email
        ),
        category:categories!category_id(
          id,
          name,
          slug
        )
      `)
      .eq('author_id', authorId)
      .order('created_at', { ascending: false })
      .execute();
    
    return result.data || [];
  }
  
  /**
   * Search posts by title and content
   */
  async searchPosts(query: string, options: {
    publishedOnly?: boolean;
    limit?: number;
  } = {}): Promise<Post[]> {
    const { publishedOnly = true, limit = 50 } = options;
    
    let queryBuilder = this.createQueryBuilder()
      .where('title ILIKE :query', { query: `%${query}%` })
      .orWhere('content ILIKE :query', { query: `%${query}%` });
    
    if (publishedOnly) {
      queryBuilder = queryBuilder.andWhere('published = :published', { published: true });
    }
    
    return queryBuilder
      .orderBy('view_count', 'DESC')
      .limit(limit)
      .getMany();
  }
  
  /**
   * Get popular posts
   */
  async findPopular(limit: number = 10): Promise<Post[]> {
    const result = await this.getQueryBuilder()
      .eq('published', true)
      .order('view_count', { ascending: false })
      .limit(limit)
      .execute();
    
    return result.data || [];
  }
  
  /**
   * Get recent posts by category
   */
  async findRecentByCategory(categoryId: string, limit: number = 5): Promise<Post[]> {
    const result = await this.getQueryBuilder()
      .eq('category_id', categoryId)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(limit)
      .execute();
    
    return result.data || [];
  }
  
  /**
   * Publish post
   */
  async publishPost(postId: string): Promise<Post | null> {
    const updated = await this.update(
      { id: postId },
      { 
        published: true, 
        updated_at: new Date().toISOString() 
      }
    );
    
    return updated[0] || null;
  }
  
  /**
   * Increment view count
   */
  async incrementViewCount(postId: string): Promise<void> {
    // Using raw query to increment atomically
    await this.getQueryBuilder()
      .select('view_count')
      .eq('id', postId)
      .execute()
      .then(async (result) => {
        if (result.data && result.data[0]) {
          const currentCount = result.data[0].view_count || 0;
          await this.update(
            { id: postId },
            { view_count: currentCount + 1 }
          );
        }
      });
  }
  
  /**
   * Get post statistics
   */
  async getPostStats(): Promise<{
    total: number;
    published: number;
    draft: number;
    featured: number;
    totalViews: number;
    avgViews: number;
  }> {
    const allPosts = await this.find();
    const published = allPosts.filter(p => p.published);
    const draft = allPosts.filter(p => !p.published);
    const featured = allPosts.filter(p => p.featured);
    const totalViews = allPosts.reduce((sum, p) => sum + (p.view_count || 0), 0);
    
    return {
      total: allPosts.length,
      published: published.length,
      draft: draft.length,
      featured: featured.length,
      totalViews,
      avgViews: allPosts.length > 0 ? Math.round(totalViews / allPosts.length) : 0
    };
  }
}
```

## Repository with Relationships

Handle related data efficiently in custom repositories:

```typescript
interface Comment {
  id: string;
  content: string;
  post_id: string;
  author_id: string;
  parent_id?: string;
  approved: boolean;
  created_at: string;
}

class CommentRepository extends Repository<Comment> {
  /**
   * Find comments for a post with author information
   */
  async findByPostWithAuthors(postId: string): Promise<any[]> {
    const result = await this.getQueryBuilder()
      .select(`
        id,
        content,
        created_at,
        approved,
        parent_id,
        author:users!author_id(
          id,
          first_name,
          last_name
        )
      `)
      .eq('post_id', postId)
      .eq('approved', true)
      .order('created_at', { ascending: true })
      .execute();
    
    return result.data || [];
  }
  
  /**
   * Find threaded comments (with replies)
   */
  async findThreadedComments(postId: string): Promise<any[]> {
    const result = await this.getQueryBuilder()
      .select(`
        id,
        content,
        created_at,
        approved,
        parent_id,
        author:users!author_id(
          first_name,
          last_name
        ),
        replies:comments!parent_id(
          id,
          content,
          created_at,
          author:users!author_id(first_name, last_name)
        )
      `)
      .eq('post_id', postId)
      .eq('approved', true)
      .is('parent_id', null) // Only top-level comments
      .order('created_at', { ascending: true })
      .execute();
    
    return result.data || [];
  }
  
  /**
   * Get comment moderation queue
   */
  async getModerationQueue(limit: number = 50): Promise<any[]> {
    const result = await this.getQueryBuilder()
      .select(`
        id,
        content,
        created_at,
        post:posts!post_id(id, title),
        author:users!author_id(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('approved', false)
      .order('created_at', { ascending: true })
      .limit(limit)
      .execute();
    
    return result.data || [];
  }
  
  /**
   * Approve comment
   */
  async approveComment(commentId: string): Promise<Comment | null> {
    const updated = await this.update(
      { id: commentId },
      { approved: true }
    );
    
    return updated[0] || null;
  }
  
  /**
   * Get comment statistics by post
   */
  async getCommentStatsByPost(postId: string): Promise<{
    total: number;
    approved: number;
    pending: number;
  }> {
    const comments = await this.findBy({ post_id: postId });
    const approved = comments.filter(c => c.approved);
    const pending = comments.filter(c => !c.approved);
    
    return {
      total: comments.length,
      approved: approved.length,
      pending: pending.length
    };
  }
}
```

## EntityRepository Decorator

Use the EntityRepository decorator for cleaner syntax:

```typescript
import { EntityRepository, Repository } from '@webcoded/pgrestify';

@EntityRepository<User>('users')
class DecoratedUserRepository extends Repository<User> {
  async findActiveUsersDecorated(): Promise<User[]> {
    return this.findBy({ active: true });
  }
  
  async findUsersByRoleDecorated(role: User['role']): Promise<User[]> {
    return this.findBy({ role, active: true });
  }
}

// The decorator automatically binds the table name
// Usage remains the same
const decoratedRepo = dataManager.getCustomRepository(DecoratedUserRepository, 'users');
const activeUsers = await decoratedRepo.findActiveUsersDecorated();
```

## Repository Composition

Combine multiple repositories for complex operations:

```typescript
class BlogService {
  private userRepository: UserRepository;
  private postRepository: PostRepository;
  private commentRepository: CommentRepository;
  
  constructor(dataManager: DataManager) {
    this.userRepository = dataManager.getCustomRepository(UserRepository, 'users');
    this.postRepository = dataManager.getCustomRepository(PostRepository, 'posts');
    this.commentRepository = dataManager.getCustomRepository(CommentRepository, 'comments');
  }
  
  /**
   * Get complete blog post with author and comments
   */
  async getBlogPostComplete(postId: string): Promise<{
    post: Post | null;
    author: User | null;
    comments: Comment[];
    stats: any;
  } | null> {
    // Get post
    const post = await this.postRepository.findById(postId);
    if (!post) return null;
    
    // Get author
    const author = await this.userRepository.findById(post.author_id);
    
    // Get comments
    const comments = await this.commentRepository.findByPostWithAuthors(postId);
    
    // Get stats
    const stats = await this.commentRepository.getCommentStatsByPost(postId);
    
    return {
      post,
      author,
      comments,
      stats
    };
  }
  
  /**
   * Create complete blog post with validation
   */
  async createBlogPost(
    authorId: string, 
    postData: Omit<Post, 'id' | 'author_id' | 'created_at' | 'updated_at'>
  ): Promise<Post> {
    // Validate author exists
    const author = await this.userRepository.findById(authorId);
    if (!author || !author.active) {
      throw new Error('Author not found or inactive');
    }
    
    // Create post
    const newPost = {
      ...postData,
      author_id: authorId,
      view_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const created = await this.postRepository.insert(newPost);
    return created[0];
  }
  
  /**
   * Get user dashboard data
   */
  async getUserDashboard(userId: string): Promise<{
    user: User | null;
    posts: {
      published: Post[];
      drafts: Post[];
      stats: any;
    };
    recentComments: Comment[];
  }> {
    const user = await this.userRepository.findById(userId);
    
    const allUserPosts = await this.postRepository.findBy({ author_id: userId });
    const published = allUserPosts.filter(p => p.published);
    const drafts = allUserPosts.filter(p => !p.published);
    
    const postStats = await this.postRepository.getPostStats();
    
    // Get recent comments on user's posts
    const userPostIds = allUserPosts.map(p => p.id);
    const recentComments = await this.commentRepository
      .getQueryBuilder()
      .in('post_id', userPostIds)
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(10)
      .execute()
      .then(result => result.data || []);
    
    return {
      user,
      posts: {
        published,
        drafts,
        stats: postStats
      },
      recentComments
    };
  }
}

// Usage
const blogService = new BlogService(dataManager);
const dashboard = await blogService.getUserDashboard('user-123');
const completeBlogPost = await blogService.getBlogPostComplete('post-456');
```

## Testing Custom Repositories

Create testable custom repositories:

```typescript
interface MockRepository<T> {
  find(): Promise<T[]>;
  findBy(where: Partial<T>): Promise<T[]>;
  findOne(where: Partial<T>): Promise<T | null>;
  insert(data: Partial<T>): Promise<T[]>;
  update(where: Partial<T>, data: Partial<T>): Promise<T[]>;
  delete(where: Partial<T>): Promise<T[]>;
}

class TestableUserRepository extends UserRepository {
  private mockData?: User[];
  
  constructor(tableName: string, ...args: any[]) {
    super(tableName, ...args);
  }
  
  // Override for testing
  setMockData(data: User[]): void {
    this.mockData = data;
  }
  
  async find(): Promise<User[]> {
    if (this.mockData) return this.mockData;
    return super.find();
  }
  
  async findBy(where: Partial<User>): Promise<User[]> {
    if (this.mockData) {
      return this.mockData.filter(user => {
        return Object.entries(where).every(([key, value]) => 
          user[key as keyof User] === value
        );
      });
    }
    return super.findBy(where);
  }
}

// Test usage
const testRepo = new TestableUserRepository('users');
testRepo.setMockData([
  { 
    id: '1', 
    email: 'test@example.com', 
    first_name: 'Test', 
    last_name: 'User', 
    active: true, 
    role: 'user',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
]);

const activeUsers = await testRepo.findActiveUsers();
console.log('Test result:', activeUsers.length); // 1
```

## Performance Considerations

### Optimizing Custom Repositories

```typescript
class OptimizedPostRepository extends PostRepository {
  /**
   * Cached popular posts
   */
  private popularPostsCache?: { posts: Post[]; timestamp: number };
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  async findPopularCached(limit: number = 10): Promise<Post[]> {
    const now = Date.now();
    
    if (this.popularPostsCache && 
        (now - this.popularPostsCache.timestamp) < this.CACHE_DURATION) {
      return this.popularPostsCache.posts.slice(0, limit);
    }
    
    const posts = await this.findPopular(limit);
    this.popularPostsCache = {
      posts,
      timestamp: now
    };
    
    return posts;
  }
  
  /**
   * Batch operations for better performance
   */
  async incrementViewCounts(postIds: string[]): Promise<void> {
    // Batch update instead of individual updates
    const promises = postIds.map(async (postId) => {
      const result = await this.getQueryBuilder()
        .select('view_count')
        .eq('id', postId)
        .execute();
      
      if (result.data && result.data[0]) {
        const currentCount = result.data[0].view_count || 0;
        return this.update(
          { id: postId },
          { view_count: currentCount + 1 }
        );
      }
    });
    
    await Promise.all(promises);
  }
}
```

## Summary

Custom repositories in PGRestify provide:

- **Domain-Specific Logic**: Encapsulate business rules and complex queries
- **Type Safety**: Full TypeScript support with generic type parameters
- **Repository Pattern**: Familiar ORM-like patterns and methods
- **Relationship Handling**: Easy management of related data
- **Service Layer Integration**: Compose repositories into higher-level services
- **Testing Support**: Mockable interfaces for unit testing
- **Performance Optimization**: Caching and batch operation capabilities
- **Decorator Support**: Clean syntax with EntityRepository decorator

Custom repositories help organize your data access layer and make your code more maintainable, testable, and type-safe while providing the flexibility to implement domain-specific requirements.