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
 * AI Governance Policy entity representing organizational policies and rules for AI/LLM
 * usage, compliance, and risk management. Enforces standards for model approval, data
 * access, bias thresholds, and regulatory compliance.
 */
export interface AIGovernancePolicy {
    /**
     * Entities this policy applies to
     */
    appliesTo?: EntityReference[];
    /**
     * Who approved this policy
     */
    approvedBy?:     string;
    biasThresholds?: BiasThreshold;
    /**
     * Change that led to this version
     */
    changeDescription?: ChangeDescription;
    /**
     * Compliance requirements this policy enforces
     */
    complianceRequirements?: ComplianceRequirement[];
    costControls?:           CostControl;
    dataAccessControls?:     DataAccessControl;
    /**
     * When true, indicates the entity has been soft deleted
     */
    deleted?: boolean;
    /**
     * Description of the policy and its purpose
     */
    description?: string;
    /**
     * Display name for the AI Governance Policy
     */
    displayName?: string;
    /**
     * Domain the policy belongs to
     */
    domain?: EntityReference;
    /**
     * Domains the policy belongs to
     */
    domains?: EntityReference[];
    /**
     * Date when policy becomes effective
     */
    effectiveDate?: number;
    /**
     * Whether this policy is currently active
     */
    enabled?: boolean;
    /**
     * How strictly to enforce this policy
     */
    enforcementLevel?: EnforcementLevel;
    /**
     * Date when policy expires
     */
    expirationDate?: number;
    /**
     * Entity extension data with custom attributes
     */
    extension?: any;
    /**
     * Followers of this AI Governance Policy
     */
    followers?: EntityReference[];
    /**
     * Fully qualified name of the AI Governance Policy
     */
    fullyQualifiedName?: string;
    /**
     * Link to this resource
     */
    href?: string;
    /**
     * Unique identifier of the AI Governance Policy
     */
    id: string;
    /**
     * Change that led to this version
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Life Cycle properties of the entity
     */
    lifeCycle?: LifeCycle;
    /**
     * Name that identifies this AI Governance Policy
     */
    name: string;
    /**
     * Owners of this AI Governance Policy
     */
    owners?:               EntityReference[];
    performanceStandards?: PerformanceStandard;
    policyType:            PolicyType;
    /**
     * Rules that make up this policy
     */
    rules?: PolicyRule[];
    /**
     * Source hash of the entity
     */
    sourceHash?: string;
    /**
     * Tags for this AI Governance Policy
     */
    tags?: TagLabel[];
    /**
     * Last update time in Unix epoch milliseconds
     */
    updatedAt?: number;
    /**
     * User who made the update
     */
    updatedBy?: string;
    /**
     * Metadata version of the entity
     */
    version?: number;
    /**
     * Recent policy violations
     */
    violations?: PolicyViolation[];
    /**
     * Votes on the entity
     */
    votes?: Votes;
}

/**
 * Entities this policy applies to
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
 *
 * Domain the policy belongs to
 *
 * User, Pipeline, Query that created,updated or accessed the data asset
 *
 * Dataset to use for evaluation
 *
 * Entity that violated the policy
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
 * Bias threshold limits for LLM models
 */
export interface BiasThreshold {
    /**
     * Maximum bias scores per dimension
     */
    dimensionThresholds?: DimensionThresholds;
    /**
     * How often to evaluate bias
     */
    evaluationFrequency?: EvaluationFrequency;
    /**
     * Maximum allowed overall bias score (0-1)
     */
    maxOverallBiasScore?: number;
}

/**
 * Maximum bias scores per dimension
 */
export interface DimensionThresholds {
    age?:           number;
    disability?:    number;
    gender?:        number;
    nationality?:   number;
    race?:          number;
    religion?:      number;
    socioeconomic?: number;
    [property: string]: any;
}

/**
 * How often to evaluate bias
 */
export enum EvaluationFrequency {
    Continuous = "Continuous",
    Daily = "Daily",
    Monthly = "Monthly",
    OnDemand = "OnDemand",
    Weekly = "Weekly",
}

/**
 * Change that led to this version
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
 * Regulatory compliance requirement
 */
