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
 * Configuration for RDF/Knowledge Graph support in OpenMetadata
 */
export interface RDFConfiguration {
    /**
     * Base URI for RDF resources
     */
    baseUri?: string;
    /**
     * Dataset name in RDF storage
     */
    dataset?: string;
    /**
     * Enable or disable RDF support
     */
    enabled: boolean;
    /**
     * Password for RDF storage authentication
     */
    password?: string;
    /**
     * SPARQL endpoint URL for remote RDF storage
     */
    remoteEndpoint?: string;
    /**
     * Type of RDF storage backend
     */
    storageType: StorageType;
    /**
     * Username for RDF storage authentication
     */
    username?: string;
}

/**
 * Type of RDF storage backend
 */
export enum StorageType {
    Fuseki = "FUSEKI",
    Qlever = "QLEVER",
}
