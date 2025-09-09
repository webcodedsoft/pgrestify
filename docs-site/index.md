---
layout: home
title: PGRestify
titleTemplate: The Definitive PostgREST Client

hero:
  name: PGRestify
  text: The Definitive PostgREST Client
  tagline: TypeScript-first, zero-config, enterprise-grade PostgREST client with TypeORM-inspired API
  image:
    src: /images/logo.png
    alt: PGRestify
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/webcodedsoft/pgrestify

---

## Why PGRestify?

<div class="tip custom-block" style="padding-top: 8px">

**Zero Configuration** - Unlike other PostgREST clients that require API keys and complex setup, PGRestify works immediately with just a URL.

</div>

<div class="tip custom-block" style="padding-top: 8px">

**TypeORM-Inspired** - Familiar API that developers already know and love, with full TypeScript support.

</div>

<div class="tip custom-block" style="padding-top: 8px">

**PostgreSQL Native** - Built for PostgreSQL's role-based security model, not retrofitted from other databases.

</div>

<div class="tip custom-block" style="padding-top: 8px">

**Production Ready** - Real-time, caching, SSR, Docker support, and enterprise-grade features out of the box.

</div>

## 📚 Documentation Guide

<div class="documentation-cards">
  <div class="doc-card">
    <div class="doc-icon">🚀</div>
    <h3><a href="/guide/getting-started">Getting Started</a></h3>
    <p>Quick start guide, installation options, and prerequisites to get up and running with PGRestify in minutes.</p>
  </div>
  
  <div class="doc-card">
    <div class="doc-icon">🏗️</div>
    <h3><a href="/guide/client-creation">Core Concepts</a></h3>
    <p>Essential concepts including client creation, query building, data fetching, mutations, and error handling.</p>
  </div>
  
  <div class="doc-card">
    <div class="doc-icon">🛠️</div>
    <h3><a href="/guide/cli">CLI & Development Tools</a></h3>
    <p>Complete command-line tool for project setup, schema generation, migrations, and development workflow.</p>
  </div>
  
  <div class="doc-card">
    <div class="doc-icon">🎯</div>
    <h3><a href="/guide/typeorm-style/repository-pattern">TypeORM-Style API</a></h3>
    <p>Familiar find(), findBy(), save() methods with repository pattern and complete type safety.</p>
  </div>
  
  <div class="doc-card">
    <div class="doc-icon">🔍</div>
    <h3><a href="/guide/basic-queries">Advanced Querying</a></h3>
    <p>Master filtering, relationships, pagination, full-text search, and all PostgREST query capabilities.</p>
  </div>
  
  <div class="doc-card">
    <div class="doc-icon">⚛️</div>
    <h3><a href="/guide/react-hooks">React Integration</a></h3>
    <p>React hooks, TanStack Query integration, data fetching patterns, and mutation handling.</p>
  </div>
  
  <div class="doc-card">
    <div class="doc-icon">▲</div>
    <h3><a href="/guide/nextjs">Next.js Integration</a></h3>
    <p>App Router, Pages Router, Server Components, API routes, and authentication flows.</p>
  </div>
  
  <div class="doc-card">
    <div class="doc-icon">🔄</div>
    <h3><a href="/guide/authentication">Advanced Features</a></h3>
    <p>Authentication, real-time subscriptions, caching, transformations, and production deployment.</p>
  </div>
</div>

<style>
.documentation-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.doc-card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.doc-card:hover {
  transform: translateY(-2px);
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.doc-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
  display: block;
}

.doc-card h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.doc-card h3 a {
  text-decoration: none;
  color: var(--vp-c-text-1);
}

.doc-card h3 a:hover {
  color: var(--vp-c-brand-1);
}

.doc-card p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>

---

<div style="text-align: center; margin: 2rem 0;">
  <a href="/guide/getting-started" class="button" style="margin-right: 1rem;">🚀 Get Started</a>
  <a href="/guide/cli" class="button" style="margin-right: 1rem;">🛠️ CLI Guide</a>
  <a href="/guide/react-hooks" class="button" style="margin-right: 1rem;">⚛️ React Integration</a>
  <a href="/guide/tanstack-query" class="button">🔄 TanStack Query</a>
</div>