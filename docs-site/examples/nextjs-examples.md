# Next.js Integration Examples

Complete examples for integrating PGRestify with Next.js applications using both App Router and Pages Router.

## Installation & Setup

```bash
npm install @webcoded/pgrestify
```

## App Router Examples (Next.js 13+)

### Client Configuration

```typescript
// lib/pgrestify.ts
import { createClient } from '@webcoded/pgrestify';

export const client = createClient({
  url: process.env.NEXT_PUBLIC_POSTGREST_URL || 'http://localhost:3000',
  auth: {
    persistSession: true,
    autoRefreshToken: true
  },
  cache: {
    enabled: true,
    ttl: 300000 // 5 minutes
  }
});
```

### Server Components with Repository Pattern

```tsx
// app/users/page.tsx (Server Component)
import { client } from '@/lib/pgrestify';

interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

export default async function UsersPage() {
  // Server-side data fetching with repository pattern
  const userRepo = client.getRepository<User>('users');
  
  const users = await userRepo
    .createQueryBuilder()
    .where('active = :active', { active: true })
    .orderBy('created_at', 'DESC')
    .limit(50)
    .getMany();

  return (
    <div>
      <h1>Users</h1>
      <div className="grid gap-4">
        {users.map(user => (
          <div key={user.id} className="p-4 border rounded">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
            <small>Joined: {new Date(user.created_at).toLocaleDateString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Server Components with PostgREST Syntax

```tsx
// app/posts/page.tsx (Server Component)
import { client } from '@/lib/pgrestify';

interface Post {
  id: number;
  title: string;
  content: string;
  published: boolean;
  author: {
    name: string;
    email: string;
  };
}

