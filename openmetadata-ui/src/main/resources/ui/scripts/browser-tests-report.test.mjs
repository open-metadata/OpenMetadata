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
import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  addedLines,
  changedCoverage,
  junitResults,
  lineHits,
  renderComment,
} from './browser-tests-report.mjs';

const UI = 'openmetadata-ui/src/main/resources/ui/';
const diff = [
  `+++ b/${UI}src/pages/Roles/Roles.tsx`,
  '@@ -10,0 +11,3 @@',
  '@@ -40 +44 @@',
  `+++ b/${UI}src/pages/Roles/Roles.browser.test.tsx`,
  '@@ -1 +1,2 @@',
  `+++ b/${UI}src/utils/Unloaded.ts`,
  '@@ -5,0 +6,2 @@',
  '+++ b/openmetadata-service/src/Foo.java',
  '@@ -1 +1 @@',
].join('\n');

it('collects added lines of changed UI source, not tests or other modules', () => {
  const added = addedLines(diff);
  assert.deepEqual(
    [...added.keys()],
    ['src/pages/Roles/Roles.tsx', 'src/utils/Unloaded.ts']
  );
  assert.deepEqual(
    [...added.get('src/pages/Roles/Roles.tsx')],
    [11, 12, 13, 44]
  );
});

it('counts changed executable lines the tests ran, by statement start line', () => {
  const coverage = {
    '/home/runner/work/x/openmetadata-ui/src/main/resources/ui/src/pages/Roles/Roles.tsx':
      {
        path: '/home/runner/work/x/openmetadata-ui/src/main/resources/ui/src/pages/Roles/Roles.tsx',
        statementMap: {
          0: { start: { line: 11 } },
          1: { start: { line: 12 } },
          2: { start: { line: 12 } },
          3: { start: { line: 44 } },
        },
        s: { 0: 3, 1: 0, 2: 1, 3: 0 },
      },
  };
  const rows = changedCoverage(addedLines(diff), lineHits(coverage));
  assert.deepEqual(rows, [
    {
      file: 'src/pages/Roles/Roles.tsx',
      loaded: true,
      executable: 3,
      covered: 2,
    },
    { file: 'src/utils/Unloaded.ts', loaded: false, executable: 0, covered: 0 },
  ]);
});

it('reads totals and failed tests from a Vitest JUnit report', () => {
  const xml = `<testsuites>
<testsuite name="a" tests="3" failures="1" errors="0" skipped="1">
<testcase classname="src/a.browser.test.tsx" name="list &gt; pages" time="1"><failure message="x"/></testcase>
<testcase classname="src/a.browser.test.tsx" name="list &gt; sorts" time="1"></testcase>
</testsuite>
<testsuite name="b" tests="2" failures="0" errors="0" skipped="0"></testsuite>
</testsuites>`;
  assert.deepEqual(junitResults(xml), {
    tests: 5,
    failures: 1,
    skipped: 1,
    failed: ['src/a.browser.test.tsx › list > pages'],
  });
});

it('renders what ran, the result and changed-code coverage', () => {
  const md = renderComment({
    selection: {
      mode: 'selected',
      reason: '2 of 130 test files execute the changed code',
    },
    results: { tests: 5, failures: 0, skipped: 1, failed: [] },
    rows: [
      { file: 'src/a.tsx', loaded: true, executable: 4, covered: 3 },
      { file: 'src/b.ts', loaded: false, executable: 0, covered: 0 },
    ],
  });
  assert.match(md, /\*\*Ran:\*\* 2 of 130 test files/);
  assert.match(md, /✅ 4 passed · 1 skipped/);
  assert.match(md, /3 \/ 4 lines \(75%\)/);
  assert.match(md, /no browser test loads[\s\S]*`src\/b.ts`/);
});
