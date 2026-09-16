/*
 *  Copyright 2026 Collate.
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
 * Databend Database Connection Config
 */
export interface DatabendConnection {
    /**
     * Optional Databend catalog to ingest as an OpenMetadata database. When omitted, all
     * accessible catalogs are scanned.
     */
    catalog?:             string;
    connectionArguments?: { [key: string]: any };
    /**
     * Additional options appended to the Databend SQLAlchemy connection URL. For a non-TLS HTTP
     * endpoint, such as the default self-hosted port 8000, set sslmode to disable. For a TLS
     * endpoint, set sslmode to enable.
     */
    connectionOptions?: { [key: string]: string };
    /**
     * Databend database used to establish the initial connection. This does not control the
     * OpenMetadata database name.
     */
    database?: string;
    /**
     * Regex to include or exclude Databend catalogs.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Optional Databend database to ingest. When omitted, all accessible Databend databases are
     * scanned as OpenMetadata schemas.
     */
    databaseSchema?: string;
    /**
     * Host and port of the Databend HTTP query service. The default self-hosted port is 8000.
     */
    hostPort: string;
    /**
     * Password to connect to Databend.
     */
    password:                 string;
    sampleDataStorageConfig?: SampleDataStorageConfig;
    /**
     * Regex to include or exclude Databend databases.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * SQLAlchemy driver scheme options.
     */
    scheme?:                     DatabendScheme;
    supportsMetadataExtraction?: boolean;
    supportsProfiler?:           boolean;
    /**
     * Regex to include or exclude tables and views.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: DatabendType;
    /**
     * Username to connect to Databend. The user must be able to read system and
     * information_schema metadata.
     */
    username: string;
}

/**
 * Regex to include or exclude Databend catalogs.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to include or exclude Databend databases.
 *
 * Regex to include or exclude tables and views.
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
 * Storage config to store sample data
 */
export interface SampleDataStorageConfig {
    config?: DataStorageConfig;
}

/**
 * Storage config to store sample data
 */
export interface DataStorageConfig {
    /**
     * Bucket Name
     */
    bucketName?: string;
    /**
     * Provide the pattern of the path where the generated sample data file needs to be stored.
     */
    filePathPattern?: string;
    /**
     * When this field enabled a single parquet file will be created to store sample data,
     * otherwise we will create a new file per day
     */
    overwriteData?: boolean;
    /**
     * Prefix of the data source.
     */
    prefix?:        string;
    storageConfig?: AwsCredentials;
    [property: string]: any;
}

/**
 * AWS credentials configs.
 */
export interface AwsCredentials {
    /**
     * The Amazon Resource Name (ARN) of the role to assume. Required Field in case of Assume
     * Role
     */
    assumeRoleArn?: string;
    /**
     * An identifier for the assumed role session. Use the role session name to uniquely
     * identify a session when the same role is assumed by different principals or for different
     * reasons. Required Field in case of Assume Role
     */
    assumeRoleSessionName?: string;
    /**
     * The Amazon Resource Name (ARN) of the role to assume. Optional Field in case of Assume
     * Role
     */
    assumeRoleSourceIdentity?: string;
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
     * Enable AWS IAM authentication. When enabled, uses the default credential provider chain
     * (environment variables, instance profile, etc.). Defaults to false for backward
     * compatibility.
     */
    enabled?: boolean;
    /**
     * EndPoint URL for the AWS
     */
    endPointURL?: string;
    /**
     * The name of a profile to use with the boto session.
     */
    profileName?: string;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum DatabendScheme {
    Databend = "databend",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum DatabendType {
    Databend = "Databend",
}
