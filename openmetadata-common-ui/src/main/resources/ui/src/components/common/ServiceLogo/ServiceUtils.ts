import { toLower } from "lodash";
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
  CASSANDRA,
  CLICKHOUSE,
  COCKROACH,
  COUCHBASE,
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
  GREENPLUM,
  HIVE,
  IBMDB2,
  ICEBERGE,
  IMPALA,
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
  SIGMA,
  SINGLESTORE,
  SNOWFLAKE,
  SPARK,
  SPLINE,
  SQLITE,
  SUPERSET,
  SYNAPSE,
  TABLEAU,
  TERADATA,
  TOPIC_DEFAULT,
  TRINO,
  UNITYCATALOG,
  VERTICA,
} from "../../../constants/Services.constant";

// Import additional icons for Collate services
import SsasIcon from "../../assets/services/service-icon-ssas.png";
import ADLSIcon from "../../assets/services/service-logo-adls.png";
import AlationIcon from "../../assets/services/service-logo-alation.png";
import DatafactoryIcon from "../../assets/services/service-logo-datafactory.png";
import GCSIcon from "../../assets/services/service-logo-gcs.png";
import MatillionIcon from "../../assets/services/service-logo-matillion.png";
import PowerBIRSIcon from "../../assets/services/service-logo-powerbi-rs.png";
import SsisIcon from "../../assets/services/service-logo-ssis.png";
import StitchIcon from "../../assets/services/service-logo-stitch.png";
import SynapseIcon from "../../assets/services/service-logo-synapse.png";
import ThoughtSpotIcon from "../../assets/services/service-logo-thoughtspot.png";
import VertexaiIcon from "../../assets/services/service-logo-vertexai.png";
import WherescapeIcon from "../../assets/services/service-logo-wherescape.png";
import CustomDashboardIcon from "../../assets/services/ic-custom-dashboard.svg";
import IconArticle from "../../assets/services/ic-articles.svg";
import LinkIcon from "../../assets/services/ic-link.svg";

// Service type enums (simplified versions for the common-ui)
export enum DatabaseServiceType {
  CustomDatabase = "CustomDatabase",
  Mysql = "Mysql",
  Redshift = "Redshift",
  BigQuery = "BigQuery",
  BigTable = "BigTable",
  Hive = "Hive",
  Impala = "Impala",
  Postgres = "Postgres",
  Oracle = "Oracle",
  Snowflake = "Snowflake",
  Mssql = "Mssql",
  Athena = "Athena",
  Presto = "Presto",
  Trino = "Trino",
  Glue = "Glue",
  DomoDatabase = "DomoDatabase",
  MariaDB = "MariaDB",
  Vertica = "Vertica",
  AzureSQL = "AzureSQL",
  Clickhouse = "Clickhouse",
  Databricks = "Databricks",
  UnityCatalog = "UnityCatalog",
  Db2 = "Db2",
  Doris = "Doris",
  Druid = "Druid",
  DynamoDB = "DynamoDB",
  Exasol = "Exasol",
  SingleStore = "SingleStore",
  SQLite = "SQLite",
  Salesforce = "Salesforce",
  SapHana = "SapHana",
  SapERP = "SapERP",
  DeltaLake = "DeltaLake",
  PinotDB = "PinotDB",
  Datalake = "Datalake",
  MongoDB = "MongoDB",
  Cassandra = "Cassandra",
  SAS = "SAS",
  Couchbase = "Couchbase",
  Cockroach = "Cockroach",
  Greenplum = "Greenplum",
  Iceberg = "Iceberg",
  Teradata = "Teradata",
  Synapse = "Synapse",
  Ssas = "Ssas",
}

export enum MessagingServiceType {
  CustomMessaging = "CustomMessaging",
  Kafka = "Kafka",
  Redpanda = "Redpanda",
  Kinesis = "Kinesis",
}

