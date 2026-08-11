#!/usr/bin/env node
/*
 *  Copyright 2024 Collate.
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
 * Design-token audit — scans CSS/LESS for hardcoded visual values and reports
 * each one with the token that should replace it.
 *
 *   node scripts/token-audit.js            # summary + CI exit code
 *   node scripts/token-audit.js --report   # full grouped inventory (Step 1)
 *   node scripts/token-audit.js --json      # machine-readable findings
 *   node scripts/token-audit.js <files...>  # audit specific files (changed-set)
 *
 * Errors  (fail CI, exit 1): hardcoded colors, hardcoded spacing.
 * Warnings (exit 0):          radius, font-size, font-weight, z-index, motion.
 * Token-definition files (tokens.css, variables.less) and vendored stylesheets
 * are exempt.
 */
const fs = require('fs');
const path = require('path');
const { processText, isExempt } = require('./design-tokens/scanner');

const STYLES_ROOT = path.resolve(__dirname, '../src');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'target', 'output']);

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walk(full, acc);
      }
    } else if (/\.(less|css)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function collectFiles(args) {
  const explicit = args.filter((a) => !a.startsWith('-'));
  let files;
  if (explicit.length) {
    files = explicit
      .map((f) => path.resolve(process.cwd(), f))
      .filter((f) => /\.(less|css)$/.test(f) && fs.existsSync(f));
  } else {
    files = walk(STYLES_ROOT, []);
  }
  return files;
}

function auditFiles(files) {
  const findings = [];
  let scanned = 0;
  for (const file of files) {
    if (isExempt(file)) {
      continue;
    }
    scanned++;
    const rel = path.relative(STYLES_ROOT, file);
    const text = fs.readFileSync(file, 'utf8');
    const res = processText(text, rel);
    findings.push(...res.findings);
  }
  return { findings, scanned };
}

function tally(findings) {
  const byCategory = {};
  const bySeverity = { error: 0, warning: 0 };
  const byFile = {};
  for (const f of findings) {
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    bySeverity[f.severity]++;
    if (!byFile[f.file]) {
      byFile[f.file] = { error: 0, warning: 0, total: 0 };
    }
    byFile[f.file][f.severity]++;
    byFile[f.file].total++;
  }
  return { byCategory, bySeverity, byFile };
}

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function printFindingLine(f) {
  const sev =
    f.severity === 'error' ? C.red('error  ') : C.yellow('warning');
  const loc = C.gray(`${f.file}:${f.line}:${f.col}`);
  const sugg = f.suggestion
    ? C.green(`var(${f.suggestion})`)
    : C.gray('review manually');
  process.stdout.write(
    `  ${sev} ${loc}  ${C.bold(f.property)}: ${f.raw}  →  ${sugg}\n`
  );
}

function printSummary(findings, scanned, tallies) {
  const { byCategory, bySeverity, byFile } = tallies;
  process.stdout.write(`\n${C.bold('Design-token audit')}\n`);
  process.stdout.write(
    `Scanned ${scanned} CSS/LESS files (token & vendor files exempt)\n\n`
  );
  process.stdout.write(`${C.bold('By category')}\n`);
  for (const [cat, n] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  ${cat.padEnd(12)} ${n}\n`);
  }
  const topFiles = Object.entries(byFile)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 15);
  if (topFiles.length) {
    process.stdout.write(`\n${C.bold('Files with the most violations')}\n`);
    for (const [file, c] of topFiles) {
      process.stdout.write(
        `  ${String(c.total).padStart(5)}  ${C.red(c.error + 'e')} ${C.yellow(
          c.warning + 'w'
        )}  ${file}\n`
      );
    }
  }
  process.stdout.write(
    `\n${C.bold('Totals')}  ${C.red(bySeverity.error + ' errors')}  ${C.yellow(
      bySeverity.warning + ' warnings'
    )}\n`
  );
}

function printReport(findings, scanned, tallies) {
  printSummary(findings, scanned, tallies);
  const grouped = {};
  for (const f of findings) {
    (grouped[f.category] = grouped[f.category] || []).push(f);
  }
  for (const [cat, list] of Object.entries(grouped)) {
    process.stdout.write(
      `\n${C.bold(C.cyan('── ' + cat + ' (' + list.length + ') ──'))}\n`
    );
    const distinct = {};
    for (const f of list) {
      distinct[f.raw] = distinct[f.raw] || { count: 0, suggestion: f.suggestion };
      distinct[f.raw].count++;
    }
    for (const [raw, info] of Object.entries(distinct).sort(
      (a, b) => b[1].count - a[1].count
    )) {
      const sugg = info.suggestion
        ? C.green(`var(${info.suggestion})`)
        : C.gray('review manually');
      process.stdout.write(
        `  ${String(info.count).padStart(4)}×  ${raw.padEnd(28)} →  ${sugg}\n`
      );
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const files = collectFiles(args);
  const { findings, scanned } = auditFiles(files);
  const tallies = tally(findings);

  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify({ findings, scanned }, null, 2) + '\n');
  } else if (args.includes('--report')) {
    printReport(findings, scanned, tallies);
    if (args.includes('--list')) {
      process.stdout.write(`\n${C.bold('All findings')}\n`);
      findings
        .sort((a, b) => (a.file + a.line).localeCompare(b.file + b.line))
        .forEach(printFindingLine);
    }
  } else {
    printSummary(findings, scanned, tallies);
    if (tallies.bySeverity.error > 0) {
      process.stdout.write(
        C.gray('\nRun with --report to see every value and its token.\n')
      );
    }
  }

  const hasErrors = tallies.bySeverity.error > 0;
  if (hasErrors && !args.includes('--json')) {
    process.stdout.write(
      C.red(`\n✖ ${tallies.bySeverity.error} token errors — see specs/ and tokens.css.\n`)
    );
  } else if (!args.includes('--json')) {
    process.stdout.write(C.green('\n✔ No token errors.\n'));
  }
  process.exit(hasErrors ? 1 : 0);
}

main();
