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
import { Page } from '@playwright/test';

// Mangles the currently-stored access token's `exp` claim to a past value
// so the AuthCoordinator's cold-load path treats it as expired and fires a
// silent refresh. Tokens live in the Service Worker's IndexedDB (see
// `SwTokenStorageUtils.ts` — `app_state → primary`), NOT in
// `localStorage['oidcIdToken']`. Every fixture used to write to localStorage,
// which the SPA doesn't read — so the mangled token never reached the
// coordinator and scenarios 3 & 5 silently no-op'd instead of exercising
// the refresh chain. This helper messages the SW directly with the same
// protocol `sendMessageToServiceWorker` uses (see `SwMessenger.ts`).
export const forceTokenExpiry = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    const controller = navigator.serviceWorker?.controller;
    if (!controller) {
      return;
    }
    const ask = <T = unknown>(msg: Record<string, unknown>): Promise<T> =>
      new Promise((resolve, reject) => {
        const mc = new MessageChannel();
        const timer = setTimeout(() => reject(new Error('SW timeout')), 5000);
        mc.port1.onmessage = (e) => {
          clearTimeout(timer);
          if (e.data?.error) {
            reject(new Error(e.data.error));
          } else {
            resolve(e.data.result as T);
          }
        };
        controller.postMessage({ ...msg, requestId: `mangle_${Date.now()}` }, [
          mc.port2,
        ]);
      });
    const stateStr = await ask<string | null>({
      type: 'get',
      key: 'app_state',
    });
    if (!stateStr) {
      return;
    }
    const state = JSON.parse(stateStr) as { primary?: string };
    const token = state.primary;
    if (!token) {
      return;
    }
    const [header, , sig] = token.split('.');
    const payload = { exp: Math.floor(Date.now() / 1000) - 60 };
    const b64 = (obj: unknown): string =>
      btoa(JSON.stringify(obj))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    state.primary = `${header}.${b64(payload)}.${sig}`;
    await ask({
      type: 'set',
      key: 'app_state',
      value: JSON.stringify(state),
    });
  });
};
