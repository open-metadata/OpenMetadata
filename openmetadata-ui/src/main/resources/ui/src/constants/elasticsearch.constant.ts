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

import { t } from 'i18next';
import { map, startCase } from 'lodash';
import { ServiceCategoryPlural } from '../enums/service.enum';
import { SearchIndexMappingLanguage } from '../generated/configuration/elasticSearchConfiguration';

export const ELASTIC_SEARCH_INDEX_ENTITIES = [
  {
    value: 'table',
    label: t('label.table'),
  },
  {
    value: 'dashboard',
    label: t('label.dashboard'),
  },
  {
    value: 'topic',
    label: t('label.topic'),
  },
  {
    value: 'pipeline',
    label: t('label.pipeline'),
  },
  {
    value: 'searchIndex',
    label: t('label.search-index'),
  },
  {
    value: 'user',
    label: t('label.user'),
  },
  {
    value: 'team',
    label: t('label.team'),
  },
  {
    value: 'glossaryTerm',
    label: t('label.glossary-term'),
  },
  {
    value: 'mlmodel',
    label: t('label.ml-model'),
  },
  {
    value: 'tag',
    label: t('label.tag'),
  },
  {
    value: 'classification',
    label: t('label.classification'),
  },
  {
    value: 'query',
    label: t('label.query'),
  },
  {
    value: 'container',
    label: t('label.container'),
  },
  {
    value: 'database',
    label: t('label.database'),
  },
  {
    value: 'databaseSchema',
    label: t('label.database-schema'),
  },
  {
    value: 'testCase',
    label: t('label.test-case'),
  },
  {
    value: 'testSuite',
    label: t('label.test-suite'),
  },
  {
    value: 'chart',
    label: t('label.chart'),
  },
  {
    value: 'dashboardDataModel',
    label: t('label.data-model'),
  },
  ...map(ServiceCategoryPlural, (key, value) => ({
    value,
    label: startCase(key),
  })).filter(
    ({ value }) => ['metadataService', 'storageService'].indexOf(value) === -1
  ),
  {
    value: 'entityReportData',
    label: t('label.data-assets-report'),
  },
  {
    value: 'webAnalyticEntityViewReportData',
    label: t('label.web-analytics-report'),
  },
  {
    value: 'webAnalyticUserActivityReportData',
    label: t('label.user-analytics-report'),
  },
  {
    value: 'domain',
    label: t('label.domain'),
  },
  {
    value: 'storedProcedure',
    label: t('label.stored-procedure'),
  },
  {
    value: 'dataProduct',
    label: t('label.data-product'),
  },
];

export const ELASTIC_SEARCH_INITIAL_VALUES = {
  entities: ['all'],
  batchSize: 100,
  recreateIndex: true,
  searchIndexMappingLanguage: SearchIndexMappingLanguage.En,
  recreateIndexPipeline: false,
};

export const RECREATE_INDEX_OPTIONS = [
  {
    label: t('label.yes'),
    value: true,
  },
  {
    label: t('label.no'),
    value: false,
  },
];

export const ENTITY_TREE_OPTIONS = [
  {
    title: 'All',
    value: 'all',
    key: 'all',
    children: [
      ...ELASTIC_SEARCH_INDEX_ENTITIES.map(({ value, label }) => ({
        label: label,
        value: value,
      })),
    ],
  },
];

export const RE_INDEX_LANG_OPTIONS = map(
  SearchIndexMappingLanguage,
  (value) => ({
    label: value,
    value,
  })
);
