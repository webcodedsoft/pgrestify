# Full-Text Search

Master PostgreSQL's powerful full-text search capabilities through PGRestify with text search vectors, ranking, language support, and performance optimization.

## Overview

PostgreSQL's full-text search (FTS) provides sophisticated text searching capabilities that go far beyond simple pattern matching. PGRestify integrates seamlessly with PostgreSQL's FTS features, allowing you to build powerful search functionality with relevance ranking, language-specific processing, and high performance.

## Basic Text Search

### Simple Text Search

```typescript
// Basic text search using PostgREST's text search
const searchPosts = await client
  .from('posts')
  .select('*')
  .textSearch('title', 'javascript tutorial')
  .execute();

// Search across multiple columns
const searchProducts = await client
  .from('products')
  .select('*')
  .textSearch('name,description', 'laptop gaming')
  .execute();

// Search with fts (full-text search) operator
const searchArticles = await client
  .from('articles')
  .select('*')
  .fts('search_vector', 'postgresql database')
  .execute();
```

### Search Vector Setup

```sql
-- Create a search vector column (run this in your database)
ALTER TABLE posts 
ADD COLUMN search_vector tsvector;

-- Update search vector with content
UPDATE posts 
SET search_vector = to_tsvector('english', 
  coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(tags::text, '')
);

-- Create GIN index for performance
CREATE INDEX posts_search_vector_idx ON posts USING gin(search_vector);

-- Auto-update search vector with trigger
CREATE OR REPLACE FUNCTION posts_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' || 
    coalesce(NEW.content, '') || ' ' || 
    coalesce(NEW.tags::text, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_search_vector_trigger
  BEFORE INSERT OR UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION posts_search_vector_update();
```

### Using Search Vectors

```typescript
// Search using the prepared search vector
const searchResults = await client
  .from('posts')
  .select('id, title, content, created_at')
  .fts('search_vector', 'javascript & (tutorial | guide)')
  .execute();

// Search with OR operator
const broadSearch = await client
  .from('posts')
  .select('*')
  .fts('search_vector', 'react | vue | angular')
  .execute();

// Search with phrase matching
const phraseSearch = await client
  .from('posts')
  .select('*')
  .fts('search_vector', '"machine learning"')
  .execute();
```

## Advanced Search Queries

### Boolean Search Operators

```typescript
// AND operator (&)
const andSearch = await client
  .from('posts')
  .select('*')
  .fts('search_vector', 'javascript & tutorial')
  .execute();

// OR operator (|)
const orSearch = await client
  .from('posts')
  .select('*')
  .fts('search_vector', 'python | javascript')
  .execute();

// NOT operator (!)
const notSearch = await client
  .from('posts')
  .select('*')
  .fts('search_vector', 'programming & !beginner')
  .execute();

// Complex combinations with parentheses
const complexSearch = await client
  .from('posts')
  .select('*')
  .fts('search_vector', '(react | vue) & (tutorial | guide) & !outdated')
  .execute();

// Followed by operator (<->)
const followedBySearch = await client
  .from('posts')
  .select('*')
  .fts('search_vector', 'machine <-> learning')
  .execute();
```

### Proximity and Phrase Searching

```typescript
// Exact phrase search
const exactPhrase = await client
  .from('articles')
  .select('*')
  .fts('search_vector', '"artificial intelligence"')
  .execute();

// Words within distance (using <N> operator)
const proximitySearch = await client
  .from('documents')
  .select('*')
  .fts('search_vector', 'database <2> optimization')
  .execute();

// Multiple phrase combinations
const multiPhrase = await client
  .from('posts')
  .select('*')
  .fts('search_vector', '"web development" | "mobile development"')
  .execute();
```

## Search with Ranking

### Basic Ranking

```typescript
// Search with relevance ranking using RPC function
const rankedResults = await client
  .rpc('search_posts_ranked', {
    search_term: 'javascript tutorial'
  })
  .execute();

// Example RPC function for ranked search:
/*
CREATE OR REPLACE FUNCTION search_posts_ranked(search_term TEXT)
RETURNS TABLE (
  id INT,
  title TEXT,
  content TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.content,
    ts_rank(p.search_vector, plainto_tsquery('english', search_term)) as rank
  FROM posts p
  WHERE p.search_vector @@ plainto_tsquery('english', search_term)
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;
*/
```

