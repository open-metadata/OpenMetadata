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
     * Generative model identifier returned by the ontology draft provider.
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
