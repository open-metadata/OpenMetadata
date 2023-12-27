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

import { cloneDeep } from 'lodash';
import { SearchSuggestions } from '../components/GlobalSearchProvider/GlobalSearchSuggestions/GlobalSearchSuggestions.interface';
import {
  AIRBYTE,
  AIRFLOW,
  AMAZON_S3,
  AMUNDSEN,
  ATHENA,
  ATLAS,
  AZURESQL,
  BIGQUERY,
  CLICKHOUSE,
  COMMON_UI_SCHEMA,
  COUCHBASE,
  CUSTOM_STORAGE_DEFAULT,
  DAGSTER,
  DASHBOARD_DEFAULT,
  DATABASE_DEFAULT,
  DATABRICK,
  DATALAKE,
  DEFAULT_SERVICE,
  DELTALAKE,
  DOMO,
  DORIS,
  DRUID,
  DYNAMODB,
  ELASTIC_SEARCH,
  FIVETRAN,
  GLUE,
  GREENPLUM,
  HIVE,
  IBMDB2,
  IMPALA,
  KAFKA,
  KINESIS,
  LIGHT_DASH,
  LOGO,
  LOOKER,
  MARIADB,
  METABASE,
  MLFLOW,
  ML_MODEL_DEFAULT,
  MODE,
  MONGODB,
  MSSQL,
  MYSQL,
  NIFI,
  OPEN_SEARCH,
  ORACLE,
  PINOT,
  PIPELINE_DEFAULT,
  POSTGRES,
  POWERBI,
  PRESTO,
  QLIK_SENSE,
  QUICKSIGHT,
  REDASH,
  REDPANDA,
  REDSHIFT,
  SAGEMAKER,
  SALESFORCE,
  SAP_HANA,
  SAS,
  SCIKIT,
  SINGLESTORE,
  SNOWFLAKE,
  SPLINE,
  SQLITE,
  SUPERSET,
  TABLEAU,
  TOPIC_DEFAULT,
  TRINO,
  UNITYCATALOG,
  VERTICA,
} from '../constants/Services.constant';
import { StorageServiceType } from '../generated/entity/data/container';
import { DashboardServiceType } from '../generated/entity/data/dashboard';
import { DatabaseServiceType } from '../generated/entity/data/database';
import { MlModelServiceType } from '../generated/entity/data/mlmodel';
import { PipelineServiceType } from '../generated/entity/data/pipeline';
import { SearchServiceType } from '../generated/entity/data/searchIndex';
import { MessagingServiceType } from '../generated/entity/data/topic';
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import { SearchSourceAlias } from '../interface/search.interface';
import customConnection from '../jsons/connectionSchemas/connections/storage/customStorageConnection.json';
import s3Connection from '../jsons/connectionSchemas/connections/storage/s3Connection.json';
import { customServiceComparator } from './StringsUtils';

class ServiceUtilClassBase {
  unSupportedServices: string[] = [
    StorageServiceType.Adls,
    DatabaseServiceType.QueryLog,
    DatabaseServiceType.Dbt,
  ];

  protected updateUnsupportedServices(types: string[]) {
    this.unSupportedServices = types;
  }

  filterUnsupportedServiceType(types: string[]) {
    return types.filter((type) => !this.unSupportedServices.includes(type));
  }

  public getSupportedServiceFromList() {
    return {
      databaseServices: this.filterUnsupportedServiceType(
        Object.values(DatabaseServiceType) as string[]
      ).sort(customServiceComparator),
      messagingServices: this.filterUnsupportedServiceType(
        Object.values(MessagingServiceType) as string[]
      ).sort(customServiceComparator),
      dashboardServices: this.filterUnsupportedServiceType(
        Object.values(DashboardServiceType) as string[]
      ).sort(customServiceComparator),
      pipelineServices: this.filterUnsupportedServiceType(
        Object.values(PipelineServiceType) as string[]
      ).sort(customServiceComparator),
      mlmodelServices: this.filterUnsupportedServiceType(
        Object.values(MlModelServiceType) as string[]
      ).sort(customServiceComparator),
      metadataServices: this.filterUnsupportedServiceType(
        Object.values(MetadataServiceType) as string[]
      ).sort(customServiceComparator),
      storageServices: this.filterUnsupportedServiceType(
        Object.values(StorageServiceType) as string[]
      ).sort(customServiceComparator),
      searchServices: this.filterUnsupportedServiceType(
        Object.values(SearchServiceType) as string[]
      ).sort(customServiceComparator),
    };
  }

