#!/usr/bin/env node
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
 * Component-reuse guard for @openmetadata/ui-core-components.
 *
 * No off-the-shelf linter knows this design system, so this is the one custom
 * check the quality gate needs: it flags UI hand-rolled from raw elements when
 * the library already exports the component.
 *
 * Like tw-deprecation-guard, it enforces "no NEW debt" — only ADDED lines are
 * inspected, so the pre-existing hand-rolled UI is untouched and migrates over
 * time. That is what lets it run at error severity from day one.
 *
 *   node scripts/reuse-audit.js                 # staged changes (pre-commit)
 *   node scripts/reuse-audit.js <baseRef>       # vs a base branch (CI)
 *   node scripts/reuse-audit.js --file <path>   # one file, staged+unstaged (agent hook)
 *
 * Escape hatch: append `reuse-audit-ignore` in a comment on the offending line.
 */
const fs = require('fs');
const { execFileSync } = require('child_process');

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
};

/**
 * Arguments are passed as an array with no shell, so a path containing quotes
 * or shell metacharacters is inert rather than interpolated into a command.
 *
 * A failure THROWS rather than degrading to an empty string. Swallowing it
 * would make an unfetched base ref, a shallow clone or a bad BASE_SHA look
 * like "no findings" — a gate reporting success when it never inspected the
 * diff is worse than no gate.
 */
function git(args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (e) {
    const detail = (e.stderr || e.message || '').trim().split('\n')[0];
    throw new Error(`git ${args.join(' ')} failed: ${detail}`);
  }
}

/**
 * Tests, mocks and Playwright specs legitimately hand-write raw elements (test
 * doubles) and query ARIA roles as selectors (`[role="tablist"]`). Auditing them
 * produced only false positives, so they are out of scope.
 */
// Repo-root-relative, and passed with `:(top)` so the same pathspec resolves
// identically whether git runs from the repo root (CI) or the UI app (local
// script, agent hook). Without this the two call sites audit different trees.
const UI_PATHSPEC = ':(top)openmetadata-ui/src/main/resources/ui/src';

const EXCLUDED =
  /(\/playwright\/|\/__mocks__\/|\/src\/test\/|\.test\.tsx?$|\.spec\.tsx?$|\.mock\.|\.stories\.tsx?$)/;

/**
 * Each rule matches a single added line. `where` narrows a rule to the paths it
 * makes sense in — native controls are normal in a page shell, not in a
 * component that the library already provides.
 */
const RULES = [
  {
    id: 'aria-role',
    // Require whitespace or '<' immediately before `role`, so this matches a
    // real JSX attribute and not `data-role="menu"` / `user-role="tab"` (a
    // plain \b boundary matches after '-', since '-' is a non-word char) nor a
    // CSS/testing selector like `[role="menu"]`.
    test: /(?:^|[\s<])role=["'](listbox|combobox|menu|menuitem|tablist|tab|dialog|alertdialog|switch|radiogroup|progressbar|tooltip)["']/,
    use: (m) =>
      ({
        listbox: 'Select / MultiSelect',
        combobox: 'Combobox / Autocomplete',
        menu: 'Dropdown',
        menuitem: 'Dropdown',
        tablist: 'Tabs',
        tab: 'Tabs',
        dialog: 'Modal',
        alertdialog: 'Modal',
        switch: 'Toggle',
        radiogroup: 'RadioButtons',
        progressbar: 'ProgressIndicator',
        tooltip: 'Tooltip',
      }[m[1]]),
    why: 'hand-rolled ARIA widget',
  },
  {
    id: 'native-control',
    where: /\/src\/components\//,
    test: /<(button|input|select|textarea)(\s|>|\/)/,
    use: (m) =>
      ({
        button: 'Button',
        input: 'Input',
        select: 'Select',
        textarea: 'Textarea',
      }[m[1]]),
    why: 'raw native control inside a component',
  },
  // A 'keyboard-nav' rule matching ArrowDown/ArrowUp was removed deliberately.
  // Arrow keys are legitimate in data grids, ReactFlow canvases and sliders,
  // none of which a Select/Dropdown/Tabs can replace — so its suggested fix
  // would have been wrong for most of what it caught. The aria-role rule
  // already covers the case that matters: a hand-rolled listbox or menu.
  // Precision beats recall in a blocking gate.
  {
    id: 'portal',
    test: /\bcreatePortal\s*\(/,
    use: () => 'Modal / Popover / SlideoutMenu',
    why: 'hand-rolled overlay portal',
  },
];

/**
 * A brand-new file is untracked, so `git diff` reports nothing for it — which
 * would silently pass exactly the case this guard exists for (an agent writing
 * a fresh component). Treat every line of an untracked file as added.
 */
function untrackedAsAdded(pathspec) {
  // --full-name forces repo-root-relative paths regardless of cwd, matching the
  // `+++ b/<path>` form from git diff. Without it the paths are cwd-relative and
  // both the file read and the EXCLUDED/where matching are wrong when this runs
  // from the UI app rather than the repo root.
  const out = git([
    'ls-files',
    '--others',
    '--exclude-standard',
    '--full-name',
    '--',
    ...pathspec,
  ]);
  const root = git(['rev-parse', '--show-toplevel']).trim();
  const added = [];
  for (const file of out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (!/\.(ts|tsx)$/.test(file)) {
      continue;
    }
    const body = fs.readFileSync(`${root}/${file}`, 'utf8');
    body
      .split('\n')
      .forEach((text, i) => added.push({ file, lineNo: i + 1, text }));
  }
  return added;
}

function addedLines(diffArgs, pathspec) {
  const out = git(['diff', ...diffArgs, '-U0', '--', ...pathspec]);
  const added = [];
  let file = null;
  let lineNo = 0;
  for (const line of out.split('\n')) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      file = fileMatch[1];
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) {
      lineNo = parseInt(hunk[1], 10);
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      added.push({ file, lineNo, text: line.slice(1) });
      lineNo++;
    }
  }
  return added;
}

