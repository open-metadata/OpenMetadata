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
  expect,
  Page,
  test as base,
} from '@playwright/test';
import { ECustomizedGovernance } from '../../constant/customizeDetail';
import { GlobalSettingOptions } from '../../constant/settings';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import {
  getCustomizeDetailsDefaultTabs,
  getCustomizeDetailsEntity,
} from '../../utils/customizeDetails';
import { navigateToPersonaWithPagination } from '../../utils/persona';
import { settingClick } from '../../utils/sidebar';

const persona = new PersonaClass();
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

test.beforeAll(
  'Setup Data Product Persona Customization tests',
  async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await user.create(apiContext);
    await user.setAdminRole(apiContext);

    await persona.create(apiContext);

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

test.describe('Data Product Persona customization', () => {
  test('Data Product - customization should work', async ({
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
      entity = getCustomizeDetailsEntity(ECustomizedGovernance.DATA_PRODUCT);
      const { apiContext } = await getApiContext(adminPage);
      // Ensure entity is created
      await entity.create(apiContext);
    });

    await test.step(
      'should show all the tabs & widget as default when no customization is done',
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
        await adminPage.getByText('Data Product', { exact: true }).click();

        await adminPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        const expectedTabs = getCustomizeDetailsDefaultTabs(
          ECustomizedGovernance.DATA_PRODUCT
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
      }
    );

    await test.step('apply customization', async () => {
      expect(adminPage.locator('#KnowledgePanel\\.Description')).toBeVisible();

      await adminPage
        .locator('#KnowledgePanel\\.Description')
        .getByTestId('remove-widget-button')
        .click();

      await adminPage.getByTestId('tab-custom_properties').click();
      await adminPage.getByText('Hide', { exact: true }).click();

      await adminPage.getByRole('button', { name: 'Add tab' }).click();

      await expect(adminPage.getByRole('dialog')).toBeVisible();

      await adminPage
        .getByRole('dialog')
        .getByRole('textbox')
        .fill('Custom Tab');

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

  test("Data Product - customize tab label should only render if it's customized by user", async ({
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
      entity = getCustomizeDetailsEntity(ECustomizedGovernance.DATA_PRODUCT);
      await entity.create(apiContext);
    });

    await test.step(
      'apply tab label customization for Data Product',
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

        await adminPage.getByText('Governance').click();
        await adminPage.getByText('Data Product', { exact: true }).click();

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
          .fill('Product Details');

        await adminPage
          .getByRole('dialog')
          .getByRole('button', { name: 'Ok' })
          .click();

        await expect(
          adminPage
            .getByTestId('customize-tab-card')
            .getByTestId(`tab-documentation`)
        ).toHaveText('Product Details');

        await adminPage.getByTestId('save-button').click();

        await toastNotification(
          adminPage,
          /^Page layout (created|updated) successfully\.$/
        );
      }
    );

    await test.step(
      'validate applied label change for Data Product Documentation tab',
      async () => {
        await redirectToHomePage(userPage);

        await entity?.visitEntityPage(userPage);

        await userPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Verify the custom tab name is displayed
        await expect(
          userPage.getByRole('tab', { name: 'Product Details' })
        ).toBeVisible();

        // Verify other tabs still show default names
        await expect(
          userPage.getByRole('tab', { name: 'Assets' })
        ).toBeVisible();

        await expect(
          userPage.getByRole('tab', { name: 'Activity Feeds & Tasks' })
        ).toBeVisible();
      }
    );
  });
});
