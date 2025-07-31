/*
 *  Copyright 2024 Collate.
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
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, toastNotification } from '../../utils/common';
import {
  checkAllDefaultWidgets,
  navigateToCustomizeLandingPage,
  openAddCustomizeWidgetModal,
  removeAndCheckWidget,
  saveCustomizeLayoutPage,
  setUserDefaultPersona,
} from '../../utils/customizeLandingPage';

const adminUser = new UserClass();
const persona = new PersonaClass();
const persona2 = new PersonaClass();

const test = base.extend<{ adminPage: Page; userPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
});

base.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await persona.create(apiContext, [adminUser.responseData.id]);
  await persona2.create(apiContext);
  await afterAction();
});

base.afterAll('Cleanup', async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await persona.delete(apiContext);
  await persona2.delete(apiContext);
  await afterAction();
});

test.describe('Customize Landing Page Flow', () => {
  test('Check all default widget present', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    await adminPage.getByTestId('welcome-screen-close-btn').click();
    await checkAllDefaultWidgets(adminPage);
  });

  test('Add, Remove and Reset widget should work properly', async ({
    adminPage,
  }) => {
    test.slow(true);

    await redirectToHomePage(adminPage);
    await setUserDefaultPersona(adminPage, persona.responseData.displayName);

    await test.step('Remove widget', async () => {
      test.slow(true);

      await navigateToCustomizeLandingPage(adminPage, {
        personaName: persona.responseData.name,
        customPageDataResponse: 404,
      });

      await removeAndCheckWidget(adminPage, {
        widgetKey: 'KnowledgePanel.ActivityFeed',
      });
      await removeAndCheckWidget(adminPage, {
        widgetKey: 'KnowledgePanel.Following',
      });
      await removeAndCheckWidget(adminPage, {
        widgetKey: 'KnowledgePanel.KPI',
      });

      await saveCustomizeLayoutPage(adminPage, true);

      await redirectToHomePage(adminPage);

      // Check if removed widgets are not present on landing adminPage
      await expect(
        adminPage.locator('[data-testid="KnowledgePanel.ActivityFeed"]')
      ).not.toBeVisible();
      await expect(
        adminPage.locator('[data-testid="KnowledgePanel.Following"]')
      ).not.toBeVisible();
      await expect(
        adminPage.locator('[data-testid="KnowledgePanel.KPI"]')
      ).not.toBeVisible();
    });

    await test.step('Add widget', async () => {
      test.slow(true);

      await navigateToCustomizeLandingPage(adminPage, {
        personaName: persona.responseData.name,
        customPageDataResponse: 200,
      });

      // Check if removed widgets are not present on customize page
      await expect(
        adminPage.locator('[data-testid="KnowledgePanel.ActivityFeed"]')
      ).not.toBeVisible();
      await expect(
        adminPage.locator('[data-testid="KnowledgePanel.Following"]')
      ).not.toBeVisible();
      await expect(
        adminPage.locator('[data-testid="KnowledgePanel.KPI"]')
      ).not.toBeVisible();

      // Check if other widgets are present
      await expect(
        adminPage.locator('[data-testid="KnowledgePanel.MyData"]')
      ).toBeVisible();
      await expect(
        adminPage.locator('[data-testid="KnowledgePanel.TotalAssets"]')
      ).toBeVisible();
      await expect(
        adminPage.locator('[data-testid="ExtraWidget.EmptyWidgetPlaceholder"]')
      ).toBeVisible();

      await openAddCustomizeWidgetModal(adminPage);

      await adminPage.locator('[data-testid="loader"]').waitFor({
        state: 'detached',
      });

      // Check if 'check' icon is present for existing widgets
      await expect(
        adminPage
          .locator('[data-testid="sidebar-option-KnowledgePanel.MyData"]')
          .locator('.selected-widget-icon')
      ).toBeVisible();
      await expect(
        adminPage
          .locator('[data-testid="sidebar-option-KnowledgePanel.TotalAssets"]')
          .locator('.selected-widget-icon')
      ).toBeVisible();

      // Check if 'check' icon is not present for removed widgets
      await expect(
        adminPage
          .locator('[data-testid="sidebar-option-KnowledgePanel.ActivityFeed"]')
          .locator('.selected-widget-icon')
      ).not.toBeVisible();
      await expect(
        adminPage
          .locator('[data-testid="sidebar-option-KnowledgePanel.Following"]')
          .locator('.selected-widget-icon')
      ).not.toBeVisible();
      await expect(
        adminPage
          .locator('[data-testid="sidebar-option-KnowledgePanel.KPI"]')
          .locator('.selected-widget-icon')
      ).not.toBeVisible();

      // Add Following widget
      await adminPage
        .locator('[data-testid="KnowledgePanel.Following"]')
        .click();

      await adminPage.locator('[data-testid="apply-btn"]').click();

      await expect(
        adminPage.locator('[data-testid="KnowledgePanel.Following"]')
      ).toBeVisible();

      // Check if check icons are present in tab labels for newly added widgets
      await openAddCustomizeWidgetModal(adminPage);

      // Check if 'check' icon is present for the Following widget
      await expect(
        adminPage
          .locator('[data-testid="sidebar-option-KnowledgePanel.Following"]')
          .locator('.selected-widget-icon')
      ).toBeVisible();

      // Close the add widget modal
      await adminPage.locator('[data-testid="cancel-btn"]').click();

      // Save the updated layout
      await saveCustomizeLayoutPage(adminPage);

      // Navigate to the landing page
      await redirectToHomePage(adminPage);
      await adminPage.waitForLoadState('networkidle');

      // Check if removed widgets are not present on the landing page
      await expect(adminPage.getByText('Activity Feed')).not.toBeVisible();
      await expect(adminPage.getByText('KPI')).not.toBeVisible();

      // Check if newly added widgets are present on the landing page
      await expect(adminPage.getByText('Following Assets')).toBeVisible();
    });

    await test.step(
      'Resetting the layout flow should work properly',
      async () => {
        test.slow(true);

        // Check if removed widgets are not present on landing page
        await expect(adminPage.getByText('Activity Feed')).not.toBeVisible();
        await expect(adminPage.getByText('KPI')).not.toBeVisible();

        await navigateToCustomizeLandingPage(adminPage, {
          personaName: persona.responseData.name,
          customPageDataResponse: 200,
        });

        // Check if removed widgets are not present on customize page
        await expect(
          adminPage.locator('[data-testid="KnowledgePanel.ActivityFeed"]')
        ).not.toBeVisible();
        await expect(
          adminPage.locator('[data-testid="KnowledgePanel.KPI"]')
        ).not.toBeVisible();

        await adminPage.locator('[data-testid="reset-button"]').click();

        // Confirm reset in modal
        const resetResponse = adminPage.waitForResponse('/api/v1/docStore/*');

        await adminPage
          .locator('[data-testid="reset-layout-modal"] .ant-modal-footer')
          .locator('text=Yes')
          .click();

        await resetResponse;

        // Verify the toast notification
        await toastNotification(adminPage, 'Page layout updated successfully.');

        // Check if all widgets are present after resetting the layout
        await checkAllDefaultWidgets(adminPage, true);

        // Check if all widgets are present on landing page
        await redirectToHomePage(adminPage);

        // Ensures the page is fully loaded
        await adminPage.waitForLoadState('networkidle');

        await checkAllDefaultWidgets(adminPage);
      }
    );
  });
});
