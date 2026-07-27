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
 * UntitledUI + Tailwind design-system audit — flags hardcoded values in
 * .tsx/.ts and inventories Antd/Less migration debt.
 *
 *   node scripts/tw-audit.js            # summary + CI exit code
 *   node scripts/tw-audit.js --report   # full grouped inventory
 *   node scripts/tw-audit.js --json
 *   node scripts/tw-audit.js <files...> # audit specific files (changed set)
 *
 * Errors (exit 1): arbitrary Tailwind color / spacing / radius values that map
 * to a design-system utility. Warnings (exit 0): raw hex, inline styles,
 * unresolved arbitraries. Info: Antd imports (deprecated) + .less files.
 */
const fs = require('fs');
const path = require('path');
const { scanText } = require('./design-tokens/tw-scanner');

const SRC = path.resolve(__dirname, '../src');
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', 'target', 'output', 'generated', 'antlr', 'jsons',
]);
const SKIP_FILE = /\.(d)\.ts$/;

function walk(dir, exts, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) {
        walk(full, exts, acc);
      }
    } else if (exts.test(e.name) && !SKIP_FILE.test(e.name)) {
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
      .filter((f) => /\.(tsx?|jsx?)$/.test(f) && fs.existsSync(f));
  } else {
    files = walk(SRC, /\.(tsx|ts|jsx|js)$/, []);
  }
  return files;
}

function countLessFiles() {
  const acc = [];
  walk(SRC, /\.less$/, acc);
  return acc.length;
}

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
};

function tally(findings) {
  const byCategory = {};
  const bySeverity = { error: 0, warning: 0, info: 0 };
  const byFile = {};
  const antdFiles = new Set();
  for (const f of findings) {
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    bySeverity[f.severity]++;
    if (f.severity === 'error') {
      byFile[f.file] = (byFile[f.file] || 0) + 1;
    }
    if (f.category === 'antd-import') {
      antdFiles.add(f.file);
    }
  }
  return { byCategory, bySeverity, byFile, antdFiles };
}

function printSummary(findings, scanned, t, lessCount) {
  process.stdout.write(`\n${C.bold('UntitledUI + Tailwind design-system audit')}\n`);
  process.stdout.write(`Scanned ${scanned} .tsx/.ts files\n\n`);
  process.stdout.write(`${C.bold('By category')}\n`);
  for (const [cat, n] of Object.entries(t.byCategory).sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  ${cat.padEnd(18)} ${n}\n`);
  }
  process.stdout.write(`\n${C.bold('Migration debt (deprecated stacks)')}\n`);
  process.stdout.write(`  ${C.yellow('Antd')}: ${t.antdFiles.size} files import 'antd'\n`);
  if (lessCount !== null) {
    process.stdout.write(`  ${C.yellow('Less')}: ${lessCount} .less files\n`);
  }
  const topFiles = Object.entries(t.byFile).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (topFiles.length) {
    process.stdout.write(`\n${C.bold('Files with the most errors')}\n`);
    for (const [file, n] of topFiles) {
      process.stdout.write(`  ${String(n).padStart(4)}  ${path.relative(SRC, file)}\n`);
    }
  }
  process.stdout.write(
    `\n${C.bold('Totals')}  ${C.red(t.bySeverity.error + ' errors')}  ${C.yellow(
      t.bySeverity.warning + ' warnings'
    )}  ${C.gray(t.bySeverity.info + ' info')}\n`
  );
}

function printReport(findings, t) {
  const grouped = {};
  for (const f of findings) {
    (grouped[f.category] = grouped[f.category] || []).push(f);
  }
  for (const [cat, list] of Object.entries(grouped)) {
    process.stdout.write(`\n${C.bold(C.cyan(`── ${cat} (${list.length}) ──`))}\n`);
    const distinct = {};
    for (const f of list) {
      const k = f.raw;
      distinct[k] = distinct[k] || { count: 0, suggestion: f.suggestion };
      distinct[k].count++;
    }
    for (const [raw, info] of Object.entries(distinct).sort((a, b) => b[1].count - a[1].count).slice(0, 30)) {
      const sugg = info.suggestion ? C.green(info.suggestion) : C.gray('review');
      process.stdout.write(`  ${String(info.count).padStart(4)}×  ${raw.slice(0, 40).padEnd(42)} →  ${sugg}\n`);
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const files = collectFiles(args);
  const findings = [];
  for (const file of files) {
    const rel = path.relative(SRC, file);
    findings.push(...scanText(fs.readFileSync(file, 'utf8'), rel));
  }
  const t = tally(findings);
  const lessCount = args.some((a) => !a.startsWith('-')) ? null : countLessFiles();

  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify({ findings, scanned: files.length }, null, 2) + '\n');
  } else {
    printSummary(findings, files.length, t, lessCount);
    if (args.includes('--report')) {
      printReport(findings, t);
    } else if (t.bySeverity.error) {
      process.stdout.write(C.gray('\nRun with --report to see every value and its utility.\n'));
    }
    process.stdout.write(
      t.bySeverity.error
        ? C.red(`\n✖ ${t.bySeverity.error} hardcoded-value errors — use tokens from tailwind.css / globals.css.\n`)
        : C.green('\n✔ No hardcoded-value errors.\n')
    );
  }
  process.exit(t.bySeverity.error > 0 ? 1 : 0);
}

main();