export enum DashboardServiceType {
  CustomDashboard = "CustomDashboard",
  Superset = "Superset",
  Looker = "Looker",
  Tableau = "Tableau",
  Redash = "Redash",
  Metabase = "Metabase",
  PowerBI = "PowerBI",
  QuickSight = "QuickSight",
  DomoDashboard = "DomoDashboard",
  Mode = "Mode",
  QlikSense = "QlikSense",
  QlikCloud = "QlikCloud",
  Lightdash = "Lightdash",
  Sigma = "Sigma",
  MicroStrategy = "MicroStrategy",
  PowerBIReportServer = "PowerBIReportServer",
  ThoughtSpot = "ThoughtSpot",
}

export enum PipelineServiceType {
  CustomPipeline = "CustomPipeline",
  Airflow = "Airflow",
  Airbyte = "Airbyte",
  Dagster = "Dagster",
  Fivetran = "Fivetran",
  DBTCloud = "DBTCloud",
  GluePipeline = "GluePipeline",
  KafkaConnect = "KafkaConnect",
  Spark = "Spark",
  Spline = "Spline",
  Nifi = "Nifi",
  DomoPipeline = "DomoPipeline",
  DatabricksPipeline = "DatabricksPipeline",
  OpenLineage = "OpenLineage",
  Flink = "Flink",
  Matillion = "Matillion",
  Wherescape = "Wherescape",
  Ssis = "Ssis",
  Stitch = "Stitch",
  DataFactory = "DataFactory",
}

export enum MlModelServiceType {
  CustomMlModel = "CustomMlModel",
  Mlflow = "Mlflow",
  Sklearn = "Sklearn",
  SageMaker = "SageMaker",
  VertexAI = "VertexAI",
}

export enum MetadataServiceType {
  Amundsen = "Amundsen",
  Atlas = "Atlas",
  AlationSink = "AlationSink",
  OpenMetadata = "OpenMetadata",
  Alation = "Alation",
}

export enum StorageServiceType {
  CustomStorage = "CustomStorage",
  S3 = "S3",
  Gcs = "Gcs",
  Adls = "Adls",
}

export enum SearchServiceType {
  CustomSearch = "CustomSearch",
  ElasticSearch = "ElasticSearch",
  OpenSearch = "OpenSearch",
}

export enum ApiServiceType {
  REST = "REST",
}

// Union type for all service types
export type ServiceType =
  | DatabaseServiceType
  | MessagingServiceType
  | DashboardServiceType
  | PipelineServiceType
  | MlModelServiceType
  | MetadataServiceType
  | StorageServiceType
  | SearchServiceType
  | ApiServiceType;

// Convert enums to lowercase for comparison
const DatabaseServiceTypeSmallCase = Object.fromEntries(
  Object.entries(DatabaseServiceType).map(([key, value]) => [
    key,
    value.toLowerCase(),
  ])
) as { [k: string]: string };

const MessagingServiceTypeSmallCase = Object.fromEntries(
  Object.entries(MessagingServiceType).map(([key, value]) => [
    key,
    value.toLowerCase(),
  ])
) as { [k: string]: string };

const DashboardServiceTypeSmallCase = Object.fromEntries(
  Object.entries(DashboardServiceType).map(([key, value]) => [
    key,
    value.toLowerCase(),
  ])
) as { [k: string]: string };

const PipelineServiceTypeSmallCase = Object.fromEntries(
  Object.entries(PipelineServiceType).map(([key, value]) => [
    key,
    value.toLowerCase(),
  ])
) as { [k: string]: string };

const MlModelServiceTypeSmallCase = Object.fromEntries(
  Object.entries(MlModelServiceType).map(([key, value]) => [
    key,
    value.toLowerCase(),
  ])
) as { [k: string]: string };

const MetadataServiceTypeSmallCase = Object.fromEntries(
  Object.entries(MetadataServiceType).map(([key, value]) => [
    key,
    value.toLowerCase(),
  ])
) as { [k: string]: string };

