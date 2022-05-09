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
 * Test Service Connection to test user provided configuration is valid or not.
 */
export interface TestServiceConnection {
  /**
   * Database Connection.
   */
  connection?: ConnectionClass;
  /**
   * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
   */
  connectionType?: ConnectionType;
}

/**
 * Database Connection.
 *
 * Dashboard Connection.
 */
export interface ConnectionClass {
  config?: ConfigClass;
}

/**
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
 * Kafka Connection Config
 *
 * Pulsar Connection Config
 */
export interface ConfigClass {
  connectionArguments?: { [key: string]: any };
  /**
   * Additional connection options that can be sent to service during the connection.
   */
  connectionOptions?: { [key: string]: any };
  /**
   * GCS Credentials
   *
   * Credentials for PowerBI.
   */
  credentials?: GCSCredentials | string;
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
   * Host and port of the Snowflake service.
   *
   * Host and port of the Trino service.
   *
   * Host and port of the Vertica service.
   *
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
   */
  hostPort?: string;
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
  supportsMetadataExtraction?: boolean;
  supportsProfiler?: boolean;
  supportsUsageExtraction?: boolean;
  /**
   * OpenMetadata Tag category name if enablePolicyTagImport is set to true.
   */
  tagCategoryName?: string;
  /**
   * Service Type
   */
  type?: Type;
  /**
   * Username to connect to Bigquery. This user should have privileges to read all the
   * metadata in Bigquery.
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
   */
  username?: string;
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
   * Password to connect to Looker.
   *
   * Password to connect to Metabase.
   *
   * Password for Superset.
   *
   * Password for Tableau.
   */
  password?: string;
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
   * Snowflake Account.
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
   * Looker Environment
   *
   * Tableau Environment Name.
   */
  env?: string;
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
   * Authentication provider for the Superset service.
   */
  provider?: string;
  /**
   * Tableau API version.
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
 * Kafka service type
 *
 * Pulsar service type
 */
export enum Type {
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
  Mssql = 'Mssql',
  Mysql = 'Mysql',
  Oracle = 'Oracle',
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
 * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
 */
export enum ConnectionType {
  Dashboard = 'Dashboard',
  Database = 'Database',
  Messaging = 'Messaging',
}
