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

export interface DatabaseServiceMetadataPipelineClass {
  /**
   * DBT Catalog file name
   */
  dbtCatalogFileName?: string;
  dbtConfig?: DbtConfig;
  /**
   * DBT Manifest file name
   */
  dbtManifestFileName?: string;
  /**
   * Method from which the DBT files will be fetched. Accepted values are: 's3'(Required aws
   * s3 credentials to be provided), 'gcs'(Required gcs credentials to be provided),
   * 'gcs-path'(path of the file containing gcs credentials), 'local'(path of dbt files on
   * local system), 'http'(url path of dbt files).
   */
  dbtProvider?: DbtProvider;
  /**
   * DBT configuration.
   */
  dbtSecurityConfig?: SCredentials;
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
  type?: DatabaseMetadataConfigType;
}

/**
 * DBT Catalog and Manifest file path config.
 */
export interface DbtConfig {
  /**
   * DBT catalog file to extract dbt models with their column schemas.
   */
  dbtCatalogFilePath: string;
  /**
   * DBT manifest file path to extract dbt models and associate with tables.
   */
  dbtManifestFilePath: string;
}

/**
 * Method from which the DBT files will be fetched. Accepted values are: 's3'(Required aws
 * s3 credentials to be provided), 'gcs'(Required gcs credentials to be provided),
 * 'gcs-path'(path of the file containing gcs credentials), 'local'(path of dbt files on
 * local system), 'http'(url path of dbt files).
 */
export enum DbtProvider {
  Gcs = 'gcs',
  GcsPath = 'gcs-path',
  HTTP = 'http',
  Local = 'local',
  S3 = 's3',
}

/**
 * DBT configuration.
 *
 * GCS credentials configs.
 *
 * AWS credentials configs.
 */
export interface SCredentials {
  /**
   * GCS configs.
   */
  gcsConfig?: GCSCredentialsValues | string;
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
 * Regex to only fetch tables or databases that matches the pattern.
 *
 * Regex to only fetch dashboards or charts that matches the pattern.
 *
 * Regex exclude tables or databases that matches the pattern.
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
 * Pipeline type
 *
 * Database Source Config Metadata Pipeline type
 */
export enum DatabaseMetadataConfigType {
  DatabaseMetadata = 'DatabaseMetadata',
}
