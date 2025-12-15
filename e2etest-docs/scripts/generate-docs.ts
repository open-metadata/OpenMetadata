/**
 * Script to generate documentation from Playwright test files
 * Run with: npx ts-node playwright/docs/scripts/generate-docs.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestCase {
  name: string;
  line: number;
}

interface TestDescribe {
  name: string;
  tests: TestCase[];
  line: number;
}

interface TestFile {
  path: string;
  fileName: string;
  describes: TestDescribe[];
  totalTests: number;
}

interface Component {
  name: string;
  files: TestFile[];
  totalTests: number;
}

// Component categorization mapping
const componentMapping: Record<string, string> = {
  // Glossary
  'Glossary': 'Glossary',
  'GlossaryTerm': 'Glossary',
  'GlossaryAdvanced': 'Glossary',
  'GlossaryAssets': 'Glossary',
  'GlossaryBulk': 'Glossary',
  'GlossaryCRUD': 'Glossary',
  'GlossaryForm': 'Glossary',
  'GlossaryHierarchy': 'Glossary',
  'GlossaryImport': 'Glossary',
  'GlossaryMisc': 'Glossary',
  'GlossaryNavigation': 'Glossary',
  'GlossaryP2': 'Glossary',
  'GlossaryP3': 'Glossary',
  'GlossaryPagination': 'Glossary',
  'GlossaryPermissions': 'Glossary',
  'GlossaryRemove': 'Glossary',
  'GlossaryTasks': 'Glossary',
  'GlossaryVersion': 'Glossary',
  'GlossaryVoting': 'Glossary',
  'GlossaryWorkflow': 'Glossary',
  'LargeGlossary': 'Glossary',

  // Domains & Data Products
  'Domain': 'Domains & Data Products',
  'SubDomain': 'Domains & Data Products',
  'DataProduct': 'Domains & Data Products',

  // Data Quality & Observability
  'TestSuite': 'Data Quality & Observability',
  'TestCase': 'Data Quality & Observability',
  'DataQuality': 'Data Quality & Observability',
  'Profiler': 'Data Quality & Observability',
  'IncidentManager': 'Data Quality & Observability',
  'Observability': 'Data Quality & Observability',
  'DataContract': 'Data Quality & Observability',

  // Search & Discovery
  'Search': 'Search & Discovery',
  'AdvancedSearch': 'Search & Discovery',
  'Explore': 'Search & Discovery',
  'GlobalSearch': 'Search & Discovery',
  'TableSearch': 'Search & Discovery',
  'SchemaSearch': 'Search & Discovery',
  'SearchSettings': 'Search & Discovery',
  'SearchIndex': 'Search & Discovery',

  // Data Assets
  'Table': 'Data Assets',
  'Topic': 'Data Assets',
  'Dashboard': 'Data Assets',
  'Pipeline': 'Data Assets',
  'Container': 'Data Assets',
  'Query': 'Data Assets',
  'Metric': 'Data Assets',
  'Api': 'Data Assets',
  'Schema': 'Data Assets',
  'Entity': 'Data Assets',
  'StoredProcedure': 'Data Assets',
  'MlModel': 'Data Assets',

  // Lineage
  'Lineage': 'Lineage',
  'PlatformLineage': 'Lineage',
  'LineageSettings': 'Lineage',
  'ImpactAnalysis': 'Lineage',

  // Tags & Classification
  'Tag': 'Tags & Classification',
  'Classification': 'Tags & Classification',
  'MutuallyExclusive': 'Tags & Classification',
  'AutoClassification': 'Tags & Classification',
  'Tier': 'Tags & Classification',

  // Users & Teams
  'User': 'Users & Teams',
  'Team': 'Users & Teams',
  'Persona': 'Users & Teams',
  'Bot': 'Users & Teams',

  // Access Control
  'Permission': 'Access Control',
  'Role': 'Access Control',
  'Policy': 'Access Control',
  'RBAC': 'Access Control',
  'Conditional': 'Access Control',

  // Services & Ingestion
  'Service': 'Services & Ingestion',
  'Ingestion': 'Services & Ingestion',
  'Database': 'Services & Ingestion',
  'Connection': 'Services & Ingestion',

  // Settings & Configuration
  'Setting': 'Settings & Configuration',
  'Config': 'Settings & Configuration',
  'Customize': 'Settings & Configuration',
  'Login': 'Settings & Configuration',
  'SSO': 'Settings & Configuration',
  'Health': 'Settings & Configuration',
  'Admin': 'Settings & Configuration',
  'CustomProperty': 'Settings & Configuration',
  'CustomLogoConfig': 'Settings & Configuration',

  // Data Insights
  'DataInsight': 'Data Insights',
  'KPI': 'Data Insights',

  // Activity & Collaboration
  'Activity': 'Activity & Collaboration',
  'Alert': 'Activity & Collaboration',
  'Notification': 'Activity & Collaboration',
  'Announcement': 'Activity & Collaboration',
  'Task': 'Activity & Collaboration',
  'Feed': 'Activity & Collaboration',

  // UI Components
  'Widget': 'UI Components',
  'Navigation': 'UI Components',
  'Panel': 'UI Components',
  'Markdown': 'UI Components',
  'Pagination': 'UI Components',
  'Tour': 'UI Components',
  'MyData': 'UI Components',
  'Landing': 'UI Components',
};

function getComponentFromFileName(fileName: string): string {
  for (const [key, component] of Object.entries(componentMapping)) {
    if (fileName.includes(key)) {
      return component;
    }
  }
  return 'Other';
}

function parseTestFile(filePath: string): TestFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const fileName = path.basename(filePath);

  const describes: TestDescribe[] = [];
  let currentDescribe: TestDescribe | null = null;
  let totalTests = 0;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // Match test.describe or describe
    const describeMatch = line.match(/(?:test\.)?describe(?:\.skip)?(?:\.only)?\s*\(\s*['"`](.+?)['"`]/);
    if (describeMatch) {
      if (currentDescribe) {
        describes.push(currentDescribe);
      }
      currentDescribe = {
        name: describeMatch[1],
        tests: [],
        line: lineNumber,
      };
    }

    // Match test() or it()
    const testMatch = line.match(/(?:test|it)(?:\.skip|\.only)?\s*\(\s*['"`](.+?)['"`]/);
    if (testMatch && !line.includes('test.describe') && !line.includes('test.use') &&
        !line.includes('test.beforeAll') && !line.includes('test.afterAll') &&
        !line.includes('test.beforeEach') && !line.includes('test.afterEach')) {
      const testCase: TestCase = {
        name: testMatch[1],
        line: lineNumber,
      };

      if (currentDescribe) {
        currentDescribe.tests.push(testCase);
      } else {
        // Test outside of describe block
        if (!describes.find(d => d.name === 'Root Tests')) {
          describes.push({
            name: 'Root Tests',
            tests: [],
            line: lineNumber,
          });
        }
        describes.find(d => d.name === 'Root Tests')?.tests.push(testCase);
      }
      totalTests++;
    }
  });

  if (currentDescribe) {
    describes.push(currentDescribe);
  }

  return {
    path: filePath,
    fileName,
    describes,
    totalTests,
  };
}

function findTestFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      files.push(...findTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function generateComponentMarkdown(component: Component, repoBaseUrl: string): string {
  let md = `---
layout: default
title: ${component.name}
parent: Components
nav_order: ${component.totalTests}
---

# ${component.name}

| Metric | Count |
|--------|-------|
| **Total Tests** | ${component.totalTests} |
| **Test Files** | ${component.files.length} |

---

`;

  // Sort files by test count descending
  const sortedFiles = [...component.files].sort((a, b) => b.totalTests - a.totalTests);

  for (const file of sortedFiles) {
    const relativePath = file.path.replace(/.*playwright\//, 'playwright/');
    const fileUrl = `${repoBaseUrl}/blob/main/openmetadata-ui/src/main/resources/ui/${relativePath}`;

    md += `## ${file.fileName.replace('.spec.ts', '')}

**File:** [\`${relativePath}\`](${fileUrl})
**Tests:** ${file.totalTests}

`;

    for (const describe of file.describes) {
      if (describe.tests.length > 0) {
        md += `### ${describe.name}

| Test | Line |
|------|------|
`;
        for (const test of describe.tests) {
          md += `| ${test.name.replace(/\|/g, '\\|')} | [L${test.line}](${fileUrl}#L${test.line}) |\n`;
        }
        md += '\n';
      }
    }
  }

  return md;
}

function generateIndexMarkdown(components: Component[]): string {
  const totalTests = components.reduce((sum, c) => sum + c.totalTests, 0);
  const totalFiles = components.reduce((sum, c) => sum + c.files.length, 0);

  let md = `---
layout: default
title: Home
nav_order: 1
---

# OpenMetadata E2E Test Documentation

This documentation provides a comprehensive overview of all Playwright end-to-end tests in the OpenMetadata project.

## Summary

| Metric | Count |
|--------|-------|
| **Total Components** | ${components.length} |
| **Total Test Files** | ${totalFiles} |
| **Total Tests** | ${totalTests} |

## Components Overview

| Component | Test Files | Tests |
|-----------|------------|-------|
`;

  const sortedComponents = [...components].sort((a, b) => b.totalTests - a.totalTests);

  for (const component of sortedComponents) {
    const slug = component.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    md += `| [${component.name}](./components/${slug}) | ${component.files.length} | ${component.totalTests} |\n`;
  }

  md += `

## Test Categories

### Core Features
- [Glossary](./components/glossary) - Glossary and Glossary Term management
- [Data Assets](./components/data-assets) - Tables, Topics, Dashboards, Pipelines
- [Domains & Data Products](./components/domains-data-products) - Domain hierarchy and data products

### Data Quality
- [Data Quality & Observability](./components/data-quality-observability) - Test suites, profiler, incident management

### Discovery & Governance
- [Search & Discovery](./components/search-discovery) - Search and exploration features
- [Tags & Classification](./components/tags-classification) - Tags, tiers, and classification
- [Lineage](./components/lineage) - Data lineage tracking

### Administration
- [Users & Teams](./components/users-teams) - User and team management
- [Access Control](./components/access-control) - Roles, policies, and permissions
- [Services & Ingestion](./components/services-ingestion) - Service connections and ingestion

---

*Generated on: ${new Date().toISOString().split('T')[0]}*
`;

  return md;
}

function main() {
  const scriptDir = __dirname;
  // e2etest-docs is at repo root, playwright tests are in openmetadata-ui
  const repoRoot = path.resolve(scriptDir, '../..');
  const e2eDir = path.join(repoRoot, 'openmetadata-ui/src/main/resources/ui/playwright/e2e');
  const docsDir = path.resolve(scriptDir, '..');
  const componentsDir = path.join(docsDir, 'components');
  const repoBaseUrl = 'https://github.com/open-metadata/OpenMetadata';

  console.log('Finding test files...');
  const testFiles = findTestFiles(e2eDir);
  console.log(`Found ${testFiles.length} test files`);

  console.log('Parsing test files...');
  const parsedFiles = testFiles.map(parseTestFile);

  console.log('Categorizing by component...');
  const componentMap = new Map<string, TestFile[]>();

  for (const file of parsedFiles) {
    const component = getComponentFromFileName(file.fileName);
    if (!componentMap.has(component)) {
      componentMap.set(component, []);
    }
    componentMap.get(component)!.push(file);
  }

  const components: Component[] = Array.from(componentMap.entries()).map(([name, files]) => ({
    name,
    files,
    totalTests: files.reduce((sum, f) => sum + f.totalTests, 0),
  }));

  console.log('Generating documentation...');

  // Ensure components directory exists
  if (!fs.existsSync(componentsDir)) {
    fs.mkdirSync(componentsDir, { recursive: true });
  }

  // Generate component pages
  for (const component of components) {
    const slug = component.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const markdown = generateComponentMarkdown(component, repoBaseUrl);
    fs.writeFileSync(path.join(componentsDir, `${slug}.md`), markdown);
    console.log(`  Generated: ${slug}.md (${component.totalTests} tests)`);
  }

  // Generate index
  const indexMarkdown = generateIndexMarkdown(components);
  fs.writeFileSync(path.join(docsDir, 'index.md'), indexMarkdown);
  console.log('Generated: index.md');

  console.log('\nDocumentation generated successfully!');
  console.log(`Total: ${components.length} components, ${parsedFiles.length} files, ${components.reduce((s, c) => s + c.totalTests, 0)} tests`);
}

main();
