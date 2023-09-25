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

export const VOTING_ENTITIES = [
  {
    term: 'marketing',
    displayName: 'marketing',
    entity: 'tables',
    serviceName: 'sample_data',
    fieldName: 'SKU',
    permissionApi: '/api/v1/permissions/*/name/*',
  },
  {
    term: 'address_book',
    displayName: 'address_book',
    entity: 'topics',
    serviceName: 'sample_kafka',
    fieldName: 'AddressBook',
    permissionApi: '/api/v1/permissions/*/name/*',
  },
  {
    term: 'deck.gl Demo',
    displayName: 'deck.gl Demo',
    entity: 'dashboards',
    insideEntity: 'charts',
    serviceName: 'sample_superset',
    fieldName: 'e3cfd274-44f8-4bf3-b75d-d40cf88869ba',
    permissionApi: '/api/v1/permissions/*/*',
  },
  {
    term: 'dim_address_etl',
    displayName: 'dim_address etl',
    entity: 'pipelines',
    serviceName: 'sample_airflow',
    fieldName: 'dim_address_task',
    permissionApi: '/api/v1/permissions/*/*',
  },
  {
    term: 'eta_predictions',
    displayName: 'ETA Predictions',
    entity: 'mlmodels',
    serviceName: 'mlflow_svc',
    fieldName: 'sales',
    permissionApi: '/api/v1/permissions/*/*',
  },
  {
    term: 'update_orders_table',
    displayName: 'update_orders_table',
    entity: 'storedProcedures',
    serviceName: 'sample_data',
    permissionApi: '/api/v1/permissions/*/name/*',
  },
  {
    term: 'orders_view',
    displayName: 'orders_view',
    entity: 'dashboardDataModel',
    serviceName: 'sample_looker',
    permissionApi: '/api/v1/permissions/*/name/*',
  },
];
