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
 * Parses the upstream design-system tokens in
 * `openmetadata-ui-core-components/.../styles/globals.css` and emits
 * `upstream-palette.json`: a canonical-hex -> upstream palette token name map.
 *
 * Run: node scripts/design-tokens/extract-upstream-palette.js
 * This is a build-time helper; its output is committed so the audit/migrate
 * tooling has no cross-package runtime dependency.
 */
const fs = require('fs');
const path = require('path');
const { canonicalizeColor } = require('./color-utils');

const GLOBALS = path.resolve(
  __dirname,
  '../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/styles/globals.css'
);

const PALETTE_RE =
  /^--color-((?:gray-blue|gray-cool|gray-modern|gray-neutral|gray-iron|gray-true|gray-warm|blue-dark|blue-light|green-light|orange-dark|gray|brand|error|warning|success|blue|indigo|violet|purple|fuchsia|pink|rose|orange|yellow|teal|cyan|green|moss)-(?:25|50|100|200|300|400|500|600|700|800|900|950)|white|black)$/;

function extractLiteral(rawValue) {
  let value = rawValue.trim().replace(/;$/, '');
  const varMatch = value.match(/^var\(\s*--[\w-]+\s*,\s*(.+)\)$/);
  if (varMatch) {
    value = varMatch[1].trim();
  }
  return value;
}

function main() {
  const css = fs.readFileSync(GLOBALS, 'utf8');
  const themeBlock = css.slice(0, css.indexOf('@layer base'));
  const map = {};
  const decl = /(--color-[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = decl.exec(themeBlock))) {
    const name = m[1];
    if (!PALETTE_RE.test(name)) {
      continue;
    }
    const literal = extractLiteral(m[2]);
    const canon = canonicalizeColor(literal);
    if (canon && !map[canon]) {
      map[canon] = name;
    }
  }
  const out = {
    generatedFrom: 'openmetadata-ui-core-components/.../styles/globals.css',
    note: 'canonical hex -> upstream palette custom property (light-mode value)',
    palette: map,
  };
  const dest = path.resolve(__dirname, 'upstream-palette.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
  process.stdout.write(
    `Extracted ${Object.keys(map).length} palette colors -> ${dest}\n`
  );
}

main();
