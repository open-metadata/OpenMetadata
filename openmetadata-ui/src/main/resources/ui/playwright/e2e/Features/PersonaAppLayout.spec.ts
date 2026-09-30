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
 * Persona App Layout: an admin sets a persona's app mode, default landing page
 * and per-page default views; users of that persona land on the landing page
 * whenever the app opens at `/` (after sign-in or in a new tab, in either app
 * mode) and list pages open in the chosen view.
 */

import { Browser, Page } from '@playwright/test';
import { Document } from '../../../src/generated/entity/docStore/document';
import {
  AppMode,
  PageViewMode,
} from '../../../src/generated/type/personaPreferences';
import { expect } from '../../support/fixtures/base';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { deleteFixtureEntity } from '../../utils/apiResponse';
import {
  getEncodedFqn,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import {
  createPersonaAppLayoutDoc,
  setDefaultPersona,
} from '../../utils/persona';
import { performUserLogin } from '../../utils/user';
import { test } from '../fixtures/pages';

// Glossary opens its first glossary (`/glossary/<name>`) when one exists.
const GLOSSARY_URL = /\/glossary(\/|\?|#|$)/;

/** A persona with saved App Layout preferences, held by a user as default. */
class PersonaWithLayout {
  persona = new PersonaClass();
  user = new UserClass();
  layoutDoc = {} as Document;

  constructor(
    private readonly preferences: Parameters<
      typeof createPersonaAppLayoutDoc
    >[2]
  ) {}

  async create(browser: Browser) {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await this.user.create(apiContext);
    await this.persona.create(apiContext, [this.user.responseData.id]);
    this.layoutDoc = await createPersonaAppLayoutDoc(
      apiContext,
      this.persona,
      this.preferences
    );
    await setDefaultPersona(apiContext, this.user, this.persona);
    await afterAction();
  }

  async delete(browser: Browser) {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await this.user.delete(apiContext);
    await deleteFixtureEntity(
      apiContext,
      `/api/v1/docStore/${this.layoutDoc.id}?hardDelete=true`
    );
    await this.persona.delete(apiContext);
    await afterAction();
  }

  /** Signs the user in from a fresh context and closes it afterwards. */
  async signIn(browser: Browser, run: (page: Page) => Promise<void>) {
    const { page, afterAction } = await performUserLogin(browser, this.user);
    try {
      await run(page);
    } finally {
      await afterAction();
    }
  }
}

test.describe(
  'Persona default landing page',
  { tag: ['@Features', '@Platform'] },
  () => {
    const classic = new PersonaWithLayout({
      appMode: AppMode.Classic,
      defaultLandingPage: '/glossary',
    });
    const ai = new PersonaWithLayout({
      appMode: AppMode.AI,
      defaultLandingPage: '/glossary',
    });

    test.beforeAll(
      'Create the personas and their users',
      async ({ browser }) => {
        await classic.create(browser);
        await ai.create(browser);
      }
    );

    test.afterAll(
      'Delete the personas and their users',
      async ({ browser }) => {
        await ai.delete(browser);
        await classic.delete(browser);
      }
    );

    test('lands on the default landing page after sign-in', async ({
      browser,
    }) => {
      await classic.signIn(browser, async (page) => {
        await expect(page).toHaveURL(GLOSSARY_URL);
      });
    });

    test('lands on it again after signing out and back in', async ({
      browser,
    }) => {
      await classic.signIn(browser, async (page) => {
        await test.step('Sign out from another page', async () => {
          await page.goto('/explore');
          await waitForAllLoadersToDisappear(page);
          await classic.user.logout(page);
        });

        await test.step('Sign back in', async () => {
          await classic.user.login(page);

          await expect(page).toHaveURL(GLOSSARY_URL);
        });
      });
    });

    test('a new tab at / opens the landing page; a deep link stays put', async ({
      browser,
    }) => {
      await classic.signIn(browser, async (page) => {
        await test.step('Open the app root in a new tab', async () => {
          const rootTab = await page.context().newPage();
          await rootTab.goto('/');

          await expect(rootTab).toHaveURL(GLOSSARY_URL);
        });

        await test.step('Open a deep link in a new tab', async () => {
          const deepLinkTab = await page.context().newPage();
          await deepLinkTab.goto('/explore');
          await waitForAllLoadersToDisappear(deepLinkTab);

          await expect(deepLinkTab).toHaveURL(/\/explore/);
        });
      });
    });

    test('an AI persona lands on its default landing page too', async ({
      browser,
    }) => {
      await ai.signIn(browser, async (page) => {
        // The AI sidebar proves the AI route tree mounted.
        await expect(page.getByTestId('ask-sidebar')).toBeVisible();
        await expect(page).toHaveURL(GLOSSARY_URL);
      });
    });
  }
);

test.describe(
  'Persona default view mode',
  { tag: ['@Features', '@Platform'] },
  () => {
    const tableAndTree = new PersonaWithLayout({
      appMode: AppMode.Classic,
      defaultViewModes: {
        domains: PageViewMode.Tree,
        dataProducts: PageViewMode.Card,
      },
    });

    test.beforeAll('Create the persona and its user', async ({ browser }) => {
      await tableAndTree.create(browser);
    });

    test.afterAll('Delete the persona and its user', async ({ browser }) => {
      await tableAndTree.delete(browser);
    });

    test('list pages open in the view the persona picked', async ({
      browser,
    }) => {
      await tableAndTree.signIn(browser, async (page) => {
        await test.step('Domains opens in Tree view', async () => {
          await page.goto('/domain');
          await waitForAllLoadersToDisappear(page);

          await expect(page.getByTestId('tree-view-toggle')).toHaveAttribute(
            'aria-checked',
            'true'
          );
        });

        await test.step('Data Products opens in Grid view', async () => {
          await page.goto('/dataProduct');
          await waitForAllLoadersToDisappear(page);

          await expect(page.getByTestId('card-view-toggle')).toHaveAttribute(
            'aria-checked',
            'true'
          );
        });
      });
    });
  }
);

test.describe(
  'Persona App Layout page',
  { tag: ['@Features', '@Platform'] },
  () => {
    const blank = new PersonaWithLayout({});
    const configured = new PersonaWithLayout({
      appMode: AppMode.AI,
      defaultLandingPage: '/glossary',
      defaultViewModes: { domains: PageViewMode.Tree },
    });

    test.beforeAll('Create the personas', async ({ browser }) => {
      await blank.create(browser);
      await configured.create(browser);
    });

    test.afterAll('Delete the personas', async ({ browser }) => {
      await configured.delete(browser);
      await blank.delete(browser);
    });

    test('an admin saves App Layout settings and they persist', async ({
      page,
    }) => {
      await test.step('Open App Layout from the persona page', async () => {
        // By URL rather than the sidebar: the shared admin may be in AI mode,
        // whose shell has no Settings entry.
        await page.goto(
          `/settings/persona/${getEncodedFqn(blank.persona.data.name)}`
        );
        await waitForAllLoadersToDisappear(page);
        await page.getByTestId('app-layout').click();
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('customize-page-title')).toContainText(
          'App Layout'
        );
        await expect(page.getByTestId('save-button')).toBeDisabled();
      });

      await test.step('Choose Classic, Glossary and Tree for Domains', async () => {
        await page.getByTestId('app-mode-option-classic').click();

        await page
          .getByTestId('default-landing-page-select')
          .getByRole('button')
          .click();
        const glossary = page.getByRole('option', { name: /Glossary/ });
        await expect(glossary).toBeVisible();
        await glossary.click();

        await expect(
          page.getByTestId('default-landing-page-select')
        ).toContainText('Glossary');

        await page.getByTestId('add-view-mode-page').click();
        await page.getByTestId('add-view-mode-page-domains').click();
        await page.getByTestId('view-mode-domains-tree').click();

        await expect(
          page.getByTestId('view-mode-domains-tree')
        ).toHaveAttribute('aria-selected', 'true');
      });

      await test.step('Save', async () => {
        const saveButton = page.getByTestId('save-button');
        await expect(saveButton).toBeEnabled();

        const saveResponse = page.waitForResponse(
          `/api/v1/docStore/${blank.layoutDoc.id}`
        );
        await saveButton.click();
        const response = await saveResponse;

        expect(response.status()).toBe(200);
        await expect(saveButton).toBeDisabled();
      });

      await test.step('The settings are still there after a reload', async () => {
        await page.reload();
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByTestId('app-mode-option-classic').getByRole('radio')
        ).toBeChecked();
        await expect(
          page.getByTestId('default-landing-page-select')
        ).toContainText('/glossary');
        await expect(
          page.getByTestId('view-mode-domains-tree')
        ).toHaveAttribute('aria-selected', 'true');
      });
    });

    test('Reset returns every setting to its default', async ({ page }) => {
      await test.step('Open App Layout for a configured persona', async () => {
        await page.goto(
          `/customize-page/${getEncodedFqn(
            configured.persona.responseData.fullyQualifiedName ??
              configured.persona.responseData.name
          )}/app-layout`
        );
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByTestId('app-mode-option-AI').getByRole('radio')
        ).toBeChecked();
        await expect(page.getByTestId('view-mode-row-domains')).toBeVisible();
      });

      await test.step('Reset and confirm', async () => {
        await page.getByTestId('reset-button').click();
        await page.getByTestId('unsaved-changes-modal-save').click();

        await expect(
          page.getByTestId('app-mode-option-null').getByRole('radio')
        ).toBeChecked();
        await expect(
          page.getByTestId('default-landing-page-select')
        ).toContainText('Home (My Data)');
        await expect(page.getByTestId('view-mode-row-domains')).toBeHidden();
        await expect(page.getByTestId('save-button')).toBeEnabled();
      });
    });
  }
);
