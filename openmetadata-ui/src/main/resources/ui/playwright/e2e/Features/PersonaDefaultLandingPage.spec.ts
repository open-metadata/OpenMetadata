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
 * A persona's `personaPreferences[].defaultLandingPage` decides where its
 * users land after a fresh sign-in — in Classic mode only. The AI shell owns
 * `/`, so an AI persona keeps landing there whatever the landing page says.
 */

import { APIRequestContext, Browser, Page } from '@playwright/test';
import { expect, test } from '../../support/fixtures/base';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { createNewPage } from '../../utils/common';

interface PersonaPreferenceSeed {
  appMode?: 'classic' | 'AI';
  defaultLandingPage: string;
}

interface SeededPersona {
  persona: PersonaClass;
  docId: string;
}

const createPersonaWithPreferences = async (
  apiContext: APIRequestContext,
  preferences: PersonaPreferenceSeed
): Promise<SeededPersona> => {
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
            ...preferences,
          },
        ],
      },
    },
  });
  expect(response.ok()).toBeTruthy();
  const doc = await response.json();

  return { persona, docId: doc.id };
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
 * Seeds a persona + user, signs the user in from a fresh context (no carried
 * session tuple or app-mode hint) and hands the page to `assertLanding`.
 */
const signInWithPersona = async (
  browser: Browser,
  preferences: PersonaPreferenceSeed,
  assertLanding: (page: Page) => Promise<void>
): Promise<void> => {
  const { apiContext, afterAction } = await createNewPage(browser);
  const user = new UserClass();
  const seeded = await createPersonaWithPreferences(apiContext, preferences);

  try {
    await user.create(apiContext);
    await assignDefaultPersona(
      apiContext,
      user.responseData.id,
      seeded.persona
    );

    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await user.login(page);
      await assertLanding(page);
    } finally {
      await context.close();
    }
  } finally {
    await user.delete(apiContext).catch(() => undefined);
    await apiContext
      .delete(`/api/v1/docStore/${seeded.docId}?hardDelete=true`)
      .catch(() => undefined);
    await seeded.persona.delete(apiContext).catch(() => undefined);
    await afterAction();
  }
};

test.describe('Persona default landing page', { tag: ['@Platform'] }, () => {
  test('a Classic persona lands on its default landing page after sign-in', async ({
    browser,
  }) => {
    // Persona + doc + user setup and a fresh-context login.
    test.slow();

    await signInWithPersona(
      browser,
      { appMode: 'classic', defaultLandingPage: '/glossary' },
      async (page) => {
        await expect(page).toHaveURL(/\/glossary(\?|#|$)/);
      }
    );
  });

  test('an AI persona keeps landing at "/" whatever its landing page', async ({
    browser,
  }) => {
    test.slow();

    await signInWithPersona(
      browser,
      { appMode: 'AI', defaultLandingPage: '/glossary' },
      async (page) => {
        // The AI sidebar proves the AI route tree mounted before the URL check.
        await expect(page.getByTestId('ask-sidebar')).toBeVisible();

        expect(new URL(page.url()).pathname).toBe('/');
      }
    );
  });
});
