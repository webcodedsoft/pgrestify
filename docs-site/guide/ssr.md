# Server-Side Rendering (SSR)

PGRestify provides comprehensive support for Server-Side Rendering across various frameworks, ensuring optimal performance and SEO.

## Next.js Integration

### Basic SSR Setup

```typescript
import { createClient } from '@webcoded/pgrestify';
import { GetServerSideProps } from 'next';

// Server-side client creation
const client = createClient('http://localhost:3000', {
  ssr: { enabled: true }
});

interface User {
  id: number;
  name: string;
  email: string;
}

function UserListPage({ users }: { users: User[] }) {
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  // Pre-fetch data on the server
  const users = await client
    .from<User>('users')
    .select('*')
    .eq('active', true)
    .execute();

  return {
    props: { users }
  };
};

export default UserListPage;
```

### Data Hydration

```typescript
import { createClient } from '@webcoded/pgrestify';
import { GetServerSideProps } from 'next';

function UserDetailPage({ user, initialData }) {
  // Hydrate client-side with server-fetched data
  const { data } = useQuery(
    ['user', user.id],
    () => client.from('users').select('*').eq('id', user.id).single(),
    { 
      initialData,
      staleTime: Infinity 
    }
  );

  return <div>{data.name}</div>;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const userId = context.params.id;
  
  const user = await client
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
    .execute();

  return {
    props: { 
      user,
      initialData: user
    }
  };
};
```

## Nuxt.js Integration

```typescript
// plugins/pgrestify.ts
import { createClient } from '@webcoded/pgrestify';

export default defineNuxtPlugin((nuxtApp) => {
  const client = createClient('http://localhost:3000', {
    ssr: { 
      enabled: true,
      mode: 'server' 
    }
  });

  // Provide client to Nuxt app
  nuxtApp.provide('pgrestify', client);
});

// pages/users.vue
<script setup>
const { $pgrestify } = useNuxtApp();

// Server-side fetch
const { data: users } = await useAsyncData('users', () => 
  $pgrestify
    .from('users')
    .select('*')
    .eq('active', true)
    .execute()
);
</script>
```

## React with Express SSR

```typescript
import express from 'express';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createClient } from '@webcoded/pgrestify';

const app = express();

app.get('/users', async (req, res) => {
  const client = createClient('http://localhost:3000', {
    ssr: { 
      enabled: true,
      mode: 'server'
    }
  });

  try {
    // Fetch data on the server
    const users = await client
      .from('users')
      .select('*')
      .eq('active', true)
      .execute();

    // Render React component with fetched data
    const html = renderToString(
      <UserList users={users} />
    );

    // Send HTML with initial data
    res.send(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="root">${html}</div>
          <script>
            window.__INITIAL_DATA__ = ${JSON.stringify(users)};
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Server error');
  }
});
```

## Client-Side Hydration

```typescript
// Client-side hydration
function App() {
  const client = createClient('http://localhost:3000', {
    ssr: {
      enabled: true,
      hydrate: true
    }
  });

  // Hydrate from server-side data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const initialData = window.__INITIAL_DATA__;
      if (initialData) {
        client.ssr.hydrateFromSSRData(initialData);
      }
    }
  }, []);

  return <UserList />;
}
```

## Advanced SSR Configuration

```typescript
const client = createClient('http://localhost:3000', {
  ssr: {
    // SSR-specific configuration
    enabled: true,
    mode: 'server', // 'server' | 'client' | 'hybrid'
    
    // Caching for SSR-fetched data
    cache: {
      enabled: true,
      ttl: 300000, // 5 minutes
    },
    
    // Custom serialization
    serialize: (data) => {
      // Custom data transformation before sending to client
      return JSON.stringify(data);
    },
    
    // Prefetch configuration
    prefetch: {
      enabled: true,
      queries: [
        { table: 'users', select: '*', filter: { active: true } }
      ]
    }
  }
});
```

## Performance Optimization

```typescript
// Optimize SSR data fetching
const users = await client
  .from('users')
  .select('id', 'name') // Select only necessary fields
  .eq('active', true)
  .limit(100) // Limit result set
  .execute();
```

## Error Handling in SSR

```typescript
try {
  const users = await client
    .from('users')
    .select('*')
    .execute();
} catch (error) {
  // Handle SSR-specific errors
  if (error.name === 'SSRFetchError') {
    // Log error, render fallback UI
    console.error('SSR data fetch failed', error);
  }
}
```

## Best Practices

- Minimize data transferred during SSR
- Use selective data fetching
- Implement proper error handling
- Cache SSR-fetched data
- Optimize initial page load
- Handle different rendering modes
- Secure sensitive data exposure

## Security Considerations

- Never expose sensitive data during SSR
- Use server-side filtering
- Implement role-based data access
- Sanitize and validate server-fetched data

## Framework-Specific Notes

- Next.js: Use `getServerSideProps` or `getStaticProps`
- Nuxt.js: Leverage `useAsyncData` and server plugins
- React: Use Express or similar SSR frameworks
- Always configure SSR mode appropriately

## Performance Implications

- Reduces initial page load time
- Improves SEO
- Provides better user experience
- Minimal overhead with smart configuration
- Supports various rendering strategies