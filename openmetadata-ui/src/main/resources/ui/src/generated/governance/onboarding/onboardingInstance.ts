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
    bindings?:     OnboardingTaskBinding[];
    configuration: IntakeForm;
    /**
     * Creation checks passed when enrolled or after revising a backfilled asset.
     */
    creationCompleted?: boolean;
    creator?:           EntityReference;
    enteredAt:          number;
    entity:             EntityReference;
    id:                 string;
    revision:           number;
    stage:              OnboardingStage;
    stageHistory?:      OnboardingStageTiming[];
    steps?:             OnboardingStepResult[];
}

export interface OnboardingTaskBinding {
    approved?:  boolean;
    attempt:    number;
    decidedAt?: number;
    /**
     * Fingerprint of metadata covered by the approval.
     */
    fingerprint?: string;
    /**
     * Stable step identifier.
     */
    stepId:                string;
    taskId:                string;
    workflowDefinitionId?: string;
    workflowInstanceId?:   string;
}

/**
 * One intake and onboarding configuration per governance entity type. Field requirements
 * are shared by creation forms and lifecycle gates.
 */
export interface IntakeForm {
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of what governance policy this IntakeForm enforces.
     */
    description?: string;
    /**
     * Name used for display purposes.
     */
    displayName?: string;
    /**
     * Whether this IntakeForm is currently enforced. Disabling is a soft toggle that lets
     * admins pause validation without deleting the form.
     */
    enabled?: boolean;
    /**
     * The entity type this IntakeForm applies to. Only one IntakeForm may exist per entityType.
     */
    entityType: TargetEntityType;
    /**
     * Fields included in this IntakeForm. Fields with required=true are enforced on top of the
     * schema-required fields.
     */
    formFields?: IntakeFormField[];
    /**
     * Fully qualified name of the IntakeForm.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this entity.
     */
    href?: string;
    /**
     * Unique ID of the IntakeForm.
     */
    id: string;
    /**
     * Incremental change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Unique name of the IntakeForm.
     */
    name:        string;
    onboarding?: OnboardingConfiguration;
    /**
     * Owners of this IntakeForm configuration.
     */
    owners?: EntityReference[];
    /**
     * Deprecated compatibility view of the required entries in formFields.
     */
    requiredFields?: RequiredField[];
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
 * Change that lead to this version of the entity.
 *
 * Description of the change.
 *
 * Incremental change that lead to this version of the entity.
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
 * The entity type this IntakeForm applies to. Only one IntakeForm may exist per
 * entityType.
 *
 * Entity types supported by IntakeForm today.
 */
export enum TargetEntityType {
    DataProduct = "dataProduct",
    Domain = "domain",
    GlossaryTerm = "glossaryTerm",
    Metric = "metric",
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
 *
 * Whether a required field refers to a native entity attribute or a custom property defined
 * via the Type system.
 */
export enum FieldKind {
    CustomProperty = "customProperty",
    Native = "native",
}

export interface OnboardingConfiguration {
    enabled?: boolean;
    gates?:   OnboardingGate[];
}

export interface OnboardingGate {
    stage: OnboardingStage;
    steps: OnboardingStep[];
}

export enum OnboardingStage {
    Approved = "Approved",
    Creation = "Creation",
    Deprecated = "Deprecated",
    Draft = "Draft",
    InReview = "In Review",
}

export interface OnboardingStep {
    assignment?: OnboardingAssignment;
    conditions?: OnboardingCondition[];
    /**
     * Reference to formFields; requiredness is defined there.
     */
    fieldPath?: string;
    /**
     * Instructions for the person completing this step.
     */
    guidance?: string;
    id:        string;
    rules?:    OnboardingRules;
    /**
     * Step display name.
     */
    title?:    string;
    type:      Type;
    workflow?: EntityReference;
}

export interface OnboardingAssignment {
    assignees?: EntityReference[];
    role?:      Role;
}

/**
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Owners of this IntakeForm configuration.
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

export enum Role {
    Creator = "creator",
    DomainOwners = "domainOwners",
    Experts = "experts",
    Explicit = "explicit",
    Owners = "owners",
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
}

export interface OnboardingRules {
    minItems?:  number;
    minLength?: number;
}

export enum Type {
    Approval = "approval",
    Field = "field",
}

/**
 * A single field declared as required by this IntakeForm.
 */
export interface RequiredField {
    /**
     * Optional override for the validation error message when this field is missing.
     */
    errorMessage?: string;
    fieldKind:     FieldKind;
    /**
     * Human-friendly label used in validation error messages and on the intake form UI.
     */
    fieldLabel: string;
    /**
     * Path to the field on the entity. Native paths are simple attribute names (e.g.,
     * 'dataProductType'). Custom property paths look like 'extension.<propertyName>'.
     */
    fieldPath: string;
}

export interface OnboardingStageTiming {
    enteredAt: number;
    exitedAt:  number;
    stage:     OnboardingStage;
}

export interface OnboardingStepResult {
    assignees?: EntityReference[];
    field?:     IntakeFormField;
    /**
     * Explanation of an incomplete check.
     */
    message?:            string;
    required:            boolean;
    stage?:              OnboardingStage;
    state:               State;
    step:                OnboardingStep;
    taskId?:             string;
    workflowInstanceId?: string;
}

export enum State {
    Blocked = "Blocked",
    Complete = "Complete",
    Failed = "Failed",
    NotApplicable = "NotApplicable",
    Pending = "Pending",
    Rejected = "Rejected",
}
