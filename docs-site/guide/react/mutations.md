# React Mutations

PGRestify provides powerful mutation hooks for data modification operations in React applications. These hooks handle create, update, delete, and upsert operations with built-in optimistic updates, error handling, and state management.

## Basic Mutation Hooks

### Generic useMutation Hook

The `useMutation` hook provides a flexible interface for any mutation operation:

```tsx
import { useMutation, MutationOperation } from '@webcoded/pgrestify/react';

interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

function CreateUserForm() {
  const { 
    mutate: createUser, 
    loading, 
    error, 
    data: createdUser 
  } = useMutation<User>('users', {
    operation: MutationOperation.INSERT,
    onSuccess: (user) => {
      console.log('User created:', user);
      // Navigate or show success message
    },
    onError: (error) => {
      console.error('Failed to create user:', error);
    }
  });

  const handleSubmit = (formData: FormData) => {
    createUser({
      name: formData.get('name') as string,
      email: formData.get('email') as string
    });
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit(new FormData(e.currentTarget));
    }}>
      <input name="name" placeholder="Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create User'}
      </button>
      {error && <div className="error">Error: {error.message}</div>}
      {createdUser && <div className="success">User created successfully!</div>}
    </form>
  );
}
```

### Insert Operations

Use `useInsert` for creating new records:

```tsx
interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  published: boolean;
  created_at: string;
}

function CreatePostForm({ authorId }: { authorId: string }) {
  const [isDraft, setIsDraft] = useState(true);
  
  const { mutate: createPost, loading, error } = useInsert<Post>('posts', {
    onSuccess: (post) => {
      alert(`Post ${post.published ? 'published' : 'saved as draft'}!`);
      // Redirect to post page
      window.location.href = `/posts/${post.id}`;
    },
    onError: (error) => {
      console.error('Failed to create post:', error);
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    createPost({
      title: formData.get('title') as string,
      content: formData.get('content') as string,
      author_id: authorId,
      published: !isDraft
    });
  };

  return (
    <form onSubmit={handleSubmit} className="post-form">
      <input
        name="title"
        placeholder="Post Title"
        required
        className="title-input"
      />
      
      <textarea
        name="content"
        placeholder="Write your post..."
        required
        rows={10}
        className="content-textarea"
      />
      
      <div className="form-controls">
        <label className="draft-toggle">
          <input
            type="checkbox"
            checked={isDraft}
            onChange={(e) => setIsDraft(e.target.checked)}
          />
          Save as Draft
        </label>
        
        <button type="submit" disabled={loading}>
          {loading ? 'Saving...' : isDraft ? 'Save Draft' : 'Publish'}
        </button>
      </div>
      
      {error && (
        <div className="error">
          Failed to {isDraft ? 'save draft' : 'publish'}: {error.message}
        </div>
      )}
    </form>
  );
}
```

### Update Operations

Use `useUpdate` for modifying existing records:

```tsx
interface Profile {
  id: string;
  user_id: string;
  bio?: string;
  avatar_url?: string;
  website?: string;
  updated_at: string;
}

function EditProfileForm({ profile }: { profile: Profile }) {
  const [formData, setFormData] = useState({
    bio: profile.bio || '',
    website: profile.website || ''
  });

  const { mutate: updateProfile, loading, error } = useUpdate<Profile>('profiles', {
    onSuccess: (updatedProfile) => {
      console.log('Profile updated:', updatedProfile);
      alert('Profile updated successfully!');
    },
    onMutate: (variables) => {
      // Optimistic update - update UI immediately
      console.log('Optimistically updating with:', variables);
    },
    onError: (error, variables) => {
      console.error('Update failed:', error);
      // Revert optimistic updates if needed
    }
  });

  const handleSave = () => {
    updateProfile({
      data: {
        bio: formData.bio,
        website: formData.website
      },
      filter: { id: profile.id }
    });
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="profile-form">
      <h2>Edit Profile</h2>
      
      <div className="form-group">
        <label>Bio</label>
        <textarea
          value={formData.bio}
          onChange={(e) => handleInputChange('bio', e.target.value)}
          placeholder="Tell us about yourself..."
          rows={4}
        />
      </div>
      
      <div className="form-group">
        <label>Website</label>
        <input
          type="url"
          value={formData.website}
          onChange={(e) => handleInputChange('website', e.target.value)}
          placeholder="https://your-website.com"
        />
      </div>
      
      <div className="form-actions">
        <button onClick={handleSave} disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
      
      {error && (
        <div className="error">
          Failed to update profile: {error.message}
        </div>
      )}
    </div>
  );
}
```

