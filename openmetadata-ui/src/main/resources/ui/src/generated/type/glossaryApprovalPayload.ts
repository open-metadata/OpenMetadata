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
 * Payload for Glossary Approval tasks.
 */
export interface GlossaryApprovalPayload {
    /**
     * Action being approved.
     */
    action?: Action;
    /**
     * Current state of the term before changes.
     */
    currentState?: string;
    /**
     * Reference to the glossary term being approved.
     */
    glossaryTerm?: EntityReference;
    /**
     * Set on the request that decides a term an automation proposed; absent on every other
     * review of the term.
     */
    proposal?: AutomationProposal;
    /**
     * The term's changes awaiting review, by field name, each with the values it adds and
     * removes. Set by the approval workflow.
     */
    proposedChanges?: { [key: string]: any };
    /**
     * Proposed state of the term after changes.
     */
    proposedState?: string;
}

/**
 * Action being approved.
 */
export enum Action {
    Create = "Create",
    Delete = "Delete",
    Update = "Update",
}

/**
 * Reference to the glossary term being approved.
 *
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

/**
 * Set on the request that decides a term an automation proposed; absent on every other
 * review of the term.
 *
 * What an approval request says about the entity an automation, such as an AI agent,
 * proposed. Every user may read tasks while the memories an agent derives from may be
 * Private or Shared, so it names its sources by id and type only and carries none of the
 * agent's reasons: the memory derivations API serves those to whoever may read the memories.
 */
export interface AutomationProposal {
    /**
     * Display name of the agent that proposed the entity, when it recorded one.
     */
    agent?: string;
    /**
     * The agent's confidence in the proposal, from 0 to 1, when it recorded one.
     */
    confidence?: number;
    /**
     * The context memories the agent derived the entity from, by id and type only.
     */
    derivedFrom?: EntityReference[];
    /**
     * Provider of the proposed entity.
     */
    provider: ProviderType;
}

/**
 * Provider of the proposed entity.
 *
 * Type of provider of an entity. Some entities are provided by the `system`. Some are
 * entities created and provided by the `user`. Typically `system` provide entities can't be
 * deleted and can only be disabled. Some apps such as AutoPilot create entities with
 * `automation` provider type. These entities can be deleted by the user.
 */
export enum ProviderType {
    Automation = "automation",
    System = "system",
    User = "user",
}
