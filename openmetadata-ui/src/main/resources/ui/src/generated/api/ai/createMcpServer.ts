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
 * Create MCP Server entity request
 */
export interface CreateMCPServer {
    /**
     * Capabilities supported by the MCP server
     */
    capabilities?: ServerCapabilities;
    /**
     * Connection configuration for the MCP server
     */
    connectionConfig?: ConnectionConfig;
    /**
     * Summary of data access patterns
     */
    dataAccessSummary?: DataAccessSummary;
    /**
     * List of fully qualified names of data products this entity is part of.
     */
    dataProducts?: string[];
    /**
     * Deployment endpoint URL
     */
    deploymentUrl?: string;
    /**
     * Description of the MCP Server, its purpose, and capabilities.
     */
    description?: string;
    /**
     * Development stage of the MCP server
     */
    developmentStage?: DevelopmentStage;
    /**
     * Display Name that identifies this MCP Server.
     */
    displayName?: string;
    /**
     * Link to external documentation
     */
    documentation?: string;
    /**
     * Fully qualified names of the domains the MCP Server belongs to.
     */
    domains?: string[];
    /**
     * Entity extension data with custom attributes added to the entity.
     */
    extension?: any;
    /**
     * Governance and compliance metadata
     */
    governanceMetadata?: GovernanceMetadata;
    /**
     * Name that identifies this MCP Server.
     */
    name: string;
    /**
     * Owners of this MCP Server
     */
    owners?: EntityReference[];
    /**
     * Prompt templates exposed by this MCP Server
     */
    prompts?: MCPPrompt[];
    /**
     * MCP protocol version supported by this server
     */
    protocolVersion?: string;
    /**
     * Resources exposed by this MCP Server
     */
    resources?: MCPResource[];
    /**
     * Security metrics and settings
     */
    securityMetrics?: SecurityMetrics;
    /**
     * Information about the MCP server software
     */
    serverInfo?: ServerInfo;
    /**
     * Type of MCP server based on its primary function
     */
    serverType: ServerType;
    /**
     * Link to source code repository
     */
    sourceCode?: string;
    /**
     * Tags for this MCP Server
     */
    tags?: TagLabel[];
    /**
     * Tools exposed by this MCP Server
     */
    tools?: MCPTool[];
    /**
     * Transport protocol used by the MCP server
     */
    transportType?: TransportType;
}

/**
 * Capabilities supported by the MCP server
 */
export interface ServerCapabilities {
    /**
     * Whether the server supports logging
     */
    loggingSupported?: boolean;
    /**
     * Whether the server supports prompts
     */
    promptsSupported?: boolean;
    /**
     * Whether the server supports resources
     */
    resourcesSupported?: boolean;
    /**
     * Whether the server supports roots
     */
    rootsSupported?: boolean;
    /**
     * Whether the server supports sampling
     */
    samplingSupported?: boolean;
    /**
     * Whether the server supports tools
     */
    toolsSupported?: boolean;
}

/**
 * Connection configuration for the MCP server
 */
export interface ConnectionConfig {
    /**
     * Arguments to pass to the server command
     */
    args?: string[];
    /**
     * Command to start the MCP server
     */
    command?: string;
    /**
     * Environment variables for the server
     */
    env?: { [key: string]: string };
    /**
     * Number of retry attempts on connection failure
     */
    retryAttempts?: number;
    /**
     * Connection timeout in milliseconds
     */
    timeout?: number;
    /**
     * URL for SSE or Streamable transport servers
     */
    url?: string;
    /**
     * Working directory for the server process
     */
    workingDirectory?: string;
}

/**
 * Summary of data access patterns
 *
 * Summary of data access patterns for this MCP server
 */
