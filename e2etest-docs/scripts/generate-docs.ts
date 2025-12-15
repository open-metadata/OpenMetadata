/**
 * Script to generate comprehensive documentation from Playwright test files
 * Captures: test(), test.step(), test.describe(), and extracts behavior descriptions
 * Run with: npm run generate
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestStep {
  name: string;
  line: number;
}

interface TestCase {
  name: string;
  line: number;
  steps: TestStep[];
  description?: string; // Extracted from comments or test name
  isSkipped: boolean;
}

interface TestDescribe {
  name: string;
  tests: TestCase[];
  nestedDescribes: TestDescribe[];
  line: number;
}

interface TestFile {
  path: string;
  fileName: string;
  describes: TestDescribe[];
  rootTests: TestCase[];
  totalTests: number;
  totalSteps: number;
  totalScenarios: number; // tests + steps
}

interface Component {
  name: string;
  files: TestFile[];
  totalTests: number;
  totalSteps: number;
  totalScenarios: number;
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
  'CustomMetric': 'Data Quality & Observability',
  'TableConstraint': 'Data Quality & Observability',

  // Search & Discovery
  'Search': 'Search & Discovery',
  'AdvancedSearch': 'Search & Discovery',
  'Explore': 'Search & Discovery',
  'GlobalSearch': 'Search & Discovery',
  'TableSearch': 'Search & Discovery',
  'SchemaSearch': 'Search & Discovery',
  'SearchSettings': 'Search & Discovery',
  'SearchIndex': 'Search & Discovery',
  'QuickFilters': 'Search & Discovery',

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
  'DatabaseSchema': 'Data Assets',
  'BulkEdit': 'Data Assets',
  'BulkImport': 'Data Assets',

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
  'OnlineUsers': 'Users & Teams',
  'UserProfile': 'Users & Teams',

  // Access Control
  'Permission': 'Access Control',
  'Role': 'Access Control',
  'Policy': 'Access Control',
  'RBAC': 'Access Control',
  'Conditional': 'Access Control',
  'DataAssetRules': 'Access Control',

  // Services & Ingestion
  'Service': 'Services & Ingestion',
  'Ingestion': 'Services & Ingestion',
  'Database': 'Services & Ingestion',
  'Connection': 'Services & Ingestion',
  'AutoPilot': 'Services & Ingestion',

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
  'GlobalPageSize': 'Settings & Configuration',
  'NavigationBlocker': 'Settings & Configuration',

  // Data Insights
  'DataInsight': 'Data Insights',
  'KPI': 'Data Insights',
  'CuratedAssets': 'Data Insights',

  // Activity & Collaboration
  'Activity': 'Activity & Collaboration',
  'Alert': 'Activity & Collaboration',
  'Notification': 'Activity & Collaboration',
  'Announcement': 'Activity & Collaboration',
  'Task': 'Activity & Collaboration',
  'Feed': 'Activity & Collaboration',
  'Description': 'Activity & Collaboration',

  // UI Components
  'Widget': 'UI Components',
  'Navigation': 'UI Components',
  'Panel': 'UI Components',
  'Markdown': 'UI Components',
  'Pagination': 'UI Components',
  'Tour': 'UI Components',
  'MyData': 'UI Components',
  'Landing': 'UI Components',
  'Summary': 'UI Components',
  'Version': 'UI Components',
  'Restore': 'UI Components',
};

function getComponentFromFileName(fileName: string): string {
  for (const [key, component] of Object.entries(componentMapping)) {
    if (fileName.includes(key)) {
      return component;
    }
  }
  return 'Other';
}

/**
 * Extract behavior description from test name
 * Converts "should add and remove tags from glossary" to "Add and remove tags from glossary"
 */
function extractBehavior(testName: string): string {
  let behavior = testName;

  // Remove common prefixes
  behavior = behavior.replace(/^should\s+/i, '');
  behavior = behavior.replace(/^verify\s+that\s+/i, '');
  behavior = behavior.replace(/^verify\s+/i, '');
  behavior = behavior.replace(/^check\s+that\s+/i, '');
  behavior = behavior.replace(/^check\s+/i, '');
  behavior = behavior.replace(/^ensure\s+that\s+/i, '');
  behavior = behavior.replace(/^ensure\s+/i, '');
  behavior = behavior.replace(/^test\s+that\s+/i, '');
  behavior = behavior.replace(/^test\s+/i, '');

  // Capitalize first letter
  behavior = behavior.charAt(0).toUpperCase() + behavior.slice(1);

  return behavior;
}

