
const fs = require('fs');
const path = require('path');
const { generateDomainMarkdown, generateIndexMarkdown } = require('./markdown.js');
const { loadTestsFromPlaywright } = require('./playwright-loader.js');

// Constants
// Script is in: openmetadata-ui/src/main/resources/ui/playwright/doc-generator/
const PLAYWRIGHT_DIR = path.resolve(__dirname, '../e2e');
const OUTPUT_DIR = path.resolve(__dirname, '../docs');

const DOMAIN_MAPPING = {
  // Governance
  'Automator': { domain: 'Governance', name: 'Automator' },
  'Glossary': { domain: 'Governance', name: 'Glossary' },
  'Tag': { domain: 'Governance', name: 'Tags' },
  'Classification': { domain: 'Governance', name: 'Tags' }, // Alias
  'Workflow': { domain: 'Governance', name: 'Workflows' },
  'Metric': { domain: 'Governance', name: 'Metrics' },
  'KnowledgeCenter': { domain: 'Governance', name: 'Knowledge Center' },
  'CustomProperty': { domain: 'Governance', name: 'Custom Properties' },
  'Domain': { domain: 'Governance', name: 'Domains & Data Products' },
  'DataProduct': { domain: 'Governance', name: 'Domains & Data Products' }, // Alias

  // Platform
  'RBAC': { domain: 'Platform', name: 'RBAC' },
  'Role': { domain: 'Platform', name: 'RBAC' },
  'Policy': { domain: 'Platform', name: 'RBAC' },
  'SSO': { domain: 'Platform', name: 'SSO' },
  'Persona': { domain: 'Platform', name: 'Personas & Customizations' },
  'Customization': { domain: 'Platform', name: 'Personas & Customizations' },
  'AppMarketplace': { domain: 'Platform', name: 'App Marketplace' },
  'Application': { domain: 'Platform', name: 'App Marketplace' },
  'Settings': { domain: 'Platform', name: 'Settings' },
  'Lineage': { domain: 'Platform', name: 'Lineage (UI)' }, // Default UI Lineage

  // Discovery
  'Search': { domain: 'Discovery', name: 'Search' },
  'DataInsight': { domain: 'Discovery', name: 'Data Insights' },
  'Feed': { domain: 'Discovery', name: 'Feed' },
  'Conversation': { domain: 'Discovery', name: 'Feed' },
  'DataAsset': { domain: 'Discovery', name: 'Data Assets' }, // Generic bucket
  'Table': { domain: 'Discovery', name: 'Data Assets' },
  'Topic': { domain: 'Discovery', name: 'Data Assets' },
  'Dashboard': { domain: 'Discovery', name: 'Data Assets' },
  'Pipeline': { domain: 'Discovery', name: 'Data Assets' },
  'Container': { domain: 'Discovery', name: 'Data Assets' },
  'Database': { domain: 'Discovery', name: 'Data Assets' },
  'Explore': { domain: 'Discovery', name: 'Explore' },
  'MyData': { domain: 'Discovery', name: 'My Data' },
  'Home': { domain: 'Discovery', name: 'Home Page' },
  'Landing': { domain: 'Discovery', name: 'Home Page' },

  // Observability
  'Quality': { domain: 'Observability', name: 'Data Quality' },
  'TestSuite': { domain: 'Observability', name: 'Data Quality' },
  'TestCase': { domain: 'Observability', name: 'Data Quality' },
  'Profiler': { domain: 'Observability', name: 'Profiler' },
  'RCA': { domain: 'Observability', name: 'Root Cause Analysis' },
  'Incident': { domain: 'Observability', name: 'Incident Manager' },
  'Alert': { domain: 'Observability', name: 'Alerts & Notifications' },
  'Notification': { domain: 'Observability', name: 'Alerts & Notifications' },

  // Integration
  'Connector': { domain: 'Integration', name: 'Connectors' },
  'Service': { domain: 'Integration', name: 'Connectors' },
  'Ingestion': { domain: 'Integration', name: 'Connectors' },
};

function getComponentInfo(fileName) {
  for (const [key, def] of Object.entries(DOMAIN_MAPPING)) {
    if (fileName.includes(key)) return def;
  }
  return { domain: 'Platform', name: 'Other' };
}

function main() {
  console.log(`🚀 Starting Documentation Generation (Node.js)`);
  console.log(`   Input: ${PLAYWRIGHT_DIR}`);
  console.log(`   Output: ${OUTPUT_DIR}`);

  if (!fs.existsSync(PLAYWRIGHT_DIR)) {
    console.error(`❌ Playwright directory not found!`);
    process.exit(1);
  }

  // 1. Find and Parse Files using Native Playwright Loader
  console.log(`📝 asking Playwright to list tests...`);
  const parsedFiles = loadTestsFromPlaywright(PLAYWRIGHT_DIR);
  console.log(`   Received ${parsedFiles.length} file suites from Playwright.`);

  // 2. Group by Domain + Component
  const groupings = new Map();
  
  parsedFiles.forEach(file => {
    const { domain, name } = getComponentInfo(file.fileName);
    const key = `${domain}:${name}`;
    
    if (!groupings.has(key)) {
      groupings.set(key, { domain, name, files: [] });
    }
    groupings.get(key).files.push(file);
  });

  // 3. Convert to Component Objects
  const components = Array.from(groupings.values()).map(g => ({
    name: g.name,
    domain: g.domain,
    slug: g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    files: g.files,
    totalTests: g.files.reduce((s, f) => s + f.totalTests, 0),
    totalSteps: g.files.reduce((s, f) => s + f.totalSteps, 0),
    totalScenarios: g.files.reduce((s, f) => s + f.totalScenarios, 0),
  }));

  // 4. Generate Content
  console.log(`⚙️  Generating Markdown for ${components.length} components...`);
  
  // Clean output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true }); 
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Stats
  const stats = {
    components: components.length,
    files: parsedFiles.length,
    tests: components.reduce((s,c) => s + c.totalTests, 0),
    steps: components.reduce((s,c) => s + c.totalSteps, 0)
  };

  // Group Components by Domain for Generation
  const componentsByDomain = {};
  components.forEach(c => {
    if (!componentsByDomain[c.domain]) componentsByDomain[c.domain] = [];
    componentsByDomain[c.domain].push(c);
  });

  // Generate Consolidated Domain Pages
  Object.entries(componentsByDomain).forEach(([domain, comps]) => {
    const content = generateDomainMarkdown(domain, comps);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${domain}.md`), content);
    console.log(`   ✓ ${domain}.md`);
  });

  // Generate Main Index (README.md)
  fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), generateIndexMarkdown(components, stats));
  console.log(`   ✓ README.md`);

  console.log(`\n✅ Success! Documentation generated in:`);
  console.log(`   ${OUTPUT_DIR}`);
}

main();
