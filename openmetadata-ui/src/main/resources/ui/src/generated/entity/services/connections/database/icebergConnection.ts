/*
 *  Copyright 2025 Collate.
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
 * Iceberg Catalog Connection Config
 */
export interface IcebergConnection {
    catalog: IcebergCatalog;
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Table property to look for the Owner.
     */
    ownershipProperty?: string;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?:        FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: IcebergType;
}

/**
 * Iceberg Catalog configuration.
 */
export interface IcebergCatalog {
    /**
     * Catalog connection configuration, depending on your catalog type.
     */
    connection: Connection;
    /**
     * Custom Database Name for your Iceberg Service. If not set it will be 'default'.
     */
    databaseName?: string;
    /**
     * Catalog Name.
     */
    name: string;
    /**
     * Warehouse Location. Used to specify a custom warehouse location if needed.
     */
    warehouseLocation?: string;
}

/**
 * Catalog connection configuration, depending on your catalog type.
 *
 * Iceberg Hive Catalog configuration.
 *
 * Iceberg REST Catalog configuration.
 *
 * Iceberg Glue Catalog configuration.
 *
 * Iceberg DynamoDB Catalog configuration.
 */
export interface Connection {
    fileSystem?: IcebergFileSystem;
    /**
     * Uri to the Hive Metastore. Example: 'thrift://localhost:9083'
     *
     * Uri to the REST catalog. Example: 'http://rest-catalog/ws/'
     */
    uri?: string;
    /**
     * OAuth2 credential to use when initializing the catalog.
     */
    credential?: OAuth2Credential;
    /**
     * Sign requests to the REST Server using AWS SigV4 protocol.
     */
    sigv4?: Sigv4;
    /**
     * SSL Configuration details.
     */
    ssl?: SSLCertificatesByPath;
    /**
     * Berarer token to use for the 'Authorization' header.
     */
    token?:     string;
    awsConfig?: AWSCredentials;
    /**
     * DynamoDB table name.
     */
    tableName?: string;
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
     * EndPoint URL for the AWS
     */
    endPointURL?: string;
    /**
     * The name of a profile to use with the boto session.
     */
    profileName?: string;
}

/**
 * OAuth2 credential to use when initializing the catalog.
 */
export interface OAuth2Credential {
    /**
     * OAuth2 Client ID.
     */
    clientId?: string;
    /**
     * OAuth2 Client Secret
     */
    clientSecret?: string;
}

/**
 * Iceberg File System configuration, based on where the Iceberg Warehouse is located.
 */
export interface IcebergFileSystem {
    type?: Credentials | null;
}

/**
 * AWS credentials configs.
 *
 * Azure Cloud Credentials
 */
export interface Credentials {
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
     * EndPoint URL for the AWS
     */
    endPointURL?: string;
    /**
     * The name of a profile to use with the boto session.
     */
    profileName?: string;
    /**
     * Account Name of your storage account
     */
    accountName?: string;
    /**
     * Your Service Principal App ID (Client ID)
     */
    clientId?: string;
    /**
     * Your Service Principal Password (Client Secret)
     */
    clientSecret?: string;
    /**
     * Scopes to get access token, for e.g. api://6dfX33ab-XXXX-49df-XXXX-3459eX817d3e/.default
     */
    scopes?: string;
    /**
     * Tenant ID of your Azure Subscription
     */
    tenantId?: string;
    /**
     * Key Vault Name
     */
    vaultName?: string;
}

/**
 * Sign requests to the REST Server using AWS SigV4 protocol.
 */
export interface Sigv4 {
    /**
     * The service signing name to use when SigV4 signs a request.
     */
    signingName?: string;
    /**
     * AWS Region to use when SigV4 signs a request.
     */
    signingRegion?: string;
    [property: string]: any;
}

/**
 * SSL Configuration details.
 *
 * SSL Certificates By Path
 */
export interface SSLCertificatesByPath {
    /**
     * CA Certificate Path
     */
    caCertPath?: string;
    /**
     * Client Certificate Path
     */
    clientCertPath?: string;
    /**
     * Private Key Path
     */
    privateKeyPath?: string;
}

/**
 * Regex to only include/exclude databases that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include/exclude schemas that matches the pattern.
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
 * Service type.
 */
export enum IcebergType {
    Iceberg = "Iceberg",
}
