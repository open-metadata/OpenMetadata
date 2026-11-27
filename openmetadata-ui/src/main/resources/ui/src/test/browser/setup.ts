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
import { useExploreCache } from '../../hooks/useExploreCache';
import { useSearchStore } from '../../hooks/useSearchStore';
import '../../styles/globalStyles';
import i18next from '../../utils/i18next/LocalUtil';
import { recordImpact } from './impact';
import { worker } from './msw';
import { networkIdle } from './network';

initCoreI18n(i18next);

declare const __BROWSER_IMPACT__: boolean;
if (__BROWSER_IMPACT__) {
  recordImpact();
}

const runnerUrl = globalThis.location.href;
const unhandledApiCalls: string[] = [];
// App-wide stores pages write (signed-in user, domain, search, app mode).
// Files run in one page (`isolate: false`), so reset them between tests;
// otherwise a test inherits e.g. the previous test's currentUser.
const resetStores = () => {
  useApplicationStore.setState(useApplicationStore.getInitialState(), true);
  usePersistentStorage.setState(usePersistentStorage.getInitialState(), true);
  useDomainStore.setState(useDomainStore.getInitialState(), true);
  useSearchStore.setState(useSearchStore.getInitialState(), true);
  useAppModeStore.setState(useAppModeStore.getInitialState(), true);
};

beforeAll(async () => {
  await worker.start({
    quiet: true,
    onUnhandledRequest(request, print) {
      const { pathname, searchParams } = new URL(request.url);
      // Only API traffic must be mocked; Vite module/asset requests pass through.
      if (pathname.startsWith('/api/')) {
        // index/q identify which picker a stray search came from.
        const hint = ['index', 'q']
          .filter((key) => searchParams.has(key))
          .map((key) => `${key}=${searchParams.get(key)}`)
          .join('&');
        unhandledApiCalls.push(
          `${request.method} ${pathname}${hint ? `?${hint}` : ''}`
        );
        print.error();
      }
    },
  });
});

afterEach(async () => {
  // vitest-browser-react only unmounts in the next test's beforeEach. Unmount
  // first so the page can't refetch against reset handlers or the reset URL.
  await cleanup();
  // A mutation's onSettled refetch can start a moment after the last
  // assertion: wait until requests stop, so it finishes against this test's
  // handlers rather than being reported as unhandled in the next one.
  try {
    await networkIdle();
  } finally {
    // Reset even when a request never settled, so one hung request fails only
    // its own test instead of leaking handlers, URL and storage into the next.
    // Every API call a page makes must be mocked on purpose, so a test can
    // never pass because a request silently failed.
    const unhandled = [...new Set(unhandledApiCalls.splice(0))];
    worker.resetHandlers();
    globalThis.history.replaceState(null, '', runnerUrl);
    localStorage.clear();
    resetStores();
    // Explore keeps search results for 30 s across mounts (as across a user's
    // tab switches); a later test would render this test's results first.
    useExploreCache.getState().clearCache();

    expect(unhandled, 'API calls without an MSW handler').toEqual([]);
  }
});

afterAll(() => worker.stop());
