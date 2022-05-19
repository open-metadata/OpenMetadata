/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright 2021 Collate
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
 * Google BigQuery Connection Config
 */
export interface BigQueryConnection {
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * GCS Credentials
     */
    credentials: GCSCredentials;
    /**
     * Database of the data source. This is optional parameter, if you would like to restrict
     * the metadata reading to a single database. When left blank, OpenMetadata Ingestion
     * attempts to scan all the databases.
     */
    database?: string;
    /**
     * Enable importing policy tags of BigQuery into OpenMetadata
     */
    enablePolicyTagImport?: boolean;
    /**
     * BigQuery APIs URL.
     */
    hostPort?: string;
    /**
     * Column name on which the BigQuery table will be partitioned.
     */
    partitionField?: string;
    /**
     * Partitioning query for BigQuery tables.
     */
    partitionQuery?: string;
    /**
     * Duration for partitioning BigQuery tables.
     */
    partitionQueryDuration?: number;
    /**
     * BigQuery project ID. Only required if using credentials path instead of values.
     */
    projectId?: string;
    /**
     * SQLAlchemy driver scheme options.
     */
    scheme?:                     BigqueryScheme;
    supportsMetadataExtraction?: boolean;
    supportsProfiler?:           boolean;
    supportsUsageExtraction?:    boolean;
    /**
     * OpenMetadata Tag category name if enablePolicyTagImport is set to true.
     */
    tagCategoryName?: string;
    /**
     * Service Type
     */
    type?: BigqueryType;
}

/**
 * GCS Credentials
 *
 * GCS credentials configs.
 */
export interface GCSCredentials {
    /**
     * GCS configs.
     */
    gcsConfig: GCSCredentialsValues | string;
}

/**
 * GCS Credentials.
 */
export interface GCSCredentialsValues {
    /**
     * Google Cloud auth provider certificate.
     */
    authProviderX509CertUrl?: string;
    /**
     * Google Cloud auth uri.
     */
    authUri?: string;
    /**
     * Google Cloud email.
     */
    clientEmail?: string;
    /**
     * Google Cloud Client ID.
     */
    clientId?: string;
    /**
     * Google Cloud client certificate uri.
     */
    clientX509CertUrl?: string;
    /**
     * Google Cloud private key.
     */
    privateKey?: string;
    /**
     * Google Cloud private key id.
     */
    privateKeyId?: string;
    /**
     * Google Cloud project id.
     */
    projectId?: string;
    /**
     * Google Cloud token uri.
     */
    tokenUri?: string;
    /**
     * Google Cloud service account type.
     */
    type?: string;
}

/**
 * SQLAlchemy driver scheme options.
 */
export enum BigqueryScheme {
    Bigquery = "bigquery",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum BigqueryType {
    BigQuery = "BigQuery",
}
