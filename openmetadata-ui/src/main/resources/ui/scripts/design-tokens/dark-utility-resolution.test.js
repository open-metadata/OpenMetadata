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
 * Compiles the real app Tailwind entry and asserts the dark-theme utilities
 * actually resolve. The text-only theme-contract test proves the token layer is
 * wired; this proves the *compiled* utilities read the flipping `--tw-*` vars —
 * the exact defect class that shipped invisible borders, transparent status
 * fills, and light-colored badges in dark mode despite green class-string tests.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const UI_ROOT = path.resolve(__dirname, '../../');
const TW_ENTRY = path.join(UI_ROOT, 'src/styles/tailwind.css');

// Each utility maps to the runtime var its compiled rule must read, and whether
// `.dark-mode` must re-pin that var so the value flips in dark mode.
const CASES = [
  { cls: 'tw:bg-utility-success-50', varName: '--tw-color-utility-success-50', flips: true },
  { cls: 'tw:text-utility-error-700', varName: '--tw-color-utility-error-700', flips: true },
  { cls: 'tw:outline-subtle', varName: '--tw-outline-color-subtle', flips: true },
  { cls: 'tw:bg-surface', varName: '--tw-background-color-surface', flips: true },
  { cls: 'tw:border-subtle', varName: '--tw-border-color-subtle', flips: true },
];

let css;

test.before(async () => {
  const { compile } = require('@tailwindcss/node');
  const input = fs.readFileSync(TW_ENTRY, 'utf8');
  const compiler = await compile(input, { base: UI_ROOT, onDependency: () => {} });
  css = compiler.build(CASES.map((c) => c.cls));
});

test('compiled dark utilities read a var that .dark-mode re-pins', () => {
  for (const { cls, varName, flips } of CASES) {
    const escaped = cls.replace(/:/g, '\\\\:').replace(/[-/]/g, '\\$&');
    const rule = new RegExp(`\\.${escaped}\\s*\\{[^}]*\\}`);
    const match = css.match(rule);

    assert.ok(match, `utility ${cls} was not generated`);
    assert.ok(
      match[0].includes(`var(${varName}`),
      `${cls} should read var(${varName}); got ${match[0]}`
    );

    if (flips) {
      // A flipping var is declared twice: the light @theme default and the
      // .dark-mode re-pin. An unbridged remap leaves only the light default,
      // so the utility renders the light value in dark mode.
      const defs = countDefs(css, varName);
      assert.ok(
        defs >= 2,
        `${varName} is declared ${defs}x; expected >=2 (light default + .dark-mode re-pin) so ${cls} flips`
      );
    }
  }
});

function countDefs(source, varName) {
  const re = new RegExp(`${varName.replace(/[-]/g, '\\$&')}\\s*:`, 'g');
  return (source.match(re) || []).length;
}
