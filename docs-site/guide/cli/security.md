# Security & Validation

PGRestify CLI includes comprehensive security validation and enforcement tools to prevent exposing secrets, credentials, and sensitive data. The CLI automatically scans for vulnerabilities and provides recommendations for secure deployment practices.

## Overview

Security features include:

- **Credential Detection**: Scan for exposed secrets and passwords
- **Frontend Safety**: Prevent backend secrets in client-side code
- **Configuration Validation**: Verify secure configuration settings
- **RLS Policy Generation**: Implement Row Level Security automatically
- **Environment Segregation**: Separate frontend and backend concerns
- **Production Hardening**: Apply security best practices

## Security Validation

### Project Validation

Validate your entire project for security issues:

```bash
# Comprehensive security validation
pgrestify validate

# Security validation only
pgrestify validate --security

# Configuration validation only  
pgrestify validate --config

# Validate specific files
pgrestify validate --files src/config.ts,src/auth.ts
```

### Validation Options

```bash
pgrestify validate [options]

Options:
  --security             Run security validation only
  --config               Validate configuration files only
  --files <list>         Comma-separated list of files to validate
  --verbose              Show detailed validation output
  --fix                  Auto-fix issues where possible
  --report <file>        Generate security report
```

### Security Risk Levels

The validator categorizes issues by severity:

- **CRITICAL**: Exposed credentials, JWT secrets in frontend code
- **HIGH**: Insecure HTTP, weak authentication
- **MEDIUM**: Missing security headers, weak configurations
- **LOW**: Suboptimal settings, missing best practices
- **INFO**: Recommendations and suggestions

## Common Security Issues

### Critical Issues (SEC001-SEC010)

#### SEC001: JWT Secret in Frontend Code
```typescript
// ❌ CRITICAL: Never expose JWT secrets in frontend
const JWT_SECRET = "my-secret-key";  // Detected by scanner

// ✅ Correct: Use environment variables on server
const JWT_SECRET = process.env.JWT_SECRET;  // Server-side only
```

#### SEC002: Database Credentials in Frontend
```typescript
// ❌ CRITICAL: Database URLs expose credentials
const DATABASE_URL = "postgresql://user:pass@localhost:5432/db";

// ✅ Correct: Connect through PostgREST API
const API_URL = "https://api.myapp.com";  // Public API endpoint
```

#### SEC003: Hardcoded Credentials
```typescript
// ❌ CRITICAL: Hardcoded passwords detected
const config = {
  password: "admin123",      // Detected by scanner
  apiKey: "sk_live_12345"    // Detected by scanner
};

// ✅ Correct: Use environment variables
const config = {
  password: process.env.ADMIN_PASSWORD,
  apiKey: process.env.API_KEY
};
```

### High Risk Issues (SEC004-SEC020)

#### SEC004: Insecure HTTP in Production
```bash
# ❌ HIGH: HTTP is insecure for production
POSTGREST_URL=http://api.myapp.com

# ✅ Correct: Always use HTTPS in production
POSTGREST_URL=https://api.myapp.com
```

#### SEC005: Weak JWT Configuration
```ini
# ❌ HIGH: JWT secret too short
jwt-secret = "short"

# ✅ Correct: Minimum 32 characters
jwt-secret = "secure-jwt-secret-minimum-32-characters"
```

#### SEC006: Permissive CORS Settings
```ini
# ❌ HIGH: Wildcard CORS in production
server-cors-allowed-origins = "*"

# ✅ Correct: Specific domains only
server-cors-allowed-origins = "https://myapp.com,https://admin.myapp.com"
```

### Medium Risk Issues (SEC021-SEC040)

#### SEC021: Missing Row Level Security
```sql
-- ❌ MEDIUM: Table without RLS policies
CREATE TABLE sensitive_data (
  id UUID PRIMARY KEY,
  user_id UUID,
  private_info TEXT
);

-- ✅ Correct: Enable RLS with policies
ALTER TABLE sensitive_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_data" ON sensitive_data FOR ALL TO authenticated
  USING (user_id = auth.uid());
```

