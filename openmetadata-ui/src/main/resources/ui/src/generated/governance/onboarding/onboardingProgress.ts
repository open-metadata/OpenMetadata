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
export interface OnboardingProgress {
    blockingSteps:         string[];
    canAdvance:            boolean;
    completed?:            boolean;
    configurationId?:      string;
    configurationVersion?: number;
    domains?:              EntityReference[];
    enteredAt?:            number;
    entity?:               EntityReference;
    entityVersion?:        number;
    nextStatus?:           EntityStatus;
    paused?:               boolean;
    stage:                 OnboardingStage;
    steps:                 OnboardingStepResult[];
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

/**
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

export enum OnboardingStage {
    Approved = "Approved",
    Creation = "Creation",
    Deprecated = "Deprecated",
    Draft = "Draft",
    InReview = "In Review",
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
