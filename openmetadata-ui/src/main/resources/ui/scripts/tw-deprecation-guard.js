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
 * `import … from 'antd'` specifier that wasn't already imported from that
 * same module before the change. Existing usage is untouched and migrates
 * over time.
 *
 * The antd check compares full before/after file contents (via `git show`)
 * rather than raw diff lines. A diff-line scan flags
 *   - import { Button, Typography } from 'antd'
 *   + import { Button } from 'antd'
 * as a "new" import line even though it strictly REMOVES usage (Typography),
 * and it can't reliably reconstruct multi-line import statements that git's
 * `-U0` diff splits apart. Parsing the whole file on both sides sidesteps
 * both problems: for every antd module (`antd`, `antd/es/button`, …) we diff
 * the *set of imported specifiers* before vs. after, and only fail when the
 * after-set contains a specifier absent from the before-set (or the module
 * wasn't imported at all before) — i.e. genuinely new antd debt.
 *
 *   node scripts/tw-deprecation-guard.js              # staged changes (pre-commit)
 *   node scripts/tw-deprecation-guard.js <baseRef>    # vs a base branch (CI)
 */
const { execSync, execFileSync } = require('child_process');

const base = process.argv[2];
const diffArgs = base ? `${base}...HEAD` : '--cached';

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
  } catch (e) {
    return e.stdout || '';
  }
}

// For baseRef mode, diff against the merge-base of <base> and HEAD (matches
// the three-dot diff semantics already used for `diffArgs`) rather than the
// tip of <base>, so unrelated commits that landed on the base branch after
// this branch forked don't get treated as part of the "before" state.
const mergeBase = base ? sh(`git merge-base ${base} HEAD`).trim() : null;

const C = { red: (s) => `\x1b[31m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, gray: (s) => `\x1b[90m${s}\x1b[0m` };

function newLessFiles() {
  const out = sh(`git diff ${diffArgs} --diff-filter=A --name-only -- '*.less'`);
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

// --- antd import comparison -------------------------------------------------

// Matches `import [type] <clause> from 'antd'` and `'antd/<subpath>'`, across
// multi-line import clauses (the `s` flag lets `.` span newlines).
const ANTD_IMPORT_RE = /import\s+(?:type\s+)?([^'";]*?)\s+from\s+(['"])(antd(?:\/[^'"]*)?)\2/gs;

function parseClause(clause) {
  const specifiers = new Set();
  let rest = clause.trim();
  const braceMatch = rest.match(/\{([^}]*)\}/s);
  if (braceMatch) {
    braceMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      // `Foo as Bar` — the imported name (`Foo`) is what matters, not the
      // local alias.
      .forEach((s) => specifiers.add(s.split(/\s+as\s+/)[0].trim()));
    rest = (rest.slice(0, braceMatch.index) + rest.slice(braceMatch.index + braceMatch[0].length)).trim();
  }
  rest = rest.replace(/,\s*$/, '').replace(/^,\s*/, '').trim();
  if (rest.startsWith('*')) {
    specifiers.add('*namespace*');
  } else if (rest) {
    specifiers.add('*default*');
  }
  return specifiers;
}

// Returns Map<moduleString, { specifiers: Set<string>, statement: string }>
function parseAntdImports(content) {
  const map = new Map();
  if (!content) {
    return map;
  }
  let m;
  ANTD_IMPORT_RE.lastIndex = 0;
  while ((m = ANTD_IMPORT_RE.exec(content))) {
    const moduleName = m[3];
    const specifiers = parseClause(m[1]);
    const statement = m[0].replace(/\s+/g, ' ').trim();
    if (!map.has(moduleName)) {
      map.set(moduleName, { specifiers: new Set(), statement });
    }
    const entry = map.get(moduleName);
    specifiers.forEach((s) => entry.specifiers.add(s));
    entry.statement = statement;
  }
  return map;
}

// List of changed .ts/.tsx files, as { before, after } repo-relative paths
// (they differ only for detected renames).
function changedTsFiles() {
  const out = sh(`git diff ${diffArgs} --diff-filter=ACMRT --name-status -- '*.ts' '*.tsx'`);
  const files = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) {
      continue;
    }
    const parts = line.split('\t');
    const status = parts[0];
    if (status.startsWith('R') || status.startsWith('C')) {
      files.push({ before: parts[1], after: parts[2] });
    } else {
      files.push({ before: parts[1], after: parts[1] });
    }
  }
  return files;
}

function gitShow(objectSpec) {
  try {
    return execFileSync('git', ['show', objectSpec], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
  } catch (e) {
    // File didn't exist at that ref (e.g. newly added file) — treat as empty.
    return '';
  }
}

function getBeforeContent(path) {
  if (!path) {
    return '';
  }
  // baseRef mode: "before" is the merge-base. Staged mode: "before" is HEAD.
  return gitShow(`${base ? mergeBase : 'HEAD'}:${path}`);
}

function getAfterContent(path) {
  if (!path) {
    return '';
  }
  // baseRef mode: "after" is HEAD. Staged mode: "after" is the index — the
  // index object spec has no ref before the colon, just `:path`.
  return gitShow(base ? `HEAD:${path}` : `:${path}`);
}

function newAntdImports() {
  const hits = [];
  const files = changedTsFiles();
  for (const { before, after } of files) {
    const afterContent = getAfterContent(after);
    const afterMap = parseAntdImports(afterContent);
    if (afterMap.size === 0) {
      continue;
    }
    const beforeContent = getBeforeContent(before);
    const beforeMap = parseAntdImports(beforeContent);
    for (const [moduleName, afterEntry] of afterMap) {
      const beforeEntry = beforeMap.get(moduleName);
      const beforeSpecifiers = beforeEntry ? beforeEntry.specifiers : new Set();
      const isNew = [...afterEntry.specifiers].some((s) => !beforeSpecifiers.has(s));
      if (isNew) {
        hits.push({ file: after, line: afterEntry.statement });
      }
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

if (require.main === module) {
  main();
}

module.exports = { parseClause, parseAntdImports, newAntdImports, newLessFiles, main };
