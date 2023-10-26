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

export const TAGS_ADD_REMOVE_ENTITIES = [
  {
    term: 'marketing',
    displayName: 'marketing',
    entity: 'tables',
    serviceName: 'sample_data',
    fieldName: 'SKU',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/name/*',
  },
  {
    term: 'address_book',
    displayName: 'address_book',
    entity: 'topics',
    serviceName: 'sample_kafka',
    fieldName: 'AddressBook',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/name/*',
  },
  {
    term: 'deck.gl Demo',
    displayName: 'deck.gl Demo',
    entity: 'dashboards',
    insideEntity: 'charts',
    serviceName: 'sample_superset',
    fieldName: 'e3cfd274-44f8-4bf3-b75d-d40cf88869ba',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/*',
  },
  {
    term: 'dim_address_etl',
    displayName: 'dim_address etl',
    entity: 'pipelines',
    serviceName: 'sample_airflow',
    fieldName: 'dim_address_task',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/*',
  },
  {
    term: 'eta_predictions',
    displayName: 'ETA Predictions',
    entity: 'mlmodels',
    serviceName: 'mlflow_svc',
    fieldName: 'sales',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/*',
  },
  {
    term: 'engineering',
    displayName: 'Engineering department',
    entity: 'containers',
    serviceName: 's3_storage_sample',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/name/*',
  },
  {
    term: 'update_orders_table',
    displayName: 'update_orders_table',
    entity: 'storedProcedures',
    serviceName: 'sample_data',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/name/*',
  },
  {
    term: 'orders_view',
    displayName: 'orders_view',
    entity: 'dashboardDataModel',
    serviceName: 'sample_looker',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/name/*',
  },
];

export const CYPRESS_TAGS_FORM_MOCK_DATA = [
  {
    name: 'cypress-tags-add',
    displayName: 'cypress-tags-add',
    description: 'this is cypress-tags-add',
    style: {
      color: '#df2a2a',
    },
    classification: 'Classification-cypress',
  },
  {
    name: 'cypress-tags-database',
    displayName: 'cypress-tags-database',
    description: 'this is cypress-tags-database',
    style: {
      color: '#28f093',
    },
    classification: 'Classification-cypress',
  },
];

export const CYPRESS_CLASSIFICATION_FORM_MOCK_DATA = {
  description: 'this is Classification-cypress',
  displayName: 'Classification-cypress',
  name: 'Classification-cypress',
};