/**
 * Categorize test by type based on name patterns
 */
function categorizeTest(testName: string): string {
  const lowerName = testName.toLowerCase();

  if (lowerName.includes('create') || lowerName.includes('add')) return '✨ Create';
  if (lowerName.includes('update') || lowerName.includes('edit') || lowerName.includes('modify')) return '✏️ Update';
  if (lowerName.includes('delete') || lowerName.includes('remove')) return '🗑️ Delete';
  if (lowerName.includes('navigate') || lowerName.includes('navigation')) return '🧭 Navigation';
  if (lowerName.includes('search') || lowerName.includes('filter')) return '🔍 Search';
  if (lowerName.includes('permission') || lowerName.includes('access') || lowerName.includes('role')) return '🔐 Access Control';
  if (lowerName.includes('drag') || lowerName.includes('drop') || lowerName.includes('move')) return '↔️ Drag & Drop';
  if (lowerName.includes('import') || lowerName.includes('export')) return '📥 Import/Export';
  if (lowerName.includes('validation') || lowerName.includes('error') || lowerName.includes('invalid')) return '⚠️ Validation';
  if (lowerName.includes('workflow') || lowerName.includes('approve') || lowerName.includes('reject')) return '✅ Workflow';
  if (lowerName.includes('version') || lowerName.includes('history')) return '📜 Version';

  return '🧪 General';
}

