# OpenMetadata E2E Test Documentation

This directory contains auto-generated documentation for all Playwright E2E tests.

## Quick Stats

- **Total Components:** 15
- **Total Test Files:** 148
- **Total Tests:** 923

## Generating Documentation

To regenerate the documentation after adding/modifying tests:

```bash
cd openmetadata-ui/src/main/resources/ui
npx ts-node playwright/docs/scripts/generate-docs.ts
```

## Viewing Locally

### Option 1: Jekyll (Recommended)

```bash
cd playwright/docs
bundle install
bundle exec jekyll serve
```

Open http://localhost:4000 in your browser.

### Option 2: Simple HTTP Server

```bash
cd playwright/docs
python -m http.server 8000
```

Open http://localhost:8000 in your browser (Markdown won't render).

## GitHub Pages Deployment

### Manual Setup

1. Go to repository Settings > Pages
2. Set Source to "GitHub Actions"
3. Add workflow file at `.github/workflows/docs.yml`:

```yaml
name: Deploy E2E Test Docs

on:
  push:
    branches: [main]
    paths:
      - 'openmetadata-ui/src/main/resources/ui/playwright/**'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Generate docs
        working-directory: openmetadata-ui/src/main/resources/ui
        run: |
          yarn install
          npx ts-node playwright/docs/scripts/generate-docs.ts

      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true
          working-directory: openmetadata-ui/src/main/resources/ui/playwright/docs

      - name: Build Jekyll site
        working-directory: openmetadata-ui/src/main/resources/ui/playwright/docs
        run: bundle exec jekyll build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: openmetadata-ui/src/main/resources/ui/playwright/docs/_site

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## Directory Structure

```
playwright/docs/
├── _config.yml           # Jekyll configuration
├── Gemfile               # Ruby dependencies
├── index.md              # Home page
├── components.md         # Components overview
├── components/           # Generated component pages
│   ├── glossary.md
│   ├── data-assets.md
│   ├── users-teams.md
│   └── ...
└── scripts/
    └── generate-docs.ts  # Documentation generator
```

## Component Categories

| Category | Description |
|----------|-------------|
| Glossary | Business glossary and term management (288 tests) |
| Data Assets | Tables, Topics, Dashboards, Pipelines (177 tests) |
| Users & Teams | User and team management (91 tests) |
| Data Quality | Test suites, profiler, incidents (77 tests) |
| Settings | System configuration (51 tests) |
| Search | Search and exploration (48 tests) |
| Domains | Domain hierarchy and data products (35 tests) |
| Tags | Tags, tiers, classification (28 tests) |
| Lineage | Data lineage tracking (23 tests) |
| UI Components | Common UI components (21 tests) |
| Activity | Activity feeds, tasks, alerts (15 tests) |
| Services | Service connections (11 tests) |
| Data Insights | Analytics and KPIs (11 tests) |
| Access Control | Roles, policies, permissions (3 tests) |
