# Real-time API Reference

Comprehensive API documentation for PGRestify's Real-time Subscription mechanisms.

## Basic Real-time Interface

```typescript
interface RealtimeService {
  // Connection methods
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  // Subscription methods
  from<T>(tableName: string): RealtimeChannel<T>;
  
  // Global event listeners
  on(event: RealtimeEvent, callback: RealtimeEventCallback): Unsubscribe;
  
  // Subscription management
  unsubscribeAll(): void;
}

interface RealtimeChannel<T> {
  // Event subscription methods
  onInsert(callback: (payload: InsertPayload<T>) => void): Subscription;
  onUpdate(callback: (payload: UpdatePayload<T>) => void): Subscription;
  onDelete(callback: (payload: DeletePayload<T>) => void): Subscription;
  onAll(callback: (payload: ChangePayload<T>) => void): Subscription;
  
  // Filtering methods
  filter(filterExpression: string): RealtimeChannel<T>;
  
  // Unsubscribe method
  unsubscribe(): void;
}
```

## Payload Interfaces

```typescript
interface BasePayload<T> {
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  timestamp: number;
}

interface InsertPayload<T> extends BasePayload<T> {
  new: T;
}

interface UpdatePayload<T> extends BasePayload<T> {
  old: Partial<T>;
  new: T;
}

interface DeletePayload<T> extends BasePayload<T> {
  old: T;
}

type ChangePayload<T> = 
  | InsertPayload<T> 
  | UpdatePayload<T> 
  | DeletePayload<T>;
```

## Connection Management

```typescript
// Connect to real-time service
await client.realtime.connect();

// Disconnect from real-time service
await client.realtime.disconnect();

// Check connection status
const isConnected = client.realtime.connected;
```

## Basic Subscriptions

```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

// Subscribe to user insertions
const userInsertSub = client.realtime
  .from<User>('users')
  .onInsert((payload) => {
    console.log('New user created:', payload.new);
  });

// Subscribe to user updates
const userUpdateSub = client.realtime
  .from<User>('users')
  .onUpdate((payload) => {
    console.log('User updated:');
    console.log('Previous data:', payload.old);
    console.log('New data:', payload.new);
  });

// Subscribe to user deletions
const userDeleteSub = client.realtime
  .from<User>('users')
  .onDelete((payload) => {
    console.log('User deleted:', payload.old);
  });
```

## All Events Subscription

```typescript
// Subscribe to all changes in a table
const allChangesSub = client.realtime
  .from<User>('users')
  .onAll((payload) => {
    switch (payload.eventType) {
      case 'INSERT':
        console.log('User inserted:', payload.new);
        break;
      case 'UPDATE':
        console.log('User updated:', payload.new);
        break;
      case 'DELETE':
        console.log('User deleted:', payload.old);
        break;
    }
  });
```

## Filtered Subscriptions

```typescript
// Filter subscriptions
const filteredSub = client.realtime
  .from<User>('users')
  .filter('active.eq.true')
  .onInsert((payload) => {
    console.log('New active user:', payload.new);
  });

// Complex filtering
const complexFilterSub = client.realtime
  .from<User>('users')
  .filter('age.gte.18 AND role.eq.customer')
  .onAll((payload) => {
    console.log('Change in adult customer users:', payload);
  });
```

## Global Event Listeners

```typescript
// Listen to connection events
client.realtime.on('connect', () => {
  console.log('Real-time connection established');
});

client.realtime.on('disconnect', (error) => {
  console.log('Real-time connection lost', error);
});

client.realtime.on('error', (error) => {
  console.error('Real-time error:', error);
});
```

## Subscription Management

```typescript
// Store subscriptions
const userSub = client.realtime.from('users').onInsert(handleUserInsert);
const postSub = client.realtime.from('posts').onUpdate(handlePostUpdate);

// Unsubscribe from specific subscription
userSub.unsubscribe();

// Unsubscribe from all subscriptions
client.realtime.unsubscribeAll();
```

## Advanced Configuration

```typescript
const client = createClient({
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
try {
  const subscription = client.realtime
    .from('users')
    .onInsert((payload) => {
      console.log('New user:', payload.new);
    });
} catch (error) {
  if (error.name === 'RealtimeError') {
    console.error('Subscription failed:', error.message);
    
    // Handle specific error types
    switch (error.code) {
      case 'UNAUTHORIZED':
        // Handle authentication issues
        break;
      case 'CONNECTION_FAILED':
        // Handle connection problems
        break;
    }
  }
}
```

## Performance and Scalability

```typescript
// Limit number of active subscriptions
const maxSubscriptions = 10;
let activeSubscriptions = 0;

const safeSubscribe = (table: string) => {
  if (activeSubscriptions >= maxSubscriptions) {
    console.warn('Maximum subscriptions reached');
    return null;
  }
  
  const sub = client.realtime.from(table).onAll((payload) => {
    // Handle payload
  });
  
  activeSubscriptions++;
  
  // Track subscription lifecycle
  sub.on('unsubscribe', () => {
    activeSubscriptions--;
  });
  
  return sub;
};
```

## Security Considerations

```typescript
const client = createClient({
  realtime: {
    // Security configuration
    security: {
      // Validate incoming messages
      validatePayload: (payload) => {
        // Implement custom payload validation
        return isValidRealtimePayload(payload);
      },
      
      // Rate limit subscriptions
      rateLimit: {
        maxSubscriptionsPerMinute: 100,
        maxEventsPerSecond: 50
      }
    }
  }
});
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

## Troubleshooting

- Check WebSocket connectivity
- Verify authentication
- Monitor subscription errors
- Review payload validation
- Test with different network conditions
- Use logging and monitoring
- Validate server-side real-time configuration