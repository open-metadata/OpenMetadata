
import * as fs from 'fs';
import * as path from 'path';
import { TestCase, TestDescribe, TestFile } from './types.js';

/**
 * Clean up test names to be more readable behavior descriptions.
 */
function extractBehavior(testName: string): string {
  let behavior = testName
    .replace(/^should\s+/i, '')
    .replace(/^verify\s+(that\s+)?/i, '')
    .replace(/^check\s+(that\s+)?/i, '')
    .replace(/^ensure\s+(that\s+)?/i, '')
    .replace(/^test\s+(that\s+)?/i, '');

  return behavior.charAt(0).toUpperCase() + behavior.slice(1);
}

/**
 * Scan directory recursively for .spec.ts files.
 */
export function findTestFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        files.push(...findTestFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }
  return files;
}

/**
 * Parse a single test file to extract describes, tests, and steps.
 */
export function parseTestFile(filePath: string): TestFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  const parsed = parseContent(content);

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

function parseContent(content: string) {
  const lines = content.split('\n');
  const describes: TestDescribe[] = [];
  const rootTests: TestCase[] = [];
  
  let currentDescribe: TestDescribe | null = null;
  let currentTest: TestCase | null = null;
  let totalTests = 0;
  let totalSteps = 0;

  // Track array declarations for parameterization
  const arrayDeclarations = new Map<string, string[]>();
  let forEachContext: { arrayName: string; items: string[] } | null = null;

  // Track multi-line array declarations
  let currentArrayName: string | null = null;
  let currentArrayItems: string[] = [];
  let inArrayDeclaration = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    const lineNumber = i + 1;

    // Detect start of array: const entities = [
    const arrayStartMatch = trimmedLine.match(/const\s+(\w+)\s*=\s*\[/);
    if (arrayStartMatch) {
      currentArrayName = arrayStartMatch[1];
      inArrayDeclaration = true;
      // Check if array closes on same line
      if (trimmedLine.includes(']')) {
        const singleLineMatch = trimmedLine.match(/const\s+(\w+)\s*=\s*\[([^\]]+)\]/);
        if (singleLineMatch) {
          const items = singleLineMatch[2].split(',')
            .map(item => item.trim())
            .filter(item => item && !item.includes('//'))
            .map(item => item.replace(/Class$/, '').replace(/^\w+\./, ''));
          if (items.length > 0) {
            arrayDeclarations.set(currentArrayName, items);
          }
        }
        inArrayDeclaration = false;
        currentArrayName = null;
      }
    }
    // Continue collecting array items
    else if (inArrayDeclaration && currentArrayName) {
      if (trimmedLine.includes(']')) {
        // End of array
        inArrayDeclaration = false;
        if (currentArrayItems.length > 0) {
          arrayDeclarations.set(currentArrayName, currentArrayItems);
        }
        currentArrayName = null;
        currentArrayItems = [];
      } else {
        // Extract items from this line
        const items = trimmedLine.split(',')
          .map(item => item.trim())
          .filter(item => item && !item.includes('//') && !item.includes('as const'))
          .map(item => item.replace(/Class$/, '').replace(/^\w+\./, ''));
        currentArrayItems.push(...items);
      }
    }

    // Detect forEach: entities.forEach((EntityClass) => {
    const forEachMatch = trimmedLine.match(/(\w+)\.forEach\s*\(/);
    if (forEachMatch) {
      const arrayName = forEachMatch[1];
      const items = arrayDeclarations.get(arrayName);
      if (items && items.length > 0) {
        forEachContext = { arrayName, items };
      }
    }

    // Don't clear forEach context on }); - it might be a nested describe/test closing
    // The forEach context will naturally end when we hit the next top-level structure

    // Match test.describe - handle both string literals and variables
    const describeMatchLiteral = trimmedLine.match(/(?:test\.)?describe(?:\.skip)?(?:\.only)?\s*\(\s*['"`](.+?)['"`]/);
    const describeMatchVariable = trimmedLine.match(/(?:test\.)?describe(?:\.skip)?(?:\.only)?\s*\(\s*(\w+)/);
    
    if (describeMatchLiteral || describeMatchVariable) {
      if (currentDescribe) describes.push(currentDescribe);
      
      let describeName = describeMatchLiteral ? describeMatchLiteral[1] : (describeMatchVariable?.[1] || 'Unknown');
      
      // If we're in a forEach context and describe uses a variable, we're in the parameterized section
      if (forEachContext && describeMatchVariable) {
        // Don't create describe yet - tests will be expanded individually
        currentDescribe = {
          name: 'Parameterized Tests', // Placeholder
          tests: [],
          nestedDescribes: [],
          line: lineNumber,
        };
      } else {
        currentDescribe = {
          name: describeName,
          tests: [],
          nestedDescribes: [],
          line: lineNumber,
        };
      }
    }

    // Match test() - but not test.describe, test.step, test.beforeAll, etc.
    const testMatch = trimmedLine.match(/^(?:test|it)(?:\.skip|\.only)?\s*\(\s*['"`](.+?)['"`]/);
    const isExcluded = ['test.describe', 'test.use', 'test.before', 'test.after', 'test.step']
      .some(keyword => trimmedLine.includes(keyword));

    if (testMatch && !isExcluded) {
      const isSkipped = trimmedLine.includes('.skip');
      const testName = testMatch[1];
      
      // If we're in a forEach context, create tests for each entity
      if (forEachContext) {
        forEachContext.items.forEach(entityName => {
          const expandedTest: TestCase = {
            name: `${entityName} → ${testName}`,
            line: lineNumber,
            steps: [],
            description: extractBehavior(testName),
            isSkipped,
          };
          
          if (currentDescribe) {
            currentDescribe.tests.push(expandedTest);
          } else {
            rootTests.push(expandedTest);
          }
          totalTests++;
        });
      } else {
        currentTest = {
          name: testName,
          line: lineNumber,
          steps: [],
          description: extractBehavior(testName),
          isSkipped,
        };

        if (currentDescribe) {
          currentDescribe.tests.push(currentTest);
        } else {
          rootTests.push(currentTest);
        }
        totalTests++;
      }
    }

    // Match test.step() - handles both single line and multi-line patterns
    const stepMatch = trimmedLine.match(/(?:await\s+)?test\.step\s*\(\s*['"`](.+?)['"`]/);
    const stepStartMatch = trimmedLine.match(/(?:await\s+)?test\.step\s*\(\s*$/);

    if (stepMatch && currentTest) {
      currentTest.steps.push({ name: stepMatch[1], line: lineNumber });
      totalSteps++;
    } else if (stepStartMatch && currentTest && i + 1 < lines.length) {
      const nextLineMatch = lines[i + 1].trim().match(/^['"`](.+?)['"`]/);
      if (nextLineMatch) {
        currentTest.steps.push({ name: nextLineMatch[1], line: lineNumber });
        totalSteps++;
      }
    }
  }

  if (currentDescribe) describes.push(currentDescribe);

  return { describes, rootTests, totalTests, totalSteps };
}
