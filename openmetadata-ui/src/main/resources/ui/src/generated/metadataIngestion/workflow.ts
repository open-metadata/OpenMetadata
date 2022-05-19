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
 *
 * Metadata Service Connection.
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
 * Google BigQuery Connection Config
 *
 * AWS Athena Connection Config
 *
 * Azure SQL Connection Config
 *
 * Clickhouse Connection Config
 *
 * Databricks Connection Config
 *
 * Db2 Connection Config
 *
 * DeltaLake Database Connection Config
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
 * Sample Data Connection Config
 *
 * PinotDB Database Connection Config
 *
 * Kafka Connection Config
 *
 * Pulsar Connection Config
 *
 * Amundsen Connection Config
 *
 * Metadata to ElasticSearch Connection Config
 *
 * OpenMetadata Connection Config
 */
export interface Connection {
  /**
   * Looker Environment
   *
   * Tableau Environment Name.
   */
  env?: string;
  /**
   * URL to the Looker instance.
   *
   * Host and Port of the Metabase instance.
   *
   * Dashboard URL for PowerBI service.
   *
   * URL for the Redash instance
   *
   * URL for the superset instance.
   *
   * Tableau Server.
   *
   * BigQuery APIs URL.
   *
   * Host and port of the Athena service.
   *
   * Host and port of the AzureSQL service.
   *
   * Host and port of the Clickhouse service.
   *
   * Host and port of the Databricks service.
   *
   * Host and port of the DB2 service.
   *
   * Host and port of the Druid service.
   *
   * Host and port of the Hive service.
   *
   * Host and port of the MariaDB service.
   *
   * Host and port of the MSSQL service.
   *
   * Host and port of the MySQL service.
   *
   * Host and port of the SQLite service. Blank for in-memory database.
   *
   * Host and port of the Oracle service.
   *
   * Host and port of the Postgres service.
   *
   * Host and port of the Presto service.
   *
   * Host and port of the Redshift service.
   *
   * Host and port of the Salesforce service.
   *
   * Host and port of the SingleStore service.
   *
   * Host and port of the Trino service.
   *
   * Host and port of the Vertica service.
   *
   * Host and port of the PinotDB service.
   *
   * Host and port of the Amundsen Neo4j Connection.
   *
   * OpenMetadata Server Config. Must include API end point ex: http://localhost:8585/api
   */
  hostPort?: string;
  /**
   * Password to connect to Looker.
   *
   * Password to connect to Metabase.
   *
   * Password for Superset.
   *
   * Password for Tableau.
   *
   * Password to connect to AzureSQL.
   *
   * Password to connect to Clickhouse.
   *
   * Password to connect to Databricks.
   *
   * Password to connect to DB2.
   *
   * Password to connect to Druid.
   *
   * Password to connect to Hive.
   *
   * Password to connect to MariaDB.
   *
   * Password to connect to MSSQL.
   *
   * Password to connect to MySQL.
   *
   * Password to connect to SQLite. Blank for in-memory database.
   *
   * Password to connect to Oracle.
   *
   * Password to connect to Postgres.
   *
   * Password to connect to Presto.
   *
   * Password to connect to Redshift.
   *
   * Password to connect to the Salesforce.
   *
   * Password to connect to SingleStore.
   *
   * Password to connect to Snowflake.
   *
   * Password to connect to Trino.
   *
   * Password to connect to Vertica.
   *
   * password to connect  to the PinotDB.
   *
   * password to connect to the Amundsen Neo4j Connection.
   */
  password?: string;
  supportsMetadataExtraction?: boolean;
  /**
   * Service Type
   */
  type?: Type;
  /**
   * Username to connect to Looker. This user should have privileges to read all the metadata
   * in Looker.
   *
   * Username to connect to Metabase. This user should have privileges to read all the
   * metadata in Metabase.
   *
   * Username for Redash
   *
   * Username for Superset.
   *
   * Username for Tableau.
   *
   * Username to connect to AzureSQL. This user should have privileges to read the metadata.
   *
   * Username to connect to Clickhouse. This user should have privileges to read all the
   * metadata in Clickhouse.
   *
   * Username to connect to Databricks. This user should have privileges to read all the
   * metadata in Databricks.
   *
   * Username to connect to DB2. This user should have privileges to read all the metadata in
   * DB2.
   *
   * Username to connect to Druid. This user should have privileges to read all the metadata
   * in Druid.
   *
   * Username to connect to Hive. This user should have privileges to read all the metadata in
   * Hive.
   *
   * Username to connect to MariaDB. This user should have privileges to read all the metadata
   * in MariaDB.
   *
   * Username to connect to MSSQL. This user should have privileges to read all the metadata
   * in MsSQL.
   *
   * Username to connect to MySQL. This user should have privileges to read all the metadata
   * in Mysql.
   *
   * Username to connect to SQLite. Blank for in-memory database.
   *
   * Username to connect to Oracle. This user should have privileges to read all the metadata
   * in Oracle.
   *
   * Username to connect to Postgres. This user should have privileges to read all the
   * metadata in Postgres.
   *
   * Username to connect to Presto. This user should have privileges to read all the metadata
   * in Postgres.
   *
   * Username to connect to Redshift. This user should have privileges to read all the
   * metadata in Redshift.
   *
   * Username to connect to the Salesforce. This user should have privileges to read all the
   * metadata in Redshift.
   *
   * Username to connect to SingleStore. This user should have privileges to read all the
   * metadata in MySQL.
   *
   * Username to connect to Snowflake. This user should have privileges to read all the
   * metadata in Snowflake.
   *
   * Username to connect to Trino. This user should have privileges to read all the metadata
   * in Trino.
   *
   * Username to connect to Vertica. This user should have privileges to read all the metadata
   * in Vertica.
   *
   * username to connect  to the PinotDB. This user should have privileges to read all the
   * metadata in PinotDB.
   *
   * username to connect to the Amundsen Neo4j Connection.
   */
  username?: string;
  /**
   * Database Service Name for creation of lineage
   *
   * Database Service Name to create lineage
   *
   * Database Service Name in order to add data lineage.
   */
  dbServiceName?: string;
  /**
   * client_id for PowerBI.
   */
  clientId?: string;
  /**
   * clientSecret for PowerBI.
   */
  clientSecret?: string;
  /**
   * Credentials for PowerBI.
   *
   * GCS Credentials
   */
  credentials?: GCSCredentials | string;
  /**
   * Dashboard redirect URI for the PowerBI service.
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
   * Additional connection options that can be sent to service during the connection.
   */
  connectionOptions?: { [key: string]: any };
  /**
   * Authentication provider for the Superset service.
   */
  provider?: string;
  /**
   * Tableau API version.
   *
   * OpenMetadata server API version to use.
   */
  apiVersion?: string;
  /**
   * Personal Access Token Name.
   */
  personalAccessTokenName?: string;
  /**
   * Personal Access Token Secret.
   */
  personalAccessTokenSecret?: string;
  /**
   * Tableau Site Name.
   */
  siteName?: string;
  connectionArguments?: { [key: string]: any };
  /**
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank, OpenMetadata Ingestion
   * attempts to scan all the databases.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank , OpenMetadata Ingestion
   * attempts to scan all the databases in Databricks.
   *
   * Database of the data source. This is optional parameter, if you would like to restrict
   * the metadata reading to a single database. When left blank, OpenMetadata Ingestion
   * attempts to scan all the databases in the selected catalog.
   */
  database?: string;
  /**
   * Enable importing policy tags of BigQuery into OpenMetadata
   */
  enablePolicyTagImport?: boolean;
  /**
   * Column name on which the BigQuery table will be partitioned.
   */
  partitionField?: string;
  /**
   * Partitioning query for BigQuery tables.
   */
  partitionQuery?: string;
  /**
   * Duration for partitioning BigQuery tables.
   */
  partitionQueryDuration?: number;
  /**
   * BigQuery project ID. Only required if using credentials path instead of values.
   */
  projectId?: string;
  /**
   * SQLAlchemy driver scheme options.
   */
  scheme?: Scheme;
  supportsProfiler?: boolean;
  supportsUsageExtraction?: boolean;
  /**
   * OpenMetadata Tag category name if enablePolicyTagImport is set to true.
   */
  tagCategoryName?: string;
  awsConfig?: AWSCredentials;
  /**
   * S3 Staging Directory.
   */
  s3StagingDir?: string;
  /**
   * Athena workgroup.
   */
  workgroup?: string;
  /**
   * SQLAlchemy driver for AzureSQL.
   */
  driver?: string;
  /**
   * Clickhouse SQL connection duration.
   */
  duration?: number;
  /**
   * Databricks compute resources URL.
   */
  httpPath?: string;
  /**
   * Generated Token to connect to Databricks.
   */
  token?: string;
  /**
   * pySpark App Name.
   */
  appName?: string;
  /**
   * File path of the local Hive Metastore.
   */
  metastoreFilePath?: string;
  /**
   * Host and port of the remote Hive Metastore.
   */
  metastoreHostPort?: string;
  /**
   * AWS pipelineServiceName Name.
   */
  pipelineServiceName?: string;
  /**
   * AWS storageServiceName Name.
   */
  storageServiceName?: string;
  /**
   * Authentication options to pass to Hive connector. These options are based on SQLAlchemy.
   */
  authOptions?: string;
  /**
   * Connection URI In case of pyodbc
   */
  uriString?: string;
  /**
   * How to run the SQLite database. :memory: by default.
   */
  databaseMode?: string;
  /**
   * Oracle Service Name to be passed. Note: either Database or Oracle service name can be
   * sent, not both.
   */
  oracleServiceName?: string;
  /**
   * Presto catalog
   *
   * Catalog of the data source.
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
   * If the Snowflake URL is https://xyz1234.us-east-1.gcp.snowflakecomputing.com, then the
   * account is xyz1234.us-east-1.gcp
   */
  account?: string;
  /**
   * Connection to Snowflake instance via Private Key
   */
  privateKey?: string;
  /**
   * Snowflake Role.
   */
  role?: string;
  /**
   * Snowflake Passphrase Key used with Private Key
   */
  snowflakePrivatekeyPassphrase?: string;
  /**
   * Snowflake warehouse.
   */
  warehouse?: string;
  /**
   * URL parameters for connection to the Trino data source
   */
  params?: { [key: string]: string };
  /**
   * Proxies for the connection to Trino data source
   */
  proxies?: { [key: string]: string };
  /**
   * Sample Data File Path
   */
  sampleDataFolder?: string;
  /**
   * Pinot Broker Host and Port of the data source.
   */
  pinotControllerHost?: string;
  /**
   * Kafka bootstrap servers. add them in comma separated values ex: host1:9092,host2:9092
   */
  bootstrapServers?: string;
  /**
   * Confluent Kafka Consumer Config
   */
  consumerConfig?: { [key: string]: any };
  /**
   * Confluent Kafka Schema Registry Config.
   */
  schemaRegistryConfig?: { [key: string]: any };
  /**
   * Confluent Kafka Schema Registry URL.
   */
  schemaRegistryURL?: string;
  /**
   * Enable encryption for the Amundsen Neo4j Connection.
   */
  encrypted?: boolean;
  /**
   * Maximum connection lifetime for the Amundsen Neo4j Connection.
   */
  maxConnectionLifeTime?: number;
  /**
   * Model Class for the Amundsen Neo4j Connection.
   */
  modelClass?: string;
  /**
   * Enable SSL validation for the Amundsen Neo4j Connection.
   */
  validateSSL?: boolean;
  /**
   * Include Dashboards for Indexing
   */
  includeDashboards?: boolean;
  /**
   * Include Database Services for Indexing
   */
  includeDatabaseServices?: boolean;
  /**
   * Include Glossary Terms for Indexing
   */
  includeGlossaryTerms?: boolean;
  /**
   * Include Messaging Services for Indexing
   */
  includeMessagingServices?: boolean;
  /**
   * Include Pipelines for Indexing
   */
  includePipelines?: boolean;
  /**
   * Include Pipeline Services for Indexing
   */
  includePipelineServices?: boolean;
  /**
   * Include Tags for Policy
   */
  includePolicy?: boolean;
  /**
   * Include Tables for Indexing
   */
  includeTables?: boolean;
  /**
   * Include Tags for Indexing
   */
  includeTags?: boolean;
  /**
   * Include Teams for Indexing
   */
  includeTeams?: boolean;
  /**
   * Include Topics for Indexing
   */
  includeTopics?: boolean;
  /**
   * Include Users for Indexing
   */
  includeUsers?: boolean;
  /**
   * Limit the number of records for Indexing.
   */
  limitRecords?: number;
  /**
   * OpenMetadata Server Authentication Provider. Make sure configure same auth providers as
   * the one configured on OpenMetadata server.
   */
  authProvider?: AuthProvider;
  /**
   * Validate Openmetadata Server & Client Version.
   */
  enableVersionValidation?: boolean;
  /**
   * OpenMetadata Client security configuration.
   */
  securityConfig?: ClientConfig;
}

