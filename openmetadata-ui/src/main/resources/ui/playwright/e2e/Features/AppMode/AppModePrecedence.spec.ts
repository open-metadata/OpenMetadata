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

/**
 * Rung-by-rung coverage for the unified AppMode precedence chain defined
 * in `useAppMode.ts::resolveEffectiveAppMode` + the session/hint guards in
 * `useResolvedAppMode.ts`. Precedence (top wins):
 *
 *   1. Session tuple (manual in-tab switch) — sessionStorage.omAppMode
 *   2. Fresh cross-tab hint — localStorage.omAppModeHint
 *   3. User pref (server "remember") — user_preferences.appMode
 *   4. Persona                                — docStore personaPreferences[]
 *   5. Tenant default                         — appConfiguration.defaultAppMode
 *   6. DEFAULT_APP_MODE (Classic)             — hardcoded constant
 *
 * Ported from `collate-ui`'s `AppMode/AppModePrecedence.spec.ts`, which
 * covered all six rungs because AskCollate registers `'ai'` in
 * `useAppRoutesRegistry`, letting the resolver actually land there. Stock
 * OM registers nothing beyond the default, and `useResolvedAppMode`
 * deliberately refuses to write a non-default candidate that isn't
 * registered (the "install gate" — see its doc comment). Any rung whose
 * expected WINNER is `'ai'` can therefore never resolve in stock OM
 * regardless of correctness, so only the rungs whose winner is `'default'`
 * looked portable without a registered second mode:
 *
 *   - Rung 3 vs 4: a user pref of `'classic'` beats a persona of `'AI'` —
 *     `resolveEffectiveAppMode` picks `userPref` unconditionally over
 *     `personaMode`, before the install gate is even consulted.
 *   - Rung 6 alone: nothing set anywhere resolves to `DEFAULT_APP_MODE`.
 *
 * Round 1 of this port asserted `assertAppMode(page, 'default')` for both.
 * Fix round 1 caught that the Rung-3-vs-4 case is a **false positive**:
 * `'classic'` is exactly as unregistered in stock OM's
 * `useAppRoutesRegistry` as `'ai'` is (only the literal string
 * `DEFAULT_APP_MODE` — `'default'` — is exempt from the install gate). So
 * the resolver's install gate refuses to write `'classic'` for the exact
 * same reason it would refuse `'ai'`, and the tab's session tuple stays
 * empty — indistinguishable, via `assertAppMode`, from Rung 6's "nothing
 * set anywhere" case. The test was passing without ever proving rung 3
 * beat rung 4; it would have passed identically if `resolveEffectiveAppMode`
 * had been broken. That test is now `test.skip(...)`'d below rather than
 * kept as a misleading pass — see the TODO comment on it for what unskips
 * it.
 *
 * Rung 6 alone is genuine, unaffected coverage: it doesn't depend on any
 * mode being registered, so it stays as a real, passing assertion.
 *
 * The original's rung-4-vs-5 ("persona beats tenant default"),
 * rung-5-vs-6 ("tenant default beats the constant"), and rung-1
 * regression ("session tuple survives a persona flip") cases all expect
 * `'ai'` to win and require actually landing in AI mode first — they stay
 * Collate-only. See `task-6-report.md`.
 */

