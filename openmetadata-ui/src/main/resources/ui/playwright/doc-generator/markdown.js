
const REPO_BASE_URL = 'https://github.com/open-metadata/OpenMetadata';

/**
 * Generate the Main Index Page (README.md)
 */
function generateIndexMarkdown(components, stats) {
  
  // Group components by Domain for display
  const domains = {
    'Governance': [],
    'Platform': [],
    'Discovery': [],
    'Observability': [],
    'Integration': []
  };

  components.forEach(c => {
    if (domains[c.domain]) {
      domains[c.domain].push(c);
    } else {
      // Fallback if domain incorrect
      if (!domains['Platform']) domains['Platform'] = [];
      domains['Platform'].push(c);
    }
  });

  // Sort components within domains
  Object.keys(domains).forEach(d => {
    domains[d].sort((a, b) => b.totalScenarios - a.totalScenarios);
  });

  let md = `# OpenMetadata E2E Test Documentation

> **Auto-generated documentation** from Playwright source code.

## 📊 Summary

| Metric | Count |
|--------|-------|
| **Components** | ${stats.components} |
| **Test Files** | ${stats.files} |
| **Test Cases** | ${stats.tests} |
| **Test Steps** | ${stats.steps} |

---

`;

  // Render Domain Tables
  Object.entries(domains).forEach(([domainName, comps]) => {
    if (comps.length === 0) return;

    // Calculate Domain Stats
    const domainTests = comps.reduce((s, c) => s + c.totalTests, 0);
    const domainComponents = comps.length;

    md += `## ${domainName}\n\n`;
    md += `> **${domainComponents} Components** | **${domainTests} Tests**\n\n`;

    md += `| Component | Files | Tests | Total Scenarios | Skipped |\n`;
    md += `|-----------|-------|-------|-----------------|---------|\n`;
    
    comps.forEach(c => {
      // Calculate skipped count
      // Calculate skipped count
      let skippedCount = 0;
      c.files.forEach(file => {
        file.rootTests.forEach(t => { if(t.isSkipped) skippedCount++; });
        file.describes.forEach(d => {
            d.tests.forEach(t => { if(t.isSkipped) skippedCount++; });
        });
      });

      // Link to the Domain file (e.g., ./Governance.md) with explicit anchor
      const anchor = c.slug; // Use pre-calculated slug
      const link = `./${domainName}.md#${anchor}`;
      const skippedBadge = skippedCount > 0 ? `🟡 ${skippedCount}` : '0';
      
      md += `| [${c.name}](${link}) | ${c.files.length} | ${c.totalTests} | ${c.totalScenarios} | ${skippedBadge} |\n`;
    });
    md += '\n';
  });

  md += `\n*Last updated: ${new Date().toISOString().split('T')[0]}*\n`;
  return md;
}

/**
 * Generate a Consolidated Domain Page
 */
function generateDomainMarkdown(domainName, components) {
  // Stats for the Domain
  const totalTests = components.reduce((s, c) => s + c.totalTests, 0);
  const totalFiles = components.reduce((s, c) => s + c.files.length, 0);

  let md = `[🏠 Home](./README.md) > **${domainName}**\n\n`;
  md += `# ${domainName}\n\n`;
  md += `> **${components.length} Components** | **${totalFiles} Files** | **${totalTests} Tests**\n\n`;

  // Table of Contents for the page
  md += `## Table of Contents\n`;
  components.forEach(c => {
    md += `- [${c.name}](#${c.slug})\n`;
  });
  md += `\n---\n\n`;

  // Render Each Component
  components.forEach(component => {
    // Add explicit anchor div to ensure robust linking
    md += `<div id="${component.slug}"></div>\n\n`;
    md += `## ${component.name}\n\n`;
    
    // Sort files by size (scenarios)
    const sortedFiles = [...component.files].sort((a, b) => b.totalScenarios - a.totalScenarios);

    sortedFiles.forEach(file => {
      md += renderFileWithCollapse(file);
    });
    
    md += `\n---\n\n`;
  });

  return md;
}

function renderFileWithCollapse(file) {
  const relativePath = file.path.split('openmetadata-ui/')[1] || file.path; 
  const fileUrl = `${REPO_BASE_URL}/blob/main/openmetadata-ui/${relativePath}`;
  
  // Collapsible Details Block
  let md = `<details open>\n`;
  md += `<summary>📄 <b>${file.fileName}</b> (${file.totalTests} tests)</summary>\n\n`;
  
  md += `> Source: [\`${relativePath}\`](${fileUrl})\n\n`;

  // Render Describes
  file.describes.forEach(describe => {
    if (describe.tests.length === 0) return;
    md += `### ${describe.name}\n\n`;
    // Pass prefix to renderTable
    md += renderTable(describe.tests, fileUrl, describe.name);
  });

  // Render Root Tests
  if (file.rootTests.length > 0) {
    md += `### Standalone Tests\n\n`;
    md += renderTable(file.rootTests, fileUrl);
  }

  md += `</details>\n\n`;
  return md;
}


function renderTable(tests, fileUrl, prefix = '') {
  let md = `| # | Test Case | Description |\n|---|-----------|-------------|\n`;
  
  tests.forEach((test, idx) => {
    const badge = test.isSkipped ? ' ⏭️' : '';
    // Escape pipes in names to avoid breaking tables
    const name = test.name.replace(/\|/g, '\\|');
    const desc = (test.description || '-').replace(/\|/g, '\\|');
    
    // Bold specific parts for readability (e.g., Entity Names)
    const formattedName = name.includes('→') 
      ? name.split('→').map((part, i) => i === 0 ? `**${part.trim()}**` : part.trim()).join(' → ')
      : name;

    // Use explicit prefix if provided (e.g. Entity Name)
    const displayName = prefix ? `**${prefix}** - ${formattedName}` : formattedName;

    // Test Case text is plain text (bolded/formatted) without line number link
    md += `| ${idx + 1} | ${displayName}${badge} | ${desc} |\n`;

    // Render Steps as sub-rows if needed
    test.steps.forEach(step => {
       const stepName = step.name.replace(/\|/g, '\\|');
       md += `| | ↳ *${stepName}* | |\n`;
    });
  });
  
  md += '\n';
  return md;
}

module.exports = {
  generateIndexMarkdown,
  generateDomainMarkdown
};
