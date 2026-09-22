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
export interface OnboardingBoard {
    /**
     * Continuation cursor. Normally identifies the last returned instance. When
     * scanLimitReached is true, identifies the last scanned instance, even if no rows matched.
     * Continue with the same filters until after is absent.
     */
    after?: string;
    data:   OnboardingProgress[];
    /**
     * The request exhausted its 1,000-candidate scan budget before confirming whether more
     * matches exist. Data may be empty or shorter than the requested limit. Use after to
     * continue; the following page may be empty if the catalog ended at the scan boundary.
     */
    scanLimitReached?: boolean;
}

export interface OnboardingProgress {
    blockingSteps:         string[];
    canAdvance:            boolean;
    completed?:            boolean;
    configurationId?:      string;
    configurationVersion?: number;
    /**
     * When the asset was created - the start of its onboarding clock.
     */
    createdAt?:     number;
    domains?:       EntityReference[];
    enteredAt?:     number;
    entity?:        EntityReference;
    entityVersion?: number;
    /**
     * False when the gate lets an asset move with checks open and notifies the playbook owners
     * instead.
     */
    gateBlocking?: boolean;
    /**
     * Stage the asset moves to once this gate's workflow completes. Onboarding does not perform
     * the move.
     */
    nextStage?: string;
    paused?:    boolean;
    stage:      string;
    steps:      OnboardingStepResult[];
    /**
     * Required checks still open at a non-blocking gate.
     */
    warnings?: string[];
}

/**
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * For `approval` checks, the workflow that records the decision.
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

export interface OnboardingStepResult {
    assignees?: EntityReference[];
    /**
     * When the check's task is due, copied from the task. Set only when the gate has a stall
     * policy - the wizard shows `Due in N days` from it and says `Open` otherwise.
     */
    dueDate?: number;
    field?:   IntakeFormField;
    /**
     * When someone last chased this check.
     */
    lastReminderAt?: number;
    /**
     * Explanation of an incomplete check.
     */
    message?:            string;
    reassignedAt?:       number;
    required:            boolean;
    stage?:              string;
    stallNotifiedAt?:    number;
    state:               State;
    step:                OnboardingStep;
    taskId?:             string;
    workflowInstanceId?: string;
}

/**
 * A field included in this IntakeForm.
 */
export interface IntakeFormField {
    /**
     * Optional override for the validation error message when a required field is missing.
     */
    errorMessage?: string;
    /**
     * Whether a form field refers to a native entity attribute or a custom property defined via
     * the Type system.
     */
    fieldKind: FieldKind;
    /**
     * Human-friendly label used on the intake form UI and in validation error messages.
     */
    fieldLabel: string;
    /**
     * Path to the field on the entity. Native paths are simple attribute names (e.g.,
     * 'dataProductType'). Custom property paths look like 'extension.<propertyName>'.
     */
    fieldPath: string;
    /**
     * An optional field recommended for onboarding.
     */
    recommended?: boolean;
    /**
     * Whether this field must have a value before the entity can be created or updated.
     */
    required?: boolean;
}

/**
 * Whether a form field refers to a native entity attribute or a custom property defined via
 * the Type system.
 */
export enum FieldKind {
    CustomProperty = "customProperty",
    Native = "native",
}

export enum State {
    Blocked = "Blocked",
    Complete = "Complete",
    Failed = "Failed",
    NotApplicable = "NotApplicable",
    Pending = "Pending",
    Rejected = "Rejected",
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