function findings(added) {
  const hits = [];
  for (const { file, lineNo, text } of added) {
    if (!file || EXCLUDED.test(file) || /reuse-audit-ignore/.test(text)) {
      continue;
    }
    // A comment line mentioning `<button>` or role="menu" is prose, not markup.
    if (/^\s*(\/\/|\/\*|\*)/.test(text)) {
      continue;
    }
    for (const rule of RULES) {
      if (rule.where && !rule.where.test(`/${file}`)) {
        continue;
      }
      const m = text.match(rule.test);
      if (m) {
        hits.push({ file, lineNo, rule, use: rule.use(m), text: text.trim() });
        break;
      }
    }
  }
  return hits;
}

function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const single = fileIdx !== -1 ? args[fileIdx + 1] : null;
  // A file the agent just wrote is unstaged, so compare against HEAD to catch
  // both staged and working-tree edits.
  const diffArgs = single ? ['HEAD'] : [args[0] || '--cached'];
  // Scoped to the UI app rather than '*.tsx' repo-wide: the CI step and the
  // local script run from different working directories, and a bare glob would
  // make CI audit the whole repository while local audits only the UI.
  const pathspec = single
    ? [single]
    : [`${UI_PATHSPEC}/**/*.tsx`, `${UI_PATHSPEC}/**/*.ts`];

  const hits = findings([
    ...addedLines(diffArgs, pathspec),
    ...untrackedAsAdded(pathspec),
  ]);

  if (hits.length) {
    process.stderr.write(
      C.red(
        `\n✖ ${hits.length} new hand-rolled component(s) — @openmetadata/ui-core-components already exports these:\n`
      )
    );
    for (const h of hits) {
      process.stderr.write(
        `    ${h.file}:${h.lineNo}  ${C.gray(h.rule.why)}\n`
      );
      process.stderr.write(`      use ${h.use}\n`);
      process.stderr.write(`      ${C.gray(h.text.slice(0, 100))}\n`);
    }
    process.stderr.write(
      C.gray(
        `\nImport from '@openmetadata/ui-core-components'. See docs/ui-code-quality-gate.md.\n` +
          `If a raw element is genuinely required, add a 'reuse-audit-ignore' comment on that line.\n`
      )
    );
    process.exit(1);
  }
  process.stdout.write(C.green('✔ No new hand-rolled components.\n'));
}

// Guarded so reuse-audit.test.js can require the pure helpers without the CLI
// running (and calling process.exit) on import.
if (require.main === module) {
  try {
    main();
  } catch (e) {
    // Fail loudly. "Could not inspect the diff" must never render as "clean".
    process.stderr.write(
      C.red(
        `\n✖ reuse-audit could not inspect the diff — refusing to pass.\n`
      ) +
        `  ${e.message}\n` +
        C.gray(
          `  Check the base ref is fetched (CI uses fetch-depth: 0) and that it exists locally.\n`
        )
    );
    process.exit(1);
  }
}

module.exports = { findings, addedLines, RULES, EXCLUDED };
