# Relationships

PGRestify handles relationships through PostgREST's powerful resource embedding syntax, allowing you to fetch related data in a single query. While PostgREST doesn't use traditional JOIN syntax, it provides even more flexible ways to load related data through foreign key relationships and computed columns.

## Overview

Relationships in PGRestify work through:

- **Resource Embedding**: Load related data using PostgREST's embedding syntax
- **Foreign Key Navigation**: Follow foreign key relationships automatically
- **Reverse Relationships**: Query from referenced table back to referencing table
- **Deep Nesting**: Load multiple levels of related data
- **Filtering on Relationships**: Filter parent records by related data
- **Computed Relationships**: Use database functions to compute relationships

## Basic Relationship Patterns

### One-to-One Relationships

```tsx
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  user_id: string;  // Foreign key to users.id
  bio?: string;
  avatar_url?: string;
  website?: string;
  location?: string;
}

// User with profile (one-to-one)
async function oneToOneRelationships() {
  const userRepository = dataManager.getRepository<User>('users');
  
  // Load user with profile
  const userWithProfile = await userRepository
    .getQueryBuilder()
    .select(`
      id,
      email,
      first_name,
      last_name,
      created_at,
      profile:profiles!user_id(
        id,
        bio,
        avatar_url,
        website,
        location
      )
    `)
    .eq('id', 'user-123')
    .single()
    .execute();
  
  if (userWithProfile.data) {
    const user = userWithProfile.data;
    console.log(`User: ${user.first_name} ${user.last_name}`);
    console.log(`Bio: ${user.profile?.bio || 'No bio'}`);
    console.log(`Website: ${user.profile?.website || 'No website'}`);
  }
  
  // Alternative: Load profile with user (reverse direction)
  const profileRepository = dataManager.getRepository<UserProfile>('profiles');
  
  const profileWithUser = await profileRepository
    .getQueryBuilder()
    .select(`
      id,
      bio,
      avatar_url,
      website,
      location,
      user:users!user_id(
        id,
        email,
        first_name,
        last_name
      )
    `)
    .eq('user_id', 'user-123')
    .single()
    .execute();
  
  if (profileWithUser.data) {
    const profile = profileWithUser.data;
    console.log(`Profile for: ${profile.user.first_name} ${profile.user.last_name}`);
    console.log(`Bio: ${profile.bio}`);
  }
}
```

### One-to-Many Relationships

```tsx
interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;  // Foreign key to users.id
  published: boolean;
  created_at: string;
}

// User with posts (one-to-many)
async function oneToManyRelationships() {
  const userRepository = dataManager.getRepository<User>('users');
  
  // Load user with all posts
  const userWithPosts = await userRepository
    .getQueryBuilder()
    .select(`
      id,
      email,
      first_name,
      last_name,
      posts:posts!author_id(
        id,
        title,
        content,
        published,
        created_at
      )
    `)
    .eq('id', 'user-123')
    .single()
    .execute();
  
  if (userWithPosts.data) {
    const user = userWithPosts.data;
    console.log(`${user.first_name} has ${user.posts.length} posts`);
    
    user.posts.forEach(post => {
      console.log(`- ${post.title} (${post.published ? 'Published' : 'Draft'})`);
    });
  }
  
  // Load user with filtered posts (only published)
  const userWithPublishedPosts = await userRepository
    .getQueryBuilder()
    .select(`
      id,
      email,
      first_name,
      last_name,
      published_posts:posts!author_id(
        id,
        title,
        created_at
      ).eq(published,true).order(created_at.desc).limit(5)
    `)
    .eq('id', 'user-123')
    .single()
    .execute();
  
  console.log('User with filtered posts:', userWithPublishedPosts.data);
}
```

### Many-to-Many Relationships

```tsx
interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface PostTag {
  post_id: string;  // Foreign key to posts.id
  tag_id: string;   // Foreign key to tags.id
}

// Post with tags (many-to-many through junction table)
async function manyToManyRelationships() {
  const postRepository = dataManager.getRepository<Post>('posts');
  
  // Load post with tags through junction table
  const postWithTags = await postRepository
    .getQueryBuilder()
    .select(`
      id,
      title,
      content,
      published,
      created_at,
      post_tags:post_tags!post_id(
        tag:tags!tag_id(
          id,
          name,
          slug
        )
      )
    `)
    .eq('id', 'post-123')
    .single()
    .execute();
  
  if (postWithTags.data) {
    const post = postWithTags.data;
    console.log(`Post: ${post.title}`);
    console.log('Tags:', post.post_tags.map(pt => pt.tag.name).join(', '));
  }
  
  // Alternative: Load posts by tag
  const tagRepository = dataManager.getRepository<Tag>('tags');
  
  const tagWithPosts = await tagRepository
    .getQueryBuilder()
    .select(`
      id,
      name,
      slug,
      post_tags:post_tags!tag_id(
        post:posts!post_id(
          id,
          title,
          published,
          created_at
        )
      ).eq(posts.published,true)
    `)
    .eq('slug', 'javascript')
    .single()
    .execute();
  
  if (tagWithPosts.data) {
    const tag = tagWithPosts.data;
    console.log(`Tag: ${tag.name}`);
    console.log(`Published posts: ${tag.post_tags.length}`);
  }
}
```

