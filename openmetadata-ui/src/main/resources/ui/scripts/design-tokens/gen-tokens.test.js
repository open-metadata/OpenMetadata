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
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

test('preserves tokens used only by TSX when regenerating styles', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'om-token-generation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const scripts = path.join(root, 'scripts/design-tokens');
  const styles = path.join(root, 'src/styles');
  fs.cpSync(__dirname, scripts, { recursive: true });
  fs.mkdirSync(styles, { recursive: true });
  const tokensFile = path.join(styles, 'tokens.css');
  fs.writeFileSync(
    tokensFile,
    '/* @tokens:generated-begin */\n:root {}\n/* @tokens:generated-end */\n'
  );
  fs.writeFileSync(
    path.join(root, 'src/Consumer.tsx'),
    `<div
      className="tw:bg-(--om-legacy-color-f8f8f8) tw:text-(color:--om-legacy-color-595959) tw:border-[var(--om-legacy-color-f7f9fc)]"
      style={{ backgroundColor: '#123456' }}
    />`
  );

  const generate = () =>
    execFileSync(process.execPath, [path.join(scripts, 'gen-tokens.js')]);
  generate();
  const generated = fs.readFileSync(tokensFile, 'utf8');

  assert.match(generated, /--om-legacy-color-f8f8f8:\s*#f8f8f8;/);
  assert.match(generated, /--om-legacy-color-595959:\s*#595959;/);
  assert.match(generated, /--om-legacy-color-f7f9fc:\s*#f7f9fc;/);
  assert.doesNotMatch(generated, /#123456/);

  generate();
  assert.equal(fs.readFileSync(tokensFile, 'utf8'), generated);
});
