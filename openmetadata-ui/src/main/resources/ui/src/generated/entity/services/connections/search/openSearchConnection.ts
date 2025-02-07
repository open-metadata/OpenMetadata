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
 * OpenSearch Connection.
 */
export interface OpenSearchConnection {
    /**
     * Choose Auth Config Type.
     */
    authType?:            AuthConfigurationType;
    connectionArguments?: { [key: string]: any };
    /**
     * Connection Timeout in Seconds
     */
    connectionTimeoutSecs?: number;
    /**
     * Host and port of the OpenSearch service.
     */
    hostPort?:                   string;
    sslConfig?:                  SSLConfig;
    supportsMetadataExtraction?: boolean;
    /**
     * OpenSearch Type
     */
    type?: OpenSearchType;
}

/**
 * Choose Auth Config Type.
 *
 * Basic Auth Configuration for ElasticSearch
 *
 * API Key Authentication for ElasticSearch
 *
 * Authentication for OpenSearch using AWS IAM credentials
 */
export interface AuthConfigurationType {
    /**
     * Elastic Search Password for Login
     */
    password?: string;
    /**
     * Elastic Search Username for Login
     */
    username?: string;
    /**
     * Elastic Search API Key for API Authentication
     */
    apiKey?: string;
    /**
     * Elastic Search API Key ID for API Authentication
     */
    apiKeyId?:           string;
    awsAccessKeyId?:     string;
    awsRegion?:          string;
    awsSecretAccessKey?: string;
    awsSessionToken?:    string;
}

/**
 * SSL Config
 */
export interface SSLConfig {
    /**
     * SSL Certificates
     */
    certificates?: SSLCertificates;
    [property: string]: any;
}

/**
 * SSL Certificates
 *
 * SSL Certificates By Path
 *
 * SSL Certificates By Values
 */
export interface SSLCertificates {
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
    /**
     * CA Certificate Value
     */
    caCertValue?: string;
    /**
     * Client Certificate Value
     */
    clientCertValue?: string;
    /**
     * Private Key Value
     */
    privateKeyValue?: string;
    /**
     * Staging Directory Path
     */
    stagingDir?: string;
}

/**
 * OpenSearch Type
 *
 * OpenSearch service type
 */
export enum OpenSearchType {
    OpenSearch = "OpenSearch",
}