export interface DataAccessSummary {
    /**
     * Types of access patterns
     */
    accessPatterns?: AccessPattern[];
    /**
     * Whether this server accesses databases
     */
    databaseAccess?: boolean;
    /**
     * Data sources accessed by this server
     */
    dataSources?: EntityReference[];
    /**
     * Whether this server accesses external APIs
     */
    externalApiAccess?: boolean;
    /**
     * Whether this server accesses the file system
     */
    fileSystemAccess?: boolean;
    /**
     * Whether this server requires network access
     */
    networkAccess?: boolean;
    /**
     * Whether this server accesses PII data
     */
    piiAccess?: boolean;
    /**
     * Highest sensitivity level of data accessed
     */
    sensitivityLevel?: SensitivityLevel;
}

export enum AccessPattern {
    Execute = "Execute",
    Read = "Read",
    Write = "Write",
}

/**
 * Data sources accessed by this server
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
 * Reference to the underlying data entity if known
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
 * Highest sensitivity level of data accessed
 *
 * Sensitivity level of data
 */
export enum SensitivityLevel {
    Confidential = "Confidential",
    Internal = "Internal",
    Public = "Public",
    Restricted = "Restricted",
}

/**
 * Development stage of the MCP server
 *
 * Development stage of the MCP server. 'Unauthorized' indicates Shadow AI that needs
 * governance review.
 */
export enum DevelopmentStage {
    Deprecated = "Deprecated",
    Development = "Development",
    Production = "Production",
    Proposal = "Proposal",
    Staging = "Staging",
    Testing = "Testing",
    Unauthorized = "Unauthorized",
}

/**
 * Governance and compliance metadata
 *
 * Governance metadata for compliance and risk management of the MCP server
 */
export interface GovernanceMetadata {
    /**
     * AI compliance assessments for various regulatory frameworks (EU AI Act, NIST AI RMF, etc.)
     */
    aiCompliance?: AICompliance;
    /**
     * Comments from governance council on approval/rejection decision
     */
    approvalComments?: string;
    /**
     * Timestamp when the server was approved
     */
    approvedAt?: number;
    /**
     * User who approved the server
     */
    approvedBy?: string;
    /**
     * Classification of data accessed by this server
     */
    dataClassification?: GovernanceMetadataDataClassification;
    /**
     * Governance policies applied to this server
     */
    governancePolicies?: EntityReference[];
    /**
     * Notes from AI governance intake form or review process
     */
    intakeNotes?: string;
    /**
     * Timestamp when the server was registered
     */
    registeredAt?: number;
    /**
     * User who registered the server
     */
    registeredBy?: string;
    /**
     * Registration status - used to track Shadow AI
     */
    registrationStatus?: RegistrationStatus;
    /**
     * Risk assessment for this MCP server
     */
    riskAssessment?: RiskAssessment;
}

/**
 * AI compliance assessments for various regulatory frameworks (EU AI Act, NIST AI RMF,
 * etc.)
 *
 * Reusable AI compliance and regulatory framework assessments. Can be applied to AI
 * Applications, LLM Models, MCP Servers, and other AI entities.
 */
export interface AICompliance {
    /**
     * List of compliance assessments for different frameworks
     */
    complianceRecords?: AIComplianceRecord[];
    [property: string]: any;
}

/**
 * Single compliance record for a specific framework
 */
export interface AIComplianceRecord {
    /**
     * When the assessment was performed
     */
    assessedAt?: number;
    /**
     * Person or team who performed the assessment
     */
    assessedBy?: string;
    /**
     * Ethical AI assessment applicable to most frameworks
     */
    ethicalAssessment?: EthicalAIAssessment;
    /**
     * EU AI Act specific assessment (only when framework is EU_AI_Act)
     */
    euAIAct?:  EuAIActCompliance;
    framework: ComplianceFramework;
    /**
     * When the next compliance review is due
     */
    nextReviewDate?: number;
    /**
     * Additional notes and findings from compliance assessment
     */
    notes?: string;
    /**
     * List of remediation actions required for compliance
     */
    remediationRequired?: string[];
    /**
     * Deployment scope relevant to compliance jurisdiction
     */
    scopeAndDeployment?: ScopeAndDeployment;
    /**
     * Compliance status
     */
    status: Status;
    /**
     * Verification and certification status
     */
    verification?: Verification;
}