### Delete Operations

Use `useDelete` for removing records:

```tsx
function DeleteUserButton({ user }: { user: User }) {
  const [showConfirm, setShowConfirm] = useState(false);
  
  const { mutate: deleteUser, loading } = useDelete('users', {
    onSuccess: () => {
      alert('User deleted successfully');
      // Navigate away or update parent component
      window.location.href = '/users';
    },
    onError: (error) => {
      alert(`Failed to delete user: ${error.message}`);
    }
  });

  const handleDelete = () => {
    deleteUser({ id: user.id });
    setShowConfirm(false);
  };

  if (showConfirm) {
    return (
      <div className="delete-confirmation">
        <p>Are you sure you want to delete <strong>{user.name}</strong>?</p>
        <p>This action cannot be undone.</p>
        <div className="confirmation-actions">
          <button 
            onClick={handleDelete}
            disabled={loading}
            className="danger-button"
          >
            {loading ? 'Deleting...' : 'Yes, Delete'}
          </button>
          <button 
            onClick={() => setShowConfirm(false)}
            className="cancel-button"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button 
      onClick={() => setShowConfirm(true)}
      className="delete-button"
    >
      Delete User
    </button>
  );
}
```

### Upsert Operations

Use `useUpsert` for insert-or-update operations:

```tsx
interface UserPreference {
  user_id: string;
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  language: string;
  updated_at: string;
}

function UserSettings({ userId }: { userId: string }) {
  const [preferences, setPreferences] = useState<Partial<UserPreference>>({
    theme: 'system',
    notifications: true,
    language: 'en'
  });

  const { mutate: savePreferences, loading, error } = useUpsert<UserPreference>('user_preferences', {
    onSuccess: (savedPrefs) => {
      console.log('Preferences saved:', savedPrefs);
      // Show success toast
    },
    onError: (error) => {
      console.error('Failed to save preferences:', error);
    }
  });

  const handleSave = () => {
    savePreferences({
      user_id: userId,
      ...preferences
    });
  };

  const updatePreference = <K extends keyof UserPreference>(
    key: K, 
    value: UserPreference[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="user-settings">
      <h2>Settings</h2>
      
      <div className="setting-group">
        <label>Theme</label>
        <select 
          value={preferences.theme}
          onChange={(e) => updatePreference('theme', e.target.value as any)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>
      
      <div className="setting-group">
        <label>
          <input
            type="checkbox"
            checked={preferences.notifications}
            onChange={(e) => updatePreference('notifications', e.target.checked)}
          />
          Email Notifications
        </label>
      </div>
      
      <div className="setting-group">
        <label>Language</label>
        <select 
          value={preferences.language}
          onChange={(e) => updatePreference('language', e.target.value)}
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
        </select>
      </div>
      
      <button onClick={handleSave} disabled={loading}>
        {loading ? 'Saving...' : 'Save Settings'}
      </button>
      
      {error && (
        <div className="error">
          Failed to save settings: {error.message}
        </div>
      )}
    </div>
  );
}
```

## Advanced Mutation Patterns

### Optimistic Updates

