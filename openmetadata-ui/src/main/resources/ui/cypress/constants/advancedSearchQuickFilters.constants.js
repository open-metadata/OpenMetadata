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

import { MYDATA_SUMMARY_OPTIONS } from './constants';

export const COMMON_DROPDOWN_ITEMS = [
  {
    label: 'Owner',
    key: 'owner.displayName',
    aggregateKey: 'displayName.keyword',
    filterSearchIndex: 'user_search_index%2Cteam_search_index',
    selectOption1: 'Aaron Johnson',
    selectOptionTestId1: 'Aaron Johnson',
    selectOption2: 'Aaron Singh',
    selectOptionTestId2: 'Aaron Singh',
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
];

export const TABLE_DROPDOWN_ITEMS = [
  ...COMMON_DROPDOWN_ITEMS,
  {
    label: 'Column',
    key: 'columns.name',
    selectOption1: 'ad_id',
    selectOptionTestId1: 'ad_id',
    selectOption2: 'gross_sales',
    selectOptionTestId2: 'gross_sales',
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

export const TOPIC_DROPDOWN_ITEMS = [
  ...COMMON_DROPDOWN_ITEMS,
  {
    label: 'Schema Field',
    key: 'messageSchema.schemaFields.name',
    selectOption1: 'order',
    selectOptionTestId1: 'order',
    selectOption2: 'product',
    selectOptionTestId2: 'product',
  },
];

export const DASHBOARD_DROPDOWN_ITEMS = [
  ...COMMON_DROPDOWN_ITEMS,
  {
    label: 'Data Model',
    key: 'dataModels.displayName.keyword',
    selectOption1: 'Vaccine Candidates per Phase',
    selectOptionTestId1: 'Vaccine Candidates per Phase',
    selectOption2: 'Vaccine Candidates per Country',
    selectOptionTestId2: 'Vaccine Candidates per Country',
  },
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
    key: 'dataModel.columns.name',
    selectOption1: 'department_id',
    selectOptionTestId1: 'department_id',
    selectOption2: 'transaction_id',
    selectOptionTestId2: 'transaction_id',
  },
];

export const QUICK_FILTERS_BY_ASSETS = [
  {
    label: 'Tables',
    searchIndex: 'table_search_index',
    filters: TABLE_DROPDOWN_ITEMS,
    tab: 'tables-tab',
    entity: MYDATA_SUMMARY_OPTIONS.tables,
    serviceName: 'sample_data',
    serviceType: 'BigQuery',
    entityName: 'fact_line_item',
    tag1: 'PersonalData.Personal',
    tag2: 'PII.Sensitive',
  },
  {
    label: 'Topics',
    searchIndex: 'topic_search_index',
    filters: TOPIC_DROPDOWN_ITEMS,
    tab: 'topics-tab',
    entity: MYDATA_SUMMARY_OPTIONS.topics,
    serviceName: 'sample_kafka',
    serviceType: 'Kafka',
    entityName: 'customer_contacts',
    tag1: 'PersonalData.Personal',
    tag2: 'PII.Sensitive',
  },
  {
    label: 'Dashboards',
    searchIndex: 'dashboard_search_index',
    filters: DASHBOARD_DROPDOWN_ITEMS,
    tab: 'dashboards-tab',
    dashboardName: '8',
    entity: MYDATA_SUMMARY_OPTIONS.dashboards,
    serviceName: 'sample_superset',
    serviceType: 'Superset',
    entityName: 'Misc Charts',
    tag1: 'PersonalData.Personal',
    tag2: 'PII.Sensitive',
  },
  {
    label: 'Pipelines',
    searchIndex: 'pipeline_search_index',
    filters: PIPELINE_DROPDOWN_ITEMS,
    tab: 'pipelines-tab',
    entity: MYDATA_SUMMARY_OPTIONS.pipelines,
    serviceName: 'sample_airflow',
    serviceType: 'Airflow',
    entityName: 'presto_etl',
    tag1: 'PersonalData.Personal',
    tag2: 'PII.Sensitive',
  },
  {
    label: 'Ml Models',
    searchIndex: 'mlmodel_search_index',
    filters: COMMON_DROPDOWN_ITEMS,
    tab: 'ml models-tab',
    entity: MYDATA_SUMMARY_OPTIONS.mlmodels,
    serviceName: 'mlflow_svc',
    serviceType: 'Mlflow',
    entityName: 'eta_predictions',
    tag1: 'PersonalData.Personal',
    tag2: 'PII.Sensitive',
  },
  {
    label: 'Containers',
    searchIndex: 'container_search_index',
    filters: CONTAINER_DROPDOWN_ITEMS,
    tab: 'containers-tab',
    entity: MYDATA_SUMMARY_OPTIONS.containers,
    serviceName: 's3_storage_sample',
    serviceType: 'S3',
    entityName: 'departments',
    tag1: 'PersonalData.Personal',
    tag2: 'PII.Sensitive',
  },
];