/**
 * Ethical AI assessment applicable to most frameworks
 *
 * Ethical AI framework assessment covering privacy, fairness, transparency, accountability,
 * and environmental impact
 */
export interface EthicalAIAssessment {
    /**
     * Accountability measures in place
     */
    accountabilityMeasures?: AccountabilityMeasures;
    /**
     * Coverage of bias mitigation measures
     */
    biasMitigationCoverage?: BiasMitigationCoverage;
    /**
     * Environmental impact risk level (carbon footprint, energy consumption)
     */
    environmentalConsciousness?: EnvironmentalConsciousness;
    /**
     * Risk level for fairness and discrimination
     */
    fairnessRisk?: FairnessRisk;
    /**
     * Level of privacy-sensitive data accessed
     */
    privacyLevel?: PrivacyLevel;
    /**
     * Risk level for reliability and safety
     */
    reliabilitySafetyRisk?: ReliabilitySafetyRisk;
    /**
     * Level of transparency in AI operations
     */
    transparencyLevel?: TransparencyLevel;
}

/**
 * Accountability measures in place
 */
export interface AccountabilityMeasures {
    /**
     * Comprehensive audit trail enabled
     */
    auditTrailEnabled?: boolean;
    /**
     * Has designated owner responsible for AI system
     */
    hasOwner?: boolean;
    /**
     * Subject to human oversight and intervention
     */
    subjectToHumanOversight?: boolean;
    [property: string]: any;
}

/**
 * Coverage of bias mitigation measures
 */
export enum BiasMitigationCoverage {
    Full = "Full",
    None = "None",
    Partial = "Partial",
}

/**
 * Environmental impact risk level (carbon footprint, energy consumption)
 */
export enum EnvironmentalConsciousness {
    HighRisk = "HighRisk",
    LowRisk = "LowRisk",
    MediumRisk = "MediumRisk",
}

/**
 * Risk level for fairness and discrimination
 */
export enum FairnessRisk {
    High = "High",
    Low = "Low",
    Medium = "Medium",
}

/**
 * Level of privacy-sensitive data accessed
 */
export enum PrivacyLevel {
    PersonalData = "PersonalData",
    Public = "Public",
    Sensitive = "Sensitive",
}

/**
 * Risk level for reliability and safety
 */
export enum ReliabilitySafetyRisk {
    High = "High",
    Low = "Low",
    Moderate = "Moderate",
}

/**
 * Level of transparency in AI operations
 */
export enum TransparencyLevel {
    FullDisclosure = "FullDisclosure",
    None = "None",
    Partial = "Partial",
}

/**
 * EU AI Act specific assessment (only when framework is EU_AI_Act)
 *
 * EU AI Act compliance assessment (Regulation EU 2024/1689)
 */
export interface EuAIActCompliance {
    /**
     * Conformity assessment status
     */
    conformityAssessment?: ConformityAssessment;
    /**
     * Article 6 high-risk AI systems assessment
     */
    highRiskSystems?: HighRiskSystems;
    /**
     * Article 5 prohibited AI practices assessment
     */
    prohibitedPractices?: ProhibitedPractices;
    /**
     * Risk classification under EU AI Act
     */
    riskClassification?: RiskClassification;
    /**
     * Rationale for the risk classification
     */
    riskRationale?: string;
    /**
     * Article 50 transparency obligations
     */
    transparencyObligations?: TransparencyObligations;
}

/**
 * Conformity assessment status
 */
export interface ConformityAssessment {
    /**
     * Name of notified body performing assessment
     */
    assessmentBody?: string;
    /**
     * Whether conformity assessment is required
     */
    assessmentRequired?: boolean;
    /**
     * Type of conformity assessment
     */
    assessmentType?: AssessmentType;
    /**
     * Certificate number if issued
     */
    certificateNumber?: string;
    /**
     * Certificate validity date
     */
    validUntil?: number;
    [property: string]: any;
}