## Advanced Relationship Queries

### Deep Nesting

Load multiple levels of relationships:

```tsx
interface Comment {
  id: string;
  content: string;
  post_id: string;
  author_id: string;
  parent_id?: string;  // For threaded comments
  created_at: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

async function deepNesting() {
  const postRepository = dataManager.getRepository<Post>('posts');
  
  // Load post with author, category, and comments with their authors
  const postWithEverything = await postRepository
    .getQueryBuilder()
    .select(`
      id,
      title,
      content,
      published,
      created_at,
      author:users!author_id(
        id,
        first_name,
        last_name,
        email,
        profile:profiles!user_id(
          bio,
          avatar_url
        )
      ),
      category:categories!category_id(
        id,
        name,
        slug
      ),
      comments:comments!post_id(
        id,
        content,
        created_at,
        author:users!author_id(
          id,
          first_name,
          last_name
        ),
        replies:comments!parent_id(
          id,
          content,
          created_at,
          author:users!author_id(
            first_name,
            last_name
          )
        )
      ).order(created_at.desc).limit(10)
    `)
    .eq('id', 'post-123')
    .single()
    .execute();
  
  if (postWithEverything.data) {
    const post = postWithEverything.data;
    console.log(`Post: ${post.title}`);
    console.log(`Author: ${post.author.first_name} ${post.author.last_name}`);
    console.log(`Category: ${post.category.name}`);
    console.log(`Comments: ${post.comments.length}`);
    
    post.comments.forEach(comment => {
      console.log(`- ${comment.author.first_name}: ${comment.content}`);
      if (comment.replies?.length > 0) {
        comment.replies.forEach(reply => {
          console.log(`  → ${reply.author.first_name}: ${reply.content}`);
        });
      }
    });
  }
}
```

### Filtering by Relationships

Filter parent records based on related data:

```tsx
async function filterByRelationships() {
  const userRepository = dataManager.getRepository<User>('users');
  
  // Find users who have published posts
  const usersWithPublishedPosts = await userRepository
    .getQueryBuilder()
    .select(`
      id,
      email,
      first_name,
      last_name,
      posts:posts!author_id(count).eq(published,true)
    `)
    .execute();
  
  // Filter to only users with published posts
  const activeAuthors = usersWithPublishedPosts.data?.filter(
    user => user.posts[0]?.count > 0
  ) || [];
  
  console.log(`Found ${activeAuthors.length} users with published posts`);
  
  // Alternative: Use PostgREST's filtering on relationships
  const usersWithRecentPosts = await userRepository
    .getQueryBuilder()
    .select(`
      id,
      email,
      first_name,
      last_name,
      recent_posts:posts!author_id(
        id,
        title,
        created_at
      ).gte(created_at,2024-01-01).order(created_at.desc)
    `)
    .execute();
  
  console.log('Users with recent posts:', usersWithRecentPosts.data?.length);
}
```

### Computed Relationships

Use database functions for computed relationships:

```tsx
async function computedRelationships() {
  const userRepository = dataManager.getRepository<User>('users');
  
  // Load users with computed statistics
  const usersWithStats = await userRepository
    .getQueryBuilder()
    .select(`
      id,
      email,
      first_name,
      last_name,
      post_count:posts!author_id(count),
      published_count:posts!author_id(count).eq(published,true),
      latest_post:posts!author_id(
        title,
        created_at
      ).order(created_at.desc).limit(1),
      avg_post_length:posts!author_id.select(avg(length(content))).eq(published,true)
    `)
    .eq('active', true)
    .execute();
  
  if (usersWithStats.data) {
    usersWithStats.data.forEach(user => {
      console.log(`${user.first_name} ${user.last_name}:`);
      console.log(`  Total posts: ${user.post_count[0]?.count || 0}`);
      console.log(`  Published: ${user.published_count[0]?.count || 0}`);
      console.log(`  Latest: ${user.latest_post[0]?.title || 'None'}`);
      console.log(`  Avg length: ${user.avg_post_length[0] || 'N/A'}`);
    });
  }
}
```