#### SEC022: Excessive Database Permissions
```sql
-- ❌ MEDIUM: Too permissive grants  
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;

-- ✅ Correct: Minimal required permissions
GRANT SELECT ON specific_table TO anon;
GRANT INSERT, UPDATE ON user_data TO authenticated;
```

## Security Validation Output

### Validation Report

```bash
$ pgrestify validate --security

🔍 Validating PGRestify project...

Project type: fullstack

📊 Security Validation Results:

CRITICAL Issues (2):
  ❌ SEC001: JWT secret exposed in src/config.ts:12
     Suggestion: Move JWT_SECRET to server-side environment variables
     
  ❌ SEC002: Database URL in frontend code at src/api.ts:5  
     Suggestion: Use PostgREST API endpoint instead

HIGH Issues (1):
  ⚠️  SEC004: HTTP URL detected in production config
     File: postgrest.conf:8
     Suggestion: Use HTTPS for production deployment

MEDIUM Issues (3):
  ⚠️  SEC021: RLS not enabled on 'users' table
     File: sql/02-tables/users/table.sql
     Suggestion: Enable Row Level Security policies

  ⚠️  SEC022: Overly permissive CORS settings
     File: postgrest.conf:12
     Suggestion: Restrict CORS to specific domains

  ⚠️  SEC025: No rate limiting configured
     Suggestion: Add rate limiting in reverse proxy

LOW Issues (2):
  ℹ️  SEC031: Missing security headers
  ℹ️  SEC035: Consider adding request size limits

Security Score: 6/10 (Poor)
Issues Found: 2 critical, 1 high, 3 medium, 2 low

❌ FAILED - Critical security issues must be resolved before deployment
```

### Auto-Fix Capabilities

The CLI can automatically fix some security issues:

```bash
# Auto-fix non-breaking security issues
pgrestify validate --fix

# Preview fixes without applying
pgrestify validate --fix --dry-run
```

Auto-fixable issues:
- Add missing RLS policies to tables
- Update HTTP URLs to HTTPS in configs
- Generate secure JWT secrets
- Add missing security headers
- Update permissive CORS settings

## Project Type Security

### Frontend Project Security

Frontend projects have different security requirements:

```bash
# Frontend-specific validation
pgrestify frontend validate

Allowed in frontend:
  ✅ PostgREST API endpoints (HTTPS only)
  ✅ Public API keys (marked as public)
  ✅ Client-side configuration
  ✅ Authentication flow (no secrets)

Forbidden in frontend:
  ❌ JWT secrets or signing keys
  ❌ Database connection strings
  ❌ Server-side API keys
  ❌ Service account credentials
  ❌ Internal service URLs
```

### Backend Project Security

Backend projects require different security measures:

```bash
# Backend-specific validation  
pgrestify api validate

Required for backend:
  ✅ Environment variable usage
  ✅ Secure credential storage
  ✅ RLS policies on all tables
  ✅ Proper role separation
  ✅ Input validation functions

Security hardening:
  ✅ JWT secret minimum length (32+ chars)
  ✅ HTTPS-only in production
  ✅ Rate limiting configuration
  ✅ Request timeout limits
  ✅ Connection pool limits
```

## Row Level Security (RLS)

### Automatic RLS Generation

Generate secure RLS policies for your tables:

```bash
# Generate RLS for specific table
pgrestify api generate policy users --pattern user_specific

# Generate RLS for all tables
pgrestify api generate policy --all-tables --pattern admin_full

# Generate with custom patterns
pgrestify api generate policy posts --pattern "public_read,user_own,admin_full"
```

### RLS Security Patterns

#### User-Specific Access
```sql
-- Users can only access their own records
CREATE POLICY "users_own_records" ON user_data
  FOR ALL TO authenticated
  USING (user_id = auth.uid());
```

