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
 * Trino Connection Config
 */
export interface TrinoConnection {
    /**
     * Choose Auth Config Type.
     */
    authType?: BasicAuth | NoConfigAuthenticationTypes;
    /**
     * Catalog of the data source.
     */
    catalog?:             string;
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Database Schema of the data source.
     */
    databaseSchema?: string;
    /**
     * Host and port of the Trino service.
     */
    hostPort: string;
    /**
     * SQLAlchemy driver scheme options.
     */
    scheme?: TrinoScheme;
    /**
     * Service Type
     */
    type?: TrinoType;
    /**
     * Username to connect to Trino.
     */
    username: string;
}

/**
 * Common Database Connection Config
 *
 * Azure Database Connection Config
 */
export interface BasicAuth {
    /**
     * Password to connect to source.
     */
    password?: string;
    /**
     * JWT to connect to source.
     */
    jwt?:         string;
    azureConfig?: AzureCredentials;
}

/**
 * Azure Cloud Credentials
 */
export interface AzureCredentials {
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
 * Database Authentication types not requiring config.
 */
export enum NoConfigAuthenticationTypes {
    OAuth2 = "OAuth2",
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum TrinoScheme {
    Trino = "trino",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum TrinoType {
    Trino = "Trino",
}
