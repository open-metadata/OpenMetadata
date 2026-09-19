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
 * Create or update the onboarding playbook for an asset type.
 */
export interface CreateOnboardingPlaybook {
    /**
     * Description of the playbook.
     */
    description?: string;
    /**
     * Display Name that identifies this playbook.
     */
    displayName?: string;
    /**
     * The asset type this playbook governs.
     */
    entityType: TargetEntityType;
    /**
     * Intake form whose fields were migrated into the Creation gate.
     */
    intakeForm?: EntityReference;
    /**
     * Name that identifies this playbook.
     */
    name: string;
    /**
     * The lifecycle and gates this playbook enforces.
     */
    onboarding?: OnboardingConfiguration;
    /**
     * Owners of this playbook.
     */
    owners?: EntityReference[];
}

/**
 * The asset type this playbook governs.
 *
 * Asset types that support an onboarding playbook today.
 */
export enum TargetEntityType {
    DataProduct = "dataProduct",
    Domain = "domain",
    GlossaryTerm = "glossaryTerm",
    Metric = "metric",
}

/**
 * Intake form whose fields were migrated into the Creation gate.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Workflow started once every blocking check passes. The workflow owns the approval and the
 * resulting status change; the playbook only decides when it is allowed to start.
 *
 * For `approval` checks, the workflow that records the decision.
 *
 * Owners of this playbook.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
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
 * The lifecycle and gates this playbook enforces.
 *
 * The body of a playbook: the lifecycle it declares and what it takes to pass each gate.
 */
export interface OnboardingConfiguration {
    enabled?: boolean;
    gates?:   OnboardingGate[];
    /**
     * Lifecycle declared by this playbook, in order. Empty means the default lifecycle.
     */
    stages?: OnboardingStageDefinition[];
}

/**
 * What it takes to leave a stage. Nothing moves on until every blocking check passes;
 * recommended checks stay open as tasks. The gate decides when a workflow may start - it
 * never changes the asset's status itself.
 */
export interface OnboardingGate {
    /**
     * Hard stop. When false, a failing gate raises a warning and a notification instead of
     * blocking.
     */
    blockTransition?: boolean;
    /**
     * Workflow started once every blocking check passes. The workflow owns the approval and the
     * resulting status change; the playbook only decides when it is allowed to start.
     */
    handoffWorkflow?: EntityReference;
    notifyOnStall?:   StallPolicy;
    reassignOnStall?: ReassignPolicy;
    /**
     * Stage this gate governs the exit from.
     */
    stage: string;
    steps: OnboardingStep[];
}

/**
 * Tell the playbook maintainer when an asset stops moving.
 */
export interface StallPolicy {
    /**
     * Days with no activity on an open task before notifying.
     */
    afterDays?: number;
    enabled?:   boolean;
}

/**
 * Keep onboarding moving when the assignee goes quiet.
 */
export interface ReassignPolicy {
    afterDays?: number;
    enabled?:   boolean;
    /**
     * Role the open tasks are reassigned to.
     */
    role?: OnboardingAssignment;
}

/**
 * Role the open tasks are reassigned to.
 */
export interface OnboardingAssignment {
    assignees?: EntityReference[];
    role?:      Role;
}

export enum Role {
    Creator = "creator",
    DomainOwners = "domainOwners",
    Experts = "experts",
    Explicit = "explicit",
    Owners = "owners",
}

/**
 * A single check inside a gate. A field is only ever asked for once per playbook; the gate
 * it sits in decides when it is due and who is asked.
 */
export interface OnboardingStep {
    assignment?: OnboardingAssignment;
    /**
     * Help offered to the person completing the check.
     */
    assistance?: Assistance;
    /**
     * Conditions are how one playbook covers a whole asset type, rather than competing
     * playbooks.
     */
    conditions?: OnboardingCondition[];
    /**
     * Field this check captures, e.g. `description` or `extension.accessRequestInfo`.
     */
    fieldPath?: string;
    /**
     * Instructions for the person completing this step.
     */
    guidance?: string;
    id:        string;
    /**
     * Whether the check holds the gate. Only blocking checks stop a transition; recommended and
     * optional checks stay open as tasks.
     */
    requirement?: Requirement;
    rules?:       OnboardingRules;
    /**
     * Step display name.
     */
    title?: string;
    /**
     * What kind of check this is.
     */
    type: CheckType;
    /**
     * For `approval` checks, the workflow that records the decision.
     */
    workflow?: EntityReference;
}

/**
 * Help offered to the person completing the check.
 */
export enum Assistance {
    AI = "ai",
    Autofill = "autofill",
    Example = "example",
    None = "none",
}

export interface OnboardingCondition {
    /**
     * Native or extension field to test.
     */
    fieldPath: string;
    operator:  Operator;
    /**
     * Value compared using the selected operator.
     */
    value?: any;
}

export enum Operator {
    Contains = "contains",
    Equals = "equals",
    Present = "present",
    StartsWith = "startsWith",
}

/**
 * Whether the check holds the gate. Only blocking checks stop a transition; recommended and
 * optional checks stay open as tasks.
 */
export enum Requirement {
    Blocking = "blocking",
    Optional = "optional",
    Recommended = "recommended",
}

export interface OnboardingRules {
    minItems?:  number;
    minLength?: number;
}

/**
 * What kind of check this is.
 */
export enum CheckType {
    Approval = "approval",
    Assessment = "assessment",
    Attribute = "attribute",
    Relationship = "relationship",
    Responsibility = "responsibility",
}

/**
 * A stage in a playbook's lifecycle. The playbook declares the order; `entityStatus` is the
 * status the handoff workflow is expected to set when the asset arrives here, so the
 * playbook and the workflow agree on one vocabulary.
 */
export interface OnboardingStageDefinition {
    description?: string;
    /**
     * Label shown on the lifecycle rail, e.g. `In Review`.
     */
    displayName?: string;
    /**
     * Status the asset carries while in this stage. Set by the handoff workflow, never by
     * onboarding.
     */
    entityStatus?: EntityStatus;
    /**
     * The stage an asset is created into. Exactly one stage per playbook is the entry stage.
     */
    entryStage?: boolean;
    key:         string;
    /**
     * Position in the lifecycle, ascending.
     */
    order: number;
    /**
     * No further gates after this stage.
     */
    terminal?: boolean;
}

/**
 * Status the asset carries while in this stage. Set by the handoff workflow, never by
 * onboarding.
 *
 * Status of an entity. It is used for governance and is applied to all the entities in the
 * catalog.
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
