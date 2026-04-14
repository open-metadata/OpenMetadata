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

import { ObjectFieldTemplatePropertyType } from '@rjsf/utils';
import { get, isEmpty, toLower } from 'lodash';
import { ServiceTypes } from 'Models';
import GlossaryIcon from '../assets/svg/book.svg';
import ChartIcon from '../assets/svg/chart.svg';
import DataProductIcon from '../assets/svg/ic-data-product.svg';
import DatabaseIcon from '../assets/svg/ic-database.svg';
import DatabaseSchemaIcon from '../assets/svg/ic-schema.svg';
import MetricIcon from '../assets/svg/metric.svg';
import TagIcon from '../assets/svg/tag-grey.svg';
import AgentsStatusWidget from '../components/ServiceInsights/AgentsStatusWidget/AgentsStatusWidget';
import PlatformInsightsWidget from '../components/ServiceInsights/PlatformInsightsWidget/PlatformInsightsWidget';
import TotalDataAssetsWidget from '../components/ServiceInsights/TotalDataAssetsWidget/TotalDataAssetsWidget';
import MetadataAgentsWidget from '../components/Settings/Services/Ingestion/MetadataAgentsWidget/MetadataAgentsWidget';
import {
  AIRBYTE,
  AIRFLOW,
  ALATIONSINK,
  AMAZON_S3,
  AMUNDSEN,
  ATHENA,
  ATLAS,
  AZURESQL,
  BIGQUERY,
  BIGTABLE,
  BURSTIQ,
  CASSANDRA,
  CLICKHOUSE,
  COCKROACH,
  COUCHBASE,
  CUSTOM_DRIVE_DEFAULT,
  CUSTOM_SEARCH_DEFAULT,
  CUSTOM_STORAGE_DEFAULT,
  DAGSTER,
  DASHBOARD_DEFAULT,
  DATABASE_DEFAULT,
  DATABRICK,
  DATALAKE,
  DBT,
  DEFAULT_SERVICE,
  DELTALAKE,
  DOMO,
  DORIS,
  DRUID,
  DYNAMODB,
  ELASTIC_SEARCH,
  EXASOL,
  FIVETRAN,
  FLINK,
  GCS,
  GLUE,
  GOOGLE_DRIVE,
  GRAFANA,
  GREENPLUM,
  HEX,
  HIVE,
  IBMDB2,
  IMPALA,
  IOMETE,
  KAFKA,
  KINESIS,
  LIGHT_DASH,
  LOGO,
  LOOKER,
  MARIADB,
  METABASE,
  MICROSTRATEGY,
  MLFLOW,
  ML_MODEL_DEFAULT,
  MODE,
  MONGODB,
  MSSQL,
  MYSQL,
  NIFI,
  OPENLINEAGE,
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
  REST_SERVICE,
  SAGEMAKER,
  SALESFORCE,
  SAP_ERP,
  SAP_HANA,
  SAS,
  SCIKIT,
  SFTP,
  SIGMA,
  SINGLESTORE,
  SNOWFLAKE,
  SPARK,
  SPLINE,
  SQLITE,
  STARROCKS,
  SUPERSET,
  SYNAPSE,
  TABLEAU,
  TERADATA,
  TIMESCALE,
  TOPIC_DEFAULT,
  TRINO,
  UNITYCATALOG,
  VERTICA,
} from '../constants/Services.constant';
import { EntityType } from '../enums/entity.enum';
import { ExplorePageTabs } from '../enums/Explore.enum';
import {
  ApiServiceTypeSmallCaseType,
  DashboardServiceTypeSmallCaseType,
  DatabaseServiceTypeSmallCaseType,
  DriveServiceTypeSmallCaseType,
  MessagingServiceTypeSmallCaseType,
  MetadataServiceTypeSmallCaseType,
  MlModelServiceTypeSmallCaseType,
  PipelineServiceTypeSmallCaseType,
  SearchServiceTypeSmallCaseType,
  SecurityServiceTypeSmallCaseType,
  StorageServiceTypeSmallCaseType,
} from '../enums/service.enum';
import { DriveServiceType } from '../generated/api/services/createDriveService';
import {
  ConfigObject,
  WorkflowType,
} from '../generated/entity/automations/workflow';
import { StorageServiceType } from '../generated/entity/data/container';
import { DashboardServiceType } from '../generated/entity/data/dashboard';
import { DatabaseServiceType } from '../generated/entity/data/database';
import { MlModelServiceType } from '../generated/entity/data/mlmodel';
import { PipelineServiceType } from '../generated/entity/data/pipeline';
import { SearchServiceType } from '../generated/entity/data/searchIndex';
import { MessagingServiceType } from '../generated/entity/data/topic';
import { APIServiceType } from '../generated/entity/services/apiService';
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import { Type as SecurityServiceType } from '../generated/entity/services/securityService';
import { ServiceType } from '../generated/entity/services/serviceType';
import {
  ConfigData,
  ExtraInfoType,
  ServicesType,
} from '../interface/service.interface';
import { getAPIConfig } from './APIServiceUtils';
import { getDashboardConfig } from './DashboardServiceUtils';
import { getDatabaseConfig } from './DatabaseServiceUtils';
import { getDriveConfig } from './DriveServiceUtils';
import { getMessagingConfig } from './MessagingServiceUtils';
import { getMetadataConfig } from './MetadataServiceUtils';
import { getMlmodelConfig } from './MlmodelServiceUtils';
import { getPipelineConfig } from './PipelineServiceUtils';
import { getSearchServiceConfig } from './SearchServiceUtils';
import { getSecurityConfig } from './SecurityServiceUtils';
import {
  getSearchIndexFromService,
  getTestConnectionName,
} from './ServiceUtils';
import { getStorageConfig } from './StorageServiceUtils';
import { customServiceComparator } from './StringsUtils';

