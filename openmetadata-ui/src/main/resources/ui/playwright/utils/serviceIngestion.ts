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

import { APIRequestContext, APIResponse, expect, Page } from '@playwright/test';
import { BIG_ENTITY_DELETE_TIMEOUT } from '../constant/delete';
import { GlobalSettingOptions } from '../constant/settings';
import { EntityTypeEndpoint } from '../support/entity/Entity.interface';
import { getApiContext, toastNotification } from './common';
import { getEncodedFqn, waitForAllLoadersToDisappear } from './entity';

export enum Services {
  Database = GlobalSettingOptions.DATABASES,
  Messaging = GlobalSettingOptions.MESSAGING,
  Dashboard = GlobalSettingOptions.DASHBOARDS,
  Pipeline = GlobalSettingOptions.PIPELINES,
  MLModels = GlobalSettingOptions.MLMODELS,
  Storage = GlobalSettingOptions.STORAGES,
  Search = GlobalSettingOptions.SEARCH,
  API = GlobalSettingOptions.APIS,
}

export const getEntityTypeFromService = (service: Services) => {
  switch (service) {
    case Services.Dashboard:
      return EntityTypeEndpoint.DashboardService;
    case Services.Database:
      return EntityTypeEndpoint.DatabaseService;
    case Services.Storage:
      return EntityTypeEndpoint.StorageService;
    case Services.Messaging:
      return EntityTypeEndpoint.MessagingService;
    case Services.Search:
      return EntityTypeEndpoint.SearchService;
    case Services.MLModels:
      return EntityTypeEndpoint.MlModelService;
    case Services.Pipeline:
      return EntityTypeEndpoint.PipelineService;
    case Services.API:
      return EntityTypeEndpoint.ApiService;
    default:
      return EntityTypeEndpoint.DatabaseService;
  }
};

export const getServiceCategoryFromService = (service: Services) => {
  switch (service) {
    case Services.Dashboard:
      return 'dashboardService';
    case Services.Database:
      return 'databaseService';
    case Services.Storage:
      return 'storageService';
    case Services.Messaging:
      return 'messagingService';
    case Services.Search:
      return 'searchService';
    case Services.MLModels:
      return 'mlmodelService';
    case Services.Pipeline:
      return 'pipelineService';
    case Services.API:
      return 'apiService';
    default:
      return 'databaseService';
  }
};

export const deleteService = async (
  typeOfService: Services,
  serviceName: string,
  page: Page
) => {
  await page.goto(
    `/service/${getServiceCategoryFromService(typeOfService)}s/${getEncodedFqn(
      serviceName
    )}?currentPage=1`
  );
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('entity-header-name')).toHaveText(serviceName);

  // Clicking on permanent delete radio button and checking the service name
  await page.click('[data-testid="manage-button"]');
  await page.locator('[data-menu-id*="delete-button"]').waitFor();
  await page.click('[data-testid="delete-button-title"]');

  // Clicking on permanent delete radio button and checking the service name
  await page.click('[data-testid="hard-delete-option"]');
  await page.click(`[data-testid="hard-delete-option"] >> text=${serviceName}`);

  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

  const deleteResponse = page.waitForResponse((response) =>
    response
      .url()
      .includes(
        `/api/v1/services/${getServiceCategoryFromService(
          typeOfService
        )}s/async`
      )
  );

  await page.click('[data-testid="confirm-button"]');

  await deleteResponse;

  // Closing the toast notification
  await toastNotification(
    page,
    `"${serviceName}" deleted successfully!`,
    BIG_ENTITY_DELETE_TIMEOUT
  ); // Wait for up to 5 minutes for the toast notification to appear

  await page.reload();
  await waitForAllLoadersToDisappear(page);

  const serviceSearchResponse = page.waitForResponse((response) => {
    const url = response.url();

    return (
      url.includes('/api/v1/search/query') &&
      decodeURIComponent(url).includes(serviceName)
    );
  });

  await page.fill('[data-testid="searchbar"]', serviceName);

  await serviceSearchResponse;

  await page.getByTestId(`service-name-${serviceName}`).waitFor({
    state: 'detached',
  });
};

export const testConnection = async (page: Page) => {
  // Test the connection
  await page.getByTestId('test-connection-btn').waitFor();

  await page.click('[data-testid="test-connection-btn"]');
  const testConnectionDialog = page
    .getByRole('dialog')
    .filter({ hasText: /Connection status|Test Connection/ });

  await expect(testConnectionDialog).toBeVisible();

  await testConnectionDialog.getByRole('button', { name: /Done|OK/ }).click();

  // Wait for the success badge or the warning badge to appear
  const statusBadge = page.locator(
    '[data-testid="message-container"] [data-testid="success-badge"], [data-testid="message-container"] [data-testid="warning-badge"]'
  );

  await expect(statusBadge).toBeVisible({
    timeout: 3.5 * 60 * 1000, // 3 minutes for connection test and 0.5 minute buffer
  });

  await expect(page.getByTestId('messag-text')).toContainText(
    /Connection verified|Connection test was successful.|Test connection partially successful: Some steps had failures, we will only ingest partial metadata./
  );
};

