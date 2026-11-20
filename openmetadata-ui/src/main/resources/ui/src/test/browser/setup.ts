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
import { cleanup } from 'vitest-browser-react';
import { usePersistentStorage } from '../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useAppModeStore } from '../../hooks/useAppMode';
import { useDomainStore } from '../../hooks/useDomainStore';
import { useSearchStore } from '../../hooks/useSearchStore';
import '../../styles/globalStyles';
import i18next from '../../utils/i18next/LocalUtil';
import { worker } from './msw';

initCoreI18n(i18next);

const runnerUrl = globalThis.location.href;
const unhandledApiCalls: string[] = [];
// App-wide stores pages write (signed-in user, domain, search, app mode).
// Files run in one page (`isolate: false`), so reset them between tests;
// otherwise a test inherits e.g. the previous test's currentUser.
const stores = [
  useApplicationStore,
  usePersistentStorage,
  useDomainStore,
  useSearchStore,
  useAppModeStore,
];

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

afterEach(async () => {
  // vitest-browser-react only unmounts in the next test's beforeEach. Unmount
  // first so the page can't refetch against reset handlers or the reset URL.
  await cleanup();
  // Every API call a page makes must be mocked on purpose, so a test can never
  // pass because a request silently failed.
  const unhandled = [...new Set(unhandledApiCalls.splice(0))];
  worker.resetHandlers();
  globalThis.history.replaceState(null, '', runnerUrl);
  localStorage.clear();
  stores.forEach((store) => store.setState(store.getInitialState(), true));

  expect(unhandled, 'API calls without an MSW handler').toEqual([]);
});

afterAll(() => worker.stop());
