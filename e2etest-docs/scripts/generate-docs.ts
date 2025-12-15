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

function parseTestFile(filePath: string): TestFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  const parsed = parseDescribesAccurately(content);

  return {
    path: filePath,
    fileName,
    describes: parsed.describes,
    rootTests: parsed.rootTests,
    totalTests: parsed.totalTests,
    totalSteps: parsed.totalSteps,
    totalScenarios: parsed.totalTests + parsed.totalSteps,
  };
}

function parseDescribesAccurately(content: string): {
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const trimmedLine = line.trim();

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

    // Match test.step() - handles both single line and multi-line patterns
    // Pattern 1: await test.step('name', async () => {
    // Pattern 2: await test.step(\n  'name',
    const stepMatch = trimmedLine.match(/(?:await\s+)?test\.step\s*\(\s*['"`](.+?)['"`]/);
    const stepStartMatch = trimmedLine.match(/(?:await\s+)?test\.step\s*\(\s*$/);

    if (stepMatch) {
      if (currentTest) {
        currentTest.steps.push({
          name: stepMatch[1],
          line: lineNumber,
        });
      }
      totalSteps++;
    } else if (stepStartMatch && i + 1 < lines.length) {
      // Multi-line test.step - name is on next line
      const nextLine = lines[i + 1].trim();
      const nextLineMatch = nextLine.match(/^['"`](.+?)['"`]/);
      if (nextLineMatch) {
        if (currentTest) {
          currentTest.steps.push({
            name: nextLineMatch[1],
            line: lineNumber,
          });
        }
        totalSteps++;
      }
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
  // Use VitePress frontmatter
  let md = `---
title: ${component.name}
order: ${10000 - component.totalScenarios}
---

# ${component.name}

## Table of contents
[[toc]]

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
layout: home
title: Home
hero:
  name: OpenMetadata E2E Docs
  text: Comprehensive Test Documentation
  tagline: Automatically generated from Playwright source code
  actions:
    - theme: brand
      text: Browse Components
      link: /components/
    - theme: alt
      text: View on GitHub
      link: https://github.com/open-metadata/OpenMetadata
features:
  - title: ${components.length} Components
    details: Organized by feature area like Glossary, Data Assets, and Settings.
  - title: ${totalTests} Test Cases
    details: Detailed breakdown of every test scenario.
  - title: ${totalSteps} Test Steps
    details: Granular steps extracted from test execution flows.
---

## Summary

| Metric | Count |
|--------|-------|
| **Components** | ${components.length} |
| **Test Files** | ${totalFiles} |
| **Test Cases** | ${totalTests} |
| **Test Steps** | ${totalSteps} |

---

## Components

| Component | Files | Tests | Steps |
|-----------|-------|-------|-------|
`;

  const sortedComponents = [...components].sort((a, b) => b.totalScenarios - a.totalScenarios);

  for (const component of sortedComponents) {
    const slug = component.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    md += `| [${component.name}](./components/${slug}) | ${component.files.length} | ${component.totalTests} | ${component.totalSteps} |\n`;
  }

  md += `
---

*Generated automatically from Playwright test files using VitePress*
`;

  return md;
}

function generateComponentsIndex(components: Component[]): string {
  return `---
title: Components
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
  if (!fs.existsSync(e2eDir)) {
      console.error(`❌ Playwright directory not found at: ${e2eDir}`);
      process.exit(1);
  }

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

  console.log('\n✅ Documentation generated successfully!');
}

main();
