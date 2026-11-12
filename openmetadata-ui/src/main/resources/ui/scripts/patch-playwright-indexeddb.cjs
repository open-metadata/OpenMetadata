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

// CommonJS on purpose: the postinstall CLI loads this through plain `node`,
// the Playwright globalSetup loads it through Playwright's TypeScript
// transform, and that transform cannot evaluate `import.meta`.

const { readFileSync, writeFileSync, renameSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { runInNewContext } = require('node:vm');

const MARKER = 'OpenMetadata: wait for the IndexedDB restore transaction';
const PATCHED_VERSION = '1.65.0';

// Playwright resolves restore after individual requests succeed, before their
// transaction commits. Closing its temporary page can abort that write and lose
// the auth record. Keep failures fatal and await commit exactly once.
// Revalidate this correction when upgrading: 1.65 still resolves an aborted
// transaction in the browser regression test.
function patchStorageSource(source) {
  if (source.includes(MARKER)) return source;
  const start = source.indexOf('  async _restoreDB(dbInfo) {');
  const end = source.indexOf('\n  async ', start + 1);
  if (start < 0 || end < 0)
    throw new Error('Unrecognized Playwright IndexedDB restore implementation');
  const original = source.slice(start, end);
  const transaction =
    '      const transaction = db.transaction(db.objectStoreNames, "readwrite");';
  const writes = '      await Promise.all(dbInfo.stores.map(async (store) => {';
  const finish = '      }));\n    } finally {';
  for (const anchor of [transaction, writes, finish]) {
    if (original.split(anchor).length !== 2)
      throw new Error(
        'Playwright storage fix no longer matches; validate the new version before proceeding'
      );
  }
  const updated = original
    .replace(
      transaction,
      transaction +
        `
      // ${MARKER}.
      const committed = new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error || new Error("IndexedDB restore aborted"));
        transaction.onerror = () => reject(transaction.error);
      });`
    )
    .replace(
      writes,
      '      await Promise.all([committed, Promise.all(dbInfo.stores.map(async (store) => {'
    )
    .replace(finish, '      }))]);\n    } finally {');

  return source.slice(0, start) + updated + source.slice(end);
}

// Since 1.60 the storage script is an esbuild string literal inside
// lib/coreBundle.js instead of its own lib/generated module. esbuild emits it
// single-quoted; patchPlaywright writes it back through JSON.stringify, which
// double-quotes it, so both quote styles must match for a second run to find it.
const STORAGE_LITERAL =
  /("packages\/playwright-core\/src\/generated\/storageScriptSource\.ts"\(\) \{\n\s*"use strict";\n\s*source\d* = )('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")(;)/;

function readStorageScript(
  packageRoot = dirname(require.resolve('playwright-core/package.json'))
) {
  const { version } = JSON.parse(
    readFileSync(join(packageRoot, 'package.json'), 'utf8')
  );
  if (version !== PATCHED_VERSION) {
    throw new Error(
      `Playwright ${version}: validate IndexedDB transaction completion before removing or updating the ${PATCHED_VERSION} correction`
    );
  }
  const file = join(packageRoot, 'lib/coreBundle.js');
  const contents = readFileSync(file, 'utf8');
  const match = contents.match(STORAGE_LITERAL);
  if (!match) throw new Error('Playwright storage source is missing');
  // The regex admits only a single string literal, so evaluating it in an
  // empty context cannot run code; it just decodes the escapes.
  const source = runInNewContext(match[2], Object.create(null));

  return { file, contents, match, source };
}

// Applies the correction to the installed playwright-core. Returns the outcome
// so callers can distinguish "already correct" from "could not write".
function patchPlaywright(packageRoot) {
  const { file, contents, match, source } = readStorageScript(packageRoot);
  const corrected = patchStorageSource(source);
  if (corrected === source) return 'already-corrected';
  const output = contents.replace(
    match[0],
    () => `${match[1]}${JSON.stringify(corrected)}${match[3]}`
  );
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, output);
    renameSync(temporary, file);
  } catch (error) {
    // Some lanes mount node_modules read-only. Those lanes never restore
    // application auth state, so report the skip instead of failing the run --
    // a version mismatch, which is the failure worth shouting about, has
    // already thrown above.
    if (['EROFS', 'EACCES', 'EPERM'].includes(error.code)) {
      return 'read-only';
    }
    throw error;
  }

  return 'corrected';
}

if (require.main === module) {
  process.stdout.write(
    `playwright-core storage script: ${patchPlaywright(process.argv[2])}\n`
  );
}

module.exports = { MARKER, patchStorageSource, patchPlaywright, readStorageScript };