import { APIRequestContext, expect, Page, test } from '@playwright/test';
import { PersonaClass } from '../../../support/persona/PersonaClass';
import { UserClass } from '../../../support/user/UserClass';
import { withAppConfigLock } from '../../../utils/appConfigMutex';
import { AppModeExpectation, assertAppMode } from '../../../utils/appMode';
import { createNewPage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

// ─── Helpers ────────────────────────────────────────────────────────────────

type DefaultAppMode = 'ai' | 'classic' | null;

const setAppDefaultMode = async (
  apiContext: APIRequestContext,
  defaultAppMode: DefaultAppMode
): Promise<void> => {
  await apiContext.put('/api/v1/system/settings', {
    data: {
      config_type: 'appConfiguration',
      config_value: { defaultAppMode },
    },
  });
};

const setUserAppModePreference = async (
  apiContext: APIRequestContext,
  userId: string,
  value: 'ai' | 'classic'
): Promise<void> => {
  const response = await apiContext.put(
    `/api/v1/users/${userId}/preferences/appMode`,
    { data: { type: 'appMode', config: { value } } }
  );
  expect(response.ok()).toBeTruthy();
};

type PersonaWithAppMode = {
  persona: PersonaClass;
  docId: string;
};

/**
 * Creates a persona + its docStore `UICustomization` doc with a single
 * `personaPreferences` entry forcing `appMode`. Mirrors what the admin
 * persona editor writes (see `SettingsAppModePage.tsx`'s save handler).
 */
const createPersonaWithAppMode = async (
  apiContext: APIRequestContext,
  appMode: 'AI' | 'classic'
): Promise<PersonaWithAppMode> => {
  const persona = new PersonaClass();
  await persona.create(apiContext);

  const personaFqn =
    persona.responseData.fullyQualifiedName ?? persona.responseData.name;
  const response = await apiContext.post('/api/v1/docStore', {
    data: {
      name: `${persona.responseData.name}-persona.${personaFqn}`,
      fullyQualifiedName: `persona.${personaFqn}`,
      entityType: 'Page',
      data: {
        pages: [],
        navigation: null,
        personaPreferences: [
          {
            personaId: persona.responseData.id,
            personaName: persona.responseData.name,
            appMode,
          },
        ],
      },
    },
  });
  expect(response.ok()).toBeTruthy();
  const doc = await response.json();

  return { persona, docId: doc.id };
};

const deletePersonaWithAppMode = async (
  apiContext: APIRequestContext,
  { persona, docId }: PersonaWithAppMode
): Promise<void> => {
  await apiContext
    .delete(`/api/v1/docStore/${docId}?hardDelete=true`)
    .catch(() => undefined);
  await persona.delete(apiContext).catch(() => undefined);
};

const assignDefaultPersona = async (
  apiContext: APIRequestContext,
  userId: string,
  persona: PersonaClass
): Promise<void> => {
  const ref = {
    id: persona.responseData.id,
    type: 'persona',
    name: persona.responseData.name,
  };
  const response = await apiContext.patch(`/api/v1/users/${userId}`, {
    data: [
      { op: 'add', path: '/personas', value: [ref] },
      { op: 'add', path: '/defaultPersona', value: ref },
    ],
    headers: { 'Content-Type': 'application/json-patch+json' },
  });
  expect(response.ok()).toBeTruthy();
};

/**
 * `assertAppMode` reads the session tuple synchronously, but the resolver
 * effect that writes it depends on async work settling first (persona doc
 * fetch, applications fetch, `registrySettled` tick). Retry instead of
 * asserting once immediately after login.
 */
const waitForAppMode = async (page: Page, expected: AppModeExpectation) => {
  await expect(async () => {
    await assertAppMode(page, expected);
  }).toPass({ timeout: 15_000 });
};

// Serial mode — every test here mutates one or more of {tenant default,
// user pref, persona} for a fresh user; running in parallel adds zero
// coverage and multiplies flakes.
test.describe.configure({ mode: 'serial' });

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('AppMode — unified precedence', () => {
  test.afterAll(
    'Restore the tenant app-mode default to null',
    async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await setAppDefaultMode(apiContext, null);
      await afterAction();
    }
  );

  // ── Rung 3 vs 4: user pref beats persona ────────────────────────────────
  test('Rung 3 (user pref) beats rung 4 (persona) — user has remembered Classic, persona says AI', async ({
    browser,
  }) => {
    // TODO: unskip when a route is registered for a second mode (currently
    // every mode but the default is disabled in stock OSS — see the
    // install gate in `useResolvedAppMode.ts`, "Install gate" comment).
    // `'classic'` is refused by that gate exactly like `'ai'` would be, so
    // asserting `assertAppMode(page, 'default')` here can't distinguish
    // "rung 3 beat rung 4" from "the resolver wrote nothing at all" — see
    // the file header for the full false-positive analysis from fix round
    // 1. Registering a lightweight test-only mode (or unskipping once a
    // real second mode ships) is required before this rung is provable
    // against the *rendered* state; see task-6-report.md for the
    // follow-up recommendation.
    test.skip(
      true,
      'False positive in stock OM — see TODO above and task-6-report.md.'
    );
    // Persona create + user assign + user pref PUT + fresh context login —
    // bump for CI headroom.
    test.setTimeout(240_000);
    const { apiContext, afterAction } = await createNewPage(browser);
    const user = new UserClass();
    const personaWithAppMode = await createPersonaWithAppMode(apiContext, 'AI');
    try {
      await user.create(apiContext);
      await assignDefaultPersona(
        apiContext,
        user.responseData.id,
        personaWithAppMode.persona
      );
      await setUserAppModePreference(
        apiContext,
        user.responseData.id,
        'classic'
      );

      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await user.login(page);
        await waitForAllLoadersToDisappear(page);
        // 'default' is the runtime name for Classic.
        await waitForAppMode(page, 'default');
      } finally {
        await context.close();
      }
    } finally {
      await user.delete(apiContext).catch(() => undefined);
      await deletePersonaWithAppMode(apiContext, personaWithAppMode);
      await afterAction();
    }
  });

  // ── Rung 6 alone: nothing set anywhere ──────────────────────────────────
  test('All rungs empty → DEFAULT_APP_MODE (Classic) wins', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const { apiContext, afterAction } = await createNewPage(browser);
    const user = new UserClass();
    try {
      await user.create(apiContext);
      await withAppConfigLock(async () => {
        await setAppDefaultMode(apiContext, null);
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
          await user.login(page);
          await waitForAllLoadersToDisappear(page);
          await waitForAppMode(page, 'default');
        } finally {
          await context.close();
        }
      });
    } finally {
      await user.delete(apiContext).catch(() => undefined);
      await afterAction();
    }
  });
});
