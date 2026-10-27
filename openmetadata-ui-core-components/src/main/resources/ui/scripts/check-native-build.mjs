/*
 *  Copyright 2025 Collate.
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
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { build as viteBuild } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = join(root, 'src/native-build-check.fixture.ts');
const newFixture = join(root, 'src/native-new-build.fixture.ts');
const standaloneFixture = join(root, 'src/native-standalone-build.fixture.ts');
const invalid = 'export const nativeBuildCheck: number = "invalid";\n';
const valid = 'export const nativeBuildCheck: number = 1;\n';
const vite = join(root, 'node_modules/vite/bin/vite.js');
assert.ok(
  !existsSync(fixture) &&
    !existsSync(newFixture) &&
    !existsSync(standaloneFixture),
  'Fixtures must not overwrite existing source'
);
let watcher;

function artifacts() {
  const hash = createHash('sha256');
  function visit(current) {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name)
    )) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else hash.update(path).update(readFileSync(path));
    }
  }
  visit(join(root, 'dist'));
  return hash.digest('hex');
}

function build(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
  });
  assert.ifError(result.error);
  return result;
}

function validBuild() {
  const result = build(process.execPath, [vite, 'build']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

try {
  validBuild();
  const before = artifacts();
  writeFileSync(fixture, invalid);
  for (const [command, args] of [
    ['yarn', ['build']],
    [process.execPath, [vite, 'build']],
  ]) {
    const result = build(command, args);
    assert.notEqual(
      result.status,
      0,
      'Invalid source must fail ' + command + ' ' + args.join(' ')
    );
    assert.match(result.stdout + result.stderr, /error TS2322/);
    assert.equal(
      artifacts(),
      before,
      'Rejected builds must preserve existing artifacts'
    );
  }

  const outcomes = [];
  let emissionComplete;
  let finishEmission;
  watcher = await viteBuild({
    root,
    logLevel: 'error',
    build: { watch: {} },
    plugins: [
      {
        name: 'native-build-self-check',
        buildStart() {
          emissionComplete = new Promise((done) => {
            finishEmission = done;
          });
        },
        closeBundle: {
          order: 'post',
          sequential: true,
          handler() {
            finishEmission();
          },
        },
      },
    ],
  });
  watcher.on('event', async (event) => {
    if (event.code === 'ERROR') outcomes.push(event.error);
    if (event.code === 'BUNDLE_END') {
      await emissionComplete;
      outcomes.push(undefined);
    }
  });
  async function nextBuild(shouldFail) {
    const deadline = Date.now() + 120000;
    while (!outcomes.length) {
      assert.ok(Date.now() < deadline, 'Timed out waiting for watch build');
      await setTimeout(100);
    }
    const error = outcomes.shift();
    if (shouldFail)
      assert.equal(error?.plugin, 'native-type-check', String(error));
    else assert.equal(error, undefined, String(error));
  }

  await nextBuild(true);
  assert.equal(
    artifacts(),
    before,
    'Initially invalid watch must preserve artifacts'
  );
  let subscriptionReady = false;
  const observeFixtureChange = (id) => {
    if (resolve(id) === fixture) subscriptionReady = true;
  };
  watcher.on('change', observeFixtureChange);
  try {
    const deadline = Date.now() + 120000;
    while (!subscriptionReady) {
      assert.ok(
        Date.now() < deadline,
        'Initial watch subscription must become ready'
      );
      const now = new Date();
      utimesSync(fixture, now, now);
      await setTimeout(100);
    }
  } finally {
    watcher.off('change', observeFixtureChange);
  }
  await nextBuild(true);
  writeFileSync(fixture, valid);
  await nextBuild(false);
  const repaired = artifacts();
  writeFileSync(fixture, invalid);
  await nextBuild(true);
  assert.equal(
    artifacts(),
    repaired,
    'Invalid watch rebuild must preserve artifacts'
  );
  writeFileSync(fixture, valid);
  await nextBuild(false);
  const beforeStandalone = artifacts();
  writeFileSync(standaloneFixture, invalid);
  await nextBuild(true);
  assert.equal(
    artifacts(),
    beforeStandalone,
    'New invalid unimported source must preserve artifacts'
  );
  writeFileSync(standaloneFixture, valid);
  await nextBuild(false);
  const beforeNewFile = artifacts();
  writeFileSync(newFixture, invalid);
  writeFileSync(
    fixture,
    valid + 'export * from "./native-new-build.fixture";\n'
  );
  await nextBuild(true);
  assert.equal(
    artifacts(),
    beforeNewFile,
    'New invalid source must preserve artifacts'
  );
  writeFileSync(newFixture, valid);
  await nextBuild(false);
  assert.ok(
    existsSync(join(root, 'dist/types/src/native-new-build.fixture.d.ts')),
    'Repairing only the new file must emit its declaration'
  );
  process.stdout.write(
    'Native build gate rejects normal, direct and watch builds and recovers after repair.\n'
  );
} finally {
  if (watcher) await watcher.close();
  rmSync(fixture, { force: true });
  rmSync(newFixture, { force: true });
  rmSync(standaloneFixture, { force: true });
  validBuild();
}
