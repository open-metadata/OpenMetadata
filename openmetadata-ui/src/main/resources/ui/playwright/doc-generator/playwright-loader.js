
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Executes 'playwright test --list --reporter=json' and returns the parsed JSON.
 */
function runPlaywrightList(testDir) {
  try {
    // We run relative to the project root (assumed to be where package.json is, or a couple levels up)
    // The previous parser assumed input dir was 'openmetadata-ui/src/main/resources/ui/playwright/e2e'
    // We need to run the command from 'openmetadata-ui/src/main/resources/ui' where package.json typically is for UI
    
    // Construct command
    // We filter by project? Or just list all. The user's repo seems to have projects configured.
    // The JSON output showed "projectName": "DataAssetRulesDisabled".
    // We probably want to list ALL tests.
    
    // Note: 'testDir' passed from generate.js is the absolute path to e2e folder.
    // We need to find the root where 'npx' can run.
    // e2e is at: .../ui/playwright/e2e
    // .. -> playwright
    // ../.. -> ui (This is where package.json and playwright.config.ts are)
    const projectRoot = path.resolve(testDir, '../..'); 
    
    console.log(`   Running 'npx playwright test --list --reporter=json' in ${projectRoot}...`);
    
    // Increase maxBuffer to handle large JSON output (2000+ tests)
    const output = execSync('npx playwright test --list --reporter=json', { 
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
       
       tests.push({
           name: specTitle,
           line: specLine,
           description: description,
           steps: [], // Playwright list doesn't give steps, sadly. We might lose steps in the doc.
                      // Trade-off: Accurate tests vs Steps. Steps were always flaky in parser.
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
