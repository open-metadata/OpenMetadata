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
 * The lifecycle stages entities can be in, the entity types that have a lifecycle stage (an
 * `entityStatus` property), the stages each type uses and the moves between them, and the
 * active workflows that own each type's stage. Entity types that are not listed have no
 * lifecycle.
 */
export interface EntityLifecycleStages {
    /**
     * Entity types that have a lifecycle stage, sorted by name.
     */
    entityTypes: EntityTypeLifecycle[];
    /**
     * Every lifecycle stage an entity can be in. Each entity type uses the stages its own entry
     * lists.
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
     * Stages an entity of this type can be in. Most types use the general stages; a type with a
     * lifecycle of its own uses the stages it declares, which can include stages no other type
     * has.
     */
    stages: EntityStatus[];
    /**
     * Active governance workflows that own this entity type's lifecycle stage. While one of
     * them applies to an entity, its stage changes only through that workflow and a direct
     * change is rejected. More than one means the workflows overwrite each other's stage.
     */
    stageWorkflows: string[];
    /**
     * The moves this entity type allows between its stages. Any other stage change is rejected.
     */
    transitions: StageTransition[];
}

/**
 * Lifecycle stage of an entity, shared by every entity type that declares an `entityStatus`
 * property. Entity types without that property have no lifecycle. When a create request
 * omits the stage, the server assigns the entity type's initial stage.
 *
 * Stage the entity is in.
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

/**
 * The stages an entity can move to from one stage.
 */
export interface StageTransition {
    /**
     * Stage the entity is in.
     */
    from: EntityStatus;
    /**
     * Stages the entity can move to from it.
     */
    to: EntityStatus[];
}
