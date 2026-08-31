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

import { expect, Page } from '@playwright/test';
import { getDefaultAdminAPIContext } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

// The mode lives in a per-tab `sessionStorage` tuple written by `writeAppMode`
// (see `src/hooks/useAppMode.ts`). Match its on-disk shape so a page-init seed
// is indistinguishable from an in-app write. `personaAppMode` is the
// persona-scoping snapshot the boot resolver uses to detect when the persona
// has something new to say; seeding it `null` matches the "no default persona"
// path most tests take.
const APP_MODE_SESSION_KEY = 'omAppMode';
// Cross-tab hint (localStorage, TTL'd) that lets a fresh tab inherit the mode
// from a sibling. Seed alongside the session tuple so the resolver's
// hint-adoption path sees a fresh entry, and a stale `default` hint from a
// prior run can't race the session tuple during boot.
const APP_MODE_HINT_STORAGE_KEY = 'omAppModeHint';

// Node-side dedupe so repeated helper calls on one Page don't stack identical
// init scripts.
const ENABLE_AI_MODE_REGISTERED = Symbol.for('pw.appMode.enableAiMode');
const DISABLE_AI_MODE_REGISTERED = Symbol.for('pw.appMode.disableAiMode');

const buildSessionTuple = (mode: string) =>
  JSON.stringify({ personaAppMode: null, mode });

/**
 * Splice an `appMode` entry into the boot-time
 * `GET /api/v1/users/{id}/preferences` response on THIS page's context so
 * `AuthProvider.hydrateAndResolveAppMode` reads `userPref = <mode>` at boot and
 * its `writeAppMode(resolveEffectiveAppMode(...))` call lands on the requested
 * mode without touching any server state. Scope is the single page — no
 * cross-test leakage. The interceptor forwards the real request and mutates the
 * response, so every other preference the server returns is preserved.
 */
const stubUserPreferencesAppMode = async (
  page: Page,
  mode: 'ai' | 'classic'
): Promise<void> => {
  const desired = { type: 'appMode', config: { value: mode } };
  await page.route(
    /\/api\/v1\/users\/[^/]+\/preferences(?:$|\?)/,
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();

        return;
      }
      const response = await route.fetch();
      const contentType = response.headers()['content-type'] ?? '';
      if (!contentType.includes('application/json')) {
        await route.fulfill({ response });

        return;
      }
      let body: Record<string, unknown> = {};
      try {
        body = (await response.json()) as Record<string, unknown>;
      } catch {
        await route.fulfill({ response });

        return;
      }
      const rawPrefs = body.preferences;
      const prefs: Array<Record<string, unknown>> = Array.isArray(rawPrefs)
        ? [...(rawPrefs as Array<Record<string, unknown>>)]
        : [];
      const idx = prefs.findIndex(
        (p) => (p as { type?: string })?.type === 'appMode'
      );
      if (idx >= 0) {
        prefs[idx] = desired;
      } else {
        prefs.push(desired);
      }
      await route.fulfill({ response, json: { ...body, preferences: prefs } });
    }
  );
};

/**
 * Enter AI app mode the OSS-native way — no plugin/app install gate (OSS ships
 * the AI shell in-tree). Two halves are BOTH required: (1) seed the session
 * tuple + cross-tab hint so `useResolvedAppMode` sees AI, and (2) stub the
 * boot preferences GET, because `AuthProvider.hydrateAndResolveAppMode` runs
 * first and unconditionally overwrites the seeded tuple with
 * `resolveEffectiveAppMode(userPref, …)` — with no server preference that
 * resolves to Classic and the seed is lost. The stub makes the resolve land on
 * AI without a real PUT (which would leak into other tests).
 */
export const enableAiAppMode = async (page: Page): Promise<void> => {
  const pageWithFlag = page as Page & { [ENABLE_AI_MODE_REGISTERED]?: boolean };
  if (pageWithFlag[ENABLE_AI_MODE_REGISTERED]) {
    return;
  }
  pageWithFlag[ENABLE_AI_MODE_REGISTERED] = true;

  const persisted = buildSessionTuple('ai');
  await page.addInitScript(
    ([sessionKey, sessionValue, hintKey, hintMode]) => {
      if (!globalThis.sessionStorage.getItem('__pw_appmode_seeded')) {
        globalThis.sessionStorage.setItem(sessionKey, sessionValue);
        // Compute the hint timestamp in-page (at boot), not Node-side at
        // helper-call time: setup between this call and the first navigation
        // can exceed the resolver's TTL, and a Node-side timestamp would read
        // as stale on the first resolver run and drop AI mode.
        globalThis.localStorage.setItem(
          hintKey,
          JSON.stringify({ mode: hintMode, ts: Date.now() })
        );
        globalThis.sessionStorage.setItem('__pw_appmode_seeded', '1');
      }
    },
    [APP_MODE_SESSION_KEY, persisted, APP_MODE_HINT_STORAGE_KEY, 'ai']
  );

  await stubUserPreferencesAppMode(page, 'ai');
};

/**
 * Best-effort DELETE of the default admin's server-side `appMode` preference
 * (404 — nothing to remove — is fine). Node-side via `getDefaultAdminAPIContext`
 * because the auth token lives in IndexedDB and `disableAiAppMode` is usually
 * called before the first navigation, when an in-page `fetch()` has neither a
 * relative URL nor the token available.
 */
