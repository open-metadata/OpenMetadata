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
 * IOMETE Connection Config
 */
export interface IometeConnection {
    /**
     * Catalog of the data source (e.g. spark_catalog). This is an optional parameter; if left
     * blank, OpenMetadata uses default catalog.
     */
    catalog?: string;
    /**
     * IOMETE lakehouse cluster name to connect to.
     */
    cluster: string;
    /**
     * IOMETE database to restrict metadata ingestion to (e.g. default, finance_db). This is an
     * optional parameter; if left blank, OpenMetadata attempts to scan all databases in the
     * catalog.
     */
    databaseSchema?: string;
    /**
     * IOMETE data plane name.
     */
    dataPlane: string;
    /**
     * Host and port of the IOMETE service, e.g. dev.iomete.cloud:443
     */
    hostPort: string;
    /**
     * Password to connect to IOMETE.
     */
    password:                 string;
    sampleDataStorageConfig?: SampleDataStorageConfig;
    /**
     * Regex to only include/exclude IOMETE databases (e.g. 'default', 'finance_db') that match
     * the pattern. In IOMETE, a database corresponds to an OpenMetadata schema.
     */
    schemaFilterPattern?:           FilterPattern;
    supportsDBTExtraction?:         boolean;
    supportsMetadataExtraction?:    boolean;
    supportsProfiler?:              boolean;
    supportsViewLineageExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: IometeType;
    /**
     * Username to connect to IOMETE.
     */
    username: string;
}

/**
 * Storage config to store sample data
 */
export interface SampleDataStorageConfig {
    config?: DataStorageConfig;
}

/**
 * Storage config to store sample data
 */
export interface DataStorageConfig {
    storageConfig?: OpenMetadataStorage;
    [property: string]: any;
}

export interface OpenMetadataStorage {
}

/**
 * Regex to only include/exclude IOMETE databases (e.g. 'default', 'finance_db') that match
 * the pattern. In IOMETE, a database corresponds to an OpenMetadata schema.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include/exclude tables that matches the pattern.
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
 * Service type.
 */
export enum IometeType {
    Iomete = "Iomete",
}
