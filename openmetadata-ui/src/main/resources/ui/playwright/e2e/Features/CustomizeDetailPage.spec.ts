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
import { APIRequestContext, Locator, Page } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import {
  ECustomizedDataAssets,
  ECustomizedGovernance,
  EntityTabs,
} from '../../constant/customizeDetail';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { expect, test as base } from '../../support/fixtures/base';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  clickOutside,
  getApiContext,
  redirectToHomePage,
  scrollIntoViewAndSettle,
  toastNotification,
  waitForAntdModalToSettle,
} from '../../utils/common';
import {
  getCustomizeDetailsDefaultTabs,
  getCustomizeDetailsEntity,
  openPlaceholderWidgetPicker,
} from '../../utils/customizeDetails';
import {
  checkDefaultStateForNavigationTree,
  validateLeftSidebarWithHiddenItems,
} from '../../utils/customizeNavigation';
import {
  getEncodedFqn,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import { navigateToPersonaWithPagination } from '../../utils/persona';
import { settingClick } from '../../utils/sidebar';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';

const persona = new PersonaClass();
// Keeping it separate so that it won't affect other tests
const navigationPersona = new PersonaClass();
// "Glossary Term - customization should work" saves `persona`'s Glossary Term
// layout, so the tab-order test gets its own persona and user; otherwise it
// inherits that layout whenever both tests run in the same worker.
const glossaryTermPersona = new PersonaClass();
// The Overview card tests save `overviewCardPersona`'s Domain and Data Product
// layouts, so they get their own persona to keep them out of the tests above.
const overviewCardPersona = new PersonaClass();
const adminUser = new AdminClass();
const user = new UserClass();
const glossaryTermUser = new UserClass();

const test = base.extend<{
  adminPage: Page;
  userPage: Page;
  glossaryTermUserPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.signIn(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
  userPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user.signIn(page);
    await use(page);
    await page.close();
  },
  glossaryTermUserPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await glossaryTermUser.signIn(page);
    await use(page);
    await page.close();
  },
});

test.beforeAll('Setup Customize tests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await user.create(apiContext);
  await user.setAdminRole(apiContext);
  await glossaryTermUser.create(apiContext);
  await glossaryTermUser.setAdminRole(apiContext);

  await persona.create(apiContext);
  await navigationPersona.create(apiContext);
  await glossaryTermPersona.create(apiContext);
  await overviewCardPersona.create(apiContext);

  // Assign persona to user to validate page changes
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
        path: '/personas/1',
        value: {
          id: navigationPersona.responseData.id,
          name: navigationPersona.responseData.name,
          displayName: navigationPersona.responseData.displayName,
          fullyQualifiedName: navigationPersona.responseData.fullyQualifiedName,
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

  const glossaryTermPersonaReference = {
    id: glossaryTermPersona.responseData.id,
    name: glossaryTermPersona.responseData.name,
    displayName: glossaryTermPersona.responseData.displayName,
    fullyQualifiedName: glossaryTermPersona.responseData.fullyQualifiedName,
    type: 'persona',
  };
  await glossaryTermUser.patch({
    apiContext,
    patchData: [
      { op: 'add', path: '/personas/0', value: glossaryTermPersonaReference },
      {
        op: 'add',
        path: '/defaultPersona',
        value: glossaryTermPersonaReference,
      },
    ],
  });

  await afterAction();
});

test.afterAll('Cleanup Customize tests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await user.delete(apiContext);
  await glossaryTermUser.delete(apiContext);
  await persona.delete(apiContext);
  await navigationPersona.delete(apiContext);
  await glossaryTermPersona.delete(apiContext);
  await overviewCardPersona.delete(apiContext);
  await afterAction();
});

