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
 * Redshift  Connection Config
 */
export interface RedshiftConnection {
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Initial Redshift database to connect to. If you want to ingest all databases, set
     * ingestAllDatabases to true.
     */
    database: string;
    /**
     * Host and port of the Redshift service.
     */
    hostPort: string;
    /**
     * Password to connect to Redshift.
     */
    password?: string;
    /**
     * SQLAlchemy driver scheme options.
     */
    scheme?:    RedshiftScheme;
    sslConfig?: Config;
    sslMode?:   SSLMode;
    /**
     * Service Type
     */
    type?: RedshiftType;
    /**
     * Username to connect to Redshift. This user should have privileges to read all the
     * metadata in Redshift.
     */
    username: string;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum RedshiftScheme {
    RedshiftPsycopg2 = "redshift+psycopg2",
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
 * SSL Mode to connect to database.
 */
export enum SSLMode {
    Allow = "allow",
    Disable = "disable",
    Prefer = "prefer",
    Require = "require",
    VerifyCA = "verify-ca",
    VerifyFull = "verify-full",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum RedshiftType {
    Redshift = "Redshift",
}
