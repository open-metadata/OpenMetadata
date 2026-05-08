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
import { expect, test as base, type Page } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { SERVICE_DEFAULT_TABS } from '../../constant/customizeDetail';
import { GlobalSettingOptions } from '../../constant/settings';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { navigateToPersonaWithPagination } from '../../utils/persona';
import { settingClick } from '../../utils/sidebar';

const persona = new PersonaClass();
const adminUser = new AdminClass();
const user = new UserClass();
const databaseService = new DatabaseServiceClass();

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

test.beforeAll('Setup Service Customization tests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await user.create(apiContext);
  await user.setAdminRole(apiContext);

  await persona.create(apiContext);
  await databaseService.create(apiContext);

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
});

test.afterAll('Cleanup Service Customization tests', async ({ browser }) => {
  test.slow();

  const { apiContext, afterAction } = await performAdminLogin(browser);
  await databaseService.delete(apiContext);
  await adminUser.delete(apiContext);
  await user.delete(apiContext);
  await persona.delete(apiContext);
  await afterAction();
});

test.describe(
  'Service persona customization',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test('should show Service customize option', async ({ adminPage }) => {
      await redirectToHomePage(adminPage);

      const personaListResponse =
        adminPage.waitForResponse(`/api/v1/personas?*`);
      await settingClick(adminPage, GlobalSettingOptions.PERSONA);
      await personaListResponse;

      await navigateToPersonaWithPagination(adminPage, persona.data.name, true);
      await adminPage.getByRole('tab', { name: 'Customize UI' }).click();

      await expect(
        adminPage.getByText('Service', { exact: true })
      ).toBeVisible();
    });

    test('Service customization should work', async ({
      adminPage,
      userPage,
    }) => {
      test.slow();

      await test.step('should show all tabs as default when no customization is done', async () => {
        await redirectToHomePage(adminPage);

        const personaListResponse =
          adminPage.waitForResponse(`/api/v1/personas?*`);
        await settingClick(adminPage, GlobalSettingOptions.PERSONA);
        await personaListResponse;

        await navigateToPersonaWithPagination(
          adminPage,
          persona.data.name,
          true
        );
        await adminPage.getByRole('tab', { name: 'Customize UI' }).click();
        await adminPage.getByText('Service', { exact: true }).click();

        await waitForAllLoadersToDisappear(adminPage);

        const tabs = adminPage
          .getByTestId('customize-tab-card')
          .getByRole('button')
          .filter({ hasNotText: 'Add Tab' });

        await expect(tabs).toHaveCount(SERVICE_DEFAULT_TABS.length);

        for (const tabName of SERVICE_DEFAULT_TABS) {
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

        await adminPage.getByTestId('tab-connection').click();
        await adminPage.getByText('Hide', { exact: true }).click();

        await adminPage.getByRole('button', { name: 'Add tab' }).click();

        await expect(adminPage.getByRole('dialog')).toBeVisible();

        const dialogTextbox = adminPage.getByTestId('add-tab-input');
        await dialogTextbox.fill('Custom Tab');

        const addButton = adminPage
          .getByRole('dialog')
          .getByRole('button', { name: 'Add' });

        await adminPage.locator('.ant-modal').waitFor({ state: 'visible' });
        await expect(addButton).toBeEnabled();
        await addButton.click();

        await expect(adminPage.getByTestId('tab-Custom Tab')).toBeVisible();
        await expect(
          adminPage.getByText('Customize Custom Tab Widgets')
        ).toBeVisible();

        await adminPage.getByRole('dialog').waitFor({ state: 'hidden' });
        await adminPage
          .locator('.ant-modal-wrap')
          .waitFor({ state: 'detached' });

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

      await test.step('Validate customization on service detail page', async () => {
        await redirectToHomePage(userPage);

        await databaseService.visitEntityPage(userPage);
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
        await expect(visibleDescriptionWidget.first()).toBeVisible();
      });

      await test.step('Validate customization applies to different service types', async () => {
        const { apiContext } = await getApiContext(adminPage);

        const response = await apiContext.post(
          '/api/v1/services/messagingServices',
          {
            data: {
              name: `pw-messaging-svc-${Date.now()}`,
              serviceType: 'Kafka',
              connection: {
                config: {
                  type: 'Kafka',
                  bootstrapServers: 'localhost:9092',
                },
              },
            },
          }
        );
        const serviceData = await response.json();

        try {
          await redirectToHomePage(userPage);
          await settingClick(userPage, GlobalSettingOptions.MESSAGING);
          await userPage
            .getByTestId(`service-name-${serviceData.name}`)
            .click();
          await waitForAllLoadersToDisappear(userPage);

          await expect(
            userPage.getByRole('tab', { name: 'Custom Tab' })
          ).toBeVisible();
        } finally {
          await apiContext.delete(
            `/api/v1/services/messagingServices/name/${encodeURIComponent(
              serviceData.fullyQualifiedName
            )}?recursive=true&hardDelete=true`
          );
        }
      });
    });
  }
);
