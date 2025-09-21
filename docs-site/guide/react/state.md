# State Management

PGRestify provides comprehensive state management solutions for React applications, offering both built-in state management and integration with popular external libraries. This guide covers local state management, global state coordination, and best practices for handling server state.

## Overview

State management in PGRestify React applications involves several layers:

- **Server State**: Data from your PostgreSQL database via PostgREST
- **Client State**: Local UI state and user interactions  
- **Cache State**: Query results and optimistic updates
- **Form State**: Input values and validation states

## Built-in State Management

### Query State Management

PGRestify hooks automatically manage query state:

```typescript
import { useQuery } from '@webcoded/pgrestify/react';

function UserList() {
  const { 
    data, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useQuery('users', (client) => 
    client.from('users').select('*')
  );

  // State is automatically managed:
  // - Loading states
  // - Error handling
  // - Data caching
  // - Refetch capabilities

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
      <button onClick={() => refetch()}>Refresh</button>
    </div>
  );
}
```

### Mutation State Management

Mutations provide comprehensive state tracking:

```typescript
import { useMutation, useQueryClient } from '@webcoded/pgrestify/react';

function CreateUserForm() {
  const queryClient = useQueryClient();
  
  const createUser = useMutation({
    mutationFn: (userData) => 
      client.from('users').insert(userData).select().single(),
    onSuccess: (newUser) => {
      // Update cache automatically
      queryClient.setQueryData(['users'], (old) => [...(old || []), newUser]);
    },
    onError: (error) => {
      console.error('Failed to create user:', error);
    },
    onSettled: () => {
      // Always runs after success or error
      console.log('Mutation completed');
    }
  });

  const handleSubmit = (formData) => {
    createUser.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button 
        type="submit" 
        disabled={createUser.isLoading}
      >
        {createUser.isLoading ? 'Creating...' : 'Create User'}
      </button>
      {createUser.isError && (
        <div className="error">
          Error: {createUser.error.message}
        </div>
      )}
    </form>
  );
}
```

## Advanced State Patterns

### Global State with Context

Create a global state provider for shared data:

```typescript
// contexts/AppStateContext.tsx
import React, { createContext, useContext, useReducer } from 'react';

interface AppState {
  user: User | null;
  theme: 'light' | 'dark';
  filters: Record<string, unknown>;
  notifications: Notification[];
}

interface AppStateContextType {
  state: AppState;
  dispatch: React.Dispatch<AppStateAction>;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

type AppStateAction = 
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' }
  | { type: 'SET_FILTERS'; payload: Record<string, unknown> }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string };

function appStateReducer(state: AppState, action: AppStateAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_FILTERS':
      return { ...state, filters: action.payload };
    case 'ADD_NOTIFICATION':
      return { 
        ...state, 
        notifications: [...state.notifications, action.payload] 
      };
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload)
      };
    default:
      return state;
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appStateReducer, {
    user: null,
    theme: 'light',
    filters: {},
    notifications: []
  });

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
```

### Combined Server and Client State

Integrate server state with global client state:

```typescript
// hooks/useUserWithPreferences.ts
import { useQuery } from '@webcoded/pgrestify/react';
import { useAppState } from '../contexts/AppStateContext';

export function useUserWithPreferences(userId: string) {
  const { state, dispatch } = useAppState();
  
  const { data: user, ...queryState } = useQuery(
    ['user', userId],
    (client) => client.from('users').select('*').eq('id', userId).single()
  );
  
  const { data: preferences } = useQuery(
    ['user-preferences', userId],
    (client) => client.from('user_preferences').select('*').eq('user_id', userId).single(),
    { enabled: !!user }
  );
  
  // Sync server state with global state
  React.useEffect(() => {
    if (user && user.id === state.user?.id) {
      dispatch({ type: 'SET_USER', payload: user });
    }
  }, [user, dispatch, state.user?.id]);
  
  // Apply preferences to global theme
  React.useEffect(() => {
    if (preferences?.theme && preferences.theme !== state.theme) {
      dispatch({ type: 'SET_THEME', payload: preferences.theme });
    }
  }, [preferences, dispatch, state.theme]);
  
  return {
    user,
    preferences,
    ...queryState
  };
}
```

## State Synchronization

### Real-time State Updates

Sync state with real-time database changes:

```typescript
// hooks/useRealtimeState.ts
import { useQuery, useQueryClient } from '@webcoded/pgrestify/react';
import { useRealtime } from '@webcoded/pgrestify/react';

export function useRealtimeUserList() {
  const queryClient = useQueryClient();
  
  // Initial query
  const queryResult = useQuery('users', (client) =>
    client.from('users').select('*')
  );
  
  // Real-time subscription
  useRealtime('users', {
    event: '*',
    schema: 'public',
    table: 'users'
  }, (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    queryClient.setQueryData(['users'], (oldData: User[] = []) => {
      switch (eventType) {
        case 'INSERT':
          return [...oldData, newRecord as User];
        case 'UPDATE':
          return oldData.map(user => 
            user.id === newRecord.id ? newRecord as User : user
          );
        case 'DELETE':
          return oldData.filter(user => user.id !== oldRecord.id);
        default:
          return oldData;
      }
    });
  });
  
  return queryResult;
}
```

