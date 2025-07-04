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
import { BIG_ENTITY_DELETE_TIMEOUT } from '../constant/delete';
import { GlobalSettingOptions } from '../constant/settings';
import { EntityTypeEndpoint } from '../support/entity/Entity.interface';
import { getApiContext, toastNotification } from './common';
import { escapeESReservedCharacters, getEncodedFqn } from './entity';

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
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await expect(page.getByTestId('entity-header-name')).toHaveText(serviceName);

  // Clicking on permanent delete radio button and checking the service name
  await page.click('[data-testid="manage-button"]');
  await page.waitForSelector('[data-menu-id*="delete-button"]');
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
    /deleted successfully!/,
    BIG_ENTITY_DELETE_TIMEOUT
  ); // Wait for up to 5 minutes for the toast notification to appear

  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  const serviceSearchResponse = page.waitForResponse(
    `/api/v1/search/query?q=*${encodeURIComponent(
      escapeESReservedCharacters(serviceName)
    )}*`
  );

  await page.fill('[data-testid="searchbar"]', serviceName);

  await serviceSearchResponse;

  await page.waitForSelector(`[data-testid="service-name-${serviceName}"]`, {
    state: 'detached',
  });
};

export const testConnection = async (page: Page) => {
  // Test the connection
  await page.waitForSelector('[data-testid="test-connection-btn"]');

  await page.click('[data-testid="test-connection-btn"]');
  const modalTitle = page.locator(
    '[data-testid="test-connection-modal"] .ant-modal-title'
  );

  await expect(modalTitle).toBeVisible();

  await page.getByRole('button', { name: 'OK' }).click();

  // Wait for the success badge or the warning badge to appear
  const successBadge = page.locator('[data-testid="success-badge"]');

  const warningBadge = page.locator('[data-testid="warning-badge"]');

  await expect(successBadge.or(warningBadge)).toBeVisible({
    timeout: 2.5 * 60 * 1000,
  });

  await expect(page.getByTestId('messag-text')).toContainText(
    /Connection test was successful.|Test connection partially successful: Some steps had failures, we will only ingest partial metadata. Click here to view details./g
  );
};

export const checkServiceFieldSectionHighlighting = async (
  page: Page,
  field: string
) => {
  await page.waitForSelector(`[data-id="${field}"][data-highlighted="true"]`);
};

export const makeRetryRequest = async (data: {
  url: string;
  page: Page;
  retries?: number;
}) => {
  const { url, page, retries = 3 } = data;
  const { apiContext } = await getApiContext(page);

  for (let i = 0; i < retries; i++) {
    try {
      const response = await apiContext.get(url);

      return response.json();
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      await page.waitForTimeout(1000 * (i + 1)); // Exponential backoff
    }
  }
};
