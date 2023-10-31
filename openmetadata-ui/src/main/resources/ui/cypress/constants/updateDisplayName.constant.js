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
import {
  DASHBOARD_DATA_MODEL_DETAILS,
  DASHBOARD_SERVICE,
  DATABASE_SERVICE,
  MESSAGING_SERVICE,
  MLMODEL_SERVICE,
  PIPELINE_SERVICE,
  STORAGE_SERVICE,
  STORED_PROCEDURE_DETAILS,
} from './entityConstant';

export const SERVICES = {
  databaseServices: {
    type: SERVICE_TYPE.Database,
    name: DATABASE_SERVICE.service.name,
    displayName: 'Sample Data',
  },
  messagingServices: {
    type: SERVICE_TYPE.Messaging,
    name: MESSAGING_SERVICE.service.name,
    displayName: 'Sample Kafka',
  },
  dashboardServices: {
    type: SERVICE_TYPE.Dashboard,
    name: DASHBOARD_SERVICE.service.name,
    displayName: 'Sample Looker',
  },
  pipelineServices: {
    type: SERVICE_TYPE.Pipeline,
    name: PIPELINE_SERVICE.service.name,
    displayName: 'Sample Airflow',
  },
  mlmodelServices: {
    type: SERVICE_TYPE.MLModels,
    name: MLMODEL_SERVICE.service.name,
    displayName: 'ML Flow Service',
  },
  storageServices: {
    type: SERVICE_TYPE.Storage,
    name: STORAGE_SERVICE.service.name,
    displayName: 'Storage Sample Service',
  },
};

const DB_SERVICE = SERVICES.databaseServices.name;
const DATABASE_AND_SCHEMA = {
  schema: DATABASE_SERVICE.schema.name,
  schemaDisplayName: 'Shopify Schema',
  database: DATABASE_SERVICE.database.name,
  databaseDisplayName: 'E-Commerce Database',
};

export const ENTITIES_DISPLAY_NAME = {
  table: {
    name: DATABASE_SERVICE.tables.name,
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
    name: MESSAGING_SERVICE.entity.name,
    oldDisplayName: 'address_book',
    displayName: 'Kafka Address Book',
    entity: MYDATA_SUMMARY_OPTIONS.topics,
    serviceName: SERVICES.messagingServices.name,
    breadcrumb: [SERVICES.messagingServices.displayName],
  },
  dashboard: {
    name: DASHBOARD_SERVICE.entity.name,
    oldDisplayName: 'Customers dashboard',
    displayName: 'Looker Customers Dashboard',
    entity: MYDATA_SUMMARY_OPTIONS.dashboards,
    serviceName: SERVICES.dashboardServices.name,
    breadcrumb: [SERVICES.dashboardServices.displayName],
  },
  pipeline: {
    name: PIPELINE_SERVICE.entity.name,
    oldDisplayName: 'dim_address_etl',
    displayName: 'Dim Address ETL',
    entity: MYDATA_SUMMARY_OPTIONS.pipelines,
    serviceName: SERVICES.pipelineServices.name,
    breadcrumb: [SERVICES.pipelineServices.displayName],
  },
  mlmodel: {
    name: MLMODEL_SERVICE.entity.name,
    oldDisplayName: 'ETA Predictions',
    displayName: 'Predictions ETA',
    entity: MYDATA_SUMMARY_OPTIONS.mlmodels,
    serviceName: SERVICES.mlmodelServices.name,
    breadcrumb: [SERVICES.mlmodelServices.displayName],
  },
  container: {
    name: STORAGE_SERVICE.entity.name,
    oldDisplayName: 'Company departments',
    displayName: 'Company Departments Test',
    entity: MYDATA_SUMMARY_OPTIONS.containers,
    serviceName: SERVICES.storageServices.name,
    breadcrumb: [SERVICES.storageServices.displayName],
  },
  storedProcedure: {
    name: STORED_PROCEDURE_DETAILS.name,
    oldDisplayName: 'update_dim_address_table',
    displayName: 'Update_Dim_Address_Table',
    entity: MYDATA_SUMMARY_OPTIONS.storedProcedures,
    serviceName: DB_SERVICE,
    breadcrumb: [
      DATABASE_AND_SCHEMA.schemaDisplayName,
      DATABASE_AND_SCHEMA.databaseDisplayName,
      SERVICES.databaseServices.displayName,
    ],
  },
};
export const DASHBOARD_DATA_MODEL = {
  service: SERVICES.dashboardServices,
  name: DASHBOARD_DATA_MODEL_DETAILS.name,
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
