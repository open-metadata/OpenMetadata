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
    // String scan rather than a regex built from input: `cls` is escaped into a
    // CSS selector (`:` -> `\:`) and located literally, so no metacharacters
    // from the case data ever reach a RegExp constructor.
    const rule = extractRule(css, '.' + cls.replaceAll(':', '\\:'));

    assert.ok(rule, `utility ${cls} was not generated`);
    assert.ok(
      rule.includes(`var(${varName}`),
      `${cls} should read var(${varName}); got ${rule}`
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

// Locate the selector literally and return its `{ ... }` body (declarations
// hold no nested braces), avoiding any dynamic RegExp over untrusted-shaped text.
function extractRule(source, selector) {
  const start = source.indexOf(selector + '{');
  const braced = start === -1 ? source.indexOf(selector + ' {') : start;

  if (braced === -1) {
    return null;
  }

  const open = source.indexOf('{', braced);
  const close = source.indexOf('}', open);

  return source.slice(braced, close + 1);
}

// Count `varName:` occurrences with a plain string scan (the trailing colon
// disambiguates `-50` from `-500`), so no case data is interpolated into RegExp.
function countDefs(source, varName) {
  return source.split(varName + ':').length - 1;
}
