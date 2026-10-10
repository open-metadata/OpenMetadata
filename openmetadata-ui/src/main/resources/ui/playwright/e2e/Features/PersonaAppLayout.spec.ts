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

import { Browser, BrowserContext, Page } from '@playwright/test';
import { Document } from '../../../src/generated/entity/docStore/document';
import {
  AppMode,
  PageViewMode,
} from '../../../src/generated/type/personaPreferences';
import { expect } from '../../support/fixtures/base';
import { installServerLoadReducers } from '../../support/fixtures/serverLoad';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { deleteFixtureEntity, settleAll } from '../../utils/apiResponse';
import { selectOptionWithRetry } from '../../utils/common';
import {
  getEncodedFqn,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import {
  createPersonaAppLayoutDoc,
  setDefaultPersona,
} from '../../utils/persona';
import { performUserLogin } from '../../utils/user';
import { clickAndWaitFor } from '../../utils/waitHelpers';
import { test as base } from '../fixtures/pages';

// Glossary opens its first glossary (`/glossary/<name>`) when one exists.
const GLOSSARY_URL = /\/glossary(\/|\?|#|$)/;

const classicUser = new UserClass();
const aiUser = new UserClass();
const classicPersona = new PersonaClass();
const aiPersona = new PersonaClass();

type SessionState = Awaited<ReturnType<BrowserContext['storageState']>>;

// Filled by beforeAll once each persona user has signed in.
let classicUserSession: SessionState;
let aiUserSession: SessionState;

const signInAndSaveSession = async (browser: Browser, user: UserClass) => {
  const { page, afterAction } = await performUserLogin(browser, user);
  // Signing in lands on the persona's default landing page. Checked here,
  // before the session is saved, because every test starts from that session.
  await expect(page).toHaveURL(GLOSSARY_URL);
  // The auth token lives in IndexedDB, so it has to be saved too.
  const session = await page.context().storageState({ indexedDB: true });
  await afterAction();

  return session;
};

// Opens the app at `/` in a fresh context restored from a saved session, the
// way a signed-in user opens it in a new window.
const openAppAsUser = async (browser: Browser, session: SessionState) => {
  const context = await browser.newContext({ storageState: session });
  await installServerLoadReducers(context);
  const page = await context.newPage();
  // `/` redirects, so wait only for the first commit.
  await page.goto('/', { waitUntil: 'commit' });

  return page;
};

const test = base.extend<{ classicUserPage: Page; aiUserPage: Page }>({
  classicUserPage: async ({ browser }, use) => {
    const page = await openAppAsUser(browser, classicUserSession);
    await use(page);
    await page.context().close();
  },
  aiUserPage: async ({ browser }, use) => {
    const page = await openAppAsUser(browser, aiUserSession);
    await use(page);
    await page.context().close();
  },
});

test.describe('Persona App Layout for the persona users', () => {
  const layoutDocs: Document[] = [];

  test.beforeAll(
    'Create the personas, their users and App Layout documents',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await settleAll([
        classicUser.create(apiContext),
        aiUser.create(apiContext),
      ]);
      await settleAll([
        classicPersona.create(apiContext, [classicUser.responseData.id]),
        aiPersona.create(apiContext, [aiUser.responseData.id]),
      ]);
      layoutDocs.push(
        ...(await Promise.all([
          createPersonaAppLayoutDoc(apiContext, classicPersona, {
            appMode: AppMode.Classic,
            defaultLandingPage: '/glossary',
            defaultViewModes: {
              domains: PageViewMode.Tree,
              dataProducts: PageViewMode.Card,
            },
          }),
          createPersonaAppLayoutDoc(apiContext, aiPersona, {
            appMode: AppMode.AI,
            defaultLandingPage: '/glossary',
          }),
        ]))
      );
      await settleAll([
        setDefaultPersona(apiContext, classicUser, classicPersona),
        setDefaultPersona(apiContext, aiUser, aiPersona),
      ]);
      [classicUserSession, aiUserSession] = await Promise.all([
        signInAndSaveSession(browser, classicUser),
        signInAndSaveSession(browser, aiUser),
      ]);

      await afterAction();
    }
  );

  test.afterAll(
    'Delete the personas, their users and App Layout documents',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await settleAll([
        ...layoutDocs.map((doc) =>
          deleteFixtureEntity(
            apiContext,
            `/api/v1/docStore/${doc.id}?hardDelete=true`
          )
        ),
        classicUser.delete(apiContext),
        aiUser.delete(apiContext),
      ]);
      await settleAll([
        classicPersona.delete(apiContext),
        aiPersona.delete(apiContext),
      ]);

      await afterAction();
    }
  );

  test('opening / lands on the default landing page, again after leaving it', async ({
    classicUserPage,
  }) => {
    await test.step('Opening the app at / lands on the default landing page', async () => {
      await expect(classicUserPage).toHaveURL(GLOSSARY_URL);
    });

    await test.step('Entering / in the address bar lands there again', async () => {
      await classicUserPage.goto('/explore', { waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(classicUserPage);
      // `/` redirects, so wait only for the first commit.
      await classicUserPage.goto('/', { waitUntil: 'commit' });

      await expect(classicUserPage).toHaveURL(GLOSSARY_URL);
    });
  });

  test('a new tab at / opens the landing page; a deep link stays put', async ({
    classicUserPage,
  }) => {
    await test.step('Open the app root in a new tab', async () => {
      const rootTab = await classicUserPage.context().newPage();
      // `/` redirects, so wait only for the first commit.
      await rootTab.goto('/', { waitUntil: 'commit' });

      await expect(rootTab).toHaveURL(GLOSSARY_URL);
    });

    await test.step('Open a deep link in a new tab', async () => {
      const deepLinkTab = await classicUserPage.context().newPage();
      await deepLinkTab.goto('/explore', { waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(deepLinkTab);

      await expect(deepLinkTab).toHaveURL(/\/explore/);
    });
  });

  test('an AI persona lands on its default landing page too', async ({
    aiUserPage,
  }) => {
    // The AI sidebar proves the AI route tree mounted.
    await expect(aiUserPage.getByTestId('ask-sidebar')).toBeVisible();
    await expect(aiUserPage).toHaveURL(GLOSSARY_URL);
  });

  test('list pages open in the view the persona picked', async ({
    classicUserPage,
  }) => {
    await test.step('Domains opens in Tree view', async () => {
      await classicUserPage.goto('/domain', { waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(classicUserPage);

      await expect(
        classicUserPage.getByTestId('tree-view-toggle')
      ).toHaveAttribute('aria-checked', 'true');
    });

    await test.step('Data Products opens in Grid view', async () => {
      await classicUserPage.goto('/dataProduct', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(classicUserPage);

      await expect(
        classicUserPage.getByTestId('card-view-toggle')
      ).toHaveAttribute('aria-checked', 'true');
    });
  });
});

test.describe('Persona App Layout page', () => {
  const blankPersona = new PersonaClass();
  const configuredPersona = new PersonaClass();
  const configuredLayoutUrl = `/customize-page/${getEncodedFqn(
    configuredPersona.data.name
  )}/app-layout`;
  const layoutDocs: Document[] = [];
  let blankLayoutDoc: Document;

  test.beforeAll(
    'Create the personas and their App Layout documents',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await settleAll([
        blankPersona.create(apiContext),
        configuredPersona.create(apiContext),
      ]);
      const [blankDoc, configuredDoc] = await Promise.all([
        createPersonaAppLayoutDoc(apiContext, blankPersona),
        createPersonaAppLayoutDoc(apiContext, configuredPersona, {
          appMode: AppMode.AI,
          defaultLandingPage: '/glossary',
          defaultViewModes: { domains: PageViewMode.Tree },
        }),
      ]);
      layoutDocs.push(blankDoc, configuredDoc);
      blankLayoutDoc = blankDoc;

      await afterAction();
    }
  );

  test.afterAll(
    'Delete the personas and their App Layout documents',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await settleAll(
        layoutDocs.map((doc) =>
          deleteFixtureEntity(
            apiContext,
            `/api/v1/docStore/${doc.id}?hardDelete=true`
          )
        )
      );
      await settleAll([
        blankPersona.delete(apiContext),
        configuredPersona.delete(apiContext),
      ]);

      await afterAction();
    }
  );

  test('an admin saves App Layout settings and they persist', async ({
    page,
  }) => {
    const landingPageSelect = page.getByTestId('default-landing-page-select');
    const saveButton = page.getByTestId('save-button');

    await test.step('Open App Layout from the persona page', async () => {
      // By URL rather than the sidebar: the shared admin may be in AI mode,
      // whose shell has no Settings entry.
      await page.goto(
        `/settings/persona/${getEncodedFqn(blankPersona.data.name)}`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId('app-layout').click();
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(/\/app-layout$/);
      await expect(page.getByTestId('app-mode-radio-group')).toBeVisible();
      await expect(saveButton).toBeDisabled();
    });

    await test.step('Choose Classic, Glossary and Tree for Domains', async () => {
      await page.getByTestId('app-mode-option-classic').click();

      await selectOptionWithRetry(
        landingPageSelect.getByRole('button'),
        page.getByRole('option', { name: /Glossary/ })
      );

      await expect(landingPageSelect).toContainText('/glossary');

      await page.getByTestId('add-view-mode-page').click();
      await page.getByTestId('add-view-mode-page-domains').click();
      await page.getByTestId('view-mode-domains-tree').click();

      await expect(page.getByTestId('view-mode-domains-tree')).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    await test.step('Save', async () => {
      await expect(saveButton).toBeEnabled();

      await clickAndWaitFor(
        page,
        saveButton,
        `/api/v1/docStore/${blankLayoutDoc.id}`
      );

      await expect(saveButton).toBeDisabled();
    });

    await test.step('The settings are still there after a reload', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByTestId('app-mode-option-classic').getByRole('radio')
      ).toBeChecked();
      await expect(landingPageSelect).toContainText('/glossary');
      await expect(page.getByTestId('view-mode-domains-tree')).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
  });

  test('Reset returns every setting to its default', async ({ page }) => {
    await test.step('Open App Layout for a configured persona', async () => {
      await page.goto(configuredLayoutUrl, { waitUntil: 'domcontentloaded' });
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
      ).toContainText('/my-data');
      await expect(page.getByTestId('view-mode-row-domains')).toBeHidden();
      await expect(page.getByTestId('save-button')).toBeEnabled();
    });
  });

  test('clicking elsewhere on the page closes the landing page list', async ({
    page,
  }) => {
    const landingPageSelect = page.getByTestId('default-landing-page-select');

    await page.goto(configuredLayoutUrl, { waitUntil: 'domcontentloaded' });
    await waitForAllLoadersToDisappear(page);

    await test.step('Open the list', async () => {
      await landingPageSelect.getByRole('button').click();

      await expect(page.getByRole('listbox')).toBeVisible();
    });

    await test.step('Click the page title', async () => {
      await page.getByTestId('customize-page-title').click();

      await expect(page.getByRole('listbox')).toBeHidden();
      await expect(landingPageSelect).toContainText('/glossary');
    });
  });
});
