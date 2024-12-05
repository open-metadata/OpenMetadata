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
 * MongoDB Connection Config
 */
export interface MongoDBConnection {
    connectionOptions?: { [key: string]: string };
    /**
     * Optional name to give to the database in OpenMetadata. If left blank, we will use default
     * as the database name.
     */
    databaseName?: string;
    /**
     * Host and port of the MongoDB service when using the `mongodb` connection scheme. Only
     * host when using the `mongodb+srv` scheme.
     */
    hostPort: string;
    /**
     * Password to connect to MongoDB.
     */
    password?: string;
    /**
     * Mongo connection scheme options.
     */
    scheme?:                     MongoDBScheme;
    sslConfig?:                  Config;
    sslMode?:                    SSLMode;
    supportsMetadataExtraction?: boolean;
    supportsProfiler?:           boolean;
    /**
     * Service Type
     */
    type?: MongoDBType;
    /**
     * Username to connect to MongoDB. This user should have privileges to read all the metadata
     * in MongoDB.
     */
    username?: string;
}

/**
 * Mongo connection scheme options.
 */
export enum MongoDBScheme {
    Mongodb = "mongodb",
    MongodbSrv = "mongodb+srv",
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
export enum MongoDBType {
    MongoDB = "MongoDB",
}
