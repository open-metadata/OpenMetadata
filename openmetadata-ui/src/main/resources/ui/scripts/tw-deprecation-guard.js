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
 * Deprecation guard for the Less → Tailwind and raw-SVG → core-icons migrations.
 *
 * Enforces "no NEW debt": fail if a change adds a raw `.svg` under
 * `assets/svg` or a new import of one. New `.less` files are reported but do
 * NOT fail the guard while the app-mode migration still ships `.less` for the
 * AI shell. Existing usage is untouched and migrates over time. Test files may
 * import the assets they exercise.
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

// --- raw SVG debt -----------------------------------------------------------

// Raw SVGs under assets/svg are deprecated in favour of
// @openmetadata/ui-core-components/icons. "No new debt":
// a newly ADDED .svg file, or a newly ADDED import from assets/svg, fails.
const SVG_DIR = 'openmetadata-ui/src/main/resources/ui/src/assets/svg';

function newSvgFiles() {
  // `:(top)` anchors the pathspec to the repo root so this works from any CWD,
  // not just the pre-commit hook that runs there.
  const out = sh(`git diff ${diffArgs} --diff-filter=A --name-only -- ':(top)${SVG_DIR}/*.svg'`);
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

const SVG_IMPORT_RE = /from\s+(['"])([^'"]*assets\/svg\/[^'"]*\.svg)\1/g;

// Compare by the stable part from `assets/svg/` onward so moving a file to a
// different folder depth (which rewrites `../` prefixes) isn't flagged as new.
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

function newSvgImports() {
  const hits = [];
  for (const { before, after } of changedTsFiles()) {
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

function main() {
  const less = newLessFiles();
  const svgFiles = newSvgFiles();
  const svgImports = newSvgImports();
  // New `.less` files are reported but do NOT fail the guard — the app-mode
  // migration still lands `.less` for the AI shell. New svg debt blocks.
  const problems = svgFiles.length + svgImports.length;

  if (less.length) {
    process.stderr.write(C.gray(`\nⓘ New .less file(s) detected (allowed for now — prefer Tailwind (tw:) + UntitledUI):\n`));
    less.forEach((f) => process.stderr.write(`    ${f}\n`));
  }
  if (svgFiles.length) {
    process.stderr.write(C.red(`\n✖ New raw .svg file(s) under assets/svg are not allowed — add icons to @openmetadata/ui-core-components:\n`));
    svgFiles.forEach((f) => process.stderr.write(`    ${f}\n`));
  }
  if (svgImports.length) {
    process.stderr.write(C.red(`\n✖ New import(s) of raw .svg from assets/svg are not allowed — use @openmetadata/ui-core-components/icons:\n`));
    svgImports.forEach((h) => process.stderr.write(`    ${h.file}:  ${h.path}\n`));
  }

  if (problems) {
    process.stderr.write(
      C.gray(`\nLess and raw SVG icons are deprecated. See specs/ and CLAUDE.md. Existing usage is fine; do not add more.\n`)
    );
    process.exit(1);
  }
  process.stdout.write(C.green('✔ No new raw-SVG imports.\n'));
}

if (require.main === module) {
  main();
}

module.exports = {
  newLessFiles,
  newSvgFiles,
  newSvgImports,
  parseSvgImports,
  svgKey,
  main,
};
