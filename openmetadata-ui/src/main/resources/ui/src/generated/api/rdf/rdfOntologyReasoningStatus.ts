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
 * Which projected ontology graphs production reasoning takes, across every glossary.
 * Production reasoning uses Approved axioms and Approved terms only, so a fresh deployment,
 * whose axioms start in Draft, may include none.
 */
export interface RDFOntologyReasoningStatus {
    /**
     * Glossaries with an active Approved version manifest.
     */
    activeOntologies: number;
    /**
     * Axiom and term graphs left out, by reason.
     */
    excluded: Exclusion[];
    /**
     * Approved axiom and term graphs, and every relationship-type graph a closure may use.
     */
    included: MemberCounts;
}

/**
 * How many graphs of one entity type are left out for one reason.
 */
export interface Exclusion {
    count: number;
    /**
     * ontologyAxiom or glossaryTerm.
     */
    entityType: string;
    reason:     ExclusionReason;
}

/**
 * Why a projected axiom or term graph is not part of production reasoning: its owner's
 * lifecycle status is not Approved, or it has no status.
 */
export enum ExclusionReason {
    Archived = "ARCHIVED",
    Deprecated = "DEPRECATED",
    Draft = "DRAFT",
    InReview = "IN_REVIEW",
    NoStatus = "NO_STATUS",
    Rejected = "REJECTED",
    Unprocessed = "UNPROCESSED",
}

/**
 * Approved axiom and term graphs, and every relationship-type graph a closure may use.
 *
 * Ontology graphs that take part, by the kind of entity that owns them.
 */
export interface MemberCounts {
    axioms:            number;
    relationshipTypes: number;
    terms:             number;
}
