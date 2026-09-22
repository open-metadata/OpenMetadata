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
 * Boot-time landing invariant for AI-mode users.
 *
 * A user whose resolved AppMode is `ai` (here: driven by their default
 * persona's `personaPreferences[].appMode = 'AI'`) must land at `/` — the AI
 * shell home — after login. They must NOT be redirected to `/my-data`, the
 * Classic MyData landing.
 *
 * Historically the classic `AuthenticatedAppRouter` rewrote `/` → `/my-data`
 * via `<Navigate>` immediately on mount, before the AppMode resolver finished
 * (persona doc fetch + applications registry settle). Even after AI mode won
 * the resolver, the URL was already `/my-data`, so the AI shell mounted the
 * Classic MyData tab inside itself instead of the AI landing page. This spec
 * pins the fixed behaviour: URL stays `/`, AI shell is up, no `/my-data`
 * redirect fires.
 *
 * Sibling coverage:
 *   - `AppModePrecedence.spec.ts` — persona beats tenant default (rung 4 vs 5).
 *
 * This spec takes the persona → AI resolution as given and asserts what OWNS
 * the URL `/` after boot.
 */

import { APIRequestContext, Page } from '@playwright/test';
import { expect, test } from '../../../support/fixtures/base';
import { PersonaClass } from '../../../support/persona/PersonaClass';
import { UserClass } from '../../../support/user/UserClass';
import { createNewPage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { AppModeExpectation, assertAppMode } from '../../Utils/appMode';

type PersonaWithAppMode = {
  persona: PersonaClass;
  docId: string;
};

/**
 * Creates a persona + its docStore `UICustomization` doc with a single
 * `personaPreferences` entry forcing `appMode: 'AI'`. Mirrors what the admin
 * persona editor writes (see `CustomizablePage.tsx::handleAppModeSave`).
 */
const createAiPersona = async (
  apiContext: APIRequestContext
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
            appMode: 'AI',
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

test.describe('AppMode — landing URL', { tag: ['@Platform'] }, () => {
  test('AI-preferring persona lands at "/", not "/my-data"', async ({
    browser,
  }) => {
    // Persona + docStore doc create, user create + defaultPersona assign, fresh
    // context login, persona-doc resolve on boot — bump for CI.
    test.setTimeout(240_000);

    const { apiContext, afterAction } = await createNewPage(browser);
    const user = new UserClass();
    const personaWithAppMode = await createAiPersona(apiContext);

    try {
      await user.create(apiContext);
      await assignDefaultPersona(
        apiContext,
        user.responseData.id,
        personaWithAppMode.persona
      );

      // Fresh context = no cookies, no sessionStorage/localStorage carry-over
      // from any other spec. Reproduces the bug scenario: a user hitting the
      // root URL with nothing cached.
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        // Track every client-side navigation. Under the buggy behaviour the
        // classic router fired `<Navigate to="/my-data">` before the AppMode
        // resolver settled; the visited-URLs log lets us assert the redirect
        // never happens, not just that the final URL is `/`.
        const visitedUrls: string[] = [];
        page.on('framenavigated', (frame) => {
          if (frame === page.mainFrame()) {
            visitedUrls.push(new URL(frame.url()).pathname);
          }
        });

        await user.login(page);
        await waitForAllLoadersToDisappear(page);

        // 1. AppMode resolves to AI (persona-driven).
        await waitForAppMode(page, 'ai');

        // 2. AI shell is up. The sidebar's presence proves we mounted the AI
        // route tree, not the Classic tree wrapped in the AI shell.
        await expect(page.getByTestId('ask-sidebar')).toBeVisible();

        // 3. Final URL is exactly `/` — no trailing segment, no `/my-data`.
        await expect(page).toHaveURL(/^[^?#]*\/(\?|#|$)/);
        expect(new URL(page.url()).pathname).toBe('/');

        // 4. `/my-data` never owned the URL at any point during boot. The
        // load-bearing assertion: it would fail under the race even if the URL
        // later settles back to `/`.
        expect(visitedUrls).not.toContain('/my-data');
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
