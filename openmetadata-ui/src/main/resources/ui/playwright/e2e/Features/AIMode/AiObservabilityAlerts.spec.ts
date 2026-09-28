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

import { expect, test } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { TeamClass } from '../../../support/team/TeamClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { waitForSearchIndexed } from '../../../utils/polling';
import {
  addDestination,
  addEmailReceiver,
  addFilter,
  dismissPopover,
  fillAlertName,
  fillDestinationInput,
  fillEndpoint,
  openAddAlertModal,
  saveAlertModal,
  selectAlertSource,
  selectDestinationCategory,
  selectInternalDestinationType,
  selectTeamOrUserReceiver,
  selectWebhookAuthType,
} from '../../Utils/aiAlertModal';
import { enableAiAppMode } from '../../Utils/appMode';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

const OBSERVABILITY_ALERTS_PATH = '/observability/alerts';

test.describe('AI mode — observability alerts keep the classic create, edit, and delete flow', () => {
  const createdAlertIds: string[] = [];

  test.beforeEach(async ({ page }) => {
    await enableAiAppMode(page);
    await page.goto(OBSERVABILITY_ALERTS_PATH, {
      waitUntil: 'domcontentloaded',
    });
    await waitForAllLoadersToDisappear(page);
  });

  test.afterAll(async ({ browser }) => {
    const teardownPage = await browser.newPage();
    const { apiContext, afterAction } = await getApiContext(teardownPage);

    for (const id of createdAlertIds) {
      await apiContext.delete(
        `/api/v1/events/subscriptions/${id}?hardDelete=true`
      );
    }

    await afterAction();
    await teardownPage.close();
  });

  test('creates, edits, and deletes an observability alert', async ({
    page,
  }) => {
    test.slow();

    const alertName = `pw-ai-observability-${uuid()}`;
    const dialog = await openAddAlertModal(page);

    await fillAlertName(dialog, alertName);
    await selectAlertSource(page, 'Table');

    // Observability alerts can add triggers; notification alerts cannot.
    await expect(dialog.getByTestId('add-actions')).toBeVisible();

    await dialog.getByTestId('add-destination-button').click();
    await selectDestinationCategory(page, dialog, 'Slack');
    await dialog
      .getByTestId('endpoint-input-0')
      .getByRole('textbox')
      .fill('http://localhost:1/slack');

    const created =
      await test.step('create sends an observability POST', async () => {
        const { request, response } = await saveAlertModal(page, dialog);
        const body = await response?.json();
        createdAlertIds.push(body.id);

        expect(request.method()).toBe('POST');
        expect(response?.status()).toBe(201);
        expect(request.postDataJSON()).toMatchObject({
          alertType: 'Observability',
          displayName: alertName,
          resources: ['table'],
          destinations: [
            expect.objectContaining({
              category: 'External',
              type: 'Slack',
              config: expect.objectContaining({
                endpoint: 'http://localhost:1/slack',
              }),
            }),
          ],
        });

        return body;
      });

    await expect(page).toHaveURL(
      `/observability/alert/${created.fullyQualifiedName}`
    );
    await expect(page.getByTestId('alert-details-ai-page')).toBeVisible();

    await test.step('edit sends a PATCH', async () => {
      await page.getByTestId('edit-button').click();
      const editDialog = page.getByRole('dialog');
      const description = `edited from AI mode ${uuid()}`;
      await editDialog
        .getByTestId('description')
        .getByRole('textbox')
        .fill(description);

      const { request, response } = await saveAlertModal(page, editDialog);

      expect(request.method()).toBe('PATCH');
      expect(response?.status()).toBe(200);
      expect(request.postDataJSON()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: '/description',
            value: description,
          }),
        ])
      );

      await expect(editDialog).toBeHidden();
      await expect(page.getByTestId('alert-details-ai-page')).toContainText(
        description
      );
    });

    // Deleted from the details page: the modal-created alert gets a generated
    // name, so it is not guaranteed to be on page 1 of the name-sorted list.
    await test.step('delete from the details page returns to the list', async () => {
      await page.getByTestId('delete-button').click();

      const deleteResponse = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes(`/api/v1/events/subscriptions/${created.id}`) &&
          response.request().method() === 'DELETE'
      );
      await page
        .getByTestId('delete-modal')
        .getByTestId('confirm-button')
        .click();

      expect((await deleteResponse).status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(`${OBSERVABILITY_ALERTS_PATH}$`));
    });
  });
});

