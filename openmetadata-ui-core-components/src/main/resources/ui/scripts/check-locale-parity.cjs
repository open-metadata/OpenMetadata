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

// Gate 3: library must ship every language file the app ships.
// Hard-fails if app > library. Warns (exit 0) if library > app.

const fs = require('fs');
const path = require('path');

const LIB_DIR = path.resolve(__dirname, '..', 'src', 'locale', 'languages');
const APP_DIR = path.resolve(
  __dirname,
  '..', '..', '..', '..', '..', '..',
  'openmetadata-ui', 'src', 'main', 'resources', 'ui', 'src', 'locale', 'languages'
);

function jsonSet(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`ERROR: expected locale directory does not exist: ${dir}`);
    process.exit(1);
  }
  return new Set(
    fs.readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f)
  );
}

const app = jsonSet(APP_DIR);
const lib = jsonSet(LIB_DIR);

const missing = [...app].filter((f) => !lib.has(f)).sort();
const orphan = [...lib].filter((f) => !app.has(f)).sort();

if (orphan.length) {
  console.warn(`WARNING: core-components ships language files the app does not:`);
  for (const f of orphan) console.warn(`  - ${f}`);
  console.warn('');
}

if (missing.length === 0) {
  console.log(`OK: library ships all ${app.size} language files the app supports`);
  process.exit(0);
}

console.error(`ERROR: core-components is missing language files present in the app:`);
for (const f of missing) console.error(`  - ${f}`);
console.error(`\nFix:`);
console.error(`  cd openmetadata-ui-core-components/src/main/resources/ui`);
for (const f of missing) console.error(`  printf '{}\\n' > src/locale/languages/${f}`);
console.error(`  yarn i18n`);
process.exit(1);