```tsx
function OptimisticLikeButton({ postId, initialLikes }: { 
  postId: string; 
  initialLikes: number; 
}) {
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(false);

  const { mutate: toggleLike, loading } = useMutation('post_likes', {
    operation: MutationOperation.INSERT,
    onMutate: (variables) => {
      // Optimistic update
      const newLikedState = !isLiked;
      const newLikeCount = newLikedState ? likes + 1 : likes - 1;
      
      setIsLiked(newLikedState);
      setLikes(newLikeCount);
      
      // Return rollback data
      return { previousLiked: isLiked, previousLikes: likes };
    },
    onError: (error, variables, rollbackData) => {
      // Rollback optimistic update
      if (rollbackData) {
        setIsLiked(rollbackData.previousLiked);
        setLikes(rollbackData.previousLikes);
      }
    },
    onSuccess: (data) => {
      // Update with server data
      setLikes(data.total_likes);
      setIsLiked(data.liked);
    }
  });

  const handleToggleLike = () => {
    toggleLike({
      post_id: postId,
      liked: !isLiked
    });
  };

  return (
    <button 
      onClick={handleToggleLike}
      disabled={loading}
      className={`like-button ${isLiked ? 'liked' : ''}`}
    >
      ❤️ {likes} {loading && '⟳'}
    </button>
  );
}
```

### Batch Mutations

```tsx
function BulkUserActions({ userIds }: { userIds: string[] }) {
  const [selectedAction, setSelectedAction] = useState<'activate' | 'deactivate' | 'delete'>('activate');
  
  const { mutate: bulkUpdate, loading, error } = useUpdate<User>('users', {
    onSuccess: (result) => {
      console.log(`Successfully updated ${userIds.length} users`);
      // Refresh user list or navigate
    },
    onError: (error) => {
      console.error('Bulk operation failed:', error);
    }
  });

  const handleBulkAction = () => {
    const updateData: Partial<User> = {};
    
    switch (selectedAction) {
      case 'activate':
        updateData.active = true;
        break;
      case 'deactivate':
        updateData.active = false;
        break;
      case 'delete':
        // Use delete mutation for this case
        break;
    }
    
    bulkUpdate({
      data: updateData,
      filter: { 
        id: `in.(${userIds.join(',')})` // PostgREST syntax for IN operator
      }
    });
  };

  return (
    <div className="bulk-actions">
      <div className="action-controls">
        <select 
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value as any)}
        >
          <option value="activate">Activate</option>
          <option value="deactivate">Deactivate</option>
          <option value="delete">Delete</option>
        </select>
        
        <button 
          onClick={handleBulkAction}
          disabled={loading || userIds.length === 0}
          className={selectedAction === 'delete' ? 'danger-button' : ''}
        >
          {loading ? 'Processing...' : `${selectedAction} ${userIds.length} Users`}
        </button>
      </div>
      
      {error && (
        <div className="error">
          Bulk operation failed: {error.message}
        </div>
      )}
    </div>
  );
}
```

### Mutation with File Upload

```tsx
function AvatarUpload({ userId }: { userId: string }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');

  const { mutate: uploadAvatar, loading, error } = useUpdate<Profile>('profiles', {
    onSuccess: (profile) => {
      console.log('Avatar updated:', profile.avatar_url);
      setSelectedFile(null);
      setPreview('');
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      // Upload file to storage service (e.g., Supabase Storage, AWS S3)
      const fileUrl = await uploadFileToStorage(selectedFile);
      
      // Update profile with new avatar URL
      uploadAvatar({
        data: { avatar_url: fileUrl },
        filter: { user_id: userId }
      });
    } catch (error) {
      console.error('File upload failed:', error);
    }
  };

  return (
    <div className="avatar-upload">
      <div className="upload-area">
        {preview ? (
          <img src={preview} alt="Avatar preview" className="avatar-preview" />
        ) : (
          <div className="upload-placeholder">
            <p>Select an image</p>
          </div>
        )}
        
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="file-input"
        />
      </div>
      
      <div className="upload-actions">
        <button 
          onClick={handleUpload}
          disabled={!selectedFile || loading}
        >
          {loading ? 'Uploading...' : 'Upload Avatar'}
        </button>
        
        {selectedFile && (
          <button 
            onClick={() => {
              setSelectedFile(null);
              setPreview('');
            }}
            className="cancel-button"
          >
            Cancel
          </button>
        )}
      </div>
      
      {error && (
        <div className="error">
          Upload failed: {error.message}
        </div>
      )}
    </div>
  );
}

// Utility function (implement based on your storage solution)
async function uploadFileToStorage(file: File): Promise<string> {
  // Example implementation for Supabase Storage
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    throw new Error('Upload failed');
  }
  
  const { url } = await response.json();
  return url;
}
```

