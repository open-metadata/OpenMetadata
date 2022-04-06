/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2021 Collate
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

/**
 * OpenMetadata Ingestion Framework definition.
 */
export interface Workflow {
  /**
   * Unique identifier that identifies this pipeline.
   */
  id?: string;
  /**
   * Name that identifies this pipeline instance uniquely.
   */
  name: string;
  /**
   * OpenMetadata Ingestion Workflow Config.
   */
  openMetadataWorkflowConfig: OpenMetadataWorkflowConfig;
}

/**
 * OpenMetadata Ingestion Workflow Config.
 */
export interface OpenMetadataWorkflowConfig {
  bulkSink?: BulkSink;
  processor?: Processor;
  sink?: Sink;
  source: Source;
  stage?: Stage;
  workflowConfig: WorkflowConfig;
}

/**
 * Configuration for BulkSink Component in the OpenMetadata Ingestion Framework.
 */
export interface BulkSink {
  config?: { [key: string]: string };
  /**
   * Type of BulkSink component ex: metadata-usage
   */
  type: string;
}

/**
 * Configuration for Processor Component in the OpenMetadata Ingestion Framework.
 */
export interface Processor {
  config?: { [key: string]: string };
  /**
   * Type of processor component ex: pii-processor
   */
  type: string;
}

/**
 * Configuration for Sink Component in the OpenMetadata Ingestion Framework.
 */
export interface Sink {
  config?: { [key: string]: string };
  /**
   * Type of sink component ex: metadata
   */
  type: string;
}

/**
 * Configuration for Source component in OpenMetadata Ingestion Framework.
 */
export interface Source {
  /**
   * Connection configuration for the source. ex: mysql , tableau connection.
   */
  serviceConnection: ServiceConnection;
  /**
   * Type of the source connector ex: mysql, snowflake, tableau etc..
   */
  serviceName: string;
  sourceConfig: SourceConfig;
  /**
   * Type of the source connector ex: mysql, snowflake, tableau etc..
   */
  type: string;
}

/**
 * Connection configuration for the source. ex: mysql , tableau connection.
 *
 * Supported services
 *
 * Dashboard Connection.
 *
 * Database Connection.
 */
export interface ServiceConnection {
  config?: Connection;
}

/**
 * Looker Connection Config
 *
 * Metabase Connection Config
 *
 * PowerBI Connection Config
 *
 * Redash Connection Config
 *
 * Superset Connection Config
 *
 * Tableau Connection Config
 *
 * AWS Athena Connection Config
 *
 * Azure SQL Connection Config
 *
 * Clickhouse Connection Config
 *
 * Databricks Connection Config
 *
 * DB2 Connection Config
 *
 * Druid Connection Config
 *
 * DynamoDB Connection Config
 *
 * Glue Connection Config
 *
 * Hive SQL Connection Config
 *
 * MariaDB Database Connection Config
 *
 * Mssql Database Connection Config
 *
 * Mysql Database Connection Config
 *
 * SQLite Database Connection Config
 *
 * Oracle Database Connection Config
 *
 * Postgres Database Connection Config
 *
 * Presto Database Connection Config
 *
 * Redshift  Connection Config
 *
 * Salesforce Connection Config
 *
 * SingleStore Database Connection Config
 *
 * Snowflake Connection Config
 *
 * Trino Connection Config
 *
 * Vertica Connection Config
 *
 * Kafka Connection Config
 *
 * Pulsar Connection Config
 */