test.describe(
  'Persona customize UI tab',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  async () => {
    test.beforeEach(async ({ adminPage }) => {
      await redirectToHomePage(adminPage);

      // Navigate to persona page
      const personaListResponse =
        adminPage.waitForResponse(`/api/v1/personas?*`);
      await settingClick(adminPage, GlobalSettingOptions.PERSONA);
      await personaListResponse;

      // Need to find persona card and click as the list might get paginated
      await navigateToPersonaWithPagination(adminPage, persona.data.name, true);
      await adminPage.getByRole('tab', { name: 'Customize UI' }).click();
    });

    test('should show all the customize options', async ({ adminPage }) => {
      await expect(
        adminPage.getByText('Navigation', { exact: true })
      ).toBeVisible();
      await expect(adminPage.getByText('Home Page')).toBeVisible();
      await expect(adminPage.getByText('Governance')).toBeVisible();
      await expect(adminPage.getByText('Data Assets')).toBeVisible();
    });

    test('should show all the data assets customize options', async ({
      adminPage,
    }) => {
      await adminPage.getByText('Data Assets').click();

      for (const type of Object.values(ECustomizedDataAssets)) {
        await expect(adminPage.getByText(type, { exact: true })).toBeVisible();
      }
    });

    test('should show all the governance customize options', async ({
      adminPage,
    }) => {
      await adminPage.getByText('Governance').click();

      for (const type of Object.values(ECustomizedGovernance)) {
        await expect(adminPage.getByText(type, { exact: true })).toBeVisible();
      }
    });

    test('Navigation check default state', async ({ adminPage }) => {
      await adminPage.getByText('Navigation', { exact: true }).click();
      await checkDefaultStateForNavigationTree(adminPage);
    });

    test('customize navigation should work', async ({
      adminPage,
      userPage,
    }) => {
      test.slow();

      const personaListResponse =
        adminPage.waitForResponse(`/api/v1/personas?*`);
      await settingClick(adminPage, GlobalSettingOptions.PERSONA);
      await personaListResponse;
      await navigateToPersonaWithPagination(
        adminPage,
        navigationPersona.data.name,
        true
      );
      await adminPage.getByText('Navigation', { exact: true }).click();

      await test.step('hide navigation items and validate with persona', async () => {
        // Hide Explore
        await adminPage
          .getByTestId('page-layout-v1')
          .getByText('Explore', { exact: true })
          .locator('[data-testid^="navigation-switch-"]')
          .click();

        await expect(
          adminPage
            .getByTestId('page-layout-v1')
            .getByText('Explore', { exact: true })
            .getByRole('switch')
        ).not.toBeChecked();

        // Hide Metrics
        await adminPage
          .getByTestId('page-layout-v1')
          .getByText('Metrics')
          .locator('[data-testid^="navigation-switch-"]')
          .click();

        await expect(
          adminPage
            .getByTestId('page-layout-v1')
            .getByText('Metrics')
            .getByRole('switch')
        ).not.toBeChecked();

        await adminPage.getByTestId('save-button').click();

        await toastNotification(
          adminPage,
          /^Page layout (created|updated) successfully\.$/
        );

        // Select navigation persona
        await userPage.getByTestId('dropdown-profile').click();

        const personaMenuItem = userPage.getByRole('menuitem', {
          name: navigationPersona.responseData.displayName,
        });

        await expect(personaMenuItem).toBeVisible();

        const personaDocsStore = userPage.waitForResponse(
          `/api/v1/docStore/name/persona.${getEncodedFqn(
            navigationPersona.responseData.fullyQualifiedName ?? ''
          )}*`
        );
        await personaMenuItem.click();
        await personaDocsStore;
        await waitForAllLoadersToDisappear(userPage);
        await clickOutside(userPage);

        // Validate changes in navigation tree
        await validateLeftSidebarWithHiddenItems(userPage, [
          SidebarItem.EXPLORE,
          SidebarItem.METRICS,
        ]);
      });

      await test.step('show navigation items and validate with persona', async () => {
        // Show Explore
        await adminPage
          .getByTestId('page-layout-v1')
          .getByText('Explore', { exact: true })
          .locator('[data-testid^="navigation-switch-"]')
          .click();

        await expect(
          adminPage
            .getByTestId('page-layout-v1')
            .getByText('Explore', { exact: true })
            .getByRole('switch')
        ).toBeChecked();

        // Show Metrics
        await adminPage
          .getByTestId('page-layout-v1')
          .getByText('Metrics')
          .locator('[data-testid^="navigation-switch-"]')
          .click();

        await expect(
          adminPage
            .getByTestId('page-layout-v1')
            .getByText('Metrics')
            .getByRole('switch')
        ).toBeChecked();

        // Hide Glossary
        await adminPage
          .getByTestId('page-layout-v1')
          .getByText('Glossary')
          .locator('[data-testid^="navigation-switch-"]')
          .click();

        await expect(
          adminPage
            .getByTestId('page-layout-v1')
            .getByText('Glossary')
            .getByRole('switch')
        ).not.toBeChecked();

        // Hide Incident Manager
        await adminPage
          .getByTestId('page-layout-v1')
          .getByText('Incident Manager')
          .locator('[data-testid^="navigation-switch-"]')
          .click();
        await adminPage.getByTestId('save-button').click();

        await toastNotification(
          adminPage,
          /^Page layout (created|updated) successfully\.$/
        );

        // Select navigation persona
        await redirectToHomePage(userPage);
        await userPage.getByTestId('dropdown-profile').click();

        const personaMenuItem = userPage.getByRole('menuitem', {
          name: navigationPersona.responseData.displayName,
        });

        await expect(personaMenuItem).toBeVisible();

        await personaMenuItem.click();
        await clickOutside(userPage);
        await waitForAllLoadersToDisappear(userPage);

        // Validate changes in navigation tree
        await validateLeftSidebarWithHiddenItems(userPage, [
          SidebarItem.GLOSSARY,
          SidebarItem.INCIDENT_MANAGER,
        ]);
      });
    });
  }
);