export interface ComplianceRequirement {
    /**
     * Whether attestation is required
     */
    attestationRequired?: boolean;
    auditFrequency?:      AuditFrequency;
    /**
     * Specific requirements
     */
    requirements?: string[];
    /**
     * Compliance standard
     */
    standard?: Standard;
}

export enum AuditFrequency {
    Annually = "Annually",
    Continuous = "Continuous",
    Monthly = "Monthly",
    Quarterly = "Quarterly",
    Weekly = "Weekly",
}

/**
 * Compliance standard
 */
export enum Standard {
    Custom = "Custom",
    EUAIAct = "EU_AI_Act",
    Gdpr = "GDPR",
    Hipaa = "HIPAA",
    Iso27001 = "ISO27001",
    NISTAIRmf = "NIST_AI_RMF",
    OWASPLLMTop10 = "OWASP_LLM_Top10",
    Soc2 = "SOC2",
}

/**
 * Cost control limits
 */
export interface CostControl {
    currency?: string;
    /**
     * Maximum daily spend in USD
     */
    dailyBudget?: number;
    /**
     * Maximum monthly spend in USD
     */
    monthlyBudget?: number;
    /**
     * Maximum cost per execution
     */
    perExecutionLimit?: number;
    /**
     * Percentage threshold for warnings (0-100)
     */
    warningThreshold?: number;
}

/**
 * Data access controls for AI agents
 */
export interface DataAccessControl {
    /**
     * Allowed data sources
     */
    allowedDataSources?: EntityReference[];
    /**
     * How long execution data can be retained
     */
    dataRetentionDays?: number;
    /**
     * Maximum data sensitivity level allowed
     */
    maxSensitivityLevel?: MaxSensitivityLevel;
    /**
     * Whether PII data access is allowed
     */
    piiAccessAllowed?: boolean;
    /**
     * Prohibited data sources
     */
    prohibitedDataSources?:           EntityReference[];
    requireApprovalForSensitiveData?: boolean;
}

/**
 * Maximum data sensitivity level allowed
 */
export enum MaxSensitivityLevel {
    Confidential = "Confidential",
    Internal = "Internal",
    Public = "Public",
    Restricted = "Restricted",
}

/**
 * How strictly to enforce this policy
 */
export enum EnforcementLevel {
    Advisory = "Advisory",
    Blocking = "Blocking",
    Warning = "Warning",
}

/**
 * Life Cycle properties of the entity
 *
 * This schema defines Life Cycle Properties.
 */
export interface LifeCycle {
    /**
     * Access Details about accessed aspect of the data asset
     */
    accessed?: AccessDetails;
    /**
     * Access Details about created aspect of the data asset
     */
    created?: AccessDetails;
    /**
     * Access Details about updated aspect of the data asset
     */
    updated?: AccessDetails;
}

/**
 * Access Details about accessed aspect of the data asset
 *
 * Access details of an entity
 *
 * Access Details about created aspect of the data asset
 *
 * Access Details about updated aspect of the data asset
 */
export interface AccessDetails {
    /**
     * User, Pipeline, Query that created,updated or accessed the data asset
     */
    accessedBy?: EntityReference;
    /**
     * Any process that accessed the data asset that is not captured in OpenMetadata.
     */
    accessedByAProcess?: string;
    /**
     * Timestamp of data asset accessed for creation, update, read.
     */
    timestamp: number;
}

/**
 * Performance standards for AI agents
 */
export interface PerformanceStandard {
    /**
     * Dataset to use for evaluation
     */
    evaluationDataset?: EntityReference;
    /**
     * Maximum error rate (0-1)
     */
    maxErrorRate?: number;
    /**
     * Maximum allowed latency in milliseconds
     */
    maxLatencyMs?: number;
    /**
     * Minimum required accuracy (0-1)
     */
    minAccuracy?: number;
    /**
     * Minimum success rate (0-1)
     */
    minSuccessRate?: number;
}

export enum PolicyType {
    BiasThreshold = "BiasThreshold",
    ComplianceCheck = "ComplianceCheck",
    CostControl = "CostControl",
    DataAccess = "DataAccess",
    ModelApproval = "ModelApproval",
    PerformanceStandard = "PerformanceStandard",
    SecurityControl = "SecurityControl",
}

/**
 * Individual rule within a governance policy
 */
