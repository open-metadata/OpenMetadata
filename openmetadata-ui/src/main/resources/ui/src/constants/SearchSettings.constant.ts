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
import { SearchIndex } from '../enums/search.enum';
import { Property } from '../pages/SearchSettingsPage/searchSettings.interface';
import i18n from '../utils/i18next/LocalUtil';

export const ENTITY_PATH_TO_SEARCH_INDEX: Record<string, SearchIndex> = {
  table: SearchIndex.TABLE,
  topic: SearchIndex.TOPIC,
  dashboard: SearchIndex.DASHBOARD,
  pipeline: SearchIndex.PIPELINE,
  mlmodel: SearchIndex.MLMODEL,
  container: SearchIndex.CONTAINER,
  tag: SearchIndex.TAG,
  glossary: SearchIndex.GLOSSARY,
  glossaryTerm: SearchIndex.GLOSSARY_TERM,
  database: SearchIndex.DATABASE,
  databaseSchema: SearchIndex.DATABASE_SCHEMA,
  dashboardDataModel: SearchIndex.DASHBOARD_DATA_MODEL,
  apiCollection: SearchIndex.API_COLLECTION_INDEX,
  apiEndpoint: SearchIndex.API_ENDPOINT_INDEX,
  dataProduct: SearchIndex.DATA_PRODUCT,
  metric: SearchIndex.METRIC_SEARCH_INDEX,
  dataAsset: SearchIndex.DATA_ASSET,
  query: SearchIndex.QUERY,
  testCase: SearchIndex.TEST_CASE,
  domain: SearchIndex.DOMAIN,
  searchIndex: SearchIndex.SEARCH_INDEX,
  storedProcedure: SearchIndex.STORED_PROCEDURE,
};

export const globalSettings: Property[] = [
  {
    key: 'maxAggregateSize',
    label: i18n.t('label.max-aggregate-size'),
    min: 100,
    max: 10000,
  },
  {
    key: 'maxResultHits',
    label: i18n.t('label.max-result-hits'),
    min: 100,
    max: 10000,
  },
  {
    key: 'maxAnalyzedOffset',
    label: i18n.t('label.max-analyzed-offset'),
    min: 1000,
    max: 1000000,
  },
];

export const fieldValueBoostBaseColumns = [
  {
    title: i18n.t('label.field'),
    dataIndex: 'field',
    key: 'field',
    width: 250,
  },
  {
    title: i18n.t('label.factor'),
    dataIndex: 'factor',
    key: 'factor',
    width: 80,
  },
];

export const fieldValueBoostAdditionalColumns = [
  {
    title: i18n.t('label.modifier'),
    dataIndex: 'modifier',
    key: 'modifier',
    width: 120,
  },
  {
    title: i18n.t('label.missing-value'),
    dataIndex: 'missing',
    key: 'missing',
    width: 120,
  },
];
