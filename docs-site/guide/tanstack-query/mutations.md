# Mutations

PGRestify provides pre-built mutation factories for TanStack Query that handle insert, update, delete, and upsert operations with PostgREST APIs. These mutations include automatic cache management, optimistic updates, and error handling optimized for database operations.

## Overview

Mutation factories provide:

- **Pre-configured mutation options** for CRUD operations
- **Automatic cache invalidation** and updates
- **Optimistic update patterns** for better UX
- **Type-safe mutation variables** with full TypeScript support
- **Error handling** optimized for PostgREST responses
- **Success callbacks** for cache management

## Basic Mutation Factory

### Creating Mutation Factories

Create mutation factories for any table:

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPostgRESTMutations } from 'pgrestify/tanstack-query';
import { createClient } from 'pgrestify';

interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

const client = createClient({ url: 'http://localhost:3000' });
const userMutations = createPostgRESTMutations<User>(client, 'users');
```

### Available Mutation Methods

The factory provides these pre-built mutation configurations:

```tsx
// CRUD mutations
userMutations.insert(options)    // Create new records
userMutations.update(options)    // Update existing records
userMutations.delete(options)    // Delete records
userMutations.upsert(options)    // Insert or update records
```

## Insert Mutations

### Basic Insert

Create new records with automatic cache management:

```tsx
function CreateUserForm() {
  const queryClient = useQueryClient();
  
  const createUser = useMutation({
    ...userMutations.insert({
      onSuccess: (data, variables) => {
        // Invalidate user list to refetch
        queryClient.invalidateQueries({ 
          queryKey: ['pgrestify', 'tables', 'users'] 
        });
        
        console.log('User created:', data.data);
      },
      onError: (error) => {
        console.error('Failed to create user:', error.message);
      }
    })
  });

  const handleSubmit = async (formData: Partial<User>) => {
    try {
      await createUser.mutateAsync({
        name: formData.name,
        email: formData.email,
        active: true
      });
      
      // Form submitted successfully
      alert('User created successfully!');
    } catch (error) {
      // Error is already handled by onError
      alert('Failed to create user');
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      handleSubmit({
        name: formData.get('name') as string,
        email: formData.get('email') as string
      });
    }}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <button type="submit" disabled={createUser.isPending}>
        {createUser.isPending ? 'Creating...' : 'Create User'}
      </button>
    </form>
  );
}
```

### Bulk Insert

Insert multiple records at once:

```tsx
function BulkUserImport() {
  const queryClient = useQueryClient();
  
  const bulkCreateUsers = useMutation({
    ...userMutations.insert({
      onSuccess: (data) => {
        const createdCount = data.data?.length || 0;
        queryClient.invalidateQueries({ 
          queryKey: ['pgrestify', 'tables', 'users'] 
        });
        
        alert(`Successfully created ${createdCount} users`);
      }
    })
  });

  const handleBulkImport = (users: Partial<User>[]) => {
    bulkCreateUsers.mutate(users);
  };

  const importSampleUsers = () => {
    const sampleUsers = [
      { name: 'John Doe', email: 'john@example.com', active: true },
      { name: 'Jane Smith', email: 'jane@example.com', active: true },
      { name: 'Bob Wilson', email: 'bob@example.com', active: false }
    ];
    
    handleBulkImport(sampleUsers);
  };

  return (
    <div>
      <button 
        onClick={importSampleUsers}
        disabled={bulkCreateUsers.isPending}
      >
        {bulkCreateUsers.isPending ? 'Importing...' : 'Import Sample Users'}
      </button>
    </div>
  );
}
```

### Optimistic Insert

Add optimistic updates for better user experience:

```tsx
function OptimisticUserCreate() {
  const queryClient = useQueryClient();
  
  const createUser = useMutation({
    ...userMutations.insert({
      onMutate: async (newUser) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ 
          queryKey: ['pgrestify', 'tables', 'users'] 
        });

        // Snapshot previous value
        const previousUsers = queryClient.getQueryData(['pgrestify', 'tables', 'users', 'data', undefined]);

        // Optimistically update the cache
        queryClient.setQueryData(
          ['pgrestify', 'tables', 'users', 'data', undefined],
          (old: any) => {
            if (!old) return old;
            
            const optimisticUser = {
              id: `temp-${Date.now()}`,  // Temporary ID
              ...newUser,
              created_at: new Date().toISOString()
            };

            return {
              ...old,
              data: [...(old.data || []), optimisticUser]
            };
          }
        );

        return { previousUsers };
      },
      
      onError: (error, variables, context) => {
        // Rollback on error
        if (context?.previousUsers) {
          queryClient.setQueryData(
            ['pgrestify', 'tables', 'users', 'data', undefined],
            context.previousUsers
          );
        }
      },
      
      onSettled: () => {
        // Refetch after mutation
        queryClient.invalidateQueries({ 
          queryKey: ['pgrestify', 'tables', 'users'] 
        });
      }
    })
  });

  return (
    <button onClick={() => createUser.mutate({ 
      name: 'New User', 
      email: 'new@example.com' 
    })}>
      Add User (Optimistic)
    </button>
  );
}
```

## Update Mutations

### Basic Update

Update existing records with where conditions:

```tsx
function UpdateUserForm({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  
  const updateUser = useMutation({
    ...userMutations.update({
      onSuccess: (data, variables) => {
        // Update specific user in cache
        queryClient.setQueryData(
          ['pgrestify', 'tables', 'users', 'item', userId],
          data
        );
        
        // Also invalidate list views
        queryClient.invalidateQueries({ 
          queryKey: ['pgrestify', 'tables', 'users', 'data'] 
        });
        
        alert('User updated successfully!');
      }
    })
  });

  const handleUpdate = (updates: Partial<User>) => {
    updateUser.mutate({
      where: { id: userId },
      values: updates
    });
  };

  return (
    <div>
      <button onClick={() => handleUpdate({ active: false })}>
        Deactivate User
      </button>
      
      <button onClick={() => handleUpdate({ 
        name: 'Updated Name',
        updated_at: new Date().toISOString()
      })}>
        Update Name
      </button>
    </div>
  );
}
```

### Conditional Updates

Update records based on multiple conditions:

```tsx
function BulkStatusUpdate() {
  const updateInactiveUsers = useMutation({
    ...userMutations.update({
      onSuccess: (data) => {
        const updatedCount = data.data?.length || 0;
        queryClient.invalidateQueries({ 
          queryKey: ['pgrestify', 'tables', 'users'] 
        });
        
        alert(`Updated ${updatedCount} inactive users`);
      }
    })
  });

  const activateInactiveUsers = () => {
    updateInactiveUsers.mutate({
      where: { 
        active: false,
        // Only update users inactive for more than 30 days
        last_login: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
      },
      values: {
        active: true,
        reactivated_at: new Date().toISOString()
      }
    });
  };

  return (
    <button onClick={activateInactiveUsers}>
      Reactivate Inactive Users
    </button>
  );
}
```

### Optimistic Updates

Implement optimistic updates for better UX:

```tsx
function UserStatusToggle({ user }: { user: User }) {
  const queryClient = useQueryClient();
  
  const toggleStatus = useMutation({
    ...userMutations.update({
      onMutate: async ({ values }) => {
        const queryKey = ['pgrestify', 'tables', 'users', 'item', user.id];
        
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey });

        // Snapshot previous value
        const previousUser = queryClient.getQueryData(queryKey);

        // Optimistically update
        queryClient.setQueryData(queryKey, (old: any) => {
          if (!old) return old;
          return {
            ...old,
            data: { ...old.data, ...values }
          };
        });

        return { previousUser };
      },
      
      onError: (error, variables, context) => {
        // Rollback on error
        if (context?.previousUser) {
          queryClient.setQueryData(
            ['pgrestify', 'tables', 'users', 'item', user.id],
            context.previousUser
          );
        }
      }
    })
  });

  const handleToggle = () => {
    toggleStatus.mutate({
      where: { id: user.id },
      values: { active: !user.active }
    });
  };

  return (
    <button onClick={handleToggle} disabled={toggleStatus.isPending}>
      {user.active ? 'Deactivate' : 'Activate'}
    </button>
  );
}
```

## Delete Mutations

### Basic Delete

Delete records with automatic cache cleanup:

```tsx
function DeleteUserButton({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  
  const deleteUser = useMutation({
    ...userMutations.delete({
      onSuccess: (data, variables) => {
        // Remove from specific user cache
        queryClient.removeQueries({ 
          queryKey: ['pgrestify', 'tables', 'users', 'item', userId] 
        });
        
        // Remove from list cache
        queryClient.setQueriesData(
          { queryKey: ['pgrestify', 'tables', 'users', 'data'] },
          (oldData: any) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              data: oldData.data.filter((user: User) => user.id !== userId)
            };
          }
        );
        
        alert('User deleted successfully');
      }
    })
  });

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this user?')) {
      deleteUser.mutate({ id: userId });
    }
  };

  return (
    <button 
      onClick={handleDelete} 
      disabled={deleteUser.isPending}
      style={{ color: 'red' }}
    >
      {deleteUser.isPending ? 'Deleting...' : 'Delete User'}
    </button>
  );
}
```

### Bulk Delete

Delete multiple records:

```tsx
function BulkDeleteUsers() {
  const queryClient = useQueryClient();
  
  const bulkDelete = useMutation({
    ...userMutations.delete({
      onSuccess: (data) => {
        const deletedCount = data.data?.length || 0;
        
        // Invalidate all user queries
        queryClient.invalidateQueries({ 
          queryKey: ['pgrestify', 'tables', 'users'] 
        });
        
        alert(`Successfully deleted ${deletedCount} users`);
      }
    })
  });

  const deleteInactiveUsers = () => {
    if (confirm('Delete all inactive users? This cannot be undone.')) {
      bulkDelete.mutate({ active: false });
    }
  };

  return (
    <button onClick={deleteInactiveUsers} style={{ color: 'red' }}>
      Delete Inactive Users
    </button>
  );
}
```

## Upsert Mutations

### Basic Upsert

Insert new records or update existing ones:

```tsx
function UpsertUserForm() {
  const queryClient = useQueryClient();
  
  const upsertUser = useMutation({
    ...userMutations.upsert({
      onSuccess: (data) => {
        // Invalidate all user queries to refresh the data
        queryClient.invalidateQueries({ 
          queryKey: ['pgrestify', 'tables', 'users'] 
        });
        
        const action = data.data?.[0]?.created_at === data.data?.[0]?.updated_at 
          ? 'created' : 'updated';
        alert(`User ${action} successfully!`);
      }
    })
  });

  const handleUpsert = (userData: Partial<User>) => {
    upsertUser.mutate({
      email: userData.email,  // Unique constraint for upsert
      name: userData.name,
      active: userData.active ?? true,
      updated_at: new Date().toISOString()
    });
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      handleUpsert({
        email: formData.get('email') as string,
        name: formData.get('name') as string,
        active: formData.get('active') === 'on'
      });
    }}>
      <input name="email" type="email" placeholder="Email (unique)" required />
      <input name="name" placeholder="Name" required />
      <label>
        <input name="active" type="checkbox" defaultChecked />
        Active
      </label>
      <button type="submit" disabled={upsertUser.isPending}>
        {upsertUser.isPending ? 'Saving...' : 'Save User'}
      </button>
    </form>
  );
}
```

### Batch Upsert

Upsert multiple records at once:

```tsx
function BatchUpsertUsers() {
  const batchUpsert = useMutation({
    ...userMutations.upsert({
      onSuccess: (data) => {
        const processedCount = data.data?.length || 0;
        queryClient.invalidateQueries({ 
          queryKey: ['pgrestify', 'tables', 'users'] 
        });
        
        alert(`Processed ${processedCount} users`);
      }
    })
  });

  const syncUsers = () => {
    const usersToSync = [
      { email: 'admin@example.com', name: 'Administrator', active: true },
      { email: 'editor@example.com', name: 'Content Editor', active: true },
      { email: 'viewer@example.com', name: 'Viewer', active: false }
    ];

    batchUpsert.mutate(usersToSync);
  };

  return (
    <button onClick={syncUsers} disabled={batchUpsert.isPending}>
      {batchUpsert.isPending ? 'Syncing...' : 'Sync Default Users'}
    </button>
  );
}
```

## Advanced Mutation Patterns

### Form Integration

Integrate mutations with form libraries:

```tsx
import { useForm } from 'react-hook-form';

