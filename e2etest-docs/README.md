# E2E Test Documentation Generator

Automated documentation generator for OpenMetadata's Playwright E2E tests. This tool parses test files and generates a searchable, interactive documentation site using VitePress.

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Features](#features)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

---

## Overview

This tool automatically generates comprehensive documentation from Playwright E2E test files located in `openmetadata-ui/src/main/resources/ui/playwright/e2e/`. It:

- **Parses** test files to extract test cases, describe blocks, and test steps
- **Categorizes** tests by component (Glossary, Data Assets, Services, etc.)
- **Expands** parameterized tests (e.g., `forEach` loops) to show individual test runs
- **Generates** markdown documentation with metrics and GitHub links
- **Serves** an interactive documentation site with search and navigation

---

## Quick Start

**First time setup:**

```bash
cd e2etest-docs
yarn install
```

**Then run (every time):**

```bash
yarn start
```

This will:
1. ✅ Generate documentation from test files
2. ✅ Start the development server

Open your browser to **http://localhost:5173** to view the documentation.

---

### Alternative: Step-by-Step

If you prefer to run commands separately:

```bash
# Navigate to the e2etest-docs directory
cd e2etest-docs

# Install dependencies (first time only)
yarn install

# Generate documentation from test files
yarn generate

# Start the documentation server
yarn dev
```

---

## Installation

### Prerequisites

- **Node.js** 18+ and **Yarn** package manager
- OpenMetadata repository cloned locally

### Setup

```bash
cd OpenMetadata/e2etest-docs
yarn install
```

This installs:
- VitePress (static site generator)
- TypeScript and tsx (for running generation scripts)
- Vue (used by VitePress)

---

## Usage

### Generate Documentation

Parse all test files and generate markdown documentation:

```bash
yarn generate
```

**What it does:**
1. Scans `openmetadata-ui/src/main/resources/ui/playwright/e2e/` for `.spec.ts` files
2. Parses each file to extract:
   - Test describe blocks
   - Test cases and their names
   - Test steps (using `test.step()`)
   - Parameterized tests (e.g., `forEach` loops)
3. Categorizes tests by component using filename patterns
4. Generates markdown files in `docs/` directory
5. Creates `sidebar.json` for navigation

**Output:**
```
📝 Found 133 test files. Parsing...
⚙️  Generating Markdown for 15 components...
   ✓ sidebar.json
✅ Success! Docs generated in /path/to/e2etest-docs/docs
```

### View Documentation Locally

Start the VitePress development server:

```bash
yarn dev
```

**Access:** http://localhost:5173

The dev server features:
- **Hot reload**: Changes to markdown files update instantly
- **Search**: Full-text search across all documentation
- **Navigation**: Sidebar with component categories
- **Dark mode**: Toggle between light and dark themes

### Build for Production

Generate static HTML files for deployment:

```bash
yarn build
```

**Output:** `.vitepress/dist/` directory containing static site

**Preview production build:**
```bash
yarn preview
```

---

## Project Structure

```
e2etest-docs/
├── .vitepress/
│   ├── config.mts          # VitePress configuration
│   └── theme/              # Custom theme (if any)
├── docs/                   # Generated documentation (auto-generated)
│   ├── index.md           # Homepage
│   ├── components/        # Component-specific docs
│   │   ├── glossary.md
│   │   ├── data-assets.md
│   │   └── ...
│   └── sidebar.json       # Navigation structure
├── scripts/               # Documentation generation scripts
│   ├── generate.ts        # Main orchestrator
│   ├── parser.ts          # Test file parser
│   ├── markdown.ts        # Markdown generator
│   └── types.ts           # TypeScript types
├── package.json
└── README.md              # This file
```

### Key Files

| File | Purpose |
|------|---------|
| `scripts/generate.ts` | Orchestrates the documentation generation process |
| `scripts/parser.ts` | Parses `.spec.ts` files to extract test information |
| `scripts/markdown.ts` | Generates markdown content from parsed data |
| `.vitepress/config.mts` | VitePress site configuration (title, theme, sidebar) |
| `docs/sidebar.json` | Auto-generated navigation structure |

---

## Features

### 1. Automatic Test Discovery

Recursively finds all `.spec.ts` files in the Playwright E2E directory.

### 2. Component Categorization

Tests are automatically categorized based on filename patterns:

| Category | Pattern Examples |
|----------|-----------------|
| Glossary | `Glossary*.spec.ts` |
| Data Assets | `Table.spec.ts`, `Dashboard.spec.ts` |
| Services & Ingestion | `Service*.spec.ts`, `Ingestion*.spec.ts` |
| Governance | `Domain*.spec.ts`, `Policy*.spec.ts` |

### 3. Parameterized Test Expansion

Tests using `forEach` loops are expanded to show individual runs:

**Before:**
```
1. Domain Add, Update and Remove
```

**After:**
```
1. ApiEndpoint → Domain Add, Update and Remove
2. Table → Domain Add, Update and Remove
3. Dashboard → Domain Add, Update and Remove
... (16 total)
```

### 4. Metrics & Statistics

Each component page includes:
- Total test files
- Total test cases
- Total test steps
- Total scenarios (tests + steps)

### 5. GitHub Integration

Every test and step links directly to the source code on GitHub with line numbers:

```markdown
[L130](https://github.com/open-metadata/OpenMetadata/blob/main/.../Entity.spec.ts#L130)
```

### 6. Search Functionality

VitePress provides built-in full-text search across all documentation.

---

## Development

### Regenerate Documentation

After modifying test files:

```bash
yarn generate
```

The dev server will automatically reload if it's running.

### Modify Generation Logic

Edit files in `scripts/`:

- **Add new component category**: Update `componentMapping` in `generate.ts`
- **Change parsing logic**: Modify `parser.ts`
- **Customize markdown output**: Edit `markdown.ts`

### Customize Site Appearance

Edit `.vitepress/config.mts`:

```typescript
export default defineConfig({
  title: 'E2E Test Documentation',
  description: 'OpenMetadata Playwright E2E Tests',
  themeConfig: {
    nav: [...],
    sidebar: {...},
    // ... more options
  }
})
```

---

## Troubleshooting

### Documentation not updating

**Solution:** Regenerate the docs:
```bash
yarn generate
```

### Dev server not starting

**Check:**
1. Port 5173 is available
2. Dependencies are installed: `yarn install`
3. Node.js version is 18+

### Tests not appearing in docs

**Verify:**
1. Test files are in `openmetadata-ui/src/main/resources/ui/playwright/e2e/`
2. Files have `.spec.ts` extension
3. Tests use standard Playwright syntax (`test.describe`, `test()`)

### Parameterized tests not expanding

**Requirements:**
- Array must be declared as: `const arrayName = [Item1, Item2, ...]`
- forEach must reference the array: `arrayName.forEach(...)`
- Tests must be inside the forEach block

**Example:**
```typescript
const entities = [TableClass, DashboardClass];
entities.forEach((EntityClass) => {
  test.describe(entityName, () => {
    test('My test', ...);  // ✅ Will expand
  });
});
```

### Build fails

**Common issues:**
1. TypeScript errors in generation scripts
2. Invalid markdown in generated files
3. Missing dependencies

**Solution:**
```bash
# Clean and reinstall
rm -rf node_modules
yarn install
yarn generate
yarn build
```

---

## Scripts Reference

| Command | Description |
|---------|-------------|
| `yarn start` | **🚀 Quick start**: Generate docs and start dev server |
| `yarn generate` | Generate documentation from test files |
| `yarn dev` | Start development server (http://localhost:5173) |
| `yarn build` | Build static site for production |
| `yarn preview` | Preview production build locally |

---

## Contributing

When adding new test files:

1. Follow Playwright naming conventions
2. Use descriptive test names
3. Add `test.step()` for complex test flows
4. Run `yarn generate` to update docs

---

## Additional Resources

- [VitePress Documentation](https://vitepress.dev/)
- [Playwright Testing](https://playwright.dev/)
- [OpenMetadata E2E Tests](../openmetadata-ui/src/main/resources/ui/playwright/e2e/)

---

## License

Part of the OpenMetadata project. See main repository for license information.