const StorageServiceTypeSmallCase = Object.fromEntries(
  Object.entries(StorageServiceType).map(([key, value]) => [
    key,
    value.toLowerCase(),
  ])
) as { [k: string]: string };

const SearchServiceTypeSmallCase = Object.fromEntries(
  Object.entries(SearchServiceType).map(([key, value]) => [
    key,
    value.toLowerCase(),
  ])
) as { [k: string]: string };

const ApiServiceTypeSmallCase = Object.fromEntries(
  Object.entries(ApiServiceType).map(([key, value]) => [
    key,
    value.toLowerCase(),
  ])
) as { [k: string]: string };

// Get supported service types
const getSupportedServiceFromList = () => {
  return {
    databaseServices: Object.values(DatabaseServiceType).sort() as string[],
    messagingServices: Object.values(MessagingServiceType).sort() as string[],
    dashboardServices: Object.values(DashboardServiceType).sort() as string[],
    pipelineServices: Object.values(PipelineServiceType).sort() as string[],
    mlmodelServices: Object.values(MlModelServiceType).sort() as string[],
    metadataServices: Object.values(MetadataServiceType).sort() as string[],
    storageServices: Object.values(StorageServiceType).sort() as string[],
    searchServices: Object.values(SearchServiceType).sort() as string[],
    apiServices: Object.values(ApiServiceType).sort() as string[],
  };
};

