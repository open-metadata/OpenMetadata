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
import { waitForAllLoadersToDisappear } from './entity';

export type WebhookType = 'MS Teams' | 'Slack' | 'G Chat' | 'Webhook' | 'None';
export type WebhookIconTestId =
  | 'msTeams-icon'
  | 'slack-icon'
  | 'gChat-icon'
  | 'generic-icon';

export const openSubscriptionModal = async (page: Page) => {
  await page.getByTestId('edit-team-subscription').click();
  await expect(page.getByTestId('subscription-modal')).toBeVisible();
};

export const closeSubscriptionModal = async (page: Page) => {
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('subscription-modal')).not.toBeVisible();
};

export const selectWebhookType = async (page: Page, webhookType: WebhookType) => {
  const webhookInput = page.locator('#webhook');
  const selectContainer = page
    .getByTestId('subscription-modal')
    .locator('.ant-select-selector')
    .filter({ has: webhookInput });

  await selectContainer.waitFor({ state: 'visible' });
  await selectContainer.click();

  const dropdown = page.locator('.ant-select-dropdown:visible');
  const webhookOption = dropdown.getByText(webhookType, { exact: true });

  await expect(webhookOption).toBeVisible();
  await webhookOption.click();
  await expect(dropdown).not.toBeVisible();
};

export const fillEndpointAndSave = async (page: Page, endpoint: string) => {
  await page
    .getByTestId('subscription-modal')
    .locator('#endpoint')
    .fill(endpoint);

  const patchTeamResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/teams/') &&
      response.request().method() === 'PATCH'
  );

  await page.getByRole('button', { name: 'Confirm' }).click();

  const response = await patchTeamResponse;
  expect(response.status()).toBe(200);

  await waitForAllLoadersToDisappear(page);
};

export const verifyWebhookIcon = async (
  page: Page,
  iconTestId: WebhookIconTestId,
  endpoint: string
) => {
  const icon = page.getByTestId(iconTestId);
  await expect(icon).toBeVisible();
  await expect(icon.locator('..')).toHaveAttribute('href', endpoint);
};

export const configureWebhook = async (
  page: Page,
  webhookType: WebhookType,
  endpoint: string
) => {
  await openSubscriptionModal(page);
  await selectWebhookType(page, webhookType);
  await fillEndpointAndSave(page, endpoint);
};

export const removeSubscription = async (page: Page) => {
  await openSubscriptionModal(page);
  await selectWebhookType(page, 'None');

  const patchTeamResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/teams/') &&
      response.request().method() === 'PATCH'
  );

  await page.getByRole('button', { name: 'Confirm' }).click();

  const response = await patchTeamResponse;
  expect(response.status()).toBe(200);

  await waitForAllLoadersToDisappear(page);
};

export const verifyNoSubscription = async (page: Page) => {
  const subscriptionNoData = page.getByTestId('subscription-no-data');
  await expect(subscriptionNoData).toBeVisible();
  await expect(subscriptionNoData).toHaveText('None');
};
