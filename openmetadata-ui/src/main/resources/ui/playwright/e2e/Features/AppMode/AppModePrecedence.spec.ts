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
 * Rung-by-rung end-to-end coverage for the unified AppMode precedence chain
 * defined in `src/hooks/useAppMode.ts::resolveEffectiveAppMode` + the
 * session/hint guards in `useResolvedAppMode.ts`. Precedence (top wins):
 *
 *   1. Session tuple (manual in-tab switch) — sessionStorage.omAppMode
 *   2. Fresh cross-tab hint — localStorage.omAppModeHint
 *   3. User pref (server "remember") — user_preferences.appMode
 *   4. Persona                                — docStore personaPreferences[]
 *   5. Tenant default                         — appConfiguration.defaultAppMode
 *   6. DEFAULT_APP_MODE (Classic)             — hardcoded constant
 *
 * Each test isolates ONE transition and asserts the higher rung wins. Rungs 1 &
 * 2 are covered by `AppModeResolver.spec.ts`; this file focuses on rungs 3 → 6
 * (the boot-resolver chain) plus a rung-1 regression guard for the
 * persona-changed-mid-session case.
 */

import { APIRequestContext, Browser, Page } from '@playwright/test';
import { expect, test } from '../../../support/fixtures/base';
import { PersonaClass } from '../../../support/persona/PersonaClass';
import { UserClass } from '../../../support/user/UserClass';
import { createNewPage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  AppModeExpectation,
  assertAppMode,
  stubTenantDefaultAppMode,
  switchToAiModeViaProfileToggle,
} from '../../Utils/appMode';

type DefaultAppMode = 'ai' | 'classic' | null;

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
 * `personaPreferences` entry forcing `appMode`. Mirrors what the admin persona
 * editor writes (see `CustomizablePage.tsx::handleAppModeSave`).
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

/**
 * Run `action` in a fresh context whose boot-time `appConfiguration` GET is
 * stubbed to report `desired` as the tenant-wide default. Stubbing rather than
 * a real `PUT /api/v1/system/settings` keeps the global row untouched, so a
 * parallel spec can't observe a transient `'ai'` and boot into the AI shell.
 */
const runWithTenantDefault = async (params: {
  browser: Browser;
  desired: DefaultAppMode;
  action: (page: Page) => Promise<void>;
}): Promise<void> => {
  const { browser, desired, action } = params;
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    // Must precede the first navigation — the resolver reads this on boot.
    await stubTenantDefaultAppMode(page, desired);
    await action(page);
  } finally {
    await context.close();
  }
};

// Serial mode — every test here mutates one or more of {tenant default, user
// pref, persona} for a fresh user and asserts the resolver's boot-time write.
// Even with fresh users, running these in parallel adds zero coverage and
// multiplies flakes.
test.describe.configure({ mode: 'serial' });

test.describe('AppMode — unified precedence', { tag: ['@Platform'] }, () => {
  test('Rung 3 (user pref) beats rung 4 (persona) — user has remembered Classic, persona says AI', async ({
    browser,
  }) => {
    // Persona create + user assign + user pref PUT + fresh context login +
    // persona-doc resolve — bump for CI headroom.
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

  test('Rung 4 (persona) beats rung 5 (tenant default) — persona says AI, tenant default Classic, no user pref', async ({
    browser,
  }) => {
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
      await runWithTenantDefault({
        browser,
        desired: 'classic',
        action: async (page) => {
          await user.login(page);
          await waitForAllLoadersToDisappear(page);
          await waitForAppMode(page, 'ai');
        },
      });
    } finally {
      await user.delete(apiContext).catch(() => undefined);
      await deletePersonaWithAppMode(apiContext, personaWithAppMode);
      await afterAction();
    }
  });

  test('Rung 5 (tenant default) beats rung 6 (DEFAULT_APP_MODE) — tenant AI, no user pref, no persona', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const { apiContext, afterAction } = await createNewPage(browser);
    const user = new UserClass();
    try {
      await user.create(apiContext);
      await runWithTenantDefault({
        browser,
        desired: 'ai',
        action: async (page) => {
          await user.login(page);
          await waitForAllLoadersToDisappear(page);
          await waitForAppMode(page, 'ai');

          // The stub keeps the tenant-wide default local to this context, so
          // the global `appConfiguration` row must NEVER read 'ai' — a real
          // 'ai' there would boot unrelated parallel specs into the AI shell.
          const config = await apiContext.get(
            '/api/v1/system/settings/appConfiguration'
          );

          expect(config.ok()).toBeTruthy();

          const configBody = await config.json();

          expect(configBody?.config_value?.defaultAppMode ?? null).not.toBe(
            'ai'
          );
        },
      });
    } finally {
      await user.delete(apiContext).catch(() => undefined);
      await afterAction();
    }
  });

  test('All rungs empty → DEFAULT_APP_MODE (Classic) wins', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const { apiContext, afterAction } = await createNewPage(browser);
    const user = new UserClass();
    try {
      await user.create(apiContext);
      await runWithTenantDefault({
        browser,
        desired: null,
        action: async (page) => {
          await user.login(page);
          await waitForAllLoadersToDisappear(page);
          await waitForAppMode(page, 'default');
        },
      });
    } finally {
      await user.delete(apiContext).catch(() => undefined);
      await afterAction();
    }
  });

  test("Rung 1 (session tuple) survives a persona flip mid-session — user's manual switch wins", async ({
    browser,
  }) => {
    // The crux of the unification: the resolver used to clobber `session` when
    // `session.personaAppMode !== currentPersonaAppMode`. New behaviour: a
    // valid session always wins, regardless of persona.
    test.setTimeout(180_000);
    const { apiContext, afterAction } = await createNewPage(browser);
    const user = new UserClass();
    const personaWithAppMode = await createPersonaWithAppMode(
      apiContext,
      'classic'
    );
    try {
      await user.create(apiContext);
      await assignDefaultPersona(
        apiContext,
        user.responseData.id,
        personaWithAppMode.persona
      );

      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        // Log in and manually switch to AI in this tab. Persona still says
        // Classic; the manual switch overrides for this tab.
        await user.login(page);
        await waitForAllLoadersToDisappear(page);
        await switchToAiModeViaProfileToggle(page);
        await expect(page.getByTestId('ask-sidebar')).toBeVisible();
        await waitForAppMode(page, 'ai');

        // Reload — the session tuple is preserved and the resolver reruns.
        // Pre-unification, it would see `session.personaAppMode` (null at write
        // time) != persona's 'classic' and clobber to Classic. New code: a
        // valid session wins unconditionally.
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('ask-sidebar')).toBeVisible();
        await waitForAppMode(page, 'ai');
      } finally {
        await context.close();
      }
    } finally {
      await user.delete(apiContext).catch(() => undefined);
      await deletePersonaWithAppMode(apiContext, personaWithAppMode);
      await afterAction();
    }
  });
});