class ServiceUtilClassBase {
  unSupportedServices: string[] = [
    StorageServiceType.Adls,
    DatabaseServiceType.QueryLog,
    DatabaseServiceType.Dbt,
    DatabaseServiceType.Synapse,
    MetadataServiceType.Alation,
    APIServiceType.Webhook,
    MlModelServiceType.VertexAI,
    PipelineServiceType.Matillion,
    PipelineServiceType.DataFactory,
    PipelineServiceType.Stitch,
    DashboardServiceType.PowerBIReportServer,
    DatabaseServiceType.Ssas,
    DashboardServiceType.ThoughtSpot,
    PipelineServiceType.Ssis,
    PipelineServiceType.Wherescape,
    SecurityServiceType.Ranger,
    DatabaseServiceType.Epic,
    PipelineServiceType.Snowplow,
    DriveServiceType.GoogleDrive,
    DriveServiceType.SharePoint,
    DatabaseServiceType.Informix,
    DatabaseServiceType.ServiceNow,
    DatabaseServiceType.Dremio,
    MetadataServiceType.Collibra,
    PipelineServiceType.Mulesoft,
    DatabaseServiceType.MicrosoftFabric,
    PipelineServiceType.MicrosoftFabricPipeline,
    DatabaseServiceType.MicrosoftAccess,
  ];

  DatabaseServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    DatabaseServiceTypeSmallCaseType
  >(DatabaseServiceType);

  MessagingServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    MessagingServiceTypeSmallCaseType
  >(MessagingServiceType);

  DashboardServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    DashboardServiceTypeSmallCaseType
  >(DashboardServiceType);

  PipelineServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    PipelineServiceTypeSmallCaseType
  >(PipelineServiceType);

  MlModelServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    MlModelServiceTypeSmallCaseType
  >(MlModelServiceType);

  MetadataServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    MetadataServiceTypeSmallCaseType
  >(MetadataServiceType);

  StorageServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    StorageServiceTypeSmallCaseType
  >(StorageServiceType);

  SearchServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    SearchServiceTypeSmallCaseType
  >(SearchServiceType);

  ApiServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    ApiServiceTypeSmallCaseType
  >(APIServiceType);

  SecurityServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    SecurityServiceTypeSmallCaseType
  >(SecurityServiceType);

  DriveServiceTypeSmallCase = this.convertEnumToLowerCase<
    { [k: string]: string },
    DriveServiceTypeSmallCaseType
  >(DriveServiceType);

  protected updateUnsupportedServices(types: string[]) {
    this.unSupportedServices = types;
  }

  filterUnsupportedServiceType(types: string[]) {
    return types.filter((type) => !this.unSupportedServices.includes(type));
  }

  private serviceDetails?: ServicesType;

  public setEditServiceDetails(serviceDetails?: ServicesType) {
    this.serviceDetails = serviceDetails;
  }

  public getEditServiceDetails() {
    return this.serviceDetails;
  }

  public getAddWorkflowData(
    connectionType: string,
    serviceType: ServiceType,
    serviceName?: string,
    configData?: ConfigData
  ) {
    return {
      name: getTestConnectionName(connectionType),
      workflowType: WorkflowType.TestConnection,
      request: {
        connection: { config: configData as ConfigObject },
        serviceType,
        connectionType,
        serviceName,
      },
    };
  }

  public getServiceConfigData(data: {
    serviceName: string;
    serviceType: string;
    description: string;
    userId: string;
    configData: ConfigData;
  }) {
    const { serviceName, serviceType, description, userId, configData } = data;

    return {
      name: serviceName,
      serviceType: serviceType,
      description: description,
      owners: [
        {
          id: userId,
          type: 'user',
        },
      ],
      connection: {
        config: configData,
      },
    };
  }

