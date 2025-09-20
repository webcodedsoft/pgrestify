# CLI Overview

PGRestify CLI is a comprehensive command-line tool designed to streamline PostgREST development. It provides separate commands for frontend client projects and backend API configuration, ensuring security and clarity in your development workflow.

## Installation

Install PGRestify CLI globally or as a project dependency:

```bash
# Global installation (recommended for CLI usage)
npm install -g @webcoded/pgrestify

# Or as a project dependency
npm install --save-dev pgrestify

# Verify installation
pgrestify --version
```

## Command Structure

The CLI is organized into three main categories:

### 1. Frontend Commands (Client-Safe)
Commands that are safe for client-side projects and never handle credentials:

```bash
pgrestify frontend init     # Initialize a frontend project
pgrestify frontend types    # Generate TypeScript types from PostgREST API
pgrestify frontend hooks    # Generate React hooks
```

### 2. API/Backend Commands (Server-Side)
Commands for PostgREST configuration and database management:

```bash
pgrestify api init          # Initialize complete PostgREST project
pgrestify api migrate       # Run database migrations
pgrestify api schema        # Schema generation and validation
pgrestify api functions     # PostgreSQL function management
pgrestify api config        # Configuration generators
pgrestify api features      # Database features (views, triggers, indexes)
```

### 3. Shared Commands
Commands that work across both contexts:

```bash
pgrestify validate          # Validate project configuration
pgrestify --help           # Show all available commands
pgrestify --version        # Display CLI version
```

## Quick Start

### For Frontend Projects

Initialize a new frontend project with PGRestify:

```bash
# Interactive setup
pgrestify frontend init

# Non-interactive with defaults
pgrestify frontend init --skip-prompts

# Generate TypeScript types from your API
pgrestify frontend types --url http://localhost:3000
```

### For Full-Stack Projects

Set up a complete PostgREST API with database:

```bash
# Initialize with interactive prompts
pgrestify api init

# Quick setup with template
pgrestify api init --template blog --skip-prompts

# Run the generated setup
npm run pgrestify:setup
npm run pgrestify:start
```

## Command Categories

### Frontend Development
- **Project initialization**: Set up React, Vue, or vanilla JavaScript projects
- **Type generation**: Create TypeScript definitions from PostgREST schema
- **Hook generation**: Generate framework-specific hooks for data fetching
- **Component scaffolding**: Create CRUD components with best practices

### API Development
- **Project scaffolding**: Complete PostgREST project structure
- **Database migrations**: SQL migration management system
- **Schema generation**: Tables, RLS policies, and relationships
- **Function creation**: PostgreSQL functions and RPC endpoints
- **Feature generators**: Views, triggers, indexes, and more

### Configuration Management
- **PostgREST config**: Generate optimized PostgREST configuration
- **Docker setup**: Docker Compose for development and production
- **Environment management**: Secure environment variable handling
- **Security validation**: Scan for vulnerabilities and misconfigurations

## Global Options

All commands support these global options:

```bash
--help, -h              # Show help for any command
--version, -v           # Display version information
--verbose               # Enable detailed logging
--quiet                 # Suppress non-essential output
--no-color             # Disable colored output
--config <path>        # Use custom configuration file
```

## Interactive vs Non-Interactive Mode

Most commands support both interactive and non-interactive modes:

```bash
# Interactive mode (default) - with prompts
pgrestify api init

# Non-interactive mode - uses defaults or flags
pgrestify api init --skip-prompts --template blog

# Specify all options via flags
pgrestify api init \
  --name my-api \
  --template ecommerce \
  --database-url postgresql://user:pass@localhost/db \
  --skip-prompts
```

## Configuration File

PGRestify looks for configuration in these locations (in order):

1. `pgrestify.config.js` or `pgrestify.config.json` in project root
2. `.pgrestifyrc` in project root
3. `pgrestify` field in `package.json`
4. Default configuration

Example `pgrestify.config.js`:

```javascript
module.exports = {
  // API configuration
  api: {
    url: process.env.POSTGREST_URL || 'http://localhost:3000',
    schema: 'api',
    anonKey: process.env.POSTGREST_ANON_KEY,
  },
  
  // Database configuration
  database: {
    url: process.env.DATABASE_URL,
    schema: 'public',
    migrations: './migrations',
  },
  
  // Generation options
  generation: {
    typescript: true,
    outputDir: './src/generated',
    hooks: true,
  },
  
  // Docker configuration
  docker: {
    postgresVersion: '15-alpine',
    postgrestVersion: 'latest',
    network: 'pgrestify_network',
  },
};
```

## Environment Variables

The CLI respects these environment variables:

```bash
# API Configuration
POSTGREST_URL              # PostgREST API URL
POSTGREST_ANON_KEY        # Anonymous/public API key
POSTGREST_SERVICE_KEY     # Service role key (admin)

# Database Configuration
DATABASE_URL              # PostgreSQL connection string
POSTGRES_USER            # Database user
POSTGRES_PASSWORD        # Database password
POSTGRES_DB              # Database name

# CLI Behavior
PGRESTIFY_SKIP_PROMPTS   # Skip all interactive prompts
PGRESTIFY_VERBOSE        # Enable verbose logging
PGRESTIFY_CONFIG         # Path to config file
NO_COLOR                 # Disable colored output
```

## Security Best Practices

The CLI implements several security measures:

1. **Command Separation**: Frontend commands never handle credentials
2. **Secret Detection**: Warns when secrets might be exposed
3. **Secure Defaults**: Generated configs use environment variables
4. **Git Integration**: Automatically updates `.gitignore` for sensitive files
5. **Validation**: Built-in security scanning and configuration validation

## Error Handling

The CLI provides clear error messages and recovery suggestions:

```bash
# Verbose error output
pgrestify api init --verbose

# Common errors and solutions:
# - Port conflicts: Change POSTGRES_PORT in .env
# - Missing dependencies: Run npm install
# - Database connection: Check DATABASE_URL
# - Permission issues: Check file/directory permissions
```

## Extending the CLI

Create custom commands using the plugin system:

```javascript
// pgrestify-plugin-custom.js
module.exports = {
  name: 'custom',
  description: 'Custom command',
  action: async (options) => {
    console.log('Custom command executed', options);
  },
};
```

Register in configuration:

```javascript
// pgrestify.config.js
module.exports = {
  plugins: ['./pgrestify-plugin-custom.js'],
};
```

## Getting Help

### Command Help
```bash
# General help
pgrestify --help

# Command-specific help
pgrestify api init --help
pgrestify frontend types --help
```

### Documentation
- [Project Initialization Guide](./project-init.md)
- [Migration System](./migrations.md)
- [Configuration Reference](./configuration.md)
- [Security Guide](./security.md)

### Support
- GitHub Issues: [Report bugs or request features](https://github.com/pgrestify/pgrestify/issues)
- Documentation: [Full documentation](https://pgrestify.dev)
- Discord Community: [Join our Discord](https://discord.gg/pgrestify)

## Version Compatibility

| PGRestify CLI | PostgREST | PostgreSQL | Node.js |
|---------------|-----------|------------|---------|
| 1.0.x         | 11.x-12.x | 13-16      | 16+     |
| 0.9.x         | 10.x-11.x | 12-15      | 14+     |

## Summary

PGRestify CLI provides a complete toolkit for PostgREST development with clear separation between frontend and backend concerns. It emphasizes security, developer experience, and best practices while maintaining flexibility for different project requirements.