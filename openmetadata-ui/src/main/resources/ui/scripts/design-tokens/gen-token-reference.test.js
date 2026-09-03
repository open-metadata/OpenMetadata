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
const path = require('node:path');
const { test } = require('node:test');

const UI_ROOT = path.resolve(__dirname, '../..');
const TOKENS_FILE = path.join(UI_ROOT, 'src/styles/tokens.css');
const REFERENCE_FILE = path.join(UI_ROOT, 'specs/tokens/token-reference.md');

test('documents every project token defined in tokens.css', () => {
  const tokensCss = fs
    .readFileSync(TOKENS_FILE, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const reference = fs.readFileSync(REFERENCE_FILE, 'utf8');
  const definedTokens = new Set(
    [...tokensCss.matchAll(/(--om-[\w-]+)\s*:/g)].map((match) => match[1])
  );
  const documentedTokens = new Set(
    [...reference.matchAll(/^\| `(--om-[\w-]+)` \|/gm)].map((match) => match[1])
  );
  const undocumentedTokens = [...definedTokens].filter(
    (token) => !documentedTokens.has(token)
  );

  assert.deepEqual(undocumentedTokens, []);
});