/**
 * Type of conformity assessment
 */
export enum AssessmentType {
    Internal = "Internal",
    NotRequired = "NotRequired",
    ThirdParty = "ThirdParty",
}

/**
 * Article 6 high-risk AI systems assessment
 */
export interface HighRiskSystems {
    /**
     * Annex III(8): Administration of justice and democratic processes
     */
    administrationOfJustice?: boolean;
    /**
     * Annex III(1): Critical infrastructure (transport, water, gas, electricity, etc.)
     */
    criticalInfrastructure?: boolean;
    /**
     * Annex III(3): Education and vocational training
     */
    educationVocationalTraining?: boolean;
    /**
     * Annex III(4): Employment, workers management, and access to self-employment
     */
    employment?: boolean;
    /**
     * Annex III(5): Access to essential private services (credit, insurance, etc.)
     */
    essentialPrivateServices?: boolean;
    /**
     * Annex III(6): Law enforcement
     */
    essentialPublicServices?: boolean;
    /**
     * Annex III(6): Law enforcement purposes
     */
    lawEnforcement?: boolean;
    /**
     * Annex III(7): Migration, asylum, and border control management
     */
    migrationAsylumBorderControl?: boolean;
    [property: string]: any;
}

/**
 * Article 5 prohibited AI practices assessment
 */
export interface ProhibitedPractices {
    /**
     * Art 5(1)(g): Biometric categorisation inferring sensitive attributes
     */
    biometricCategorisation?: boolean;
    /**
     * Art 5(1)(f): Emotion recognition in workplace and education
     */
    emotionInferenceWorkplaceEducation?: boolean;
    /**
     * Art 5(1)(b): Exploitation of vulnerabilities due to age, disability, or social/economic
     * situation
     */
    exploitationOfVulnerabilities?: boolean;
    /**
     * Art 5(1)(e): Untargeted scraping of facial images for facial recognition databases
     */
    facialRecognitionDatabaseCreation?: boolean;
    /**
     * Art 5(1)(h): Real-time remote biometric identification in public spaces by law enforcement
     */
    realTimeBiometricIdentification?: boolean;
    /**
     * Art 5(1)(d): Risk assessment based solely on profiling for predicting criminal offences
     */
    riskAssessmentCriminalOffences?: boolean;
    /**
     * Art 5(1)(c): Social scoring by public authorities
     */
    socialScoringSystem?: boolean;
    /**
     * Art 5(1)(a): Subliminal techniques beyond person's consciousness
     */
    subliminalManipulativeTechniques?: boolean;
    [property: string]: any;
}

/**
 * Risk classification under EU AI Act
 */
export enum RiskClassification {
    High = "High",
    Limited = "Limited",
    Minimal = "Minimal",
    Unacceptable = "Unacceptable",
}

/**
 * Article 50 transparency obligations
 */
export interface TransparencyObligations {
    /**
     * AI-generated content is appropriately labeled
     */
    deepfakeLabeling?: boolean;
    /**
     * Emotion recognition or biometric categorization disclosed
     */
    emotionRecognitionDisclosure?: boolean;
    /**
     * Users are informed they are interacting with AI
     */
    usersInformed?: boolean;
    [property: string]: any;
}

/**
 * Type of AI compliance framework
 */
export enum ComplianceFramework {
    CanadaAIDA = "Canada_AIDA",
    ChinaAIRegulations = "China_AI_Regulations",
    Custom = "Custom",
    EUAIAct = "EU_AI_Act",
    ISOIEC42001 = "ISO_IEC_42001",
    NISTAIRmf = "NIST_AI_RMF",
    SingaporeModelAIGovernance = "Singapore_Model_AI_Governance",
    UKAIRegulation = "UK_AI_Regulation",
    USAIBillOfRights = "US_AI_Bill_of_Rights",
}

