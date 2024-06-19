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
import { SidebarItem } from '../constant/sidebar';
import { GLOSSARY_TERM_PATCH_PAYLOAD } from '../constant/version';
import { EntityTypeEndpoint } from '../support/entity/Entity.interface';
import { Glossary } from '../support/glossary/Glossary';
import { GlossaryTerm } from '../support/glossary/GlossaryTerm';
import { getApiContext, redirectToHomePage } from './common';
import { sidebarClick } from './sidebar';

export const visitGlossaryPage = async (page: Page, glossaryName: string) => {
  await redirectToHomePage(page);
  const glossaryResponse = page.waitForResponse('/api/v1/glossaries?fields=*');
  await sidebarClick(page, SidebarItem.GLOSSARY);
  await glossaryResponse;
  await page.getByRole('menuitem', { name: glossaryName }).click();
};

export const addMultiOwner = async (data: {
  page: Page;
  ownerNames: string | string[];
  activatorBtnDataTestId: string;
  endpoint: EntityTypeEndpoint;
  resultTestId?: string;
  isSelectableInsideForm?: boolean;
}) => {
  const {
    page,
    ownerNames,
    activatorBtnDataTestId,
    resultTestId = 'owner-link',
    isSelectableInsideForm = false,
    endpoint,
  } = data;
  const isMultipleOwners = Array.isArray(ownerNames);
  const owners = isMultipleOwners ? ownerNames : [ownerNames];

  const getUsers = page.waitForResponse('/api/v1/users?*isBot=false*');

  await page.click(`[data-testid="${activatorBtnDataTestId}"]`);

  expect(page.locator("[data-testid='select-owner-tabs']")).toBeVisible();

  await page.click('.ant-tabs [id*=tab-users]');
  await getUsers;
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  if (isMultipleOwners) {
    await page.click('[data-testid="clear-all-button"]');
  }

  for (const ownerName of owners) {
    const searchOwner = page.waitForResponse(
      'api/v1/search/query?q=*&index=user_search_index*'
    );
    await page.locator('[data-testid="owner-select-users-search-bar"]').clear();
    await page.fill('[data-testid="owner-select-users-search-bar"]', ownerName);
    await searchOwner;
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
    await page.getByRole('listitem', { name: ownerName }).click();
  }

  const patchResponse = page.waitForResponse(`/api/v1/${endpoint}/*`);
  if (isMultipleOwners) {
    await page.click('[data-testid="selectable-list-update-btn"]');
  }

  if (!isSelectableInsideForm) {
    await patchResponse;
  }

  for (const name of owners) {
    await expect(page.locator(`[data-testid="${resultTestId}"]`)).toContainText(
      name
    );
  }
};

export const removeReviewer = async (
  page: Page,
  endpoint: EntityTypeEndpoint
) => {
  const patchResponse = page.waitForResponse(`/api/v1/${endpoint}/*`);

  await page.click('[data-testid="edit-reviewer-button"]');

  await page.click('[data-testid="clear-all-button"]');

  await page.click('[data-testid="selectable-list-update-btn"]');

  await patchResponse;

  await expect(
    page.locator('[data-testid="glossary-reviewer"] [data-testid="Add"]')
  ).toBeVisible();
};

// Create a glossary and two glossary terms, then link them with a related term relationship
export const setupGlossaryAndTerms = async (page: Page) => {
  const glossary = new Glossary();
  const term1 = new GlossaryTerm(glossary.data.name);
  const term2 = new GlossaryTerm(glossary.data.name);

  // Get API context for performing operations
  const { apiContext, afterAction } = await getApiContext(page);

  // Create glossary and terms
  await glossary.create(apiContext);
  await term1.create(apiContext);
  await term2.create(apiContext);

  // Prepare the payload for linking term2 as a related term to term1
  const relatedTermLink = {
    op: 'add',
    path: '/relatedTerms/0',
    value: {
      id: term1.responseData.id,
      type: 'glossaryTerm',
      displayName: term1.responseData.displayName,
      name: term1.responseData.name,
    },
  };

  // Update term2 to include term1 as a related term
  await term2.patch(apiContext, [
    ...GLOSSARY_TERM_PATCH_PAYLOAD,
    relatedTermLink,
  ]);

  const cleanup = async () => {
    await glossary.delete(apiContext);
    await afterAction();
  };

  return { glossary, term1, term2, cleanup };
};
