name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  release:
    types: [published]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-and-type-check:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run ESLint
        run: pnpm lint

      - name: Run Prettier check
        run: pnpm format:check

      - name: Type check
        run: pnpm typecheck

  test:
    name: Test Suite
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 21]
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      postgrest:
        image: postgrest/postgrest:v12
        env:
          PGRST_DB_URI: postgresql://postgres:postgres@postgres:5432/test
          PGRST_DB_SCHEMA: public
          PGRST_DB_ANON_ROLE: postgres
          PGRST_OPENAPI_MODE: follow-privileges
          PGRST_OPENAPI_SECURITY_ACTIVE: false
        options: >-
          --health-cmd "curl -f http://localhost:3000/ || exit 1"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 3000:3000

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Setup test database
        run: |
          PGPASSWORD=postgres psql -h localhost -U postgres -d test -c "
            CREATE TABLE IF NOT EXISTS users (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT UNIQUE NOT NULL,
              active BOOLEAN DEFAULT true,
              age INTEGER,
              created_at TIMESTAMP DEFAULT NOW()
            );
            
            CREATE TABLE IF NOT EXISTS posts (
              id SERIAL PRIMARY KEY,
              title TEXT NOT NULL,
              content TEXT,
              user_id INTEGER REFERENCES users(id),
              published BOOLEAN DEFAULT false,
              created_at TIMESTAMP DEFAULT NOW()
            );
            
            INSERT INTO users (name, email, age) VALUES 
              ('John Doe', 'john@example.com', 25),
              ('Jane Smith', 'jane@example.com', 30),
              ('Bob Wilson', 'bob@example.com', 35);
          "

      - name: Wait for PostgREST
        run: |
          for i in {1..30}; do
            if curl -f http://localhost:3000/; then
              echo "PostgREST is ready"
              break
            fi
            echo "Waiting for PostgREST... ($i/30)"
            sleep 2
          done

      - name: Run unit tests
        run: pnpm test:unit
        env:
          POSTGREST_URL: http://localhost:3000

      - name: Run integration tests
        run: pnpm test:integration
        env:
          POSTGREST_URL: http://localhost:3000

      - name: Run coverage
        run: pnpm test:coverage
        env:
          POSTGREST_URL: http://localhost:3000

      - name: Upload coverage to Codecov
        if: matrix.node-version == '20'
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          fail_ci_if_error: true

  build:
    name: Build Library
    runs-on: ubuntu-latest
    needs: [lint-and-type-check, test]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build library
        run: pnpm build

      - name: Check bundle size
        run: pnpm size-limit

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: |
            dist/
            package.json
            README.md
            LICENSE
          retention-days: 30

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [build]
    strategy:
      matrix:
        framework: [react, vue, vanilla]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run E2E tests for ${{ matrix.framework }}
        run: pnpm test:e2e:${{ matrix.framework }}

  security-audit:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run security audit
        run: pnpm audit --audit-level moderate

      - name: Run dependency check
        uses: actions/dependency-review-action@v3
        if: github.event_name == 'pull_request'

  publish:
    name: Publish to NPM
    runs-on: ubuntu-latest
    needs: [lint-and-type-check, test, build, e2e-tests, security-audit]
    if: github.event_name == 'release' && github.event.action == 'published'
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build library
        run: pnpm build

      - name: Publish to NPM
        run: pnpm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  docs:
    name: Build & Deploy Docs
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    needs: [lint-and-type-check, test, build]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build documentation
        run: pnpm docs:build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs/.vitepress/dist