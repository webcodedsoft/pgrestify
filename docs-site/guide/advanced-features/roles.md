# PostgreSQL Roles

PGRestify provides comprehensive support for PostgreSQL's role-based security model, allowing fine-grained access control.

## Role Types

PGRestify supports three primary role types:

1. **Anonymous**: Default unauthenticated access
2. **Authenticated**: Logged-in user access
3. **Admin**: Elevated privileges

## Creating Clients with Specific Roles

```typescript
import { createClient, PostgrestRole } from '@webcoded/pgrestify';

// Anonymous client (default)
const anonymousClient = createClient({
  url: 'http://localhost:3000',
  role: PostgrestRole.ANONYMOUS
});

// Authenticated client
const authenticatedClient = createClient({
  url: 'http://localhost:3000',
  role: PostgrestRole.AUTHENTICATED,
  token: 'user-jwt-token'
});

// Admin client
const adminClient = createClient({
  url: 'http://localhost:3000',
  role: PostgrestRole.ADMIN,
  token: 'admin-jwt-token'
});
```

## Dynamic Role Switching

```typescript
// Switch roles dynamically
await client.switchRole(PostgrestRole.AUTHENTICATED, 'new-jwt-token');

// Per-query role specification
const sensitiveData = await client
  .from('sensitive_table')
  .withRole(PostgrestRole.ADMIN)
  .select('*')
  .execute();
```

## Role-Based Query Restrictions

```typescript
// Different results based on role
const posts = await client
  .from('posts')
  .withRole(PostgrestRole.AUTHENTICATED)
  .select('*')
  .eq('published', true);

// Admin can see all posts
const allPosts = await client
  .from('posts')
  .withRole(PostgrestRole.ADMIN)
  .select('*');
```

## Authentication and Role Management

```typescript
// Sign in and automatically set authenticated role
const { data, error } = await client.auth.signIn({
  email: 'user@example.com',
  password: 'password123'
});

if (data.user) {
  // Client now uses authenticated role
  const userPosts = await client
    .from('posts')
    .eq('user_id', data.user.id)
    .find();
}
```

## Best Practices

- Always use the least privileged role necessary
- Implement role-based access control (RBAC) in your database
- Use JWT tokens for authentication
- Validate and refresh tokens regularly

## Error Handling

```typescript
try {
  const adminData = await client
    .from('admin_logs')
    .withRole(PostgrestRole.ADMIN)
    .select('*');
} catch (error) {
  if (error.name === 'AuthorizationError') {
    console.log('Insufficient permissions');
  }
}
```

## Custom Roles

```typescript
// Create a client with a custom role
const customRoleClient = createClient({
  url: 'http://localhost:3000',
  role: 'custom_role',
  token: 'custom-role-token'
});
```

## Security Considerations

- Never expose admin tokens in client-side code
- Use server-side middleware for role validation
- Implement additional authorization checks
- Rotate JWT tokens regularly

## Monitoring and Logging

```typescript
client.on('roleChanged', (newRole) => {
  console.log(`Role changed to: ${newRole}`);
});

client.on('authorizationError', (error) => {
  // Log unauthorized access attempts
  logSecurityEvent(error);
});
```

## Performance Impact

- Role switching is lightweight
- Minimal overhead for role-based queries
- Leverage PostgreSQL's native role system for best performance