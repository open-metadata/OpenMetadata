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

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Executes 'playwright test --list --reporter=json' and returns the parsed JSON.
 */
function runPlaywrightList(testDir) {
  const projectRoot = path.resolve(testDir, '../..');
  const tempConfigName = 'playwright.docs.temp.config.ts';
  const tempConfigPath = path.join(projectRoot, tempConfigName);

  // Temporary config to catch ALL tests, ignoring exclusions in the main config
  // We need dotenv to ensure conditional tests (like Airflow check) run/list correctly.
  const tempConfigContent = `
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

// Read from default .env file
dotenv.config();

export default defineConfig({
  testDir: './playwright/e2e',
  projects: [
    {
      name: 'docs',
      // Include spec files, explicit app files, and setup/teardown files
      testMatch: [
        '**/*.spec.ts', 
        '**/*.test.ts',
        '**/dataInsightApp.ts', 
        '**/*.setup.ts', 
        '**/*.teardown.ts'
      ],
    },
  ],
});
`;

  // Cleanup helper
  const cleanup = () => {
    try {
      if (fs.existsSync(tempConfigPath)) {
        fs.unlinkSync(tempConfigPath);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  };

  // Register cleanup on exit signals to ensure file is deleted even on Ctrl+C
  const signalHandler = () => { cleanup(); process.exit(); };
  process.on('SIGINT', signalHandler);
  process.on('SIGTERM', signalHandler);
  // We need to be careful with 'exit' as it runs on normal exit too. 
  // We'll rely on 'finally' block for normal exit + explicit cleanup call.
  // But adding it as backup for other exit modes is okay if guarded.
  process.on('exit', cleanup);

  try {
    fs.writeFileSync(tempConfigPath, tempConfigContent);
    
    console.log(`   Running 'npx playwright test --list --reporter=json' using temp config in ${projectRoot}...`);
    
    const output = execSync(`npx playwright test --list --reporter=json --config=${tempConfigName}`, { 
      cwd: projectRoot,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    
    return JSON.parse(output);
  } catch (error) {
    console.error('❌ Failed to run Playwright list command:', error.message);
    if (error.stdout) console.log('Stdout:', error.stdout);
    if (error.stderr) console.error('Stderr:', error.stderr);
    process.exit(1);
  } finally {
    cleanup();
    // Remove listeners
    process.removeListener('SIGINT', signalHandler);
    process.removeListener('SIGTERM', signalHandler);
    process.removeListener('exit', cleanup);
  }
}

/**
 * Extract behavior description from test name.
 */
function extractBehavior(testName) {
  let behavior = testName
    .replace(/^should\s+/i, '')
    .replace(/^verify\s+(that\s+)?/i, '')
    .replace(/^check\s+(that\s+)?/i, '')
    .replace(/^ensure\s+(that\s+)?/i, '')
    .replace(/^test\s+(that\s+)?/i, '');

  return behavior.charAt(0).toUpperCase() + behavior.slice(1);
}

/**
 * Reads the source file and extracts JSDoc comments above the given line number.
 */
function extractJSDoc(filePath, lineNumber) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let checkIndex = lineNumber - 2; // Playwright line is 1-indexed, we want line BEFORE it (0-indexed)

    let commentLines = [];
      
    // Scanning backwards for comments
    while (checkIndex >= 0) {
      const checkLine = lines[checkIndex].trim();
      if (checkLine.endsWith('*/')) {
          // Found end of comment, now find start
          let startIndex = checkIndex;
          while (startIndex >= 0) {
            const startLine = lines[startIndex].trim();
            commentLines.unshift(startLine);
            if (startLine.startsWith('/**')) {
              break;
            }
            startIndex--;
          }
          break; // Stop after finding one block
      } else if (checkLine === '' || checkLine.startsWith('//')) {
        checkIndex--;
        continue;
      } else {
        break; // Stop if non-comment code found
      }
    }
    
    if (commentLines.length > 0) {
        const raw = commentLines
          .join('\n')
          .replace(/\/\*\*|\*\/|\*/g, '') // Remove comment markers
          .split('\n')
          .map(l => l.trim())
          .filter(l => l)
          .join(' ');

        // Clean up @description tag
        return raw.replace(/@description/gi, '').trim();
    }
  } catch (err) {
    // Ignore errors reading file for comments
  }
  return '';
}

/**
 * Recursively traverse the Playwright JSON suite structure to flatten tests.
 */
/**
 * Recursively find test.step calls in the function body
 */
function findStepsInNode(node, steps, ts) {
    if (ts.isCallExpression(node)) {
        const expr = node.expression;
        if (ts.isPropertyAccessExpression(expr) && 
            expr.name.getText() === 'step' && 
            expr.expression.getText() === 'test') {
            
            if (node.arguments.length > 0) {
                const titleArg = node.arguments[0];
                if (ts.isStringLiteral(titleArg)) {
                    steps.push({ name: titleArg.text });
                } else if (ts.isNoSubstitutionTemplateLiteral(titleArg)) {
                    steps.push({ name: titleArg.text });
                } else if (ts.isTemplateExpression(titleArg)) {
                    // Reconstruct template string (best effort)
                    let text = titleArg.head.text;
                    titleArg.templateSpans.forEach(span => {
                        text += '${...}' + span.literal.text;
                    });
                    steps.push({ name: text });
                } else if (ts.isBinaryExpression(titleArg)) {
                   // Handle concatenation: "Name " + variable
                   // This is a complex case, for now we might just capture static parts or placeholder
                    steps.push({ name: titleArg.getText() }); 
                }
            }
        }
    }
    ts.forEachChild(node, n => findStepsInNode(n, steps, ts));
}

/**
 * Extracts steps from a specific test file using TypeScript AST
 */
function extractSteps(filePath, testLine) {
    try {
        // We use the existing typescript dependency from the project
        const ts = require('typescript');
        
        const content = fs.readFileSync(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(
            filePath,
            content,
            ts.ScriptTarget.Latest,
            true
        );

        let steps = [];

        function visit(node) {
            if (ts.isCallExpression(node)) {
                const expr = node.expression;
                // Identify test(...) calls
                const isTest = (ts.isIdentifier(expr) && expr.text === 'test') ||
                               (ts.isPropertyAccessExpression(expr) && expr.expression.getText() === 'test' && ['skip', 'fixme', 'only'].includes(expr.name.getText()));

                if (isTest) {
                    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                    // Playwright line is 1-indexed, AST line is 0-indexed
                    if (line + 1 === testLine) {
                        // Found the test! Now find the body.
                        // Iterate args to find the function body (ArrowFunction or FunctionExpression)
                        let body = null;
                        for (const arg of node.arguments) {
                            if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
                                body = arg;
                                break;
                            }
                        }

                        if (body) {
                            ts.forEachChild(body, n => findStepsInNode(n, steps, ts));
                        }
                    }
                }
            }
            ts.forEachChild(node, visit);
        }

        visit(sourceFile);
        return steps;
    } catch (e) {
        // Fallback if typescript not found or parsing fails
        // console.error(`Error parsing steps for ${filePath}:`, e.message);
        return [];
    }
}

/**
 * Recursively traverse the Playwright JSON suite structure to flatten tests.
 */
function flattenTests(suite, testDir) {
  let tests = [];

  // If this suite matches a specific file, finding the absolute path
  // Playwright JSON 'file' property is relative to the project root usually.
  
  if (suite.specs) {
    suite.specs.forEach(spec => {
       // A spec can have multiple "tests" (projects), but logically it's one test case usually.
       // We take the first one for metadata (line number, etc).
       // Actually, the 'tests' array in JSON represents browsers/projects.
       // We only want ONE entry per test definition in code.
       
       const specLine = spec.line;
       const specTitle = spec.title;
       const specFile = spec.file; // Relative path
       
       // Construct absolute path
       // This is tricky without knowing the exact root Playwright used.
       // But we know 'testDir' (e2e folder). 
       // Playwright file paths like "Features/DataAssetRules.spec.ts" are relative to 'testDir'.
       const absolutePath = path.resolve(testDir, specFile);
       
       const description = extractJSDoc(absolutePath, specLine) || extractBehavior(specTitle);
       const steps = extractSteps(absolutePath, specLine);
       
       tests.push({
           name: specTitle,
           line: specLine,
           description: description,
           steps: steps, 
           isSkipped: false // We can check spec.tests[0].status or annotations
       });
    });
  }


  if (suite.suites) {
    suite.suites.forEach(childSuite => {
      tests = tests.concat(flattenTests(childSuite, testDir));
    });
  }
  
  return tests;
}

/**
 * Extracts tests specifically for a Describe block (suite).
 * Flattens any nested suites inside it, as our doc extractor only supports 1 level of nesting depth in UI.
 */
function extractDescribe(suite, testDir) {
    const tests = flattenTests(suite, testDir);
    return {
        name: suite.title,
        tests: tests
    };
}

/**
 * Main function to load tests using Playwright
 */
function loadTestsFromPlaywright(testDir) {
  const jsonReport = runPlaywrightList(testDir);
  
  // The JSON root has a 'suites' array.
  // Each top-level suite usually represents a file.
  
  const files = [];

  // Helper to extract tests for a specific file suite
  function processFileSuite(fileSuite) {
      const fileName = path.basename(fileSuite.file);
      const filePath = path.resolve(testDir, fileSuite.file);
      
      // 1. Root-level tests (standalones in the file)
      //    We only take specs directly attached to this file suite.
      //    We do NOT recurse into child suites for rootTests anymore.
      let rootTests = [];
      if (fileSuite.specs) {
          // Temporarily create a fake suite with just these specs to reuse flattenTests logic which handles JSDoc etc.
          const tempSuite = { specs: fileSuite.specs, file: fileSuite.file }; 
          rootTests = flattenTests(tempSuite, testDir);
      }
      
      // 2. Describe blocks (Child Suites like "Api Endpoint", "Table")
      const describes = [];
      if (fileSuite.suites) {
          fileSuite.suites.forEach(childSuite => {
              describes.push(extractDescribe(childSuite, testDir));
          });
      }
      
      // Calculate totals
      let totalTests = rootTests.length;
      describes.forEach(d => totalTests += d.tests.length);
      
      return {
          path: filePath,
          fileName: fileName,
          totalTests: totalTests,
          totalSteps: 0, 
          totalScenarios: totalTests,
          rootTests: rootTests,
          describes: describes
      };
  }

  // Iterate top level suites (Files)
  jsonReport.suites.forEach(rootSuite => {
      // Recursively find all "file" suites (sometimes nested within folders)
      // Actually, Playwright structure is: Root -> Folder -> Folder -> File -> Describe -> Spec
      
      const fileSuites = [];
      
      function findFileSuites(suite) {
          // If a suite has a 'file' property, it is a file-level suite (or a suite inside a file).
          // Since we traverse from root, the FIRST node we hit with 'file' is the File itself.
          // We must STOP recursing here, otherwise we will pick up every single 'describe' block as a separate file entry.
          if (suite.file) {
             fileSuites.push(suite);
             return;
          }
          
          // If no file property, it's a folder or project suite. Continue recursing.
          if (suite.suites) {
             suite.suites.forEach(child => findFileSuites(child));
          }
      }
      
      findFileSuites(rootSuite);
      
      fileSuites.forEach(fs => {
         files.push(processFileSuite(fs)); 
      });
  });

  return files;
}

module.exports = { loadTestsFromPlaywright };
