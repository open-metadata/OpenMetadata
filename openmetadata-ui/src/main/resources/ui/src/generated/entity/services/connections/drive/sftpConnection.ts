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
 * SFTP Connection Config for secure file transfer protocol servers.
 */
export interface SFTPConnection {
    /**
     * Authentication method: username/password or SSH private key
     */
    authType:             AuthenticationType;
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Regex to only include/exclude directories that match the pattern.
     */
    directoryFilterPattern?: FilterPattern;
    /**
     * When enabled, extract sample data from structured files (CSV, TSV). This is disabled by
     * default to avoid performance overhead.
     */
    extractSampleData?: boolean;
    /**
     * Regex to only include/exclude files that match the pattern.
     */
    fileFilterPattern?: FilterPattern;
    /**
     * SFTP server hostname or IP address
     */
    host: string;
    /**
     * SFTP server port number
     */
    port?: number;
    /**
     * List of root directories to scan for files and subdirectories. If not specified, defaults
     * to the user's home directory.
     */
    rootDirectories?: string[];
    /**
     * When enabled, only catalog structured data files (CSV, TSV) that can have schema
     * extracted. Non-structured files like images, PDFs, videos, etc. will be skipped.
     */
    structuredDataFilesOnly?:    boolean;
    supportsMetadataExtraction?: boolean;
    /**
     * Service Type
     */
    type?: SFTPType;
}

/**
 * Authentication method: username/password or SSH private key
 *
 * Username and password authentication for SFTP
 *
 * SSH private key authentication for SFTP
 */
export interface AuthenticationType {
    /**
     * SFTP password
     */
    password?: string;
    /**
     * SFTP username
     */
    username: string;
    /**
     * SSH private key content in PEM format. Supports RSA, Ed25519, ECDSA, and DSS keys.
     */
    privateKey?: string;
    /**
     * Passphrase for the private key (if encrypted)
     */
    privateKeyPassphrase?: string;
}

/**
 * Regex to only include/exclude directories that match the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include/exclude files that match the pattern.
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
 * SFTP service type
 */
export enum SFTPType {
    SFTP = "Sftp",
}
