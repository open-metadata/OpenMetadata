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
import { expect, test } from '@playwright/test';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { dirname, join } from 'path';

const stateFor = (origin: string) => ({
  cookies: [],
  origins: [
    {
      origin,
      localStorage: [],
      indexedDB: [
        {
          name: 'AppDataStore',
          version: 1,
          stores: [
            {
              name: 'keyValueStore',
              autoIncrement: false,
              indexes: [],
              records: [
                {
                  key: 'app_state',
                  value: JSON.stringify({ primary: 'test-token' }),
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

// Correct the source here rather than reading whatever is on disk: the
// browser-helper lane runs with node_modules mounted read-only, so the
// installed copy may or may not carry the correction. Applying it in-process
// keeps this a test of the correction itself, not of the install.
const {
  patchStorageSource,
} = require('../../scripts/patch-playwright-indexeddb.cjs');
const installedStorageSource: string = require(join(
  dirname(require.resolve('playwright-core/package.json')),
  'lib/generated/storageScriptSource.js'
)).source;
const storageSource: string = patchStorageSource(installedStorageSource);

const storageTest = test.extend<{ origin: string }>({
  // eslint-disable-next-line no-empty-pattern -- The HTTP server fixture has no browser dependencies.
  origin: async ({}, use) => {
    const server = createServer((_request, response) =>
      response.end('<html></html>')
    );
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    try {
      await use(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  },
});

storageTest(
  'restored auth is committed before the temporary storage page closes',
  async ({ browser, origin }) => {
    for (let index = 0; index < 20; index++) {
      const context = await browser.newContext({
        storageState: stateFor(origin),
      });
      try {
        const page = await context.newPage();
        await page.goto(origin, { waitUntil: 'domcontentloaded' });
        const saved = await page.evaluate(
          () =>
            new Promise<string>((resolve, reject) => {
              const open = indexedDB.open('AppDataStore');
              open.onerror = () => reject(open.error);
              open.onsuccess = () => {
                const db = open.result;
                const transaction = db.transaction('keyValueStore', 'readonly');
                const read = transaction
                  .objectStore('keyValueStore')
                  .get('app_state');
                read.onerror = () => reject(read.error);
                read.onsuccess = () => resolve(read.result);
                transaction.oncomplete = () => db.close();
              };
            })
        );
        expect(saved).toBe(JSON.stringify({ primary: 'test-token' }));
      } finally {
        await context.close();
      }
    }
  }
);

storageTest(
  'an aborted IndexedDB restore rejects instead of returning incomplete auth',
  async ({ page, origin }) => {
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({
      content: `(function() { const module = {exports:{}}; ${storageSource}; window.__storageScriptForTest = module.exports.StorageScript(); })();`,
    });
    const result = await page.evaluate(async (state) => {
      const original = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (...args) {
        const request = original.apply(this, args);
        request.addEventListener('success', () => this.transaction.abort(), {
          once: true,
        });
        return request;
      };
      try {
        const testWindow: Window & {
          __storageScriptForTest?: new (isFirefox: boolean) => {
            restore: (state: unknown) => Promise<void>;
          };
        } = window;
        const StorageScript = testWindow.__storageScriptForTest;
        if (!StorageScript) throw new Error('Storage script was not loaded');
        await new StorageScript(false).restore(state);
        return 'resolved';
      } catch (error) {
        return (error as Error).message;
      } finally {
        IDBObjectStore.prototype.add = original;
      }
    }, stateFor(origin).origins[0]);
    expect(result).toContain('IndexedDB restore aborted');
  }
);

storageTest(
  'invalid IndexedDB records remain a setup failure',
  async ({ browser, origin }) => {
    const state = stateFor(origin);
    const records = state.origins[0].indexedDB[0].stores[0].records;
    records.push(records[0]);
    await expect(browser.newContext({ storageState: state })).rejects.toThrow(
      'Unable to restore IndexedDB'
    );
  }
);