## Relationship Helper Methods

Create helper methods for common relationship patterns:

```tsx
class UserRepository extends Repository<User> {
  /**
   * Find user with all related data
   */
  async findUserWithProfile(userId: string) {
    return this.getQueryBuilder()
      .select(`
        id,
        email,
        first_name,
        last_name,
        created_at,
        profile:profiles!user_id(
          id,
          bio,
          avatar_url,
          website,
          location
        )
      `)
      .eq('id', userId)
      .single()
      .execute();
  }
  
  /**
   * Find user with paginated posts
   */
  async findUserWithPosts(
    userId: string, 
    options: { published?: boolean; limit?: number; offset?: number } = {}
  ) {
    const { published, limit = 10, offset = 0 } = options;
    
    let postsSelect = `posts:posts!author_id(
      id,
      title,
      content,
      published,
      created_at
    ).order(created_at.desc).limit(${limit}).offset(${offset})`;
    
    if (published !== undefined) {
      postsSelect += `.eq(published,${published})`;
    }
    
    return this.getQueryBuilder()
      .select(`
        id,
        email,
        first_name,
        last_name,
        ${postsSelect}
      `)
      .eq('id', userId)
      .single()
      .execute();
  }
  
  /**
   * Find users by tag (through posts)
   */
  async findUsersByTag(tagSlug: string) {
    return this.getQueryBuilder()
      .select(`
        id,
        email,
        first_name,
        last_name,
        tagged_posts:posts!author_id(
          id,
          title,
          post_tags:post_tags!post_id(
            tag:tags!tag_id(name, slug)
          ).eq(tags.slug,${tagSlug})
        ).eq(published,true)
      `)
      .execute();
  }
}

class PostRepository extends Repository<Post> {
  /**
   * Find post with full context
   */
  async findPostWithContext(postId: string) {
    return this.getQueryBuilder()
      .select(`
        id,
        title,
        content,
        published,
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
        ),
        tags:post_tags!post_id(
          tag:tags!tag_id(
            id,
            name,
            slug
          )
        ),
        comment_count:comments!post_id(count)
      `)
      .eq('id', postId)
      .single()
      .execute();
  }
  
  /**
   * Find posts with related content
   */
  async findRelatedPosts(postId: string, limit: number = 5) {
    // First get the current post's tags
    const currentPost = await this.getQueryBuilder()
      .select(`
        category_id,
        post_tags:post_tags!post_id(
          tag_id
        )
      `)
      .eq('id', postId)
      .single()
      .execute();
    
    if (!currentPost.data) return null;
    
    const tagIds = currentPost.data.post_tags.map(pt => pt.tag_id);
    
    // Find posts with similar tags or same category
    return this.getQueryBuilder()
      .select(`
        id,
        title,
        created_at,
        author:users!author_id(
          first_name,
          last_name
        )
      `)
      .neq('id', postId)
      .or(`category_id.eq.${currentPost.data.category_id},post_tags.tag_id.in.(${tagIds.join(',')})`)
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(limit)
      .execute();
  }
}

// Usage
async function useRelationshipHelpers() {
  const userRepo = dataManager.getCustomRepository(UserRepository, 'users');
  const postRepo = dataManager.getCustomRepository(PostRepository, 'posts');
  
  // Get user with profile
  const userWithProfile = await userRepo.findUserWithProfile('user-123');
  console.log('User with profile:', userWithProfile.data);
  
  // Get user with paginated posts
  const userWithPosts = await userRepo.findUserWithPosts('user-123', {
    published: true,
    limit: 5
  });
  console.log('User with posts:', userWithPosts.data);
  
  // Get post with full context
  const postWithContext = await postRepo.findPostWithContext('post-123');
  console.log('Post with context:', postWithContext.data);
  
  // Get related posts
  const relatedPosts = await postRepo.findRelatedPosts('post-123');
  console.log('Related posts:', relatedPosts?.data?.length);
}
```

## Performance Optimization

### Selective Loading

