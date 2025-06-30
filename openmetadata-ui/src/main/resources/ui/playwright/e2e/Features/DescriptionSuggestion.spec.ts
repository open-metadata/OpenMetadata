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
import { createTableDescriptionSuggestions } from '../../utils/suggestions';
import { performUserLogin } from '../../utils/user';

const table = new TableClass();
const table2 = new TableClass();
const user1 = new UserClass();
const user2 = new UserClass();
const user3 = new UserClass();
let entityLinkList: string[];

test.describe('Description Suggestions Table Entity', () => {
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
    await user3.create(apiContext);

    // Create suggestions for both users
    for (const entityLink of entityLinkList) {
      await createTableDescriptionSuggestions(apiContext, entityLink);
    }

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);
    // await table.delete(apiContext);
    // await table2.delete(apiContext);
    // await user1.delete(apiContext);
    // await user2.delete(apiContext);
    // await user3.delete(apiContext);
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
        page.getByTestId('suggested-SuggestDescription-card')
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
          `[data-row-key*=${table.columnsName[0]}] [data-testid="description"]`
        )
      ).toContainText('this is suggested data description');
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
          `[data-row-key*=${table.columnsName[1]}] [data-testid="description"]`
        )
      ).not.toContainText('this is suggested data description');
    });

    await test.step('Accept all Suggestion', async () => {
      const allAvatarSuggestion = page
        .getByTestId('asset-description-container')
        .getByTestId('profile-avatar');

      // Click the first avatar
      await allAvatarSuggestion.nth(0).click();

      const acceptResponse = page.waitForResponse(
        '/api/v1/suggestions/accept-all?userId=*&entityFQN=*&suggestionType=SuggestDescription'
      );

      await page.click(`[data-testid="accept-all-suggestions"]`);

      await acceptResponse;

      // check the third column description, since other two are already checked
      await expect(
        page.locator(
          `[data-row-key*=${table.columnsName[5]}] [data-testid="description"]`
        )
      ).toContainText('this is suggested data description');

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
      '/api/v1/suggestions/reject-all?userId=*&entityFQN=*&suggestionType=SuggestDescription'
    );

    await page.click(`[data-testid="reject-all-suggestions"]`);

    await acceptResponse;

    // check the last column description
    await expect(
      page.locator(
        `[data-row-key*=${table.columnsName[1]}] [data-testid="description"]`
      )
    ).not.toContainText('this is suggested data description');

    // Actions Buttons should not be visible
    await expect(page.getByTestId('accept-all-suggestions')).not.toBeVisible();
    await expect(page.getByTestId('reject-all-suggestions')).not.toBeVisible();
    await expect(page.getByTestId('close-suggestion')).not.toBeVisible();

    await afterAction();
  });

  test('Fetch on avatar click  and then all Pending Suggestions', async ({
    browser,
  }) => {
    const { page, afterAction } = await performAdminLogin(browser);
    const { afterAction: afterAction2, apiContext: apiContext2 } =
      await performUserLogin(browser, user1);
    const { afterAction: afterAction3, apiContext: apiContext3 } =
      await performUserLogin(browser, user2);
    const { afterAction: afterAction4, apiContext: apiContext4 } =
      await performUserLogin(browser, user3);

    for (const entityLink of entityLinkList) {
      await createTableDescriptionSuggestions(apiContext2, entityLink);
      await createTableDescriptionSuggestions(apiContext3, entityLink);
      await createTableDescriptionSuggestions(apiContext4, entityLink);
    }

    await redirectToHomePage(page);
    await table.visitEntityPage(page);

    const avatarSuggestion = page.waitForResponse(
      `/api/v1/suggestions?entityFQN=*userId=*`
    );
    await page
      .getByTestId('asset-description-container')
      .getByTestId('profile-avatar')
      .nth(0)
      .click();

    await avatarSuggestion;

    await expect(page.getByTestId('more-suggestion-button')).toBeVisible();

    const fetchMoreSuggestionResponse = page.waitForResponse(
      '/api/v1/suggestions?entityFQN=*&limit=*'
    );
    await page.getByTestId('more-suggestion-button').click();
    await fetchMoreSuggestionResponse;

    const allAvatarSuggestion = page
      .getByTestId('asset-description-container')
      .getByTestId('profile-avatar');

    // Click the first avatar
    await expect(allAvatarSuggestion).toHaveCount(3);

    await afterAction();
    await afterAction2();
    await afterAction3();
    await afterAction4();
  });

  test('Should fetch initial 10 suggestions on entity change from table1 to table2', async ({
    browser,
  }) => {
    // Jumping from one table to another table to check if the suggestions are fetched correctly
    // due to provider boundary on entity.

    const { page, afterAction } = await performAdminLogin(browser);

    await redirectToHomePage(page);

    const suggestionFetchCallResponse = page.waitForResponse(
      '/api/v1/suggestions?entityFQN=*&limit=10'
    );
    await table2.visitEntityPage(page);
    await suggestionFetchCallResponse;

    const suggestionFetchCallResponse2 = page.waitForResponse(
      '/api/v1/suggestions?entityFQN=*&limit=10'
    );
    await table.visitEntityPage(page);
    await suggestionFetchCallResponse2;

    await afterAction();
  });
});
