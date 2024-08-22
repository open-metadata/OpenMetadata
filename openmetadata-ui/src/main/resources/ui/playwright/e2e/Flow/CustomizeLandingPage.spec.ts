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
  removeAndCheckWidget,
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

  test('Remove and check widget', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    await setUserDefaultPersona(adminPage, persona.responseData.displayName);
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

    const saveResponse = adminPage.waitForResponse('/api/v1/docStore');
    await adminPage.click('[data-testid="save-button"]');
    await saveResponse;

    await toastNotification(adminPage, 'Page layout created successfully.');
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

    const saveResponse = adminPage.waitForResponse('/api/v1/docStore');
    await adminPage.click('[data-testid="save-button"]');
    await saveResponse;

    await toastNotification(adminPage, 'Page layout created successfully.');
  });
});