export const mockSuccessfulTestConnection = async (page: Page) => {
  const workflowId = 'pw-successful-test-connection-workflow';

  await page.route(
    '**/api/v1/services/testConnectionDefinitions/name/**',
    (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Playwright.testConnectionDefinition',
          steps: [
            {
              name: 'CheckAccess',
              mandatory: true,
              description: 'Establish connection',
            },
          ],
        }),
      })
  );

  await page.route('**/api/v1/automations/workflows', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();

      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: workflowId,
        name: workflowId,
        status: 'Running',
        workflowType: 'TEST_CONNECTION',
      }),
    });
  });

  await page.route('**/api/v1/automations/workflows/trigger/**', (route) =>
    route.fulfill({ status: 200, body: '{}' })
  );

  await page.route(
    `**/api/v1/automations/workflows/${workflowId}**`,
    (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ id: workflowId }),
        });
      }

      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: workflowId,
          name: workflowId,
          status: 'Successful',
          workflowType: 'TEST_CONNECTION',
          response: {
            status: 'Successful',
            steps: [
              {
                name: 'CheckAccess',
                mandatory: true,
                passed: true,
                message: 'Connected',
              },
            ],
          },
        }),
      });
    }
  );
};

export const testConnectionIfRequired = async (page: Page) => {
  await waitForServiceConnectionForm(page);

  const submitButton = page.getByTestId('submit-btn');

  if (await submitButton.isDisabled({ timeout: 1000 }).catch(() => false)) {
    await testConnection(page);
    await expect(submitButton).toBeEnabled({ timeout: 30_000 });
  }
};

export const checkServiceFieldSectionHighlighting = async (
  page: Page,
  field: string
) => {
  const highlightedField = page.locator(
    `[data-id="${field}"][data-highlighted="true"]`
  );

  if (await highlightedField.isVisible({ timeout: 1000 }).catch(() => false)) {
    return;
  }

  await expect(page.getByTestId('service-requirements')).toBeVisible();
};

export const selectServiceConnector = async (
  page: Page,
  connectorType: string
) => {
  await page.getByTestId(connectorType).click();

  try {
    await page.getByTestId('service-name').waitFor({
      state: 'visible',
      timeout: 5000,
    });
  } catch {
    await page.getByTestId('next-button').click();
    await page.getByTestId('service-name').waitFor({ state: 'visible' });
  }
};

export const waitForServiceConnectionForm = async (page: Page) => {
  await page
    .getByTestId('connection-schema-loader')
    .waitFor({ state: 'detached', timeout: 60_000 })
    .catch(() => null);

  await page
    .locator(
      [
        '[data-testid="test-connection-btn"]:visible',
        '[data-testid="test-connection-button"]:visible',
        '[data-testid="no-config-available"]:visible',
        '[data-field-id^="root/"]:visible',
        'input[id^="root/"]:not([type="hidden"]):visible',
        'textarea[id^="root/"]:visible',
      ].join(', ')
    )
    .first()
    .waitFor({ state: 'visible', timeout: 60_000 });

  await page.getByTestId('submit-btn').waitFor({ state: 'visible' });
};

export const advanceToServiceConnectionStep = async (
  page: Page,
  waitForTestId = 'submit-btn'
) => {
  const target = page.getByTestId(waitForTestId);
  if (await target.isVisible({ timeout: 1000 }).catch(() => false)) {
    if (waitForTestId === 'submit-btn') {
      await waitForServiceConnectionForm(page);
    }

    return;
  }

  await page.getByTestId('next-button').click();

  if (waitForTestId === 'submit-btn') {
    await waitForServiceConnectionForm(page);
  } else {
    await target.waitFor({ state: 'visible' });
  }
};

type RetryRequestData = {
  page: Page;
  retries?: number;
} & (
  | { url: string; fn?: never }
  | { fn: () => Promise<APIResponse>; url?: never }
);

export const makeRetryRequest = async (data: RetryRequestData) => {
  const { url, page, retries = 3, fn } = data;
  const { apiContext } = await getApiContext(page);

  for (let i = 0; i < retries; i++) {
    try {
      const response = await (fn ? fn() : apiContext.get(url));

      return response.json();
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      // eslint-disable-next-line playwright/no-wait-for-timeout -- exponential backoff for retry
      await page.waitForTimeout(1000 * (i + 1));
    }
  }
};

const REMOTE_RUNNER_NAME = 'RemoteRunner';

export const setRemoteRunnerAsDefault = async (
  apiContext: APIRequestContext
): Promise<void> => {
  const runnersRes = await apiContext.get('/api/v1/ingestionRunners?limit=100');
  if (!runnersRes.ok()) {
    return;
  }

  const runnersBody = await runnersRes.json();
  const runners: { id: string; name: string; isDefault?: boolean }[] =
    runnersBody.data ?? [];

  const remoteRunner = runners.find((r) => r.name === REMOTE_RUNNER_NAME);
  if (remoteRunner && !remoteRunner.isDefault) {
    const putRes = await apiContext.put(
      `/api/v1/ingestionRunners/setDefault/${remoteRunner.id}`
    );
    if (!putRes.ok()) {
      throw new Error(
        `Failed to set RemoteRunner as default: ${putRes.status()} ${putRes.statusText()}`
      );
    }
  }
};