test.describe('Persona customization', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  Object.values(ECustomizedDataAssets).forEach(async (type) => {
    test(`${type} - customization should work`, async ({
      adminPage,
      userPage,
    }) => {
      test.slow();

      let entity:
        | {
            create: (context: APIRequestContext) => Promise<unknown>;
            visitEntityPage: (page: Page) => Promise<unknown>;
          }
        | undefined = undefined;

      await test.step('pre-requisite', async () => {
        entity = getCustomizeDetailsEntity(type);
        const { apiContext } = await getApiContext(adminPage);
        // Ensure entity is created
        await entity.create(apiContext);
      });

      await test.step(`should show all the tabs & widget as default when no customization is done`, async () => {
        const personaListResponse = waitForResponseWithStatus(
          adminPage,
          (response) => response.url().includes('/api/v1/personas?'),
          200
        );
        await settingClick(adminPage, GlobalSettingOptions.PERSONA);
        await personaListResponse;

        // Need to find persona card and click as the list might get paginated
        await navigateToPersonaWithPagination(
          adminPage,
          persona.data.name,
          true
        );

        await adminPage.getByRole('tab', { name: 'Customize UI' }).click();
        await adminPage.getByText('Data Assets').click();
        await adminPage.getByText(type, { exact: true }).click();

        await waitForAllLoadersToDisappear(adminPage);

        const expectedTabs = getCustomizeDetailsDefaultTabs(type);

        for (const tabName of expectedTabs) {
          await expect(
            adminPage
              .getByTestId('customize-tab-card')
              .getByTestId(`tab-${tabName}`)
          ).toBeVisible();
        }

        const tabs = adminPage
          .getByTestId('customize-tab-card')
          .getByRole('button')
          .filter({ hasNotText: 'Add Tab' });

        // The tab card has rendered (asserted above), so this one-shot count
        // reads the final state rather than a still-mounting card.
        const knowledgeGraphTab = adminPage
          .getByTestId('customize-tab-card')
          .getByTestId(`tab-${EntityTabs.KNOWLEDGE_GRAPH}`);
        const hasKnowledgeGraphTab = (await knowledgeGraphTab.count()) > 0;
        const expectedTabCount =
          expectedTabs.length +
          (hasKnowledgeGraphTab &&
          !expectedTabs.includes(EntityTabs.KNOWLEDGE_GRAPH)
            ? 1
            : 0);

        await expect(tabs).toHaveCount(expectedTabCount);
      });

      await test.step('apply customization', async () => {
        await expect(
          adminPage.locator('#KnowledgePanel\\.Description')
        ).toBeVisible();

        await adminPage
          .locator('#KnowledgePanel\\.Description')
          .getByTestId('remove-widget-button')
          .click();

        await adminPage.getByTestId('tab-custom_properties').click();
        await adminPage.getByText('Hide', { exact: true }).click();

        await adminPage.getByRole('button', { name: 'Add tab' }).click();

        await expect(adminPage.getByRole('dialog')).toBeVisible();

        const dialogTextbox = adminPage.getByTestId('add-tab-input');
        await dialogTextbox.fill('Custom Tab');

        const addButton = adminPage
          .getByRole('dialog')
          .getByRole('button', { name: 'Add' });

        // Wait for dialog animation to complete and button to be stable
        await adminPage.locator('.ant-modal').waitFor({ state: 'visible' });
        await waitForAntdModalToSettle(adminPage);
        await expect(addButton).toBeEnabled();
        await addButton.click();

        await expect(adminPage.getByTestId('tab-Custom Tab')).toBeVisible();
        await expect(
          adminPage.getByText('Customize Custom Tab Widgets')
        ).toBeVisible();

        await openPlaceholderWidgetPicker(adminPage);

        await adminPage
          .getByTestId('add-widget-modal')
          .getByTestId('Description-widget')
          .click();
        await adminPage
          .getByTestId('add-widget-modal')
          .getByTestId('add-widget-button')
          .click();

        await expect(adminPage.getByTestId('widget-info-tabs')).toBeHidden();
        await adminPage.getByTestId('save-button').click();

        await toastNotification(
          adminPage,
          /^Page layout (created|updated) successfully\.$/
        );
      });

      await test.step('Validate customization', async () => {
        await redirectToHomePage(userPage);

        await entity?.visitEntityPage(userPage);
        await waitForAllLoadersToDisappear(userPage);

        await expect(
          userPage.getByRole('tab', { name: 'Custom Tab' })
        ).toBeVisible();

        const customTab = userPage
          .locator('main [role="tablist"]')
          .last()
          .getByRole('tab', { name: 'Custom Tab' });

        await customTab.focus();
        await userPage.keyboard.press('Enter');

        await expect
          .poll(async () =>
            userPage.getByTestId(/KnowledgePanel.Description-/).count()
          )
          .toBeGreaterThan(0);

        const visibleDescriptionWidget = userPage.locator(
          '[data-testid^="KnowledgePanel.Description-"]:visible'
        );
        await expect(
          visibleDescriptionWidget.filter({ visible: true })
        ).not.toHaveCount(0);
      });
    });
  });

  Object.values(ECustomizedGovernance).forEach(async (type) => {
    test(`${type} - customization should work`, async ({
      adminPage,
      userPage,
    }) => {
      test.slow();

      let entity:
        | {
            create: (context: APIRequestContext) => Promise<unknown>;
            visitEntityPage: (page: Page) => Promise<unknown>;
          }
        | undefined = undefined;

      await test.step('pre-requisite', async () => {
        entity = getCustomizeDetailsEntity(type);
        const { apiContext } = await getApiContext(adminPage);
        // Ensure entity is created
        await entity.create(apiContext);
      });

      await test.step(`should show all the tabs & widget as default when no customization is done`, async () => {
        const personaListResponse =
          adminPage.waitForResponse(`/api/v1/personas?*`);
        await settingClick(adminPage, GlobalSettingOptions.PERSONA);
        await personaListResponse;

        // Need to find persona card and click as the list might get paginated
        await navigateToPersonaWithPagination(
          adminPage,
          persona.data.name,
          true
        );
        await adminPage.getByRole('tab', { name: 'Customize UI' }).click();
        await adminPage.getByText('Governance').click();
        await adminPage.getByText(type, { exact: true }).click();

        await waitForAllLoadersToDisappear(adminPage);

        const expectedTabs = getCustomizeDetailsDefaultTabs(type);

        for (const tabName of expectedTabs) {
          await expect(
            adminPage
              .getByTestId('customize-tab-card')
              .getByTestId(`tab-${tabName}`)
          ).toBeVisible();
        }
      });

      await test.step('apply customization', async () => {
        await expect(
          adminPage.locator('#KnowledgePanel\\.Description')
        ).toBeVisible();

        await adminPage
          .locator('#KnowledgePanel\\.Description')
          .getByTestId('remove-widget-button')
          .click();

        await adminPage.getByRole('button', { name: 'Add tab' }).click();

        await expect(adminPage.getByRole('dialog')).toBeVisible();

        const dialogTextbox = adminPage.getByTestId('add-tab-input');
        await dialogTextbox.fill('Custom Tab');

        const addButton = adminPage
          .getByRole('dialog')
          .getByRole('button', { name: 'Add' });

        await expect(addButton).toBeEnabled();
        await addButton.click();

        await expect(adminPage.getByTestId('tab-Custom Tab')).toBeVisible();
        await expect(
          adminPage.getByText('Customize Custom Tab Widgets')
        ).toBeVisible();

        await openPlaceholderWidgetPicker(adminPage);

        await adminPage
          .getByTestId('add-widget-modal')
          .getByTestId('Description-widget')
          .click();
        await adminPage
          .getByTestId('add-widget-modal')
          .getByTestId('add-widget-button')
          .click();

        await expect(adminPage.getByTestId('widget-info-tabs')).toBeHidden();

        await adminPage.getByTestId('save-button').click();

        await toastNotification(
          adminPage,
          /^Page layout (created|updated) successfully\.$/
        );
      });

      await test.step('Validate customization', async () => {
        await redirectToHomePage(userPage);

        await entity?.visitEntityPage(userPage);
        await waitForAllLoadersToDisappear(userPage);
        await waitForAllLoadersToDisappear(userPage);

        await expect(
          userPage.getByRole('tab', { name: 'Custom Tab' })
        ).toBeVisible();

        const customTab = userPage
          .locator('main [role="tablist"]')
          .last()
          .getByRole('tab', { name: 'Custom Tab' });

        await customTab.focus();
        await userPage.keyboard.press('Enter');

        await expect
          .poll(async () =>
            userPage.getByTestId(/KnowledgePanel.Description-/).count()
          )
          .toBeGreaterThan(0);

        const visibleDescriptionWidget = userPage.locator(
          '[data-testid^="KnowledgePanel.Description-"]:visible'
        );
        await expect(
          visibleDescriptionWidget.filter({ visible: true })
        ).not.toHaveCount(0);
      });
    });
  });

  test('Validate Glossary Term details page after customization of tabs', async ({
    adminPage,
    glossaryTermUserPage,
  }) => {
    test.slow();

    let entity:
      | {
          create: (context: APIRequestContext) => Promise<unknown>;
          visitEntityPage: (page: Page) => Promise<unknown>;
        }
      | undefined = undefined;

    await test.step('pre-requisite', async () => {
      entity = getCustomizeDetailsEntity(ECustomizedGovernance.GLOSSARY_TERM);
      const { apiContext } = await getApiContext(adminPage);
      // Ensure entity is created
      await entity.create(apiContext);
    });

    await test.step('apply customization', async () => {
      const personaListResponse =
        adminPage.waitForResponse(`/api/v1/personas?*`);
      await settingClick(adminPage, GlobalSettingOptions.PERSONA);
      await personaListResponse;

      // Need to find persona card and click as the list might get paginated
      await navigateToPersonaWithPagination(
        adminPage,
        glossaryTermPersona.data.name,
        true
      );
      await adminPage.getByRole('tab', { name: 'Customize UI' }).click();
      await adminPage.getByText('Governance').click();
      await adminPage.getByText('Glossary Term', { exact: true }).click();

      await waitForAllLoadersToDisappear(adminPage);

      const dragElement = adminPage.getByTestId('tab-overview');
      const dropTarget = adminPage.getByTestId('tab-custom_properties');

      await dragElement.dragTo(dropTarget);

      await expect(adminPage.getByTestId('save-button')).toBeEnabled();

      await adminPage.getByTestId('save-button').click();

      await toastNotification(
        adminPage,
        /^Page layout (created|updated) successfully\.$/
      );
    });

    await test.step('Validate customization', async () => {
      await redirectToHomePage(glossaryTermUserPage);

      await entity?.visitEntityPage(glossaryTermUserPage);
      await waitForAllLoadersToDisappear(glossaryTermUserPage);

      await expect(
        glossaryTermUserPage.getByRole('tab', { name: 'Overview' })
      ).toBeVisible();
      await expect(
        glossaryTermUserPage.getByRole('tab', { name: 'Glossary Terms' })
      ).toBeVisible();
      await expect(
        glossaryTermUserPage.getByTestId(
          'create-error-placeholder-Glossary Term'
        )
      ).toBeVisible();

      await glossaryTermUserPage.getByRole('tab', { name: 'Overview' }).click();

      await expect(
        glossaryTermUserPage.getByTestId('asset-description-container')
      ).toBeVisible();

      await glossaryTermUserPage
        .getByRole('tab', { name: 'Glossary Terms' })
        .click();

      await expect(
        glossaryTermUserPage.getByTestId(
          'create-error-placeholder-Glossary Term'
        )
      ).toBeVisible();
    });
  });

  test("customize tab label should only render if it's customize by user", async ({
    adminPage,
    userPage,
  }) => {
    let entity:
      | {
          create: (context: APIRequestContext) => Promise<unknown>;
          visitEntityPage: (page: Page) => Promise<unknown>;
        }
      | undefined = undefined;

    await test.step('pre-requisite', async () => {
      const { apiContext } = await getApiContext(adminPage);
      // Ensure entity is created
      entity = getCustomizeDetailsEntity(ECustomizedDataAssets.TABLE);
      await entity.create(apiContext);
    });

    await test.step('apply tab label customization for Table', async () => {
      const personaListResponse =
        adminPage.waitForResponse(`/api/v1/personas?*`);
      await settingClick(adminPage, GlobalSettingOptions.PERSONA);
      await personaListResponse;

      // Need to find persona card and click as the list might get paginated
      await navigateToPersonaWithPagination(adminPage, persona.data.name, true);
      await adminPage.getByRole('tab', { name: 'Customize UI' }).click();
      await adminPage.getByText('Data Assets').click();
      await adminPage.getByText('Table', { exact: true }).click();

      await waitForAllLoadersToDisappear(adminPage);

      await expect(
        adminPage
          .getByTestId('customize-tab-card')
          .getByTestId(`tab-sample_data`)
      ).toBeVisible();

      await adminPage
        .getByTestId('customize-tab-card')
        .getByTestId(`tab-sample_data`)
        .click();

      await adminPage.getByRole('menuitem', { name: 'Rename' }).click();

      await expect(
        adminPage
          .getByRole('dialog')
          .filter({ hasNot: adminPage.getByRole('menu') })
      ).toBeVisible();

      await adminPage
        .getByRole('dialog')
        .filter({ hasNot: adminPage.getByRole('menu') })
        .getByRole('textbox')
        .clear();
      await adminPage
        .getByRole('dialog')
        .filter({ hasNot: adminPage.getByRole('menu') })
        .getByRole('textbox')
        .fill('Sample Data Updated');

      await adminPage
        .getByRole('dialog')
        .filter({ hasNot: adminPage.getByRole('menu') })
        .getByRole('button', { name: 'Ok' })
        .click();

      await expect(
        adminPage
          .getByTestId('customize-tab-card')
          .getByTestId(`tab-sample_data`)
      ).toHaveText('Sample Data Updated');

      await adminPage.getByTestId('save-button').click();

      await toastNotification(
        adminPage,
        /^Page layout (created|updated) successfully\.$/
      );
    });

    await test.step('validate applied label change and language support for page', async () => {
      await redirectToHomePage(userPage);

      await entity?.visitEntityPage(userPage);
      await waitForAllLoadersToDisappear(userPage);

      // Change language to French
      await userPage.getByRole('button', { name: 'EN', exact: true }).click();
      await userPage.getByRole('menuitem', { name: 'Français - FR' }).click();
      await waitForAllLoadersToDisappear(userPage);

      await expect(
        userPage.getByRole('tab', { name: 'Sample Data Updated' })
      ).toBeVisible();
      // Overview tab in French, only customized tab should be non-localized rest should be localized
      await expect(
        userPage.getByRole('tab', { name: 'Colonnes' })
      ).toBeVisible();

      await expect(
        userPage.getByRole('tab', { name: "Flux d'Activité & Tâches" })
      ).toBeVisible();
    });
  });

  test("Domain - customize tab label should only render if it's customized by user", async ({
    adminPage,
    userPage,
  }) => {
    let entity:
      | {
          create: (context: APIRequestContext) => Promise<unknown>;
          visitEntityPage: (page: Page) => Promise<unknown>;
        }
      | undefined = undefined;

    await test.step('pre-requisite', async () => {
      const { apiContext } = await getApiContext(adminPage);
      // Ensure entity is created
      entity = getCustomizeDetailsEntity(ECustomizedGovernance.DOMAIN);
      await entity.create(apiContext);
    });

    await test.step('apply tab label customization for Domain', async () => {
      const personaListResponse =
        adminPage.waitForResponse(`/api/v1/personas?*`);
      await settingClick(adminPage, GlobalSettingOptions.PERSONA);
      await personaListResponse;

      // Need to find persona card and click as the list might get paginated
      await navigateToPersonaWithPagination(adminPage, persona.data.name, true);

      await adminPage.getByRole('tab', { name: 'Customize UI' }).click();

      await adminPage.getByText('Governance').click();
      await adminPage.getByText('Domain', { exact: true }).click();

      await waitForAllLoadersToDisappear(adminPage);

      await expect(
        adminPage
          .getByTestId('customize-tab-card')
          .getByTestId(`tab-documentation`)
      ).toBeVisible();

      await adminPage
        .getByTestId('customize-tab-card')
        .getByTestId(`tab-documentation`)
        .click();

      await adminPage.getByRole('menuitem', { name: 'Rename' }).click();

      await expect(
        adminPage
          .getByRole('dialog')
          .filter({ hasNot: adminPage.getByRole('menu') })
      ).toBeVisible();

      await adminPage
        .getByRole('dialog')
        .filter({ hasNot: adminPage.getByRole('menu') })
        .getByRole('textbox')
        .clear();
      await adminPage
        .getByRole('dialog')
        .filter({ hasNot: adminPage.getByRole('menu') })
        .getByRole('textbox')
        .fill('Access Policy');

      await adminPage
        .getByRole('dialog')
        .filter({ hasNot: adminPage.getByRole('menu') })
        .getByRole('button', { name: 'Ok' })
        .click();

      await expect(
        adminPage
          .getByTestId('customize-tab-card')
          .getByTestId(`tab-documentation`)
      ).toHaveText('Access Policy');

      await adminPage.getByTestId('save-button').click();

      await toastNotification(
        adminPage,
        /^Page layout (created|updated) successfully\.$/
      );
    });

    await test.step('validate applied label change for Domain Documentation tab', async () => {
      await redirectToHomePage(userPage);

      const domainResponse = waitForResponseWithStatus(
        userPage,
        (response) =>
          response.request().method() === 'GET' &&
          response.url().includes('/api/v1/domains/name/'),
        200
      );
      await entity?.visitEntityPage(userPage);
      await domainResponse;

      await waitForAllLoadersToDisappear(userPage);
      await waitForAllLoadersToDisappear(userPage);

      // Verify the custom tab name is displayed
      await expect(
        userPage.getByRole('tab', { name: 'Access Policy' })
      ).toBeVisible();

      // Verify other tabs still show default names
      await expect(
        userPage.getByRole('tab', { name: 'Sub Domains' })
      ).toBeVisible();

      await expect(
        userPage.getByRole('tab', { name: 'Data Products' })
      ).toBeVisible();
    });
  });
});

