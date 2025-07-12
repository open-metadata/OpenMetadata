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
import test, { expect } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { createTableTagsSuggestions } from '../../utils/suggestions';

const table = new TableClass();
const table2 = new TableClass();
const user1 = new UserClass();
const user2 = new UserClass();
let entityLinkList: string[];

test.describe('Tags Suggestions Table Entity', () => {
  test.slow(true);

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);
    await table.create(apiContext);
    await table2.create(apiContext);

    entityLinkList = table.entityLinkColumnsName.map(
      (entityLinkName) =>
        `<#E::table::${table.entityResponseData.fullyQualifiedName}::columns::${entityLinkName}>`
    );
    await user1.create(apiContext);
    await user2.create(apiContext);

    // Create suggestions for both users
    for (const entityLink of entityLinkList) {
      await createTableTagsSuggestions(apiContext, entityLink);
    }

    await afterAction();
  });

  test('View, Close, Reject and Accept the Suggestions', async ({
    browser,
  }) => {
    const { page, afterAction } = await performAdminLogin(browser);

    await test.step('View and Open the Suggestions', async () => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);

      await expect(page.getByText('Suggested Descriptions')).toBeVisible();

      const allAvatarSuggestion = page
        .getByTestId('asset-description-container')
        .getByTestId('profile-avatar');

      // Two users profile will be visible, 3rd one will come after AllFetch is clicked
      await expect(allAvatarSuggestion).toHaveCount(1);

      // Click the first avatar
      await allAvatarSuggestion.nth(0).click();

      // Actions Buttons should be visible
      await expect(page.getByTestId('accept-all-suggestions')).toBeVisible();
      await expect(page.getByTestId('reject-all-suggestions')).toBeVisible();
      await expect(page.getByTestId('close-suggestion')).toBeVisible();

      // All Column Suggestions Card should be visible
      await expect(
        page.getByTestId('suggested-SuggestTagLabel-card')
      ).toHaveCount(6);

      // Close the suggestions
      await page.getByTestId('close-suggestion').click();

      await expect(allAvatarSuggestion).toHaveCount(1); // suggestion should not reject or disappear
    });

    await test.step('Accept Single Suggestion', async () => {
      const allAvatarSuggestion = page
        .getByTestId('asset-description-container')
        .getByTestId('profile-avatar');

      // Click the first avatar
      await allAvatarSuggestion.nth(0).click();

      const singleResolveResponse = page.waitForResponse(
        '/api/v1/suggestions/*/accept'
      );

      await page
        .locator(
          `[data-row-key*=${table.columnsName[0]}] [data-testid="accept-suggestion"]`
        )
        .click();

      await singleResolveResponse;

      await expect(
        page.locator(
          `[data-row-key*=${table.columnsName[0]}] [data-testid="tags-container"]`
        )
      ).toContainText('Personal');
    });

    await test.step('Reject Single Suggestion', async () => {
      const allAvatarSuggestion = page
        .getByTestId('asset-description-container')
        .getByTestId('profile-avatar');

      // Click the first avatar
      await allAvatarSuggestion.nth(0).click();

      const singleResolveResponse = page.waitForResponse(
        '/api/v1/suggestions/*/reject'
      );

      await page
        .locator(
          `[data-row-key*=${table.columnsName[1]}] [data-testid="reject-suggestion"]`
        )
        .click();

      await singleResolveResponse;

      await expect(
        page.locator(
          `[data-row-key*=${table.columnsName[1]}] [data-testid="tags-container"]`
        )
      ).not.toContainText('Personal');
    });

    await test.step('Accept all Suggestion', async () => {
      const allAvatarSuggestion = page
        .getByTestId('asset-description-container')
        .getByTestId('profile-avatar');

      // Click the first avatar
      await allAvatarSuggestion.nth(0).click();

      const acceptResponse = page.waitForResponse(
        '/api/v1/suggestions/accept-all?userId=*&entityFQN=*&suggestionType=SuggestTagLabel'
      );

      await page.click(`[data-testid="accept-all-suggestions"]`);

      await acceptResponse;

      // check the third column description, since other two are already checked
      await expect(
        page.locator(
          `[data-row-key*=${table.columnsName[5]}] [data-testid="tags-container"]`
        )
      ).toContainText('Personal');

      // Actions Buttons should not be visible
      await expect(
        page.getByTestId('accept-all-suggestions')
      ).not.toBeVisible();
      await expect(
        page.getByTestId('reject-all-suggestions')
      ).not.toBeVisible();
      await expect(page.getByTestId('close-suggestion')).not.toBeVisible();
    });

    await afterAction();
  });

  test('Accept the Suggestions for Tier Card', async ({ browser }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser);

    await createTableTagsSuggestions(
      apiContext,
      `<#E::table::${table.entityResponseData.fullyQualifiedName}>`,
      true
    );

    await redirectToHomePage(page);
    await table.visitEntityPage(page);

    const allAvatarSuggestion = page
      .getByTestId('asset-description-container')
      .getByTestId('profile-avatar');

    // Click the first avatar
    await allAvatarSuggestion.nth(0).click();

    const singleResolveResponse = page.waitForResponse(
      '/api/v1/suggestions/*/accept'
    );

    await page
      .locator(
        `[data-testid="tier-suggestion-container"] [data-testid="accept-suggestion"]`
      )
      .click();

    await singleResolveResponse;

    await expect(
      page.locator(
        `[data-testid="header-tier-container"] [data-testid="tag-redirect-link"]`
      )
    ).toContainText('Tier1');

    await afterAction();
  });

  test('Reject All Suggestions', async ({ browser }) => {
    const { page, afterAction } = await performAdminLogin(browser);

    await redirectToHomePage(page);
    await table.visitEntityPage(page);

    const allAvatarSuggestion = page
      .getByTestId('asset-description-container')
      .getByTestId('profile-avatar');

    // Click the first avatar
    await allAvatarSuggestion.nth(0).click();

    const acceptResponse = page.waitForResponse(
      '/api/v1/suggestions/reject-all?userId=*&entityFQN=*&suggestionType=SuggestTagLabel'
    );

    await page.click(`[data-testid="reject-all-suggestions"]`);

    await acceptResponse;

    // check the last column tags
    await expect(
      page.locator(
        `[data-row-key*=${table.columnsName[1]}] [data-testid="tags-container"]`
      )
    ).not.toContainText('Personal');

    // Actions Buttons should not be visible
    await expect(page.getByTestId('accept-all-suggestions')).not.toBeVisible();
    await expect(page.getByTestId('reject-all-suggestions')).not.toBeVisible();
    await expect(page.getByTestId('close-suggestion')).not.toBeVisible();

    await afterAction();
  });
});
