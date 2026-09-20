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
 * Generate a reviewable ontology Draft without applying any entity mutation.
 */
export interface OntologyDomainDraftRequest {
    changeSetName: string;
    description:   string;
    /**
     * Optional service-discovery provenance. The server adds the actual model identifier and
     * generation time to the persisted draft.
     */
    discoveryContext?: OntologyDiscoveryContext;
    displayName:       string;
    domainDescription: string;
    glossary:          string;
    maxConcepts:       number;
    /**
     * Already-extracted structured proposal. When present, the server compiles it without
     * asking another model to reinterpret it. Requires discoveryContext.
     */
    proposal?: OntologyDiscoveryProposal;
}

/**
 * Optional service-discovery provenance. The server adds the actual model identifier and
 * generation time to the persisted draft.
 *
 * Immutable provenance and deduplication context for an automated ontology draft.
 */
export interface OntologyDiscoveryContext {
    automationId:   string;
    conversationId: string;
    evidence:       OntologyDiscoveryEvidence[];
    /**
     * SHA-256 over canonicalized evidence identity, versions, runs, verifier, and rule version.
     */
    evidenceFingerprint: string;
    generatedAt?:        number;
    /**
     * Draft provider identifier: the generative model for prose generation or the deterministic
     * compiler version for structured discovery. The latter is not a generative model claim.
     */
    modelId?:    string;
    ruleVersion: string;
    serviceFqn:  string;
    /**
     * Immutable source-local verifier checkpoint identifier when a separate verifier such as
     * Laya is used.
     */
    verificationModelId?: string;
    verificationProvider: VerificationProvider;
    /**
     * Explicit outcome of the requested verifier, independent of whether catalog-only discovery
     * was possible.
     */
    verificationStatus?: VerificationStatus;
}

/**
 * A versioned persisted-catalog observation used to support an ontology proposal. Raw
 * source samples are never stored here.
 */
export interface OntologyDiscoveryEvidence {
    /**
     * Catalog entity type containing the evidence.
     */
    entityType:         string;
    fullyQualifiedName: string;
    /**
     * SHA-256 of bounded verifier decisions, candidate vocabulary and inference rule; never a
     * hash of raw source values.
     */
    observationFingerprint?: string;
    /**
     * Bounded labels for the catalog signals used; never raw sample values.
     */
    signals?: string[];
    /**
     * Originating completed ingestion or automation run when exposed by the catalog.
     */
    sourceRunId?: string;
    /**
     * Catalog entity version observed by discovery.
     */
    sourceVersion?: number;
    updatedAt?:     number;
}

export enum VerificationProvider {
    Jev = "jev",
    Laya = "laya",
    Model = "model",
}

/**
 * Explicit outcome of the requested verifier, independent of whether catalog-only discovery
 * was possible.
 */
export enum VerificationStatus {
    NotRequested = "notRequested",
    Partial = "partial",
    Succeeded = "succeeded",
    Unavailable = "unavailable",
}

/**
 * Already-extracted structured proposal. When present, the server compiles it without
 * asking another model to reinterpret it. Requires discoveryContext.
 *
 * Structured discovery output compiled deterministically into review-only operations.
 */
export interface OntologyDiscoveryProposal {
    classes:        Concept[];
    relationships?: Relationship[];
}

export interface Concept {
    baseVersion?:    number;
    description:     string;
    displayName?:    string;
    evidenceFqns:    string[];
    existingTermId?: string;
    key:             string;
    name:            string;
    parentKey?:      string;
    properties?:     Property[];
    tableBindings?:  Binding[];
}

export interface Property {
    dataType:       DataType;
    description?:   string;
    enumValues?:    string[];
    evidenceFqns:   string[];
    isIdentifier:   boolean;
    name:           string;
    sourceColumns?: OntologySourceColumn[];
    unit?:          string;
}

/**
 * Supported value type for an ontology attribute.
 */
export enum DataType {
    Boolean = "BOOLEAN",
    Date = "DATE",
    Decimal = "DECIMAL",
    Enum = "ENUM",
    Integer = "INTEGER",
    String = "STRING",
}

/**
 * Catalog column realizing an ontology property. Contains identities, never sample values.
 */
export interface OntologySourceColumn {
    columnFqn: string;
    tableFqn:  string;
}

export interface Binding {
    role:     RealizationRole;
    tableFqn: string;
}

/**
 * Role the asset plays in realizing the concept. At most one asset may be the primary store
 * of a concept.
 */
export enum RealizationRole {
    Derived = "DERIVED",
    PrimaryStore = "PRIMARY_STORE",
    Replica = "REPLICA",
}

export interface Relationship {
    evidenceFqns:       string[];
    fromKey:            string;
    relationshipTypeId: string;
    toKey:              string;
}
