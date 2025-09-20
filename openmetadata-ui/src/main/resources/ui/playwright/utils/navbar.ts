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
import { Locator, Page } from '@playwright/test';

export const navbarSearchItems = [
  {
    label: 'All',
    searchIndex: 'dataAsset',
  },
  {
    label: 'Database',
    searchIndex: 'database_search_index',
  },
  {
    label: 'Database Schema',
    searchIndex: 'database_schema_search_index',
  },
  {
    label: 'Table',
    searchIndex: 'table_search_index',
  },
  {
    label: 'Topic',
    searchIndex: 'topic_search_index',
  },
  {
    label: 'Dashboard',
    searchIndex: 'dashboard_search_index',
  },
  {
    label: 'Pipeline',
    searchIndex: 'pipeline_search_index',
  },
  {
    label: 'ML Model',
    searchIndex: 'mlmodel_search_index',
  },
  {
    label: 'Container',
    searchIndex: 'container_search_index',
  },
  {
    label: 'Stored Procedure',
    searchIndex: 'stored_procedure_search_index',
  },
  {
    label: 'Data Model',
    searchIndex: 'dashboard_data_model_search_index',
  },
  {
    label: 'Glossary',
    searchIndex: 'glossary_term_search_index',
  },
  {
    label: 'Tag',
    searchIndex: 'tag_search_index',
  },
  {
    label: 'Search Index',
    searchIndex: 'search_entity_search_index',
  },
  {
    label: 'Data Product',
    searchIndex: 'data_product_search_index',
  },
  {
    label: 'API Endpoint',
    searchIndex: 'api_endpoint_search_index',
  },
  {
    label: 'API Collection',
    searchIndex: 'api_collection_search_index',
  },
  {
    label: 'Metric',
    searchIndex: 'metric_search_index',
  },
  {
    label: 'Directory',
    searchIndex: 'directory_search_index',
  },
  {
    label: 'File',
    searchIndex: 'file_search_index',
  },
  {
    label: 'Spreadsheet',
    searchIndex: 'spreadsheet_search_index',
  },
  {
    label: 'Worksheet',
    searchIndex: 'worksheet_search_index',
  },
];

export const selectOption = async (
  page: Page,
  dropdownLocator: Locator,
  optionTitle: string
) => {
  // moving out side left menu bar to avoid random failure due to left menu bar
  await page.mouse.move(1280, 0);

  await dropdownLocator.click();
  await page.waitForSelector(`.ant-select-dropdown:visible`, {
    state: 'visible',
  });

  // Logic to scroll to find the option
  // Since antd dropdown only ingests 10 option at a time in the DOM.
  await page.getByTestId('global-search-select-dropdown').hover();

  const maxScrollAttempts = 15; // Prevent infinite loop
  let scrollAttempts = 0;
  const scrollStep = 50; // Pixels to scroll each time

  while (scrollAttempts < maxScrollAttempts) {
    // Check if option is visible in current view
    const optionLocator = page.getByTestId(
      `global-search-select-option-${optionTitle}`
    );

    const isOptionVisible = await optionLocator
      .first()
      .isVisible()
      .catch(() => false);

    if (isOptionVisible) {
      await optionLocator.first().click();

      return;
    }

    // Scroll down
    await page.mouse.wheel(0, scrollStep);

    // Small delay to allow DOM to update
    await page.waitForTimeout(100);

    scrollAttempts++;
  }
};
