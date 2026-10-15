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
    searchIndex: 'database',
  },
  {
    label: 'Database Schema',
    searchIndex: 'databaseSchema',
  },
  {
    label: 'Table',
    searchIndex: 'table',
  },
  {
    label: 'Topic',
    searchIndex: 'topic',
  },
  {
    label: 'Dashboard',
    searchIndex: 'dashboard',
  },
  {
    label: 'Pipeline',
    searchIndex: 'pipeline',
  },
  {
    label: 'ML Model',
    searchIndex: 'mlmodel',
  },
  {
    label: 'Container',
    searchIndex: 'container',
  },
  {
    label: 'Stored Procedure',
    searchIndex: 'storedProcedure',
  },
  {
    label: 'Data Model',
    searchIndex: 'dashboardDataModel',
  },
  {
    label: 'Glossary',
    searchIndex: 'glossaryTerm',
  },
  {
    label: 'Tag',
    searchIndex: 'tag',
  },
  {
    label: 'Search Index',
    searchIndex: 'searchIndex',
  },
  {
    label: 'Data Product',
    searchIndex: 'dataProduct',
  },
  {
    label: 'API Endpoint',
    searchIndex: 'apiEndpoint',
  },
  {
    label: 'API Collection',
    searchIndex: 'apiCollection',
  },
  {
    label: 'Metric',
    searchIndex: 'metric',
  },
  {
    label: 'Directory',
    searchIndex: 'directory',
  },
  {
    label: 'File',
    searchIndex: 'file',
  },
  {
    label: 'Spreadsheet',
    searchIndex: 'spreadsheet',
  },
  {
    label: 'Worksheet',
    searchIndex: 'worksheet',
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
  await page.getByTestId(`global-search-select-option-${optionTitle}`).click();
};
