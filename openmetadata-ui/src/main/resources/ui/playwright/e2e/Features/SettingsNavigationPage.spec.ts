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

import { test as base, expect, Page } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { setUserDefaultPersona } from '../../utils/customizeLandingPage';
import { navigateToPersonaWithPagination } from '../../utils/persona';
import { settingClick } from '../../utils/sidebar';

const adminUser = new UserClass();
const persona = new PersonaClass();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await adminUser.login(page);
    await use(page);
    await page.close();
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
  await persona.delete(apiContext);
  await afterAction();
});

const navigateToPersonaNavigation = async (page: Page) => {
  const getPersonas = page.waitForResponse('/api/v1/personas*');
  await settingClick(page, GlobalSettingOptions.PERSONA);
  await page.waitForLoadState('networkidle');
  await getPersonas;

  await navigateToPersonaWithPagination(page, persona.data.name, true);

  await page.getByTestId('navigation').click();
  await page.waitForLoadState('networkidle');
};

test.describe.serial('Settings Navigation Page Tests', () => {
  test('should update navigation sidebar', async ({ page }) => {
    // Create and set default persona
    await redirectToHomePage(page);
    await setUserDefaultPersona(page, persona.responseData.displayName);

    // Go to navigation in persona
    await navigateToPersonaNavigation(page);

    // Verify page loads with expected elements
    await expect(page.getByRole('tree')).toBeVisible();
    await expect(page.getByTestId('save-button')).toBeVisible();
    await expect(page.getByTestId('reset-button')).toBeVisible();

    // Save button should be disabled initially
    await expect(page.getByTestId('save-button')).toBeEnabled();

    // Make changes to enable save button
    const exploreSwitch = page
      .locator('.ant-tree-title:has-text("Explore")')
      .locator('.ant-switch');

    await exploreSwitch.click();

    // Check save is enabled and click save
    await expect(page.getByTestId('save-button')).toBeEnabled();

    const saveResponse = page.waitForResponse('api/v1/docStore');
    await page.getByTestId('save-button').click();
    await saveResponse;

    // Check the navigation bar if the changes reflect
    await redirectToHomePage(page);

    // Verify the navigation change is reflected in the sidebar
    await expect(page.getByTestId('app-bar-item-explore')).not.toBeVisible();

    // Clean up: Restore original state
    await navigateToPersonaNavigation(page);
    await exploreSwitch.click();

    const restoreResponse = page.waitForResponse('api/v1/docStore/*');
    await page.getByTestId('save-button').click();
    await restoreResponse;
  });

  test('should show navigation blocker when leaving with unsaved changes', async ({
    page,
  }) => {
    // Create persona and navigate to navigation page
    await redirectToHomePage(page);
    await setUserDefaultPersona(page, persona.responseData.displayName);
    await navigateToPersonaNavigation(page);

    // Make changes to trigger unsaved state
    const navigateSwitch = page
      .locator('.ant-tree-title:has-text("Explore")')
      .locator('.ant-switch');

    await navigateSwitch.click();

    // Verify save button is enabled
    await expect(page.getByTestId('save-button')).toBeEnabled();

    // Try to navigate away - should show navigation blocker
    await page
      .getByTestId('left-sidebar')
      .getByTestId('app-bar-item-settings')
      .click();

    // Verify navigation blocker modal appears
    await expect(page.getByTestId('unsaved-changes-modal-title')).toContainText(
      'Unsaved changes'
    );
    await expect(
      page.getByTestId('unsaved-changes-modal-description')
    ).toContainText('Do you want to save or discard changes?');

    // Verify modal buttons
    await expect(page.getByTestId('unsaved-changes-modal-save')).toBeVisible();
    await expect(
      page.getByTestId('unsaved-changes-modal-discard')
    ).toBeVisible();

    // Test discard changes
    await page.getByTestId('unsaved-changes-modal-discard').click();
    await page.waitForLoadState('networkidle');

    // Should navigate away and changes should be discarded
    await expect(page).toHaveURL(/.*settings.*/);
  });

  test('should save changes and navigate when "Save changes" is clicked in blocker', async ({
    page,
  }) => {
    // Create persona and navigate to navigation page
    await redirectToHomePage(page);
    await setUserDefaultPersona(page, persona.responseData.displayName);
    await navigateToPersonaNavigation(page);

    //   Make changes
    const navigateSwitch = page
      .locator('.ant-tree-title:has-text("Insights")')
      .locator('.ant-switch');

    await navigateSwitch.click();

    // Verify save button is enabled to ensure change is registered
    await expect(page.getByTestId('save-button')).toBeEnabled();

    // Try to navigate away
    await page
      .getByTestId('left-sidebar')
      .getByTestId('app-bar-item-settings')
      .click();

    // Click "Save changes" to save and navigate
    const saveResponse = page.waitForResponse('**/api/v1/docStore/**');
    await page.getByTestId('unsaved-changes-modal-save').click();
    await saveResponse;
    await page.waitForLoadState('networkidle');

    // Should navigate to settings page
    await expect(page).toHaveURL(/.*settings.*/);

    //   Verify changes were saved by checking navigation bar
    await redirectToHomePage(page);

    // Check if Insights navigation item visibility changed
    const insightsVisible = await page
      .getByTestId('left-sidebar')
      .getByTestId('app-bar-item-insights')
      .isVisible();

    expect(insightsVisible).toBe(false);

    // Clean up: Restore original state
    await navigateToPersonaNavigation(page);
    await navigateSwitch.click();

    const restoreResponse = page.waitForResponse('api/v1/docStore/*');
    await page.getByTestId('save-button').click();
    await restoreResponse;
  });

  test('should handle reset functionality and prevent navigation blocker after save', async ({
    page,
  }) => {
    //  Create persona and navigate to navigation page
    await redirectToHomePage(page);
    await setUserDefaultPersona(page, persona.responseData.displayName);
    await navigateToPersonaNavigation(page);

    //   Make changes
    const domainSwitch = page
      .locator('.ant-tree-title:has-text("Domains")')
      .first()
      .locator('.ant-switch');

    await domainSwitch.click();

    // Verify save button is enabled
    await expect(page.getByTestId('save-button')).toBeEnabled();

    expect(await domainSwitch.isChecked()).toBeFalsy();

    // Test reset functionality
    await page.getByTestId('reset-button').click();

    // Verify navigation blocker modal appears
    await expect(page.getByTestId('unsaved-changes-modal-title')).toContainText(
      'Reset Default Layout'
    );
    await expect(
      page.getByTestId('unsaved-changes-modal-description')
    ).toContainText('Are you sure you want to apply the "Default Layout"?');

    // Verify modal buttons
    await expect(page.getByTestId('unsaved-changes-modal-save')).toBeVisible();
    await expect(
      page.getByTestId('unsaved-changes-modal-discard')
    ).toBeVisible();

    // Test discard changes
    await page.getByTestId('unsaved-changes-modal-save').click();
    await page.waitForLoadState('networkidle');

    // Verify reset worked - save button disabled and state reverted
    expect(await domainSwitch.isChecked()).toBeTruthy();
    await expect(page.getByTestId('save-button')).not.toBeEnabled();
  });

  test('should support drag and drop reordering of navigation items', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await setUserDefaultPersona(page, persona.responseData.displayName);
    await navigateToPersonaNavigation(page);

    const treeItems = page.locator('.ant-tree-node-content-wrapper');
    
    // Wait for the tree to be fully ready
    await expect(treeItems.first()).toBeVisible();
    
    const firstItem = treeItems.first();
    const secondItem = treeItems.nth(1);

    const firstItemText = await firstItem.textContent();

    expect(firstItemText).not.toBeNull();

    const firstItemBox = await firstItem.boundingBox();
    const secondItemBox = await secondItem.boundingBox();

    expect(firstItemBox).not.toBeNull();
    expect(secondItemBox).not.toBeNull();

    if (firstItemBox && secondItemBox) {
      await firstItem.dragTo(secondItem, {
        sourcePosition: {
          x: firstItemBox.width / 2,
          y: firstItemBox.height / 2,
        },
        targetPosition: {
          x: secondItemBox.width / 2,
          y: secondItemBox.height / 2 + 10,
        },
      });
      await expect(treeItems.first()).not.toHaveText(firstItemText as string);

      // Now check if save button is enabled
      const saveButton = page.getByTestId('save-button');

      await expect(saveButton).toBeVisible();
      await expect(saveButton).toBeEnabled();
       
    }
  });

  test('should handle multiple items being hidden at once', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await setUserDefaultPersona(page, persona.responseData.displayName);
    await navigateToPersonaNavigation(page);

    const exploreSwitchLocator = page
      .locator('.ant-tree-title:has-text("Explore")')
      .locator('.ant-switch');
    const insightsSwitchLocator = page
      .locator('.ant-tree-title:has-text("Insights")')
      .locator('.ant-switch');

    const exploreSwitch = exploreSwitchLocator.first();
    const insightsSwitch = insightsSwitchLocator.first();

    await exploreSwitch.click();
    await insightsSwitch.click();

    await expect(page.getByTestId('save-button')).toBeEnabled();

    const saveResponse = page.waitForResponse('**/api/v1/docStore/**');
    await page.getByTestId('save-button').click();
    await saveResponse;

    await redirectToHomePage(page);

    await page.locator('[data-testid="dropdown-profile"]').click();
    await page.waitForSelector('[role="menu"].profile-dropdown', {
      state: 'visible',
    });

    // Verify personas section is visible
    await expect(page.getByText('Switch Persona')).toBeVisible();

    // Initially should show limited personas (2 by default)
    const initialPersonaLabels = page.locator(
      '[data-testid="persona-label"]'
    ).locator('input[type="radio"]');
    await initialPersonaLabels.first().click();
    await expect(page.getByTestId('app-bar-item-explore')).not.toBeVisible();
    await expect(page.getByTestId('app-bar-item-insights')).not.toBeVisible();

    await navigateToPersonaNavigation(page);
    await exploreSwitch.click();
    await insightsSwitch.click();

    const restoreResponse = page.waitForResponse('**/api/v1/docStore/**');
    await page.getByTestId('save-button').click();
    await restoreResponse;
  });
});
