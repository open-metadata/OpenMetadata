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
 * Configuration for RDF/Knowledge Graph support in OpenMetadata
 */
export interface RDFConfiguration {
    /**
     * Expose optional AI-assisted Ontology flows. Manual authoring remains available when
     * disabled.
     */
    askCollateEnabled?: boolean;
    /**
     * Base URI for RDF resources
     */
    baseUri?: string;
    /**
     * Maximum number of entity models written in a single insert-only (append) bulk request.
     * Acts as a guard alongside maxAppendPayloadBytes so a chunk of very small entities cannot
     * grow without bound.
     */
    bulkAppendEntityBatchSize?: number;
    /**
     * Maximum number of entity models written to RDF storage in a single bulk request.
     */
    bulkEntityBatchSize?: number;
    /**
     * Maximum number of lineage edges written to RDF storage in a single SPARQL update.
     */
    bulkLineageEdgeBatchSize?: number;
    /**
     * Maximum number of source entities reconciled in a single RDF relationship bulk request.
     */
    bulkRelationshipSourceBatchSize?: number;
    /**
     * Cache bounded in-memory inference models for better query performance. Cached models
     * expire after 60 seconds.
     */
    cacheInferredTriples?: boolean;
    /**
     * Timeout in milliseconds for establishing connections to RDF storage.
     */
    connectTimeoutMs?: number;
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
     * Expose authenticated content-negotiated redirects for OpenMetadata-minted IRIs.
     */
    dereferenceableIris?: boolean;
    /**
     * Enable or disable RDF support
     */
    enabled: boolean;
    /**
     * Controls federated SPARQL access (SERVICE clauses) to external endpoints. Federation is
     * disabled by default; SERVICE clauses are rejected unless the target URI is in the
     * allowlist.
     */
    federation?: Federation;
    /**
     * Compress streamed insert-only request bodies with gzip. The backend reads the request
     * body inside its single-writer transaction, so on network-constrained links compression
     * directly shortens writer-lock hold time. Off by default; enable after verifying
     * throughput on your deployment. Only gzip is ever used - deflate is intentionally
     * unsupported.
     */
    gzipRequests?: boolean;
    /**
     * Enable inference/reasoning on SPARQL queries. When enabled, SPARQL queries will use the
     * inference engine to derive additional triples based on the reasoning level.
     */
    inferenceEnabled?: boolean;
    /**
     * Use durable per-rule inferred named graphs produced inside the RDF store instead of
     * building an in-memory Jena inference model for CUSTOM inference queries.
     */
    materializedInferenceEnabled?: boolean;
    /**
     * Approximate maximum serialized payload size in bytes for an insert-only (append) bulk RDF
     * write. Append writes carry no DELETE statements and are parsed by the streaming RDF
     * parser rather than the SPARQL grammar, so they tolerate much larger bodies than
     * reconciling updates; larger bodies mean fewer storage transactions, which is the main
     * throughput lever on a single-writer store. Raising this also raises peak heap in the
     * indexer, since a whole chunk is materialized as an in-memory model before it is sent.
     */
    maxAppendPayloadBytes?: number;
    /**
     * Maximum RDF store size for in-process inference. Queries requesting inference fall back
     * to direct SPARQL execution when the store exceeds this limit.
     */
    maxInMemoryInferenceTriples?: number;
    /**
     * Approximate maximum serialized payload size in bytes for a single bulk RDF write request.
     * Chunks are budgeted by estimated triple size and split when the serialized body exceeds
     * this cap, so wide entities cannot produce requests that overwhelm the storage backend. A
     * single entity larger than the cap is still sent alone.
     */
    maxUpdatePayloadBytes?: number;
    /**
     * Password for RDF storage authentication
     */
    password?: string;
    /**
     * SPARQL endpoint URL for remote RDF storage
     */
    remoteEndpoint?: string;
    /**
     * Timeout in milliseconds for individual RDF storage requests.
     */
    requestTimeoutMs?:    number;
    shaclValidationMode?: ShaclValidationMode;
    /**
     * Type of RDF storage backend
     */
    storageType: StorageType;
    /**
     * Stream insert-only bulk appends to the storage backend (per-entity models written
     * incrementally into the request body) instead of materializing a combined in-memory model
     * first. Streaming keeps indexer memory constant regardless of chunk size; disable only to
     * fall back to the library upload path when diagnosing transport issues.
     */
    streamingAppendEnabled?: boolean;
    /**
     * Reject authored axioms that violate the supported OWL 2 DL profile guardrails.
     */
    strictOwlProfile?: boolean;
    /**
     * Username for RDF storage authentication
     */
    username?: string;
    /**
     * Maximum number of retries for idempotent RDF write requests after the initial attempt.
     */
    writeMaxRetries?: number;
    /**
     * Initial backoff in milliseconds before retrying an RDF write request.
     */
    writeRetryInitialBackoffMs?: number;
    /**
     * Maximum backoff in milliseconds between RDF write request retries.
     */
    writeRetryMaxBackoffMs?: number;
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
 * Controls federated SPARQL access (SERVICE clauses) to external endpoints. Federation is
 * disabled by default; SERVICE clauses are rejected unless the target URI is in the
 * allowlist.
 */
export interface Federation {
    /**
     * External SPARQL endpoint URIs that may appear in SERVICE clauses. Compared verbatim
     * against the URI in the SERVICE clause; trailing slashes matter.
     */
    allowedEndpoints?: string[];
    /**
     * Master switch for federated SPARQL. When false, every SERVICE clause is rejected
     * regardless of allowlist contents.
     */
    enabled?: boolean;
}

/**
 * SHACL validation behavior for RDF import and asynchronous projections.
 */
export enum ShaclValidationMode {
    EnforceImports = "ENFORCE_IMPORTS",
    Off = "OFF",
    Report = "REPORT",
}

/**
 * Type of RDF storage backend
 */
export enum StorageType {
    Fuseki = "FUSEKI",
    Qlever = "QLEVER",
}
