/*
 *  Copyright 2021 Collate
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

import { TabSpecificField } from '../enums/entity.enum';

export const defaultFields = `${TabSpecificField.COLUMNS}, ${TabSpecificField.USAGE_SUMMARY}, 
${TabSpecificField.FOLLOWERS}, ${TabSpecificField.JOINS}, ${TabSpecificField.TAGS}, ${TabSpecificField.OWNER}, 
${TabSpecificField.DATAMODEL},${TabSpecificField.TABLE_PROFILE}`;

export const datasetTableTabs = [
  {
    name: 'Schema',
    path: 'schema',
  },
  {
    name: 'Sample Data',
    path: 'sample_data',
    field: TabSpecificField.SAMPLE_DATA,
  },
  {
    name: 'Queries',
    path: 'table_queries',
    field: TabSpecificField.TABLE_QUERIES,
  },
  {
    name: 'Profiler',
    path: 'profiler',
  },
  {
    name: 'Lineage',
    path: 'lineage',
    field: TabSpecificField.LINEAGE,
  },
  {
    name: 'DBT',
    path: 'dbt',
  },
  {
    name: 'Manage',
    path: 'manage',
  },
];

export const getCurrentDatasetTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'sample_data':
      currentTab = 2;

      break;
    case 'table_queries':
      currentTab = 3;

      break;

    case 'profiler':
      currentTab = 4;

      break;

    case 'lineage':
      currentTab = 5;

      break;

    case 'dbt':
      currentTab = 6;

      break;

    case 'manage':
      currentTab = 7;

      break;

    case 'schema':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};
