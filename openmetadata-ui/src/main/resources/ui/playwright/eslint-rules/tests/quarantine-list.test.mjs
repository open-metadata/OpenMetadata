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
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Drift guard for playwright/quarantine-list.ts.
 *
 * Lives here, rather than beside the list, for two reasons. The corpus
 * guardrail keeps playwright/ TypeScript-only because Playwright's default
 * testMatch collects .mjs and would run it unlinted as a test; this directory
 * is exempt. And `yarn test:eslint-rules` already globs
 * `playwright/eslint-rules/tests/**\/*.test.mjs` and already runs in CI's UI
 * Checkstyle, so the guard runs on every PR instead of only when a human
 * remembers to invoke it.
 *
 * Both failure modes are silent without this. An entry matching 0 tests (a
 * renamed test, a typo, an added describe level) looks quarantined but runs in
 * the queue anyway — the known flake is back to ejecting batches. An entry
 * matching >1 quietly quarantines its neighbours: `… for table Time` would
 * swallow `… for table Date Time`.
 */

const UI_ROOT = path.join(import.meta.dirname, '../../..');
const LIST = path.join(UI_ROOT, 'playwright/quarantine-list.ts');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TAGS = '(?: @\\S+)*';

const entries = [
  ...fs
    .readFileSync(LIST, 'utf8')
    .matchAll(
      /spec: '([^']+)',\s*\n\s*test:\s*'((?:[^'\\]|\\.)*)',\s*\n\s*runs: (\d+)/g
    ),
].map(([, spec, testTitle, runs]) => ({
  spec,
  test: testTitle.replace(/\\'/g, "'"),
  runs: Number(runs),
}));

test('every quarantine-list entry selects exactly one test', () => {
  assert.ok(
    entries.length > 0,
    'Parsed 0 entries — the quarantine-list.ts shape changed, so this guard ' +
      'is asserting nothing. Fix the parser above before trusting a green run.'
  );

  // Mirror the discover step in playwright-e2e-reusable.yml. The dedicated
  // lanes and the PLAYWRIGHT_IS_OSS-gated specs must be visible, or their
  // entries look dead when they are not.
  const listed = execFileSync(
    'npx',
    ['playwright', 'test', '--list', '--reporter=line'],
    {
      cwd: UI_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: '',
        PLAYWRIGHT_RUN_QUARANTINED: '',
        PW_DEDICATED_INGESTION: 'true',
        PW_DEDICATED_IMPORT_EXPORT: 'true',
        PLAYWRIGHT_IS_OSS: 'true',
      },
    }
  )
    .split('\n')
    .filter((line) => line.includes('›'))
    .map((line) =>
      line
        .trim()
        .replace(/^\[[^\]]+\]\s*›\s*/, '')
        .replace(/\.ts:\d+:\d+/, '.ts')
        .replaceAll(' › ', ' ')
    );

  const failures = entries.flatMap((entry) => {
    const pattern = new RegExp(
      escapeRegExp(entry.spec) +
        entry.test
          .split(' › ')
          .map((level) => `${TAGS} ${escapeRegExp(level)}`)
          .join('') +
        `${TAGS}$`
    );
    const hits = listed.filter((title) => pattern.test(title));

    return hits.length === 1
      ? []
      : [
          `${
            hits.length === 0
              ? 'MATCHES NOTHING'
              : `MATCHES ${hits.length} TESTS`
          }` + `  [${entry.runs}x] ${entry.spec} :: ${entry.test}`,
        ];
  });

  assert.deepStrictEqual(
    failures,
    [],
    'A quarantine entry no longer selects exactly one test. Update the title ' +
      'in playwright/quarantine-list.ts to match the spec, or delete the ' +
      'entry if the test it named is gone. An entry matching nothing is not ' +
      'quarantining anything.'
  );
});
