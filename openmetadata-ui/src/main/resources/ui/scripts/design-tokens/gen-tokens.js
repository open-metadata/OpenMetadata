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
 * Regenerates the generated block of `src/styles/tokens.css`.
 *
 * Scans every CSS/LESS file once (without writing) so the token map records
 * which palette / legacy / off-scale / z-index / duration tokens the codebase
 * actually references, then writes the full upstream palette plus exactly those
 * project tokens between the @tokens:generated markers.
 *
 * Run after `token-migrate.js`, or any time raw values change.
 */
const fs = require('fs');
const path = require('path');
const { processText, isExempt } = require('./scanner');
const map = require('./token-map');

const STYLES_ROOT = path.resolve(__dirname, '../../src');
const TOKENS_CSS = path.resolve(STYLES_ROOT, 'styles/tokens.css');
const SIDECAR = path.resolve(__dirname, 'legacy-colors.json');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'target', 'output']);
const BEGIN = '/* @tokens:generated-begin';
const END = '/* @tokens:generated-end */';
const OM_USAGE_RE = /var\(\s*(--om-[\w-]+)/g;

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

function loadSidecar() {
  const values = new Map();
  if (fs.existsSync(SIDECAR)) {
    const json = JSON.parse(fs.readFileSync(SIDECAR, 'utf8'));
    Object.entries(json).forEach(([k, v]) => values.set(k, v));
  }
  return values;
}

function saveSidecar(values) {
  const obj = {};
  [...values.keys()].sort().forEach((k) => (obj[k] = values.get(k)));
  fs.writeFileSync(SIDECAR, JSON.stringify(obj, null, 2) + '\n');
}

/**
 * Populates the registry from both raw values (pre-migration files) and
 * existing var(--om-*) usages (post-migration files), so the generated block
 * always reflects exactly the tokens the codebase references, regardless of
 * migration state. Legacy-color values persist in a sidecar.
 */
function populateRegistry() {
  map.resetRegistry();
  const files = walk(STYLES_ROOT, []).filter((f) => !isExempt(f));
  const usageNames = new Set();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    processText(text, path.relative(STYLES_ROOT, file));
    let m;
    OM_USAGE_RE.lastIndex = 0;
    while ((m = OM_USAGE_RE.exec(text))) {
      usageNames.add(m[1]);
    }
  }
  const legacyValues = loadSidecar();
  for (const [name, value] of map.registry.legacyColors) {
    legacyValues.set(name, value);
  }
  saveSidecar(legacyValues);
  for (const name of usageNames) {
    map.registerUsage(name, legacyValues);
  }
}

function buildGeneratedBlock() {
  const body = map.emitGeneratedBlocks();
  return (
    `${BEGIN} — DO NOT EDIT BY HAND.\n` +
    `   Regenerate: node scripts/design-tokens/gen-tokens.js\n` +
    `   Full upstream palette + the project legacy/off-scale/z/motion tokens\n` +
    `   actually referenced by components. */\n` +
    ':root {\n' +
    body +
    '\n}\n' +
    END
  );
}

function inject(css, block) {
  const start = css.indexOf(BEGIN);
  const end = css.indexOf(END);
  if (start === -1 || end === -1) {
    throw new Error('tokens.css is missing the @tokens:generated markers');
  }
  return css.slice(0, start) + block + css.slice(end + END.length);
}

function main() {
  populateRegistry();
  if (map.registry.collisions.length) {
    process.stderr.write(
      'Token name collisions detected:\n' +
        JSON.stringify(map.registry.collisions, null, 2) +
        '\n'
    );
    process.exit(2);
  }
  const css = fs.readFileSync(TOKENS_CSS, 'utf8');
  fs.writeFileSync(TOKENS_CSS, inject(css, buildGeneratedBlock()));

  const r = map.registry;
  process.stdout.write(
    `tokens.css regenerated:\n` +
      `  palette (full upstream): ${Object.keys(map.constants.UPSTREAM).length}\n` +
      `  legacy colors:           ${r.legacyColors.size}\n` +
      `  extended spacing:        ${
        [...r.spacing.keys()].filter((px) => !map.constants.CORE_SPACING.has(px))
          .length
      }\n` +
      `  extended radius:         ${
        [...r.radius.keys()].filter((k) => /^\d+$/.test(k)).length
      }\n` +
      `  extended font-size:      ${
        [...r.fontSize.keys()].filter((k) => /^\d+$/.test(k)).length
      }\n` +
      `  z-index tokens:          ${r.zIndex.size}\n` +
      `  duration tokens:         ${r.duration.size}\n`
  );
}

main();
