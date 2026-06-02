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
 * Structural validator for the i18next locale files in
 * `src/locale/languages`. For each target locale it checks, against the
 * primary (en-us):
 *   1. key parity   — identical key set AND order (catches drift `yarn i18n` fixes)
 *   2. token parity — every `{{placeholder}}` and `<0>…</0>` tag matches the
 *                     primary string exactly (the #1 way machine translation
 *                     breaks i18next interpolation)
 *   3. formatting   — bytes === `JSON.stringify(obj, null, 2) + "\n"`, i.e. the
 *                     `sync-i18n --space 2` / Prettier shape (zero-diff)
 * and reports translation coverage. Exits non-zero on any failure, so it can
 * gate CI once all shipped locales conform.
 *
 * Usage:
 *   node scripts/i18n-validate.mjs            # every non-primary locale
 *   node scripts/i18n-validate.mjs sv-se      # one or more specific locales
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LANG_DIR = join(HERE, '..', 'src', 'locale', 'languages');
const PRIMARY = 'en-us';

const raw = (code) => readFileSync(join(LANG_DIR, `${code}.json`), 'utf8');
const read = (code) => JSON.parse(raw(code));

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object'
      ? flatten(v, `${prefix}${k}.`)
      : [[`${prefix}${k}`, v]]
  );

const TOKEN_RE = /{{\s*[\w.-]+\s*}}|<\/?\d+>/g;
const tokens = (s) => (String(s).match(TOKEN_RE) || []).sort();
const sameTokens = (a, b) => {
  const x = tokens(a);
  const y = tokens(b);
  return x.length === y.length && x.every((t, i) => t === y[i]);
};

const primaryFlat = flatten(read(PRIMARY));
const primaryKeys = primaryFlat.map(([k]) => k);
const primaryMap = new Map(primaryFlat);

const argLocales = process.argv.slice(2).map((a) => a.replace(/\.json$/, ''));
const targets = argLocales.length
  ? argLocales
  : readdirSync(LANG_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''))
      .filter((c) => c !== PRIMARY);

let failed = false;

for (const code of targets) {
  const errors = [];
  const text = raw(code);
  const obj = JSON.parse(text);
  const flat = flatten(obj);
  const keys = flat.map(([k]) => k);

  if (keys.join('|') !== primaryKeys.join('|')) {
    const missing = primaryKeys.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !primaryKeys.includes(k));
    if (missing.length) {
      errors.push(
        `${missing.length} missing key(s): ${missing.slice(0, 5).join(', ')}${
          missing.length > 5 ? '…' : ''
        }`
      );
    }
    if (extra.length) {
      errors.push(
        `${extra.length} extra key(s): ${extra.slice(0, 5).join(', ')}${
          extra.length > 5 ? '…' : ''
        }`
      );
    }
    if (!missing.length && !extra.length) {
      errors.push('key order differs from primary (run `yarn i18n`)');
    }
  }

  let tokenMismatches = 0;
  for (const [k, v] of flat) {
    const p = primaryMap.get(k);
    if (p === undefined || typeof v !== 'string' || typeof p !== 'string') {
      continue;
    }
    if (!sameTokens(p, v)) {
      tokenMismatches += 1;
      if (tokenMismatches <= 10) {
        errors.push(
          `token mismatch @ ${k}: primary=${JSON.stringify(
            tokens(p)
          )} ${code}=${JSON.stringify(tokens(v))}`
        );
      }
    }
  }
  if (tokenMismatches > 10) {
    errors.push(`…and ${tokenMismatches - 10} more token mismatch(es)`);
  }

  if (text !== `${JSON.stringify(obj, null, 2)}\n`) {
    errors.push(
      'formatting differs from `JSON.stringify(obj, null, 2) + "\\n"` (run `yarn i18n`)'
    );
  }

  const translated = flat.filter(([k, v]) => primaryMap.get(k) !== v).length;
  const pct = ((100 * translated) / primaryKeys.length).toFixed(1);

  if (errors.length) {
    failed = true;
    console.error(`✗ ${code}: ${errors.length} issue(s) — ${pct}% translated`);
    errors.forEach((e) => console.error(`    - ${e}`));
  } else {
    console.log(
      `✓ ${code}: OK — ${pct}% translated (${translated}/${primaryKeys.length})`
    );
  }
}

process.exit(failed ? 1 : 0);
