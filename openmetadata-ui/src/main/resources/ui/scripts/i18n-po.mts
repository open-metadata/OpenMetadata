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

/*
 * Bridge i18next locale JSON <-> gettext PO so translators can use any
 * PO-based tool (Poedit, Weblate, translate-toolkit) or a TMS that prefers PO.
 * Most TMSes (Crowdin, Weblate) read the i18next JSON directly — see
 * `crowdin.yml` and `src/locale/TRANSLATING.md`; use this PO route only when
 * your toolchain needs PO.
 *
 * Uses `i18next-conv` on demand via `npx` (no committed dependency). Runs under
 * Node's native TypeScript type-stripping (Node >= 22.6):
 *   node --experimental-strip-types scripts/i18n-po.ts to-po   sv-se
 *   node --experimental-strip-types scripts/i18n-po.ts from-po sv-se
 *   yarn i18n:to-po sv-se   /   yarn i18n:from-po sv-se
 * After `from-po`, run `yarn i18n` then `yarn i18n:validate sv-se`.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const LANG_DIR = join(ROOT, 'src', 'locale', 'languages');
const PO_DIR = join(ROOT, 'i18n-po');

const MODES = new Set(['to-po', 'from-po']);
// Locale codes are `lang-country`, e.g. `sv-se`. Validate before using the
// value in a file path / subprocess arg to prevent traversal or arg injection.
const LOCALE_RE = /^[a-z]{2,3}-[a-z]{2,3}$/;

const [mode, code] = process.argv.slice(2);

let exitCode = 0;
if (!mode || !MODES.has(mode) || !code || !LOCALE_RE.test(code)) {
  console.error(
    'Usage: node scripts/i18n-po.ts <to-po|from-po> <locale-code, e.g. sv-se>'
  );
  exitCode = 2;
} else {
  const lang = code.split('-')[0];
  mkdirSync(PO_DIR, { recursive: true });
  const json = join(LANG_DIR, `${code}.json`);
  const po = join(PO_DIR, `${code}.po`);
  const [source, target] = mode === 'to-po' ? [json, po] : [po, json];

  execFileSync(
    'npx',
    ['--yes', 'i18next-conv', '-l', lang, '-s', source, '-t', target],
    { stdio: 'inherit' }
  );

  console.log(
    mode === 'to-po'
      ? `Wrote ${po}`
      : `Wrote ${json} — now run \`yarn i18n\` then \`yarn i18n:validate ${code}\`.`
  );
}

process.exit(exitCode);
