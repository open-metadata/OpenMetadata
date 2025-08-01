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
import {
  ECustomizedDataAssets,
  ECustomizedGovernance,
} from '../../constant/customizeDetail';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { EntityDataClassCreationConfig } from '../../support/entity/EntityDataClass.interface';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, toastNotification } from '../../utils/common';
import {
  getCustomizeDetailsDefaultTabs,
  getCustomizeDetailsEntity,
} from '../../utils/customizeDetails';
import {
  checkDefaultStateForNavigationTree,
  validateLeftSidebarWithHiddenItems,
} from '../../utils/customizeNavigation';
import { settingClick } from '../../utils/sidebar';

const persona = new PersonaClass();
// Keeping it separate so that it won't affect other tests
const navigationPersona = new PersonaClass();
const adminUser = new AdminClass();
const user = new UserClass();

const creationConfig: EntityDataClassCreationConfig = {
  table: true,
  entityDetails: true,
  topic: true,
  dashboard: true,
  mlModel: true,
  pipeline: true,
  dashboardDataModel: true,
  apiCollection: true,
  searchIndex: true,
  container: true,
  storedProcedure: true,
  apiEndpoint: true,
  database: true,
  databaseSchema: true,
};

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

test.beforeAll('Setup Customize tests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await user.create(apiContext);
  await user.setAdminRole(apiContext);

  await persona.create(apiContext);
  await navigationPersona.create(apiContext);

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

  await afterAction();
});

test.afterAll('Cleanup Customize tests', async ({ browser }) => {
  test.slow();

  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await user.delete(apiContext);
  await persona.delete(apiContext);
  await navigationPersona.delete(apiContext);
  await afterAction();
});

test.describe('Persona customize UI tab', async () => {
  test.beforeEach(async ({ adminPage }) => {
    await redirectToHomePage(adminPage);

    // Navigate to persona page
    await settingClick(adminPage, GlobalSettingOptions.PERSONA);
    await adminPage.waitForLoadState('networkidle');
    await adminPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
    await adminPage.getByText(persona.responseData.displayName).click();
    await adminPage.getByRole('tab', { name: 'Customize UI' }).click();
  });

  test('should show all the customize options', async ({ adminPage }) => {
    await expect(adminPage.getByText('Navigation')).toBeVisible();
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
    await adminPage.getByText('Navigation').click();
    await checkDefaultStateForNavigationTree(adminPage);
  });

  test('customize navigation should work', async ({ adminPage, userPage }) => {
    test.slow();

    await adminPage.getByText('Navigation').click();

    await test.step(
      'hide navigation items and validate with persona',
      async () => {
        // Hide Explore
        await adminPage
          .getByTestId('page-layout-v1')
          .getByText('Explore')
          .getByRole('switch')
          .click();

        await expect(
          adminPage
            .getByTestId('page-layout-v1')
            .getByText('Explore')
            .getByRole('switch')
        ).not.toBeChecked();

        // Hide Metrics
        await adminPage
          .getByTestId('page-layout-v1')
          .getByText('Metrics')
          .getByRole('switch')
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
        await redirectToHomePage(userPage);
        await userPage.reload();
        await userPage.waitForLoadState('networkidle');

        // Validate changes in navigation tree
        await validateLeftSidebarWithHiddenItems(userPage, [
          SidebarItem.EXPLORE,
          SidebarItem.METRICS,
        ]);
      }
    );

    await test.step(
      'show navigation items and validate with persona',
      async () => {
        // Show Explore
        await adminPage
          .getByTestId('page-layout-v1')
          .getByText('Explore')
          .getByRole('switch')
          .click();

        await expect(
          adminPage
            .getByTestId('page-layout-v1')
            .getByText('Explore')
            .getByRole('switch')
        ).toBeChecked();

        // Show Metrics
        await adminPage
          .getByTestId('page-layout-v1')
          .getByText('Metrics')
          .getByRole('switch')
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
          .getByRole('switch')
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
          .getByRole('switch')
          .click();
        await adminPage.getByTestId('save-button').click();

        await toastNotification(
          adminPage,
          /^Page layout (created|updated) successfully\.$/
        );

        // Reload user page to validate changes
        await userPage.reload();
        await userPage.waitForLoadState('networkidle');

        // Validate changes in navigation tree
        await validateLeftSidebarWithHiddenItems(userPage, [
          SidebarItem.GLOSSARY,
          SidebarItem.INCIDENT_MANAGER,
        ]);
      }
    );
  });
});

