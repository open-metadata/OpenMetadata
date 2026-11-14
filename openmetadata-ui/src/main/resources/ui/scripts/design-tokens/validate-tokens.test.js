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
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { findMissingTokens } = require('./validate-tokens');

test('protects tokens referenced by styles, JS/TS, Tailwind, and CSSOM', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'om-token-integrity-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sources = {
    'surface.css': '.surface { color: var(--om-color-text-primary); }',
    'chart.ts': "const edge = 'var(--om-color-border-hover)';",
    'Surface.tsx': '<div className="tw:p-(--om-space-4)" />;',
    'theme.js': "style.getPropertyValue('--om-grey-15');",
  };
  const files = Object.entries(sources).map(([name, content]) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, content);
    return file;
  });
  const tokens = new Set([
    '--om-color-text-primary',
    '--om-color-border-hover',
    '--om-space-4',
    '--om-grey-15',
  ]);
  assert.equal(findMissingTokens(files, tokens).size, 0);
  for (const token of tokens) {
    const remaining = new Set(tokens);
    remaining.delete(token);
    assert.deepEqual([...findMissingTokens(files, remaining).keys()], [token]);
  }
});

test('ignores dynamic names and documentation placeholders', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'om-token-placeholders-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'examples.ts');
  fs.writeFileSync(
    file,
    'var(--om-space-<n>) var(--om-radius-*) `var(--om-space-${size})`'
  );
  assert.equal(findMissingTokens([file], new Set()).size, 0);
});

test('treats Markdown names as documentation and var() calls as references', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'om-token-docs-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'spec.md');
  fs.writeFileSync(file, '`--om-old-example` and var(--om-still-used)');
  assert.deepEqual(
    [...findMissingTokens([file], new Set()).keys()],
    ['--om-still-used']
  );
});
