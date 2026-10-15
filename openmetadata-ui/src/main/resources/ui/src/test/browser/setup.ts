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
import { initCoreI18n } from '@openmetadata/ui-core-components';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import '../../styles/globalStyles';
import i18next from '../../utils/i18next/LocalUtil';
import { worker } from './msw';

initCoreI18n(i18next);

const runnerUrl = globalThis.location.href;
const unhandledApiCalls: string[] = [];

beforeAll(async () => {
  await worker.start({
    quiet: true,
    onUnhandledRequest(request, print) {
      const { pathname } = new URL(request.url);
      // Only API traffic must be mocked; Vite module/asset requests pass through.
      if (pathname.startsWith('/api/')) {
        unhandledApiCalls.push(`${request.method} ${pathname}`);
        print.error();
      }
    },
  });
});

afterEach(() => {
  // Every API call a page makes must be mocked on purpose, so a test can never
  // pass because a request silently failed.
  const unhandled = [...new Set(unhandledApiCalls.splice(0))];
  worker.resetHandlers();
  globalThis.history.replaceState(null, '', runnerUrl);
  localStorage.clear();

  expect(unhandled, 'API calls without an MSW handler').toEqual([]);
});

afterAll(() => worker.stop());