### Cross-Component State Sharing

Share state between components using custom hooks:

```typescript
// hooks/useSharedFilters.ts
import { useQueryClient } from '@webcoded/pgrestify/react';
import { useAppState } from '../contexts/AppStateContext';

export function useSharedFilters() {
  const { state, dispatch } = useAppState();
  const queryClient = useQueryClient();
  
  const setFilters = (filters: Record<string, unknown>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
    
    // Invalidate related queries when filters change
    queryClient.invalidateQueries(['filtered-data']);
  };
  
  const clearFilters = () => {
    dispatch({ type: 'SET_FILTERS', payload: {} });
    queryClient.invalidateQueries(['filtered-data']);
  };
  
  return {
    filters: state.filters,
    setFilters,
    clearFilters
  };
}

// Usage in components
function FilterBar() {
  const { filters, setFilters } = useSharedFilters();
  
  return (
    <div>
      <input 
        value={filters.search || ''}
        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
      />
      <select 
        value={filters.category || ''}
        onChange={(e) => setFilters({ ...filters, category: e.target.value })}
      >
        <option value="">All Categories</option>
        <option value="tech">Technology</option>
        <option value="design">Design</option>
      </select>
    </div>
  );
}

function FilteredList() {
  const { filters } = useSharedFilters();
  
  const { data } = useQuery(
    ['filtered-data', filters],
    (client) => {
      let query = client.from('posts').select('*');
      
      if (filters.search) {
        query = query.textSearch('title', filters.search);
      }
      
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      
      return query;
    }
  );
  
  return (
    <div>
      {data?.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
```

## Form State Management

### Controlled Forms with Validation

```typescript
// hooks/useFormState.ts
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@webcoded/pgrestify/react';

interface UseFormStateOptions<T> {
  initialValues: T;
  validationSchema?: (values: T) => Record<string, string>;
  onSubmit: (values: T) => Promise<unknown>;
}

export function useFormState<T extends Record<string, unknown>>({
  initialValues,
  validationSchema,
  onSubmit
}: UseFormStateOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  const mutation = useMutation({
    mutationFn: onSubmit,
    onSuccess: () => {
      setValues(initialValues);
      setErrors({});
      setTouched({});
    },
    onError: (error: any) => {
      if (error.details) {
        setErrors(error.details);
      }
    }
  });
  
  const setValue = useCallback((field: keyof T, value: unknown) => {
    setValues(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Clear error when user starts typing
    if (errors[field as string]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [errors]);
  
  const validate = useCallback(() => {
    if (!validationSchema) return true;
    
    const validationErrors = validationSchema(values);
    setErrors(validationErrors);
    
    return Object.keys(validationErrors).length === 0;
  }, [values, validationSchema]);
  
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    mutation.mutate(values);
  }, [values, validate, mutation]);
  
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    mutation.reset();
  }, [initialValues, mutation]);
  
  return {
    values,
    errors,
    touched,
    setValue,
    handleSubmit,
    reset,
    isSubmitting: mutation.isLoading,
    isSubmitted: mutation.isSuccess
  };
}

// Usage
function UserForm({ user, onSave }: { user?: User; onSave: (user: User) => Promise<User> }) {
  const form = useFormState({
    initialValues: user || { name: '', email: '' },
    validationSchema: (values) => {
      const errors: Record<string, string> = {};
      
      if (!values.name) {
        errors.name = 'Name is required';
      }
      
      if (!values.email) {
        errors.email = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(values.email)) {
        errors.email = 'Email is invalid';
      }
      
      return errors;
    },
    onSubmit: onSave
  });
  
  return (
    <form onSubmit={form.handleSubmit}>
      <div>
        <input
          type="text"
          value={form.values.name}
          onChange={(e) => form.setValue('name', e.target.value)}
          placeholder="Name"
        />
        {form.errors.name && <span className="error">{form.errors.name}</span>}
      </div>
      
      <div>
        <input
          type="email"
          value={form.values.email}
          onChange={(e) => form.setValue('email', e.target.value)}
          placeholder="Email"
        />
        {form.errors.email && <span className="error">{form.errors.email}</span>}
      </div>
      
      <button type="submit" disabled={form.isSubmitting}>
        {form.isSubmitting ? 'Saving...' : 'Save'}
      </button>
      
      <button type="button" onClick={form.reset}>
        Reset
      </button>
    </form>
  );
}
```

## State Persistence

### Local Storage Integration

```typescript
// hooks/usePersistentState.ts
import { useState, useEffect } from 'react';

export function usePersistentState<T>(
  key: string, 
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Could not save ${key} to localStorage:`, error);
    }
  }, [key, state]);
  
  return [state, setState];
}

