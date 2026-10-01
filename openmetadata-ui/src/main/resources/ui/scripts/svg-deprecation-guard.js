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
 * Deprecation guard for raw SVG assets.
 *
 * Icons must come from `@openmetadata/ui-core-components/icons`, never from raw
 * SVGs under `src/assets/svg/`. ~500 files still import raw SVGs, so this can't
 * be a blanket error — instead we enforce "no NEW debt": fail if a change
 *   - ADDS a new `.svg` file anywhere under `src/assets/svg/`, or
 *   - ADDS an `import … from '…/assets/svg/….svg'` specifier that wasn't
 *     already imported in that file before the change.
 * Existing usage is untouched and migrates over time.
 * Regression tests may import the legacy assets they exercise; the guard
 * applies to application code, so `*.test`/`*.spec` files are skipped.
 *
 * Like tw-deprecation-guard.js, the import check compares full before/after
 * file contents (via `git show`) rather than raw diff lines. A diff-line scan
 * flags
 *   - import a from '../assets/svg/a.svg'; import b from '../assets/svg/b.svg';
 *   + import b from '../assets/svg/b.svg';
 * as a "new" import even though it strictly REMOVES usage. Parsing the whole
 * file on both sides sidesteps this: we diff the *set of imported svg paths*
 * before vs. after, and only fail when the after-set contains a path absent
 * from the before-set.
 *
 *   node scripts/svg-deprecation-guard.js              # staged changes (pre-commit)
 *   node scripts/svg-deprecation-guard.js <baseRef>    # vs a base branch (CI)
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

const SVG_DIR = 'openmetadata-ui/src/main/resources/ui/src/assets/svg';

function newSvgFiles() {
  // `:(top)` anchors the pathspec to the repo root. Git resolves a bare
  // pathspec relative to CWD, so without it this silently matches nothing when
  // the script is run from the UI directory (as the header documents) and only
  // worked from the pre-commit hook, which runs at the repo root.
  const out = sh(`git diff ${diffArgs} --diff-filter=A --name-only -- ':(top)${SVG_DIR}/*.svg'`);
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

// --- raw-svg import comparison ----------------------------------------------

// Matches the module path of `import … from '…/assets/svg/….svg'`.
const SVG_IMPORT_RE = /from\s+(['"])([^'"]*assets\/svg\/[^'"]*\.svg)\1/g;

// Compare specifiers by the stable part from `assets/svg/` onward, not the raw
// string — a file moved to a different folder depth rewrites `../assets/svg/x`
// to `../../assets/svg/x`, which is the same asset and must not read as new.
function svgKey(spec) {
  const i = spec.indexOf('assets/svg/');
  return i === -1 ? spec : spec.slice(i);
}

function parseSvgImports(content) {
  const paths = new Set();
  if (!content) {
    return paths;
  }
  let m;
  SVG_IMPORT_RE.lastIndex = 0;
  while ((m = SVG_IMPORT_RE.exec(content))) {
    paths.add(m[2]);
  }
  return paths;
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
    return execFileSync('git', ['show', objectSpec], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 64,
      // Pipe stderr so git's "path exists on disk, but not in HEAD" message for
      // newly-added files doesn't leak to the console — the catch handles it.
      stdio: ['pipe', 'pipe', 'pipe'],
    });
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

function newSvgImports() {
  const hits = [];
  const files = changedTsFiles();
  for (const { before, after } of files) {
    if (/\.(?:test|spec)\.tsx?$/.test(after)) {
      continue;
    }
    const afterPaths = parseSvgImports(getAfterContent(after));
    if (afterPaths.size === 0) {
      continue;
    }
    const beforeKeys = new Set([...parseSvgImports(getBeforeContent(before))].map(svgKey));
    for (const p of afterPaths) {
      if (!beforeKeys.has(svgKey(p))) {
        hits.push({ file: after, path: p });
      }
    }
  }
  return hits;
}

function main() {
  const svgFiles = newSvgFiles();
  const imports = newSvgImports();
  const problems = svgFiles.length + imports.length;

  if (svgFiles.length) {
    process.stderr.write(
      C.red(`\n✖ New raw .svg file(s) under assets/svg are not allowed — add icons to @openmetadata/ui-core-components:\n`)
    );
    svgFiles.forEach((f) => process.stderr.write(`    ${f}\n`));
  }
  if (imports.length) {
    process.stderr.write(
      C.red(`\n✖ New import(s) of raw .svg from assets/svg are not allowed — use @openmetadata/ui-core-components/icons:\n`)
    );
    imports.forEach((h) => process.stderr.write(`    ${h.file}:  ${h.path}\n`));
  }

  if (problems) {
    process.stderr.write(
      C.gray(`\nRaw SVG icons are deprecated. See CLAUDE.md. Existing usage is fine; do not add more.\n`)
    );
    process.exit(1);
  }
  process.stdout.write(C.green('✔ No new raw SVG assets or imports.\n'));
}

if (require.main === module) {
  main();
}

module.exports = { parseSvgImports, svgKey, newSvgImports, newSvgFiles, main };