  public getServiceExtraInfo(_data?: ServicesType): ExtraInfoType | null {
    return null;
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
      apiServices: this.filterUnsupportedServiceType(
        Object.values(APIServiceType) as string[]
      ).sort(customServiceComparator),
      driveServices: this.filterUnsupportedServiceType(
        Object.values(DriveServiceType) as string[]
      ).sort(customServiceComparator),
      securityServices: this.filterUnsupportedServiceType(
        Object.values(SecurityServiceType) as string[]
      ).sort(customServiceComparator),
    };
  }

  public getEntityTypeFromServiceType(serviceType: string): EntityType {
    const serviceTypes = this.getSupportedServiceFromList();

    // Check which service category the serviceType belongs to
    if (serviceTypes.databaseServices.includes(serviceType)) {
      return EntityType.TABLE;
    }

    if (serviceTypes.messagingServices.includes(serviceType)) {
      return EntityType.TOPIC;
    }

    if (serviceTypes.dashboardServices.includes(serviceType)) {
      return EntityType.DASHBOARD;
    }

    if (serviceTypes.pipelineServices.includes(serviceType)) {
      return EntityType.PIPELINE;
    }

    if (serviceTypes.mlmodelServices.includes(serviceType)) {
      return EntityType.MLMODEL;
    }

    if (serviceTypes.storageServices.includes(serviceType)) {
      return EntityType.CONTAINER;
    }

    if (serviceTypes.searchServices.includes(serviceType)) {
      return EntityType.SEARCH_INDEX;
    }

    if (serviceTypes.apiServices.includes(serviceType)) {
      return EntityType.API_ENDPOINT;
    }

    if (serviceTypes.securityServices.includes(serviceType)) {
      return EntityType.TABLE; // Security services typically work with tables
    }

    if (serviceTypes.driveServices.includes(serviceType)) {
      return EntityType.DIRECTORY;
    }

    // Default fallback
    return EntityType.TABLE;
  }

  private readonly serviceLogoMap = new Map<string, string>([
    [this.DatabaseServiceTypeSmallCase.CustomDatabase, DATABASE_DEFAULT],
    [this.DatabaseServiceTypeSmallCase.Mysql, MYSQL],
    [this.DatabaseServiceTypeSmallCase.Redshift, REDSHIFT],
    [this.DatabaseServiceTypeSmallCase.BigQuery, BIGQUERY],
    [this.DatabaseServiceTypeSmallCase.BigTable, BIGTABLE],
    [this.DatabaseServiceTypeSmallCase.Hive, HIVE],
    [this.DatabaseServiceTypeSmallCase.Impala, IMPALA],
    [this.DatabaseServiceTypeSmallCase.Postgres, POSTGRES],
    [this.DatabaseServiceTypeSmallCase.Oracle, ORACLE],
    [this.DatabaseServiceTypeSmallCase.Snowflake, SNOWFLAKE],
    [this.DatabaseServiceTypeSmallCase.Mssql, MSSQL],
    [this.DatabaseServiceTypeSmallCase.Athena, ATHENA],
    [this.DatabaseServiceTypeSmallCase.Presto, PRESTO],
    [this.DatabaseServiceTypeSmallCase.Trino, TRINO],
    [this.DatabaseServiceTypeSmallCase.Glue, GLUE],
    [this.DatabaseServiceTypeSmallCase.DomoDatabase, DOMO],
    [this.DatabaseServiceTypeSmallCase.MariaDB, MARIADB],
    [this.DatabaseServiceTypeSmallCase.Vertica, VERTICA],
    [this.DatabaseServiceTypeSmallCase.AzureSQL, AZURESQL],
    [this.DatabaseServiceTypeSmallCase.Clickhouse, CLICKHOUSE],
    [this.DatabaseServiceTypeSmallCase.Databricks, DATABRICK],
    [this.DatabaseServiceTypeSmallCase.UnityCatalog, UNITYCATALOG],
    [this.DatabaseServiceTypeSmallCase.Db2, IBMDB2],
    [this.DatabaseServiceTypeSmallCase.Doris, DORIS],
    [this.DatabaseServiceTypeSmallCase.StarRocks, STARROCKS],
    [this.DatabaseServiceTypeSmallCase.Druid, DRUID],
    [this.DatabaseServiceTypeSmallCase.DynamoDB, DYNAMODB],
    [this.DatabaseServiceTypeSmallCase.Exasol, EXASOL],
    [this.DatabaseServiceTypeSmallCase.SingleStore, SINGLESTORE],
    [this.DatabaseServiceTypeSmallCase.SQLite, SQLITE],
    [this.DatabaseServiceTypeSmallCase.Salesforce, SALESFORCE],
    [this.DatabaseServiceTypeSmallCase.SapHana, SAP_HANA],
    [this.DatabaseServiceTypeSmallCase.SapERP, SAP_ERP],
    [this.DatabaseServiceTypeSmallCase.DeltaLake, DELTALAKE],
    [this.DatabaseServiceTypeSmallCase.PinotDB, PINOT],
    [this.DatabaseServiceTypeSmallCase.Datalake, DATALAKE],
    [this.DatabaseServiceTypeSmallCase.MongoDB, MONGODB],
    [this.DatabaseServiceTypeSmallCase.Cassandra, CASSANDRA],
    [this.DatabaseServiceTypeSmallCase.SAS, SAS],
    [this.DatabaseServiceTypeSmallCase.Couchbase, COUCHBASE],
    [this.DatabaseServiceTypeSmallCase.Cockroach, COCKROACH],
    [this.DatabaseServiceTypeSmallCase.Greenplum, GREENPLUM],
    [this.DatabaseServiceTypeSmallCase.Teradata, TERADATA],
    [this.DatabaseServiceTypeSmallCase.Synapse, SYNAPSE],
    [this.DatabaseServiceTypeSmallCase.BurstIQ, BURSTIQ],
    [this.DatabaseServiceTypeSmallCase.Timescale, TIMESCALE],
    [this.MessagingServiceTypeSmallCase.CustomMessaging, TOPIC_DEFAULT],
    [this.MessagingServiceTypeSmallCase.Kafka, KAFKA],
    [this.MessagingServiceTypeSmallCase.Redpanda, REDPANDA],
    [this.MessagingServiceTypeSmallCase.Kinesis, KINESIS],
    [this.DashboardServiceTypeSmallCase.CustomDashboard, DASHBOARD_DEFAULT],
    [this.DashboardServiceTypeSmallCase.Superset, SUPERSET],
    [this.DashboardServiceTypeSmallCase.Looker, LOOKER],
    [this.DashboardServiceTypeSmallCase.Tableau, TABLEAU],
    [this.DashboardServiceTypeSmallCase.Hex, HEX],
    [this.DashboardServiceTypeSmallCase.Redash, REDASH],
    [this.DashboardServiceTypeSmallCase.Metabase, METABASE],
    [this.DashboardServiceTypeSmallCase.PowerBI, POWERBI],
    [this.DashboardServiceTypeSmallCase.QuickSight, QUICKSIGHT],
    [this.DashboardServiceTypeSmallCase.DomoDashboard, DOMO],
    [this.DashboardServiceTypeSmallCase.Mode, MODE],
    [this.DashboardServiceTypeSmallCase.QlikSense, QLIK_SENSE],
    [this.DashboardServiceTypeSmallCase.QlikCloud, QLIK_SENSE],
    [this.DashboardServiceTypeSmallCase.Lightdash, LIGHT_DASH],
    [this.DashboardServiceTypeSmallCase.Sigma, SIGMA],
    [this.DashboardServiceTypeSmallCase.MicroStrategy, MICROSTRATEGY],
    [this.DashboardServiceTypeSmallCase.Grafana, GRAFANA],
    [this.PipelineServiceTypeSmallCase.CustomPipeline, PIPELINE_DEFAULT],
    [this.PipelineServiceTypeSmallCase.Airflow, AIRFLOW],
    [this.PipelineServiceTypeSmallCase.Airbyte, AIRBYTE],
    [this.PipelineServiceTypeSmallCase.Dagster, DAGSTER],
    [this.PipelineServiceTypeSmallCase.Fivetran, FIVETRAN],
    [this.PipelineServiceTypeSmallCase.DBTCloud, DBT],
    [this.PipelineServiceTypeSmallCase.GluePipeline, GLUE],
    [this.PipelineServiceTypeSmallCase.KafkaConnect, KAFKA],
    [this.PipelineServiceTypeSmallCase.Spark, SPARK],
    [this.PipelineServiceTypeSmallCase.Spline, SPLINE],
    [this.PipelineServiceTypeSmallCase.Nifi, NIFI],
    [this.PipelineServiceTypeSmallCase.DomoPipeline, DOMO],
    [this.PipelineServiceTypeSmallCase.DatabricksPipeline, DATABRICK],
    [this.PipelineServiceTypeSmallCase.OpenLineage, OPENLINEAGE],
    [this.PipelineServiceTypeSmallCase.Flink, FLINK],
    [this.MlModelServiceTypeSmallCase.CustomMlModel, ML_MODEL_DEFAULT],
    [this.MlModelServiceTypeSmallCase.Mlflow, MLFLOW],
    [this.MlModelServiceTypeSmallCase.Sklearn, SCIKIT],
    [this.MlModelServiceTypeSmallCase.SageMaker, SAGEMAKER],
    [this.MetadataServiceTypeSmallCase.Amundsen, AMUNDSEN],
    [this.MetadataServiceTypeSmallCase.Atlas, ATLAS],
    [this.MetadataServiceTypeSmallCase.AlationSink, ALATIONSINK],
    [this.MetadataServiceTypeSmallCase.OpenMetadata, LOGO],
    [this.StorageServiceTypeSmallCase.CustomStorage, CUSTOM_STORAGE_DEFAULT],
    [this.StorageServiceTypeSmallCase.S3, AMAZON_S3],
    [this.StorageServiceTypeSmallCase.Gcs, GCS],
    [this.SearchServiceTypeSmallCase.CustomSearch, CUSTOM_SEARCH_DEFAULT],
    [this.SearchServiceTypeSmallCase.ElasticSearch, ELASTIC_SEARCH],
    [this.SearchServiceTypeSmallCase.OpenSearch, OPEN_SEARCH],
    [this.ApiServiceTypeSmallCase.REST, REST_SERVICE],
    [this.DriveServiceTypeSmallCase.CustomDrive, CUSTOM_DRIVE_DEFAULT],
    [this.DriveServiceTypeSmallCase.GoogleDrive, GOOGLE_DRIVE],
    [this.DriveServiceTypeSmallCase.SFTP, SFTP],
    [this.DatabaseServiceTypeSmallCase.Iomete, IOMETE],
  ]);

  private getDefaultLogoForServiceType(type: string): string {
    const serviceTypes = this.getSupportedServiceFromList();

    if (serviceTypes.messagingServices.includes(type)) {
      return TOPIC_DEFAULT;
    }
    if (serviceTypes.dashboardServices.includes(type)) {
      return DASHBOARD_DEFAULT;
    }
    if (serviceTypes.pipelineServices.includes(type)) {
      return PIPELINE_DEFAULT;
    }
    if (serviceTypes.databaseServices.includes(type)) {
      return DATABASE_DEFAULT;
    }
    if (serviceTypes.mlmodelServices.includes(type)) {
      return ML_MODEL_DEFAULT;
    }
    if (serviceTypes.storageServices.includes(type)) {
      return CUSTOM_STORAGE_DEFAULT;
    }
    if (serviceTypes.searchServices.includes(type)) {
      return CUSTOM_SEARCH_DEFAULT;
    }
    if (serviceTypes.securityServices.includes(type)) {
      return DEFAULT_SERVICE;
    }
    if (serviceTypes.driveServices.includes(type)) {
      return CUSTOM_DRIVE_DEFAULT;
    }

    return DEFAULT_SERVICE;
  }

  public getServiceLogo(type: string): string {
    const lowerType = toLower(type);
    const logo = this.serviceLogoMap.get(lowerType);

    return logo ?? this.getDefaultLogoForServiceType(type);
  }

  public getServiceTypeLogo(searchSource: {
    serviceType?: string;
    entityType?: string;
  }): string {
    const type = get(searchSource, 'serviceType', '');
    const entityType = get(searchSource, 'entityType', '');

    // Handle entities that don't have serviceType by using entity-specific icons
    if (isEmpty(type)) {
      switch (entityType) {
        case EntityType.TAG:
          return TagIcon;
        case EntityType.GLOSSARY_TERM:
          return GlossaryIcon;
        case EntityType.DATABASE:
          return DatabaseIcon;
        case EntityType.DATABASE_SCHEMA:
          return DatabaseSchemaIcon;
        case EntityType.METRIC:
          return MetricIcon;
        case EntityType.DATA_PRODUCT:
          return DataProductIcon;
        default:
          return this.getServiceLogo('');
      }
    }

    if (entityType === EntityType.CHART) {
      return ChartIcon;
    }

    return this.getServiceLogo(type);
  }

  public getDataAssetsService(serviceType: string): ExplorePageTabs {
    const database = this.DatabaseServiceTypeSmallCase;
    const messaging = this.MessagingServiceTypeSmallCase;
    const dashboard = this.DashboardServiceTypeSmallCase;
    const pipeline = this.PipelineServiceTypeSmallCase;
    const mlmodel = this.MlModelServiceTypeSmallCase;
    const storage = this.StorageServiceTypeSmallCase;
    const search = this.SearchServiceTypeSmallCase;
    const api = this.ApiServiceTypeSmallCase;
    const security = this.SecurityServiceTypeSmallCase;

    switch (true) {
      case Object.values(database).includes(
        serviceType as (typeof database)[keyof typeof database]
      ):
        return ExplorePageTabs.TABLES;
      case Object.values(messaging).includes(
        serviceType as (typeof messaging)[keyof typeof messaging]
      ):
        return ExplorePageTabs.TOPICS;
      case Object.values(dashboard).includes(
        serviceType as (typeof dashboard)[keyof typeof dashboard]
      ):
        return ExplorePageTabs.DASHBOARDS;
      case Object.values(mlmodel).includes(
        serviceType as (typeof mlmodel)[keyof typeof mlmodel]
      ):
        return ExplorePageTabs.MLMODELS;
      case Object.values(pipeline).includes(
        serviceType as (typeof pipeline)[keyof typeof pipeline]
      ):
        return ExplorePageTabs.PIPELINES;
      case Object.values(storage).includes(
        serviceType as (typeof storage)[keyof typeof storage]
      ):
        return ExplorePageTabs.CONTAINERS;
      case Object.values(search).includes(
        serviceType as (typeof search)[keyof typeof search]
      ):
        return ExplorePageTabs.SEARCH_INDEX;

      case Object.values(api).includes(
        serviceType as (typeof api)[keyof typeof api]
      ):
        return ExplorePageTabs.API_ENDPOINT;

      case Object.values(security).includes(
        serviceType as (typeof security)[keyof typeof security]
      ):
        return ExplorePageTabs.TABLES; // Security services don't have a specific tab, default to tables

      default:
        return ExplorePageTabs.TABLES;
    }
  }

  public getPipelineServiceConfig(type: PipelineServiceType) {
    return getPipelineConfig(type);
  }

  public getDatabaseServiceConfig(type: DatabaseServiceType) {
    return getDatabaseConfig(type);
  }

  public getDashboardServiceConfig(type: DashboardServiceType) {
    return getDashboardConfig(type);
  }

  public getMessagingServiceConfig(type: MessagingServiceType) {
    return getMessagingConfig(type);
  }

  public getMlModelServiceConfig(type: MlModelServiceType) {
    return getMlmodelConfig(type);
  }

  public getSearchServiceConfig(type: SearchServiceType) {
    return getSearchServiceConfig(type);
  }

  public getStorageServiceConfig(type: StorageServiceType) {
    return getStorageConfig(type);
  }

  public getMetadataServiceConfig(type: MetadataServiceType) {
    return getMetadataConfig(type);
  }

  public getAPIServiceConfig(type: APIServiceType) {
    return getAPIConfig(type);
  }

  public getSecurityServiceConfig(type: SecurityServiceType) {
    return getSecurityConfig(type);
  }
  public getDriveServiceConfig(type: DriveServiceType) {
    return getDriveConfig(type);
  }

  public getInsightsTabWidgets(_: ServiceTypes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const widgets: Record<string, React.ComponentType<any>> = {
      AgentsStatusWidget,
      PlatformInsightsWidget,
      TotalDataAssetsWidget,
    };

    return widgets;
  }

  public getExtraInfo(): Promise<void> {
    return Promise.resolve();
  }

  public getProperties(property: ObjectFieldTemplatePropertyType[]) {
    return {
      properties: property,
      additionalField: '',
      additionalFieldContent: null,
    };
  }

  public getEditConfigData(
    serviceData?: ServicesType,
    data?: ConfigData
  ): ServicesType {
    if (!serviceData || !data) {
      return serviceData as ServicesType;
    }
    const updatedData = { ...serviceData };
    if (updatedData.connection) {
      const connection = updatedData.connection as {
        config: Record<string, unknown>;
      };
      updatedData.connection = {
        ...connection,
        config: {
          ...connection.config,
          ...data,
        },
      } as typeof updatedData.connection;
    }

    return updatedData;
  }

  public getAgentsTabWidgets() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const widgets: Record<string, React.ComponentType<any>> = {
      MetadataAgentsWidget,
    };

    return widgets;
  }

  public getSearchIndexFromEntityType(entityType: EntityType | string) {
    return getSearchIndexFromService(entityType);
  }

  /**
   * @param originalEnum will take the enum that should be converted
   * @returns object with lowercase value
   */
  public convertEnumToLowerCase<T extends { [k: string]: string }, U>(
    originalEnum: T
  ): U {
    return Object.fromEntries(
      Object.entries(originalEnum).map(([key, value]) => [
        key,
        value.toLowerCase(),
      ])
    ) as unknown as U;
  }
}

const serviceUtilClassBase = new ServiceUtilClassBase();

export default serviceUtilClassBase;
export { ServiceUtilClassBase };
