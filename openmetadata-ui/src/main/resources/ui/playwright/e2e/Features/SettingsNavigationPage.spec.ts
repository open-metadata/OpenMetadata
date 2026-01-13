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

import { Browser, Page } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { expect, test } from '../../support/fixtures/userPages';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, reloadAndWaitForNetworkIdle } from '../../utils/common';
import { setUserDefaultPersona } from '../../utils/customizeLandingPage';
import { navigateToPersonaWithPagination } from '../../utils/persona';
import { settingClick } from '../../utils/sidebar';

const adminUser = new UserClass();
const persona = new PersonaClass();

test.beforeAll('Setup pre-requests', async ({ browser }: { browser: Browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await persona.create(apiContext, [adminUser.responseData.id]);
  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }: { browser: Browser }) => {
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

  const getDocStore = page.waitForResponse((response: { url: () => string; request: () => { method: () => string } }) =>
    response.url().includes('/api/v1/docStore/name/') && response.request().method() === 'GET'
  );
  await page.getByTestId('navigation').click();
  await getDocStore;
  await page.waitForLoadState('networkidle');

  const escapedPersonaName = persona.data.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '%25');
  await expect(page).toHaveURL(new RegExp(escapedPersonaName));
};

test.describe.serial('Settings Navigation Page Tests', () => {
  test('should update navigation sidebar', async ({ browser }: { browser: Browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await setUserDefaultPersona(page, persona.responseData.displayName);

    await navigateToPersonaNavigation(page);

    await expect(page.getByRole('tree')).toBeVisible();
    await expect(page.getByTestId('save-button')).toBeVisible();
    await expect(page.getByTestId('reset-button')).toBeVisible();

    await expect(page.getByTestId('save-button')).toBeEnabled();

    const exploreSwitch = page
      .locator('.ant-tree-title:has-text("Explore")')
      .locator('.ant-switch');

    await exploreSwitch.click();

    await expect(page.getByTestId('save-button')).toBeEnabled();

    const saveResponse = page.waitForResponse('api/v1/docStore');
    await page.getByTestId('save-button').click();
    await saveResponse;

    await redirectToHomePage(page);

    await expect(page.getByTestId('app-bar-item-explore')).not.toBeVisible();

    await navigateToPersonaNavigation(page);
    await exploreSwitch.click();

    const restoreResponse = page.waitForResponse('api/v1/docStore/*');
    await page.getByTestId('save-button').click();
    await restoreResponse;

    await context.close();
  });

  test('should show navigation blocker when leaving with unsaved changes', async ({
    browser,
  }: { browser: Browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await setUserDefaultPersona(page, persona.responseData.displayName);
    await navigateToPersonaNavigation(page);

    const navigateSwitch = page
      .locator('.ant-tree-title:has-text("Explore")')
      .locator('.ant-switch');

    await navigateSwitch.click();

    await expect(page.getByTestId('save-button')).toBeEnabled();

    await page
      .getByTestId('left-sidebar')
      .getByTestId('app-bar-item-settings')
      .click();

    await expect(page.getByTestId('unsaved-changes-modal-title')).toContainText(
      'Unsaved changes'
    );
    await expect(
      page.getByTestId('unsaved-changes-modal-description')
    ).toContainText('Do you want to save or discard changes?');

    await expect(page.getByTestId('unsaved-changes-modal-save')).toBeVisible();
    await expect(
      page.getByTestId('unsaved-changes-modal-discard')
    ).toBeVisible();

    await page.getByTestId('unsaved-changes-modal-discard').click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/.*settings.*/);

    await context.close();
  });

  test('should save changes and navigate when "Save changes" is clicked in blocker', async ({
    browser,
  }: { browser: Browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await setUserDefaultPersona(page, persona.responseData.displayName);
    await navigateToPersonaNavigation(page);

    const navigateSwitch = page
      .locator('.ant-tree-title:has-text("Insights")')
      .locator('.ant-switch');

    await navigateSwitch.click();

    await page
      .getByTestId('left-sidebar')
      .getByTestId('app-bar-item-settings')
      .click();

    const saveResponse = page.waitForResponse((response: { url: () => string; request: () => { method: () => string } }) =>
      response.url().includes('api/v1/docStore') && response.request().method() === 'PATCH'
    );
    await page.getByTestId('unsaved-changes-modal-save').locator('.ant-btn-loading').waitFor({ state: 'detached' });;
    await page.getByTestId('unsaved-changes-modal-save').click();
    await saveResponse;
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/.*settings.*/);

    await redirectToHomePage(page);

    const insightsVisible = await page
      .getByTestId('left-sidebar')
      .getByTestId('app-bar-item-insights')
      .isVisible();

    expect(insightsVisible).toBe(false);

    await navigateToPersonaNavigation(page);
    await navigateSwitch.click();

    const restoreResponse = page.waitForResponse((response: { url: () => string; request: () => { method: () => string } }) =>
      response.url().includes('api/v1/docStore') && response.request().method() === 'PATCH'
    );
    await page.getByTestId('save-button').click();
    await restoreResponse;

    await context.close();
  });

  test('should handle reset functionality and prevent navigation blocker after save', async ({
    browser,
  }: { browser: Browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await setUserDefaultPersona(page, persona.responseData.displayName);
    await navigateToPersonaNavigation(page);

    const domainSwitch = page
      .locator('.ant-tree-title:has-text("Domains")')
      .first()
      .locator('.ant-switch');

    await domainSwitch.click();

    await expect(page.getByTestId('save-button')).toBeEnabled();

    expect(await domainSwitch.isChecked()).toBeFalsy();

    await page.getByTestId('reset-button').click();

    await expect(page.getByTestId('unsaved-changes-modal-title')).toContainText(
      'Reset Default Layout'
    );
    await expect(
      page.getByTestId('unsaved-changes-modal-description')
    ).toContainText('Are you sure you want to apply the "Default Layout"?');

    await expect(page.getByTestId('unsaved-changes-modal-save')).toBeVisible();
    await expect(
      page.getByTestId('unsaved-changes-modal-discard')
    ).toBeVisible();

    await page.getByTestId('unsaved-changes-modal-save').locator('.ant-btn-loading').waitFor({ state: 'detached' });;

    await page.getByTestId('unsaved-changes-modal-save').click();
    await page.waitForLoadState('networkidle');

    expect(await domainSwitch.isChecked()).toBeTruthy();
    await expect(page.getByTestId('save-button')).toBeDisabled();

    await context.close();
  });

  test('should support drag and drop reordering of navigation items', async ({
    browser,
  }: { browser: Browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await adminUser.login(page);

    await redirectToHomePage(page);
    await setUserDefaultPersona(page, persona.responseData.displayName);
    await navigateToPersonaNavigation(page);

    const treeItems = page.locator('.ant-tree-node-content-wrapper');
    const firstItem = treeItems.first();
    const secondItem = treeItems.nth(1);

    const firstItemText = await firstItem.textContent();

    const firstItemBox = await firstItem.boundingBox();
    const secondItemBox = await secondItem.boundingBox();

    expect(firstItemBox).not.toBeNull();
    expect(secondItemBox).not.toBeNull();

    if (firstItemBox && secondItemBox) {
      await page.mouse.move(
        firstItemBox.x + firstItemBox.width / 2,
        firstItemBox.y + firstItemBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        secondItemBox.x + secondItemBox.width / 2,
        secondItemBox.y + secondItemBox.height / 2 + 10
      );
      await page.mouse.up();

      await page.waitForTimeout(500);

      await expect(page.getByTestId('save-button')).toBeEnabled();

      const newFirstItemText = await treeItems.first().textContent();

      expect(newFirstItemText).not.toBe(firstItemText);
    }

    await context.close();
  });

  test('should handle multiple items being hidden at once', async ({
    browser,
  }: { browser: Browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await adminUser.login(page);

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

    const exploreInitialState = await exploreSwitch.isChecked();
    const insightsInitialState = await insightsSwitch.isChecked();

    await exploreSwitch.click();
    await expect(exploreSwitch).toBeChecked({ checked: !exploreInitialState });

    await insightsSwitch.click();
    await expect(insightsSwitch).toBeChecked({ checked: !insightsInitialState });

    await expect(page.getByTestId('save-button')).toBeEnabled();

    const saveResponse = page.waitForResponse((response: { url: () => string; request: () => { method: () => string } }) =>
      response.url().includes('api/v1/docStore') && response.request().method() === 'PATCH'
    );
    await page.getByTestId('save-button').click();
    await saveResponse;

    await redirectToHomePage(page);

    if (exploreInitialState) {
      await expect(page.getByTestId('app-bar-item-explore')).not.toBeVisible();
    } else {
      await expect(page.getByTestId('app-bar-item-explore')).toBeVisible();
    }

    if (insightsInitialState) {
      await expect(page.getByTestId('app-bar-item-insights')).not.toBeVisible();
    } else {
      await expect(page.getByTestId('app-bar-item-insights')).toBeVisible();
    }

    await navigateToPersonaNavigation(page);

    const exploreSwitchAfterNav = page
      .locator('.ant-tree-title:has-text("Explore")')
      .locator('.ant-switch')
      .first();
    const insightsSwitchAfterNav = page
      .locator('.ant-tree-title:has-text("Insights")')
      .locator('.ant-switch')
      .first();

    await exploreSwitchAfterNav.click();
    await expect(exploreSwitchAfterNav).toBeChecked({ checked: exploreInitialState });

    await insightsSwitchAfterNav.click();
    await expect(insightsSwitchAfterNav).toBeChecked({ checked: insightsInitialState });

    const restoreResponse = page.waitForResponse((response: { url: () => string; request: () => { method: () => string } }) =>
      response.url().includes('api/v1/docStore') && response.request().method() === 'PATCH'
    );
    await page.getByTestId('save-button').click();
    await restoreResponse;

    await context.close();
  });
});
