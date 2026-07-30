#!/usr/bin/env node
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

/*
 * Tests for the component-reuse guard. Run: node scripts/reuse-audit.test.js
 *
 * This gate blocks merges, so the cases that matter most are the ones where it
 * could be WRONG: a false positive nags legitimate code, and a false negative
 * (or a swallowed git error) lets the gate report success without inspecting
 * anything. Both are covered below.
 */
const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');
const { findings } = require('./reuse-audit');

const UI = 'openmetadata-ui/src/main/resources/ui';
const COMPONENT = `${UI}/src/components/Foo/Foo.tsx`;

let pass = 0;
let fail = 0;

function check(name, fn) {
  try {
    fn();
    pass++;
  } catch (e) {
    fail++;
    process.stderr.write(`\nFAIL: ${name}\n  ${e.message}\n`);
  }
}

const hits = (text, file = COMPONENT) => findings([{ file, lineNo: 1, text }]);

const expectHit = (name, text, use, file) =>
  check(name, () => {
    const h = hits(text, file);
    assert.strictEqual(h.length, 1, `expected 1 finding, got ${h.length}`);
    assert.match(h[0].use, use, `wrong suggestion: ${h[0].use}`);
  });

const expectClean = (name, text, file) =>
  check(name, () => {
    const h = hits(text, file);
    assert.strictEqual(
      h.length,
      0,
      `expected no findings, got ${h.length}: ${JSON.stringify(
        h[0] && h[0].text
      )}`
    );
  });

// ---- detections -----------------------------------------------------------
expectHit('role=listbox -> Select', '<div role="listbox">', /Select/);
expectHit(
  'role=menu -> Dropdown',
  '  <div role="menu" onClick={x}>',
  /Dropdown/
);
expectHit('role=dialog -> Modal', "<div role='dialog'>", /Modal/);
expectHit('role=tablist -> Tabs', '<div role="tablist">', /Tabs/);
expectHit(
  'raw button -> Button',
  '  <button type="button">Go</button>',
  /Button/
);
expectHit('raw textarea -> Textarea', '<textarea />', /Textarea/);
expectHit('createPortal -> Modal', 'return createPortal(node, el);', /Modal/);

// ---- false positives the gate must NOT fire on -----------------------------
expectClean('data-role is not an ARIA role', '<div data-role="menu" />');
expectClean('user-role is not an ARIA role', '<div user-role="tab" />');
expectClean(
  'bracket selector is a query, not markup',
  'page.locator(\'[role="menu"]\')'
);
expectClean('library component is the correct usage', '<Select options={o} />');
expectClean('line comment is prose', '  // use <button> only via Button');
expectClean(
  'block comment is prose',
  '   * <div role="listbox"> was the old markup'
);
expectClean(
  'escape hatch honoured',
  '<button /> // reuse-audit-ignore: native file input'
);
expectClean(
  'arrow keys are no longer flagged (grids/canvases legitimately use them)',
  "if (e.key === 'ArrowDown') { moveCell(); }"
);

// ---- scoping ---------------------------------------------------------------
expectClean(
  'raw button outside src/components is out of scope',
  '<button type="button" />',
  `${UI}/src/pages/Foo/FooPage.tsx`
);
expectHit(
  'role= is flagged anywhere under src, not just components',
  '<div role="listbox">',
  /Select/,
  `${UI}/src/pages/Foo/FooPage.tsx`
);
for (const [label, file] of [
  ['unit test', `${UI}/src/components/Foo/Foo.test.tsx`],
  ['playwright spec', `${UI}/playwright/e2e/Foo.spec.ts`],
  ['mock', `${UI}/src/components/Foo/Foo.mock.ts`],
  ['storybook story', `${UI}/src/components/Foo/Foo.stories.tsx`],
  ['__mocks__ dir', `${UI}/src/__mocks__/Foo.tsx`],
]) {
  expectClean(
    `${label} is out of scope`,
    '<div role="listbox"><button /></div>',
    file
  );
}

// ---- the gate must never pass without inspecting the diff ------------------
check('a bad base ref exits non-zero rather than reporting clean', () => {
  let code = 0;
  let out = '';
  try {
    execFileSync(
      process.execPath,
      [path.join(__dirname, 'reuse-audit.js'), 'deadbeefdeadbeefdeadbeef'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (e) {
    code = e.status;
    out = `${e.stdout || ''}${e.stderr || ''}`;
  }
  assert.strictEqual(code, 1, 'expected exit 1 on an unresolvable base ref');
  assert.doesNotMatch(
    out,
    /No new hand-rolled components/,
    'reported clean despite failing'
  );
  assert.match(out, /could not inspect the diff/);
});

process.stdout.write(
  fail === 0
    ? `\x1b[32m✔ reuse-audit: ${pass} checks passed\x1b[0m\n`
    : `\x1b[31m✖ reuse-audit: ${fail} failed, ${pass} passed\x1b[0m\n`
);
process.exitCode = fail === 0 ? 0 : 1;
