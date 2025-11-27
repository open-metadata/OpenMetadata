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
 * Create AI Governance Policy entity request
 */
export interface CreateAIGovernancePolicy {
    /**
     * Entities this policy applies to
     */
    appliesTo?: EntityReference[];
    /**
     * Bias detection thresholds
     */
    biasThresholds?: BiasThreshold;
    /**
     * Compliance and regulatory requirements
     */
    complianceRequirements?: ComplianceRequirement[];
    /**
     * Cost control thresholds and limits
     */
    costControls?: CostControl;
    /**
     * Data access control requirements
     */
    dataAccessControls?: DataAccessControl;
    /**
     * Description of the AI governance policy. Its requirements and scope.
     */
    description?: string;
    /**
     * Display Name that identifies this AI governance policy.
     */
    displayName?: string;
    /**
     * Fully qualified names of the domains the AI Governance Policy belongs to.
     */
    domains?: string[];
    /**
     * Whether this policy is currently active
     */
    enabled?: boolean;
    /**
     * How strictly the policy is enforced
     */
    enforcementLevel?: EnforcementLevel;
    /**
     * Entity extension data with custom attributes added to the entity.
     */
    extension?: any;
    /**
     * Name that identifies this AI governance policy.
     */
    name: string;
    /**
     * Owners of this AI Governance Policy
     */
    owners?: EntityReference[];
    /**
     * Performance and quality standards
     */
    performanceStandards?: PerformanceStandard;
    /**
     * Type of governance policy
     */
    policyType: PolicyType;
    /**
     * Policy rules and conditions
     */
    rules?: PolicyRule[];
    /**
     * Tags for this AI Governance Policy
     */
    tags?: TagLabel[];
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
 * Dataset to use for evaluation
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
 * Bias detection thresholds
 *
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
 * Cost control thresholds and limits
 *
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
 * Data access control requirements
 *
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
 * How strictly the policy is enforced
 */
export enum EnforcementLevel {
    Advisory = "Advisory",
    Blocking = "Blocking",
    Warning = "Warning",
}

/**
 * Performance and quality standards
 *
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

/**
 * Type of governance policy
 */
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