export interface Connection {
  /**
   * Looker actor.
   */
  actor?: string;
  /**
   * password to connect  to the Looker.
   *
   * password to connect  to the Metabase.
   *
   * password for the Superset
   *
   * password for the Tableau
   *
   * password to connect  to the Athena.
   *
   * password to connect to the Clickhouse.
   *
   * password to connect to the Databricks.
   *
   * password to connect to the DB2.
   *
   * password to connect to the Druid.
   *
   * password to connect  to the Hive.
   *
   * password to connect  to the MariaDB.
   *
   * password to connect  to the MsSQL.
   *
   * password to connect  to the SingleStore.
   *
   * password to connect  to the Oracle.
   *
   * password to connect  to the Postgres.
   *
   * password to connect  to the Redshift.
   *
   * password to connect  to the MYSQL.
   *
   * password to connect  to the Snowflake.
   *
   * password to connect  to the Trino.
   *
   * password to connect  to the Vertica.
   */
  password?: string;
  /**
   * Looker Platform Name
   */
  platformName?: string;
  /**
   * Supported Metadata Extraction Pipelines.
   */
  supportedPipelineTypes?: string;
  /**
   * Service Type
   */
  type?: Type;
  /**
   * URL to Looker instance.
   */
  url?: string;
  /**
   * username to connect  to the Looker. This user should have privileges to read all the
   * metadata in Looker.
   *
   * username to connect  to the Metabase. This user should have privileges to read all the
   * metadata in Metabase.
   *
   * username for the Redash
   *
   * username for the Superset
   *
   * username for the Tableau
   *
   * username to connect  to the Athena. This user should have privileges to read all the
   * metadata in Athena.
   *
   * username to connect  to the Athena. This user should have privileges to read all the
   * metadata in Azure SQL.
   *
   * username to connect  to the Clickhouse. This user should have privileges to read all the
   * metadata in Clickhouse.
   *
   * username to connect  to the Databricks. This user should have privileges to read all the
   * metadata in Databricks.
   *
   * username to connect  to the DB2. This user should have privileges to read all the
   * metadata in DB2.
   *
   * username to connect  to the Druid. This user should have privileges to read all the
   * metadata in Druid.
   *
   * username to connect  to the Athena. This user should have privileges to read all the
   * metadata in Hive.
   *
   * username to connect  to the MariaDB. This user should have privileges to read all the
   * metadata in MariaDB.
   *
   * username to connect  to the MsSQL. This user should have privileges to read all the
   * metadata in MsSQL.
   *
   * username to connect  to the SingleStore. This user should have privileges to read all the
   * metadata in SingleStore.
   *
   * username to connect  to the Oracle. This user should have privileges to read all the
   * metadata in Oracle.
   *
   * username to connect  to the Postgres. This user should have privileges to read all the
   * metadata in Postgres.
   *
   * username to connect  to the Redshift. This user should have privileges to read all the
   * metadata in Redshift.
   *
   * username to connect  to the MySQL. This user should have privileges to read all the
   * metadata in MySQL.
   *
   * username to connect  to the Snowflake. This user should have privileges to read all the
   * metadata in Snowflake.
   *
   * username to connect  to the Vertica. This user should have privileges to read all the
   * metadata in Vertica.
   */
  username?: string;
  /**
   * Host and Port of Metabase instance.
   *
   * Host and port of the Athena
   *
   * Host and port of the Clickhouse
   *
   * Host and port of the Databricks
   *
   * Host and port of the DB2
   *
   * Host and port of the Druid
   *
   * Host and port of the DynamoDB
   *
   * Host and port of the Hive.
   *
   * Host and port of the data source.
   *
   * Host and port of the MsSQL.
   *
   * Host and port of the Oracle.
   *
   * Host and port of the Postgres.
   *
   * Host and port of the Redshift.
   */
  hostPort?: string;
  /**
   * client_id for the PowerBI.
   */
  clientId?: string;
  /**
   * clientSecret for the PowerBI.
   */
  clientSecret?: string;
  /**
   * Credentials for the PowerBI.
   */
  credentials?: string;
  /**
   * Dashboard URL for the power BI.
   */
  dashboardURL?: string;
  /**
   * Dashboard redirect URI for the PowerBI.
   */
  redirectURI?: string;
  /**
   * PowerBI secrets.
   */
  scope?: string[];
  /**
   * API key of the redash instance to access.
   */
  apiKey?: string;
  /**
   * URL for the redash instance
   */
  redashURL?: string;
  /**
   * Additional connection options that can be sent to service during the connection.
   */
  connectionOptions?: { [key: string]: any };
  /**
   * authenticaiton provider for the Superset
   */
  provider?: string;
  /**
   * URL for the superset instance
   */
  supersetURL?: string;
  /**
   * Tableau API version
   */
  apiVersion?: string;
  /**
   * Personal Access Token Name
   */
  personalAccessTokenName?: string;
  /**
   * Personal Access Token Secret
   */
  personalAccessTokenSecret?: string;
  /**
   * Tableau Server
   */
  server?: string;
  /**
   * Tableau Site Name
   */
  siteName?: string;
  /**
   * Tableau Site URL
   */
  siteURL?: string;
  /**
   * AWS Athena AWS Region.
   *
   * AWS Region Name.
   */
  awsRegion?: string;
  connectionArguments?: { [key: string]: any };
  /**
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Athena.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Azure SQL.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Clickhouse.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Databricks.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in DB2.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Druid.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Glue.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Hive.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in MariaDB.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in MsSQL.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in SingleStore.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Oracle.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Postgres.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Redshift.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in MySQL.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Snowflake.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Trino.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Vertica.
   */
  database?: string;
  /**
   * S3 Staging Directory.
   */
  s3StagingDir?: string;
  /**
   * SQLAlchemy driver scheme options.
   */
  scheme?: Scheme;
  /**
   * Service Type
   */
  serviceType?: AthenaType;
  /**
   * Athena workgroup.
   */
  workgroup?: string;
  /**
   * SQLAlchemy driver for Azure SQL
   */
  driver?: string;
  /**
   * Clickhouse SQL connection duration
   */
  duration?: number;
  token?: string;
  /**
   * AWS Access key ID.
   */
  awsAccessKeyId?: any;
  /**
   * AWS Secret Access Key.
   */
  awsSecretAccessKey?: string;
  /**
   * AWS Session Token.
   */
  awsSessionToken?: string;
  /**
   * EndPoint URL for the Dynamo DB
   */
  endPointURL?: string;
  /**
   * Authentication options to pass to Hive connector. These options are based on SQLAlchemy.
   */
  authOptions?: string;
  /**
   * Presto catalog
   */
  catalog?: string;
  /**
   * Salesforce Security Token.
   */
  securityToken?: string;
  /**
   * Salesforce Object Name.
   */
  sobjectName?: string;
  /**
   * Snowflake Account.
   */
  account?: string;
  /**
   * Snowflake Role.
   */
  role?: string;
  /**
   * Snowflake warehouse.
   */
  warehouse?: string;
  /**
   * Kafka bootstrap servers. add them in comma separated values ex: host1:9092,host2:9092
   */
  bootstrapServers?: string;
  /**
   * Confluent Kafka Schema Registry URL.
   */
  schemaRegistryURL?: string;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum Scheme {
  AwsathenaREST = 'awsathena+rest',
  ClickhouseHTTP = 'clickhouse+http',
  DatabricksConnector = 'databricks+connector',
  Db2IBMDB = 'db2+ibm_db',
  Druid = 'druid',
  Hive = 'hive',
  MssqlPymssql = 'mssql+pymssql',
  MssqlPyodbc = 'mssql+pyodbc',
  MssqlPytds = 'mssql+pytds',
  MysqlPymysql = 'mysql+pymysql',
  OracleCxOracle = 'oracle+cx_oracle',
  PostgresqlPsycopg2 = 'postgresql+psycopg2',
  Presto = 'presto',
  RedshiftPsycopg2 = 'redshift+psycopg2',
  Salesforce = 'salesforce',
  Snowflake = 'snowflake',
  SqlitePysqlite = 'sqlite+pysqlite',
  Trino = 'trino',
  VerticaVerticaPython = 'vertica+vertica_python',
}

/**
 * Service Type
 *
 * Service type.
 */
export enum AthenaType {
  Athena = 'Athena',
}

/**
 * Service Type
 *
 * Looker service type
 *
 * Metabase service type
 *
 * PowerBI service type
 *
 * Redash service type
 *
 * Superset service type
 *
 * Tableau service type
 *
 * Service type.
 *
 * Kafka service type
 *
 * Pulsar service type
 */
export enum Type {
  AzureSQL = 'AzureSQL',
  ClickHouse = 'ClickHouse',
  Databricks = 'Databricks',
  Db2 = 'Db2',
  Druid = 'Druid',
  DynamoDB = 'DynamoDB',
  Glue = 'Glue',
  Hive = 'Hive',
  Kafka = 'Kafka',
  Looker = 'Looker',
  MariaDB = 'MariaDB',
  Metabase = 'Metabase',
  Mssql = 'MSSQL',
  MySQL = 'MySQL',
  Oracle = 'Oracle',
  Postgres = 'Postgres',
  PowerBI = 'PowerBI',
  Presto = 'Presto',
  Pulsar = 'Pulsar',
  Redash = 'Redash',
  Redshift = 'Redshift',
  SQLite = 'SQLite',
  Salesforce = 'Salesforce',
  SingleStore = 'SingleStore',
  Snowflake = 'Snowflake',
  Superset = 'Superset',
  Tableau = 'Tableau',
  Trino = 'Trino',
  Vertica = 'Vertica',
}

/**
 * Additional connection configuration.
 */
export interface SourceConfig {
  config?: any[] | boolean | ConfigClass | number | null | string;
}

export interface ConfigClass {
  /**
   * DBT catalog file to extract dbt models with their column schemas.
   */
  dbtCatalogFilePath?: string;
  /**
   * DBT manifest file path to extract dbt models and associate with tables.
   */
  dbtManifestFilePath?: string;
  /**
   * Run data profiler as part of this metadata ingestion to get table profile data.
   */
  enableDataProfiler?: boolean;
  /**
   * Option to turn on/off generating sample data during metadata extraction.
   */
  generateSampleData?: boolean;
  /**
   * Optional configuration to turn off fetching metadata for views.
   */
  includeViews?: boolean;
  /**
   * Optional configuration to soft delete tables in OpenMetadata if the source tables are
   * deleted.
   */
  markDeletedTables?: boolean;
  /**
   * Sample data extraction query.
   */
  sampleDataQuery?: string;
  /**
   * Regex to only fetch tables or databases that matches the pattern.
   */
  schemaFilterPattern?: FilterPattern;
  /**
   * Regex exclude tables or databases that matches the pattern.
   */
  tableFilterPattern?: FilterPattern;
  /**
   * Configuration to tune how far we want to look back in query logs to process usage data.
   */
  queryLogDuration?: number;
  /**
   * Temporary file name to store the query logs before processing. Absolute file path
   * required.
   */
  stageFileLocation?: string;
  /**
   * Regex exclude tables or databases that matches the pattern.
   */
  chartFilterPattern?: FilterPattern;
  /**
   * Regex to only fetch tables or databases that matches the pattern.
   */
  dashboardFilterPattern?: FilterPattern;
  /**
   * Regex to only fetch topics that matches the pattern.
   */
  topicFilterPattern?: FilterPattern;
}

/**
 * Regex to only fetch tables or databases that matches the pattern.
 *
 * Regex to only fetch dashboards or charts that matches the pattern.
 *
 * Regex exclude tables or databases that matches the pattern.
 *
 * Regex to only fetch topics that matches the pattern.
 */
export interface FilterPattern {
  /**
   * List of strings/regex patterns to match and exclude only database entities that match.
   */
  excludes?: string[];
  /**
   * List of strings/regex patterns to match and include only database entities that match.
   */
  includes?: string[];
}

/**
 * Configuration for Stage Component in the OpenMetadata Ingestion Framework.
 */
export interface Stage {
  config?: { [key: string]: string };
  /**
   * Type of stage component ex: table-usage
   */
  type: string;
}

/**
 * Configuration for the entire Ingestion Workflow.
 */
export interface WorkflowConfig {
  config?: { [key: string]: string };
  openMetadataServerConfig: any;
}
