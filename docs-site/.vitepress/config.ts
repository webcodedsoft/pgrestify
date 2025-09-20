import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'PGRestify',
  description: 'The definitive TypeScript client library for PostgREST APIs',
  
  // Ensure public folder is included in build
  vite: {
    build: {
      rollupOptions: {
        input: {
          main: './index.md',
          // Add other entry points if needed
        }
      }
    },
    publicDir: 'public' // Explicitly set public directory
  },

  themeConfig: {
    logo: '/logo.png',
    
    nav: [
      { text: 'Get Started', link: '/guide/getting-started' },
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'API', link: '/api/client' },
      { text: 'Examples', link: '/examples/overview' },
      { text: 'Recipes', link: '/recipes/overview' },
      { text: 'GitHub', link: 'https://github.com/webcodedsoft/pgrestify' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Quick Start', link: '/guide/getting-started' },
            { text: 'Prerequisites', link: '/guide/prerequisites' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Configuration', link: '/guide/configuration' }
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Client Creation', link: '/guide/core/client-creation' },
            { text: 'Query Building', link: '/guide/core/query-building' },
            { text: 'Data Fetching', link: '/guide/core/data-fetching' },
            { text: 'Mutations', link: '/guide/core/mutations' },
            { text: 'Error Handling', link: '/guide/core/error-handling' },
            { text: 'TypeScript Integration', link: '/guide/core/typescript' },
          ]
        },
        {
          text: 'Repository Patterns',
          items: [
            { text: 'Repository Pattern', link: '/guide/orm/repository-pattern' },
            { text: 'Data Manager', link: '/guide/orm/data-manager' },
            { text: 'Custom Repositories', link: '/guide/orm/custom-repositories' },
            { text: 'Creating Records', link: '/guide/creating-records' },
            { text: 'Updating Records', link: '/guide/updating-records' },
            { text: 'Deleting Records', link: '/guide/deleting-records' },
            { text: 'Soft Deletes', link: '/guide/orm/soft-deletes' },
            { text: 'Bulk Operations', link: '/guide/bulk-operations' },
            { text: 'Upsert Operations', link: '/guide/upsert' },
            { text: 'Transaction Patterns', link: '/guide/transactions' },
            { text: 'Advanced Transactions', link: '/guide/orm/transactions' },
          ]
        },
        {
          text: 'Querying Data',
          items: [
            { text: 'Basic Queries', link: '/guide/queries/basic-queries' },
            { text: 'Filtering & Operators', link: '/guide/queries/filtering' },
            { text: 'Sorting & Ordering', link: '/guide/queries/sorting' },
            { text: 'Pagination', link: '/guide/queries/pagination' },
            { text: 'Column Aliasing', link: '/guide/queries/aliasing' },
            { text: 'Table Joining', link: '/guide/queries/joining' },
            { text: 'Relationships & Joins', link: '/guide/queries/relationships' },
            { text: 'Repository Query Methods', link: '/guide/orm/query-methods' },
            { text: 'Advanced Relationships', link: '/guide/orm/relationships' },
            { text: 'Aggregate Functions', link: '/guide/queries/aggregates' },
            { text: 'Aggregation & Functions', link: '/guide/aggregation' },
            { text: 'Search', link: '/guide/queries/search' },
            { text: 'Full-Text Search', link: '/guide/queries/full-text-search' },
            { text: 'Raw Queries', link: '/guide/queries/raw-queries' },
          ]
        },
        {
          text: 'Advanced Features',
          items: [
            { text: 'Column Transformation', link: '/guide/advanced-features/column-transformation' },
            { text: 'CORS Configuration', link: '/guide/advanced-features/cors' },
            { text: 'Caching Strategies', link: '/guide/advanced-features/caching' },
            { text: 'Real-time Subscriptions', link: '/guide/advanced-features/realtime' },
            { text: 'Authentication', link: '/guide/advanced-features/authentication' },
            { text: 'PostgreSQL Roles', link: '/guide/advanced-features/roles' },
            { text: 'Database Roles', link: '/guide/advanced-features/database-roles' },
            { text: 'Custom Schemas', link: '/guide/advanced-features/custom-schemas' }
          ]
        },
        {
          text: 'React Integration',
          items: [
            { text: 'React Hooks Overview', link: '/guide/react/hooks' },
            { text: 'Data Fetching Hooks', link: '/guide/react/fetching' },
            { text: 'Mutation Hooks', link: '/guide/react/mutations' },
            { text: 'State Management', link: '/guide/react/state' },
            { text: 'Server State Sync', link: '/guide/react/server-state' },
            { text: 'Optimistic Updates', link: '/guide/react/optimistic' },
            { text: 'Infinite Queries', link: '/guide/react/infinite' }
          ]
        },
        {
          text: 'Next.js Integration',
          items: [
            { text: 'Next.js Overview', link: '/guide/nextjs/overview' },
            { text: 'App Router', link: '/guide/nextjs/app-router' },
            { text: 'Pages Router', link: '/guide/nextjs/pages-router' },
            { text: 'Server Components', link: '/guide/nextjs/server-components' },
            { text: 'API Routes', link: '/guide/nextjs/api-routes' },
            { text: 'Static Generation', link: '/guide/nextjs/ssg' },
            { text: 'Server-Side Rendering', link: '/guide/nextjs/ssr' },
            { text: 'Authentication Flow', link: '/guide/nextjs/auth' },
            { text: 'Caching Strategies', link: '/guide/nextjs/caching' },
            { text: 'Migration Guide', link: '/guide/nextjs/migration' }
          ]
        },
        {
          text: 'CLI & Tooling',
          items: [
            { text: 'CLI Overview', link: '/guide/cli/overview' },
            { text: 'Project Initialization', link: '/guide/cli/project-init' },
            { text: 'Schema Management', link: '/guide/cli/schema-management' },
            { text: 'Migration Tools', link: '/guide/cli/migrations' },
            { text: 'Advanced Migration Patterns', link: '/guide/orm/migrations' },
            { text: 'Functions Management', link: '/guide/cli/functions' },
            { text: 'Features & Extensions', link: '/guide/cli/features' },
            { text: 'Configuration', link: '/guide/cli/configuration' },
            { text: 'Security & Roles', link: '/guide/cli/security' },
            { text: 'Project Templates', link: '/guide/cli/templates' }
          ]
        },
        {
          text: 'Production',
          items: [
            { text: 'Deployment Guide', link: '/guide/production/deployment' },
            { text: 'Docker Setup', link: '/guide/production/docker-setup' },
            { text: 'Environment Configuration', link: '/guide/production/environment' }
          ]
        },
        {
          text: 'Troubleshooting',
          items: [
            { text: 'Common Issues', link: '/guide/troubleshooting/common-issues' },
            { text: 'Migration Guides', link: '/guide/troubleshooting/migration-guides' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Client API', link: '/api/client' },
            { text: 'Query Builder', link: '/api/query-builder' },
            { text: 'Repository Pattern', link: '/api/repository' },
            { text: 'Authentication', link: '/api/auth' },
            { text: 'Real-time', link: '/api/realtime' },
            { text: 'Type Definitions', link: '/api/types' },
            { text: 'Entity Types', link: '/api/entities' }
          ]
        }
      ],
      '/examples/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Overview', link: '/examples/overview' },
            { text: 'Basic Usage', link: '/examples/basic-usage' },
            { text: 'Client Setup', link: '/examples/client-setup' },
            { text: 'First Query', link: '/examples/first-query' }
          ]
        },
        {
          text: 'Query Examples',
          items: [
            { text: 'Simple Queries', link: '/examples/simple-queries' },
            { text: 'Advanced Filtering', link: '/examples/advanced-filtering' },
            { text: 'Pagination & Sorting', link: '/examples/pagination-sorting' },
            { text: 'Joins & Relationships', link: '/examples/joins-relationships' },
            { text: 'Full-Text Search', link: '/examples/full-text-search' },
            { text: 'Aggregation & Grouping', link: '/examples/aggregation' }
          ]
        },
        {
          text: 'Mutation Examples',
          items: [
            { text: 'Creating Data', link: '/examples/creating-data' },
            { text: 'Updating Data', link: '/examples/updating-data' },
            { text: 'Deleting Data', link: '/examples/deleting-data' },
            { text: 'Bulk Operations', link: '/examples/bulk-operations' },
            { text: 'Error Handling', link: '/examples/error-handling' }
          ]
        },
        {
          text: 'React Examples',
          items: [
            { text: 'React Hooks', link: '/examples/react-hooks' },
            { text: 'Data Fetching', link: '/examples/react-data-fetching' },
            { text: 'Forms & Mutations', link: '/examples/react-forms' },
            { text: 'Real-time Updates', link: '/examples/react-realtime' },
            { text: 'Infinite Scrolling', link: '/examples/react-infinite-scroll' },
            { text: 'Optimistic Updates', link: '/examples/react-optimistic' }
          ]
        },
        {
          text: 'Next.js Examples',
          items: [
            { text: 'App Router Setup', link: '/examples/nextjs-app-router' },
            { text: 'Server Components', link: '/examples/nextjs-server-components' },
            { text: 'API Routes', link: '/examples/nextjs-api-routes' },
            { text: 'Static Generation', link: '/examples/nextjs-ssg' },
            { text: 'Authentication', link: '/examples/nextjs-auth' }
          ]
        },
        {
          text: 'Enterprise Examples',
          items: [
            { text: 'Multi-tenant Applications', link: '/examples/multi-tenant' },
            { text: 'Role-based Access', link: '/examples/rbac' },
            { text: 'Audit Logging', link: '/examples/audit-logging' },
            { text: 'Performance Monitoring', link: '/examples/performance' }
          ]
        }
      ],
      // '/recipes/': [
      //   {
      //     text: 'Recipe Categories',
      //     items: [
      //       { text: 'Overview', link: '/recipes/overview' },
      //       { text: 'Common Patterns', link: '/recipes/common-patterns' },
      //       { text: 'Best Practices', link: '/recipes/best-practices' }
      //     ]
      //   },
      //   {
      //     text: 'Architecture Recipes',
      //     items: [
      //       { text: 'Repository Pattern', link: '/recipes/repository-pattern' },
      //       { text: 'Service Layer', link: '/recipes/service-layer' },
      //       { text: 'Data Access Layer', link: '/recipes/data-access-layer' },
      //       { text: 'Domain Models', link: '/recipes/domain-models' }
      //     ]
      //   },
      //   {
      //     text: 'Query Recipes',
      //     items: [
      //       { text: 'Complex Filtering', link: '/recipes/complex-filtering' },
      //       { text: 'Dynamic Queries', link: '/recipes/dynamic-queries' },
      //       { text: 'Performance Optimization', link: '/recipes/query-performance' },
      //       { text: 'Caching Strategies', link: '/recipes/caching-strategies' }
      //     ]
      //   },
      //   {
      //     text: 'State Management',
      //     items: [
      //       { text: 'Server State Sync', link: '/recipes/server-state-sync' },
      //       { text: 'Optimistic Updates', link: '/recipes/optimistic-updates' },
      //       { text: 'Background Refresh', link: '/recipes/background-refresh' },
      //       { text: 'Offline Support', link: '/recipes/offline-support' }
      //     ]
      //   },
      //   {
      //     text: 'Security Recipes',
      //     items: [
      //       { text: 'Row Level Security', link: '/recipes/row-level-security' },
      //       { text: 'JWT Authentication', link: '/recipes/jwt-auth' },
      //       { text: 'Role-based Access', link: '/recipes/rbac-implementation' },
      //       { text: 'Data Validation', link: '/recipes/data-validation' }
      //     ]
      //   },
      //   {
      //     text: 'Performance Recipes',
      //     items: [
      //       { text: 'Query Optimization', link: '/recipes/query-optimization' },
      //       { text: 'Caching Patterns', link: '/recipes/caching-patterns' },
      //       { text: 'Batch Operations', link: '/recipes/batch-operations' },
      //       { text: 'Connection Pooling', link: '/recipes/connection-pooling' }
      //     ]
      //   },
      //   {
      //     text: 'Testing Recipes',
      //     items: [
      //       { text: 'Unit Testing', link: '/recipes/unit-testing' },
      //       { text: 'Integration Testing', link: '/recipes/integration-testing' },
      //       { text: 'Mock Strategies', link: '/recipes/mock-strategies' },
      //       { text: 'Test Data Management', link: '/recipes/test-data' }
      //     ]
      //   }
      // ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/webcodedsoft/pgrestify' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 PGRestify Contributors'
    },

    editLink: {
      pattern: 'https://github.com/webcodedsoft/pgrestify/edit/main/docs-site/:path'
    },

    search: {
      provider: 'local'
    }
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    lineNumbers: true
  }
})