/**
 * Deployment scope relevant to compliance jurisdiction
 */
export interface ScopeAndDeployment {
    /**
     * Estimated number of affected users
     */
    affectedUserCount?: number;
    /**
     * Geographic regions where deployed (relevant for jurisdiction)
     */
    deploymentRegions?: string[];
    /**
     * Scope of AI usage
     */
    scope?: Scope;
    [property: string]: any;
}

/**
 * Scope of AI usage
 */
export enum Scope {
    Both = "Both",
    External = "External",
    Internal = "Internal",
}

/**
 * Compliance status
 */
export enum Status {
    Compliant = "Compliant",
    NonCompliant = "NonCompliant",
    NotApplicable = "NotApplicable",
    PartiallyCompliant = "PartiallyCompliant",
    UnderReview = "UnderReview",
}

/**
 * Verification and certification status
 */
export interface Verification {
    /**
     * URL to certificate or compliance documentation
     */
    certificateUrl?: string;
    /**
     * Whether compliance has been verified
     */
    isVerified?: boolean;
    /**
     * Notes from verification process
     */
    verificationNotes?: string;
    /**
     * Timestamp of verification
     */
    verifiedAt?: number;
    /**
     * Verifier (internal auditor, external body, etc.)
     */
    verifiedBy?: string;
    [property: string]: any;
}

/**
 * Classification of data accessed by this server
 */
export interface GovernanceMetadataDataClassification {
    /**
     * Whether this server accesses Personally Identifiable Information
     */
    accessesPII?: boolean;
    /**
     * Whether this server accesses sensitive business data
     */
    accessesSensitiveData?: boolean;
    /**
     * Categories of data accessed
     */
    dataCategories?: string[];
    /**
     * Data retention period for server logs
     */
    dataRetentionPeriod?: string;
    [property: string]: any;
}

/**
 * Registration status - used to track Shadow AI
 */
export enum RegistrationStatus {
    Approved = "Approved",
    PendingApproval = "PendingApproval",
    Registered = "Registered",
    Rejected = "Rejected",
    Unregistered = "Unregistered",
}

/**
 * Risk assessment for this MCP server
 */
export interface RiskAssessment {
    assessedAt?: number;
    assessedBy?: string;
    /**
     * Risk mitigation measures in place
     */
    mitigations?: string[];
    /**
     * Identified risk factors
     */
    riskFactors?: string[];
    riskLevel?:   RiskLevel;
    [property: string]: any;
}

/**
 * Risk level based on capabilities and data access
 */
export enum RiskLevel {
    Critical = "Critical",
    High = "High",
    Low = "Low",
    Medium = "Medium",
}

/**
 * MCP Prompt - a reusable prompt template exposed by the server
 */
export interface MCPPrompt {
    /**
     * Arguments that can be passed to this prompt
     */
    arguments?:          PromptArgument[];
    dataAccessPatterns?: string[];
    /**
     * Description of the prompt
     */
    description?: string;
    /**
     * Display name for the prompt
     */
    displayName?: string;
    examples?:    Example[];
    lastUsedAt?:  number;
    /**
     * Message templates
     */
    messages?: PromptMessage[];
    /**
     * Name of the prompt
     */
    name:                  string;
    outputClassification?: OutputClassification;
    promptType?:           PromptType;
    tags?:                 TagLabel[];
    usageCount?:           number;
}

/**
 * Argument definition for a prompt
 */
export interface PromptArgument {
    /**
     * Default value
     */
    default?:     any;
    description?: string;
    /**
     * Allowed values
     */
    enum?: any[];
    /**
     * Name of the argument
     */
    name:       string;
    required?:  boolean;
    sensitive?: boolean;
    type?:      Type;
}

