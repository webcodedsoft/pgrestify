# Full-Text Search

PGRestify provides comprehensive full-text search capabilities leveraging PostgreSQL's powerful text search features.

## Basic Full-Text Search

```typescript
import { createClient } from 'pgrestify';

const client = createClient('http://localhost:3000');

// Simple full-text search
const searchResults = await client
  .from('articles')
  .select('*')
  .fts('content', 'typescript postgresql')
  .find();
```

## Search Variants

### Plain Text Search

```typescript
// Plain text search (tokenized)
const plainResults = await client
  .from('posts')
  .select('*')
  .fts('content', 'machine learning')
  .find();
```

### Phrase Search

```typescript
// Exact phrase search
const phraseResults = await client
  .from('documentation')
  .select('*')
  .phfts('text', '"type safety"')
  .find();
```

### Web-Style Search

```typescript
// Web-style search with boolean operators
const webSearchResults = await client
  .from('articles')
  .select('*')
  .wfts('content', 'typescript OR javascript NOT python')
  .find();
```

## Advanced Search Techniques

### Ranking Results

```typescript
// Search with ranking
const rankedResults = await client
  .from('articles')
  .select(`
    *,
    ts_rank(to_tsvector(content), plainto_tsquery($1)) as rank
  `)
  .fts('content', 'machine learning')
  .order('rank', { ascending: false })
  .find();
```

### Highlighting Matches

```typescript
// Highlight search matches
const highlightedResults = await client
  .from('articles')
  .select(`
    *,
    ts_headline(content, plainto_tsquery($1)) as highlighted_content
  `)
  .fts('content', 'typescript')
  .find();
```

## Language-Specific Search

```typescript
// Language-specific full-text search
const languageResults = await client
  .from('articles')
  .select('*')
  .fts('content', 'programming', { 
    language: 'english',  // Specify language for better tokenization
    config: 'pg_catalog.english_stem'
  })
  .find();
```

## Combining Search with Filters

```typescript
// Search with additional filtering
const filteredSearchResults = await client
  .from('products')
  .select('*')
  .fts('description', 'wireless bluetooth')
  .eq('category', 'electronics')
  .gte('price', 50)
  .lte('price', 200)
  .find();
```

## Type-Safe Search

```typescript
interface Article {
  id: number;
  title: string;
  content: string;
  author: string;
}

// Type-safe full-text search
const typeSafeResults = await client
  .from<Article>('articles')
  .select('*')
  .fts('content', 'typescript')
  .find();
```

## Performance Optimization

```typescript
// Optimize search performance
const optimizedResults = await client
  .from('large_articles')
  .select('id', 'title')  // Select only necessary fields
  .fts('content', 'optimization')
  .limit(50)  // Limit results
  .find();
```

## Error Handling

```typescript
try {
  const results = await client
    .from('articles')
    .select('*')
    .fts('content', 'search query')
    .find();
} catch (error) {
  if (error.name === 'SearchError') {
    console.log('Search failed:', error.message);
  }
}
```

## Creating Full-Text Search Indexes

```typescript
// Recommended: Create GIN index for full-text search
// In your database migration or setup script
CREATE INDEX idx_articles_fts 
ON articles 
USING gin(to_tsvector('english', content));
```

## Best Practices

- Create appropriate GIN indexes for performance
- Use language-specific configurations
- Limit result sets for large tables
- Combine full-text search with other filters
- Handle empty or short search queries
- Implement client-side search debouncing

## Advanced Configuration

```typescript
const client = createClient({
  search: {
    // Global search configuration
    defaultLanguage: 'english',
    maxResults: 100,
    rankNormalization: 2  // PostgreSQL ts_rank normalization method
  }
});
```

## Pagination with Search

```typescript
// Paginated search results
const searchPage = await client
  .from('articles')
  .select('*')
  .fts('content', 'typescript')
  .paginate({
    page: 1,
    pageSize: 20
  })
  .executeWithPagination();
```

## Performance Considerations

- Full-text search is CPU-intensive
- Use appropriate indexes
- Avoid searching on very large text fields
- Consider caching frequent search results
- Implement server-side search logic