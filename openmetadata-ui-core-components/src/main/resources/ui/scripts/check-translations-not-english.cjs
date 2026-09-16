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

// Gate 4: every non-en-us value must actually be translated.
// Fails if a non-en-us language file has any value equal to the corresponding
// en-us value. This catches keys that were auto-inserted by `yarn i18n` and
// never translated (which is a reviewable defect per the i18n rule — shipping
// English text under a non-English locale key silently degrades UX).
//
// Some strings SHOULD stay in English (product names, widely-borrowed acronyms
// like "AI", "SQL", "OpenMetadata"). Those go in translation-allowlist.json.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LANGS_DIR = path.join(ROOT, 'src', 'locale', 'languages');
const ALLOWLIST_PATH = path.join(ROOT, 'scripts', 'translation-allowlist.json');
const PRIMARY = 'en-us.json';

function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, full, out);
    } else {
      out[full] = v;
    }
  }
}

const primary = JSON.parse(fs.readFileSync(path.join(LANGS_DIR, PRIMARY), 'utf8'));
const primaryFlat = {};
flatten(primary, '', primaryFlat);

// Allowlist is per-language-per-key. Legitimate case: French "Page" and
// "Pagination" are loanwords, so the French value equalling the English value
// is not a translation failure. Structure:
//   { "fr-fr": ["label.page", "label.pagination"], "nl-nl": ["label.records"] }
const rawAllowlist = fs.existsSync(ALLOWLIST_PATH)
  ? JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'))
  : {};
const allowlist = {};
for (const [lang, keys] of Object.entries(rawAllowlist)) {
  allowlist[lang] = new Set(keys);
}

const langFiles = fs
  .readdirSync(LANGS_DIR)
  .filter((f) => f.endsWith('.json') && f !== PRIMARY);

const failures = [];

for (const file of langFiles) {
  const langCode = file.replace(/\.json$/, '');
  const langAllowed = allowlist[langCode] || new Set();
  const flat = {};
  flatten(JSON.parse(fs.readFileSync(path.join(LANGS_DIR, file), 'utf8')), '', flat);

  for (const [key, primaryValue] of Object.entries(primaryFlat)) {
    if (langAllowed.has(key)) continue;
    const langValue = flat[key];
    if (langValue === primaryValue) {
      failures.push({ lang: langCode, key, value: primaryValue });
    }
  }
}

if (failures.length === 0) {
  const total = langFiles.length * Object.keys(primaryFlat).length;
  const allowlisted = Object.values(allowlist).reduce(
    (sum, s) => sum + s.size,
    0
  );
  const checked = total - allowlisted;
  console.log(
    `OK: ${checked} translations across ${langFiles.length} language files, none equal to en-us (${allowlisted} allowlisted)`
  );
  process.exit(0);
}

console.error(
  `ERROR: ${failures.length} untranslated key(s) — values are identical to en-us:\n`
);
const byLang = failures.reduce((acc, f) => {
  (acc[f.lang] = acc[f.lang] || []).push(f);
  return acc;
}, {});
for (const [lang, items] of Object.entries(byLang).sort()) {
  console.error(`  ${lang}.json (${items.length}):`);
  for (const { key, value } of items) {
    console.error(`    ${key} = ${JSON.stringify(value)}`);
  }
}
console.error(
  `\nFix by translating the values above in each language file.`
);
console.error(
  `If a key SHOULD remain English for a specific language (loanword, product`
);
console.error(
  `name, borrowed acronym), add it to scripts/translation-allowlist.json:`
);
console.error(`  { "fr-fr": ["label.page", "label.pagination"], ... }`);
process.exit(1);