### Advanced Ranking with Weights

```typescript
// Weighted ranking (title more important than content)
const weightedSearch = await client
  .rpc('search_posts_weighted', {
    search_term: 'react hooks',
    title_weight: 1.0,
    content_weight: 0.4
  })
  .execute();

// Example weighted search function:
/*
CREATE OR REPLACE FUNCTION search_posts_weighted(
  search_term TEXT,
  title_weight REAL DEFAULT 1.0,
  content_weight REAL DEFAULT 0.4
)
RETURNS TABLE (
  id INT,
  title TEXT,
  content TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.content,
    ts_rank_cd(
      setweight(to_tsvector('english', p.title), 'A') ||
      setweight(to_tsvector('english', p.content), 'B'),
      plainto_tsquery('english', search_term)
    ) as rank
  FROM posts p
  WHERE (
    setweight(to_tsvector('english', p.title), 'A') ||
    setweight(to_tsvector('english', p.content), 'B')
  ) @@ plainto_tsquery('english', search_term)
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;
*/
```

### Custom Ranking Algorithms

```typescript
// Multi-factor ranking (relevance + popularity + recency)
const smartRanking = await client
  .rpc('search_with_smart_ranking', {
    search_term: 'vue composition api',
    include_popularity: true,
    boost_recent: true
  })
  .execute();

// Time-based ranking boost
const timeBostedSearch = await client
  .rpc('search_with_time_boost', {
    search_term: 'typescript',
    days_boost: 30  // Boost posts from last 30 days
  })
  .execute();
```

## Language-Specific Search

### Multi-Language Support

```typescript
// Search in different languages
const englishSearch = await client
  .rpc('search_multilingual', {
    search_term: 'programming tutorial',
    language: 'english'
  })
  .execute();

const spanishSearch = await client
  .rpc('search_multilingual', {
    search_term: 'tutorial programación',
    language: 'spanish'
  })
  .execute();

// Example multilingual search setup:
/*
-- Add language-specific search vectors
ALTER TABLE posts 
ADD COLUMN search_vector_en tsvector,
ADD COLUMN search_vector_es tsvector;

-- Update vectors for different languages
UPDATE posts SET 
  search_vector_en = to_tsvector('english', title || ' ' || content),
  search_vector_es = to_tsvector('spanish', title || ' ' || content);

-- Indexes for each language
CREATE INDEX posts_search_en_idx ON posts USING gin(search_vector_en);
CREATE INDEX posts_search_es_idx ON posts USING gin(search_vector_es);
*/
```

### Auto-Language Detection

```typescript
// Search with automatic language detection
const autoLanguageSearch = await client
  .rpc('search_auto_language', {
    search_term: 'apprentissage automatique',  // French
    auto_detect: true
  })
  .execute();

// Fallback language search
const fallbackSearch = await client
  .rpc('search_with_fallback', {
    search_term: 'machine learning',
    primary_language: 'spanish',
    fallback_language: 'english'
  })
  .execute();
```

## Search Highlighting

### Result Highlighting

```typescript
// Search with highlighted results
const highlightedResults = await client
  .rpc('search_with_highlights', {
    search_term: 'javascript functions',
    highlight_tag: 'mark'
  })
  .execute();

// Example highlighting function:
/*
CREATE OR REPLACE FUNCTION search_with_highlights(
  search_term TEXT,
  highlight_tag TEXT DEFAULT 'b'
)
RETURNS TABLE (
  id INT,
  title TEXT,
  content TEXT,
  highlighted_title TEXT,
  highlighted_content TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.title,
    p.content,
    ts_headline('english', p.title, plainto_tsquery('english', search_term), 
                'StartSel=<' || highlight_tag || '>, StopSel=</' || highlight_tag || '>') as highlighted_title,
    ts_headline('english', p.content, plainto_tsquery('english', search_term), 
                'StartSel=<' || highlight_tag || '>, StopSel=</' || highlight_tag || '>') as highlighted_content,
    ts_rank(p.search_vector, plainto_tsquery('english', search_term)) as rank
  FROM posts p
  WHERE p.search_vector @@ plainto_tsquery('english', search_term)
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;
*/
```

