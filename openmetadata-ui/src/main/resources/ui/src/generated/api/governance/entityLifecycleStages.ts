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
 * The lifecycle stages shared by every entity type, the entity types that have a lifecycle
 * stage (an `entityStatus` property), and the active workflows that own each type's stage.
 * Entity types that are not listed have no lifecycle.
 */
export interface EntityLifecycleStages {
    /**
     * Entity types that have a lifecycle stage, sorted by name.
     */
    entityTypes: EntityTypeLifecycle[];
    /**
     * Lifecycle stages an entity can be in. Every entity type with a lifecycle shares this list.
     */
    stages: EntityStatus[];
}

/**
 * Lifecycle of one entity type.
 */
export interface EntityTypeLifecycle {
    /**
     * Entity type that has a lifecycle stage.
     */
    entityType: string;
    /**
     * Active governance workflows that own this entity type's lifecycle stage. While one of
     * them applies to an entity, its stage changes only through that workflow and a direct
     * change is rejected. More than one means the workflows overwrite each other's stage.
     */
    stageWorkflows: string[];
}

/**
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
    Rejected = "Rejected",
    Unprocessed = "Unprocessed",
}