## Form Integration

### React Hook Form Integration

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Validation schema
const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  age: z.number().min(18, 'Must be at least 18 years old').optional()
});

type UserFormData = z.infer<typeof userSchema>;

function UserForm({ user, onSuccess }: { 
  user?: User; 
  onSuccess?: (user: User) => void; 
}) {
  const isEditing = !!user;
  
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      age: user?.age || undefined
    }
  });

  const createMutation = useInsert<User>('users', {
    onSuccess: (newUser) => {
      reset();
      onSuccess?.(newUser);
    }
  });

  const updateMutation = useUpdate<User>('users', {
    onSuccess: (updatedUser) => {
      reset(updatedUser);
      onSuccess?.(updatedUser);
    }
  });

  const onSubmit = (data: UserFormData) => {
    if (isEditing) {
      updateMutation.mutate({
        data,
        filter: { id: user!.id }
      });
    } else {
      createMutation.mutate(data);
    }
  };

  const loading = createMutation.loading || updateMutation.loading;
  const error = createMutation.error || updateMutation.error;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="user-form">
      <div className="form-group">
        <label>Name</label>
        <input
          {...register('name')}
          className={errors.name ? 'error' : ''}
        />
        {errors.name && (
          <span className="error-message">{errors.name.message}</span>
        )}
      </div>

      <div className="form-group">
        <label>Email</label>
        <input
          type="email"
          {...register('email')}
          className={errors.email ? 'error' : ''}
        />
        {errors.email && (
          <span className="error-message">{errors.email.message}</span>
        )}
      </div>

      <div className="form-group">
        <label>Age (optional)</label>
        <input
          type="number"
          {...register('age', { valueAsNumber: true })}
          className={errors.age ? 'error' : ''}
        />
        {errors.age && (
          <span className="error-message">{errors.age.message}</span>
        )}
      </div>

      <div className="form-actions">
        <button 
          type="submit" 
          disabled={loading || !isDirty}
        >
          {loading 
            ? 'Saving...' 
            : isEditing 
              ? 'Update User' 
              : 'Create User'
          }
        </button>
        
        {isEditing && (
          <button 
            type="button" 
            onClick={() => reset()}
            disabled={loading}
          >
            Reset
          </button>
        )}
      </div>

      {error && (
        <div className="error-banner">
          {isEditing ? 'Update' : 'Create'} failed: {error.message}
        </div>
      )}
    </form>
  );
}
```

### Formik Integration

```tsx
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  title: Yup.string().required('Title is required'),
  content: Yup.string().required('Content is required'),
  tags: Yup.array().of(Yup.string())
});

