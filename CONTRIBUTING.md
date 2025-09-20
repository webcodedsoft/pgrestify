# Contributing to PGRestify

Thank you for your interest in contributing to PGRestify! We welcome contributions from the community and are excited to work with you.

## 🚀 Quick Start for Contributors

1. **Fork and Clone**
   ```bash
   git clone https://github.com/webcodedsoft/pgrestify-v1.git
   cd pgrestify-v1
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Start Development**
   ```bash
   # Start development mode
   pnpm dev:full
   
   # Or run individual components
   pnpm dev          # Main library
   pnpm dev:cli      # CLI tools
   pnpm docs:dev     # Documentation site
   ```

## 📋 Development Guidelines

### Code Standards

- **TypeScript**: All code must be written in TypeScript with strict mode enabled
- **ESLint**: Follow the existing ESLint configuration
- **Prettier**: Use Prettier for consistent code formatting
- **Testing**: Write tests for new features and bug fixes

### Code Style

```typescript
// Use descriptive variable names
const userRepository = client.getRepository<User>('users');

// Prefer const over let when possible
const users = await userRepository.find();

// Use async/await over Promises
async function fetchUserData(id: number): Promise<User | null> {
  return await userRepository.findOne({ id });
}

// Document complex functions
/**
 * Creates a cached query builder with automatic invalidation
 * @param tableName - The database table name
 * @param cacheKey - Optional cache key override
 */
function createCachedQueryBuilder(tableName: string, cacheKey?: string) {
  // Implementation...
}
```

## 🐛 Reporting Issues

Before creating an issue, please:

1. **Search existing issues** to avoid duplicates
2. **Use the latest version** of PGRestify
3. **Provide a minimal reproduction** when possible
4. **Include relevant environment details**

### Issue Types

- **🐛 Bug Report**: Something isn't working correctly
- **✨ Feature Request**: Suggest a new feature or enhancement
- **📚 Documentation**: Improvements to documentation
- **🔧 Enhancement**: Improvements to existing features

## 🔧 Development Workflow

### Setting Up Your Environment

1. **Node.js**: Version 18+ required
2. **pnpm**: Preferred package manager
3. **PostgreSQL**: For integration testing (optional)
4. **Docker**: For testing with containerized databases (optional)

### Branch Naming

Use descriptive branch names:
- `feature/add-orm-patterns`
- `fix/cache-invalidation-bug`
- `docs/update-getting-started`
- `refactor/query-builder-types`

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Examples:
- `feat(client): add repository pattern support`
- `fix(cache): resolve memory leak in query cache`
- `docs(readme): update installation instructions`
- `test(cli): add integration tests for init command`

### Testing

Run tests before submitting:

```bash
# All tests
pnpm test

# Specific test suites
pnpm test:unit
pnpm test:integration
pnpm test:cli

# With coverage
pnpm test:coverage

# Type checking
pnpm typecheck
```

### Building

Ensure your changes build successfully:

```bash
# Build library
pnpm build

# Build CLI
pnpm build:cli

# Build all
pnpm build:all

# Build documentation
pnpm docs:build
```

## 📝 Pull Request Process

### Before Submitting

1. **Test thoroughly**: Run all tests and ensure they pass
2. **Update documentation**: Include relevant documentation updates
3. **Check bundle size**: Ensure no significant size increases
4. **Review your changes**: Self-review your code for quality

### PR Requirements

- [ ] **Tests**: All new features have tests
- [ ] **Documentation**: Updated docs for API changes
- [ ] **Type Safety**: Maintains TypeScript strict mode compliance
- [ ] **Backwards Compatibility**: No breaking changes without discussion
- [ ] **Performance**: No significant performance regressions

### PR Description Template

Your PR will automatically include our template, but here's what to include:

```markdown
## Summary
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring
- [ ] Performance improvement

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Breaking Changes
- [ ] No breaking changes
- [ ] Breaking changes (describe below)