### Custom Highlighting Options

```typescript
// Customizable highlighting
const customHighlights = await client
  .rpc('search_custom_highlights', {
    search_term: 'react hooks',
    start_tag: '<span class="highlight">',
    stop_tag: '</span>',
    max_words: 50,
    min_words: 15
  })
  .execute();

// Fragment-based highlighting
const fragmentHighlights = await client
  .rpc('search_fragment_highlights', {
    search_term: 'postgresql optimization',
    fragment_delimiter: '...',
    max_fragments: 3
  })
  .execute();
```

## Search Suggestions and Autocomplete

### Query Suggestions

```typescript
// Get search suggestions based on partial input
const suggestions = await client
  .rpc('get_search_suggestions', {
    partial_query: 'javascr',
    limit: 10
  })
  .execute();

// Popular search suggestions
const popularSuggestions = await client
  .rpc('get_popular_searches', {
    category: 'programming',
    limit: 5
  })
  .execute();
```

### Fuzzy Matching

```typescript
// Fuzzy search for typos and variations
const fuzzySearch = await client
  .rpc('fuzzy_search', {
    search_term: 'javscript',  // Note the typo
    similarity_threshold: 0.6
  })
  .execute();

// Did you mean functionality
const didYouMean = await client
  .rpc('search_with_suggestions', {
    search_term: 'pyhton tutorial',
    suggest_corrections: true
  })
  .execute();
```

## Faceted Search

### Category-Based Faceting

```typescript
// Search with facets
const facetedSearch = await client
  .rpc('search_with_facets', {
    search_term: 'web development',
    include_facets: ['category', 'author', 'year']
  })
  .execute();

// Result includes facet counts:
// {
//   results: [...],
//   facets: {
//     category: { 'tutorial': 15, 'news': 8, 'review': 3 },
//     author: { 'john_doe': 12, 'jane_smith': 9 },
//     year: { '2024': 20, '2023': 6 }
//   }
// }
```

### Dynamic Faceting

```typescript
// Apply facet filters to search
const filteredFacetSearch = await client
  .rpc('search_filtered_facets', {
    search_term: 'javascript',
    facet_filters: {
      category: ['tutorial', 'guide'],
      difficulty: ['beginner', 'intermediate']
    }
  })
  .execute();
```

## Search Performance Optimization

### Index Optimization

```sql
-- Optimize search indexes
CREATE INDEX CONCURRENTLY posts_gin_search_idx ON posts USING gin(search_vector);

-- Partial index for active content only
CREATE INDEX posts_search_active_idx ON posts USING gin(search_vector) 
WHERE status = 'published';

-- Multi-column index for filtered searches
CREATE INDEX posts_search_category_idx ON posts USING gin(search_vector) 
INCLUDE (category_id, created_at);
```

### Query Optimization

```typescript
// Efficient search with limits
const optimizedSearch = async (term: string, limit = 20) => {
  return client
    .rpc('search_optimized', {
      search_term: term,
      result_limit: limit
    })
    .execute();
};

// Pagination for search results
const paginatedSearch = async (
  term: string, 
  page = 0, 
  pageSize = 20
) => {
  const offset = page * pageSize;
  
  return client
    .rpc('search_paginated', {
      search_term: term,
      result_limit: pageSize,
      result_offset: offset
    })
    .execute();
};
```

### Caching Search Results

```typescript
// Cache popular searches
const cachedSearch = async (searchTerm: string) => {
  // Check cache first (implement with Redis or similar)
  const cacheKey = `search:${searchTerm}`;
  let results = await getFromCache(cacheKey);
  
  if (!results) {
    results = await client
      .rpc('search_posts_ranked', { search_term: searchTerm })
      .execute();
    
    // Cache for 15 minutes
    await setCache(cacheKey, results, 900);
  }
  
  return results;
};
```

