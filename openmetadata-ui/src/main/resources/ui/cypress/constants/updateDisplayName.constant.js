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
import { MYDATA_SUMMARY_OPTIONS, SERVICE_TYPE } from './constants';

export const SERVICES = {
  databaseServices: {
    type: SERVICE_TYPE.Database,
    name: 'sample_data',
    displayName: 'Sample Data',
  },
  messagingServices: {
    type: SERVICE_TYPE.Messaging,
    name: 'sample_kafka',
    displayName: 'Sample Kafka',
  },
  dashboardServices: {
    type: SERVICE_TYPE.Dashboard,
    name: 'sample_looker',
    displayName: 'Sample Looker',
  },
  pipelineServices: {
    type: SERVICE_TYPE.Pipeline,
    name: 'sample_airflow',
    displayName: 'Sample Airflow',
  },
  mlmodelServices: {
    type: SERVICE_TYPE.MLModels,
    name: 'mlflow_svc',
    displayName: 'ML Flow Service',
  },
  storageServices: {
    type: SERVICE_TYPE.Storage,
    name: 's3_storage_sample',
    displayName: 'Storage Sample Service',
  },
};

const DB_SERVICE = SERVICES.databaseServices.name;
const DATABASE_AND_SCHEMA = {
  schema: 'shopify',
  schemaDisplayName: 'Shopify Schema',
  database: 'ecommerce_db',
  databaseDisplayName: 'E-Commerce Database',
};

export const ENTITIES_DISPLAY_NAME = {
  table: {
    name: 'dim.shop',
    oldDisplayName: 'dim.shop',
    displayName: 'Dim Shop Test',
    entity: MYDATA_SUMMARY_OPTIONS.tables,
    serviceName: DB_SERVICE,
    breadcrumb: [
      DATABASE_AND_SCHEMA.schemaDisplayName,
      DATABASE_AND_SCHEMA.databaseDisplayName,
      SERVICES.databaseServices.displayName,
    ],
  },
  topic: {
    name: 'address_book',
    oldDisplayName: 'address_book',
    displayName: 'Kafka Address Book',
    entity: MYDATA_SUMMARY_OPTIONS.topics,
    serviceName: SERVICES.messagingServices.name,
    breadcrumb: [SERVICES.messagingServices.displayName],
  },
  dashboard: {
    name: 'Customers dashboard',
    oldDisplayName: 'Customers dashboard',
    displayName: 'Looker Customers Dashboard',
    entity: MYDATA_SUMMARY_OPTIONS.dashboards,
    serviceName: SERVICES.dashboardServices.name,
    breadcrumb: [SERVICES.dashboardServices.displayName],
  },
  pipeline: {
    name: 'dim_address_etl',
    oldDisplayName: 'dim_address_etl',
    displayName: 'Dim Address ETL',
    entity: MYDATA_SUMMARY_OPTIONS.pipelines,
    serviceName: SERVICES.pipelineServices.name,
    breadcrumb: [SERVICES.pipelineServices.displayName],
  },
  mlmodel: {
    name: 'eta_predictions',
    oldDisplayName: 'ETA Predictions',
    displayName: 'Predictions ETA',
    entity: MYDATA_SUMMARY_OPTIONS.mlmodels,
    serviceName: SERVICES.mlmodelServices.name,
    breadcrumb: [SERVICES.mlmodelServices.displayName],
  },
  container: {
    name: 'departments',
    oldDisplayName: 'Company departments',
    displayName: 'Company Departments Test',
    entity: MYDATA_SUMMARY_OPTIONS.containers,
    serviceName: SERVICES.storageServices.name,
    breadcrumb: [SERVICES.storageServices.displayName],
  },
  storedProcedure: {
    name: 'update_dim_address_table',
    oldDisplayName: 'update_dim_address_table',
    displayName: 'Update_Dim_Address_Table',
    entity: MYDATA_SUMMARY_OPTIONS.storedProcedures,
    serviceName: 'sample_data',
    breadcrumb: [
      DATABASE_AND_SCHEMA.schemaDisplayName,
      DATABASE_AND_SCHEMA.databaseDisplayName,
      SERVICES.databaseServices.displayName,
    ],
  },
};
export const DASHBOARD_DATA_MODEL = {
  service: SERVICES.dashboardServices,
  name: 'Operations View',
  displayName: 'Operations View Dashboard',
  breadcrumb: [SERVICES.dashboardServices.displayName],
};

export const SCHEMA_AND_DATABASE_DISPLAY_NAME = {
  ...ENTITIES_DISPLAY_NAME.table,
  ...DATABASE_AND_SCHEMA,
  schemaBreadcrumb: [
    DATABASE_AND_SCHEMA.databaseDisplayName,
    SERVICES.databaseServices.displayName,
  ],
  databaseBreadcrumb: [SERVICES.databaseServices.displayName],
};
