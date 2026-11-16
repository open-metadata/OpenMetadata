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

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { scanText, SEVERITY } = require('./tw-scanner');

test('reports explicit dark variants as warnings', () => {
  const findings = scanText(
    '<div className="tw:bg-white tw:dark:bg-gray-900" />',
    'DarkSurface.tsx'
  );

  assert.deepEqual(
    findings.filter((finding) => finding.category === 'dark-theme-override'),
    [
      {
        file: 'DarkSurface.tsx',
        line: 1,
        col: 29,
        category: 'dark-theme-override',
        severity: SEVERITY.WARNING,
        raw: 'tw:dark:bg-gray-900',
        suggestion: 'use one semantic utility for both themes',
      },
    ]
  );
});

test('reports the unsupported AI token namespace as a warning', () => {
  const findings = scanText(
    "const surface = 'var(--ai-card-background)';",
    'Card.ts'
  );

  assert.deepEqual(
    findings.filter(
      (finding) => finding.category === 'unsupported-theme-namespace'
    ),
    [
      {
        file: 'Card.ts',
        line: 1,
        col: 22,
        category: 'unsupported-theme-namespace',
        severity: SEVERITY.WARNING,
        raw: '--ai-card-background',
        suggestion: 'use the shared --color-* semantic namespace',
      },
    ]
  );
});

test('does not report semantic utilities', () => {
  const findings = scanText(
    '<div className="tw:bg-surface tw:text-primary" />',
    'Surface.tsx'
  );

  assert.equal(
    findings.some((finding) =>
      ['dark-theme-override', 'unsupported-theme-namespace'].includes(
        finding.category
      )
    ),
    false
  );
});