## Screenshots/Examples
If applicable, add screenshots or code examples
```

## 🏗️ Architecture Overview

### Core Components

- **Client**: Main entry point (`src/core/client.ts`)
- **Query Builder**: Fluent API (`src/core/query-builder.ts`)
- **Repository**: ORM-style patterns (`src/core/repository.ts`)
- **Cache**: Intelligent caching (`src/core/cache.ts`)
- **Adapters**: Framework integrations (`src/adapters/`)

### Key Concepts

1. **Dual Query Syntax**: Support both PostgREST native and ORM-style
2. **Type Safety**: Generate types from database schema
3. **Framework Agnostic Core**: With specific adapters for React/Next.js
4. **Performance**: Caching, connection pooling, and optimization

## 🧪 Testing Guidelines

### Test Structure

```typescript
describe('Repository Pattern', () => {
  let client: PGRestifyClient;
  
  beforeEach(() => {
    client = createTestClient();
  });
  
  describe('findOne', () => {
    it('should return single record', async () => {
      const repo = client.getRepository<User>('users');
      const user = await repo.findOne({ id: 1 });
      
      expect(user).toBeDefined();
      expect(user?.id).toBe(1);
    });
  });
});
```

### Mock Data

Use realistic test data:

```typescript
const mockUser: User = {
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  active: true,
  created_at: '2024-01-01T00:00:00Z'
};
```

## 📚 Documentation

### API Documentation

- Use JSDoc for all public APIs
- Include examples in documentation
- Update TypeScript definitions

```typescript
/**
 * Creates a new client instance with configuration
 * 
 * @example
 * ```typescript
 * const client = createClient({
 *   url: 'http://localhost:3000',
 *   auth: { persistSession: true }
 * });
 * ```
 */
export function createClient(config: ClientConfig): PGRestifyClient {
  // Implementation...
}
```

### Guide Documentation

Update relevant guides in `docs-site/guide/`:
- Getting Started
- Core Concepts  
- Framework Integration
- Advanced Features

## 🚀 Release Process

### Version Bumping

We follow semantic versioning:
- **Patch** (1.0.1): Bug fixes
- **Minor** (1.1.0): New features, backwards compatible
- **Major** (2.0.0): Breaking changes

### Changelog

Update `CHANGELOG.md` with your changes:

```markdown
## [1.1.0] - 2024-01-01

### Added
- Repository pattern support
- Enhanced caching system

### Fixed
- Memory leak in query cache
- Type inference issues

### Changed
- Improved error messages
```

## 🤝 Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Follow GitHub's Community Guidelines

### Getting Help

- **Discord**: Join our community server
- **GitHub Discussions**: Ask questions and share ideas
- **Issues**: Report bugs and request features
- **Documentation**: Check the comprehensive guides

### Recognition

Contributors are recognized in:
- `README.md` contributors section
- Release notes for major contributions
- GitHub contributors graph

## 🛠️ Advanced Contributing

### CLI Development

When working on CLI features:

```bash
# Test CLI locally
./dist-cli/index.js --help

# Test with specific commands
./dist-cli/index.js init test-project --template basic
```

### Database Testing

For database integration tests:

```bash
# Using Docker
docker compose up -d postgres

# Or use your local PostgreSQL
createdb pgrestify_test
```

### Documentation Development

```bash
# Start documentation server
pnpm docs:dev

# Build and test
pnpm docs:build
```

## 📊 Performance Considerations

### Bundle Size

Monitor bundle size with:

```bash
pnpm size-limit
```

Keep core library under 15KB gzipped.

### Memory Usage

- Use WeakMap for caching when appropriate
- Clean up event listeners
- Avoid memory leaks in long-running processes

### Database Performance

- Test with realistic dataset sizes
- Consider query optimization
- Monitor connection pooling

## 🎯 Contribution Ideas

Looking for ways to contribute? Consider:

### High Impact
- **Performance optimizations**
- **Better error messages**
- **Framework adapters** (Vue, Angular support)
- **Real-time subscriptions**

### Documentation
- **More examples**
- **Video tutorials**
- **Migration guides**
- **Best practices**

### Testing
- **Integration tests**
- **Browser compatibility**
- **Edge case scenarios**
- **Performance benchmarks**

### Tooling
- **CLI enhancements**
- **VS Code extension**
- **Browser DevTools**
- **Debugging utilities**

## 📞 Contact

- **Maintainers**: @webcodedsoft
- **Email**: support@pgrestify.com
- **Website**: https://pgrestify.netlify.app
- **GitHub**: https://github.com/webcodedsoft/pgrestify-v1

---

Thank you for contributing to PGRestify! Your efforts help make this library better for everyone. 🚀