export enum Type {
    Array = "Array",
    Boolean = "Boolean",
    Number = "Number",
    Object = "Object",
    String = "String",
}

export interface Example {
    arguments?:      { [key: string]: any };
    expectedOutput?: string;
    name?:           string;
    [property: string]: any;
}

/**
 * A message in the prompt template
 */
export interface PromptMessage {
    content: string;
    role:    Role;
}

export enum Role {
    Assistant = "assistant",
    System = "system",
    User = "user",
}

export interface OutputClassification {
    mayContainPII?:    boolean;
    outputCategories?: string[];
    sensitivityLevel?: SensitivityLevel;
    [property: string]: any;
}

/**
 * Type of MCP prompt
 */
export enum PromptType {
    Analysis = "Analysis",
    Classification = "Classification",
    Custom = "Custom",
    Extraction = "Extraction",
    Generation = "Generation",
    Query = "Query",
    Summarization = "Summarization",
    Transformation = "Transformation",
    Validation = "Validation",
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 */
export interface TagLabel {
    /**
     * Timestamp when this tag was applied in ISO 8601 format
     */
    appliedAt?: Date;
    /**
     * Who it is that applied this tag (e.g: a bot, AI or a human)
     */
    appliedBy?: string;
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
 * MCP Resource - data exposed by the server that can be read by AI applications
 */
export interface MCPResource {
    /**
     * Number of times accessed
     */
    accessCount?: number;
    accessLevel?: AccessLevel;
    annotations?: ResourceAnnotations;
    /**
     * Data classification for the resource
     */
    dataClassification?: ResourceDataClassification;
    /**
     * Description of the resource
     */
    description?: string;
    /**
     * Display name for the resource
     */
    displayName?:  string;
    lastModified?: number;
    /**
     * MIME type of the resource content
     */
    mimeType?: string;
    /**
     * Name of the resource
     */
    name:                 string;
    requiredPermissions?: string[];
    resourceType?:        ResourceType;
    /**
     * Size in bytes
     */
    size?: number;
    /**
     * Reference to the underlying data entity if known
     */
    sourceEntity?: EntityReference;
    tags?:         TagLabel[];
    /**
     * URI pattern for accessing this resource
     */
    uri: string;
    /**
     * URI template if the resource supports dynamic URIs
     */
    uriTemplate?: string;
}

export enum AccessLevel {
    Full = "Full",
    ReadOnly = "ReadOnly",
    ReadWrite = "ReadWrite",
}

export interface ResourceAnnotations {
    audience?: string[];
    priority?: number;
    [property: string]: any;
}

/**
 * Data classification for the resource
 */
export interface ResourceDataClassification {
    complianceRequirements?: string[];
    containsPII?:            boolean;
    dataCategories?:         string[];
    piiTypes?:               PiiType[];
    retentionPeriod?:        string;
    sensitivityLevel?:       SensitivityLevel;
    [property: string]: any;
}

/**
 * Type of PII
 */
export enum PiiType {
    Address = "Address",
    BiometricData = "BiometricData",
    DateOfBirth = "DateOfBirth",
    Email = "Email",
    FinancialData = "FinancialData",
    HealthData = "HealthData",
    LocationData = "LocationData",
    Name = "Name",
    Other = "Other",
    Phone = "Phone",
    Ssn = "SSN",
}

/**
 * Type of MCP resource
 */
export enum ResourceType {
    API = "API",
    Blob = "Blob",
    Custom = "Custom",
    Database = "Database",
    Directory = "Directory",
    Document = "Document",
    File = "File",
    Stream = "Stream",
    URL = "URL",
}

/**
 * Security metrics and settings
 *
 * Security metrics and settings for the MCP server
 */
export interface SecurityMetrics {
    /**
     * Whether audit logging is enabled
     */
    auditLoggingEnabled?: boolean;
    /**
     * Whether authentication is required
     */
    authenticationRequired?: boolean;
    /**
     * Whether authorization is enforced
     */
    authorizationEnforced?: boolean;
    /**
     * Whether data is encrypted in transit
     */
    encryptionInTransit?: boolean;
    /**
     * Whether the server runs in a sandboxed environment
     */
    sandboxed?: boolean;
    /**
     * Method used for secrets management
     */
    secretsManagement?: string;
}

/**
 * Information about the MCP server software
 */
export interface ServerInfo {
    /**
     * URL to the server's documentation
     */
    documentationUrl?: string;
    /**
     * URL to the server's source code repository
     */
    repositoryUrl?: string;
    /**
     * Name of the MCP server software
     */
    serverName?: string;
    /**
     * Version of the MCP server software
     */
    serverVersion?: string;
    /**
     * Vendor or organization that provides the server
     */
    vendor?: string;
}

/**
 * Type of MCP server based on its primary function
 */
export enum ServerType {
    Cloud = "Cloud",
    Communication = "Communication",
    Custom = "Custom",
    DataAccess = "DataAccess",
    Database = "Database",
    Development = "Development",
    FileSystem = "FileSystem",
    Security = "Security",
    WebAPI = "WebAPI",
}

/**
 * MCP Tool - a capability exposed by the server that can perform operations
 */
export interface MCPTool {
    /**
     * MCP tool annotations
     */
    annotations?: ToolAnnotations;
    /**
     * Data access patterns for the tool
     */
    dataAccess?: DataAccess;
    /**
     * Description of what the tool does
     */
    description?: string;
    /**
     * Display name for the tool
     */
    displayName?: string;
    /**
     * Whether this tool is idempotent
     */
    idempotent?: boolean;
    /**
     * JSON Schema for tool input parameters
     */
    inputSchema?: { [key: string]: any };
    lastUsedAt?:  number;
    /**
     * Name of the tool
     */
    name: string;
    /**
     * JSON Schema for tool output
     */
    outputSchema?: { [key: string]: any };
    /**
     * Rate limit for tool invocations per minute
     */
    rateLimitPerMinute?: number;
    /**
     * Permissions required to use this tool
     */
    requiredPermissions?: string[];
    /**
     * Whether this tool's action can be reversed
     */
    reversible?: boolean;
    /**
     * Identified risk factors
     */
    riskFactors?: string[];
    riskLevel?:   RiskLevel;
    /**
     * Whether this tool causes side effects
     */
    sideEffects?: boolean;
    tags?:        TagLabel[];
    /**
     * Maximum execution time in milliseconds
     */
    timeout?:      number;
    toolCategory?: ToolCategory;
    /**
     * Number of times this tool has been invoked
     */
    usageCount?: number;
}

/**
 * MCP tool annotations
 */
export interface ToolAnnotations {
    destructiveHint?: boolean;
    idempotentHint?:  boolean;
    openWorldHint?:   boolean;
    readOnlyHint?:    boolean;
    title?:           string;
    [property: string]: any;
}

/**
 * Data access patterns for the tool
 */
export interface DataAccess {
    dataTypes?:        string[];
    deletesData?:      boolean;
    piiAccess?:        boolean;
    readsData?:        boolean;
    sensitivityLevel?: SensitivityLevel;
    writesData?:       boolean;
    [property: string]: any;
}

/**
 * Category of the MCP tool based on its primary function
 */
export enum ToolCategory {
    CodeOperation = "CodeOperation",
    CommunicationOperation = "CommunicationOperation",
    Custom = "Custom",
    DataOperation = "DataOperation",
    DatabaseOperation = "DatabaseOperation",
    FileOperation = "FileOperation",
    SearchOperation = "SearchOperation",
    SecurityOperation = "SecurityOperation",
    SystemOperation = "SystemOperation",
    WebOperation = "WebOperation",
}

/**
 * Transport protocol used by the MCP server
 */
export enum TransportType {
    SSE = "SSE",
    Stdio = "Stdio",
    Streamable = "Streamable",
}