const byId = (id: string) => `[id="${id}"]`;

const OVERVIEW_CARD = byId('KnowledgePanel.LeftPanel');

const openCustomizePage = async (page: Page, pageType: string) => {
  await page.goto(
    `/customize-page/${encodeURIComponent(
      overviewCardPersona.responseData.fullyQualifiedName ??
        overviewCardPersona.data.name
    )}/${pageType}`
  );
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('customize-tab-card')).toBeVisible();
  await expect(page.locator(OVERVIEW_CARD)).toBeVisible();
};

const savePageLayout = async (page: Page) => {
  await page.getByTestId('save-button').click();
  await toastNotification(
    page,
    /^Page layout (created|updated) successfully\.$/
  );
};

const getBox = async (locator: Locator) => {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Expected the element to have a bounding box');
  }

  return box;
};

// The drop point is a spot on the card, not an element: the dragged widget
// covers whatever is under the pointer, so locator.dragTo cannot target it.
// Callers scroll the card into view first, so the point is on screen and the
// hover does not scroll it away.
const dragToPoint = async (
  page: Page,
  handle: Locator,
  x: number,
  y: number
) => {
  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 10 });
  await page.mouse.up();
};

// Share of the Overview card's width a widget takes, to the nearest half.
const getCardWidthShare = async (widget: Locator, card: Locator) => {
  const [widgetBox, cardBox] = await Promise.all([
    widget.boundingBox(),
    card.boundingBox(),
  ]);

  return widgetBox && cardBox
    ? Math.round((widgetBox.width / cardBox.width) * 2) / 2
    : null;
};

