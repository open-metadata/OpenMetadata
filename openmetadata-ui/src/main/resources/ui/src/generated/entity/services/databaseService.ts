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
 * This schema defines the Database Service entity, such as MySQL, BigQuery, Redshift,
 * Postgres, or Snowflake. Alternative terms such as Database Cluster, Database Server
 * instance are also used for database service.
 */
export interface DatabaseService {
  /**
   * Change that lead to this version of the entity.
   */
  changeDescription?: ChangeDescription;
  connection: DatabaseConnection;
  /**
   * When `true` indicates the entity has been soft deleted.
   */
  deleted?: boolean;
  /**
   * Description of a database service instance.
   */
  description?: string;
  /**
   * Display Name that identifies this database service.
   */
  displayName?: string;
  /**
   * Link to the resource corresponding to this database service.
   */
  href?: string;
  /**
   * Unique identifier of this database service instance.
   */
  id: string;
  /**
   * Name that identifies this database service.
   */
  name: string;
  /**
   * Owner of this database service.
   */
  owner?: EntityReference;
  /**
   * References to pipelines deployed for this database service to extract metadata, usage,
   * lineage etc..
   */
  pipelines?: EntityReference[];
  /**
   * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
   */
  serviceType: DatabaseServiceType;
  /**
   * Last update time corresponding to the new version of the entity in Unix epoch time
   * milliseconds.
   */
  updatedAt?: number;
  /**
   * User who made the update.
   */
  updatedBy?: string;
  /**
   * Metadata version of the entity.
   */
  version?: number;
}

/**
 * Change that lead to this version of the entity.
 *
 * Description of the change.
 */
export interface ChangeDescription {
  /**
   * Names of fields added during the version changes.
   */
  fieldsAdded?: FieldChange[];
  /**
   * Fields deleted during the version changes with old value before deleted.
   */
  fieldsDeleted?: FieldChange[];
  /**
   * Fields modified during the version changes with old and new values.
   */
  fieldsUpdated?: FieldChange[];
  /**
   * When a change did not result in change, this could be same as the current version.
   */
  previousVersion?: number;
}

export interface FieldChange {
  /**
   * Name of the entity field that changed.
   */
  name?: string;
  /**
   * New value of the field. Note that this is a JSON string and use the corresponding field
   * type to deserialize it.
   */
  newValue?: any;
  /**
   * Previous value of the field. Note that this is a JSON string and use the corresponding
   * field type to deserialize it.
   */
  oldValue?: any;
}

/**
 * Database Connection.
 */
export interface DatabaseConnection {
  config?: Connection;
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
 */
export interface Connection {
  connectionArguments?: { [key: string]: any };
  connectionOptions?: { [key: string]: any };
  /**
   * GCS Credentials
   */
  credentials?: GCSCredentials;
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
  type?: DatabaseServiceType;
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
 * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
 */
export enum DatabaseServiceType {
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
  MariaDB = 'MariaDB',
  Mssql = 'Mssql',
  Mysql = 'Mysql',
  Oracle = 'Oracle',
  Postgres = 'Postgres',
  Presto = 'Presto',
  Redshift = 'Redshift',
  SQLite = 'SQLite',
  Salesforce = 'Salesforce',
  SampleData = 'SampleData',
  SingleStore = 'SingleStore',
  Snowflake = 'Snowflake',
  Trino = 'Trino',
  Vertica = 'Vertica',
}

/**
 * Owner of this database service.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * References to pipelines deployed for this database service to extract metadata, usage,
 * lineage etc..
 */
export interface EntityReference {
  /**
   * If true the entity referred to has been soft-deleted.
   */
  deleted?: boolean;
  /**
   * Optional description of entity.
   */
  description?: string;
  /**
   * Display Name that identifies this entity.
   */
  displayName?: string;
  /**
   * Fully qualified name of the entity instance. For entities such as tables, databases
   * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
   * such as `user` and `team` this will be same as the `name` field.
   */
  fullyQualifiedName?: string;
  /**
   * Link to the entity resource.
   */
  href?: string;
  /**
   * Unique identifier that identifies an entity instance.
   */
  id: string;
  /**
   * Name of the entity instance.
   */
  name?: string;
  /**
   * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
   * `dashboardService`...
   */
  type: string;
}
