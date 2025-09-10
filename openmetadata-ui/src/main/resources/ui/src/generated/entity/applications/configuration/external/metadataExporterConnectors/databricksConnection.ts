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
     * Generated Token to connect to Databricks.
     */
    token: string;
    /**
     * Service Type
     */
    type?: DatabricksType;
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
