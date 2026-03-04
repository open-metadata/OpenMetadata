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
import {
  APIRequestContext,
  test as base,
  expect,
  Page,
} from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import {
  ECustomizedDataAssets,
  ECustomizedGovernance,
} from '../../constant/customizeDetail';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  clickOutside,
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import {
  getCustomizeDetailsDefaultTabs,
  getCustomizeDetailsEntity,
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

const persona = new PersonaClass();
// Keeping it separate so that it won't affect other tests
const navigationPersona = new PersonaClass();
const adminUser = new AdminClass();
const user = new UserClass();

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

          // Select navigation persona
          await redirectToHomePage(userPage);
          await userPage.getByTestId('dropdown-profile').click();

          const personaMenuItem = userPage.getByRole('menuitem', {
            name: navigationPersona.responseData.displayName,
          });

          await expect(personaMenuItem).toBeVisible();

          await personaMenuItem.click();
          await clickOutside(userPage);
          await userPage.waitForTimeout(500);

          // Validate changes in navigation tree
          await validateLeftSidebarWithHiddenItems(userPage, [
            SidebarItem.GLOSSARY,
            SidebarItem.INCIDENT_MANAGER,
          ]);
        }
      );
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

      await test.step(
        `should show all the tabs & widget as default when no customization is done`,
        async () => {
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
        await expect(addButton).toBeEnabled();
        await addButton.click();

        await expect(adminPage.getByTestId('tab-Custom Tab')).toBeVisible();
        await expect(
          adminPage.getByText('Customize Custom Tab Widgets')
        ).toBeVisible();

        // Wait for dialog to close before interacting with grid layout
        await adminPage.getByRole('dialog').waitFor({ state: 'hidden' });
        await adminPage
          .locator('.ant-modal-wrap')
          .waitFor({ state: 'detached' });

        // Get locator after dialog closes to avoid layout shift issues
        const addWidgetButton = adminPage
          .getByTestId('ExtraWidget.EmptyWidgetPlaceholder')
          .getByTestId('add-widget-button');
        await addWidgetButton.waitFor({ state: 'visible' });
        await expect(addWidgetButton).toBeEnabled();
        await addWidgetButton.click();
        await adminPage
          .getByTestId('widget-info-tabs')
          .waitFor({ state: 'visible' });

        await adminPage
          .getByTestId('add-widget-modal')
          .getByTestId('Description-widget')
          .click();
        await adminPage
          .getByTestId('add-widget-modal')
          .getByTestId('add-widget-button')
          .click();

        await adminPage
          .getByTestId('widget-info-tabs')
          .waitFor({ state: 'hidden' });
        await adminPage.getByTestId('save-button').click();

        await toastNotification(
          adminPage,
          /^Page layout (created|updated) successfully\.$/
        );
      });

      await test.step('Validate customization', async () => {
        await redirectToHomePage(userPage);

        await entity?.visitEntityPage(userPage);
        await userPage.waitForLoadState('networkidle');
        await userPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        await expect(
          userPage.getByRole('tab', { name: 'Custom Tab' })
        ).toBeVisible();

        await userPage.getByRole('tab', { name: 'Custom Tab' }).click();

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

      await test.step(
        `should show all the tabs & widget as default when no customization is done`,
        async () => {
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

        // Get locator after dialog closes to avoid layout shift issues
        const addWidgetButton = adminPage
          .getByTestId('ExtraWidget.EmptyWidgetPlaceholder')
          .getByTestId('add-widget-button');
        await addWidgetButton.waitFor({ state: 'visible' });
        await expect(addWidgetButton).toBeEnabled();
        await addWidgetButton.click();
        await adminPage
          .getByTestId('widget-info-tabs')
          .waitFor({ state: 'visible' });

        await adminPage
          .getByTestId('add-widget-modal')
          .getByTestId('Description-widget')
          .click();
        await adminPage
          .getByTestId('add-widget-modal')
          .getByTestId('add-widget-button')
          .click();

        await adminPage
          .getByTestId('widget-info-tabs')
          .waitFor({ state: 'hidden' });

        await adminPage.getByTestId('save-button').click();

        await toastNotification(
          adminPage,
          /^Page layout (created|updated) successfully\.$/
        );
      });

      await test.step('Validate customization', async () => {
        await redirectToHomePage(userPage);

        await entity?.visitEntityPage(userPage);
        await userPage.waitForLoadState('networkidle');
        await userPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        expect(userPage.getByRole('tab', { name: 'Custom Tab' })).toBeVisible();

        await userPage.getByRole('tab', { name: 'Custom Tab' }).click();

        const visibleDescription = userPage
          .getByTestId(/KnowledgePanel.Description-/)
          .locator('visible=true');

        await expect(visibleDescription).toBeVisible();
      });
    });
  });

  test('Validate Glossary Term details page after customization of tabs', async ({
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
      await navigateToPersonaWithPagination(adminPage, persona.data.name, true);
      await adminPage.getByRole('tab', { name: 'Customize UI' }).click();
      await adminPage.waitForLoadState('networkidle');
      await adminPage.getByText('Governance').click();
      await adminPage.getByText('Glossary Term', { exact: true }).click();

      await adminPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const dragElement = adminPage.getByTestId('tab-overview');
      const dropTarget = adminPage.getByTestId('tab-custom_properties');

      await dragElement.dragTo(dropTarget);

      expect(adminPage.getByTestId('save-button')).toBeEnabled();

      await adminPage.getByTestId('save-button').click();

      await toastNotification(
        adminPage,
        /^Page layout (created|updated) successfully\.$/
      );
    });

    await test.step('Validate customization', async () => {
      await redirectToHomePage(userPage);

      await entity?.visitEntityPage(userPage);
      await userPage.waitForLoadState('networkidle');
      await userPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(
        userPage.getByRole('tab', { name: 'Overview' })
      ).toBeVisible();
      await expect(
        userPage.getByRole('tab', { name: 'Glossary Terms' })
      ).toBeVisible();
      await expect(
        userPage.getByTestId('create-error-placeholder-Glossary Term')
      ).toBeVisible();

      await userPage.getByRole('tab', { name: 'Overview' }).click();

      await expect(
        userPage.getByTestId('asset-description-container')
      ).toBeVisible();

      await userPage.getByRole('tab', { name: 'Glossary Terms' }).click();

      await expect(
        userPage.getByTestId('create-error-placeholder-Glossary Term')
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
      await adminPage.waitForLoadState('networkidle');
      await adminPage.getByText('Data Assets').click();
      await adminPage.getByText('Table', { exact: true }).click();

      await adminPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

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

      await expect(adminPage.getByRole('dialog')).toBeVisible();

      await adminPage.getByRole('dialog').getByRole('textbox').clear();
      await adminPage
        .getByRole('dialog')
        .getByRole('textbox')
        .fill('Sample Data Updated');

      await adminPage
        .getByRole('dialog')
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

    await test.step(
      'validate applied label change and language support for page',
      async () => {
        await redirectToHomePage(userPage);

        await entity?.visitEntityPage(userPage);
        await userPage.waitForLoadState('networkidle');
        await userPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Change language to French
        await userPage.getByRole('button', { name: 'EN', exact: true }).click();
        await userPage.getByRole('menuitem', { name: 'Français - FR' }).click();
        await userPage.waitForLoadState('networkidle');
        await userPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

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
      }
    );
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

      await adminPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

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

      await expect(adminPage.getByRole('dialog')).toBeVisible();

      await adminPage.getByRole('dialog').getByRole('textbox').clear();
      await adminPage
        .getByRole('dialog')
        .getByRole('textbox')
        .fill('Access Policy');

      await adminPage
        .getByRole('dialog')
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

    await test.step(
      'validate applied label change for Domain Documentation tab',
      async () => {
        await redirectToHomePage(userPage);

        const domainResponse = userPage.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/domains/name/') &&
            response.status() === 200
        );
        await entity?.visitEntityPage(userPage);
        await domainResponse;

        await userPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

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
      }
    );
  });
});
