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
import { execFile } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const execute = promisify(execFile);

const checkFixture = async (context, { html = '', route, dependency = '' }) => {
  const root = mkdtempSync(path.join(tmpdir(), 'bundle-runtime-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  for (const directory of ['scripts', 'dist/assets', 'node_modules/.cache']) {
    mkdirSync(path.join(root, directory), { recursive: true });
  }
  symlinkSync(
    path.resolve(scriptDirectory, '../node_modules/@playwright'),
    path.join(root, 'node_modules/@playwright'),
    'dir'
  );
  copyFileSync(
    path.join(scriptDirectory, 'check-bundle-runtime.mjs'),
    path.join(root, 'scripts/check-bundle-runtime.mjs')
  );
  writeFileSync(path.join(root, 'dist/index.html'), html);
  writeFileSync(path.join(root, 'dist/assets/page.js'), route);
  writeFileSync(path.join(root, 'dist/assets/dependency.js'), dependency);
  writeFileSync(
    path.join(root, 'node_modules/.cache/bundle-graph.json'),
    JSON.stringify({
      pages: [{ module: 'src/pages/DemoPage.tsx', file: 'assets/page.js' }],
    })
  );

  return execute(process.execPath, ['scripts/check-bundle-runtime.mjs'], {
    cwd: root,
    env: { ...process.env, PW_E2E_BUNDLE: 'false' },
    timeout: 40000,
  });
};

test('checks a healthy route without waiting for external resources', async (context) => {
  let requests = 0;
  const external = createServer(() => {
    requests++;
  });
  await new Promise((resolve) => external.listen(0, '127.0.0.1', resolve));
  context.after(() => {
    external.closeAllConnections();
    external.close();
  });
  const { stdout } = await checkFixture(context, {
    html: `<img src="http://127.0.0.1:${external.address().port}/tracker.png">`,
    route: "export { value } from './dependency.js';",
    dependency: 'export const value = 42;',
  });
  assert.match(stdout, /Bundle runtime check passed: 1 route chunks/);
  assert.equal(requests, 0);
});

test('fails when a route cannot initialise', async (context) => {
  await assert.rejects(
    checkFixture(context, { route: "throw new Error('route failed');" }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(
        error.stderr,
        /DemoPage.tsx: importing assets\/page.js threw/
      );
      assert.match(error.stderr, /route failed/);

      return true;
    }
  );
});

test('fails when a transitive chunk exports undefined', async (context) => {
  await assert.rejects(
    checkFixture(context, {
      route: "import './dependency.js'; export const value = 42;",
      dependency: 'export let missing;',
    }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /dependency.js exports 1 undefined binding/);

      return true;
    }
  );
});
