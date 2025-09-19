# Changelog

All notable changes to PGRestify will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-19

### 🎉 Initial Release

PGRestify is a comprehensive TypeScript library and CLI tool that provides type-safe client generation for PostgREST APIs. This first release includes all core features for production use.

### ✨ Features

#### Core Functionality
- **Type-Safe Client Generation**: Automatically generates TypeScript types from PostgreSQL schema
- **Schema Introspection**: Direct connection to PostgreSQL for accurate schema analysis
- **Advanced Query Builder**: Fluent API with full PostgREST operations support
- **Real-time Subscriptions**: WebSocket support for live data updates
- **Policy Management**: Generate and manage Row Level Security (RLS) policies
- **Migration System**: Database migration management with version control

#### Framework Integrations
- **React Hooks**: Custom hooks for data fetching with automatic type inference
- **TanStack Query**: Full integration with type safety and caching
- **Next.js Support**: Optimized for both App Router and Pages Router
- **Server-Side Rendering**: Built-in SSR/SSG support with hydration

#### Developer Experience
- **CLI Tool**: Interactive project initialization and management
- **Project Templates**: Quick-start templates for common use cases
- **IntelliSense Support**: Full IDE autocomplete for all operations
- **Error Messages**: Helpful error messages with recovery suggestions
- **Documentation**: Comprehensive docs with examples

#### Type System
- **Nullable Fields**: Proper handling of NULL values
- **Array Types**: Support for PostgreSQL array columns
- **JSON/JSONB**: Full support for JSON operations
- **Custom Types**: Domain types and composite types
- **Enum Generation**: Automatic enum type creation
- **Partial Types**: Separate insert/update/select types

#### Query Features
- **Complex Filters**: All PostgREST filter operations
- **Nested Relations**: Deep relation fetching with type safety
- **Aggregations**: COUNT, SUM, AVG with proper typing
- **Full-Text Search**: Built-in text search capabilities
- **Ordering & Pagination**: Type-safe sorting and pagination
- **Bulk Operations**: Batch insert/update/delete support

#### Performance
- **Connection Pooling**: Efficient database connections
- **Query Optimization**: Smart query generation
- **Caching Strategies**: Built-in cache management
- **Bundle Size**: Optimized for minimal footprint (~15KB gzipped)

### 📦 Package Exports

- `pgrestify` - Main library with client and types
- `pgrestify/react` - React hooks and components
- `pgrestify/tanstack-query` - TanStack Query integration
- `pgrestify/nextjs` - Next.js utilities and middleware

### 🛠️ CLI Commands

- `pgrestify init` - Initialize new project
- `pgrestify api generate` - Generate types and client
- `pgrestify api pull` - Pull schema from database
- `pgrestify api setup roles` - Setup database roles
- `pgrestify frontend init` - Initialize frontend project

### 📋 Requirements

- Node.js 18.0.0 or higher
- PostgreSQL 12+ with PostgREST 9.0+
- TypeScript 4.5+ for generated code

### 🔗 Links

- Documentation: https://pgrestify.dev
- GitHub: https://github.com/pgrestify/pgrestify
- npm: https://www.npmjs.com/package/pgrestify

---

[1.0.0]: https://github.com/pgrestify/pgrestify/releases/tag/v1.0.0