function UserForm({ userId }: { userId?: string }) {
  const { register, handleSubmit, reset } = useForm<User>();
  const queryClient = useQueryClient();
  
  const createUser = useMutation({ ...userMutations.insert() });
  const updateUser = useMutation({ ...userMutations.update() });
  
  const isEditing = !!userId;
  const mutation = isEditing ? updateUser : createUser;

  const onSubmit = (data: User) => {
    if (isEditing) {
      updateUser.mutate({
        where: { id: userId },
        values: data
      });
    } else {
      createUser.mutate(data);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} placeholder="Name" required />
      <input {...register('email')} type="email" placeholder="Email" required />
      <label>
        <input {...register('active')} type="checkbox" />
        Active
      </label>
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
      </button>
    </form>
  );
}
```

### Error Recovery

Implement comprehensive error handling:

```tsx
function ResilientUserMutation() {
  const createUser = useMutation({
    ...userMutations.insert({
      retry: (failureCount, error) => {
        // Retry server errors but not client errors
        if (error.message.includes('unique constraint')) return false;
        if (error.message.includes('validation')) return false;
        return failureCount < 3;
      },
      
      retryDelay: (attemptIndex) => {
        // Exponential backoff
        return Math.min(1000 * 2 ** attemptIndex, 30000);
      },
      
      onError: (error, variables, context) => {
        // Handle specific error types
        if (error.message.includes('unique constraint')) {
          alert('A user with this email already exists');
        } else if (error.message.includes('validation')) {
          alert('Please check your input and try again');
        } else {
          alert('An unexpected error occurred. Please try again later.');
        }
      }
    })
  });

  return (
    <button onClick={() => createUser.mutate({ 
      name: 'Test User', 
      email: 'test@example.com' 
    })}>
      Create User (Resilient)
    </button>
  );
}
```

## Cache Management Utilities

### Cache Helpers

Use cache helper utilities for advanced cache management:

```tsx
import { createCacheHelpers } from 'pgrestify/tanstack-query';

