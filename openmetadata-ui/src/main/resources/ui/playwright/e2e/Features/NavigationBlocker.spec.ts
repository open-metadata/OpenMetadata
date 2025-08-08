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
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import {
  navigateToCustomizeLandingPage,
  removeAndCheckWidget,
  setUserDefaultPersona,
} from '../../utils/customizeLandingPage';

const adminUser = new UserClass();
const persona = new PersonaClass();

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
  await afterAction();
});

base.afterAll('Cleanup', async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await persona.delete(apiContext);
  await afterAction();
});

test.describe('Navigation Blocker Tests', () => {
  test.beforeEach(async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    await setUserDefaultPersona(adminPage, persona.responseData.displayName);
  });

  test('should show navigation blocker modal when trying to navigate away with unsaved changes', async ({
    adminPage,
  }) => {
    // Navigate to customize landing page
    await navigateToCustomizeLandingPage(adminPage, {
      personaName: persona.responseData.name,
    });

    // Get current URL to verify we're on the customize page
    const customizePageUrl = adminPage.url();

    expect(customizePageUrl).toContain('customize-page');

    // Make changes to trigger unsaved state - remove a widget
    await removeAndCheckWidget(adminPage, {
      widgetKey: 'KnowledgePanel.ActivityFeed',
    });

    // Verify save button becomes enabled (indicating unsaved changes)
    await expect(
      adminPage.locator('[data-testid="save-button"]')
    ).toBeEnabled();

    // Try to navigate to another page by clicking a sidebar link
    await adminPage.locator('[data-testid="app-bar-item-settings"]').click();

    // Navigation blocker modal should appear
    await expect(adminPage.locator('.ant-modal')).toBeVisible();
    await expect(
      adminPage.locator(
        '.ant-modal-title:has-text("Are you sure you want to leave?")'
      )
    ).toBeVisible();
    await expect(
      adminPage.locator(
        'text=You have unsaved changes which will be discarded.'
      )
    ).toBeVisible();

    // Verify modal has Stay and Leave buttons
    await expect(adminPage.locator('button:has-text("Stay")')).toBeVisible();
    await expect(adminPage.locator('button:has-text("Leave")')).toBeVisible();
  });

  test('should stay on current page when "Stay" is clicked', async ({
    adminPage,
  }) => {
    // Navigate to customize landing page
    await navigateToCustomizeLandingPage(adminPage, {
      personaName: persona.responseData.name,
    });

    const originalUrl = adminPage.url();

    // Make changes to trigger unsaved state
    await removeAndCheckWidget(adminPage, {
      widgetKey: 'KnowledgePanel.Following',
    });

    // Try to navigate away
    await adminPage.locator('[data-testid="app-bar-item-settings"]').click();

    // Modal should appear
    await expect(adminPage.locator('.ant-modal')).toBeVisible();

    // Click "Stay" button
    await adminPage.locator('button:has-text("Stay")').click();

    // Modal should disappear
    await expect(adminPage.locator('.ant-modal')).not.toBeVisible();

    // Should remain on the same page
    expect(adminPage.url()).toBe(originalUrl);

    // Verify we're still on the customize page with our changes
    await expect(
      adminPage.locator('[data-testid="KnowledgePanel.Following"]')
    ).not.toBeVisible();
    await expect(
      adminPage.locator('[data-testid="save-button"]')
    ).toBeEnabled();
  });

  test('should navigate to new page when "Leave" is clicked', async ({
    adminPage,
  }) => {
    // Navigate to customize landing page
    await navigateToCustomizeLandingPage(adminPage, {
      personaName: persona.responseData.name,
    });

    const originalUrl = adminPage.url();

    // Make changes to trigger unsaved state
    await removeAndCheckWidget(adminPage, {
      widgetKey: 'KnowledgePanel.KPI',
    });

    // Try to navigate to settings page
    await adminPage.locator('[data-testid="app-bar-item-settings"]').click();

    // Modal should appear
    await expect(adminPage.locator('.ant-modal')).toBeVisible();

    // Click "Leave" button
    await adminPage.locator('button:has-text("Leave")').click();

    // Modal should disappear
    await expect(adminPage.locator('.ant-modal')).not.toBeVisible();

    // Should navigate to the settings page
    await adminPage.waitForLoadState('networkidle');

    // Verify URL changed from customize page
    expect(adminPage.url()).not.toBe(originalUrl);
    expect(adminPage.url()).toContain('settings');
  });

  test('should not show navigation blocker after saving changes', async ({
    adminPage,
  }) => {
    // Navigate to customize landing page
    await navigateToCustomizeLandingPage(adminPage, {
      personaName: persona.responseData.name,
    });

    // Make changes
    await removeAndCheckWidget(adminPage, {
      widgetKey: 'KnowledgePanel.TotalAssets',
    });

    // Verify save button is enabled
    await expect(
      adminPage.locator('[data-testid="save-button"]')
    ).toBeEnabled();

    // Save changes
    const saveResponse = adminPage.waitForResponse('/api/v1/docStore');
    await adminPage.locator('[data-testid="save-button"]').click();
    await saveResponse;

    // Wait for success toast and save button to be disabled
    await expect(
      adminPage.locator('[data-testid="alert-message"]')
    ).toContainText('Page layout created successfully.');
    await expect(
      adminPage.locator('[data-testid="save-button"]')
    ).toBeDisabled();

    // Try to navigate away after saving
    await adminPage.locator('[data-testid="app-bar-item-settings"]').click();

    // Navigation should happen immediately without modal
    await adminPage.waitForLoadState('networkidle');

    expect(adminPage.url()).toContain('settings');

    // Modal should not appear
    await expect(adminPage.locator('.ant-modal')).not.toBeVisible();
  });
});
