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
 * REST Connection Config
 */
export interface RESTConnection {
    /**
     * Regex to only fetch api collections with names matching the pattern.
     */
    apiCollectionFilterPattern?: FilterPattern;
    /**
     * Regex to only fetch api endpoints with names matching the pattern.
     */
    apiEndpointFilterPattern?: FilterPattern;
    /**
     * Documentation URL for the schema.
     */
    docURL?: string;
    /**
     * OpenAPI Schema source config. Either a URL or a file path must be provided.
     */
    openAPISchemaConnection: OpenAPISchemaConnection;
    /**
     * Supports Metadata Extraction.
     */
    supportsMetadataExtraction?: boolean;
    /**
     * Generated Token to connect to OpenAPI Schema.
     */
    token?: string;
    /**
     * REST API Type
     */
    type?: RESTType;
}

/**
 * Regex to only fetch api collections with names matching the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only fetch api endpoints with names matching the pattern.
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
 * OpenAPI Schema source config. Either a URL or a file path must be provided.
 *
 * Open API Schema URL Connection Config
 *
 * Open API Schema File Path Connection Config
 *
 * Open API Schema S3 Connection Config
 */
export interface OpenAPISchemaConnection {
    /**
     * Open API Schema URL.
     */
    openAPISchemaURL?: string;
    /**
     * Path to a local OpenAPI schema file.
     */
    openAPISchemaFilePath?: string;
    /**
     * AWS credentials required to access the S3 file.
     */
    awsCredentials?: AWSCredentials;
    /**
     * S3 URL of the OpenAPI schema file (JSON or YAML). Example:
     * https://bucket-name.s3.amazonaws.com/path/to/openapi_schema.json
     */
    openAPISchemaS3URL?: string;
}

/**
 * AWS credentials required to access the S3 file.
 *
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
 * REST API Type
 *
 * REST API type
 */
export enum RESTType {
    REST = "Rest",
}
