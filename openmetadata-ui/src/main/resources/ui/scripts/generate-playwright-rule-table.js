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
 * Generates the Playwright rule table in PLAYWRIGHT_DEVELOPER_HANDBOOK.md from
 * eslint.config.mjs, so the docs cannot list a rule the linter doesn't enforce
 * (or omit one it does) — the two sources of truth used to drift silently.
 *
 *   node scripts/generate-playwright-rule-table.js            # write the table
 *   node scripts/generate-playwright-rule-table.js --check    # CI: fail if stale
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const HANDBOOK = path.join(
  __dirname,
  '../playwright/PLAYWRIGHT_DEVELOPER_HANDBOOK.md'
);
const START = '<!-- BEGIN GENERATED RULE TABLE -->';
const END = '<!-- END GENERATED RULE TABLE -->';

const buildTable = async () => {
  // eslint.config.mjs is ESM; everything else here is plain CommonJS, matching
  // the rest of scripts/*.js.
  const { default: config } = await import('../eslint.config.mjs');

  // Rule descriptions live in two different plugins depending on the prefix:
  // `playwright/*` ships from the upstream eslint-plugin-playwright package,
  // `om-playwright/*` is this repo's local plugin.
  const upstream = require('eslint-plugin-playwright');
  const local = require('../playwright/eslint-rules/index.js');

  const severities = {};
  for (const block of config) {
    for (const [id, level] of Object.entries(block.rules ?? {})) {
      if (id.startsWith('playwright/') || id.startsWith('om-playwright/')) {
        // A rule can appear in more than one config block (e.g. the e2e-only
        // block layers on top of the main playwright block); last write wins,
        // which matches how ESLint itself resolves overlapping config blocks.
        severities[id] = level;
      }
    }
  }

  const rows = Object.entries(severities)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, level]) => {
      const isLocal = id.startsWith('om-playwright/');
      const short = id.replace(/^(om-playwright|playwright)\//, '');
      const source = isLocal ? local : upstream;
      const description = source.rules[short]?.meta?.docs?.description ?? '';

      return `| \`${id}\` | ${level} | ${description} |`;
    });

  return [
    START,
    '',
    '| Rule | Severity | What it catches |',
    '|---|---|---|',
    ...rows,
    '',
    END,
  ].join('\n');
};

const main = async () => {
  const table = await buildTable();
  const original = fs.readFileSync(HANDBOOK, 'utf8');
  const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);

  if (!pattern.test(original)) {
    throw new Error(`Handbook is missing the ${START} / ${END} markers`);
  }

  // Replacement must be a function, not a string: some rule descriptions
  // contain literal `$$` (e.g. page.$$eval), and String.replace() treats `$$`
  // in a *string* replacement as an escaped `$` — silently corrupting them.
  const updated = original.replace(pattern, () => table);

  if (process.argv.includes('--check')) {
    if (updated !== original) {
      console.error(
        'Handbook rule table is stale. Run `yarn generate:playwright-rules` and commit the result.'
      );
      process.exit(1);
    }

    return;
  }

  fs.writeFileSync(HANDBOOK, updated);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
