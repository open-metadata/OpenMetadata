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
 * Turns an ESLint JSON report into the markdown that ui-checkstyle posts on the
 * PR, so a contributor sees which rules fired on the files they touched instead
 * of only "one or more files have issues".
 *
 * Most rules are at `warn` while their backlog is worked down, and warnings do
 * not fail the build. Without this they would be invisible on a PR — the whole
 * point of the warn tier is that the backlog is *seen*.
 *
 *   node scripts/eslint-pr-report.js <eslint-json> [--limit N]
 *
 * Writes GITHUB_OUTPUT-formatted keys to stdout: `has_findings`, `summary`,
 * `details`. Always exits 0 — this reports, it never gates.
 */
const fs = require('fs');

const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');

  return i !== -1 ? parseInt(process.argv[i + 1], 10) : 50;
})();

function read(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8').trim();
  } catch {
    // A missing report means the lint step itself broke. Say so rather than
    // rendering "no findings", which would read as success.
    return null;
  }

  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw);
  } catch {
    // The file is written via `yarn ... -f json > report.json`, and yarn classic
    // prints its wrapper lines ("yarn run v...", "$ ...", "Done in Xs.") to
    // stdout, which lands in the file around the eslint JSON. The formatter emits
    // a single array, so recover it by slicing from the first bracket to the last.
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }

    return null;
  }
}

function main() {
  const results = read(process.argv[2]);
  const out = [];

  if (results === null) {
    out.push('has_findings=true');
    out.push('summary=ESLint report could not be read — see the job log.');
    out.push(
      'details<<EOF',
      '_No machine-readable report was produced._',
      'EOF'
    );
    process.stdout.write(`${out.join('\n')}\n`);

    return;
  }

  const findings = [];
  for (const file of results) {
    for (const m of file.messages) {
      findings.push({
        file: file.filePath.replace(`${process.cwd()}/`, ''),
        line: m.line,
        col: m.column,
        sev: m.severity,
        rule: m.ruleId || 'parse-error',
        msg: m.message,
      });
    }
  }

  const errors = findings.filter((f) => f.sev === 2);
  const warnings = findings.filter((f) => f.sev === 1);

  if (!findings.length) {
    process.stdout.write('has_findings=false\n');

    return;
  }

  // Errors first — they block; warnings are the backlog.
  const ordered = [...errors, ...warnings];
  const shown = ordered.slice(0, LIMIT);
  const omitted = ordered.length - shown.length;

  const byRule = {};
  for (const f of findings) {
    byRule[f.rule] = (byRule[f.rule] || 0) + 1;
  }
  const top = Object.entries(byRule)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const body = [];
  body.push(
    `**${errors.length} error(s), ${warnings.length} warning(s)** across ${
      results.filter((r) => r.messages.length).length
    } changed file(s).`
  );
  body.push('');
  body.push('| Count | Rule |');
  body.push('|---:|---|');
  top.forEach(([rule, n]) => body.push(`| ${n} | \`${rule}\` |`));
  body.push('');
  body.push('<details><summary>All findings</summary>');
  body.push('');
  body.push('| | Location | Rule | Message |');
  body.push('|---|---|---|---|');
  for (const f of shown) {
    const icon = f.sev === 2 ? '🔴' : '🟡';
    // Collapse newlines and escape pipes: either would break the table row,
    // and some rules (exhaustive-deps) emit multi-line messages.
    //
    // Backslashes MUST be escaped before pipes. Escaping only `|` leaves an
    // input `\|` rendered as `\\|` — an escaped backslash followed by a live
    // pipe, which still breaks out of the cell. The message text comes from
    // PR-authored source, so treat it as untrusted.
    const msg = f.msg
      .replace(/\s*\n\s*/g, ' ')
      .replace(/\\/g, '\\\\')
      .replace(/\|/g, '\\|')
      .slice(0, 160);
    body.push(
      `| ${icon} | \`${f.file}:${f.line}:${f.col}\` | \`${f.rule}\` | ${msg} |`
    );
  }
  if (omitted > 0) {
    // Never truncate silently — a capped list that looks complete is worse
    // than no list.
    body.push('');
    body.push(
      `_… and ${omitted} more. Run \`make ui-checkstyle-changed\` locally for the full list._`
    );
  }
  body.push('');
  body.push('</details>');

  out.push('has_findings=true');
  out.push(`summary=${errors.length} error(s), ${warnings.length} warning(s)`);
  out.push('details<<EOF', ...body, 'EOF');
  process.stdout.write(`${out.join('\n')}\n`);
}

main();
