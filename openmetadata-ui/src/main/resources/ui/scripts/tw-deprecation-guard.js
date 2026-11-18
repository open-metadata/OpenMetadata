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
 * Enforces "no NEW debt": fail on added --om-* stylesheet declarations or
 * increased references, a raw `.svg` added under `assets/svg` or a new import
 * of one, and style debt on ADDED lines — raw Tailwind palette classes,
 * hardcoded hex colours, and inline `style={{ … }}` (semantic tokens carry
 * dark mode; these bypass it). A deliberate exception is suppressed with
 * `style-guard-allow` on the line, with a reason alongside. New `.less` files are reported but do
 * NOT fail the guard while the app-mode migration still ships `.less` for the
 * AI shell. Existing usage is untouched and migrates over time. Test files may
 * import the assets they exercise.
 *
 *   node scripts/tw-deprecation-guard.js              # staged changes (pre-commit)
 *   node scripts/tw-deprecation-guard.js <baseRef>    # vs a base branch (CI)
 */
const { execSync, execFileSync } = require('child_process');
const path = require('path');

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
  for (const { before, after } of changedFiles(['*.ts', '*.tsx'])) {
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

const STYLE_ALLOW_TOKEN = 'style-guard-allow';

// A bare token is not an exception — it needs a stated reason on the line
// (`style-guard-allow: chart lib needs literal colours`), so reviewers can
// tell why the added debt is deliberate.
const STYLE_ALLOW_RE = /style-guard-allow\s*[:\-—–]\s*\S+/;

const STYLE_EXEMPT_PATH =
  /\.(?:test|spec|stories)\.tsx?$|(^|\/)src\/generated\/|(^|\/)scripts\//;

// The raw-palette vocabulary is imported from the no-non-adaptive-palette
// ESLint rule (eslint-rules/openmetadata-ui-patterns.mjs), the single source
// for palette families/props/shades — so `tw:bg-brand-500`, `tw:text-error-600`
// and multi-word families like `gray-blue` fail here exactly as the rule
// recognises them. Matching mirrors the rule: take each `tw:` class token's
// LAST variant segment (so `tw:[&_button]:bg-blue-50` and `tw:!bg-gray-100`
// match regardless of variant syntax) and test it against the palette core.
let PALETTE_CORE; // built in main() from the dynamic import (this file is CJS)

async function loadPaletteCore() {
  const { pathToFileURL } = require('url');
  const rulePath = path.join(__dirname, '..', 'eslint-rules', 'openmetadata-ui-patterns.mjs');
  const { PALETTE_FAMILIES, COLOR_PROP, SHADE } = await import(pathToFileURL(rulePath));
  return new RegExp(
    `^${COLOR_PROP}-(?:${PALETTE_FAMILIES.join('|')})-${SHADE}(?:/\\d{1,3})?$`
  );
}

function hasRawPaletteClass(line) {
  const tokens = line.match(/tw:[^\s"'\\`]+/g) || [];
  return tokens.some((token) => {
    const segments = token.slice(3).split(':');
    // Strip Tailwind's important modifier in both positions (tw:!bg-x, tw:bg-x!).
    const last = segments.pop().replace(/^!/, '').replace(/!$/, '');
    // Mirror the ESLint rule's exemption: a `dark:` class is a deliberate
    // dark-only override, not a bug (openmetadata-ui-patterns.mjs classify()).
    return !segments.includes('dark') && PALETTE_CORE.test(last);
  });
}

// A comment explaining a colour choice (e.g. "// matches brand #3E7BC2") is
// documentation, not a rendered colour — the hex check skips comment lines.
function isCommentLine(line) {
  return /^\s*(\/\/|\/?\*)/.test(line);
}

const STYLE_LINE_CHECKS = [
  {
    name: 'raw-palette',
    test: (line) => hasRawPaletteClass(line),
    why: 'raw Tailwind palette class — use a semantic token (docs/colors.md; vocabulary from the no-non-adaptive-palette rule)',
  },
  {
    name: 'hex-colour',
    test: (line) =>
      !isCommentLine(line) &&
      /(?<!href=["'\\`])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b(?=[^\w]|$)/.test(line),
    why: 'hardcoded hex colour — use a semantic design token (docs/colors.md)',
  },
  {
    name: 'inline-style',
    test: (line) => /style=\{\{/.test(line),
    why: 'inline style object — use tw: utilities or the core component prop',
  },
];

// Style debt on ADDED lines of src .ts/.tsx. Added-lines scoping keeps the
// backlog zero by construction: existing debt never blocks, new debt always does.
function newStyleDebt() {
  const out = execFileSync(
    'git',
    [
      'diff',
      ...(base ? [diffArgs] : ['--cached']),
      '--unified=0',
      '--',
      ':(top)openmetadata-ui/src/main/resources/ui/src',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  const hits = [];
  let file = '';
  let line = 0;
  for (const raw of out.split('\n')) {
    if (raw.startsWith('+++ b/')) {
      file = raw.slice(6);
      continue;
    }
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (!raw.startsWith('+') || raw.startsWith('+++')) {
      continue;
    }
    const added = raw.slice(1);
    const current = line;
    line += 1;
    if (
      !/\.tsx?$/.test(file) ||
      STYLE_EXEMPT_PATH.test(file) ||
      STYLE_ALLOW_RE.test(added)
    ) {
      continue;
    }
    for (const check of STYLE_LINE_CHECKS) {
      if (check.test(added)) {
        hits.push(`${file}:${current}  [${check.name}] ${check.why}`);
      }
    }
  }
  return hits;
}

// Changed files as { before, after } repo-relative paths
// (they differ only for detected renames).
function changedFiles(patterns) {
  const out = execFileSync(
    'git',
    [
      'diff',
      ...(base ? [diffArgs] : ['--cached']),
      '--diff-filter=ACMRT',
      '--name-status',
      '--',
      ...patterns,
    ],
    { encoding: 'utf8' }
  );
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

function omTokenUses(content) {
  const text = content.replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/[^\n]*/g, '$1');
  const uses = new Map();
  for (const [, token] of text.matchAll(/(--om-[\w-]+)\s*:/g)) {
    // Light and dark declarations of an existing alias are one compatibility token.
    uses.set(`declaration ${token}`, 1);
  }
  for (const [, token] of text.matchAll(
    /var\(\s*(--om-[\w-]+)\s*(?=[),\s])/g
  )) {
    const key = `reference ${token}`;
    uses.set(key, (uses.get(key) || 0) + 1);
  }

  return uses;
}

function newOmTokenUses() {
  return changedFiles(['*.less', '*.css']).flatMap(({ before, after }) => {
    const previous = omTokenUses(getBeforeContent(before));

    return [...omTokenUses(getAfterContent(after))]
      .filter(([key, count]) => count > (previous.get(key) || 0))
      .map(([key]) => `${after}: ${key}`);
  });
}

async function main() {
  PALETTE_CORE = await loadPaletteCore();
  const less = newLessFiles();
  const svgFiles = newSvgFiles();
  const svgImports = newSvgImports();
  const omTokens = newOmTokenUses();
  const styleDebt = newStyleDebt();
  // New `.less` files are reported but do NOT fail the guard — the app-mode
  // migration still lands `.less` for the AI shell. New SVG, token and style
  // debt blocks.
  const problems =
    svgFiles.length + svgImports.length + omTokens.length + styleDebt.length;

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
  if (omTokens.length) {
    process.stderr.write(
      C.red(
        '\n✖ New --om-* declarations or references are not allowed; use --tw-* theme variables:\n'
      )
    );
    omTokens.forEach((hit) => process.stderr.write(`    ${hit}\n`));
  }

  if (styleDebt.length) {
    process.stderr.write(
      C.red(
        `\n\u2716 New style debt on added lines (suppress a deliberate exception with \`${STYLE_ALLOW_TOKEN}\` + a reason):\n`
      )
    );
    styleDebt.forEach((hit) => process.stderr.write(`    ${hit}\n`));
  }

  if (problems) {
    process.stderr.write(
      C.gray(`\nLegacy --om-* tokens and raw SVG icons are deprecated. See specs/ and AGENTS.md. Preserve existing consumers; do not add new usage.\n`)
    );
    process.exit(1);
  }
  process.stdout.write(C.green('✔ No new raw-SVG imports or --om-* token usage.\n'));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  loadPaletteCore,
  setPaletteCore: (re) => {
    PALETTE_CORE = re;
  },
  hasRawPaletteClass,
  STYLE_ALLOW_RE,
  newLessFiles,
  newSvgFiles,
  newSvgImports,
  parseSvgImports,
  svgKey,
  main,
};
