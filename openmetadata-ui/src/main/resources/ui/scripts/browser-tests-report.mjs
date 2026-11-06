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
 * Writes the browser-test PR comment: what ran and why, the results, and how
 * much of the PR's changed code the browser tests that ran executed. With
 * selective runs an overall coverage percentage only reflects the tests that
 * happened to run, so the comment reports changed lines instead.
 *
 *   node scripts/browser-tests-report.mjs --base <sha> --selection selection.json \
 *     --junit src/test/browser/junit.xml \
 *     --coverage src/test/browser/coverage/coverage-final.json > comment.md
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MARKER = '<!-- ui-browser-tests -->';
const UI = 'openmetadata-ui/src/main/resources/ui/';
const SOURCE = /^src\/.*\.(ts|tsx|js|jsx)$/;
const NOT_PRODUCT =
  /(\.test\.|\.spec\.|^src\/test\/|\/mocks?\/|\.mock\.|^src\/generated\/)/;

/** UI-relative source files a unified diff (`git diff -U0`) adds lines to. */
export const addedLines = (diff) => {
  const files = new Map();
  let current;
  for (const line of diff.split('\n')) {
    const file = line.match(/^\+\+\+ b\/(.*)$/);
    if (file) {
      const path = file[1].startsWith(UI) ? file[1].slice(UI.length) : '';
      current = SOURCE.test(path) && !NOT_PRODUCT.test(path) ? path : undefined;
      if (current) {
        files.set(current, new Set());
      }

      continue;
    }
    const hunk = line.match(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/);
    if (hunk && current) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      for (let n = start; n < start + count; n++) {
        files.get(current).add(n);
      }
    }
  }

  return files;
};

/**
 * Hits per executable line of each file, as istanbul counts line coverage:
 * a line's hits are the most of any statement starting on it.
 */
export const lineHits = (coverage) =>
  new Map(
    Object.values(coverage).map(({ path, statementMap, s }) => {
      const lines = new Map();
      for (const [id, { start }] of Object.entries(statementMap)) {
        lines.set(start.line, Math.max(lines.get(start.line) ?? 0, s[id]));
      }

      return [path.replace(/.*\/resources\/ui\//, ''), lines];
    })
  );

/** Changed executable lines per file, and how many the tests executed. */
export const changedCoverage = (added, hits) =>
  [...added].map(([file, lines]) => {
    const fileHits = hits.get(file);
    const executable = fileHits
      ? [...lines].filter((n) => fileHits.has(n))
      : [];

    return {
      file,
      loaded: Boolean(fileHits),
      executable: executable.length,
      covered: executable.filter((n) => fileHits.get(n) > 0).length,
    };
  });

const unescape = (text) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

/** Totals and failed test names from a JUnit report. */
export const junitResults = (xml) => {
  const count = (name) =>
    [...xml.matchAll(new RegExp(`<testsuite [^>]*\\b${name}="(\\d+)"`, 'g'))]
      .map((m) => Number(m[1]))
      .reduce((sum, n) => sum + n, 0);
  const failed = [
    ...xml.matchAll(
      /<testcase [^>]*classname="([^"]*)"[^>]*name="([^"]*)"[^>]*>\s*<failure/g
    ),
  ].map((m) => unescape(`${m[1]} › ${m[2]}`));

  return {
    tests: count('tests'),
    failures: count('failures') + count('errors'),
    skipped: count('skipped'),
    failed,
  };
};

const pct = (covered, total) =>
  total ? `${Math.round((covered / total) * 100)}%` : 'n/a';

export const renderComment = ({ selection, results, rows }) => {
  const out = [MARKER, '### UI browser tests', ''];
  const ran =
    selection.mode === 'all'
      ? `all test files (${selection.reason})`
      : selection.reason;
  out.push(`**Ran:** ${ran}`, '');

  if (results) {
    const passed = results.tests - results.failures - results.skipped;
    out.push(
      results.failures
        ? `**Result:** ❌ ${results.failures} failed · ${passed} passed · ${results.skipped} skipped`
        : `**Result:** ✅ ${passed} passed · ${results.skipped} skipped`,
      ''
    );
    if (results.failed.length) {
      out.push(
        '<details open><summary>Failed tests</summary>',
        '',
        ...results.failed.slice(0, 30).map((name) => `- ${name}`),
        '',
        '</details>',
        ''
      );
    }
  }

  const measured = rows.filter((row) => row.executable);
  if (measured.length) {
    const total = measured.reduce((sum, row) => sum + row.executable, 0);
    const covered = measured.reduce((sum, row) => sum + row.covered, 0);
    out.push(
      `**Changed code executed by these browser tests:** ${covered} / ${total} lines (${pct(
        covered,
        total
      )})`,
      '',
      '| File | Changed lines | Executed | % |',
      '|---|---|---|---|',
      ...measured
        .sort((a, b) => a.covered / a.executable - b.covered / b.executable)
        .map(
          (row) =>
            `| \`${row.file}\` | ${row.executable} | ${row.covered} | ${pct(
              row.covered,
              row.executable
            )} |`
        ),
      ''
    );
  }

  const untouched = rows.filter((row) => !row.loaded).map((row) => row.file);
  if (untouched.length) {
    out.push(
      '<details><summary>Changed files no browser test loads</summary>',
      '',
      ...untouched.map((file) => `- \`${file}\``),
      '',
      '</details>',
      ''
    );
  }

  return out.join('\n');
};

const main = () => {
  const args = process.argv.slice(2);
  const option = (name) =>
    args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  const read = (file, fallback) =>
    file && existsSync(file) ? readFileSync(file, 'utf8') : fallback;

  const diff = execFileSync(
    'git',
    [
      'diff',
      '-U0',
      '--diff-filter=AM',
      `${option('--base')}...HEAD`,
      '--',
      '.',
    ],
    { encoding: 'utf8', maxBuffer: 1 << 26 }
  );
  const selection = JSON.parse(
    read(option('--selection'), '{"mode":"all","reason":"full run"}')
  );
  const xml = read(option('--junit'));
  const coverage = JSON.parse(read(option('--coverage'), '{}'));

  process.stdout.write(
    renderComment({
      selection,
      results: xml ? junitResults(xml) : undefined,
      rows: changedCoverage(addedLines(diff), lineHits(coverage)),
    })
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
