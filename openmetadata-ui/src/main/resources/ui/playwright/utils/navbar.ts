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
    isScrollRequired: false,
  },
  {
    label: 'Database',
    searchIndex: 'database_search_index',
    isScrollRequired: false,
  },
  {
    label: 'Database Schema',
    searchIndex: 'database_schema_search_index',
    isScrollRequired: false,
  },
  {
    label: 'Table',
    searchIndex: 'table_search_index',
    isScrollRequired: false,
  },
  {
    label: 'Topic',
    searchIndex: 'topic_search_index',
    isScrollRequired: false,
  },
  {
    label: 'Dashboard',
    searchIndex: 'dashboard_search_index',
    isScrollRequired: false,
  },
  {
    label: 'Pipeline',
    searchIndex: 'pipeline_search_index',
    isScrollRequired: false,
  },
  {
    label: 'ML Model',
    searchIndex: 'mlmodel_search_index',
    isScrollRequired: false,
  },
  {
    label: 'Container',
    searchIndex: 'container_search_index',
    isScrollRequired: false,
  },
  {
    label: 'Stored Procedure',
    searchIndex: 'stored_procedure_search_index',
    isScrollRequired: false,
  },
  {
    label: 'Data Model',
    searchIndex: 'dashboard_data_model_search_index',
    isScrollRequired: false,
  },
  {
    label: 'Glossary',
    searchIndex: 'glossary_term_search_index',
    isScrollRequired: true,
  },
  {
    label: 'Tag',
    searchIndex: 'tag_search_index',
    isScrollRequired: true,
  },
  {
    label: 'Search Index',
    searchIndex: 'search_entity_search_index',
    isScrollRequired: true,
  },
  {
    label: 'Data Product',
    searchIndex: 'data_product_search_index',
    isScrollRequired: true,
  },
  {
    label: 'API Endpoint',
    searchIndex: 'api_endpoint_search_index',
    isScrollRequired: true,
  },
  {
    label: 'API Collection',
    searchIndex: 'api_collection_search_index',
    isScrollRequired: true,
  },
  {
    label: 'Metric',
    searchIndex: 'metric_search_index',
    isScrollRequired: true,
  },
];

export const selectOption = async (
  page: Page,
  dropdownLocator: Locator,
  optionTitle: string,
  isScrollNeeded: boolean
) => {
  // moving out side left menu bar to avoid random failure due to left menu bar
  await page.mouse.move(1280, 0);

  await dropdownLocator.click();
  await page.waitForSelector(`.ant-select-dropdown:visible`, {
    state: 'visible',
  });
  if (isScrollNeeded) {
    await page.getByTestId('global-search-select-option-Container').hover();
    await page.mouse.wheel(0, 300);
  }
  await page.click(`.ant-select-dropdown:visible [title="${optionTitle}"]`);
};
