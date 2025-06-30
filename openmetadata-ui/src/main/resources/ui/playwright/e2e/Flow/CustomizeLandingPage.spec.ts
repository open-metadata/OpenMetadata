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

  test('Add,Remove and Reset widget should work properly', async ({
    adminPage,
  }) => {
    await redirectToHomePage(adminPage);
    await setUserDefaultPersona(adminPage, persona.responseData.displayName);

    await test.step('Remove widget', async () => {
      await navigateToCustomizeLandingPage(adminPage, {
        personaName: persona.responseData.name,
        customPageDataResponse: 404,
      });

      await removeAndCheckWidget(adminPage, {
        widgetTestId: 'activity-feed-widget',
        widgetKey: 'KnowledgePanel.ActivityFeed',
      });
      await removeAndCheckWidget(adminPage, {
        widgetTestId: 'following-widget',
        widgetKey: 'KnowledgePanel.Following',
      });
      await removeAndCheckWidget(adminPage, {
        widgetTestId: 'kpi-widget',
        widgetKey: 'KnowledgePanel.KPI',
      });

      await saveCustomizeLayoutPage(adminPage, true);

      await redirectToHomePage(adminPage);

      // Check if removed widgets are not present on landing adminPage
      await expect(
        adminPage.locator('[data-testid="activity-feed-widget"]')
      ).not.toBeVisible();
      await expect(
        adminPage.locator('[data-testid="following-widget"]')
      ).not.toBeVisible();
      await expect(
        adminPage.locator('[data-testid="kpi-widget"]')
      ).not.toBeVisible();
    });

    await test.step('Add widget', async () => {
      await navigateToCustomizeLandingPage(adminPage, {
        personaName: persona.responseData.name,
        customPageDataResponse: 200,
      });

      // Check if removed widgets are not present on customize page
      await expect(
        adminPage.locator('[data-testid="activity-feed-widget"]')
      ).not.toBeVisible();
      await expect(
        adminPage.locator('[data-testid="following-widget"]')
      ).not.toBeVisible();
      await expect(
        adminPage.locator('[data-testid="kpi-widget"]')
      ).not.toBeVisible();

      // Check if other widgets are present
      await expect(
        adminPage.locator('[data-testid="recently-viewed-widget"]')
      ).toBeVisible();
      await expect(
        adminPage.locator('[data-testid="my-data-widget"]')
      ).toBeVisible();
      await expect(
        adminPage.locator('[data-testid="total-assets-widget"]')
      ).toBeVisible();
      await expect(
        adminPage.locator('[data-testid="ExtraWidget.EmptyWidgetPlaceholder"]')
      ).toBeVisible();

      await openAddCustomizeWidgetModal(adminPage);

      // Check if 'check' icon is present for existing widgets
      await expect(
        adminPage.locator('[data-testid="MyData-check-icon"]')
      ).toBeVisible();
      await expect(
        adminPage.locator('[data-testid="RecentlyViewed-check-icon"]')
      ).toBeVisible();
      await expect(
        adminPage.locator('[data-testid="TotalAssets-check-icon"]')
      ).toBeVisible();

      // Check if 'check' icon is not present for removed widgets
      await expect(
        adminPage.locator('[data-testid="ActivityFeed-check-icon"]')
      ).not.toBeVisible();
      await expect(
        adminPage.locator('[data-testid="Following-check-icon"]')
      ).not.toBeVisible();
      await expect(
        adminPage.locator('[data-testid="KPI-check-icon"]')
      ).not.toBeVisible();

      // Add Following widget
      await adminPage
        .locator('[data-testid="Following-widget-tab-label"]')
        .click();
      await adminPage
        .locator(
          '[aria-labelledby$="KnowledgePanel.Following"] [data-testid="add-widget-button"]'
        )
        .click();

      await expect(
        adminPage.locator('[data-testid="following-widget"]')
      ).toBeVisible();

      // Check if check icons are present in tab labels for newly added widgets
      await openAddCustomizeWidgetModal(adminPage);

      // Check if 'check' icon is present for the Following widget
      await expect(
        adminPage.locator('[data-testid="Following-check-icon"]')
      ).toBeVisible();

      // Close the add widget modal
      await adminPage
        .locator('[data-testid="add-widget-modal"] [aria-label="Close"]')
        .click();

      // Save the updated layout
      await saveCustomizeLayoutPage(adminPage);

      // Navigate to the landing page
      await redirectToHomePage(adminPage);

      // Check if removed widgets are not present on the landing page
      await expect(
        adminPage.locator('[data-testid="activity-feed-widget"]')
      ).not.toBeVisible();
      await expect(
        adminPage.locator('[data-testid="kpi-widget"]')
      ).not.toBeVisible();

      // Check if newly added widgets are present on the landing page
      await expect(
        adminPage.locator('[data-testid="following-widget"]')
      ).toBeVisible();
    });

    await test.step(
      'Resetting the layout flow should work properly',
      async () => {
        // Check if removed widgets are not present on landing page
        await expect(
          adminPage.locator('[data-testid="activity-feed-widget"]')
        ).not.toBeVisible();
        await expect(
          adminPage.locator('[data-testid="kpi-widget"]')
        ).not.toBeVisible();

        await navigateToCustomizeLandingPage(adminPage, {
          personaName: persona.responseData.name,
          customPageDataResponse: 200,
        });

        // Check if removed widgets are not present on customize page
        await expect(
          adminPage.locator('[data-testid="activity-feed-widget"]')
        ).not.toBeVisible();
        await expect(
          adminPage.locator('[data-testid="kpi-widget"]')
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

  test('Remove and add the widget in the same placeholder', async ({
    adminPage,
  }) => {
    await redirectToHomePage(adminPage);

    const feedResponse = adminPage.waitForResponse(
      '/api/v1/feed?type=Conversation&*'
    );
    await navigateToCustomizeLandingPage(adminPage, {
      personaName: persona2.responseData.name,
      customPageDataResponse: 404,
    });

    await feedResponse;

    await adminPage.waitForSelector('[data-testid="activity-feed-widget"]');

    const followingElementStyle = await adminPage
      .locator('[id="KnowledgePanel.Following"]')
      .evaluate((node) => {
        const computedStyle = window.getComputedStyle(node);

        return {
          transform: computedStyle.transform,
        };
      });

    // Remove and check the placement of Following widget.
    await adminPage.click(
      '[data-testid="following-widget"] [data-testid="remove-widget-button"]'
    );

    await adminPage.waitForSelector('[data-testid="following-widget"]', {
      state: 'detached',
    });

    await adminPage.waitForSelector(
      '[data-testid*="KnowledgePanel.Following"][data-testid$="EmptyWidgetPlaceholder"]'
    );

    // Add KPI widget in the same placeholder
    const getWidgetList = adminPage.waitForResponse(
      'api/v1/docStore?fqnPrefix=KnowledgePanel&*'
    );
    await adminPage.click(
      '[data-testid="KnowledgePanel.Following.EmptyWidgetPlaceholder"] [data-testid="add-widget-button"]'
    );

    await getWidgetList;

    await adminPage.waitForSelector('[role="dialog"].ant-modal');

    expect(adminPage.locator('[role="dialog"].ant-modal')).toBeVisible();

    await adminPage.click('[data-testid="KPI-widget-tab-label"]');

    await adminPage
      .locator('.ant-tabs-tabpane-active [data-testid="add-widget-button"]')
      .click();

    await adminPage.waitForSelector('[role="dialog"].ant-modal', {
      state: 'detached',
    });

    const kpiElement = adminPage.locator('[id^="KnowledgePanel.KPI-"]');
    const kpiElementStyle = await kpiElement.evaluate((node) => {
      const computedStyle = window.getComputedStyle(node);

      return {
        transform: computedStyle.transform,
      };
    });

    // Check if the KPI widget is added in the same placeholder,by their transform property or placement.
    expect(kpiElementStyle.transform).toEqual(followingElementStyle.transform);

    await saveCustomizeLayoutPage(adminPage, true);
  });
});
