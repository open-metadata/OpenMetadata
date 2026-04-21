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
 * DBT Catalog, Manifest and Run Results HTTP path configuration.
 */
export interface DbtHTTPConfig {
    /**
     * DBT catalog http file path to extract dbt models with their column schemas.
     */
    dbtCatalogHttpPath?: string;
    /**
     * dbt Configuration type
     */
    dbtConfigType: DbtConfigType;
    /**
     * Custom HTTP headers to include in every request when fetching dbt artifacts (e.g.
     * Authorization for private GitLab/GitHub repos).
     */
    dbtHttpHeaders?: { [key: string]: string };
    /**
     * DBT manifest http file path to extract dbt models and associate with tables.
     */
    dbtManifestHttpPath: string;
    /**
     * DBT run results http file path to extract the test results information.
     */
    dbtRunResultsHttpPath?: string;
    /**
     * DBT sources http file path to extract freshness test results information.
     */
    dbtSourcesHttpPath?: string;
    /**
     * SSL certificate configuration for validating the server certificate when fetching dbt
     * artifacts.
     */
    dbtSSLConfig?: Config;
    /**
     * SSL/TLS verification mode when fetching dbt artifacts over HTTPS.
     */
    dbtVerifySSL?: VerifySSL;
}

/**
 * dbt Configuration type
 */
export enum DbtConfigType {
    HTTP = "http",
}

/**
 * SSL certificate configuration for validating the server certificate when fetching dbt
 * artifacts.
 *
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
 * SSL/TLS verification mode when fetching dbt artifacts over HTTPS.
 *
 * Client SSL verification. Make sure to configure the SSLConfig if enabled.
 */
export enum VerifySSL {
    Ignore = "ignore",
    NoSSL = "no-ssl",
    Validate = "validate",
}