const clearServerAppModePreference = async (page: Page): Promise<void> => {
  const browser = page.context().browser();
  if (!browser) {
    return;
  }
  let afterAction: (() => Promise<void>) | undefined;
  try {
    const admin = await getDefaultAdminAPIContext(browser);
    afterAction = admin.afterAction;
    const me = await admin.apiContext.get('/api/v1/users/loggedInUser');
    if (!me.ok()) {
      return;
    }
    const { id } = (await me.json()) as { id?: string };
    if (!id) {
      return;
    }
    await admin.apiContext.delete(`/api/v1/users/${id}/preferences/appMode`);
  } catch {
    // Best-effort — never fail the test on cleanup.
  } finally {
    await afterAction?.();
  }
};

/**
 * Leave AI mode: clear the seeded session tuple + hint, strip the cached
 * `appMode` from the persisted `user-preferences-store` slice (the resolver
 * reads it as rung 4), best-effort DELETE the server preference, and remove the
 * preferences stub `enableAiAppMode` may have installed on this page.
 */
export const disableAiAppMode = async (page: Page): Promise<void> => {
  const pageWithFlag = page as Page & {
    [DISABLE_AI_MODE_REGISTERED]?: boolean;
  };
  if (pageWithFlag[DISABLE_AI_MODE_REGISTERED]) {
    return;
  }
  pageWithFlag[DISABLE_AI_MODE_REGISTERED] = true;

  await page.addInitScript(
    ([sessionKey, hintKey]) => {
      if (!globalThis.sessionStorage.getItem('__pw_appmode_cleared')) {
        globalThis.sessionStorage.removeItem(sessionKey);
        globalThis.localStorage.removeItem(hintKey);
        const rawPrefs = globalThis.localStorage.getItem(
          'user-preferences-store'
        );
        if (rawPrefs) {
          try {
            const parsed = JSON.parse(rawPrefs) as {
              state?: {
                preferences?: Record<
                  string,
                  Record<string, unknown> | undefined
                >;
              };
            };
            const users = parsed?.state?.preferences;
            if (users) {
              for (const user of Object.keys(users)) {
                const slice = users[user];
                if (slice && 'appMode' in slice) {
                  delete slice.appMode;
                }
              }
              globalThis.localStorage.setItem(
                'user-preferences-store',
                JSON.stringify(parsed)
              );
            }
          } catch {
            // A malformed persisted store is safer left alone than stomped.
          }
        }
        globalThis.sessionStorage.setItem('__pw_appmode_cleared', '1');
      }
    },
    [APP_MODE_SESSION_KEY, APP_MODE_HINT_STORAGE_KEY]
  );

  await clearServerAppModePreference(page);

  await page
    .unroute(/\/api\/v1\/users\/[^/]+\/preferences(?:$|\?)/)
    .catch(() => undefined);
};

/**
 * Context-local override of the tenant-wide `appConfiguration.defaultAppMode`
 * (rung 5 of the boot precedence chain). Intercepts the boot-time GET rather
 * than a real `PUT /api/v1/system/settings`: that row is global and a real
 * write is observable by every parallel spec. Install before the page's first
 * navigation; scope is the single page.
 */
export const stubTenantDefaultAppMode = async (
  page: Page,
  defaultAppMode: 'ai' | 'classic' | null
): Promise<void> => {
  await page.route(
    '**/api/v1/system/settings/appConfiguration',
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();

        return;
      }
      const response = await route.fetch();
      const contentType = response.headers()['content-type'] ?? '';
      if (!contentType.includes('application/json')) {
        await route.fulfill({ response });

        return;
      }
      let body: Record<string, unknown> = {};
      try {
        body = (await response.json()) as Record<string, unknown>;
      } catch {
        await route.fulfill({ response });

        return;
      }
      const configValue = (body.config_value ?? {}) as Record<string, unknown>;
      await route.fulfill({
        response,
        json: { ...body, config_value: { ...configValue, defaultAppMode } },
      });
    }
  );
};

const readPersistedMode = async (page: Page): Promise<string | null> =>
  page.evaluate((sessionKey) => {
    const raw = globalThis.sessionStorage.getItem(sessionKey);
    if (raw === null) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as { mode?: string };

      return parsed.mode ?? null;
    } catch {
      return null;
    }
  }, APP_MODE_SESSION_KEY);

export type AppModeExpectation = 'ai' | 'default';

export const assertAppMode = async (
  page: Page,
  expected: AppModeExpectation
): Promise<void> => {
  const mode = await readPersistedMode(page);
  // Zustand persist writes `'default'` on reset; the legacy "key absent"
  // (`null`) shape also means default. Treat them as equal.
  if (expected === 'default') {
    expect(mode === null || mode === 'default').toBe(true);
  } else {
    expect(mode).toBe(expected);
  }
};

/**
 * Switch to AI mode from Classic via the navbar profile-dropdown interface
 * toggle — the production control. Opens the dropdown, clicks "AI", and waits
 * for the AI shell to settle.
 */
export const switchToAiModeViaProfileToggle = async (
  page: Page
): Promise<void> => {
  await page.getByTestId('dropdown-profile').click();
  await page.getByTestId('interface-mode-option-ai').click();
  await waitForAllLoadersToDisappear(page);
};
