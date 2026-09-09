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
 * Asserts every playwright/quarantine-list.ts entry selects EXACTLY ONE test.
 *
 * Both failure modes are silent without this. An entry matching 0 tests (a
 * renamed test, a typo, a describe level added) looks quarantined but runs in
 * the queue anyway. An entry matching >1 quietly quarantines its neighbours —
 * `… for table Time` swallowing `… for table Date Time`.
 *
 *   node playwright/quarantine-list.check.mjs
 *
 * Run from openmetadata-ui/src/main/resources/ui after editing the list.
 */
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';

const escapeRegExp = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TAGS = '(?: @\\S+)*';

const source = readFileSync('playwright/quarantine-list.ts', 'utf8');
const entries = [
  ...source.matchAll(
    /spec: '([^']+)',\s*\n\s*test:\s*'((?:[^'\\]|\\.)*)',\s*\n\s*runs: (\d+)/g
  ),
].map(([, spec, test, runs]) => ({
  spec,
  test: test.replace(/\\'/g, "'"),
  runs: Number(runs),
}));

if (!entries.length) {
  console.error('Parsed 0 entries — the quarantine-list.ts shape changed.');
  process.exit(1);
}

// Match the discover step in playwright-e2e-reusable.yml: lanes and OSS-only
// specs must be visible, or their entries look dead when they are not.
const listed = execFileSync(
  'npx',
  ['playwright', 'test', '--list', '--reporter=line'],
  {
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

  return hits.length === 1 ? [] : [{ ...entry, hits: hits.length }];
});

for (const { spec, test, runs, hits } of failures) {
  console.error(
    `${hits === 0 ? 'MATCHES NOTHING' : `MATCHES ${hits} TESTS`}  [${runs}x] ${spec} :: ${test}`
  );
}

console.log(
  `${entries.length - failures.length}/${entries.length} quarantine entries select exactly one test.`
);
process.exit(failures.length ? 1 : 0);
