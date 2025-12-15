
import { Component, TestCase, TestFile } from './types.js';

const REPO_BASE_URL = 'https://github.com/open-metadata/OpenMetadata';

/**
 * Generate the Main Index Page (Home)
 */
export function generateIndexMarkdown(components: Component[], stats: any): string {
  const sortedComponents = [...components].sort((a, b) => b.totalScenarios - a.totalScenarios);

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
      link: ${REPO_BASE_URL}
features:
  - title: ${components.length} Components
    details: Modular breakdown including Glossary, Settings, and Data Assets.
  - title: ${stats.tests} Test Cases
    details: Detailed inventory of all automated test scenarios.
  - title: ${stats.steps} Test Steps
    details: Step-by-step logic extracted directly from test code.
---

## Summary

| Metric | Count |
|--------|-------|
| **Components** | ${stats.components} |
| **Test Files** | ${stats.files} |
| **Test Cases** | ${stats.tests} |
| **Test Steps** | ${stats.steps} |

---

## Components

| Component | Files | Tests | Steps |
|-----------|-------|-------|-------|
`;

  sortedComponents.forEach(c => {
    md += `| [${c.name}](/components/${c.slug}) | ${c.files.length} | ${c.totalTests} | ${c.totalSteps} |\n`;
  });

  md += `\n*Generated automatically on ${new Date().toISOString().split('T')[0]}*\n`;
  return md;
}

/**
 * Generate the Components Index Page
 */
export function generateComponentsIndex(components: Component[]): string {
  const sorted = [...components].sort((a, b) => b.totalScenarios - a.totalScenarios);

  return `---
title: Components
---

# Test Components

Browse tests organized by component/feature area.

| Component | Test Files | Test Cases | Test Steps | Total Scenarios |
|-----------|------------|------------|------------|-----------------|
${sorted.map(c => `| [${c.name}](./${c.slug}) | ${c.files.length} | ${c.totalTests} | ${c.totalSteps} | ${c.totalScenarios} |`).join('\n')}
`;
}

/**
 * Generate a specific Component Page
 */
export function generateComponentMarkdown(component: Component): string {
  // Frontmatter
  let md = `---
title: ${component.name}
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

  const sortedFiles = [...component.files].sort((a, b) => b.totalScenarios - a.totalScenarios);

  return md + sortedFiles.map(file => renderFile(file)).join('\n');
}

function renderFile(file: TestFile): string {
  // Normalize path to match repo structure
  // Assumes we are in openmetadata-ui/src/main/resources/ui/playwright/e2e/...
  const relativePath = file.path.split('openmetadata-ui/')[1] || file.path; 
  const fileUrl = `${REPO_BASE_URL}/blob/main/openmetadata-ui/${relativePath}`;
  
  let md = `## ${file.fileName.replace('.spec.ts', '')}\n\n`;
  md += `📁 **File:** [\`${relativePath}\`](${fileUrl})\n\n`;
  
  md += `| Metric | Count |\n|--------|-------|\n| Tests | ${file.totalTests} |\n| Steps | ${file.totalSteps} |\n\n`;

  // Render Describes
  file.describes.forEach(describe => {
    if (describe.tests.length === 0) return;
    md += `### ${describe.name}\n\n`;
    md += renderTable(describe.tests, fileUrl);
  });

  // Render Root Tests
  if (file.rootTests.length > 0) {
    md += `### Standalone Tests\n\n`;
    md += renderTable(file.rootTests, fileUrl);
  }

  md += '---\n\n';
  return md;
}

function renderTable(tests: TestCase[], fileUrl: string): string {
  let md = `| # | Test | Behavior | Steps | Line |\n|---|------|----------|-------|------|\n`;
  
  tests.forEach((test, idx) => {
    const badge = test.isSkipped ? ' ⏭️' : '';
    const stepsCount = test.steps.length > 0 ? `${test.steps.length}` : '-';
    // Escape pipes in names to avoid breaking tables
    const name = test.name.replace(/\|/g, '\\|');
    const desc = (test.description || '-').replace(/\|/g, '\\|');
    
    md += `| ${idx + 1} | ${name}${badge} | ${desc} | ${stepsCount} | [L${test.line}](${fileUrl}#L${test.line}) |\n`;

    // Render Steps as sub-rows
    test.steps.forEach(step => {
      const stepName = step.name.replace(/\|/g, '\\|');
      md += `| | ↳ *${stepName}* | | | [L${step.line}](${fileUrl}#L${step.line}) |\n`;
    });
  });
  
  md += '\n';
  return md;
}
