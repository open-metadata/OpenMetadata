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
 * Databricks Connection Config
 */
export interface DatabricksConnection {
    /**
     * Choose between different authentication types for Databricks.
     */
    authType: AuthenticationType;
    /**
     * Catalog of the data source(Example: hive_metastore). This is optional parameter, if you
     * would like to restrict the metadata reading to a single catalog. When left blank,
     * OpenMetadata Ingestion attempts to scan all the catalog.
     */
    catalog?:             string;
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * The maximum amount of time (in seconds) to wait for a successful connection to the data
     * source. If the connection attempt takes longer than this timeout period, an error will be
     * returned.
     */
    connectionTimeout?: number;
    /**
     * Database Schema of the data source. This is optional parameter, if you would like to
     * restrict the metadata reading to a single schema. When left blank, OpenMetadata Ingestion
     * attempts to scan all the schemas.
     */
    databaseSchema?: string;
    /**
     * Host and port of the Databricks service.
     */
    hostPort: string;
    /**
     * Databricks compute resources URL.
     */
    httpPath: string;
    /**
     * SQLAlchemy driver scheme options.
     */
    scheme?: DatabricksScheme;
    /**
     * Service Type
     */
    type?: DatabricksType;
}

/**
 * Choose between different authentication types for Databricks.
 *
 * Personal Access Token authentication for Databricks.
 *
 * OAuth2 Machine-to-Machine authentication using Service Principal credentials for
 * Databricks.
 *
 * Azure Active Directory authentication for Azure Databricks workspaces using Service
 * Principal.
 */
export interface AuthenticationType {
    /**
     * Generated Personal Access Token for Databricks workspace authentication. This token is
     * created from User Settings -> Developer -> Access Tokens in your Databricks workspace.
     */
    token?: string;
    /**
     * Service Principal Application ID created in your Databricks Account Console for OAuth
     * Machine-to-Machine authentication.
     */
    clientId?: string;
    /**
     * OAuth Secret generated for the Service Principal in Databricks Account Console. Used for
     * secure OAuth2 authentication.
     */
    clientSecret?: string;
    /**
     * Azure Service Principal Application (client) ID registered in your Azure Active Directory.
     */
    azureClientId?: string;
    /**
     * Azure Service Principal client secret created in Azure AD for authentication.
     */
    azureClientSecret?: string;
    /**
     * Azure Active Directory Tenant ID where your Service Principal is registered.
     */
    azureTenantId?: string;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum DatabricksScheme {
    DatabricksConnector = "databricks+connector",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum DatabricksType {
    Databricks = "Databricks",
}