## Search Analytics

### Search Tracking

```typescript
// Track search queries
const trackSearch = async (searchTerm: string, userId?: number) => {
  await client
    .from('search_logs')
    .insert({
      search_term: searchTerm,
      user_id: userId,
      searched_at: new Date().toISOString(),
      results_count: 0 // Will be updated after search
    })
    .execute();
};

// Get search analytics
const searchAnalytics = await client
  .rpc('get_search_analytics', {
    start_date: '2024-01-01',
    end_date: '2024-01-31'
  })
  .execute();
```

### Search Quality Metrics

```typescript
// Track search performance metrics
const searchMetrics = await client
  .rpc('calculate_search_metrics')
  .execute();

// Result includes:
// - Most searched terms
// - Zero-result searches
// - Click-through rates
// - Search-to-conversion rates
```

## Common Search Patterns

### Blog Search

```typescript
const searchBlogPosts = async (query: string) => {
  return client
    .rpc('search_blog_posts', {
      search_term: query,
      published_only: true,
      include_highlights: true
    })
    .execute();
};
```

### E-commerce Product Search

```typescript
const searchProducts = async (
  query: string,
  category?: string,
  priceRange?: { min: number; max: number }
) => {
  return client
    .rpc('search_products_advanced', {
      search_term: query,
      category_filter: category,
      price_min: priceRange?.min,
      price_max: priceRange?.max,
      include_facets: true
    })
    .execute();
};
```

### Document Search

```typescript
const searchDocuments = async (
  query: string,
  documentTypes?: string[],
  userId?: number
) => {
  return client
    .rpc('search_documents', {
      search_term: query,
      document_types: documentTypes,
      user_id: userId,  // For permission filtering
      include_content_preview: true
    })
    .execute();
};
```

### Knowledge Base Search

```typescript
const searchKnowledgeBase = async (
  query: string,
  includeRelated = true
) => {
  return client
    .rpc('search_knowledge_base', {
      search_term: query,
      include_related_articles: includeRelated,
      boost_popular: true
    })
    .execute();
};
```

## Search UI Integration

### Search Component Helper

```typescript
interface SearchOptions {
  term: string;
  filters?: Record<string, any>;
  sort?: 'relevance' | 'date' | 'popularity';
  page?: number;
  pageSize?: number;
}

class SearchManager {
  async search(options: SearchOptions) {
    const { term, filters = {}, sort = 'relevance', page = 0, pageSize = 20 } = options;
    
    return client
      .rpc('universal_search', {
        search_term: term,
        filters: filters,
        sort_by: sort,
        page_number: page,
        page_size: pageSize
      })
      .execute();
  }
  
  async getSuggestions(partialTerm: string) {
    return client
      .rpc('get_search_suggestions', {
        partial_query: partialTerm,
        limit: 8
      })
      .execute();
  }
  
  async getPopularSearches(category?: string) {
    return client
      .rpc('get_popular_searches', {
        category: category,
        limit: 10
      })
      .execute();
  }
}

// Usage
const searchManager = new SearchManager();
const results = await searchManager.search({
  term: 'javascript tutorial',
  filters: { category: 'programming', difficulty: 'beginner' },
  sort: 'relevance',
  page: 0,
  pageSize: 20
});
```

---

## Summary

PGRestify's full-text search capabilities provide:

- **PostgreSQL FTS Integration**: Complete access to PostgreSQL's full-text search
- **Advanced Querying**: Boolean operators, phrases, and proximity search
- **Relevance Ranking**: Sophisticated ranking algorithms with custom weights
- **Multi-Language Support**: Language-specific search processing
- **Search Highlighting**: Result highlighting with customizable formatting
- **Performance Optimization**: Efficient indexing and query patterns
- **Faceted Search**: Category-based filtering and faceting
- **Search Analytics**: Query tracking and performance metrics
- **UI Integration**: Helper patterns for search components

Master these full-text search techniques to build powerful, fast, and user-friendly search functionality that leverages PostgreSQL's advanced text processing capabilities.