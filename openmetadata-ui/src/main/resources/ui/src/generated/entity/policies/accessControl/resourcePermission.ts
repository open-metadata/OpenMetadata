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
 * A set of permissions for a user that shows what operation is denied, allowed, or not
 * allowed for all the resources.
 */
export interface ResourcePermission {
    /**
     * Permissions for a `resource`.
     */
    permissions: Permission[];
    /**
     * Name of the resource
     */
    resource: string;
}

export interface Permission {
    /**
     * Access decided after evaluating rules in a policy. Note the access is defined in the
     * order of precedence.
     */
    access?: Access;
    /**
     * Operation names related to the `resource`.
     */
    operation?: Operation;
    /**
     * Name of the policy where the `rule` is from.
     */
    policy?: string;
    /**
     * Name of the role where the `policy` is from. If this is not role based policy, `role` is
     * set to null
     */
    role?: string;
    /**
     * Rule that matches the resource and the operation that decided the `access` as `allow` or
     * `deny`. When no rule matches, the `access` is set to `notAllow`. When access can't be
     * determined because all information required to match the `condition` in the rule,
     * `access` is set to `conditional`.
     */
    rule?: Rule;
}

/**
 * Access decided after evaluating rules in a policy. Note the access is defined in the
 * order of precedence.
 */
export enum Access {
    Allow = "allow",
    ConditionalAllow = "conditionalAllow",
    ConditionalDeny = "conditionalDeny",
    Deny = "deny",
    NotAllow = "notAllow",
}

/**
 * Operation names related to the `resource`.
 *
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

/**
 * Rule that matches the resource and the operation that decided the `access` as `allow` or
 * `deny`. When no rule matches, the `access` is set to `notAllow`. When access can't be
 * determined because all information required to match the `condition` in the rule,
 * `access` is set to `conditional`.
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
