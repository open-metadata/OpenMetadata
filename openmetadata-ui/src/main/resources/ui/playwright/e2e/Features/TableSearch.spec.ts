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
import { redirectToHomePage, testTableSearch } from '../../utils/common';
import { test } from '../fixtures/pages';

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test.describe('Table Search', () => {
  test('Services page should have search functionality', async ({ page }) => {
    await page.goto('/settings/services/databases');
    await testTableSearch(
      page,
      'database_service_search_index',
      'sample_data',
      'mysql_sample'
    );
  });

  test('API Collection page should have search functionality', async ({
    page,
  }) => {
    await page.goto('/apiCollection/sample_api_service.pet');
    await testTableSearch(
      page,
      'api_endpoint_search_index',
      'Add',
      'Update Pet'
    );
  });

  test('Database Schema Tables tab should have search functionality', async ({
    page,
  }) => {
    await page.goto('/databaseSchema/sample_data.ecommerce_db.shopify');
    await testTableSearch(
      page,
      'table_search_index',
      'dim_customer',
      'fact_sale'
    );
  });

  test('Data Models Table should have search functionality', async ({
    page,
  }) => {
    await page.goto('/service/dashboardServices/sample_looker/data-model');
    await testTableSearch(
      page,
      'dashboard_data_model_search_index',
      'Operations',
      'Orders'
    );
  });

  test('Stored Procedure Table should have search functionality', async ({
    page,
  }) => {
    await page.goto(
      '/databaseSchema/sample_data.ecommerce_db.shopify/stored_procedure'
    );
    await testTableSearch(
      page,
      'stored_procedure_search_index',
      'calculate_average',
      'calculate_interest'
    );
  });

  test('Topics Table should have search functionality', async ({ page }) => {
    await page.goto('/service/messagingServices/sample_kafka/topics');
    await testTableSearch(
      page,
      'topic_search_index',
      'customer_events',
      'product_events'
    );
  });

  test('Drives Service Directories Table should have search functionality', async ({
    page,
  }) => {
    await page.goto('/service/driveServices/sample_google_drive/directories');
    await testTableSearch(
      page,
      'directory_search_index',
      'Finance',
      'Marketing'
    );
  });

  test('Drives Service Files Table should have search functionality', async ({
    page,
  }) => {
    await page.goto('/service/driveServices/sample_google_drive/files');
    await testTableSearch(page, 'file_search_index', 'Board', 'Compliance');
  });

  test('Drives Service Spreadsheets Table should have search functionality', async ({
    page,
  }) => {
    await page.goto('/service/driveServices/sample_google_drive/spreadsheets');
    await testTableSearch(
      page,
      'spreadsheet_search_index',
      'Annual',
      'Employee'
    );
  });
});
