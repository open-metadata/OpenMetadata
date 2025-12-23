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
     * Cache inferred triples for better query performance (requires more storage)
     */
    cacheInferredTriples?: boolean;
    /**
     * Dataset name in RDF storage
     */
    dataset?: string;
    /**
     * Default reasoning level for SPARQL queries when inference is enabled. CUSTOM provides
     * OpenMetadata-specific inference rules including transitive lineage traversal and inverse
     * relationships.
     */
    defaultInferenceLevel?: ReasoningLevel;
    /**
     * Enable or disable RDF support
     */
    enabled: boolean;
    /**
     * Enable inference/reasoning on SPARQL queries. When enabled, SPARQL queries will use the
     * inference engine to derive additional triples based on the reasoning level.
     */
    inferenceEnabled?: boolean;
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
 * Default reasoning level for SPARQL queries when inference is enabled. CUSTOM provides
 * OpenMetadata-specific inference rules including transitive lineage traversal and inverse
 * relationships.
 *
 * Level of reasoning/inference to apply to SPARQL queries
 */
export enum ReasoningLevel {
    Custom = "CUSTOM",
    None = "NONE",
    OwlDL = "OWL_DL",
    OwlLite = "OWL_LITE",
    Rdfs = "RDFS",
}

/**
 * Type of RDF storage backend
 */
export enum StorageType {
    Fuseki = "FUSEKI",
    Qlever = "QLEVER",
}
