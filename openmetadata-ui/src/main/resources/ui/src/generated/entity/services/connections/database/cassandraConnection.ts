/*
 *  Copyright 2024 Collate.
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
 * Cassandra Connection Config
 */
export interface CassandraConnection {
    /**
     * Configuration for connecting to DataStax Astra DB in the cloud.
     */
    cloudConfig?: DataStaxAstraDBConfiguration;
    /**
     * Optional name to give to the database in OpenMetadata. If left blank, we will use default
     * as the database name.
     */
    databaseName?: string;
    /**
     * Host and port of the Cassandra service when using the `cassandra` connection scheme. Only
     * host when using the `cassandra+srv` scheme.
     */
    hostPort: string;
    /**
     * Password to connect to Cassandra.
     */
    password?:                   string;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: CassandraType;
    /**
     * Username to connect to Cassandra. This user should have privileges to read all the
     * metadata in Cassandra.
     */
    username?: string;
}

/**
 * Configuration for connecting to DataStax Astra DB in the cloud.
 */
export interface DataStaxAstraDBConfiguration {
    /**
     * Timeout in seconds for establishing new connections to Cassandra.
     */
    connectTimeout?: number;
    /**
     * Timeout in seconds for individual Cassandra requests.
     */
    requestTimeout?: number;
    /**
     * File path to the Secure Connect Bundle (.zip) used for a secure connection to DataStax
     * Astra DB.
     */
    secureConnectBundle?: string;
    /**
     * The Astra DB application token used for authentication.
     */
    token?: string;
    [property: string]: any;
}

/**
 * Service Type
 *
 * Service type.
 */
export enum CassandraType {
    Cassandra = "Cassandra",
}
