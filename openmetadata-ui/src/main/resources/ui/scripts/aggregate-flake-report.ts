/*
 *  Copyright 2026 Collate.
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
 * Turns Playwright's JSON reporter output (already produced on every CI run,
 * see playwright.config.ts) into a small flake-report.json summary. Playwright
 * already runs with retries: 1 and marks a spec 'flaky' when it fails then
 * passes, so this is a pure aggregation over data CI already has — no extra
 * test runtime.
 *
 *   node scripts/aggregate-flake-report.ts <results.json> <flake-report.json>
 */

'use strict';

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * @param {object} json Playwright JSON reporter output.
 * @returns {{generatedAt: string, totals: {tests: number, flaky: number, failed: number}, flaky: Array<{file: string, title: string, retries: number}>}}
 */
const aggregate = (json) => {
  const flaky = [];
  let tests = 0;
  let failed = 0;

  const walk = (suites, inheritedFile) => {
    for (const suite of suites ?? []) {
      const file = suite.file ?? inheritedFile;

      for (const spec of suite.specs ?? []) {
        for (const testCase of spec.tests ?? []) {
          tests += 1;

          if (testCase.status === 'flaky') {
            flaky.push({
              file,
              title: spec.title,
              retries: Math.max((testCase.results ?? []).length - 1, 0),
            });
          }

          if (testCase.status === 'unexpected') {
            failed += 1;
          }
        }
      }

      walk(suite.suites, file);
    }
  };

  walk(json.suites, undefined);

  return {
    generatedAt: new Date().toISOString(),
    totals: { tests, flaky: flaky.length, failed },
    flaky,
  };
};

const main = () => {
  const [input, output] = process.argv.slice(2);

  if (!input || !output) {
    console.error(
      'usage: node scripts/aggregate-flake-report.ts <results.json> <flake-report.json>'
    );
    process.exit(1);
  }

  if (!fs.existsSync(input)) {
    console.error(`no results file at ${input} — nothing to aggregate`);
    process.exit(0);
  }

  const report = aggregate(JSON.parse(fs.readFileSync(input, 'utf8')));
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(
    `flaky: ${report.totals.flaky} / ${report.totals.tests} tests, failed: ${report.totals.failed}`
  );
};

// ESM has no `require.main`; comparing this module's URL with the entry point
// is the equivalent "am I being run directly, not imported?" check.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { aggregate };
