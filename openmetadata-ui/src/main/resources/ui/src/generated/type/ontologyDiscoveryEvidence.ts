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
