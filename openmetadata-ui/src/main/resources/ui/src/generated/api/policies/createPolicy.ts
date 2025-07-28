/*
 *  Copyright 2025 Collate.
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
 * Create Policy Entity Request
 */
export interface CreatePolicy {
    /**
     * A short description of the Policy, comprehensible to regular users.
     */
    description?: string;
    /**
     * Title for this Policy.
     */
    displayName?: string;
    /**
     * Fully qualified name of the domain the Table belongs to.
     */
    domain?: string;
    /**
     * Is the policy enabled.
     */
    enabled?: boolean;
    /**
     * UUID of Location where this policy is applied
     */
    location?: string;
    /**
     * Name that identifies this Policy.
     */
    name: string;
    /**
     * Owners of this Policy.
     */
    owners?: EntityReference[];
    rules:   Rule[];
}

/**
 * Owners of this Policy.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
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
 * A set of rules associated with the Policy.
 *
 * Describes an Access Control Rule for OpenMetadata Metadata Operations. All non-null user
 * (subject) and entity (object) attributes are evaluated with logical AND.
 */
export interface Rule {
    /**
     * Expression in SpEL used for matching of a `Rule` based on entity, resource, and
     * environmental attributes.
     */
    condition?: string;
    /**
     * Description of the rule.
     */
    description?: string;
    effect:       Effect;
    /**
     * FullyQualifiedName in the form `policyName.ruleName`.
     */
    fullyQualifiedName?: string;
    /**
     * Name of this Rule.
     */
    name: string;
    /**
     * List of operation names related to the `resources`. Use `*` to include all the operations.
     */
    operations: Operation[];
    /**
     * Resources/objects related to this rule. Resources are typically `entityTypes` such as
     * `table`, `database`, etc. It also includes `non-entityType` resources such as `lineage`.
     * Use `*` to include all the resources.
     */
    resources: string[];
}

export enum Effect {
    Allow = "allow",
    Deny = "deny",
}

/**
 * This schema defines all possible operations on metadata of entities in OpenMetadata.
 */
export enum Operation {
    All = "All",
    Create = "Create",
    CreateIngestionPipelineAutomator = "CreateIngestionPipelineAutomator",
    CreateScim = "CreateScim",
    Delete = "Delete",
    DeleteScim = "DeleteScim",
    DeleteTestCaseFailedRowsSample = "DeleteTestCaseFailedRowsSample",
    Deploy = "Deploy",
    EditAll = "EditAll",
    EditCertification = "EditCertification",
    EditCustomFields = "EditCustomFields",
    EditDataProfile = "EditDataProfile",
    EditDescription = "EditDescription",
    EditDisplayName = "EditDisplayName",
    EditEntityRelationship = "EditEntityRelationship",
    EditGlossaryTerms = "EditGlossaryTerms",
    EditIngestionPipelineStatus = "EditIngestionPipelineStatus",
    EditKnowledgePanel = "EditKnowledgePanel",
    EditLifeCycle = "EditLifeCycle",
    EditLineage = "EditLineage",
    EditOwners = "EditOwners",
    EditPage = "EditPage",
    EditPolicy = "EditPolicy",
    EditQueries = "EditQueries",
    EditReviewers = "EditReviewers",
    EditRole = "EditRole",
    EditSampleData = "EditSampleData",
    EditScim = "EditScim",
    EditStatus = "EditStatus",
    EditTags = "EditTags",
    EditTeams = "EditTeams",
    EditTests = "EditTests",
    EditTier = "EditTier",
    EditUsage = "EditUsage",
    EditUsers = "EditUsers",
    GenerateToken = "GenerateToken",
    Kill = "Kill",
    Trigger = "Trigger",
    ViewAll = "ViewAll",
    ViewBasic = "ViewBasic",
    ViewDataProfile = "ViewDataProfile",
    ViewProfilerGlobalConfiguration = "ViewProfilerGlobalConfiguration",
    ViewQueries = "ViewQueries",
    ViewSampleData = "ViewSampleData",
    ViewScim = "ViewScim",
    ViewTestCaseFailedRowsSample = "ViewTestCaseFailedRowsSample",
    ViewTests = "ViewTests",
    ViewUsage = "ViewUsage",
}