export interface PolicyRule {
    /**
     * Action to take when rule is triggered
     */
    action: Action;
    /**
     * Condition expression (e.g., 'biasScore > 0.3')
     */
    condition?: string;
    /**
     * Rule description
     */
    description?: string;
    enabled?:     boolean;
    /**
     * Rule name
     */
    name: string;
    /**
     * Type of rule
     */
    ruleType:  RuleType;
    severity?: Severity;
}

/**
 * Action to take when rule is triggered
 */
export enum Action {
    Block = "Block",
    Log = "Log",
    Notify = "Notify",
    RequireApproval = "Require_Approval",
    Warn = "Warn",
}

/**
 * Type of rule
 */
export enum RuleType {
    Approval = "Approval",
    Notification = "Notification",
    Prohibition = "Prohibition",
    Requirement = "Requirement",
    Threshold = "Threshold",
}

export enum Severity {
    Critical = "Critical",
    High = "High",
    Low = "Low",
    Medium = "Medium",
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 */
export interface TagLabel {
    /**
     * Description for the tag label.
     */
    description?: string;
    /**
     * Display Name that identifies this tag.
     */
    displayName?: string;
    /**
     * Link to the tag resource.
     */
    href?: string;
    /**
     * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
     * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
     * relationship (see Classification.json for more details). 'Propagated` indicates a tag
     * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
     * used to determine the tag label.
     */
    labelType: LabelType;
    /**
     * Name of the tag or glossary term.
     */
    name?: string;
    /**
     * An explanation of why this tag was proposed, specially for autoclassification tags
     */
    reason?: string;
    /**
     * Label is from Tags or Glossary.
     */
    source: TagSource;
    /**
     * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
     * entity must confirm the suggested labels before it is marked as 'Confirmed'.
     */
    state:  State;
    style?: Style;
    tagFQN: string;
}

/**
 * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
 * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
 * relationship (see Classification.json for more details). 'Propagated` indicates a tag
 * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
 * used to determine the tag label.
 */
export enum LabelType {
    Automated = "Automated",
    Derived = "Derived",
    Generated = "Generated",
    Manual = "Manual",
    Propagated = "Propagated",
}

/**
 * Label is from Tags or Glossary.
 */
export enum TagSource {
    Classification = "Classification",
    Glossary = "Glossary",
}

/**
 * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
 * entity must confirm the suggested labels before it is marked as 'Confirmed'.
 */
export enum State {
    Confirmed = "Confirmed",
    Suggested = "Suggested",
}

/**
 * UI Style is used to associate a color code and/or icon to entity to customize the look of
 * that entity in UI.
 */
export interface Style {
    /**
     * Hex Color Code to mark an entity such as GlossaryTerm, Tag, Domain or Data Product.
     */
    color?: string;
    /**
     * Cover image configuration for the entity.
     */
    coverImage?: CoverImage;
    /**
     * An icon to associate with GlossaryTerm, Tag, Domain or Data Product.
     */
    iconURL?: string;
}

/**
 * Cover image configuration for the entity.
 *
 * Cover image configuration for an entity. This is used to display a banner or header image
 * for entities like Domain, Glossary, Data Product, etc.
 */
export interface CoverImage {
    /**
     * Position of the cover image in CSS background-position format. Supports keywords (top,
     * center, bottom) or pixel values (e.g., '20px 30px').
     */
    position?: string;
    /**
     * URL of the cover image.
     */
    url?: string;
}

/**
 * Policy violation record
 */
export interface PolicyViolation {
    /**
     * Details about the violation
     */
    details?:    string;
    resolved?:   boolean;
    resolvedAt?: number;
    resolvedBy?: string;
    timestamp?:  number;
    /**
     * Name of the violated rule
     */
    violatedRule?: string;
    /**
     * Entity that violated the policy
     */
    violatingEntity?: EntityReference;
}

/**
 * Votes on the entity
 *
 * This schema defines the Votes for a Data Asset.
 */
export interface Votes {
    /**
     * List of all the Users who downVoted
     */
    downVoters?: EntityReference[];
    /**
     * Total down-votes the entity has
     */
    downVotes?: number;
    /**
     * List of all the Users who upVoted
     */
    upVoters?: EntityReference[];
    /**
     * Total up-votes the entity has
     */
    upVotes?: number;
}
