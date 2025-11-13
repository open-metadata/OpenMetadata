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
import { redirectToHomePage, testTableSorting } from '../../utils/common';
import { test } from '../fixtures/pages';

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test.describe('Table Sorting', () => {
  test('Database Schema page should have sorting on name column', async ({
    page,
  }) => {
    await page.goto('/database/sample_data.ecommerce_db');
    await testTableSorting(page, 'Name');
  });

  test('Services page should have sorting on name column', async ({ page }) => {
    await page.goto('/settings/services/databases');
    await testTableSorting(page, 'Name');
  });

  test('API Endpoint page should have sorting on name column', async ({
    page,
  }) => {
    await page.goto('/apiCollection/sample_api_service.pet');
    await testTableSorting(page, 'Name');
  });

  test('API Endpoint schema should have sorting on name column', async ({
    page,
  }) => {
    await page.goto('/apiEndpoint/sample_api_service.pet.addPet');
    await testTableSorting(page, 'Name');
  });

  test('Database Schema Tables tab should have sorting on name column', async ({
    page,
  }) => {
    await page.goto('/databaseSchema/sample_data.ecommerce_db.shopify');
    await testTableSorting(page, 'Name');
  });

  test('Data Observability services page should have sorting on name column', async ({
    page,
  }) => {
    await page.goto('/settings/services/dataObservability?tab=pipelines');
    await testTableSorting(page, 'Name');
  });

  test('Data Models Table should have sorting on name column', async ({
    page,
  }) => {
    await page.goto('/service/dashboardServices/sample_superset/data-model');
    await testTableSorting(page, 'Name');
  });

  test('Stored Procedure Table should have sorting on name column', async ({
    page,
  }) => {
    await page.goto(
      '/databaseSchema/sample_data.ecommerce_db.shopify/stored_procedure'
    );
    await testTableSorting(page, 'Name');
  });

  test('Topics Table should have sorting on name column', async ({ page }) => {
    await page.goto('/service/messagingServices/sample_kafka/topics');
    await testTableSorting(page, 'Name');
  });

  test('Drives Service Files Table should have sorting on name column', async ({
    page,
  }) => {
    await page.goto('/service/driveServices/sample_google_drive/files');
    await testTableSorting(page, 'Name');
  });

  test('Drives Service Spreadsheets Table should have sorting on name column', async ({
    page,
  }) => {
    await page.goto('/service/driveServices/sample_google_drive/spreadsheets');
    await testTableSorting(page, 'Name');
  });
});