#### Public Read, User Write
```sql  
-- Anyone can read, authenticated users can manage their own
CREATE POLICY "posts_public_read" ON posts
  FOR SELECT TO anon, authenticated
  USING (published = true);

CREATE POLICY "posts_user_own" ON posts  
  FOR INSERT, UPDATE, DELETE TO authenticated
  USING (author_id = auth.uid());
```

#### Role-Based Access
```sql
-- Different access levels by user role
CREATE POLICY "admin_full_access" ON sensitive_data
  FOR ALL TO admin_role
  USING (true);

CREATE POLICY "user_limited_access" ON sensitive_data
  FOR SELECT TO user_role  
  USING (user_id = auth.uid() AND status = 'active');
```

## Environment Security

### Environment Segregation

Separate environment configurations for security:

```bash
# Development environment (.env.development)
POSTGREST_URL=http://localhost:3000          # HTTP OK for local
JWT_SECRET=dev-secret-min-32-chars          # Development secret
CORS_ORIGINS=*                               # Permissive for development
LOG_LEVEL=info                               # Verbose logging

# Production environment (.env.production)  
POSTGREST_URL=https://api.myapp.com          # HTTPS required
JWT_SECRET_FILE=/run/secrets/jwt_secret      # Secret from file
CORS_ORIGINS=https://myapp.com               # Specific domains only
LOG_LEVEL=error                              # Minimal logging
```

### Secrets Management

#### Docker Secrets
```yaml
# docker-compose.yml
services:
  postgrest:
    image: postgrest/postgrest
    environment:
      PGRST_JWT_SECRET_FILE: /run/secrets/jwt_secret
    secrets:
      - jwt_secret

secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
```

#### Environment Files
```bash
# Separate secret files by environment
secrets/
├── development/
│   ├── jwt_secret.txt
│   └── postgres_password.txt
├── staging/  
│   ├── jwt_secret.txt
│   └── postgres_password.txt
└── production/
    ├── jwt_secret.txt
    └── postgres_password.txt
```

## Security Best Practices

### Development Best Practices

1. **Never commit secrets** to version control
2. **Use `.env` files** with `.env.example` templates
3. **Validate early and often** during development
4. **Test with realistic data** using security-conscious test data
5. **Review generated code** for security implications

### Production Best Practices

1. **Enable HTTPS everywhere** - no exceptions
2. **Use secret management systems** (Docker secrets, K8s secrets)
3. **Apply principle of least privilege** to database roles
4. **Enable comprehensive audit logging**
5. **Regular security validation** in CI/CD pipelines

### Database Security

1. **Enable RLS on all user tables** by default
2. **Create role-specific policies** for different access levels
3. **Validate all function inputs** to prevent injection
4. **Use prepared statements** in all custom functions
5. **Regular security audits** of database permissions

## Continuous Security Monitoring

### CI/CD Integration

Add security validation to your deployment pipeline:

```yaml
# .github/workflows/security.yml
name: Security Validation

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install PGRestify CLI
        run: npm install -g @webcoded/pgrestify
      - name: Security Validation
        run: pgrestify validate --security --report security-report.json
      - name: Upload Security Report
        uses: actions/upload-artifact@v3
        with:
          name: security-report
          path: security-report.json
```

### Pre-commit Hooks

Prevent insecure code from being committed:

```bash
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: pgrestify-security
        name: PGRestify Security Check
        entry: pgrestify validate --security
        language: system
        pass_filenames: false
```

## Security Report Generation

Generate detailed security reports:

```bash
# Generate comprehensive security report
pgrestify validate --security --report security-audit.json

# Generate HTML report
pgrestify validate --security --report security-audit.html --format html

# Generate for compliance
pgrestify validate --security --report compliance.json --compliance sox
```

### Report Contents

Security reports include:
- Issue summary by severity
- Detailed issue descriptions
- Fix recommendations
- Compliance status
- Historical trend data
- Security score metrics

## Summary

PGRestify CLI's security features provide comprehensive protection against common vulnerabilities in PostgREST applications. From automatic credential detection to RLS policy generation, these tools ensure your application follows security best practices throughout the development lifecycle.