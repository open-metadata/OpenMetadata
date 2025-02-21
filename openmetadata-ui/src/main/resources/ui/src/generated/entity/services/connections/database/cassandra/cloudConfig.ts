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
 * Configuration for connecting to DataStax Astra DB in the cloud.
 */
export interface CloudConfig {
    /**
     * Configuration for connecting to DataStax Astra DB in the cloud.
     */
    cloudConfig?: DataStaxAstraDBConfiguration;
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
