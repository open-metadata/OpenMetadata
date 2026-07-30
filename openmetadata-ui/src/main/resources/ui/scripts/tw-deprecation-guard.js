#!/usr/bin/env node
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

/**
 * Deprecation guard for the Antd + Less → UntitledUI + Tailwind migration.
 *
 * Antd (864 files) and Less (449 files) can't be a blanket error — instead we
 * enforce "no NEW debt": fail if a change ADDS a `.less` file or ADDS an
 * `import … from 'antd'`. Existing usage is untouched and migrates over time.
 *
 *   node scripts/tw-deprecation-guard.js              # staged changes (pre-commit)
 *   node scripts/tw-deprecation-guard.js <baseRef>    # vs a base branch (CI)
 */
const { execSync } = require('child_process');

const base = process.argv[2];
const diffArgs = base ? `${base}...HEAD` : '--cached';

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' });
  } catch (e) {
    return e.stdout || '';
  }
}

const C = { red: (s) => `\x1b[31m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, gray: (s) => `\x1b[90m${s}\x1b[0m` };

function newLessFiles() {
  const out = sh(`git diff ${diffArgs} --diff-filter=A --name-only -- '*.less'`);
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

function newAntdImports() {
  // Added lines (leading '+') that import from 'antd', across TS/TSX.
  const out = sh(`git diff ${diffArgs} -U0 -- '*.ts' '*.tsx'`);
  const hits = [];
  let file = null;
  for (const line of out.split('\n')) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      file = fileMatch[1];
    } else if (
      line.startsWith('+') &&
      !line.startsWith('+++') &&
      /import\s+[^;]*\bfrom\s+['"]antd(?:\/[^'"]*)?['"]/.test(line)
    ) {
      hits.push({ file, line: line.slice(1).trim() });
    }
  }
  return hits;
}

function main() {
  const less = newLessFiles();
  const antd = newAntdImports();
  const problems = less.length + antd.length;

  if (less.length) {
    process.stderr.write(C.red(`\n✖ New .less file(s) are not allowed — style with Tailwind (tw:) + UntitledUI:\n`));
    less.forEach((f) => process.stderr.write(`    ${f}\n`));
  }
  if (antd.length) {
    process.stderr.write(C.red(`\n✖ New 'antd' import(s) are not allowed — use @openmetadata/ui-core-components (UntitledUI):\n`));
    antd.forEach((h) => process.stderr.write(`    ${h.file}:  ${h.line}\n`));
  }

  if (problems) {
    process.stderr.write(
      C.gray(`\nAntd + Less are deprecated. See specs/ and CLAUDE.md. Existing usage is fine; do not add more.\n`)
    );
    process.exit(1);
  }
  process.stdout.write(C.green('✔ No new Antd imports or .less files.\n'));
}

main();
