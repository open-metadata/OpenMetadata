/*
 *  Copyright 2026 Collate.
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

import { expect, test } from '../../../support/fixtures/isolatedUser';
import { openAiProfile } from '../../../utils/aiProfile';
import { okJson } from '../../../utils/apiResponse';
import { getApiContext } from '../../../utils/common';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

// The token is created for and revoked by a per-test account, so retries and
// parallel shards never contend for the shared admin's token.
test.describe(
  'Profile personal access token',
  { tag: ['@Platform', '@Features'] },
  () => {
    test('asks for confirmation before revoking the personal access token', async ({
      freshUserPage: { page, user },
    }) => {
      await test.step('Create a token for the signed-in user', async () => {
        await openAiProfile(page);
        const { apiContext, afterAction } = await getApiContext(page);
        try {
          await okJson(
            await apiContext.put('/api/v1/users/security/token', {
              data: {
                JWTTokenExpiry: 'OneHour',
                tokenName: `pw-token-${user.responseData.name}`,
              },
            }),
            'Create personal access token'
          );
        } finally {
          await afterAction();
        }
      });

      await test.step('Open the access token panel', async () => {
        const tokenResponse = waitForResponseWithStatus(
          page,
          (response) =>
            new URL(response.url()).pathname ===
              '/api/v1/users/security/token' &&
            response.request().method() === 'GET',
          200
        );
        await page.getByTestId('profile-nav-access-token').click();
        await tokenResponse;
      });

      const revokeButton = page.getByTestId('revoke-token');
      const popover = page.getByTestId('revoke-token-popover');

      await test.step('Cancel keeps the token', async () => {
        await revokeButton.click();

        await expect(popover).toBeVisible();
        await expect(popover).toContainText(
          'Are you sure you want to revoke access for Personal Access Token?'
        );

        await page.getByTestId('revoke-token-popover-cancel').click();

        await expect(popover).toBeHidden();
        await expect(revokeButton).toBeVisible();
      });

      await test.step('Confirm revokes the token', async () => {
        await revokeButton.click();
        await expect(popover).toBeVisible();

        const revokeResponse = waitForResponseWithStatus(
          page,
          (response) =>
            new URL(response.url()).pathname ===
              '/api/v1/users/security/token/revoke' &&
            response.request().method() === 'PUT',
          200
        );
        await page.getByTestId('revoke-token-popover-confirm').click();
        await revokeResponse;

        await expect(page.getByTestId('generate-token')).toBeVisible();
      });
    });
  }
);
