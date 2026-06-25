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
  await getPersonas;

  await navigateToPersonaWithPagination(page, persona.data.name, true);

  await page.getByTestId('navigation').click();
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
    const exploreSwitch = page.getByTestId('navigation-switch-/explore');

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
    const navigateSwitch = page.getByTestId('navigation-switch-/explore');

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

    // Should navigate to settings page
    await expect(page).toHaveURL(/.*settings.*/);

    //   Verify changes were saved by checking navigation bar
    await redirectToHomePage(page);

    // Check if Insights navigation item visibility changed
    await expect(
      page.getByTestId('left-sidebar').getByTestId('app-bar-item-insights')
    ).toBeHidden();

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

    await expect(domainSwitch).not.toBeChecked();

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

    // Verify reset worked - save button disabled and state reverted
    await expect(domainSwitch).toBeChecked();
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

    const homeItem = treeItems.getByTitle('label.home');
    const exploreItem = treeItems.getByTitle('label.explore');

    const firstItemText = await homeItem.textContent();

    expect(firstItemText).not.toBeNull();

    const firstItemBox = await homeItem.boundingBox();
    const secondItemBox = await exploreItem.boundingBox();

    expect(firstItemBox).not.toBeNull();
    expect(secondItemBox).not.toBeNull();

    if (firstItemBox && secondItemBox) {
      await homeItem.dragTo(exploreItem, {
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

    const exploreSwitch = page.getByTestId('navigation-switch-/explore');
    const insightsSwitch = page
      .locator('.ant-tree-title:has-text("Insights")')
      .locator('.ant-switch')
      .first();

    await exploreSwitch.click();
    await insightsSwitch.click();

    await expect(page.getByTestId('save-button')).toBeEnabled();

    const saveResponse = page.waitForResponse('**/api/v1/docStore/**');
    await page.getByTestId('save-button').click();
    await saveResponse;

    await redirectToHomePage(page);

    await page.locator('[data-testid="dropdown-profile"]').click();
    await page
      .locator('[role="menu"].profile-dropdown')
      .waitFor({ state: 'visible' });

    // Verify personas section is visible
    await expect(page.getByText('Switch Persona')).toBeVisible();

    // Initially should show limited personas (2 by default)
    await page
      .getByRole('menuitem', { name: persona.responseData.displayName })
      .click();
    await expect(page.getByTestId('app-bar-item-explore')).not.toBeVisible();
    await expect(page.getByTestId('app-bar-item-insights')).not.toBeVisible();

    await navigateToPersonaNavigation(page);
    await exploreSwitch.click();
    await insightsSwitch.click();

    const restoreResponse = page.waitForResponse('**/api/v1/docStore/**');
    await page.getByTestId('save-button').click();
    await restoreResponse;
  });

  // Regression for issue #28738: navigation ordering customisations used to
  // revert to the default tree order after saving and reopening the page.
  test('should persist a reordered sub-item after reload', async ({ page }) => {
    test.slow();

    await redirectToHomePage(page);
    await setUserDefaultPersona(page, persona.responseData.displayName);
    await navigateToPersonaNavigation(page);

    const treeItems = page.locator('.ant-tree-node-content-wrapper');

    await expect(treeItems.first()).toBeVisible();

    // Data Quality and Incident Manager are adjacent children of Observability
    // near the top of the tree, which keeps the drag reliable.
    const dataQualityItem = treeItems.getByTitle('label.data-quality');
    const incidentManagerItem = treeItems.getByTitle('label.incident-manager');

    await expect(dataQualityItem).toBeVisible();
    await expect(incidentManagerItem).toBeVisible();

    const isDataQualityBelowIncidentManager = async () => {
      const dataQualityBox = await dataQualityItem.boundingBox();
      const incidentManagerBox = await incidentManagerItem.boundingBox();

      return (dataQualityBox?.y ?? 0) > (incidentManagerBox?.y ?? 0);
    };

    // Default order renders Data Quality above Incident Manager
    expect(await isDataQualityBelowIncidentManager()).toBe(false);

    const dataQualityBox = await dataQualityItem.boundingBox();
    const incidentManagerBox = await incidentManagerItem.boundingBox();

    expect(dataQualityBox).not.toBeNull();
    expect(incidentManagerBox).not.toBeNull();

    // Drag Data Quality just below Incident Manager to reorder within the group
    await dataQualityItem.dragTo(incidentManagerItem, {
      sourcePosition: {
        x: (dataQualityBox?.width ?? 0) / 2,
        y: (dataQualityBox?.height ?? 0) / 2,
      },
      targetPosition: {
        x: (incidentManagerBox?.width ?? 0) / 2,
        y: (incidentManagerBox?.height ?? 0) / 2 + 10,
      },
    });

    await expect.poll(isDataQualityBelowIncidentManager).toBe(true);
    await expect(page.getByTestId('save-button')).toBeEnabled();

    const saveResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/docStore') &&
        [200, 201].includes(response.status())
    );
    await page.getByTestId('save-button').click();
    await saveResponse;

    // Reopen the page: the new order must persist, not revert to default
    await redirectToHomePage(page);
    await navigateToPersonaNavigation(page);

    await expect(treeItems.first()).toBeVisible();
    await expect(dataQualityItem).toBeVisible();
    await expect(incidentManagerItem).toBeVisible();

    await expect.poll(isDataQualityBelowIncidentManager).toBe(true);

    // Cleanup: restore the default navigation layout
    await page.getByTestId('reset-button').click();

    await expect(page.getByTestId('unsaved-changes-modal-title')).toContainText(
      'Reset Default Layout'
    );

    await page.getByTestId('unsaved-changes-modal-save').click();

    await expect(page.getByTestId('save-button')).toBeEnabled();

    const resetResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/docStore') &&
        [200, 201].includes(response.status())
    );
    await page.getByTestId('save-button').click();
    await resetResponse;
  });

  // Issue #28738 follow-up: the rendered sidebar must reflect a cross-group
  // move once the persona is applied, not just the editor tree.
  test('should reflect a sub-item moved to another group in the sidebar after applying the persona', async ({
    page,
  }) => {
    test.slow();

    await redirectToHomePage(page);
    await setUserDefaultPersona(page, persona.responseData.displayName);
    await navigateToPersonaNavigation(page);

    const treeItems = page.locator('.ant-tree-node-content-wrapper');

    await expect(treeItems.first()).toBeVisible();

    const testLibraryItem = treeItems.getByTitle('label.test-library');
    const overviewItem = treeItems.getByTitle('label.overview');
    const dataMarketplaceItem = treeItems.getByTitle(
      'label.data-marketplace-section'
    );

    await expect(testLibraryItem).toBeVisible();
    await expect(overviewItem).toBeVisible();

    // Move Test Library (an Observability child) into the Data Marketplace
    // group by dropping it just after Overview (between two of its children).
    // HTML5 drag-and-drop is occasionally dropped by the browser, so retry the
    // drag until Test Library actually renders below the Data Marketplace header.
    await expect(async () => {
      const testLibraryBox = await testLibraryItem.boundingBox();
      const overviewBox = await overviewItem.boundingBox();

      expect(testLibraryBox).not.toBeNull();
      expect(overviewBox).not.toBeNull();

      await testLibraryItem.dragTo(overviewItem, {
        sourcePosition: {
          x: (testLibraryBox?.width ?? 0) / 2,
          y: (testLibraryBox?.height ?? 0) / 2,
        },
        targetPosition: {
          x: (overviewBox?.width ?? 0) / 2,
          y: (overviewBox?.height ?? 0) / 2 + 10,
        },
      });

      const testLibraryY = (await testLibraryItem.boundingBox())?.y ?? 0;
      const dataMarketplaceY =
        (await dataMarketplaceItem.boundingBox())?.y ?? 0;

      expect(testLibraryY).toBeGreaterThan(dataMarketplaceY);
    }).toPass({ timeout: 30000 });

    await expect(page.getByTestId('save-button')).toBeEnabled();

    const saveResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/docStore') &&
        [200, 201].includes(response.status())
    );
    await page.getByTestId('save-button').click();
    await saveResponse;

    // Apply the persona, then open the Data Marketplace section in the sidebar
    await redirectToHomePage(page);
    await page.getByTestId('dropdown-profile').click();
    await page
      .locator('[role="menu"].profile-dropdown')
      .waitFor({ state: 'visible' });
    await page
      .getByRole('menuitem', { name: persona.responseData.displayName })
      .click();

    await page.hover('[data-testid="left-sidebar"]');
    await page.click('[data-testid="data-marketplace-section"]');

    // The moved item is now rendered under the Data Marketplace section
    await expect(
      page.locator('[data-testid="app-bar-item-test-library"]').first()
    ).toBeVisible();

    await page.click('[data-testid="data-marketplace-section"]');

    // Cleanup: restore the default navigation layout
    await navigateToPersonaNavigation(page);
    await page.getByTestId('reset-button').click();

    await expect(page.getByTestId('unsaved-changes-modal-title')).toContainText(
      'Reset Default Layout'
    );

    await page.getByTestId('unsaved-changes-modal-save').click();

    await expect(page.getByTestId('save-button')).toBeEnabled();

    const resetResponseAfterMove = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/docStore') &&
        [200, 201].includes(response.status())
    );
    await page.getByTestId('save-button').click();
    await resetResponseAfterMove;
  });
});