test.describe('Persona customization', () => {
  test.beforeAll(async ({ browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    await EntityDataClass.preRequisitesForTests(apiContext, creationConfig);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    await EntityDataClass.postRequisitesForTests(apiContext, creationConfig);

    await afterAction();
  });

  Object.values(ECustomizedDataAssets).forEach(async (type) => {
    test(`${type} - customization should work`, async ({
      adminPage,
      userPage,
    }) => {
      test.slow();

      await test.step(
        `should show all the tabs & widget as default when no customization is done`,
        async () => {
          await settingClick(adminPage, GlobalSettingOptions.PERSONA);
          await adminPage.waitForLoadState('networkidle');
          await adminPage
            .getByTestId(`persona-details-card-${persona.data.name}`)
            .click();
          await adminPage.getByRole('tab', { name: 'Customize UI' }).click();
          await adminPage.waitForLoadState('networkidle');
          await adminPage.getByText('Data Assets').click();
          await adminPage.getByText(type, { exact: true }).click();

          await adminPage.waitForSelector('[data-testid="loader"]', {
            state: 'detached',
          });

          const expectedTabs = getCustomizeDetailsDefaultTabs(type);

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
        }
      );

      await test.step('apply customization', async () => {
        expect(
          adminPage.locator('#KnowledgePanel\\.Description')
        ).toBeVisible();

        await adminPage
          .locator('#KnowledgePanel\\.Description')
          .getByTestId('remove-widget-button')
          .click();

        await adminPage.getByRole('button', { name: 'Add tab' }).click();

        await adminPage
          .getByRole('dialog')
          .getByRole('button', { name: 'Add' })
          .click();

        await adminPage.getByTestId('add-widget-button').click();
        await adminPage.getByTestId('Description-widget').click();
        await adminPage
          .getByTestId('add-widget-modal')
          .getByTestId('add-widget-button')
          .click();
        await adminPage.getByTestId('save-button').click();

        await toastNotification(
          adminPage,
          /^Page layout (created|updated) successfully\.$/
        );
      });

      await test.step('Validate customization', async () => {
        await redirectToHomePage(userPage);

        const entity = getCustomizeDetailsEntity(type);
        await entity.visitEntityPage(userPage);
        await userPage.waitForLoadState('networkidle');
        await userPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        expect(userPage.getByRole('tab', { name: 'New Tab' })).toBeVisible();

        await userPage.getByRole('tab', { name: 'New Tab' }).click();

        const visibleDescription = userPage
          .getByTestId(/KnowledgePanel.Description-/)
          .locator('visible=true');

        await expect(visibleDescription).toBeVisible();
      });
    });
  });

  Object.values(ECustomizedGovernance).forEach(async (type) => {
    test(`${type} - customization should work`, async ({
      adminPage,
      userPage,
    }) => {
      test.slow();

      await test.step(
        `should show all the tabs & widget as default when no customization is done`,
        async () => {
          await settingClick(adminPage, GlobalSettingOptions.PERSONA);
          await adminPage.waitForLoadState('networkidle');
          await adminPage
            .getByTestId(`persona-details-card-${persona.data.name}`)
            .click();
          await adminPage.getByRole('tab', { name: 'Customize UI' }).click();
          await adminPage.waitForLoadState('networkidle');
          await adminPage.getByText('Governance').click();
          await adminPage.getByText(type, { exact: true }).click();

          await adminPage.waitForSelector('[data-testid="loader"]', {
            state: 'detached',
          });

          const expectedTabs = getCustomizeDetailsDefaultTabs(type);

          const tabs = adminPage
            .getByTestId('customize-tab-card')
            .getByRole('button')
            .filter({ hasNotText: 'Add Tab' });

          await expect(tabs).toHaveCount(expectedTabs.length);

          for (const tabName of expectedTabs) {
            await expect(
              adminPage.getByTestId('customize-tab-card').getByRole('button', {
                name: tabName,
              })
            ).toBeVisible();
          }
        }
      );

      await test.step('apply customization', async () => {
        expect(
          adminPage.locator('#KnowledgePanel\\.Description')
        ).toBeVisible();

        await adminPage
          .locator('#KnowledgePanel\\.Description')
          .getByTestId('remove-widget-button')
          .click();

        await adminPage.getByRole('button', { name: 'Add tab' }).click();
        await adminPage
          .getByRole('dialog')
          .getByRole('button', { name: 'Add' })
          .click();
        await adminPage.getByTestId('add-widget-button').click();
        await adminPage.getByTestId('Description-widget').click();
        await adminPage
          .getByTestId('add-widget-modal')
          .getByTestId('add-widget-button')
          .click();
        await adminPage.getByTestId('save-button').click();

        await toastNotification(
          adminPage,
          /^Page layout (created|updated) successfully\.$/
        );
      });

      await test.step('Validate customization', async () => {
        await redirectToHomePage(userPage);

        const entity = getCustomizeDetailsEntity(type);
        await entity.visitEntityPage(userPage);
        await userPage.waitForLoadState('networkidle');
        await userPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        expect(userPage.getByRole('tab', { name: 'New Tab' })).toBeVisible();

        await userPage.getByRole('tab', { name: 'New Tab' }).click();

        const visibleDescription = userPage
          .getByTestId(/KnowledgePanel.Description-/)
          .locator('visible=true');

        await expect(visibleDescription).toBeVisible();
      });
    });
  });
});
