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
 * Microsoft Access Database Connection Config
 */
export interface MicrosoftAccessConnection {
    /**
     * Choose between local file system path (object) or S3 bucket location (object) for Access
     * database files.
     */
    connection:                     AccessDatabaseLocationLocalPathOrS3;
    supportsMetadataExtraction?:    boolean;
    supportsViewLineageExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: MicrosoftAccessType;
}

/**
 * Choose between local file system path (object) or S3 bucket location (object) for Access
 * database files.
 *
 * Local filesystem path to a single Access database file or a directory containing Access
 * files.
 *
 * S3 Connection.
 */
export interface AccessDatabaseLocationLocalPathOrS3 {
    /**
     * Absolute path to the .accdb or .mdb file, or a directory. Supports ~ expansion (e.g.
     * ~/data/sales.accdb). All .accdb and .mdb files found recursively in a directory will be
     * ingested.
     */
    localFilePath?: string;
    awsConfig?:     AWSCredentials;
    /**
     * Bucket Names of the data source.
     */
    bucketNames?:         string[];
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Console EndPoint URL for S3-compatible services
     */
    consoleEndpointURL?: string;
    /**
     * Regex to only fetch containers that matches the pattern.
     */
    containerFilterPattern?:     FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: S3Type;
}

/**
 * AWS credentials configs.
 */
export interface AWSCredentials {
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
    awsRegion: string;
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
 * Regex to only fetch containers that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include/exclude tables that matches the pattern.
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
 * Service Type
 *
 * S3 service type
 */
export enum S3Type {
    S3 = "S3",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum MicrosoftAccessType {
    MicrosoftAccess = "MicrosoftAccess",
}
