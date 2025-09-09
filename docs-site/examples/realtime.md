# Real-time Subscriptions Example

Comprehensive guide to real-time subscriptions in PGRestify.

## Basic Real-time Subscription

```typescript
import { createClient } from 'pgrestify';

// Define interfaces for type safety
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

interface Post {
  id: number;
  user_id: number;
  title: string;
  content: string;
  created_at: string;
}

// Create client with real-time enabled
const client = createClient('http://localhost:3000', {
  realtime: {
    enabled: true,
    url: 'ws://localhost:3000/realtime'
  }
});

// Connect to real-time service
async function connectRealtime() {
  try {
    await client.realtime.connect();
    console.log('Real-time connection established');
  } catch (error) {
    console.error('Real-time connection failed:', error);
  }
}

// Subscribe to user insertions
function subscribeToUserInserts() {
  const userInsertSub = client.realtime
    .from<User>('users')
    .onInsert((payload) => {
      console.log('New user created:', payload.new);
      updateUserList(payload.new);
    });

  return userInsertSub;
}

// Subscribe to user updates
function subscribeToUserUpdates() {
  const userUpdateSub = client.realtime
    .from<User>('users')
    .onUpdate((payload) => {
      console.log('User updated:');
      console.log('Previous data:', payload.old);
      console.log('New data:', payload.new);
      updateUserInList(payload.new);
    });

  return userUpdateSub;
}
```

## Filtered Subscriptions

```typescript
// Subscribe to active users only
function subscribeToActiveUsers() {
  const activeUsersSub = client.realtime
    .from<User>('users')
    .filter('active.eq.true')
    .onInsert((payload) => {
      console.log('New active user:', payload.new);
      addActiveUser(payload.new);
    });

  return activeUsersSub;
}

// Complex filtering
function subscribeToAdminPosts() {
  const adminPostsSub = client.realtime
    .from<Post>('posts')
    .filter('user.role.eq.admin AND created_at.gte.2023-01-01')
    .onAll((payload) => {
      switch (payload.eventType) {
        case 'INSERT':
          console.log('New admin post:', payload.new);
          break;
        case 'UPDATE':
          console.log('Admin post updated:', payload.new);
          break;
        case 'DELETE':
          console.log('Admin post deleted:', payload.old);
          break;
      }
    });

  return adminPostsSub;
}
```

## Nested Resource Subscriptions

```typescript
// Subscribe to posts with nested user information
function subscribeToPostsWithUsers() {
  const postsWithUsersSub = client.realtime
    .from<Post>('posts')
    .select(`
      id, 
      title, 
      content,
      user:users(id, name, email)
    `)
    .onAll((payload) => {
      console.log('Post change with user details:', payload);
    });

  return postsWithUsersSub;
}
```

## Global Event Listeners

```typescript
// Set up global real-time event listeners
function setupRealtimeListeners() {
  // Connection events
  client.realtime.on('connect', () => {
    console.log('Real-time connection established');
    updateConnectionStatus(true);
  });

  client.realtime.on('disconnect', (error) => {
    console.log('Real-time connection lost', error);
    updateConnectionStatus(false);
  });

  // Error handling
  client.realtime.on('error', (error) => {
    console.error('Real-time error:', error);
    handleRealtimeError(error);
  });
}
```

## Subscription Management

```typescript
// Manage multiple subscriptions
class RealtimeSubscriptionManager {
  private subscriptions: Array<{ unsubscribe: () => void }> = [];

  constructor(private client: Client) {}

  subscribe() {
    // User insert subscription
    const userInsertSub = this.client.realtime
      .from('users')
      .onInsert((payload) => {
        console.log('New user:', payload.new);
      });
    this.subscriptions.push(userInsertSub);

    // Post update subscription
    const postUpdateSub = this.client.realtime
      .from('posts')
      .onUpdate((payload) => {
        console.log('Post updated:', payload.new);
      });
    this.subscriptions.push(postUpdateSub);
  }

  unsubscribeAll() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }
}
```

## Advanced Configuration

```typescript
// Create client with advanced real-time configuration
const advancedClient = createClient('http://localhost:3000', {
  realtime: {
    // Connection settings
    url: 'ws://localhost:3000/realtime',
    
    // Reconnection strategy
    reconnect: {
      enabled: true,
      maxAttempts: 5,
      delay: (attempt) => Math.pow(2, attempt) * 1000,
      
      // Custom retry logic
      shouldRetry: (error) => 
        error.type !== 'AuthenticationError'
    },
    
    // Authentication
    auth: {
      token: 'jwt-token',
      refreshToken: true
    },
    
    // Heartbeat configuration
    heartbeat: {
      interval: 30000, // 30 seconds
      timeout: 5000    // 5 seconds
    }
  }
});
```

## Error Handling

```typescript
async function safeRealtimeSubscription() {
  try {
    const subscription = client.realtime
      .from('users')
      .onInsert((payload) => {
        console.log('New user:', payload.new);
      });

    // Optional: Handle subscription errors
    subscription.on('error', (error) => {
      console.error('Subscription error:', error);
      
      // Potential recovery mechanism
      if (error.code === 'UNAUTHORIZED') {
        refreshAuthToken();
      }
    });

    return subscription;
  } catch (error) {
    console.error('Subscription creation failed:', error);
    return null;
  }
}
```

## Performance and Scalability

```typescript
// Limit number of active subscriptions
function createScalableSubscription() {
  const MAX_SUBSCRIPTIONS = 10;
  let activeSubscriptions = 0;

  const safeSubscribe = (table: string) => {
    if (activeSubscriptions >= MAX_SUBSCRIPTIONS) {
      console.warn('Maximum subscriptions reached');
      return null;
    }
    
    const sub = client.realtime.from(table).onAll((payload) => {
      processRealtimePayload(payload);
    });
    
    activeSubscriptions++;
    
    sub.on('unsubscribe', () => {
      activeSubscriptions--;
    });
    
    return sub;
  };

  return safeSubscribe;
}
```

## Comprehensive Real-time Flow

```typescript
async function setupCompleteRealtimeSystem() {
  try {
    // Connect to real-time service
    await client.realtime.connect();

    // Set up global listeners
    setupRealtimeListeners();

    // Create subscription manager
    const subscriptionManager = new RealtimeSubscriptionManager(client);
    subscriptionManager.subscribe();

    // Subscribe to specific resources
    const activeUsersSub = subscribeToActiveUsers();
    const adminPostsSub = subscribeToAdminPosts();

    // Perform other real-time operations
    return {
      subscriptionManager,
      activeUsersSub,
      adminPostsSub
    };
  } catch (error) {
    console.error('Real-time setup failed:', error);
    return null;
  }
}
```

## Best Practices

- Minimize the number of active subscriptions
- Use filters to reduce unnecessary updates
- Handle connection and disconnection events
- Implement proper error handling
- Use type-safe subscriptions
- Monitor real-time connection health
- Implement reconnection strategies
- Validate and sanitize incoming data

## Performance Considerations

- Limit subscription complexity
- Use server-side filtering
- Minimize payload size
- Implement connection pooling
- Use efficient serialization
- Monitor real-time performance metrics

## Security Considerations

- Validate incoming real-time messages
- Implement rate limiting
- Use secure WebSocket connections
- Validate authentication for subscriptions
- Sanitize and validate payload data
- Monitor and log real-time events

## Troubleshooting

- Check WebSocket connectivity
- Verify authentication
- Monitor subscription errors
- Review payload validation
- Test with different network conditions
- Use logging and monitoring
- Validate server-side real-time configuration