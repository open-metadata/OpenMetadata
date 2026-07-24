#!/usr/bin/env node
/*
 *  Copyright 2024 Collate.
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
 * Design-token drift gate — the deterministic half of drift detection. Runs all
 * mechanical checks and exits 1 if any fails. Yarn-free (only `node`) so it can
 * be a pre-commit / CI hook. Wired as `yarn token-drift`.
 *
 * It does NOT check component-prose correctness (anatomy/states/props); that is
 * a human/LLM review concern (see specs/ and the CLAUDE.md "read the spec first"
 * rule).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const STEPS = [
  ['gen-tokens.js', ['--check'], 'tokens.css generated block'],
  ['gen-token-reference.js', ['--check'], 'token-reference.md'],
  ['validate-tokens.js', [], 'token reference integrity'],
  ['check-coverage.js', [], 'spec links & coverage'],
];

function main() {
  let failed = 0;
  for (const [script, args, label] of STEPS) {
    process.stdout.write(`\n\x1b[1m▶ ${label}\x1b[0m\n`);
    const res = spawnSync(
      process.execPath,
      [path.join(__dirname, script), ...args],
      { stdio: 'inherit' }
    );
    if (res.status !== 0) {
      failed++;
    }
  }
  if (failed) {
    process.stderr.write(
      `\n\x1b[31m✖ Design-token drift: ${failed} check(s) failed.\x1b[0m\n`
    );
    process.exit(1);
  }
  process.stdout.write('\n\x1b[32m✔ No design-token drift.\x1b[0m\n');
}

main();