function parseTestFile(filePath: string): TestFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const fileName = path.basename(filePath);

  const describes: TestDescribe[] = [];
  const rootTests: TestCase[] = [];
  const describeStack: TestDescribe[] = [];
  let currentTest: TestCase | null = null;
  let totalTests = 0;
  let totalSteps = 0;
  let braceCount = 0;
  let inDescribe = false;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();

    // Track braces for scope
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    // Match test.describe
    const describeMatch = trimmedLine.match(/(?:test\.)?describe(?:\.skip)?(?:\.only)?\s*\(\s*['"`](.+?)['"`]/);
    if (describeMatch) {
      const newDescribe: TestDescribe = {
        name: describeMatch[1],
        tests: [],
        nestedDescribes: [],
        line: lineNumber,
      };

      if (describeStack.length > 0) {
        describeStack[describeStack.length - 1].nestedDescribes.push(newDescribe);
      } else {
        describes.push(newDescribe);
      }
      describeStack.push(newDescribe);
      inDescribe = true;
    }

    // Match test() or it()
    const testMatch = trimmedLine.match(/^(?:test|it)(?:\.skip|\.only)?\s*\(\s*['"`](.+?)['"`]/);
    if (testMatch && !trimmedLine.includes('test.describe') && !trimmedLine.includes('test.use') &&
        !trimmedLine.includes('test.beforeAll') && !trimmedLine.includes('test.afterAll') &&
        !trimmedLine.includes('test.beforeEach') && !trimmedLine.includes('test.afterEach') &&
        !trimmedLine.includes('test.step')) {

      const isSkipped = trimmedLine.includes('.skip');
      currentTest = {
        name: testMatch[1],
        line: lineNumber,
        steps: [],
        description: extractBehavior(testMatch[1]),
        isSkipped,
      };

      if (describeStack.length > 0) {
        describeStack[describeStack.length - 1].tests.push(currentTest);
      } else {
        rootTests.push(currentTest);
      }
      totalTests++;
    }

    // Match test.step()
    const stepMatch = trimmedLine.match(/(?:await\s+)?test\.step\s*\(\s*['"`](.+?)['"`]/);
    if (stepMatch && currentTest) {
      currentTest.steps.push({
        name: stepMatch[1],
        line: lineNumber,
      });
      totalSteps++;
    }

    // Handle closing braces to pop describe stack
    if (closeBraces > openBraces && describeStack.length > 0) {
      // Simple heuristic: if we see more closing braces, we might be exiting a describe
      // This is imperfect but works for most cases
    }
  });

  // More accurate describe scope tracking using a second pass
  // Reset and use proper scope tracking
  const finalDescribes = parseDescribesAccurately(content, fileName);

  return {
    path: filePath,
    fileName,
    describes: finalDescribes.describes,
    rootTests: finalDescribes.rootTests,
    totalTests: finalDescribes.totalTests,
    totalSteps: finalDescribes.totalSteps,
    totalScenarios: finalDescribes.totalTests + finalDescribes.totalSteps,
  };
}

function parseDescribesAccurately(content: string, fileName: string): {
  describes: TestDescribe[],
  rootTests: TestCase[],
  totalTests: number,
  totalSteps: number
} {
  const lines = content.split('\n');
  const describes: TestDescribe[] = [];
  const rootTests: TestCase[] = [];
  let totalTests = 0;
  let totalSteps = 0;

  // Simple state machine for parsing
  let currentDescribe: TestDescribe | null = null;
  let currentTest: TestCase | null = null;
  let describeDepth = 0;
  let testDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const trimmedLine = line.trim();

    // Count braces
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    // Match test.describe
    const describeMatch = trimmedLine.match(/(?:test\.)?describe(?:\.skip)?(?:\.only)?\s*\(\s*['"`](.+?)['"`]/);
    if (describeMatch) {
      if (currentDescribe) {
        describes.push(currentDescribe);
      }
      currentDescribe = {
        name: describeMatch[1],
        tests: [],
        nestedDescribes: [],
        line: lineNumber,
      };
    }

    // Match test() - but not test.describe, test.step, test.beforeAll, etc.
    const testMatch = trimmedLine.match(/^(?:test|it)(?:\.skip|\.only)?\s*\(\s*['"`](.+?)['"`]/);
    if (testMatch && !trimmedLine.includes('test.describe') && !trimmedLine.includes('test.use') &&
        !trimmedLine.includes('test.beforeAll') && !trimmedLine.includes('test.afterAll') &&
        !trimmedLine.includes('test.beforeEach') && !trimmedLine.includes('test.afterEach') &&
        !trimmedLine.includes('test.step')) {

      const isSkipped = trimmedLine.includes('.skip');
      currentTest = {
        name: testMatch[1],
        line: lineNumber,
        steps: [],
        description: extractBehavior(testMatch[1]),
        isSkipped,
      };

      if (currentDescribe) {
        currentDescribe.tests.push(currentTest);
      } else {
        rootTests.push(currentTest);
      }
      totalTests++;
    }

    // Match test.step()
    const stepMatch = trimmedLine.match(/(?:await\s+)?test\.step\s*\(\s*['"`](.+?)['"`]/);
    if (stepMatch) {
      if (currentTest) {
        currentTest.steps.push({
          name: stepMatch[1],
          line: lineNumber,
        });
      }
      totalSteps++;
    }

    // Check for end of describe block (simplified)
    if (trimmedLine === '});' && currentDescribe && closeBraces > 0) {
      // Could be end of describe - push and reset
      // This is a heuristic that works for most well-formatted code
    }
  }

  // Push last describe if exists
  if (currentDescribe) {
    describes.push(currentDescribe);
  }

  return { describes, rootTests, totalTests, totalSteps };
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
nav_order: ${component.totalScenarios}
---

# ${component.name}
{: .no_toc }

## Table of contents
{: .no_toc .text-delta }

1. TOC
{:toc}

---

## Summary

| Metric | Count |
|--------|-------|
| **Test Files** | ${component.files.length} |
| **Test Cases** | ${component.totalTests} |
| **Test Steps** | ${component.totalSteps} |
| **Total Scenarios** | ${component.totalScenarios} |

---

`;

  // Sort files by test count descending
  const sortedFiles = [...component.files].sort((a, b) => b.totalScenarios - a.totalScenarios);

  for (const file of sortedFiles) {
    const relativePath = file.path.replace(/.*playwright\//, 'playwright/');
    const fileUrl = `${repoBaseUrl}/blob/main/openmetadata-ui/src/main/resources/ui/${relativePath}`;
    const fileNameClean = file.fileName.replace('.spec.ts', '');

    md += `## ${fileNameClean}

📁 **File:** [\`${relativePath}\`](${fileUrl})

| Metric | Count |
|--------|-------|
| Tests | ${file.totalTests} |
| Steps | ${file.totalSteps} |
| Total | ${file.totalScenarios} |

`;

    // Group tests by category
    const allTests: TestCase[] = [];
    for (const describe of file.describes) {
      allTests.push(...describe.tests);
    }
    allTests.push(...file.rootTests);

    // Group by describe blocks
    for (const describe of file.describes) {
      if (describe.tests.length > 0) {
        md += `### ${describe.name}
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
`;
        describe.tests.forEach((test, idx) => {
          const skipBadge = test.isSkipped ? ' ⏭️' : '';
          const stepsCount = test.steps.length > 0 ? `${test.steps.length}` : '-';
          md += `| ${idx + 1} | ${test.name.replace(/\|/g, '\\|')}${skipBadge} | ${test.description?.replace(/\|/g, '\\|') || '-'} | ${stepsCount} | [L${test.line}](${fileUrl}#L${test.line}) |\n`;

          // Add steps as sub-rows if they exist
          if (test.steps.length > 0) {
            for (const step of test.steps) {
              md += `| | ↳ *${step.name.replace(/\|/g, '\\|')}* | | | [L${step.line}](${fileUrl}#L${step.line}) |\n`;
            }
          }
        });
        md += '\n';
      }
    }

    // Root tests (outside describe blocks)
    if (file.rootTests.length > 0) {
      md += `### Standalone Tests
{: .text-delta }

| # | Test | Behavior | Steps | Line |
|---|------|----------|-------|------|
`;
      file.rootTests.forEach((test, idx) => {
        const skipBadge = test.isSkipped ? ' ⏭️' : '';
        const stepsCount = test.steps.length > 0 ? `${test.steps.length}` : '-';
        md += `| ${idx + 1} | ${test.name.replace(/\|/g, '\\|')}${skipBadge} | ${test.description?.replace(/\|/g, '\\|') || '-'} | ${stepsCount} | [L${test.line}](${fileUrl}#L${test.line}) |\n`;
      });
      md += '\n';
    }

    md += '---\n\n';
  }

  return md;
}

function generateIndexMarkdown(components: Component[]): string {
  const totalTests = components.reduce((sum, c) => sum + c.totalTests, 0);
  const totalSteps = components.reduce((sum, c) => sum + c.totalSteps, 0);
  const totalScenarios = components.reduce((sum, c) => sum + c.totalScenarios, 0);
  const totalFiles = components.reduce((sum, c) => sum + c.files.length, 0);

  let md = `---
layout: default
title: Home
nav_order: 1
description: "Comprehensive E2E test documentation for OpenMetadata"
---

# OpenMetadata E2E Test Documentation
{: .fs-9 }

Comprehensive documentation of all Playwright end-to-end tests organized by component.
{: .fs-6 .fw-300 }

---

## Summary

| Metric | Count |
|--------|-------|
| **Components** | ${components.length} |
| **Test Files** | ${totalFiles} |
| **Test Cases** | ${totalTests} |
| **Test Steps** | ${totalSteps} |
| **Total Scenarios** | ${totalScenarios} |

---

## Components Overview

| Component | Files | Tests | Steps | Total |
|-----------|-------|-------|-------|-------|
`;

  const sortedComponents = [...components].sort((a, b) => b.totalScenarios - a.totalScenarios);

  for (const component of sortedComponents) {
    const slug = component.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    md += `| [${component.name}](./components/${slug}) | ${component.files.length} | ${component.totalTests} | ${component.totalSteps} | ${component.totalScenarios} |\n`;
  }

  md += `

---

## Test Categories

### 🏠 Core Features
- **[Glossary](./components/glossary)** - Glossary and Glossary Term management, workflows, hierarchy
- **[Data Assets](./components/data-assets)** - Tables, Topics, Dashboards, Pipelines, Containers
- **[Domains & Data Products](./components/domains-data-products)** - Domain hierarchy and data products

### 📊 Data Quality
- **[Data Quality & Observability](./components/data-quality-observability)** - Test suites, profiler, incident management

### 🔍 Discovery & Governance
- **[Search & Discovery](./components/search-discovery)** - Search, filters, and exploration
- **[Tags & Classification](./components/tags-classification)** - Tags, tiers, and classification
- **[Lineage](./components/lineage)** - Data lineage tracking and impact analysis

### 👥 Administration
- **[Users & Teams](./components/users-teams)** - User and team management
- **[Access Control](./components/access-control)** - Roles, policies, and permissions
- **[Services & Ingestion](./components/services-ingestion)** - Service connections and ingestion pipelines
- **[Settings & Configuration](./components/settings-configuration)** - Application settings and customization

### 📈 Insights & Collaboration
- **[Data Insights](./components/data-insights)** - KPIs and data insights dashboards
- **[Activity & Collaboration](./components/activity-collaboration)** - Activity feeds, tasks, and announcements

### 🎨 UI Components
- **[UI Components](./components/ui-components)** - Widgets, navigation, and UI elements

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ⏭️ | Skipped test |
| ↳ | Test step (sub-test within a test case) |

---

*Last updated: ${new Date().toISOString().split('T')[0]}*

*Generated automatically from Playwright test files*
`;

  return md;
}

function generateComponentsIndex(components: Component[]): string {
  return `---
layout: default
title: Components
nav_order: 2
has_children: true
---

# Test Components

Browse tests organized by component/feature area.

| Component | Test Files | Test Cases | Test Steps | Total Scenarios |
|-----------|------------|------------|------------|-----------------|
${components
  .sort((a, b) => b.totalScenarios - a.totalScenarios)
  .map(c => {
    const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `| [${c.name}](./${slug}) | ${c.files.length} | ${c.totalTests} | ${c.totalSteps} | ${c.totalScenarios} |`;
  })
  .join('\n')}
`;
}

function main() {
  const scriptDir = __dirname;
  // e2etest-docs is at repo root, playwright tests are in openmetadata-ui
  const repoRoot = path.resolve(scriptDir, '../..');
  const e2eDir = path.join(repoRoot, 'openmetadata-ui/src/main/resources/ui/playwright/e2e');
  const docsDir = path.resolve(scriptDir, '..');
  const componentsDir = path.join(docsDir, 'components');
  const repoBaseUrl = 'https://github.com/open-metadata/OpenMetadata';

  console.log('🔍 Finding test files...');
  const testFiles = findTestFiles(e2eDir);
  console.log(`   Found ${testFiles.length} test files`);

  console.log('📝 Parsing test files...');
  const parsedFiles = testFiles.map(parseTestFile);

  console.log('📂 Categorizing by component...');
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
    totalSteps: files.reduce((sum, f) => sum + f.totalSteps, 0),
    totalScenarios: files.reduce((sum, f) => sum + f.totalScenarios, 0),
  }));

  console.log('📄 Generating documentation...');

  // Ensure components directory exists
  if (!fs.existsSync(componentsDir)) {
    fs.mkdirSync(componentsDir, { recursive: true });
  }

  // Generate component pages
  for (const component of components) {
    const slug = component.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const markdown = generateComponentMarkdown(component, repoBaseUrl);
    fs.writeFileSync(path.join(componentsDir, `${slug}.md`), markdown);
    console.log(`   ✓ ${slug}.md (${component.totalTests} tests, ${component.totalSteps} steps)`);
  }

  // Generate components index
  const componentsIndexMarkdown = generateComponentsIndex(components);
  fs.writeFileSync(path.join(componentsDir, 'index.md'), componentsIndexMarkdown);
  console.log('   ✓ components/index.md');

  // Generate main index
  const indexMarkdown = generateIndexMarkdown(components);
  fs.writeFileSync(path.join(docsDir, 'index.md'), indexMarkdown);
  console.log('   ✓ index.md');

  const totalTests = components.reduce((s, c) => s + c.totalTests, 0);
  const totalSteps = components.reduce((s, c) => s + c.totalSteps, 0);
  const totalScenarios = components.reduce((s, c) => s + c.totalScenarios, 0);

  console.log('\n✅ Documentation generated successfully!');
  console.log(`\n📊 Summary:`);
  console.log(`   Components: ${components.length}`);
  console.log(`   Test Files: ${parsedFiles.length}`);
  console.log(`   Test Cases: ${totalTests}`);
  console.log(`   Test Steps: ${totalSteps}`);
  console.log(`   Total Scenarios: ${totalScenarios}`);
}

main();
