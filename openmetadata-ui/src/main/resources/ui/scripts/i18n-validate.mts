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
 * Runs under Node's native TypeScript type-stripping (Node >= 22.6); no
 * transpiler or runtime dependency. Usage:
 *   node --experimental-strip-types scripts/i18n-validate.ts          # all locales
 *   node --experimental-strip-types scripts/i18n-validate.ts sv-se    # specific locales
 *   yarn i18n:validate sv-se                                          # via npm script
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type Leaf = [string, Json];

const HERE = dirname(fileURLToPath(import.meta.url));
const LANG_DIR = join(HERE, '..', 'src', 'locale', 'languages');
const PRIMARY = 'en-us';

const raw = (code: string): string =>
  readFileSync(join(LANG_DIR, `${code}.json`), 'utf8');
const read = (code: string): Record<string, Json> => JSON.parse(raw(code));

const flatten = (obj: Record<string, Json>, prefix = ''): Leaf[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? flatten(v as Record<string, Json>, `${prefix}${k}.`)
      : [[`${prefix}${k}`, v] as Leaf]
  );

// Match the full body of any `{{ interpolation }}` — including i18next format /
// plural specifiers like `{{count, number}}` — plus numbered <0></0> Trans tags.
const TOKEN_RE = /{{[^}]+}}|<\/?\d+>/g;
const tokens = (s: unknown): string[] => (String(s).match(TOKEN_RE) ?? []).sort();
const sameTokens = (a: unknown, b: unknown): boolean => {
  const x = tokens(a);
  const y = tokens(b);
  return x.length === y.length && x.every((t, i) => t === y[i]);
};

const primaryFlat = flatten(read(PRIMARY));
const primaryKeys = primaryFlat.map(([k]) => k);
const primaryKeySet = new Set(primaryKeys);
const primaryMap = new Map<string, Json>(primaryFlat);

const argLocales = process.argv.slice(2).map((a) => a.replace(/\.json$/, ''));
const targets = argLocales.length
  ? argLocales
  : readdirSync(LANG_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''))
      .filter((c) => c !== PRIMARY);

let failed = false;

for (const code of targets) {
  const errors: string[] = [];
  let text: string;
  let obj: Record<string, Json>;
  try {
    text = raw(code);
    obj = JSON.parse(text) as Record<string, Json>;
  } catch (err) {
    failed = true;
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`✗ ${code}: could not read or parse locale file — ${reason}`);
    continue;
  }
  const flat = flatten(obj);
  const keys = flat.map(([k]) => k);
  const keySet = new Set(keys);

  if (keys.join('|') !== primaryKeys.join('|')) {
    const missing = primaryKeys.filter((k) => !keySet.has(k));
    const extra = keys.filter((k) => !primaryKeySet.has(k));
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
