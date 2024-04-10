/*
 *  Copyright 2023 Collate.
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

import { DATA_ASSETS } from './constants';

export const COMMON_DROPDOWN_ITEMS = [
  {
    label: 'Owner',
    key: 'owner.displayName.keyword',
    aggregateKey: 'displayName.keyword',
    filterSearchIndex: 'user_search_index%2Cteam_search_index',
    selectOption1: 'Aaron Johnson',
    selectOptionTestId1: 'Aaron Johnson',
    selectOption2: 'Aaron Singh',
    selectOptionTestId2: 'Aaron Singh',
    select: true,
  },
  {
    label: 'Tag',
    key: 'tags.tagFQN',
    filterSearchIndex: 'tag_search_index%2Cglossary_search_index',
    selectOption1: 'PersonalData.Personal',
    selectOptionTestId1: 'PersonalData.Personal',
    selectOption2: 'PII.Sensitive',
    selectOptionTestId2: 'PII.Sensitive',
  },
  {
    label: 'Service',
    key: 'service.name',
  },
  {
    label: 'Tier',
    key: 'tier.tagsFQN',
  },
  {
    label: 'Service Type',
    key: 'serviceType.keyword',
  },
];

export const TABLE_DROPDOWN_ITEMS = [
  ...COMMON_DROPDOWN_ITEMS,
  {
    label: 'Column',
    key: 'columns.name',
    selectOption1: 'comments',
    selectOptionTestId1: 'comments',
    select: true,
  },

  {
    label: 'Schema',
    key: 'databaseSchema.name',
    selectOption1: 'shopify',
    selectOptionTestId1: 'shopify',
  },
  {
    label: 'Database',
    key: 'database.name',
    selectOption1: 'ecommerce_db',
    selectOptionTestId1: 'ecommerce_db',
  },
];

export const DASHBOARD_DROPDOWN_ITEMS = [
  ...COMMON_DROPDOWN_ITEMS,
  {
    label: 'Chart',
    key: 'charts.name',
    selectOption1: 'ETA Predictions Accuracy',
    selectOptionTestId1: 'ETA Predictions Accuracy',
    selectOption2: 'Birth in France by department in 2016',
    selectOptionTestId2: 'Birth in France by department in 2016',
  },
];

export const PIPELINE_DROPDOWN_ITEMS = [
  ...COMMON_DROPDOWN_ITEMS,
  {
    label: 'Task',
    key: 'tasks.name',
    selectOption1: 'Hive Create Table',
    selectOptionTestId1: 'Hive Create Table',
    selectOption2: 'Presto Task',
    selectOptionTestId2: 'Presto Task',
  },
];

export const CONTAINER_DROPDOWN_ITEMS = [
  ...COMMON_DROPDOWN_ITEMS,
  {
    label: 'Column',
    key: 'dataModel.columns.name.keyword',
  },
];

export const GLOSSARY_DROPDOWN_ITEMS = [
  {
    label: 'Owner',
    key: 'owner.displayName.keyword',
  },
  {
    label: 'Tag',
    key: 'tags.tagFQN',
  },
  {
    label: 'Glossaries',
    key: 'glossary.name.keyword',
  },
];

export const TAG_DROPDOWN_ITEMS = [
  {
    label: 'Classification',
    key: 'classification.name.keyword',
  },
];

export const QUICK_FILTERS_BY_ASSETS = [
  {
    label: 'Tables',
    searchIndex: 'table_search_index',
    filters: TABLE_DROPDOWN_ITEMS,
    tab: 'tables-tab',
    entity: DATA_ASSETS.tables,
    serviceName: 'sample_data',
    tag1: 'PersonalData.Personal',
    tag2: 'PII.Sensitive',
  },
  {
    label: 'Topics',
    searchIndex: 'topic_search_index',
    filters: COMMON_DROPDOWN_ITEMS,
    tab: 'topics-tab',
    entity: DATA_ASSETS.topics,
    serviceName: 'sample_kafka',
    tag: 'PersonalData.Personal',
  },
  {
    label: 'Dashboards',
    searchIndex: 'dashboard_search_index',
    filters: DASHBOARD_DROPDOWN_ITEMS,
    tab: 'dashboards-tab',
    dashboardName: '8',
    entity: DATA_ASSETS.dashboards,
    serviceName: 'sample_superset',
    tag: 'PersonalData.Personal',
  },
  {
    label: 'Pipelines',
    searchIndex: 'pipeline_search_index',
    filters: PIPELINE_DROPDOWN_ITEMS,
    tab: 'pipelines-tab',
    entity: DATA_ASSETS.pipelines,
    serviceName: 'sample_airflow',
    tag: 'PersonalData.Personal',
  },
  {
    label: 'Ml Models',
    searchIndex: 'mlmodel_search_index',
    filters: COMMON_DROPDOWN_ITEMS,
    tab: 'ml models-tab',
    entity: DATA_ASSETS.mlmodels,
    serviceName: 'mlflow_svc',
    tag: 'PersonalData.Personal',
  },
  {
    label: 'Containers',
    searchIndex: 'container_search_index',
    filters: CONTAINER_DROPDOWN_ITEMS,
    tab: 'containers-tab',
    entity: DATA_ASSETS.containers,
  },
  {
    label: 'Glossaries',
    searchIndex: 'glossary_search_index',
    filters: GLOSSARY_DROPDOWN_ITEMS,
    tab: 'glossary terms-tab',
    entity: DATA_ASSETS.glossaryTerms,
  },
  {
    label: 'Tags',
    searchIndex: 'tag_search_index',
    filters: TAG_DROPDOWN_ITEMS,
    tab: 'tags-tab',
    entity: DATA_ASSETS.tags,
  },
];
