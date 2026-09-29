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
 * users land when the app opens at `/` — after a sign-in or in a new tab, in
 * either app mode. Its `defaultViewModes` decide which layout each
 * view-toggle page opens in.
 */

import { APIRequestContext, Browser, Page } from '@playwright/test';
import { expect, test } from '../../support/fixtures/base';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { createNewPage } from '../../utils/common';
import { getEncodedFqn } from '../../utils/entity';
import { clickAndWaitFor } from '../../utils/waitHelpers';

// Glossary opens its first glossary (`/glossary/<name>`) when one exists.
const GLOSSARY_URL = /\/glossary(\/|\?|#|$)/;

interface PersonaPreferenceSeed {
  appMode?: 'classic' | 'AI';
  defaultLandingPage?: string;
  defaultViewModes?: Record<string, 'table' | 'card' | 'tree'>;
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
  assertLanding: (page: Page, user: UserClass) => Promise<void>
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
      await assertLanding(page, user);
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
        await expect(page).toHaveURL(GLOSSARY_URL);
      }
    );
  });

  test('a Classic persona lands there again after logging out and back in', async ({
    browser,
  }) => {
    test.slow();

    await signInWithPersona(
      browser,
      { appMode: 'classic', defaultLandingPage: '/glossary' },
      async (page, user) => {
        // Load the app on another page first, then sign back in without a
        // page load — the way a user does after an in-app logout.
        await page.goto('/explore');
        await user.logout(page);
        await page.locator('input[name="email"]').fill(user.data.email);
        await page.locator('input[name="password"]').fill(user.data.password);
        await page.getByTestId('login').click();

        await expect(page).toHaveURL(GLOSSARY_URL);
      }
    );
  });

  test('opening the app in a new tab lands on the default landing page', async ({
    browser,
  }) => {
    test.slow();

    await signInWithPersona(
      browser,
      { appMode: 'classic', defaultLandingPage: '/glossary' },
      async (page) => {
        await expect(page).toHaveURL(GLOSSARY_URL);

        const newTab = await page.context().newPage();
        await newTab.goto('/');

        await expect(newTab).toHaveURL(GLOSSARY_URL);
      }
    );
  });

  test('an AI persona lands on its default landing page too', async ({
    browser,
  }) => {
    test.slow();

    await signInWithPersona(
      browser,
      { appMode: 'AI', defaultLandingPage: '/glossary' },
      async (page) => {
        // The AI sidebar proves the AI route tree mounted.
        await expect(page.getByTestId('ask-sidebar')).toBeVisible();
        await expect(page).toHaveURL(GLOSSARY_URL);
      }
    );
  });
});

test.describe('Persona default view mode', { tag: ['@Platform'] }, () => {
  test('pages open in the view the persona picked', async ({ browser }) => {
    test.slow();

    await signInWithPersona(
      browser,
      {
        appMode: 'classic',
        defaultViewModes: { domains: 'tree', dataProducts: 'card' },
      },
      async (page) => {
        await page.goto('/domain');

        await expect(page.getByTestId('tree-view-toggle')).toHaveAttribute(
          'aria-checked',
          'true'
        );

        await page.goto('/dataProduct');

        await expect(page.getByTestId('card-view-toggle')).toHaveAttribute(
          'aria-checked',
          'true'
        );
      }
    );
  });
});

test.describe('Persona App Layout page', { tag: ['@Platform'] }, () => {
  test('an admin saves App Layout settings and they persist after a reload', async ({
    browser,
    page,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await createNewPage(browser);
    const seeded = await createPersonaWithPreferences(apiContext, {});

    try {
      const personaFqn =
        seeded.persona.responseData.fullyQualifiedName ??
        seeded.persona.responseData.name;
      await page.goto(
        `/customize-page/${getEncodedFqn(personaFqn)}/app-layout`
      );

      await page.getByTestId('app-mode-option-classic').click();
      await page.getByTestId('add-view-mode-page').click();
      await page.getByTestId('add-view-mode-page-domains').click();
      await page.getByTestId('view-mode-domains-tree').click();

      await clickAndWaitFor(
        page,
        page.getByTestId('save-button'),
        `/api/v1/docStore/${seeded.docId}`
      );

      await expect(page.getByTestId('save-button')).toBeDisabled();

      await page.reload();

      await expect(
        page.getByTestId('app-mode-option-classic').getByRole('radio')
      ).toBeChecked();
      await expect(page.getByTestId('view-mode-domains-tree')).toHaveAttribute(
        'aria-checked',
        'true'
      );
    } finally {
      await apiContext
        .delete(`/api/v1/docStore/${seeded.docId}?hardDelete=true`)
        .catch(() => undefined);
      await seeded.persona.delete(apiContext).catch(() => undefined);
      await afterAction();
    }
  });
});
