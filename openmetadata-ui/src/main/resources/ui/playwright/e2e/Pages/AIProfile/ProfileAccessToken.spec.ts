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
import {
  closeProfileModal,
  expectNoAiToken,
  generateAiToken,
  regenerateAiToken,
  revealAiToken,
  revokeAiToken,
  selectUiCoreOption,
  visitProfile,
} from '../../../utils/personalSpace';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

// Token-expiration option labels (see AccessTokenRow `expiryOptions`).
// Each option's label and the `JWTTokenExpiry` it must send.
const TOKEN_EXPIRY_OPTIONS = [
  { label: '1 Hour', value: 'OneHour' },
  { label: '1 Day', value: '1' },
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '60 days', value: '60' },
  { label: '90 days', value: '90' },
];

// The token is generated and revoked by a per-test account, so retries and
// parallel shards never contend for the shared admin's token.
test.describe(
  'Profile personal access token',
  { tag: ['@Platform', '@Features'] },
  () => {
    test('asks for confirmation before revoking the personal access token', async ({
      freshUserPage: { page },
    }) => {
      await test.step('Open the access token panel', async () => {
        await openAiProfile(page);
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

      // The panel only shows the token it issues itself, so generate it here.
      await test.step('Generate a token from the panel', async () => {
        const generateResponse = waitForResponseWithStatus(
          page,
          (response) =>
            new URL(response.url()).pathname ===
              '/api/v1/users/security/token' &&
            response.request().method() === 'PUT',
          200
        );
        await page.getByTestId('generate-token').click();
        await generateResponse;
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

    test('generates a real token then revokes it', async ({
      freshUserPage: { page },
    }) => {
      await visitProfile(page, 'access-token');
      await expectNoAiToken(page);
      await generateAiToken(page);

      await test.step('The revealed token is a real JWT, not the mask', async () => {
        const tokenValue = await revealAiToken(page);
        // A JWT contains alphanumerics; the masked placeholder is only bullets.
        await expect(tokenValue).toHaveText(/[A-Za-z0-9]/);
      });

      await revokeAiToken(page);
      await expect(page.getByTestId('token-value')).toHaveCount(0);
    });

    test('regenerates the token, re-issuing a valid one', async ({
      freshUserPage: { page },
    }) => {
      test.slow();
      await visitProfile(page, 'access-token');
      await expectNoAiToken(page);
      await generateAiToken(page);

      await test.step('Regenerate revokes then re-issues a token', async () => {
        await regenerateAiToken(page);
        await expect(await revealAiToken(page)).toHaveText(/^ey/);
      });

      await revokeAiToken(page);
      await expect(page.getByTestId('token-value')).toHaveCount(0);
    });

    test('reflects the chosen expiration before generating each token', async ({
      freshUserPage: { page },
    }) => {
      test.slow();
      await visitProfile(page, 'access-token');
      await expectNoAiToken(page);

      for (const { label, value } of TOKEN_EXPIRY_OPTIONS) {
        await test.step(`Expiration: ${label}`, async () => {
          await selectUiCoreOption(page, 'token-expiry-select', label);
          const response = await generateAiToken(page);
          expect(response.request().postDataJSON().JWTTokenExpiry).toBe(value);
          await expect(page.getByTestId('token-expiry')).toBeVisible();
          await revokeAiToken(page);
        });
      }
    });

    test('a generated access token persists after closing and reopening the modal', async ({
      freshUserPage: { page },
    }) => {
      test.slow();
      await visitProfile(page, 'access-token');
      await expectNoAiToken(page);

      await test.step('Choose an expiry and generate a token', async () => {
        await selectUiCoreOption(page, 'token-expiry-select', '7 days');
        await expect(page.getByTestId('token-expiry-select')).toContainText(
          '7 days'
        );
        await generateAiToken(page);
      });

      await test.step('The token is still present after reopening the modal', async () => {
        await closeProfileModal(page);
        await visitProfile(page, 'access-token');
        await expect(page.getByTestId('token-value')).toBeVisible();
        await expect(page.getByTestId('token-expiry')).toBeVisible();
      });
    });
  }
);