function AdvancedUserMutations() {
  const queryClient = useQueryClient();
  const cacheHelpers = createCacheHelpers<User>('users');
  
  const createUser = useMutation({
    ...userMutations.insert({
      onSuccess: (data) => {
        const newUser = data.data?.[0];
        if (newUser) {
          // Add to list cache
          cacheHelpers.addToListCache(queryClient, newUser);
        }
      }
    })
  });
  
  const updateUser = useMutation({
    ...userMutations.update({
      onSuccess: (data, { where }) => {
        const updatedUser = data.data?.[0];
        if (updatedUser && where.id) {
          // Update item in list cache
          cacheHelpers.updateInListCache(queryClient, where.id, updatedUser);
        }
      }
    })
  });
  
  const deleteUser = useMutation({
    ...userMutations.delete({
      onSuccess: (data, where) => {
        if (where.id) {
          // Remove from list cache
          cacheHelpers.removeFromListCache(queryClient, where.id);
        }
      }
    })
  });

  return (
    <div>
      {/* Mutation buttons */}
    </div>
  );
}
```

## Summary

PGRestify mutation factories provide comprehensive solutions for database operations with TanStack Query. They include automatic cache management, optimistic updates, error handling, and support for complex patterns like bulk operations and conditional updates. These mutations make it easy to build responsive, reliable React applications with PostgREST APIs.