function PostForm({ post, onSuccess }: { 
  post?: Post; 
  onSuccess?: (post: Post) => void; 
}) {
  const isEditing = !!post;

  const { mutate: savePost, loading, error } = useMutation<Post>('posts', {
    operation: isEditing ? MutationOperation.UPDATE : MutationOperation.INSERT,
    onSuccess: (savedPost) => {
      console.log('Post saved:', savedPost);
      onSuccess?.(savedPost);
    }
  });

  const initialValues = {
    title: post?.title || '',
    content: post?.content || '',
    tags: post?.tags || []
  };

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={(values, { setSubmitting, resetForm }) => {
        if (isEditing) {
          savePost({
            data: values,
            filter: { id: post!.id }
          });
        } else {
          savePost(values);
        }
        setSubmitting(false);
      }}
    >
      {({ isSubmitting, dirty }) => (
        <Form className="post-form">
          <div className="form-group">
            <label>Title</label>
            <Field name="title" className="form-control" />
            <ErrorMessage name="title" component="div" className="error" />
          </div>

          <div className="form-group">
            <label>Content</label>
            <Field as="textarea" name="content" rows={8} className="form-control" />
            <ErrorMessage name="content" component="div" className="error" />
          </div>

          <button 
            type="submit" 
            disabled={loading || isSubmitting || !dirty}
          >
            {loading ? 'Saving...' : isEditing ? 'Update Post' : 'Create Post'}
          </button>

          {error && (
            <div className="error-banner">
              Save failed: {error.message}
            </div>
          )}
        </Form>
      )}
    </Formik>
  );
}
```

## Error Handling and Recovery

### Retry Logic

```tsx
function ReliableMutation() {
  const { mutate, loading, error, retry } = useMutation<User>('users', {
    operation: MutationOperation.INSERT,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    onError: (error, variables, context) => {
      console.error(`Mutation failed (attempt ${context?.attempt || 1}):`, error);
    }
  });

  return (
    <div>
      <button onClick={() => mutate({ name: 'Test', email: 'test@example.com' })}>
        Create User
      </button>
      
      {loading && <div>Creating user...</div>}
      
      {error && (
        <div className="error">
          <p>Failed to create user: {error.message}</p>
          <button onClick={retry}>Try Again</button>
        </div>
      )}
    </div>
  );
}
```

### Global Error Handler

```tsx
function GlobalMutationErrorHandler({ children }: { children: React.ReactNode }) {
  const handleMutationError = useCallback((error: Error, context: any) => {
    console.error('Mutation error:', error, context);
    
    // Show global notification
    if (error.message.includes('network')) {
      showNotification('Network error. Please check your connection.', 'error');
    } else if (error.message.includes('unauthorized')) {
      showNotification('Session expired. Please log in again.', 'warning');
      // Redirect to login
    } else {
      showNotification('Something went wrong. Please try again.', 'error');
    }
  }, []);

  return (
    <MutationErrorProvider onError={handleMutationError}>
      {children}
    </MutationErrorProvider>
  );
}
```

## Best Practices

### 1. Optimistic Updates

```tsx
// Good: Implement optimistic updates for better UX
const { mutate: updatePost } = useUpdate<Post>('posts', {
  onMutate: (variables) => {
    // Update UI immediately
    setPost(current => ({ ...current, ...variables.data }));
    return { previousPost: post };
  },
  onError: (error, variables, rollbackData) => {
    // Rollback on error
    setPost(rollbackData.previousPost);
  }
});
```

### 2. Mutation State Management

```tsx
// Good: Centralize mutation state
function useMutationState() {
  const [mutations, setMutations] = useState<Map<string, MutationState>>(new Map());
  
  const registerMutation = (key: string, state: MutationState) => {
    setMutations(prev => new Map(prev.set(key, state)));
  };
  
  const isAnyLoading = Array.from(mutations.values()).some(m => m.loading);
  
  return { mutations, registerMutation, isAnyLoading };
}
```

### 3. Form State Sync

```tsx
// Good: Sync form state with server state
function EditForm({ initialData }: { initialData: User }) {
  const [formData, setFormData] = useState(initialData);
  
  const { mutate, loading, error } = useUpdate<User>('users', {
    onSuccess: (updatedUser) => {
      setFormData(updatedUser); // Sync with server response
    }
  });
  
  // Reset form when initial data changes
  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);
}
```

## Summary

PGRestify's React mutation hooks provide:

- **Type-Safe Operations**: Full TypeScript support for all mutation types
- **Optimistic Updates**: Built-in support for immediate UI updates
- **Error Recovery**: Automatic retry logic and rollback capabilities  
- **Form Integration**: Seamless integration with popular form libraries
- **Flexible API**: Support for simple operations to complex batch mutations
- **Performance**: Optimized mutations with minimal re-renders

These mutation patterns enable building responsive, user-friendly React applications with robust data modification capabilities.