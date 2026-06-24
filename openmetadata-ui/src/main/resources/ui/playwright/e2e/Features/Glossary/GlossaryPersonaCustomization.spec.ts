/*
 *  Copyright 2025 Collate.
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
import { expect, Page, test as base } from '@playwright/test';
import { ECustomizedGovernance } from '../../../constant/customizeDetail';
import { GlobalSettingOptions } from '../../../constant/settings';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { PersonaClass } from '../../../support/persona/PersonaClass';
import { AdminClass } from '../../../support/user/AdminClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage, toastNotification } from '../../../utils/common';
import { getCustomizeDetailsDefaultTabs } from '../../../utils/customizeDetails';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { navigateToPersonaWithPagination } from '../../../utils/persona';
import { settingClick } from '../../../utils/sidebar';

// Regression coverage for the bug surfaced by PR #25886 (Glossary relations):
// the Relations Graph tab was added to the glossary term render output but not
// registered with the customize-page tab list. The Customize UI seeded
// personas from the incomplete tab list, so saving any edit silently dropped
// Relations Graph (and Data Observability) for that persona. This spec opens
// the Customize UI for a persona, saves WITHOUT touching tabs, then visits a
// glossary term as that persona and asserts every documented tab survives.

const persona = new PersonaClass();
const adminUser = new AdminClass();
const user = new UserClass();
const glossary = new Glossary();
const glossaryTerm = new GlossaryTerm(glossary);

const test = base.extend<{
  adminPage: Page;
  userPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
  userPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user.login(page);
    await use(page);
    await page.close();
  },
});

test.beforeAll(
  'Setup Glossary persona customization tests',
  async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await user.create(apiContext);
    await user.setAdminRole(apiContext);

    await persona.create(apiContext);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);

    await user.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/personas/0',
          value: {
            id: persona.responseData.id,
            name: persona.responseData.name,
            displayName: persona.responseData.displayName,
            fullyQualifiedName: persona.responseData.fullyQualifiedName,
            type: 'persona',
          },
        },
        {
          op: 'add',
          path: '/defaultPersona',
          value: {
            id: persona.responseData.id,
            name: persona.responseData.name,
            displayName: persona.responseData.displayName,
            fullyQualifiedName: persona.responseData.fullyQualifiedName,
            type: 'persona',
          },
        },
      ],
    });

    await afterAction();
  }
);

test.afterAll(
  'Cleanup Glossary persona customization tests',
  async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await persona.delete(apiContext);
    await user.delete(apiContext);
    await adminUser.delete(apiContext);

    await afterAction();
  }
);

test.describe('Glossary persona customization', () => {
  test('Customize UI lists every documented Glossary Term tab including Relations Graph', async ({
    adminPage,
  }) => {
    test.slow();

    const personaListResponse = adminPage.waitForResponse(`/api/v1/personas?*`);
    await settingClick(adminPage, GlobalSettingOptions.PERSONA);
    await personaListResponse;

    await navigateToPersonaWithPagination(adminPage, persona.data.name, true);

    await adminPage.getByRole('tab', { name: 'Customize UI' }).click();
    await adminPage.getByText('Governance').click();
    await adminPage.getByText('Glossary Term', { exact: true }).click();

    await waitForAllLoadersToDisappear(adminPage);

    const expectedTabs = getCustomizeDetailsDefaultTabs(
      ECustomizedGovernance.GLOSSARY_TERM
    );

    const tabs = adminPage
      .getByTestId('customize-tab-card')
      .getByRole('button')
      .filter({ hasNotText: 'Add Tab' });

    await expect(tabs).toHaveCount(expectedTabs.length);

    for (const tabName of expectedTabs) {
      await expect(
        adminPage
          .getByTestId('customize-tab-card')
          .getByTestId(`tab-${tabName}`)
      ).toBeVisible();
    }
  });

  test('Customize UI lists Relations Graph at the Glossary parent level', async ({
    adminPage,
  }) => {
    test.slow();

    const personaListResponse = adminPage.waitForResponse(`/api/v1/personas?*`);
    await settingClick(adminPage, GlobalSettingOptions.PERSONA);
    await personaListResponse;

    await navigateToPersonaWithPagination(adminPage, persona.data.name, true);

    await adminPage.getByRole('tab', { name: 'Customize UI' }).click();
    await adminPage.getByText('Governance').click();
    await adminPage.getByText('Glossary', { exact: true }).click();

    await waitForAllLoadersToDisappear(adminPage);

    const expectedTabs = getCustomizeDetailsDefaultTabs(
      ECustomizedGovernance.GLOSSARY
    );

    const tabs = adminPage
      .getByTestId('customize-tab-card')
      .getByRole('button')
      .filter({ hasNotText: 'Add Tab' });

    await expect(tabs).toHaveCount(expectedTabs.length);

    for (const tabName of expectedTabs) {
      await expect(
        adminPage
          .getByTestId('customize-tab-card')
          .getByTestId(`tab-${tabName}`)
      ).toBeVisible();
    }
  });

  test('Saving a persona Glossary Term customization keeps Relations Graph visible on the term page', async ({
    adminPage,
    userPage,
  }) => {
    test.slow();

    await test.step('open Glossary Term customize UI and save without touching tabs', async () => {
      const personaListResponse =
        adminPage.waitForResponse(`/api/v1/personas?*`);
      await settingClick(adminPage, GlobalSettingOptions.PERSONA);
      await personaListResponse;

      await navigateToPersonaWithPagination(adminPage, persona.data.name, true);

      await adminPage.getByRole('tab', { name: 'Customize UI' }).click();
      await adminPage.getByText('Governance').click();
      await adminPage.getByText('Glossary Term', { exact: true }).click();

      await waitForAllLoadersToDisappear(adminPage);

      await adminPage.getByTestId('save-button').click();

      await toastNotification(
        adminPage,
        /^Page layout (created|updated) successfully\.$/
      );
    });

    await test.step('visit glossary term as persona user and assert all tabs render', async () => {
      await redirectToHomePage(userPage);
      await glossaryTerm.visitEntityPage(userPage);
      await waitForAllLoadersToDisappear(userPage);

      await expect(
        userPage.getByRole('tab', { name: 'Relations Graph' })
      ).toBeVisible();
      await expect(
        userPage.getByRole('tab', { name: 'Overview' })
      ).toBeVisible();
      await expect(
        userPage.getByRole('tab', { name: 'Glossary Terms' })
      ).toBeVisible();
      await expect(userPage.getByRole('tab', { name: 'Assets' })).toBeVisible();
      await expect(
        userPage.getByRole('tab', { name: 'Activity Feeds & Tasks' })
      ).toBeVisible();
      await expect(
        userPage.getByRole('tab', { name: 'Custom Properties' })
      ).toBeVisible();
      await expect(
        userPage.getByRole('tab', { name: 'Data Observability' })
      ).toBeVisible();
    });

    await test.step('Relations Graph tab is clickable and opens the ontology explorer', async () => {
      await userPage.getByRole('tab', { name: 'Relations Graph' }).click();

      await expect(userPage.getByTestId('ontology-explorer')).toBeVisible();
    });
  });
});
