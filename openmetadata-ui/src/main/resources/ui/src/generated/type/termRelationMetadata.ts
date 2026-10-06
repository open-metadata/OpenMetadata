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
 * Metadata persisted with a glossary term relationship edge.
 */
export interface TermRelationMetadata {
    /**
     * Time the relationship was first persisted.
     */
    createdAt?: number;
    /**
     * User who first authored or imported the relationship.
     */
    createdBy?: string;
    /**
     * Stable logical relationship identifier.
     */
    id?: string;
    /**
     * How this relation edge originated.
     */
    provenance: Provenance;
    /**
     * Stable identifier of the governed relationship type.
     */
    relationshipTypeId?: string;
    /**
     * Type of the semantic relation between the glossary terms.
     */
    relationType: string;
    /**
     * Authored source term, independent of canonical physical row ordering.
     */
    sourceTermId?: string;
    /**
     * Approval status of this relation edge.
     */
    status: EntityStatus;
}

/**
 * How this relation edge originated.
 */
export enum Provenance {
    AISuggested = "AiSuggested",
    Imported = "Imported",
    Inferred = "Inferred",
    Manual = "Manual",
}

/**
 * Approval status of this relation edge.
 *
 * Lifecycle stage of an entity, shared by every entity type that declares an `entityStatus`
 * property. Entity types without that property have no lifecycle. When a create request
 * omits the stage, the server assigns the entity type's initial stage.
 */
export enum EntityStatus {
    Approved = "Approved",
    Archived = "Archived",
    Deprecated = "Deprecated",
    Draft = "Draft",
    InReview = "In Review",
    Invalidated = "Invalidated",
    Rejected = "Rejected",
    Superseded = "Superseded",
    Unprocessed = "Unprocessed",
}
