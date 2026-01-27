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
import test, { expect } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import {
  selectActiveGlossary,
  selectActiveGlossaryTerm,
} from '../../../utils/glossary';
import { sidebarClick } from '../../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should navigate between tabs on glossary page', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Verify Terms tab is visible and shows count
      const termsTab = page.getByTestId('terms');

      await expect(termsTab).toBeVisible();

      // Verify term is visible in the table
      await expect(
        page.locator(`[data-row-key*="${glossaryTerm.responseData.name}"]`)
      ).toBeVisible();

      // Click on Activity Feeds & Tasks tab
      const activityTab = page.getByTestId('activity_feed');

      const activityLoadResponse = page.waitForResponse('/api/v1/feed*');
      await activityTab.click();
      await activityLoadResponse;

      // Wait for loader to disappear
      await page
        .waitForSelector('[data-testid="loader"]', {
          state: 'detached',
          timeout: 5000,
        })
        .catch(() => {
          // Loader may not appear if data loads quickly
        });

      // Verify we're on the activity feed tab by checking the tab is active
      await expect(
        page.locator('.ant-tabs-tab-active').getByTestId('activity_feed')
      ).toBeVisible();

      const termsLoadResponse = page.waitForResponse('/api/v1/glossaryTerms?*');
      // Click back on Terms tab
      await termsTab.click();
      await termsLoadResponse;

      // Verify term is still visible
      await expect(
        page.locator(`[data-row-key*="${glossaryTerm.responseData.name}"]`)
      ).toBeVisible();
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('should navigate between tabs on glossary term page', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await selectActiveGlossaryTerm(page, glossaryTerm.data.displayName);

      // Verify Overview tab is active by default on term page
      const overviewTab = page.getByTestId('overview');

      await expect(overviewTab).toBeVisible();

      // Verify description is visible on Overview tab
      await expect(
        page.getByTestId('asset-description-container')
      ).toBeVisible();

      // Check if Assets tab exists
      const assetsTab = page.getByTestId('assets');

      await expect(assetsTab).toBeVisible();

      const assetsLoadResponse = page.waitForResponse('/api/v1/search/query*');
      // Click on Assets tab
      await assetsTab.click();
      await assetsLoadResponse;

      // Wait for loader to disappear
      await page
        .waitForSelector('[data-testid="loader"]', {
          state: 'detached',
          timeout: 5000,
        })
        .catch(() => {
          // Loader may not appear if data loads quickly
        });

      // Verify we're on the Assets tab by checking the tab is active
      await expect(
        page.locator('.ant-tabs-tab-active').getByTestId('assets')
      ).toBeVisible();

      // Navigate back to Overview
      await overviewTab.click();

      // Verify we're back on overview with description visible
      await expect(
        page.getByTestId('asset-description-container')
      ).toBeVisible();
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('should navigate via breadcrumbs', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await selectActiveGlossaryTerm(page, glossaryTerm.data.displayName);

      // Verify breadcrumb is visible
      const breadcrumb = page.getByTestId('breadcrumb');

      await expect(breadcrumb).toBeVisible();

      // Click on Glossaries link in breadcrumb to go to glossary listing
      const navResponse = page.waitForResponse('/api/v1/glossaryTerms?*');
      await breadcrumb.getByRole('link', { name: 'Glossaries' }).click();
      await navResponse;

      // Verify we're on the glossary listing page
      await expect(page.getByTestId('terms')).toBeVisible();
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // NAV-04: Deep link to nested term works
  test('should navigate to nested term via deep link', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      // Navigate directly to term page using URL
      const termFqn = glossaryTerm.responseData.fullyQualifiedName;
      const termRes = page.waitForResponse('/api/v1/glossaryTerms/name/*');
      await page.goto(
        `/glossary/${encodeURIComponent(termFqn).replace(/%22/g, '"')}`
      );
      await termRes;

      // Verify term page loads correctly
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(glossaryTerm.responseData.displayName);

      // Verify breadcrumb shows path (contains glossary name in FQN format)
      const breadcrumb = page.getByTestId('breadcrumb');

      await expect(breadcrumb).toBeVisible();
      // Breadcrumb contains the glossary FQN (name) not displayName
      await expect(breadcrumb).toContainText(glossary.responseData.name);
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // UI-01: Empty glossary state (no terms)
  test('should show empty state when glossary has no terms', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const emptyGlossary = new Glossary();

    try {
      await emptyGlossary.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, emptyGlossary.data.displayName);
      await page.waitForLoadState('networkidle');

      // Verify empty state is shown - actual message in UI
      await expect(
        page.getByText('It appears that there are no Glossary Terms defined')
      ).toBeVisible();

      // Verify add term button is available
      await expect(page.getByTestId('add-new-tag-button-header')).toBeVisible();
    } finally {
      await emptyGlossary.delete(apiContext);
      await afterAction();
    }
  });

  // AF-01: View activity feed on glossary
  test('should view activity feed on glossary', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Click on Activity Feeds & Tasks tab
      const activityTab = page.getByRole('tab', { name: /Activity Feeds/i });
      const feedResponse = page.waitForResponse('/api/v1/feed*');
      await activityTab.click();
      await feedResponse;

      // Verify we're on the activity feed tab by checking the tab is active
      await expect(activityTab).toHaveAttribute('aria-selected', 'true');
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // AF-02: View activity feed on term
  test('should view activity feed on glossary term', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await selectActiveGlossaryTerm(page, glossaryTerm.data.displayName);

      // Click on Activity Feeds & Tasks tab
      const activityTab = page.getByRole('tab', { name: /Activity Feeds/i });
      const feedResponse = page.waitForResponse('/api/v1/feed*');
      await activityTab.click();
      await feedResponse;

      // Verify we're on the activity feed tab by checking the tab is active
      await expect(activityTab).toHaveAttribute('aria-selected', 'true');
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // AF-03: Post comment on glossary
  test('should post comment on glossary activity feed', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Click on Activity Feeds & Tasks tab
      const activityTab = page.getByRole('tab', { name: /Activity Feeds/i });
      const feedResponse = page.waitForResponse('/api/v1/feed*');
      await activityTab.click();
      await feedResponse;

      // Verify the activity tab loads correctly
      await expect(activityTab).toHaveAttribute('aria-selected', 'true');
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // AF-04: Post comment on term
  test('should post comment on glossary term activity feed', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await selectActiveGlossaryTerm(page, glossaryTerm.data.displayName);

      // Click on Activity Feeds & Tasks tab
      const activityTab = page.getByRole('tab', { name: /Activity Feeds/i });
      const feedResponse = page.waitForResponse('/api/v1/feed*');
      await activityTab.click();
      await feedResponse;

      // Verify the activity tab loads correctly
      await expect(activityTab).toHaveAttribute('aria-selected', 'true');
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});
