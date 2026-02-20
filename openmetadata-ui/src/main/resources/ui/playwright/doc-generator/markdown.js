/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

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

  // Calculate accurate "Scenario" count (Test + Steps)
  // Logic: 
  // If a test has steps, Scenarios = Step Count.
  // If a test has NO steps, Scenarios = 1 (The test itself).
  let totalScenarios = 0;
  components.forEach(c => {
      c.files.forEach(f => {
          // Process root tests
          f.rootTests.forEach(t => {
              totalScenarios += (t.steps && t.steps.length > 0) ? t.steps.length : 1;
          });
          // Process describes
          f.describes.forEach(d => {
              d.tests.forEach(t => {
                  totalScenarios += (t.steps && t.steps.length > 0) ? t.steps.length : 1;
              });
          });
      });
  });

  let md = `# OpenMetadata E2E Test Documentation

> **Auto-generated documentation** from Playwright source code.

## 📊 Summary

| Metric | Count |
|--------|-------|
| **Components** | ${stats.components} |
| **Test Files** | ${stats.files} |
| **Test Cases** | ${stats.tests} |
| **Total Scenarios** | ${totalScenarios} 🚀 |

---

`;

  // Render Domain Tables
  Object.entries(domains).forEach(([domainName, comps]) => {
    if (comps.length === 0) return;

    // Calculate Domain Stats
    const domainTests = comps.reduce((s, c) => s + c.totalTests, 0);
    const domainComponents = comps.length;
    
    let domainScenarios = 0;
    comps.forEach(c => {
        c.files.forEach(f => {
            f.rootTests.forEach(t => domainScenarios += (t.steps && t.steps.length > 0) ? t.steps.length : 1);
            f.describes.forEach(d => d.tests.forEach(t => domainScenarios += (t.steps && t.steps.length > 0) ? t.steps.length : 1));
        });
    });

    md += `## ${domainName}\n\n`;
    md += `> **${domainComponents} Components** | **${domainTests} Tests** | **${domainScenarios} Scenarios**\n\n`;

    md += `| Component | Files | Tests | Total Scenarios | Skipped |\n`;
    md += `|-----------|-------|-------|-----------------|---------|\n`;
    
    comps.forEach(c => {
      let compScenarios = 0;
      let skippedCount = 0; // Initialize skippedCount for each component
      c.files.forEach(file => {
        file.rootTests.forEach(t => { 
            if(t.isSkipped) skippedCount++; 
            compScenarios += (t.steps && t.steps.length > 0) ? t.steps.length : 1;
        });
        file.describes.forEach(d => {
            d.tests.forEach(t => { 
                if(t.isSkipped) skippedCount++; 
                compScenarios += (t.steps && t.steps.length > 0) ? t.steps.length : 1;
            });
        });
      });

      // Link to the Domain file (e.g., ./Governance.md) with explicit anchor
      const anchor = c.slug; // Use pre-calculated slug
      const link = `./${domainName}.md#${anchor}`;
      const skippedBadge = skippedCount > 0 ? `🟡 ${skippedCount}` : '0';
      
      md += `| [${c.name}](${link}) | ${c.files.length} | ${c.totalTests} | ${compScenarios} | ${skippedBadge} |\n`;
    });
    md += '\n';
  });

  md += `\n*Last updated: ${new Date().toISOString().split('T')[0]}*\n`;
  return md;
}

/**
 * Generate a Consolidated Domain Page
 */
function generateDomainMarkdown(domainName, components, options = {}) {
  const { repoBaseUrl } = options;

  // Stats for the Domain
  const totalTests = components.reduce((s, c) => s + c.totalTests, 0);
  const totalFiles = components.reduce((s, c) => s + c.files.length, 0);
  
  // Calculate Domain Total Scenarios
  let domainScenarios = 0;
  components.forEach(c => {
      c.files.forEach(f => {
          f.rootTests.forEach(t => {
              domainScenarios += (t.steps && t.steps.length > 0) ? t.steps.length : 1;
          });
          f.describes.forEach(d => {
              d.tests.forEach(t => {
                  domainScenarios += (t.steps && t.steps.length > 0) ? t.steps.length : 1;
              });
          });
      });
  });

  let md = `[🏠 Home](./README.md) > **${domainName}**\n\n`;
  md += `# ${domainName}\n\n`;
  md += `> **${components.length} Components** | **${totalFiles} Files** | **${totalTests} Tests** | **${domainScenarios} Scenarios** 🚀\n\n`;

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
      md += renderFileWithCollapse(file, repoBaseUrl);
    });
    
    md += `\n---\n\n`;
  });

  return md;
}

function renderFileWithCollapse(file, repoBaseUrl) {
  // Try to find relative path from 'src/main/resources/ui' or similar common roots if possible, 
  // or fall back to just filename if path parsing is complex.
  // Assuming standard Maven structure: .../src/main/resources/ui/...
  
  // Robust path logic for both OpenMetadata (monorepo) and Collate (separate repo)
  // Goal: relativePath should be 'src/main/resources/ui/...' to match standard docs
  
  let relativePath = file.path;
  const standardPrefix = 'src/main/resources/ui/';

  if (file.path.includes('openmetadata-ui/')) {
    // Standard OM case: path contains 'openmetadata-ui/src/main/resources/ui/...'
    relativePath = file.path.split('openmetadata-ui/')[1];
  } else if (file.path.includes(standardPrefix)) {
    // Collate/Fallback case: path contains 'src/main/resources/ui/...' but maybe not 'openmetadata-ui/'
    // We normalize it to start with src/main/resources/ui/
    relativePath = standardPrefix + file.path.split(standardPrefix)[1];
    // Ensure no double slashes from split
    relativePath = relativePath.replace('//', '/');
  }

  // URL Construction assuming 'openmetadata-ui' is the root module folder in both repos
  const fileUrl = `${repoBaseUrl}/blob/main/openmetadata-ui/${relativePath.startsWith('/') ? relativePath.substring(1) : relativePath}`;
  
  // Calculate File Scenarios
  let fileScenarios = 0;
  file.rootTests.forEach(t => fileScenarios += (t.steps && t.steps.length > 0) ? t.steps.length : 1);
  file.describes.forEach(d => d.tests.forEach(t => fileScenarios += (t.steps && t.steps.length > 0) ? t.steps.length : 1));

  // Collapsible Details Block
  let md = `<details open>\n`;
  md += `<summary>📄 <b>${file.fileName}</b> (${file.totalTests} tests, ${fileScenarios} scenarios)</summary>\n\n`;
  
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
    // Escape backslashes first, then pipes to avoid breaking tables
    const name = test.name.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
    const desc = (test.description || '-').replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
    
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
       const stepName = step.name.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
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
