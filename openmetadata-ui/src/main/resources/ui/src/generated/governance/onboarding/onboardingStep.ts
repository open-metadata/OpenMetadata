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
