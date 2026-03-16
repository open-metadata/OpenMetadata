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
import { chromium, request } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
const page = await context.newPage();
await page.goto('http://localhost:8585/my-data');
await page.waitForLoadState('networkidle');
const token = await page.evaluate(async () => {
  const DB_NAME = 'AppDataStore';
  const STORE_NAME = 'keyValueStore';
  const APP_STATE_KEY = 'app_state';
  return await new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(APP_STATE_KEY);
      getReq.onsuccess = () => {
        try {
          const state = JSON.parse(getReq.result || '{}');
          resolve(state.primary || '');
        } catch {
          resolve('');
        }
      };
      getReq.onerror = () => resolve('');
    };
    req.onerror = () => resolve('');
    req.onupgradeneeded = () => resolve('');
  });
});
console.log('token?', token ? token.slice(0,40) + '...' : '<empty>');
const api = await request.newContext({
  baseURL: 'http://localhost:8585',
  extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  timeout: 90000,
});
for (const path of [
  '/api/v1/apps/name/SearchIndexingApplication?fields=owners,pipelines&include=all',
  '/api/v1/apps/name/SearchIndexingApplication/status?offset=0&limit=5',
  '/api/v1/apps/name/SearchIndexingApplication/runs/latest',
  '/api/v1/apps/name/SearchIndexingApplication/logs',
]) {
  const res = await api.get(path);
  const text = await res.text();
  console.log('\n===', path, res.status(), '===');
  console.log(text.slice(0, 3000));
}
await api.dispose();
await browser.close();
