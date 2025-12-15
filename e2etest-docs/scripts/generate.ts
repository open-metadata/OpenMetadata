
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateComponentMarkdown, generateComponentsIndex, generateIndexMarkdown } from './markdown.js';
import { findTestFiles, parseTestFile } from './parser.js';
import { Component, TestFile } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const REPO_ROOT = path.resolve(__dirname, '../..');
const PLAYWRIGHT_DIR = path.join(REPO_ROOT, 'openmetadata-ui/src/main/resources/ui/playwright/e2e');
const DOCS_DIR = path.resolve(__dirname, '../docs');
const COMPONENTS_DIR = path.join(DOCS_DIR, 'components');

const COMPONENT_MAPPING: Record<string, string> = {
  'Glossary': 'Glossary',
  'Domain': 'Domains & Data Products',
  'DataProduct': 'Domains & Data Products',
  'TestSuite': 'Data Quality & Observability',
  'Profiler': 'Data Quality & Observability',
  'IncidentManager': 'Data Quality & Observability',
  'Search': 'Search & Discovery',
  'Explore': 'Search & Discovery',
  'Table': 'Data Assets',
  'Topic': 'Data Assets',
  'Dashboard': 'Data Assets',
  'Pipeline': 'Data Assets',
  'Lineage': 'Lineage',
  'Tag': 'Tags & Classification',
  'Classification': 'Tags & Classification',
  'User': 'Users & Teams',
  'Team': 'Users & Teams',
  'Role': 'Access Control',
  'Policy': 'Access Control',
  'Service': 'Services & Ingestion',
  'Ingestion': 'Services & Ingestion',
  'Settings': 'Settings & Configuration',
  'DataInsight': 'Data Insights',
  'Activity': 'Activity & Collaboration',
  'MyData': 'UI Components',
  'Landing': 'UI Components'
};

function getComponentName(fileName: string): string {
  for (const [key, name] of Object.entries(COMPONENT_MAPPING)) {
    if (fileName.includes(key)) return name;
  }
  return 'Other';
}

function main() {
  console.log(`🚀 Starting Documentation Generation`);
  console.log(`   Input: ${PLAYWRIGHT_DIR}`);
  console.log(`   Output: ${DOCS_DIR}`);

  if (!fs.existsSync(PLAYWRIGHT_DIR)) {
    console.error(`❌ Playwright directory not found!`);
    process.exit(1);
  }

  // 1. Find and Parse Files
  const files = findTestFiles(PLAYWRIGHT_DIR);
  console.log(`📝 Found ${files.length} test files. Parsing...`);
  
  const parsedFiles = files.map(file => parseTestFile(file));

  // 2. Group by Component
  const componentMap = new Map<string, TestFile[]>();
  parsedFiles.forEach(file => {
    const name = getComponentName(file.fileName);
    if (!componentMap.has(name)) componentMap.set(name, []);
    componentMap.get(name)!.push(file);
  });

  // 3. Convert to Component Objects
  const components: Component[] = Array.from(componentMap.entries()).map(([name, files]) => ({
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    files,
    totalTests: files.reduce((s, f) => s + f.totalTests, 0),
    totalSteps: files.reduce((s, f) => s + f.totalSteps, 0),
    totalScenarios: files.reduce((s, f) => s + f.totalScenarios, 0),
  }));

  // 4. Generate Content
  console.log(`⚙️  Generating Markdown for ${components.length} components...`);
  
  // Ensure directories exist
  if (fs.existsSync(DOCS_DIR)) fs.rmSync(DOCS_DIR, { recursive: true, force: true });
  fs.mkdirSync(COMPONENTS_DIR, { recursive: true });

  // Stats
  const stats = {
    components: components.length,
    files: parsedFiles.length,
    tests: components.reduce((s,c) => s + c.totalTests, 0),
    steps: components.reduce((s,c) => s + c.totalSteps, 0)
  };

  // Generate Component Pages
  components.forEach(comp => {
    const content = generateComponentMarkdown(comp);
    fs.writeFileSync(path.join(COMPONENTS_DIR, `${comp.slug}.md`), content);
  });

  // Generate Indices
  fs.writeFileSync(path.join(COMPONENTS_DIR, 'index.md'), generateComponentsIndex(components));
  fs.writeFileSync(path.join(DOCS_DIR, 'index.md'), generateIndexMarkdown(components, stats));

  // Generate Sidebar
  const sidebar = [
    {
      text: 'Components',
      items: [
        { text: 'All Components', link: '/components/' },
        ...components.map(c => ({
          text: c.name,
          link: `/components/${c.slug}`
        }))
      ]
    }
  ];
  fs.writeFileSync(path.join(DOCS_DIR, 'sidebar.json'), JSON.stringify(sidebar, null, 2));
  console.log(`   ✓ sidebar.json`);

  console.log(`✅ Success! Docs generated in ${DOCS_DIR}`);
}

main();