  public getServiceTypeLogo(
    searchSource: SearchSuggestions[number] | SearchSourceAlias
  ) {
    const serviceTypes = this.getSupportedServiceFromList();
    const type = searchSource?.serviceType ?? '';
    switch (type) {
      case DatabaseServiceType.Mysql:
        return MYSQL;

      case DatabaseServiceType.Redshift:
        return REDSHIFT;

      case DatabaseServiceType.BigQuery:
        return BIGQUERY;

      case DatabaseServiceType.Hive:
        return HIVE;

      case DatabaseServiceType.Impala:
        return IMPALA;

      case DatabaseServiceType.Postgres:
        return POSTGRES;

      case DatabaseServiceType.Oracle:
        return ORACLE;

      case DatabaseServiceType.Snowflake:
        return SNOWFLAKE;

      case DatabaseServiceType.Mssql:
        return MSSQL;

      case DatabaseServiceType.Athena:
        return ATHENA;

      case DatabaseServiceType.Presto:
        return PRESTO;

      case DatabaseServiceType.Trino:
        return TRINO;

      case DatabaseServiceType.Glue:
        return GLUE;

      case DatabaseServiceType.DomoDatabase:
        return DOMO;

      case DatabaseServiceType.MariaDB:
        return MARIADB;

      case DatabaseServiceType.Vertica:
        return VERTICA;

      case DatabaseServiceType.AzureSQL:
        return AZURESQL;

      case DatabaseServiceType.Clickhouse:
        return CLICKHOUSE;

      case DatabaseServiceType.Databricks:
        return DATABRICK;

      case DatabaseServiceType.UnityCatalog:
        return UNITYCATALOG;

      case DatabaseServiceType.Db2:
        return IBMDB2;

      case DatabaseServiceType.Doris:
        return DORIS;

      case DatabaseServiceType.Druid:
        return DRUID;

      case DatabaseServiceType.DynamoDB:
        return DYNAMODB;

      case DatabaseServiceType.SingleStore:
        return SINGLESTORE;

      case DatabaseServiceType.SQLite:
        return SQLITE;

      case DatabaseServiceType.Salesforce:
        return SALESFORCE;

      case DatabaseServiceType.SapHana:
        return SAP_HANA;

      case DatabaseServiceType.DeltaLake:
        return DELTALAKE;

      case DatabaseServiceType.PinotDB:
        return PINOT;

      case DatabaseServiceType.Datalake:
        return DATALAKE;

      case DatabaseServiceType.MongoDB:
        return MONGODB;

      case DatabaseServiceType.SAS:
        return SAS;

      case DatabaseServiceType.Couchbase:
        return COUCHBASE;

      case DatabaseServiceType.Greenplum:
        return GREENPLUM;

      case MessagingServiceType.Kafka:
        return KAFKA;

      case MessagingServiceType.Redpanda:
        return REDPANDA;

      case MessagingServiceType.Kinesis:
        return KINESIS;

      case DashboardServiceType.Superset:
        return SUPERSET;

      case DashboardServiceType.Looker:
        return LOOKER;

      case DashboardServiceType.Tableau:
        return TABLEAU;

      case DashboardServiceType.Redash:
        return REDASH;

      case DashboardServiceType.Metabase:
        return METABASE;

      case DashboardServiceType.PowerBI:
        return POWERBI;

      case DashboardServiceType.QuickSight:
        return QUICKSIGHT;

      case DashboardServiceType.DomoDashboard:
        return DOMO;

      case DashboardServiceType.Mode:
        return MODE;

      case DashboardServiceType.QlikSense:
        return QLIK_SENSE;

      case DashboardServiceType.Lightdash:
        return LIGHT_DASH;

      case PipelineServiceType.Airflow:
        return AIRFLOW;

      case PipelineServiceType.Airbyte:
        return AIRBYTE;

      case PipelineServiceType.Dagster:
        return DAGSTER;

      case PipelineServiceType.Fivetran:
        return FIVETRAN;

      case PipelineServiceType.GluePipeline:
        return GLUE;

      case PipelineServiceType.Spline:
        return SPLINE;

      case PipelineServiceType.Nifi:
        return NIFI;

      case PipelineServiceType.DomoPipeline:
        return DOMO;

      case PipelineServiceType.DatabricksPipeline:
        return DATABRICK;

      case MlModelServiceType.Mlflow:
        return MLFLOW;

      case MlModelServiceType.Sklearn:
        return SCIKIT;
      case MlModelServiceType.SageMaker:
        return SAGEMAKER;

      case MetadataServiceType.Amundsen:
        return AMUNDSEN;

      case MetadataServiceType.Atlas:
        return ATLAS;

      case MetadataServiceType.OpenMetadata:
        return LOGO;

      case StorageServiceType.S3:
        return AMAZON_S3;

      case SearchServiceType.ElasticSearch:
        return ELASTIC_SEARCH;

      case SearchServiceType.OpenSearch:
        return OPEN_SEARCH;

      default: {
        let logo;
        if (serviceTypes.messagingServices.includes(type)) {
          logo = TOPIC_DEFAULT;
        } else if (serviceTypes.dashboardServices.includes(type)) {
          logo = DASHBOARD_DEFAULT;
        } else if (serviceTypes.pipelineServices.includes(type)) {
          logo = PIPELINE_DEFAULT;
        } else if (serviceTypes.databaseServices.includes(type)) {
          logo = DATABASE_DEFAULT;
        } else if (serviceTypes.mlmodelServices.includes(type)) {
          logo = ML_MODEL_DEFAULT;
        } else if (serviceTypes.storageServices.includes(type)) {
          logo = CUSTOM_STORAGE_DEFAULT;
        } else {
          logo = DEFAULT_SERVICE;
        }

        return logo;
      }
    }
  }

  public getStorageServiceConfig(type: StorageServiceType) {
    let schema = {};
    const uiSchema = { ...COMMON_UI_SCHEMA };
    switch (type) {
      case StorageServiceType.S3: {
        schema = s3Connection;

        break;
      }
      case StorageServiceType.CustomStorage: {
        schema = customConnection;

        break;
      }
    }

    return cloneDeep({ schema, uiSchema });
  }
}

const serviceUtilClassBase = new ServiceUtilClassBase();

export default serviceUtilClassBase;
export { ServiceUtilClassBase };