/**
 * OpenMetadata Server Authentication Provider. Make sure configure same auth providers as
 * the one configured on OpenMetadata server.
 */
export enum AuthProvider {
  Auth0 = 'auth0',
  Azure = 'azure',
  CustomOidc = 'custom-oidc',
  Google = 'google',
  NoAuth = 'no-auth',
  Okta = 'okta',
  Openmetadata = 'openmetadata',
}

/**
 * AWS credentials configs.
 */
export interface AWSCredentials {
  /**
   * AWS Access key ID.
   */
  awsAccessKeyId: string;
  /**
   * AWS Region
   */
  awsRegion: string;
  /**
   * AWS Secret Access Key.
   */
  awsSecretAccessKey: string;
  /**
   * AWS Session Token.
   */
  awsSessionToken?: string;
  /**
   * EndPoint URL for the AWS
   */
  endPointURL?: string;
}

/**
 * GCS Credentials
 *
 * GCS credentials configs.
 */
export interface GCSCredentials {
  /**
   * GCS configs.
   */
  gcsConfig: GCSCredentialsValues | string;
}

/**
 * GCS Credentials.
 */
export interface GCSCredentialsValues {
  /**
   * Google Cloud auth provider certificate.
   */
  authProviderX509CertUrl?: string;
  /**
   * Google Cloud auth uri.
   */
  authUri?: string;
  /**
   * Google Cloud email.
   */
  clientEmail?: string;
  /**
   * Google Cloud Client ID.
   */
  clientId?: string;
  /**
   * Google Cloud client certificate uri.
   */
  clientX509CertUrl?: string;
  /**
   * Google Cloud private key.
   */
  privateKey?: string;
  /**
   * Google Cloud private key id.
   */
  privateKeyId?: string;
  /**
   * Google Cloud project id.
   */
  projectId?: string;
  /**
   * Google Cloud token uri.
   */
  tokenUri?: string;
  /**
   * Google Cloud service account type.
   */
  type?: string;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum Scheme {
  AwsathenaREST = 'awsathena+rest',
  Bigquery = 'bigquery',
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
  Pinot = 'pinot',
  PinotHTTP = 'pinot+http',
  PinotHTTPS = 'pinot+https',
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
 * OpenMetadata Client security configuration.
 *
 * Google SSO client security configs.
 *
 * Okta SSO client security configs.
 *
 * Auth0 SSO client security configs.
 *
 * Azure SSO Client security config to connect to OpenMetadata.
 *
 * Custom OIDC SSO client security configs.
 *
 * openMetadataJWTClientConfig security configs.
 */
export interface ClientConfig {
  /**
   * Google SSO audience URL
   */
  audience?: string;
  /**
   * Google SSO client secret key path or contents.
   *
   * Auth0 Client Secret Key.
   *
   * Custom OIDC Client Secret Key.
   */
  secretKey?: string;
  /**
   * Okta Client ID.
   *
   * Auth0 Client ID.
   *
   * Azure Client ID.
   *
   * Custom OIDC Client ID.
   */
  clientId?: string;
  /**
   * Okta Service account Email.
   */
  email?: string;
  /**
   * Okta org url.
   */
  orgURL?: string;
  /**
   * Okta Private Key.
   */
  privateKey?: string;
  /**
   * Okta client scopes.
   *
   * Azure Client ID.
   */
  scopes?: string[];
  /**
   * Auth0 Domain.
   */
  domain?: string;
  /**
   * Azure SSO Authority
   */
  authority?: string;
  /**
   * Azure SSO client secret key
   */
  clientSecret?: string;
  /**
   * Custom OIDC token endpoint.
   */
  tokenEndpoint?: string;
  /**
   * OpenMetadata generated JWT token.
   */
  jwtToken?: string;
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
 *
 * Amundsen service type
 *
 * Metadata to Elastic Search type
 *
 * OpenMetadata service type
 */
export enum Type {
  Amundsen = 'Amundsen',
  Athena = 'Athena',
  AzureSQL = 'AzureSQL',
  BigQuery = 'BigQuery',
  Clickhouse = 'Clickhouse',
  Databricks = 'Databricks',
  Db2 = 'Db2',
  DeltaLake = 'DeltaLake',
  Druid = 'Druid',
  DynamoDB = 'DynamoDB',
  Glue = 'Glue',
  Hive = 'Hive',
  Kafka = 'Kafka',
  Looker = 'Looker',
  MariaDB = 'MariaDB',
  Metabase = 'Metabase',
  MetadataES = 'MetadataES',
  Mssql = 'Mssql',
  Mysql = 'Mysql',
  OpenMetadata = 'OpenMetadata',
  Oracle = 'Oracle',
  PinotDB = 'PinotDB',
  Postgres = 'Postgres',
  PowerBI = 'PowerBI',
  Presto = 'Presto',
  Pulsar = 'Pulsar',
  Redash = 'Redash',
  Redshift = 'Redshift',
  SQLite = 'SQLite',
  Salesforce = 'Salesforce',
  SampleData = 'SampleData',
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
   * Regex to only fetch databases that matches the pattern.
   */
  databaseFilterPattern?: FilterPattern;
  /**
   * Available sources to fetch DBT catalog and manifest files.
   */
  dbtConfigSource?: any[] | boolean | number | null | DbtConfigSource | string;
  /**
   * Run data profiler as part of this metadata ingestion to get table profile data.
   */
  enableDataProfiler?: boolean;
  /**
   * Option to turn on/off generating sample data during metadata extraction.
   */
  generateSampleData?: boolean;
  /**
   * Optional configuration to turn off fetching metadata for tables.
   */
  includeTables?: boolean;
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
   * Pipeline type
   */
  type?: ConfigType;
  /**
   * Configuration to tune how far we want to look back in query logs to process usage data.
   */
  queryLogDuration?: number;
  /**
   * Configuration to set the file path for query logs
   */
  queryLogFilePath?: string;
  /**
   * Configuration to set the limit for query logs
   */
  resultLimit?: number;
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
  /**
   * Regex to only fetch tables with FQN matching the pattern.
   */
  fqnFilterPattern?: FilterPattern;
}

/**
 * Regex to only fetch databases that matches the pattern.
 *
 * Regex to only fetch dashboards or charts that matches the pattern.
 *
 * Regex to only fetch tables or databases that matches the pattern.
 *
 * Regex exclude tables or databases that matches the pattern.
 *
 * Regex to only fetch topics that matches the pattern.
 *
 * Regex to only fetch tables with FQN matching the pattern.
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
 * DBT Catalog and Manifest file path config.
 *
 * DBT Catalog and Manifest HTTP path configuration.
 */
export interface DbtConfigSource {
  /**
   * DBT catalog file path to extract dbt models with their column schemas.
   */
  dbtCatalogFilePath?: string;
  /**
   * DBT manifest file path to extract dbt models and associate with tables.
   */
  dbtManifestFilePath?: string;
  /**
   * DBT catalog http file path to extract dbt models with their column schemas.
   */
  dbtCatalogHttpPath?: string;
  /**
   * DBT manifest http file path to extract dbt models and associate with tables.
   */
  dbtManifestHttpPath?: string;
  dbtPrefixConfig?: DBTBucketDetails;
  dbtSecurityConfig?: SCredentials;
}

/**
 * Details of the bucket where the dbt files are stored
 */
export interface DBTBucketDetails {
  /**
   * Name of the bucket where the dbt files are stored
   */
  dbtBucketName?: string;
  /**
   * Path of the folder where the dbt files are stored
   */
  dbtObjectPrefix?: string;
}

/**
 * AWS credentials configs.
 *
 * GCS Credentials
 *
 * GCS credentials configs.
 */
export interface SCredentials {
  /**
   * AWS Access key ID.
   */
  awsAccessKeyId?: string;
  /**
   * AWS Region
   */
  awsRegion?: string;
  /**
   * AWS Secret Access Key.
   */
  awsSecretAccessKey?: string;
  /**
   * AWS Session Token.
   */
  awsSessionToken?: string;
  /**
   * EndPoint URL for the AWS
   */
  endPointURL?: string;
  /**
   * GCS configs.
   */
  gcsConfig?: GCSCredentialsValues | string;
}

/**
 * Pipeline type
 *
 * Database Source Config Metadata Pipeline type
 *
 * Database Source Config Usage Pipeline type
 *
 * Dashboard Source Config Metadata Pipeline type
 *
 * Messaging Source Config Metadata Pipeline type
 *
 * Profiler Source Config Pipeline type
 */
export enum ConfigType {
  DashboardMetadata = 'DashboardMetadata',
  DatabaseMetadata = 'DatabaseMetadata',
  DatabaseUsage = 'DatabaseUsage',
  MessagingMetadata = 'MessagingMetadata',
  Profiler = 'Profiler',
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
  loggerLevel?: LogLevels;
  openMetadataServerConfig: OpenMetadataConnection;
}

/**
 * Supported logging levels
 */
export enum LogLevels {
  Debug = 'DEBUG',
  Error = 'ERROR',
  Info = 'INFO',
  Warn = 'WARN',
}

/**
 * OpenMetadata Connection Config
 */
export interface OpenMetadataConnection {
  /**
   * OpenMetadata server API version to use.
   */
  apiVersion?: string;
  /**
   * OpenMetadata Server Authentication Provider. Make sure configure same auth providers as
   * the one configured on OpenMetadata server.
   */
  authProvider?: AuthProvider;
  /**
   * Validate Openmetadata Server & Client Version.
   */
  enableVersionValidation?: boolean;
  /**
   * OpenMetadata Server Config. Must include API end point ex: http://localhost:8585/api
   */
  hostPort: string;
  /**
   * Include Dashboards for Indexing
   */
  includeDashboards?: boolean;
  /**
   * Include Database Services for Indexing
   */
  includeDatabaseServices?: boolean;
  /**
   * Include Glossary Terms for Indexing
   */
  includeGlossaryTerms?: boolean;
  /**
   * Include Messaging Services for Indexing
   */
  includeMessagingServices?: boolean;
  /**
   * Include Pipelines for Indexing
   */
  includePipelines?: boolean;
  /**
   * Include Pipeline Services for Indexing
   */
  includePipelineServices?: boolean;
  /**
   * Include Tags for Policy
   */
  includePolicy?: boolean;
  /**
   * Include Tables for Indexing
   */
  includeTables?: boolean;
  /**
   * Include Tags for Indexing
   */
  includeTags?: boolean;
  /**
   * Include Teams for Indexing
   */
  includeTeams?: boolean;
  /**
   * Include Topics for Indexing
   */
  includeTopics?: boolean;
  /**
   * Include Users for Indexing
   */
  includeUsers?: boolean;
  /**
   * Limit the number of records for Indexing.
   */
  limitRecords?: number;
  /**
   * OpenMetadata Client security configuration.
   */
  securityConfig?: ClientConfig;
  supportsMetadataExtraction?: boolean;
  /**
   * Service Type
   */
  type?: OpenmetadataType;
}

/**
 * Service Type
 *
 * OpenMetadata service type
 */
export enum OpenmetadataType {
  OpenMetadata = 'OpenMetadata',
}
