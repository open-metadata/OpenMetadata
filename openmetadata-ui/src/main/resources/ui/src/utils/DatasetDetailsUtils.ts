/*
 *  Copyright 2022 Collate.
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

import i18next from 'i18next';
import { TabSpecificField } from '../enums/entity.enum';

export const defaultFields = `${TabSpecificField.COLUMNS}, ${TabSpecificField.USAGE_SUMMARY}, 
${TabSpecificField.FOLLOWERS}, ${TabSpecificField.JOINS}, ${TabSpecificField.TAGS}, ${TabSpecificField.OWNER}, 
${TabSpecificField.DATAMODEL},${TabSpecificField.TABLE_CONSTRAINTS},${TabSpecificField.EXTENSION}`;

export const datasetTableTabs = [
  {
    name: i18next.t('label.schema'),
    path: 'schema',
  },
  {
    name: i18next.t('label.activity-feed-and-task-plural'),
    path: 'activity_feed',
    field: TabSpecificField.ACTIVITY_FEED,
  },
  {
    name: i18next.t('label.sample-data'),
    path: 'sample_data',
  },
  {
    name: i18next.t('label.query-plural'),
    path: 'table_queries',
  },
  {
    name: i18next.t('label.profiler'),
    path: 'profiler',
  },
  {
    name: i18next.t('label.data-entity', {
      entity: i18next.t('label.quality'),
    }),
    path: 'data-quality',
  },
  {
    name: i18next.t('label.lineage'),
    path: 'lineage',
    field: TabSpecificField.LINEAGE,
  },
  {
    name: i18next.t('label.dbt-uppercase'),
    path: 'dbt',
  },
  {
    name: i18next.t('label.custom-property-plural'),
    path: 'custom_properties',
  },
];

export const getCurrentDatasetTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'activity_feed':
      currentTab = 2;

      break;
    case 'sample_data':
      currentTab = 3;

      break;
    case 'table_queries':
      currentTab = 4;

      break;

    case 'profiler':
      currentTab = 5;

      break;

    case 'data-quality':
      currentTab = 6;

      break;

    case 'lineage':
      currentTab = 7;

      break;

    case 'dbt':
      currentTab = 8;

      break;

    case 'custom_properties':
      currentTab = 9;

      break;

    case 'schema':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};
