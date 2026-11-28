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
 * Apache Solr Connection.
 */
export interface SolrConnection {
    connectionArguments?: { [key: string]: any };
    /**
     * Connection timeout in seconds when talking to the Solr instance.
     */
    connectionTimeoutSecs?: number;
    /**
     * Base URL of the Solr instance, e.g. `http://localhost:8983/solr`. For SolrCloud, point at
     * any node of the cluster.
     */
    hostPort: string;
    /**
     * Password to connect to Solr.
     */
    password?:                   string;
    sslConfig?:                  Config;
    supportsMetadataExtraction?: boolean;
    /**
     * Solr Type
     */
    type?: SolrType;
    /**
     * Username to connect to Solr. This user should have privileges to read all the metadata in
     * Solr.
     */
    username?: string;
    /**
     * Client SSL verification. Make sure to configure the SSLConfig if enabled.
     */
    verifySSL?: VerifySSL;
}

/**
 * Client SSL configuration
 *
 * OpenMetadata Client configured to validate SSL certificates.
 */
export interface Config {
    /**
     * The CA certificate used for SSL validation.
     */
    caCertificate?: string;
    /**
     * The SSL certificate used for client authentication.
     */
    sslCertificate?: string;
    /**
     * The private key associated with the SSL certificate.
     */
    sslKey?: string;
}

/**
 * Solr Type
 *
 * Solr service type
 */
export enum SolrType {
    Solr = "Solr",
}

/**
 * Client SSL verification. Make sure to configure the SSLConfig if enabled.
 */
export enum VerifySSL {
    Ignore = "ignore",
    NoSSL = "no-ssl",
    Validate = "validate",
}