test.describe('Persona Overview card', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test('moves a side widget into the Overview card and back out', async ({
    adminPage,
  }) => {
    const card = adminPage.locator(OVERVIEW_CARD);
    const domain = adminPage.locator(byId('KnowledgePanel.Domain'));
    const cardDomain = card.locator(byId('KnowledgePanel.Domain'));
    const description = card.locator(byId('KnowledgePanel.Description'));

    await test.step('drop the Domain widget onto the card', async () => {
      await openCustomizePage(adminPage, 'DataProduct');

      await expect(domain).toBeVisible();
      await expect(cardDomain).toHaveCount(0);

      await scrollIntoViewAndSettle(card);
      const descriptionBox = await getBox(description);
      // Right half of the card, over the Description widget it lands below.
      await dragToPoint(
        adminPage,
        domain.getByTestId('drag-widget-button'),
        descriptionBox.x + descriptionBox.width * 0.75,
        descriptionBox.y + descriptionBox.height * 0.75
      );

      await expect(cardDomain).toBeVisible();
      await expect.poll(() => getCardWidthShare(cardDomain, card)).toBe(0.5);

      await savePageLayout(adminPage);
    });

    await test.step('keeps it in the card after reload', async () => {
      await openCustomizePage(adminPage, 'DataProduct');

      await expect(cardDomain).toBeVisible();
    });

    await test.step('drop it right of the card into the side column', async () => {
      await scrollIntoViewAndSettle(cardDomain);
      const [ownersBox, cardDomainBox] = await Promise.all([
        getBox(adminPage.locator(byId('KnowledgePanel.Owners'))),
        getBox(cardDomain),
      ]);
      // Over the side column, level with the widget being moved.
      await dragToPoint(
        adminPage,
        cardDomain.getByTestId('drag-widget-button'),
        ownersBox.x + ownersBox.width / 2,
        cardDomainBox.y + cardDomainBox.height / 2
      );

      await expect(domain).toBeVisible();
      await expect(cardDomain).toHaveCount(0);

      await savePageLayout(adminPage);
    });

    await test.step('keeps it in the side column after reload', async () => {
      await openCustomizePage(adminPage, 'DataProduct');

      await expect(domain).toBeVisible();
      await expect(cardDomain).toHaveCount(0);
    });
  });

  test('resizes a widget in the Overview card between half and full width', async ({
    adminPage,
  }) => {
    const card = adminPage.locator(OVERVIEW_CARD);
    const description = card.locator(byId('KnowledgePanel.Description'));
    const resizeHandle = description.locator(
      ':scope > .react-resizable-handle'
    );

    const resizeBy = async (offset: number) => {
      await scrollIntoViewAndSettle(description);
      const handleBox = await getBox(resizeHandle);
      await dragToPoint(
        adminPage,
        resizeHandle,
        handleBox.x + handleBox.width / 2 + offset,
        handleBox.y + handleBox.height / 2
      );
    };

    await test.step('shrink the Description widget to half the card', async () => {
      await openCustomizePage(adminPage, 'Domain');

      await expect.poll(() => getCardWidthShare(description, card)).toBe(1);

      const cardBox = await getBox(card);
      await resizeBy(-cardBox.width / 2);

      await expect.poll(() => getCardWidthShare(description, card)).toBe(0.5);

      await savePageLayout(adminPage);
    });

    await test.step('keeps the half width after reload', async () => {
      await openCustomizePage(adminPage, 'Domain');

      await expect.poll(() => getCardWidthShare(description, card)).toBe(0.5);
    });

    await test.step('grow it back to the full card', async () => {
      const cardBox = await getBox(card);
      await resizeBy(cardBox.width / 2);

      await expect.poll(() => getCardWidthShare(description, card)).toBe(1);

      await savePageLayout(adminPage);
    });
  });

  test('offers the Custom Properties widget on Domain and Data Product pages', async ({
    adminPage,
  }) => {
    for (const pageType of ['Domain', 'DataProduct']) {
      await test.step(`${pageType} Add Widget list`, async () => {
        await openCustomizePage(adminPage, pageType);
        await openPlaceholderWidgetPicker(adminPage);

        await expect(
          adminPage
            .getByTestId('add-widget-modal')
            .getByTestId('Custom Properties-widget')
        ).toBeVisible();
      });
    }
  });

  test('keeps the Overview card widgets inside the card, above the add-widget slot', async ({
    adminPage,
  }) => {
    await openCustomizePage(adminPage, 'GlossaryTerm');

    const card = adminPage.locator(OVERVIEW_CARD);
    const relatedTerms = card.locator(byId('KnowledgePanel.RelatedTerms'));
    const addWidgetSlot = adminPage.getByTestId(
      'ExtraWidget.EmptyWidgetPlaceholder'
    );

    await expect(relatedTerms).toBeVisible();
    await expect(addWidgetSlot).toBeVisible();

    // Related Terms is the card's last widget; before the card was sized to
    // its widgets it spilled past the card and under the add-widget slot.
    await expect
      .poll(async () => {
        const [cardBox, relatedTermsBox, slotBox] = await Promise.all([
          card.boundingBox(),
          relatedTerms.boundingBox(),
          addWidgetSlot.boundingBox(),
        ]);
        if (!cardBox || !relatedTermsBox || !slotBox) {
          return false;
        }
        const relatedTermsBottom = relatedTermsBox.y + relatedTermsBox.height;

        return (
          relatedTermsBottom <= cardBox.y + cardBox.height &&
          relatedTermsBottom <= slotBox.y
        );
      })
      .toBe(true);
  });
});