test.describe('AI mode — observability alert form keeps every classic option', () => {
  const table = new TableClass();
  const team = new TeamClass();
  const receiverUser = new UserClass();
  const createdAlertIds: string[] = [];
  let dataContract: { id: string; name: string; fullyQualifiedName: string };

  test.beforeAll(async ({ browser }) => {
    test.slow();
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await table.create(apiContext);
    await team.create(apiContext);
    await receiverUser.create(apiContext);

    const contractResponse = await apiContext.post('/api/v1/dataContracts', {
      data: {
        name: `pw-ai-contract-${uuid()}`,
        entity: { id: table.entityResponseData.id, type: 'table' },
      },
    });

    expect(contractResponse.ok()).toBeTruthy();

    dataContract = await contractResponse.json();

    // Filter and receiver pickers only offer what the search API returns.
    await waitForSearchIndexed(
      apiContext,
      table.entityResponseData.fullyQualifiedName,
      'table'
    );
    await waitForSearchIndexed(
      apiContext,
      team.responseData.fullyQualifiedName,
      'team'
    );
    await waitForSearchIndexed(
      apiContext,
      receiverUser.responseData.fullyQualifiedName,
      'user'
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    for (const id of createdAlertIds) {
      await apiContext.delete(
        `/api/v1/events/subscriptions/${id}?hardDelete=true`
      );
    }
    await apiContext.delete(
      `/api/v1/dataContracts/${dataContract?.id}?hardDelete=true&recursive=true`
    );
    await table.delete(apiContext);
    await team.delete(apiContext);
    await receiverUser.delete(apiContext);

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await enableAiAppMode(page);
    await page.goto(OBSERVABILITY_ALERTS_PATH, {
      waitUntil: 'domcontentloaded',
    });
    await waitForAllLoadersToDisappear(page);
  });

  test('saves a searched entity filter and a trigger', async ({ page }) => {
    const tableFqn = table.entityResponseData.fullyQualifiedName ?? '';
    const dialog = await openAddAlertModal(page);

    await fillAlertName(dialog, `pw-ai-trigger-${uuid()}`);
    await selectAlertSource(page, 'Table');
    await addFilter(page, dialog, 'Table Name');

    const fqnInput = dialog.getByTestId('filters-0').getByRole('combobox');
    await fqnInput.click();
    await fqnInput.fill(table.entityResponseData.name);
    const tableOption = page.getByRole('option', {
      name: tableFqn,
      exact: true,
    });
    // The picker debounces search, so wait on the matching option itself.
    await expect(tableOption).toBeVisible();
    await tableOption.click();
    await dismissPopover(dialog);

    await dialog.getByTestId('add-actions').click();
    await dialog.getByTestId('actions-select-0').click();
    await page
      .getByRole('option', { name: 'Get Schema Changes', exact: true })
      .click();

    await addDestination(page, dialog, 'Slack', 0);
    await fillEndpoint(dialog, 0, 'http://localhost:1/slack');

    const { request, response } = await saveAlertModal(page, dialog);
    const created = await response?.json();
    createdAlertIds.push(created.id);

    expect(response?.status()).toBe(201);
    expect(request.postDataJSON()).toMatchObject({
      alertType: 'Observability',
      resources: ['table'],
      input: {
        filters: [
          expect.objectContaining({
            name: 'filterByFqn',
            effect: 'include',
            arguments: [{ name: 'fqnList', input: [tableFqn] }],
          }),
        ],
        actions: [
          expect.objectContaining({
            name: 'GetTableSchemaChanges',
            effect: 'include',
          }),
        ],
      },
    });

    const details = page.getByTestId('alert-details-ai-page');

    await expect(details).toBeVisible();
    await expect(details.getByTestId('actions-select-0')).toContainText(
      'Get Schema Changes'
    );
    await expect(details.getByTestId('filters-0')).toContainText(tableFqn);
  });

  test('saves every destination kind with its receivers and authentication', async ({
    page,
  }) => {
    test.slow();

    const teamFqn = team.responseData.fullyQualifiedName ?? '';
    const userFqn = receiverUser.responseData.fullyQualifiedName ?? '';
    const email = `pw-ai-${uuid()}@example.com`;
    const dialog = await openAddAlertModal(page);

    await fillAlertName(dialog, `pw-ai-destinations-${uuid()}`);
    await selectAlertSource(page, 'Table');

    await test.step('internal team and user receivers', async () => {
      await addDestination(page, dialog, 'Teams', 0);
      await selectInternalDestinationType(page, dialog, 'Email', 0);
      await selectTeamOrUserReceiver(page, dialog, {
        index: 0,
        search: team.responseData.name,
        fqn: teamFqn,
      });

      await addDestination(page, dialog, 'Users', 1);
      await selectInternalDestinationType(page, dialog, 'Email', 1);
      await selectTeamOrUserReceiver(page, dialog, {
        index: 1,
        search: receiverUser.responseData.name,
        fqn: userFqn,
      });
    });

    await test.step('owners with downstream notification', async () => {
      await addDestination(page, dialog, 'Owners', 2);
      await selectInternalDestinationType(page, dialog, 'Email', 2);
      await dialog
        .getByTestId('destination-2')
        .getByText('Notify Downstream')
        .click();
      await dialog
        .getByTestId('destination-downstream-depth-2')
        .getByRole('spinbutton')
        .fill('2');
    });

    await test.step('external email receiver', async () => {
      await addDestination(page, dialog, 'Email', 3);
      await addEmailReceiver(dialog, 3, email);
    });

    await test.step('webhook with bearer and Slack with OAuth2', async () => {
      await addDestination(page, dialog, 'Webhook', 4);
      await fillEndpoint(dialog, 4, 'http://localhost:1/hook');
      await selectWebhookAuthType(page, dialog, 4, 'Bearer (HMAC Signature)');
      await fillDestinationInput(dialog, 'secret-key-input-4', 'pw-secret');

      await addDestination(page, dialog, 'Slack', 5);
      await fillEndpoint(dialog, 5, 'http://localhost:1/slack');
      await selectWebhookAuthType(page, dialog, 5, 'OAuth2 Client Credentials');
      await fillDestinationInput(
        dialog,
        'token-url-input-5',
        'https://auth.example.com/token'
      );
      await fillDestinationInput(dialog, 'client-id-input-5', 'pw-client');
      await fillDestinationInput(
        dialog,
        'client-secret-input-5',
        'pw-client-secret'
      );
      await fillDestinationInput(dialog, 'scope-input-5', 'alerts');
    });

    const { request, response } = await saveAlertModal(page, dialog);
    const created = await response?.json();
    createdAlertIds.push(created.id);

    expect(response?.status()).toBe(201);
    expect(request.postDataJSON().destinations).toEqual([
      expect.objectContaining({
        category: 'Teams',
        type: 'Email',
        config: expect.objectContaining({ receivers: [teamFqn] }),
      }),
      expect.objectContaining({
        category: 'Users',
        type: 'Email',
        config: expect.objectContaining({ receivers: [userFqn] }),
      }),
      expect.objectContaining({
        category: 'Owners',
        type: 'Email',
        notifyDownstream: true,
        downstreamDepth: 2,
      }),
      expect.objectContaining({
        category: 'External',
        type: 'Email',
        config: expect.objectContaining({ receivers: [email] }),
      }),
      expect.objectContaining({
        category: 'External',
        type: 'Webhook',
        config: expect.objectContaining({
          endpoint: 'http://localhost:1/hook',
          authType: { type: 'bearer', secretKey: 'pw-secret' },
        }),
      }),
      expect.objectContaining({
        category: 'External',
        type: 'Slack',
        config: expect.objectContaining({
          endpoint: 'http://localhost:1/slack',
          authType: {
            type: 'oauth2',
            tokenUrl: 'https://auth.example.com/token',
            clientId: 'pw-client',
            clientSecret: 'pw-client-secret',
            scope: 'alerts',
          },
        }),
      }),
    ]);
  });

  test('tests only the configured external destinations', async ({ page }) => {
    const dialog = await openAddAlertModal(page);
    const testButton = dialog.getByTestId('test-destination-button');

    await selectAlertSource(page, 'Table');
    await addDestination(page, dialog, 'Owners', 0);
    await selectInternalDestinationType(page, dialog, 'G Chat', 0);

    await expect(testButton).toBeDisabled();

    await selectDestinationCategory(page, dialog, 'G Chat', 0);
    await fillEndpoint(dialog, 0, 'http://localhost:1/gchat');
    await addDestination(page, dialog, 'Slack', 1);
    await fillEndpoint(dialog, 1, 'http://localhost:1/slack');
    // An unconfigured destination must not be sent to the test API.
    await dialog.getByTestId('add-destination-button').click();

    await expect(testButton).toBeEnabled();

    const testRequest = page.waitForRequest(
      (request) =>
        request
          .url()
          .includes('/api/v1/events/subscriptions/testDestination') &&
        request.method() === 'POST'
    );
    await testButton.click();
    const request = await testRequest;
    const response = await request.response();
    const results = await response?.json();

    expect(response?.status()).toBe(200);
    expect(request.postDataJSON().destinations).toHaveLength(2);
    expect(results).toHaveLength(2);

    for (const result of results) {
      // Destination configs carry credentials and must not be echoed back.
      expect(result.config).toBeUndefined();

      await expect(
        dialog
          .getByTestId(`destination-${result.type === 'GChat' ? 0 : 1}`)
          .getByRole('alert')
          .getByText(result.statusDetails.status)
      ).toBeAttached();
    }
  });

  test('lists data contracts in the data contract filter', async ({ page }) => {
    const dialog = await openAddAlertModal(page);

    await selectAlertSource(page, 'Data Contract');
    await addFilter(page, dialog, 'Data Contract Name');

    const fqnInput = dialog.getByTestId('filters-0').getByRole('combobox');
    const contractsResponse = page.waitForResponse(
      '/api/v1/dataContracts/search?*'
    );
    await fqnInput.fill(dataContract.name);
    await contractsResponse;

    await expect(
      page.getByRole('option', {
        name: dataContract.fullyQualifiedName,
        exact: true,
      })
    ).toBeVisible();
  });
});