```tsx
async function selectiveLoading() {
  const postRepository = dataManager.getRepository<Post>('posts');
  
  // Load only needed relationship data
  const postsWithMinimalAuthor = await postRepository
    .getQueryBuilder()
    .select(`
      id,
      title,
      created_at,
      author:users!author_id(
        first_name,
        last_name
      )
    `)
    .eq('published', true)
    .limit(20)
    .execute();
  
  // Load with counts instead of full data for performance
  const postsWithCounts = await postRepository
    .getQueryBuilder()
    .select(`
      id,
      title,
      created_at,
      comment_count:comments!post_id(count),
      like_count:likes!post_id(count),
      tag_count:post_tags!post_id(count)
    `)
    .eq('published', true)
    .limit(20)
    .execute();
  
  console.log('Performance-optimized queries:', {
    minimal: postsWithMinimalAuthor.data?.length,
    counts: postsWithCounts.data?.length
  });
}
```

### Relationship Caching

```tsx
async function relationshipCaching() {
  const userRepository = dataManager.getRepository<User>('users');
  
  // Cache user data separately from posts for better cache efficiency
  const user = await userRepository.findById('user-123');
  
  if (user) {
    // Load posts separately (can be cached independently)
    const postRepository = dataManager.getRepository<Post>('posts');
    const userPosts = await postRepository.findBy({ author_id: user.id });
    
    // Combine data as needed
    const userWithPosts = {
      ...user,
      posts: userPosts
    };
    
    console.log('Cached approach:', userWithPosts);
  }
}
```

## Error Handling

### Relationship Error Patterns

```tsx
import { PostgRESTError } from 'pgrestify';

async function relationshipErrorHandling() {
  const postRepository = dataManager.getRepository<Post>('posts');
  
  try {
    const postWithAuthor = await postRepository
      .getQueryBuilder()
      .select(`
        id,
        title,
        author:users!author_id(
          first_name,
          last_name
        )
      `)
      .eq('id', 'post-123')
      .single()
      .execute();
    
    if (postWithAuthor.error) {
      throw postWithAuthor.error;
    }
    
    const post = postWithAuthor.data;
    
    if (!post) {
      throw new Error('Post not found');
    }
    
    if (!post.author) {
      console.warn('Post found but author is missing');
    }
    
    console.log('Post with author:', post);
    
  } catch (error) {
    if (error instanceof PostgRESTError) {
      if (error.statusCode === 404) {
        console.error('Post or related data not found');
      } else if (error.message.includes('foreign key')) {
        console.error('Invalid foreign key relationship');
      } else {
        console.error('PostgREST relationship error:', error.message);
      }
    } else {
      console.error('Application error:', error);
    }
  }
}
```

## Best Practices

### 1. Design Relationships for Performance

```tsx
// Good: Load minimal data needed
const efficientQuery = await postRepository
  .getQueryBuilder()
  .select(`
    id,
    title,
    author:users!author_id(first_name, last_name)
  `)
  .execute();

// Avoid: Loading unnecessary deep relationships
const inefficientQuery = await postRepository
  .getQueryBuilder()
  .select(`
    *,
    author:users!author_id(
      *,
      profile:profiles!user_id(*),
      posts:posts!author_id(*)
    )
  `)
  .execute();
```

### 2. Use Appropriate Loading Strategies

```tsx
// For list views: Load minimal relationship data
const postList = await postRepository
  .getQueryBuilder()
  .select(`
    id,
    title,
    created_at,
    author:users!author_id(first_name, last_name)
  `)
  .execute();

// For detail views: Load comprehensive relationship data
const postDetail = await postRepository
  .getQueryBuilder()
  .select(`
    id,
    title,
    content,
    created_at,
    author:users!author_id(
      id,
      first_name,
      last_name,
      profile:profiles!user_id(bio, avatar_url)
    ),
    comments:comments!post_id(
      id,
      content,
      created_at,
      author:users!author_id(first_name, last_name)
    ).limit(10)
  `)
  .eq('id', postId)
  .single()
  .execute();
```

### 3. Handle Missing Relationships Gracefully

```tsx
const safeRelationshipAccess = (post: any) => {
  const authorName = post.author 
    ? `${post.author.first_name} ${post.author.last_name}`
    : 'Unknown Author';
    
  const commentCount = post.comments?.length || 0;
  
  return {
    title: post.title,
    author: authorName,
    commentCount
  };
};
```

## Summary

PGRestify relationships provide:

- **Flexible Resource Embedding**: Load related data using PostgREST's powerful syntax
- **Deep Nesting**: Load multiple levels of relationships in single queries
- **Filtering and Ordering**: Apply filters and ordering to relationship data
- **Computed Relationships**: Use database functions for statistics and aggregations
- **Type Safety**: Full TypeScript support for relationship data
- **Performance Optimization**: Selective loading and caching strategies
- **Error Handling**: Robust handling of missing or invalid relationship data

This approach provides more flexibility than traditional SQL JOINs while maintaining excellent performance through PostgREST's optimized query execution.