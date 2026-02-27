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

import { Page } from '@playwright/test';
import { DataProduct } from '../support/domain/DataProduct';
import { Domain } from '../support/domain/Domain';
import { GlossaryTerm } from '../support/glossary/GlossaryTerm';
import { TagClass } from '../support/tag/TagClass';
import { TeamClass } from '../support/team/TeamClass';
import { UserClass } from '../support/user/UserClass';
import { redirectToHomePage } from './common';
import { waitForAllLoadersToDisappear } from './entity';
import { visitUserProfilePage } from './user';

const PANEL_SELECTOR = '[data-testid="entity-summary-panel-container"]';

/**
 * Navigate to a glossary term's Assets tab, click the entity row to open the right panel.
 */
export async function navigateToGlossaryTermAssetsAndOpenPanel(
  page: Page,
  glossaryTerm: GlossaryTerm,
  entityFqn: string
): Promise<void> {
  await glossaryTerm.visitPage(page);
  const assetsRes = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=all')
  );
  await page.getByTestId('assets').click();
  await assetsRes.catch(() => {
    // Search response may come quickly — continue regardless
  });
  await waitForAllLoadersToDisappear(page);
  const card = page.getByTestId(`table-data-card_${entityFqn}`);
  await card.waitFor({ state: 'visible' });
  // dispatchEvent fires the click on the outer card div directly, so the entity-link
  // child is never the event target and React Router never triggers navigation.
  await card.dispatchEvent('click');
  await page.waitForSelector(PANEL_SELECTOR, { state: 'visible' });
}

/**
 * Navigate to a classification tag's assets page, click the entity row to open the right panel.
 */
export async function navigateToTagAssetsAndOpenPanel(
  page: Page,
  tag: TagClass,
  entityFqn: string
): Promise<void> {
  await page.goto(
    `/tag/${encodeURIComponent(tag.responseData.fullyQualifiedName)}/assets`
  );
  await page.waitForLoadState('networkidle');
  await waitForAllLoadersToDisappear(page);
  const tagCard = page.getByTestId(`table-data-card_${entityFqn}`);
  await tagCard.waitFor({ state: 'visible' });
  await tagCard.dispatchEvent('click');
  await page.waitForSelector(PANEL_SELECTOR, { state: 'visible' });
}

/**
 * Navigate to a domain's Data Products tab, click a data product card to open the right panel.
 * Clicks the card body (not the entity-link) to trigger the panel rather than navigating to the detail page.
 */
export async function navigateToDomainDataProductsAndOpenPanel(
  page: Page,
  domain: Domain,
  dataProduct: DataProduct
): Promise<void> {
  await redirectToHomePage(page);
  await domain.visitEntityPage(page);

  const dpRes = page.waitForResponse((response) => {
    const url = response.url();

    return (
      url.includes('/api/v1/search/query') &&
      url.includes('index=data_product_search_index')
    );
  });

  await page
    .locator('.domain-details-page-tabs')
    .getByText('Data Products')
    .click();
  await dpRes;
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  // dispatchEvent fires the click on the card's outer div directly; the entity-link child
  // never becomes the event target, so React Router does not navigate away.
  const card = page.getByTestId(`explore-card-${dataProduct.data.name}`);
  await card.waitFor({ state: 'visible' });
  await card.dispatchEvent('click');

  await page.waitForSelector(PANEL_SELECTOR, { state: 'visible' });
}

/**
 * Navigate to a team's Assets tab, click the entity row to open the right panel.
 */
export async function navigateToTeamAssetsAndOpenPanel(
  page: Page,
  team: TeamClass,
  entityFqn: string
): Promise<void> {
  await redirectToHomePage(page);
  await team.visitTeamPage(page);
  const assetsRes = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.status() === 200
  );
  await page.getByTestId('assets').click();
  await assetsRes;
  await waitForAllLoadersToDisappear(page);
  const teamCard = page.getByTestId(`table-data-card_${entityFqn}`);
  await teamCard.waitFor({ state: 'visible' });
  await teamCard.dispatchEvent('click');
  await page.waitForSelector(PANEL_SELECTOR, { state: 'visible' });
}

/**
 * Navigate to a user's profile Assets tab, click the entity row to open the right panel.
 */
export async function navigateToUserAssetsAndOpenPanel(
  page: Page,
  user: UserClass,
  entityFqn: string
): Promise<void> {
  await redirectToHomePage(page);
  await visitUserProfilePage(page, user.responseData.name);
  await page.getByTestId('assets').click();
  await waitForAllLoadersToDisappear(page);
  const userCard = page.getByTestId(`table-data-card_${entityFqn}`);
  await userCard.waitFor({ state: 'visible' });
  await userCard.dispatchEvent('click');
  await page.waitForSelector(PANEL_SELECTOR, { state: 'visible' });
}
