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
 * Qlik Sense Connection Config
 */
export interface QlikSenseConnection {
    certificates: QlikCertificatesBy;
    /**
     * Qlik Sense Base URL, used for genrating dashboard & chat url
     */
    displayUrl?: string;
    /**
     * URL for the Qlik instance.
     */
    hostPort:                    string;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: QlikSenseType;
    /**
     * User Directory.
     */
    userDirectory?: string;
    /**
     * User ID.
     */
    userId?: string;
    /**
     * Validate Host Name
     */
    validateHostName?: boolean;
}

/**
 * Qlik Authentication Certificate By Values
 *
 * Qlik Authentication Certificate File Path
 */
export interface QlikCertificatesBy {
    sslConfig?: Config;
    /**
     * Client Certificate
     */
    clientCertificate?: string;
    /**
     * Client Key Certificate.
     */
    clientKeyCertificate?: string;
    /**
     * Root Certificate.
     */
    rootCertificate?: string;
    [property: string]: any;
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
 * Service Type
 *
 * Qlik sense service type
 */
export enum QlikSenseType {
    QlikSense = "QlikSense",
}
