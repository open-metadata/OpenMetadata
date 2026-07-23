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
import { expect, Page } from '@playwright/test';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { navigateToExploreAndSelectEntity } from '../../utils/explore';

/**
 * Navigate to the explore page and open the right panel for the Knowledge Center entity.
 * KC entities are not in ENDPOINT_TO_FILTER_MAP, so no category filter is applied.
 */
export async function navigateToKCEntity(page: Page, entityName: string) {
  const navParams = { page, entityName, exploreTab: 'Knowledge Center' };
  const summaryPanel = page.locator(
    '[data-testid="entity-summary-panel-container"]'
  );
  const entityLink = summaryPanel
    .getByTestId('entity-link')
    .filter({ hasText: entityName });

  await navigateToExploreAndSelectEntity(navParams);
  await summaryPanel.waitFor({ state: 'visible' });

  try {
    await expect(entityLink).toBeVisible();
  } catch {
    await navigateToExploreAndSelectEntity(navParams);
    await summaryPanel.waitFor({ state: 'visible' });
    await expect(entityLink).toBeVisible();
  }

  await waitForAllLoadersToDisappear(page);
}

export const addOwnerInKCPanel = async (page: Page, ownerName: string) => {
  const panel = page.locator('[data-testid="entity-summary-panel-container"]');
  await panel.getByTestId('edit-owners').click();

  const ownerTabs = page.getByTestId('select-owner-tabs');
  await ownerTabs.waitFor({ state: 'visible' });

  const teamsTab = ownerTabs.locator('[data-node-key="teams"]');
  const usersTab = ownerTabs.locator('[data-node-key="users"]');
  const searchBar = page.getByTestId('owner-select-users-search-bar');

  await waitForAllLoadersToDisappear(page);

  const isTeamsActive = await teamsTab.evaluate((el) =>
    el.classList.contains('ant-tabs-tab-active')
  );

  if (isTeamsActive) {
    await usersTab.click();
    await waitForAllLoadersToDisappear(page);
  }

  await searchBar.waitFor({ state: 'visible', timeout: 30000 });
  await searchBar.scrollIntoViewIfNeeded();

  const searchResponse = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(ownerName)}*`
  );
  await searchBar.fill(ownerName);
  await searchResponse;

  await waitForAllLoadersToDisappear(page);

  const patchResponse = page.waitForResponse(
    (r) =>
      r.url().includes('/api/v1/contextCenter/pages/') &&
      r.request().method() === 'PATCH'
  );
  await page.getByRole('listitem', { name: ownerName }).click();
  await page.getByTestId('selectable-list-update-btn').click();
  await patchResponse;
};