export default async function PostsPage() {
  // Server-side data fetching with PostgREST syntax
  const { data: posts, error } = await client
    .from('posts')
    .select(`
      id,
      title,
      content,
      published,
      author:users!posts_author_id_fkey(name, email)
    `)
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(20)
    .execute();

  if (error) {
    console.error('Failed to fetch posts:', error);
    return <div>Failed to load posts</div>;
  }

  return (
    <div>
      <h1>Latest Posts</h1>
      <div className="space-y-6">
        {posts?.map(post => (
          <article key={post.id} className="p-6 border rounded-lg">
            <h2 className="text-2xl font-bold mb-2">{post.title}</h2>
            <p className="text-gray-600 mb-4">{post.content}</p>
            <div className="text-sm text-gray-500">
              By {post.author.name}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
```

### Client Components with Hooks

```tsx
// app/components/UserProfile.tsx (Client Component)
'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@webcoded/pgrestify/react';
import { client } from '@/lib/pgrestify';

interface User {
  id: number;
  name: string;
  email: string;
  bio?: string;
}

export default function UserProfile({ userId }: { userId: number }) {
  const [isEditing, setIsEditing] = useState(false);

  // Fetch user data
  const { 
    data: user, 
    loading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const userRepo = client.getRepository<User>('users');
      return await userRepo.findOne({ id: userId });
    },
    enabled: !!userId
  });

  // Update user mutation
  const { 
    mutate: updateUser, 
    loading: updating 
  } = useMutation({
    mutationFn: async (updates: Partial<User>) => {
      const userRepo = client.getRepository<User>('users');
      return await userRepo.update({ id: userId }, updates);
    },
    onSuccess: () => {
      setIsEditing(false);
      refetch();
    }
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div className="p-6 border rounded-lg">
      {isEditing ? (
        <EditForm 
          user={user} 
          onSave={updateUser}
          onCancel={() => setIsEditing(false)}
          loading={updating}
        />
      ) : (
        <DisplayMode 
          user={user} 
          onEdit={() => setIsEditing(true)} 
        />
      )}
    </div>
  );
}

function DisplayMode({ user, onEdit }: { user: User; onEdit: () => void }) {
  return (
    <div>
      <h2 className="text-xl font-bold">{user.name}</h2>
      <p className="text-gray-600">{user.email}</p>
      {user.bio && <p className="mt-2">{user.bio}</p>}
      <button 
        onClick={onEdit}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Edit Profile
      </button>
    </div>
  );
}

function EditForm({ 
  user, 
  onSave, 
  onCancel, 
  loading 
}: { 
  user: User; 
  onSave: (updates: Partial<User>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: user.name,
    bio: user.bio || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="mt-1 block w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Bio</label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            className="mt-1 block w-full border rounded px-3 py-2"
            rows={3}
          />
        </div>
        <div className="flex gap-2">
          <button 
            type="submit" 
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button 
            type="button" 
            onClick={onCancel}
            className="px-4 py-2 bg-gray-500 text-white rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
```

### API Routes

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { client } from '@/lib/pgrestify';

// GET /api/users
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search');

    const userRepo = client.getRepository('users');
    let query = userRepo
      .createQueryBuilder()
      .where('active = :active', { active: true });

    if (search) {
      query = query.andWhere(
        '(name ILIKE :search OR email ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    const [users, total] = await query
      .orderBy('created_at', 'DESC')
      .limit(limit)
      .offset((page - 1) * limit)
      .getManyAndCount();

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/users
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, bio } = body;

    // Validation
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    const userRepo = client.getRepository('users');
    
    // Check if email already exists
    const existingUser = await userRepo.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    const newUser = await userRepo.save({
      name,
      email,
      bio,
      active: true,
      created_at: new Date().toISOString()
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Failed to create user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
```

### Dynamic API Routes

```typescript
// app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { client } from '@/lib/pgrestify';

// GET /api/users/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = parseInt(params.id);
    
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const userRepo = client.getRepository('users');
    const user = await userRepo.findOne({ id: userId });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PATCH /api/users/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = parseInt(params.id);
    const updates = await request.json();

    const userRepo = client.getRepository('users');
    const updatedUser = await userRepo.update(
      { id: userId },
      { ...updates, updated_at: new Date().toISOString() }
    );

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = parseInt(params.id);

    const userRepo = client.getRepository('users');
    await userRepo.delete({ id: userId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
```

## Pages Router Examples (Next.js 12 and below)

### SSG (Static Site Generation)

```tsx
// pages/posts/index.tsx
import { GetStaticProps } from 'next';
import { client } from '@/lib/pgrestify';

interface Post {
  id: number;
  title: string;
  content: string;
  published_at: string;
  author: {
    name: string;
  };
}

interface PostsPageProps {
  posts: Post[];
}

export default function PostsPage({ posts }: PostsPageProps) {
  return (
    <div>
      <h1>All Posts</h1>
      <div className="space-y-6">
        {posts.map(post => (
          <article key={post.id} className="p-6 border rounded">
            <h2>{post.title}</h2>
            <p>{post.content}</p>
            <small>By {post.author.name}</small>
          </article>
        ))}
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    // Fetch posts at build time
    const { data: posts } = await client
      .from('posts')
      .select(`
        id,
        title,
        content,
        published_at,
        author:users!posts_author_id_fkey(name)
      `)
      .eq('published', true)
      .order('published_at', { ascending: false })
      .execute();

    return {
      props: {
        posts: posts || []
      },
      revalidate: 3600 // Revalidate every hour
    };
  } catch (error) {
    console.error('Failed to fetch posts:', error);
    return {
      props: {
        posts: []
      }
    };
  }
};
```

### SSR (Server-Side Rendering)

```tsx
// pages/users/[id].tsx
import { GetServerSideProps } from 'next';
import { client } from '@/lib/pgrestify';

interface User {
  id: number;
  name: string;
  email: string;
  bio?: string;
  posts: Array<{
    id: number;
    title: string;
    published: boolean;
  }>;
}

interface UserPageProps {
  user: User | null;
  error?: string;
}

export default function UserPage({ user, error }: UserPageProps) {
  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!user) {
    return <div>User not found</div>;
  }

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
      {user.bio && <p>{user.bio}</p>}
      
      <h2>Posts</h2>
      <ul>
        {user.posts.map(post => (
          <li key={post.id}>
            {post.title} {post.published ? '✅' : '❌'}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const { id } = context.params!;
    const userId = parseInt(id as string);

    if (isNaN(userId)) {
      return {
        props: {
          user: null,
          error: 'Invalid user ID'
        }
      };
    }

    // Fetch user with posts using repository pattern
    const userRepo = client.getRepository<User>('users');
    const user = await userRepo
      .createQueryBuilder()
      .leftJoinAndSelect('posts', 'post')
      .where('id = :id', { id: userId })
      .getOne();

    return {
      props: {
        user: user || null
      }
    };
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return {
      props: {
        user: null,
        error: 'Failed to fetch user'
      }
    };
  }
};
```

### API Routes (Pages Router)

```typescript
// pages/api/posts.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { client } from '@/lib/pgrestify';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    try {
      const { published, author_id, page = 1, limit = 10 } = req.query;

      const postRepo = client.getRepository('posts');
      let query = postRepo.createQueryBuilder();

      if (published !== undefined) {
        query = query.where('published = :published', { 
          published: published === 'true' 
        });
      }

      if (author_id) {
        query = query.andWhere('author_id = :authorId', { 
          authorId: parseInt(author_id as string) 
        });
      }

      const [posts, total] = await query
        .leftJoinAndSelect('users', 'author')
        .orderBy('created_at', 'DESC')
        .limit(parseInt(limit as string))
        .offset((parseInt(page as string) - 1) * parseInt(limit as string))
        .getManyAndCount();

      res.status(200).json({
        posts,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      console.error('Failed to fetch posts:', error);
      res.status(500).json({ error: 'Failed to fetch posts' });
    }
  } else if (req.method === 'POST') {
    try {
      const { title, content, author_id } = req.body;

      if (!title || !content || !author_id) {
        return res.status(400).json({ 
          error: 'Title, content, and author_id are required' 
        });
      }

      const postRepo = client.getRepository('posts');
      const newPost = await postRepo.save({
        title,
        content,
        author_id,
        published: false,
        created_at: new Date().toISOString()
      });

      res.status(201).json(newPost);
    } catch (error) {
      console.error('Failed to create post:', error);
      res.status(500).json({ error: 'Failed to create post' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
```

## Advanced Patterns

### Real-time Updates with Subscriptions

```tsx
// components/LivePostFeed.tsx
'use client';

import { useEffect, useState } from 'react';
import { client } from '@/lib/pgrestify';

interface Post {
  id: number;
  title: string;
  content: string;
  author: { name: string };
}

export default function LivePostFeed() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    // Subscribe to new posts
    const subscription = client
      .from('posts')
      .on('INSERT', (payload) => {
        console.log('New post:', payload.new);
        setPosts(prev => [payload.new as Post, ...prev]);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div>
      <h2>Live Post Feed</h2>
      <div className="space-y-4">
        {posts.map(post => (
          <div key={post.id} className="p-4 border rounded">
            <h3>{post.title}</h3>
            <p>{post.content}</p>
            <small>By {post.author.name}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Authentication with Next.js

```tsx
// hooks/useAuth.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { client } from '@/lib/pgrestify';

interface AuthContextType {
  user: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    client.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = client.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    setUser(data.user);
  };

  const signOut = async () => {
    const { error } = await client.auth.signOut();
    if (error) throw error;
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

## Environment Configuration

```bash
# .env.local
NEXT_PUBLIC_POSTGREST_URL=http://localhost:3000
POSTGREST_ANON_KEY=your-anon-key
POSTGREST_SERVICE_KEY=your-service-key
```

## Best Practices

### 1. Type Safety
```typescript
// Define your database schema types
interface Database {
  users: User;
  posts: Post;
  comments: Comment;
}

// Use typed client
const typedClient = createClient<Database>({
  url: process.env.NEXT_PUBLIC_POSTGREST_URL!
});
```

### 2. Error Boundaries
```tsx
// components/ErrorBoundary.tsx
'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Something went wrong.</div>;
    }

    return this.props.children;
  }
}
```

### 3. Loading States
```tsx
// components/LoadingSpinner.tsx
export function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  );
}
```

This comprehensive guide demonstrates:
- ✅ Both App Router and Pages Router examples
- ✅ Server Components and Client Components
- ✅ SSG, SSR, and ISR patterns
- ✅ API Routes with both syntaxes
- ✅ Real-time subscriptions
- ✅ Authentication integration
- ✅ Error handling and loading states
- ✅ TypeScript best practices
- ✅ Performance optimization techniques