export const getServiceTypeLogo = (serviceType: string) => {
  const serviceTypes = getSupportedServiceFromList();

  switch (toLower(serviceType)) {
    case DatabaseServiceTypeSmallCase.CustomDatabase:
      return DATABASE_DEFAULT;
    case DatabaseServiceTypeSmallCase.Mysql:
      return MYSQL;
    case DatabaseServiceTypeSmallCase.Redshift:
      return REDSHIFT;
    case DatabaseServiceTypeSmallCase.BigQuery:
      return BIGQUERY;
    case DatabaseServiceTypeSmallCase.BigTable:
      return BIGTABLE;
    case DatabaseServiceTypeSmallCase.Hive:
      return HIVE;
    case DatabaseServiceTypeSmallCase.Impala:
      return IMPALA;
    case DatabaseServiceTypeSmallCase.Postgres:
      return POSTGRES;
    case DatabaseServiceTypeSmallCase.Oracle:
      return ORACLE;
    case DatabaseServiceTypeSmallCase.Snowflake:
      return SNOWFLAKE;
    case DatabaseServiceTypeSmallCase.Mssql:
      return MSSQL;
    case DatabaseServiceTypeSmallCase.Athena:
      return ATHENA;
    case DatabaseServiceTypeSmallCase.Presto:
      return PRESTO;
    case DatabaseServiceTypeSmallCase.Trino:
      return TRINO;
    case DatabaseServiceTypeSmallCase.Glue:
      return GLUE;
    case DatabaseServiceTypeSmallCase.DomoDatabase:
      return DOMO;
    case DatabaseServiceTypeSmallCase.MariaDB:
      return MARIADB;
    case DatabaseServiceTypeSmallCase.Vertica:
      return VERTICA;
    case DatabaseServiceTypeSmallCase.AzureSQL:
      return AZURESQL;
    case DatabaseServiceTypeSmallCase.Clickhouse:
      return CLICKHOUSE;
    case DatabaseServiceTypeSmallCase.Databricks:
      return DATABRICK;
    case DatabaseServiceTypeSmallCase.UnityCatalog:
      return UNITYCATALOG;
    case DatabaseServiceTypeSmallCase.Db2:
      return IBMDB2;
    case DatabaseServiceTypeSmallCase.Doris:
      return DORIS;
    case DatabaseServiceTypeSmallCase.Druid:
      return DRUID;
    case DatabaseServiceTypeSmallCase.DynamoDB:
      return DYNAMODB;
    case DatabaseServiceTypeSmallCase.Exasol:
      return EXASOL;
    case DatabaseServiceTypeSmallCase.SingleStore:
      return SINGLESTORE;
    case DatabaseServiceTypeSmallCase.SQLite:
      return SQLITE;
    case DatabaseServiceTypeSmallCase.Salesforce:
      return SALESFORCE;
    case DatabaseServiceTypeSmallCase.SapHana:
      return SAP_HANA;
    case DatabaseServiceTypeSmallCase.SapERP:
      return SAP_ERP;
    case DatabaseServiceTypeSmallCase.DeltaLake:
      return DELTALAKE;
    case DatabaseServiceTypeSmallCase.PinotDB:
      return PINOT;
    case DatabaseServiceTypeSmallCase.Datalake:
      return DATALAKE;
    case DatabaseServiceTypeSmallCase.MongoDB:
      return MONGODB;
    case DatabaseServiceTypeSmallCase.Cassandra:
      return CASSANDRA;
    case DatabaseServiceTypeSmallCase.SAS:
      return SAS;
    case DatabaseServiceTypeSmallCase.Couchbase:
      return COUCHBASE;
    case DatabaseServiceTypeSmallCase.Cockroach:
      return COCKROACH;
    case DatabaseServiceTypeSmallCase.Greenplum:
      return GREENPLUM;
    case DatabaseServiceTypeSmallCase.Iceberg:
      return ICEBERGE;
    case DatabaseServiceTypeSmallCase.Teradata:
      return TERADATA;
    case DatabaseServiceTypeSmallCase.Synapse:
      return SYNAPSE;
    case DatabaseServiceTypeSmallCase.Ssas:
      return SsasIcon;

    case MessagingServiceTypeSmallCase.CustomMessaging:
      return TOPIC_DEFAULT;
    case MessagingServiceTypeSmallCase.Kafka:
      return KAFKA;
    case MessagingServiceTypeSmallCase.Redpanda:
      return REDPANDA;
    case MessagingServiceTypeSmallCase.Kinesis:
      return KINESIS;

    case DashboardServiceTypeSmallCase.CustomDashboard:
      return DASHBOARD_DEFAULT;
    case DashboardServiceTypeSmallCase.Superset:
      return SUPERSET;
    case DashboardServiceTypeSmallCase.Looker:
      return LOOKER;
    case DashboardServiceTypeSmallCase.Tableau:
      return TABLEAU;
    case DashboardServiceTypeSmallCase.Redash:
      return REDASH;
    case DashboardServiceTypeSmallCase.Metabase:
      return METABASE;
    case DashboardServiceTypeSmallCase.PowerBI:
      return POWERBI;
    case DashboardServiceTypeSmallCase.QuickSight:
      return QUICKSIGHT;
    case DashboardServiceTypeSmallCase.DomoDashboard:
      return DOMO;
    case DashboardServiceTypeSmallCase.Mode:
      return MODE;
    case DashboardServiceTypeSmallCase.QlikSense:
      return QLIK_SENSE;
    case DashboardServiceTypeSmallCase.QlikCloud:
      return QLIK_SENSE;
    case DashboardServiceTypeSmallCase.Lightdash:
      return LIGHT_DASH;
    case DashboardServiceTypeSmallCase.Sigma:
      return SIGMA;
    case DashboardServiceTypeSmallCase.MicroStrategy:
      return MICROSTRATEGY;
    case DashboardServiceTypeSmallCase.PowerBIReportServer:
      return PowerBIRSIcon;
    case DashboardServiceTypeSmallCase.ThoughtSpot:
      return ThoughtSpotIcon;

    case PipelineServiceTypeSmallCase.CustomPipeline:
      return PIPELINE_DEFAULT;
    case PipelineServiceTypeSmallCase.Airflow:
      return AIRFLOW;
    case PipelineServiceTypeSmallCase.Airbyte:
      return AIRBYTE;
    case PipelineServiceTypeSmallCase.Dagster:
      return DAGSTER;
    case PipelineServiceTypeSmallCase.Fivetran:
      return FIVETRAN;
    case PipelineServiceTypeSmallCase.DBTCloud:
      return DBT;
    case PipelineServiceTypeSmallCase.GluePipeline:
      return GLUE;
    case PipelineServiceTypeSmallCase.KafkaConnect:
      return KAFKA;
    case PipelineServiceTypeSmallCase.Spark:
      return SPARK;
    case PipelineServiceTypeSmallCase.Spline:
      return SPLINE;
    case PipelineServiceTypeSmallCase.Nifi:
      return NIFI;
    case PipelineServiceTypeSmallCase.DomoPipeline:
      return DOMO;
    case PipelineServiceTypeSmallCase.DatabricksPipeline:
      return DATABRICK;
    case PipelineServiceTypeSmallCase.OpenLineage:
      return OPENLINEAGE;
    case PipelineServiceTypeSmallCase.Flink:
      return FLINK;
    case PipelineServiceTypeSmallCase.Matillion:
      return MatillionIcon;
    case PipelineServiceTypeSmallCase.Wherescape:
      return WherescapeIcon;
    case PipelineServiceTypeSmallCase.Ssis:
      return SsisIcon;
    case PipelineServiceTypeSmallCase.Stitch:
      return StitchIcon;
    case PipelineServiceTypeSmallCase.DataFactory:
      return DatafactoryIcon;

    case MlModelServiceTypeSmallCase.CustomMlModel:
      return ML_MODEL_DEFAULT;
    case MlModelServiceTypeSmallCase.Mlflow:
      return MLFLOW;
    case MlModelServiceTypeSmallCase.Sklearn:
      return SCIKIT;
    case MlModelServiceTypeSmallCase.SageMaker:
      return SAGEMAKER;
    case MlModelServiceTypeSmallCase.VertexAI:
      return VertexaiIcon;

    case MetadataServiceTypeSmallCase.Amundsen:
      return AMUNDSEN;
    case MetadataServiceTypeSmallCase.Atlas:
      return ATLAS;
    case MetadataServiceTypeSmallCase.AlationSink:
      return ALATIONSINK;
    case MetadataServiceTypeSmallCase.Alation:
      return AlationIcon;
    case MetadataServiceTypeSmallCase.OpenMetadata:
      return LOGO;

    case StorageServiceTypeSmallCase.CustomStorage:
      return CUSTOM_STORAGE_DEFAULT;
    case StorageServiceTypeSmallCase.S3:
      return AMAZON_S3;
    case StorageServiceTypeSmallCase.Gcs:
      return GCS;
    case StorageServiceTypeSmallCase.Adls:
      return ADLSIcon;

    case SearchServiceTypeSmallCase.CustomSearch:
      return CUSTOM_SEARCH_DEFAULT;
    case SearchServiceTypeSmallCase.ElasticSearch:
      return ELASTIC_SEARCH;
    case SearchServiceTypeSmallCase.OpenSearch:
      return OPEN_SEARCH;

    case ApiServiceTypeSmallCase.REST:
      return REST_SERVICE;

    default: {
      let logo;
      if (serviceTypes.messagingServices.includes(serviceType)) {
        logo = TOPIC_DEFAULT;
      } else if (serviceTypes.dashboardServices.includes(serviceType)) {
        logo = DASHBOARD_DEFAULT;
      } else if (serviceTypes.pipelineServices.includes(serviceType)) {
        logo = PIPELINE_DEFAULT;
      } else if (serviceTypes.databaseServices.includes(serviceType)) {
        logo = DATABASE_DEFAULT;
      } else if (serviceTypes.mlmodelServices.includes(serviceType)) {
        logo = ML_MODEL_DEFAULT;
      } else if (serviceTypes.storageServices.includes(serviceType)) {
        logo = CUSTOM_STORAGE_DEFAULT;
      } else if (serviceTypes.searchServices.includes(serviceType)) {
        logo = CUSTOM_SEARCH_DEFAULT;
      } else {
        logo = DEFAULT_SERVICE;
      }

      return logo;
    }
  }
};
