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

import { SearchIndexMappingLanguage } from 'generated/configuration/elasticSearchConfiguration';
import { t } from 'i18next';
import { map } from 'lodash';

export const ELASTIC_SEARCH_INDEX_ENTITIES = [
  {
    value: 'table',
    label: t('label.table'),
  },
  {
    value: 'topic',
    label: t('label.topic'),
  },
  {
    value: 'dashboard',
    label: t('label.dashboard'),
  },
  {
    value: 'pipeline',
    label: t('label.pipeline'),
  },
  {
    value: 'mlmodel',
    label: t('label.ml-model'),
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
    value: 'tag',
    label: t('label.tag'),
  },
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
];

export const ELASTIC_SEARCH_INITIAL_VALUES = {
  entities: [
    'table',
    'topic',
    'dashboard',
    'pipeline',
    'mlmodel',
    'user',
    'team',
    'glossaryTerm',
    'tag',
    'entityReportData',
    'webAnalyticEntityViewReportData',
    'webAnalyticUserActivityReportData',
  ],
  batchSize: 100,
  flushIntervalInSec: 30,
  recreateIndex: false,
  searchIndexMappingLanguage: SearchIndexMappingLanguage.En,
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
        title: label,
        value: value,
        key: value,
      })),
    ],
  },
];

export const RE_INDEX_LANG_OPTIONS = map(SearchIndexMappingLanguage, (value) => ({
  label: value,
  value,
}));