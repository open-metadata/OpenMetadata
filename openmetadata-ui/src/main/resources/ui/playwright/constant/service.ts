/*
 *  Copyright 2024 Collate.
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
import { EntityTypeEndpoint } from '../support/entity/Entity.interface';
import { uuid } from '../utils/common';
import { GlobalSettingOptions, ServiceTypes } from './settings';

export const SERVICE_TYPE = {
  Database: GlobalSettingOptions.DATABASES,
  Messaging: GlobalSettingOptions.MESSAGING,
  Dashboard: GlobalSettingOptions.DASHBOARDS,
  Pipeline: GlobalSettingOptions.PIPELINES,
  MLModels: GlobalSettingOptions.MLMODELS,
  Storage: GlobalSettingOptions.STORAGES,
  Search: GlobalSettingOptions.SEARCH,
  Metadata: GlobalSettingOptions.METADATA,
  StoredProcedure: GlobalSettingOptions.STORED_PROCEDURES,
  ApiService: GlobalSettingOptions.APIS,
};
export const FollowSupportedServices = [
  EntityTypeEndpoint.DatabaseService,
  EntityTypeEndpoint.DatabaseSchema,
  EntityTypeEndpoint.Database,
];

export const CertificationSupportedServices = [
  EntityTypeEndpoint.DatabaseSchema,
  EntityTypeEndpoint.Database,
];

export const VISIT_SERVICE_PAGE_DETAILS = {
  [SERVICE_TYPE.Database]: {
    settingsMenuId: GlobalSettingOptions.DATABASES,
    serviceCategory: ServiceTypes.DATABASE_SERVICES,
  },
  [SERVICE_TYPE.Messaging]: {
    settingsMenuId: GlobalSettingOptions.MESSAGING,
    serviceCategory: ServiceTypes.MESSAGING_SERVICES,
  },
  [SERVICE_TYPE.Dashboard]: {
    settingsMenuId: GlobalSettingOptions.DASHBOARDS,
    serviceCategory: ServiceTypes.DASHBOARD_SERVICES,
  },
  [SERVICE_TYPE.Pipeline]: {
    settingsMenuId: GlobalSettingOptions.PIPELINES,
    serviceCategory: ServiceTypes.PIPELINE_SERVICES,
  },
  [SERVICE_TYPE.MLModels]: {
    settingsMenuId: GlobalSettingOptions.MLMODELS,
    serviceCategory: ServiceTypes.ML_MODEL_SERVICES,
  },
  [SERVICE_TYPE.Storage]: {
    settingsMenuId: GlobalSettingOptions.STORAGES,
    serviceCategory: ServiceTypes.STORAGE_SERVICES,
  },
  [SERVICE_TYPE.Search]: {
    settingsMenuId: GlobalSettingOptions.SEARCH,
    serviceCategory: ServiceTypes.SEARCH_SERVICES,
  },
  [SERVICE_TYPE.Metadata]: {
    settingsMenuId: GlobalSettingOptions.METADATA,
    serviceCategory: ServiceTypes.METADATA_SERVICES,
  },
};

const uniqueID = uuid();

export const REDSHIFT = {
  serviceType: 'Redshift',
  serviceName: `redshift-ct-test-with-%-${uniqueID}`,
  tableName: 'raw_payments',
  DBTTable: 'customers',
  description: `This is Redshift-ct-test-${uniqueID} description`,
};

export const POSTGRES = {
  serviceType: 'Postgres',
  serviceName: `pw-postgres-test-with-%-${uniqueID}`,
  tableName: 'order_items',
};

export const MYSQL = 'Mysql';

export const DBT = {
  classification: 'dbtTags',
  awsRegion: 'us-east-2',
  s3BucketName: 'awsdatalake-testing',
  s3Prefix: 'dbt-testing/mayur/',
  tagName: 'model_tag_two',
  dbtQuery: 'select * from "dev"."dbt_automate_upgrade_tests"."stg_orders"',
  dbtLineageNodeLabel: 'customers',
  dbtLineageNode: 'dev.dbt_automate_upgrade_tests.stg_customers',
  dataQualityTest1: 'unique_customers_customer_id',
  dataQualityTest2: 'not_null_customers_customer_id',
};

export const MAX_CONSECUTIVE_ERRORS = 3;
