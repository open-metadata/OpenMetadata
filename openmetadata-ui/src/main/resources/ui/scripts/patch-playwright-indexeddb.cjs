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
const { dirname, join, resolve } = require('node:path');

const MARKER = 'OpenMetadata: wait for the IndexedDB restore transaction';

// Playwright 1.57 resolves restore after individual requests succeed, before
// their transaction commits. Closing its temporary page can abort that write
// and lose the auth record. Keep failures fatal and await commit exactly once.
// Revalidate this correction when upgrading: even 1.63 resolves an aborted
// transaction in the browser regression test.
function patchStorageSource(source) {
  if (source.includes(MARKER)) return source;
  const start = source.indexOf('  async _restoreDB(dbInfo) {');
  const end = source.indexOf('  async restore(originState)', start);
  if (start < 0 || end < 0)
    throw new Error('Unrecognized Playwright IndexedDB restore implementation');
  const original = source.slice(start, end);
  const begin = '    if (db.objectStoreNames.length === 0)';
  const transaction =
    '    const transaction = db.transaction(db.objectStoreNames, "readwrite");';
  const writes = '    await Promise.all(dbInfo.stores.map(async (store) => {';
  const finish = '    }));\n  }\n';
  for (const anchor of [begin, transaction, writes, finish]) {
    if (original.split(anchor).length !== 2)
      throw new Error(
        'Playwright storage fix no longer matches; validate the new version before proceeding'
      );
  }
  const updated = original
    .replace(begin, '    try {\n' + begin)
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
      '    await Promise.all([committed, Promise.all(dbInfo.stores.map(async (store) => {'
    )
    .replace(
      finish,
      '    }))]);\n    } finally {\n      db.close();\n    }\n  }\n'
    );

  return source.slice(0, start) + updated + source.slice(end);
}

// Applies the correction to the installed playwright-core. Returns the outcome
// so callers can distinguish "already correct" from "could not write".
function patchPlaywright(
  packageRoot = dirname(require.resolve('playwright-core/package.json'))
) {
  const { version } = JSON.parse(
    readFileSync(join(packageRoot, 'package.json'), 'utf8')
  );
  if (version !== '1.57.0') {
    throw new Error(
      `Playwright ${version}: validate IndexedDB transaction completion before removing or updating the 1.57.0 correction`
    );
  }
  const file = resolve(packageRoot, 'lib/generated/storageScriptSource.js');
  const contents = readFileSync(file, 'utf8');
  const sourceLine = contents.match(/^const source = (.+);$/m);
  if (!sourceLine) throw new Error('Playwright storage source is missing');
  // The pinned package contains a JavaScript string literal; load its existing
  // export instead of parsing or evaluating a repository-provided expression.
  delete require.cache[require.resolve(file)];
  const { source } = require(file);
  const corrected = patchStorageSource(source);
  if (corrected === source) return 'already-corrected';
  const output = contents.replace(
    sourceLine[0],
    () => `const source = ${JSON.stringify(corrected)};`
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

module.exports = { MARKER, patchStorageSource, patchPlaywright };
