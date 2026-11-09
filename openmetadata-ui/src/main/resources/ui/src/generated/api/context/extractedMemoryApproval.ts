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
 * What approving a document's extracted memories does: how many it approves and which it
 * leaves for a person to decide.
 */
export interface ExtractedMemoryApproval {
    /**
     * On a preview, the memories approval would approve, each with when its claim last changed
     * as read. A request to approve sends this list back, and only the memories it names are
     * approved.
     */
    approvable?: ComparedMemory[];
    /**
     * Unprocessed extracted memories approved; on a preview, those approval would approve.
     */
    approved: number;
    /**
     * Unprocessed extracted memories whose approval was refused or that changed while being
     * approved. They stay pending.
     */
    failed?: number;
    /**
     * Unprocessed extracted memories left pending for a person to decide: a second value of a
     * question another pending or Approved memory of the same document asks, or a value held
     * beside a decided memory of the document, which may be that decision reworded.
     */
    needsDecision: EntityReference[];
}

/**
 * A memory the reviewer compared.
 */
export interface ComparedMemory {
    /**
     * When the memory's claim last changed, as the reviewer read it. Absent when the reviewer
     * could not read the memory.
     */
    contentUpdatedAt?: number;
    /**
     * The compared context memory.
     */
    id: string;
}

/**
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 */
export interface EntityReference {
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type: string;
}
