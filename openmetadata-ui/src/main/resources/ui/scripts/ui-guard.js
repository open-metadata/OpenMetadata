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
 * Generation-time gate: audits ONE file the moment an agent writes it.
 *
 * Wired to a PostToolUse Edit|Write hook, so a violation comes back in the same
 * turn — the model learns the constraint where it broke it, against the very
 * scripts CI runs later, instead of discovering it in a PR.
 *
 *   node scripts/ui-guard.js <file>
 *
 * Runs the audits in-process rather than shelling out to each script: this
 * executes on every UI file write, and a second node start-up (~150-300ms) is a
 * tax paid all day.
 */
const path = require('path');
const { execFileSync } = require('child_process');

const UI_DIR = path.resolve(__dirname, '..');

const AUDITS = [
  { name: 'reuse-audit', script: 'reuse-audit.js', args: (f) => ['--file', f] },
  { name: 'tw-audit', script: 'tw-audit.js', args: (f) => [f] },
];

function run(script, args) {
  try {
    execFileSync(process.execPath, [path.join(__dirname, script), ...args], {
      cwd: UI_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return null;
  } catch (e) {
    return `${e.stdout || ''}${e.stderr || ''}`.trim();
  }
}

function main() {
  const file = process.argv[2];
  if (!file || !/\.(ts|tsx)$/.test(file)) {
    process.exit(0);
  }

  // Scope on the path relative to the UI app, not the argument as given: the
  // hook passes an absolute path while a human passes a relative one, and a
  // substring test for '/src/' silently skips the relative form.
  const rel = path.relative(UI_DIR, path.resolve(file));
  if (rel.startsWith('..') || !rel.startsWith(`src${path.sep}`)) {
    process.exit(0);
  }

  const failures = [];
  for (const audit of AUDITS) {
    const out = run(audit.script, audit.args(rel));
    if (out) {
      failures.push(`[${audit.name}]\n${out}`);
    }
  }

  if (failures.length) {
    // Strip ANSI: this text is fed back to an agent, not a terminal.
    const body = failures.join('\n\n').replace(/\x1b\[[0-9;]*m/g, '');
    process.stderr.write(`${body}\n\nFix this now, before continuing.\n`);
    process.exit(2);
  }
}

main();