// Usage
function UserPreferences() {
  const [theme, setTheme] = usePersistentState('theme', 'light');
  const [language, setLanguage] = usePersistentState('language', 'en');
  
  return (
    <div>
      <select value={theme} onChange={(e) => setTheme(e.target.value)}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
      
      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
        <option value="en">English</option>
        <option value="es">Spanish</option>
      </select>
    </div>
  );
}
```

### Session Storage Integration

```typescript
// hooks/useSessionState.ts
import { useState, useEffect } from 'react';

export function useSessionState<T>(
  key: string, 
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.warn(`Could not save ${key} to sessionStorage:`, error);
    }
  }, [key, state]);
  
  return [state, setState];
}

// Usage for temporary state that should persist across page refreshes
function FilterState() {
  const [filters, setFilters] = useSessionState('search-filters', {});
  
  // Filters persist during the session but reset when browser closes
  return (
    <div>
      <input 
        value={filters.search || ''}
        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
      />
    </div>
  );
}
```

## Error State Management

### Global Error Handling

```typescript
// contexts/ErrorContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';

interface ErrorContextType {
  errors: Error[];
  addError: (error: Error) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: React.ReactNode }) {
  const [errors, setErrors] = useState<(Error & { id: string })[]>([]);
  
  const addError = useCallback((error: Error) => {
    const errorWithId = { ...error, id: Date.now().toString() };
    setErrors(prev => [...prev, errorWithId]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setErrors(prev => prev.filter(e => e.id !== errorWithId.id));
    }, 5000);
  }, []);
  
  const removeError = useCallback((id: string) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  }, []);
  
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);
  
  return (
    <ErrorContext.Provider value={{ errors, addError, removeError, clearErrors }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useError() {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within ErrorProvider');
  }
  return context;
}

// Global error boundary
export function GlobalErrorDisplay() {
  const { errors, removeError } = useError();
  
  return (
    <div className="error-container">
      {errors.map(error => (
        <div key={error.id} className="error-toast">
          <span>{error.message}</span>
          <button onClick={() => removeError(error.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
```

## Performance Optimization

### State Normalization

```typescript
// utils/normalize.ts
export function normalizeById<T extends { id: string | number }>(items: T[]) {
  return items.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<string | number, T>);
}

export function denormalize<T>(
  normalizedData: Record<string | number, T>,
  ids: (string | number)[]
): T[] {
  return ids.map(id => normalizedData[id]).filter(Boolean);
}

// Usage
function useNormalizedUsers() {
  const { data: users = [] } = useQuery('users', (client) => 
    client.from('users').select('*')
  );
  
  return useMemo(() => ({
    byId: normalizeById(users),
    allIds: users.map(u => u.id)
  }), [users]);
}
```

### Selective Re-renders

```typescript
// hooks/useStableCallback.ts
import { useCallback, useRef } from 'react';

export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  
  return useCallback(((...args: Parameters<T>) => 
    callbackRef.current(...args)) as T, []);
}

// Prevent unnecessary re-renders
function OptimizedComponent() {
  const [count, setCount] = useState(0);
  
  // This callback won't cause child re-renders
  const handleIncrement = useStableCallback(() => {
    setCount(prev => prev + 1);
  });
  
  return <ChildComponent onIncrement={handleIncrement} />;
}
```

## Best Practices

### State Structure

```typescript
// Good: Flat state structure
interface AppState {
  user: User | null;
  posts: Post[];
  ui: {
    isLoading: boolean;
    error: string | null;
  };
}

// Avoid: Deeply nested state
interface BadAppState {
  data: {
    user: {
      profile: {
        settings: {
          theme: string;
        };
      };
    };
  };
}
```

### State Updates

```typescript
// Good: Immutable updates
setState(prev => ({ ...prev, user: newUser }));

// Good: Using functional updates
setCount(prev => prev + 1);

// Avoid: Direct mutation
state.user = newUser; // Don't do this
```

### State Composition

```typescript
// Good: Compose multiple hooks
function useUserDashboard(userId: string) {
  const user = useUser(userId);
  const posts = useUserPosts(userId);
  const analytics = useUserAnalytics(userId);
  
  return {
    user,
    posts,
    analytics,
    isLoading: user.isLoading || posts.isLoading || analytics.isLoading
  };
}

// Use composed state
function Dashboard({ userId }: { userId: string }) {
  const { user, posts, analytics, isLoading } = useUserDashboard(userId);
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <UserProfile user={user.data} />
      <PostsList posts={posts.data} />
      <Analytics data={analytics.data} />
    </div>
  );
}
```

## Next Steps

- [Server State Sync](./server-state.md) - Advanced server state synchronization
- [Optimistic Updates](./optimistic.md) - Implement optimistic UI updates
- [Real-time Integration](../advanced-features/realtime.md) - Real-time state updates