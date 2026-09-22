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
export interface OnboardingInstance {
    bindings?: OnboardingTaskBinding[];
    /**
     * Playbook snapshot the asset was enrolled under.
     */
    configuration: OnboardingPlaybook;
    /**
     * updatedAt of the asset's version 0.1, captured at enrolment.
     */
    createdAt?: number;
    /**
     * Creation checks passed when enrolled or after revising a backfilled asset.
     */
    creationCompleted?: boolean;
    creator?:           EntityReference;
    enteredAt:          number;
    entity:             EntityReference;
    id:                 string;
    /**
     * Latest reminder per check and kind. The full log lives in onboarding_reminder.
     */
    reminders?:    OnboardingReminder[];
    revision:      number;
    stage:         string;
    stageHistory?: OnboardingStageTiming[];
    steps?:        OnboardingStepResult[];
}

export interface OnboardingTaskBinding {
    attempt: number;
    /**
     * Fingerprint of metadata covered by the approval.
     */
    fingerprint?: string;
    /**
     * When the stall policy reassigned this task. Assignee refreshes never revert it.
     */
    reassignedAt?: number;
    /**
     * When the playbook owners were told this task had stopped moving.
     */
    stallNotifiedAt?: number;
    /**
     * Stable step identifier.
     */
    stepId:                string;
    taskId:                string;
    workflowDefinitionId?: string;
}

/**
 * Playbook snapshot the asset was enrolled under.
 *
 * One playbook per asset type - the same rule intake forms already follow, so creation-time
 * enforcement has exactly one answer. Variation inside an asset type is handled by
 * conditions on individual checks, not by competing playbooks.
 */
export interface OnboardingPlaybook {
    /**
     * Change that led to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of the playbook.
     */
    description?: string;
    /**
     * Display Name that identifies this playbook.
     */
    displayName?: string;
    /**
     * The asset type this playbook governs. Only one playbook may exist per asset type.
     */
    entityType: TargetEntityType;
    /**
     * FullyQualifiedName of the playbook.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this entity.
     */
    href?: string;
    /**
     * Unique identifier of this playbook.
     */
    id: string;
    /**
     * Change that led to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Intake form migrated into this playbook's Creation gate. Retained so the legacy read path
     * keeps resolving.
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
     * Owners of this playbook - shown as `maintained by`.
     */
    owners?: EntityReference[];
    /**
     * Last update time corresponding to the new version of the entity in Unix epoch time
     * milliseconds.
     */
    updatedAt?: number;
    /**
     * User who made the update.
     */
    updatedBy?: string;
    /**
     * Metadata version of the entity.
     */
    version?: number;
}

/**
 * Change that led to this version of the entity.
 *
 * Description of the change.
 */
export interface ChangeDescription {
    changeSummary?: { [key: string]: ChangeSummary };
    /**
     * Names of fields added during the version changes.
     */
    fieldsAdded?: FieldChange[];
    /**
     * Fields deleted during the version changes with old value before deleted.
     */
    fieldsDeleted?: FieldChange[];
    /**
     * Fields modified during the version changes with old and new values.
     */
    fieldsUpdated?: FieldChange[];
    /**
     * When a change did not result in change, this could be same as the current version.
     */
    previousVersion?: number;
}

export interface ChangeSummary {
    changedAt?: number;
    /**
     * Name of the user or bot who made this change
     */
    changedBy?:    string;
    changeSource?: ChangeSource;
    [property: string]: any;
}

/**
 * The source of the change. This will change based on the context of the change (example:
 * manual vs programmatic)
 */
export enum ChangeSource {
    Automated = "Automated",
    Derived = "Derived",
    Ingested = "Ingested",
    Manual = "Manual",
    Propagated = "Propagated",
    Suggested = "Suggested",
}

export interface FieldChange {
    /**
     * Name of the entity field that changed.
     */
    name?: string;
    /**
     * New value of the field. Note that this is a JSON string and use the corresponding field
     * type to deserialize it.
     */
    newValue?: any;
    /**
     * Previous value of the field. Note that this is a JSON string and use the corresponding
     * field type to deserialize it.
     */
    oldValue?: any;
}

/**
 * The asset type this playbook governs. Only one playbook may exist per asset type.
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
 * Intake form migrated into this playbook's Creation gate. Retained so the legacy read path
 * keeps resolving.
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
 * Owners of this playbook - shown as `maintained by`.
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

/**
 * A follow-up sent about an onboarding check - by a person from the board, or by the
 * playbook's stall policy.
 */
export interface OnboardingReminder {
    kind:   ReminderKind;
    sentAt: number;
    /**
     * User who sent a manual reminder, or the bot that sent an automatic one.
     */
    sentBy?: string;
    /**
     * Check the reminder is about.
     */
    stepId?: string;
    taskId?: string;
}

export enum ReminderKind {
    Manual = "manual",
    SoftGateNotice = "softGateNotice",
    StallNotice = "stallNotice",
    StallReassignment = "stallReassignment",
}

export interface OnboardingStageTiming {
    enteredAt: number;
    exitedAt:  number;
    stage:     string;
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
