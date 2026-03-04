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
 * AI Application entity representing AI systems including chatbots, agents, copilots, and
 * other AI-powered applications. Applications can use multiple LLM models and integrate
 * with various tools and data sources.
 */
export interface AIApplication {
    applicationType: ApplicationType;
    biasMetrics?:    BiasMetrics;
    certification?:  AssetCertification;
    /**
     * Change that led to this version
     */
    changeDescription?: ChangeDescription;
    /**
     * Data products this AI Application is part of
     */
    dataProducts?: EntityReference[];
    /**
     * Data sources (tables, APIs, etc.) this application can access
     */
    dataSources?: EntityReference[];
    /**
     * When true, indicates the entity has been soft deleted
     */
    deleted?: boolean;
    /**
     * Production deployment endpoint
     */
    deploymentUrl?: string;
    /**
     * Description of the AI Application, its purpose, and usage.
     */
    description?:      string;
    developmentStage?: DevelopmentStage;
    /**
     * Display name for the AI Application.
     */
    displayName?: string;
    /**
     * Link to external documentation
     */
    documentation?: string;
    /**
     * Domain the AI Application belongs to
     */
    domain?: EntityReference;
    /**
     * Domains the AI Application belongs to
     */
    domains?: EntityReference[];
    /**
     * AI applications that depend on this application
     */
    downstreamApplications?: EntityReference[];
    /**
     * Entity extension data with custom attributes
     */
    extension?: any;
    /**
     * Followers of this AI Application
     */
    followers?: EntityReference[];
    framework?: FrameworkInfo;
    /**
     * Fully qualified name of the AI Application.
     */
    fullyQualifiedName?: string;
    governanceMetadata?: GovernanceMetadata;
    /**
     * Link to this resource
     */
    href?: string;
    /**
     * Unique identifier of the AI Application.
     */
    id: string;
    /**
     * Change that led to this version
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Vector databases, document stores used for RAG
     */
    knowledgeBases?: EntityReference[];
    /**
     * Life Cycle properties of the entity
     */
    lifeCycle?: LifeCycle;
    /**
     * Multiple LLM models this application can use for different purposes
     */
    modelConfigurations: ModelConfiguration[];
    /**
     * Name that identifies this AI Application.
     */
    name: string;
    /**
     * Owners of this AI Application
     */
    owners?:             EntityReference[];
    performanceMetrics?: PerformanceMetrics;
    /**
     * Primary/default LLM model used by this application
     */
    primaryModel?: EntityReference;
    /**
     * Prompt templates used by this application
     */
    promptTemplates?: EntityReference[];
    qualityMetrics?:  QualityMetrics;
    safetyMetrics?:   SafetyMetrics;
    /**
     * Link to source code repository
     */
    sourceCode?: string;
    /**
     * Source hash of the entity
     */
    sourceHash?: string;
    /**
     * Tags for this AI Application
     */
    tags?: TagLabel[];
    /**
     * Test suites for validating this AI application
     */
    testSuites?: EntityReference[];
    /**
     * MCP tools or other tools available to this application
     */
    tools?: EntityReference[];
    /**
     * Last update time in Unix epoch milliseconds
     */
    updatedAt?: number;
    /**
     * User who made the update
     */
    updatedBy?: string;
    /**
     * Other AI applications this application depends on (multi-agent orchestration)
     */
    upstreamApplications?: EntityReference[];
    /**
     * Metadata version of the entity
     */
    version?: number;
    /**
     * Votes on the entity
     */
    votes?: Votes;
}

/**
 * Type of AI application based on primary function and interaction pattern
 */
export enum ApplicationType {
    Agent = "Agent",
    Assistant = "Assistant",
    AutomationBot = "AutomationBot",
    Chatbot = "Chatbot",
    CodeGenerator = "CodeGenerator",
    Copilot = "Copilot",
    Custom = "Custom",
    DataAnalyst = "DataAnalyst",
    MultiAgent = "MultiAgent",
    Rag = "RAG",
}

/**
 * Bias evaluation metrics for the AI application
 */
export interface BiasMetrics {
    /**
     * Whether significant bias was detected
     */
    biasDetected?: boolean;
    /**
     * Demographic parity score
     */
    demographicParity?: number;
    /**
     * Bias scores by demographic dimension
     */
    dimensionScores?: DimensionScores;
    /**
     * Disparate impact ratio
     */
    disparateImpact?: number;
    /**
     * Equalized odds score
     */
    equalizedOdds?: number;
    /**
     * Method used for bias evaluation (e.g., Fairlearn, AI Fairness 360)
     */
    evaluationMethod?: string;
    lastEvaluatedAt?:  number;
    /**
     * Overall bias score from 0-1, where higher values indicate more bias
     */
    overallBiasScore?: number;
    /**
     * Steps taken or recommended to remediate bias
     */
    remediationSteps?: string[];
    /**
     * Dataset used for bias evaluation
     */
    testDataset?: EntityReference;
}

/**
 * Bias scores by demographic dimension
 */
export interface DimensionScores {
    age?:           number;
    disability?:    number;
    gender?:        number;
    race?:          number;
    religion?:      number;
    socioeconomic?: number;
    [property: string]: any;
}

/**
 * Dataset used for bias evaluation
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Data products this AI Application is part of
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Domain the AI Application belongs to
 *
 * User, Pipeline, Query that created,updated or accessed the data asset
 *
 * Reference to LLMModel entity
 *
 * Primary/default LLM model used by this application
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
 * Defines the Asset Certification schema.
 */
export interface AssetCertification {
    /**
     * The date when the certification was applied.
     */
    appliedDate: number;
    /**
     * The date when the certification expires.
     */
    expiryDate: number;
    tagLabel:   TagLabel;
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
     * Additional metadata associated with this tag label, such as recognizer information for
     * automatically applied tags.
     */
    metadata?: TagLabelMetadata;
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
 * Additional metadata associated with this tag label, such as recognizer information for
 * automatically applied tags.
 *
 * Additional metadata associated with a tag label, including information about how the tag
 * was applied.
 */
export interface TagLabelMetadata {
    /**
     * Metadata about the recognizer that automatically applied this tag
     */
    recognizer?: TagLabelRecognizerMetadata;
}

/**
 * Metadata about the recognizer that automatically applied this tag
 *
 * Metadata about the recognizer that applied a tag, including scoring and pattern
 * information.
 */
export interface TagLabelRecognizerMetadata {
    /**
     * Details of patterns that matched during recognition
     */
    patterns?: PatternMatch[];
    /**
     * Unique identifier of the recognizer that applied this tag
     */
    recognizerId: string;
    /**
     * Human-readable name of the recognizer
     */
    recognizerName: string;
    /**
     * Confidence score assigned by the recognizer (0.0 to 1.0)
     */
    score: number;
    /**
     * What the recognizer analyzed to apply this tag
     */
    target?: Target;
}

/**
 * Information about a pattern that matched during recognition
 */
export interface PatternMatch {
    /**
     * Name of the pattern that matched
     */
    name: string;
    /**
     * Regular expression or pattern definition
     */
    regex?: string;
    /**
     * Confidence score for this specific pattern match
     */
    score: number;
}

/**
 * What the recognizer analyzed to apply this tag
 */
export enum Target {
    ColumnName = "column_name",
    Content = "content",
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
 * Development stage of the AI application. 'Unauthorized' indicates Shadow AI that needs
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
 * Information about the framework used to build the application
 */
export interface FrameworkInfo {
    language?: Language;
    name?:     Name;
    version?:  string;
}

export enum Language {
    C = "C#",
    Go = "Go",
    Java = "Java",
    JavaScript = "JavaScript",
    Python = "Python",
    TypeScript = "TypeScript",
}

export enum Name {
    AutoGen = "AutoGen",
    CrewAI = "CrewAI",
    Custom = "Custom",
    Haystack = "Haystack",
    LangChain = "LangChain",
    LlamaIndex = "LlamaIndex",
    SemanticKernel = "Semantic Kernel",
}

/**
 * AI governance metadata for compliance and risk management
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
    approvedAt?:       number;
    approvedBy?:       string;
    /**
     * Classification of data accessed by this application
     */
    dataClassification?: DataClassification;
    /**
     * Governance policies applied to this application
     */
    governancePolicies?: EntityReference[];
    /**
     * Notes from AI governance intake form or review process
     */
    intakeNotes?:  string;
    registeredAt?: number;
    registeredBy?: string;
    /**
     * Registration status - used to track Shadow AI
     */
    registrationStatus?: RegistrationStatus;
    /**
     * Risk assessment for this AI application
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
 * Classification of data accessed by this application
 */
export interface DataClassification {
    /**
     * Does this application access Personally Identifiable Information
     */
    accessesPII?: boolean;
    /**
     * Does this application access sensitive business data
     */
    accessesSensitiveData?: boolean;
    /**
     * Categories of data accessed
     */
    dataCategories?: string[];
    /**
     * Data retention period for application logs
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
 * Risk assessment for this AI application
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

export enum RiskLevel {
    Critical = "Critical",
    High = "High",
    Low = "Low",
    Medium = "Medium",
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
 * Configuration for one LLM model used by this application. Applications can have multiple
 * model configurations for different purposes.
 */
export interface ModelConfiguration {
    /**
     * Reference to LLMModel entity
     */
    model: EntityReference;
    /**
     * Model-specific parameters for this application
     */
    parameters?: Parameters;
    /**
     * Purpose of this model in the application workflow
     */
    purpose: Purpose;
    /**
     * Criteria for when to use this model
     */
    selectionCriteria?: SelectionCriteria;
}

/**
 * Model-specific parameters for this application
 */
export interface Parameters {
    frequencyPenalty?: number;
    maxTokens?:        number;
    presencePenalty?:  number;
    temperature?:      number;
    topP?:             number;
    [property: string]: any;
}

/**
 * Purpose of this model in the application workflow
 */
export enum Purpose {
    CodeGeneration = "CodeGeneration",
    CostOptimization = "CostOptimization",
    Embedding = "Embedding",
    Fallback = "Fallback",
    Primary = "Primary",
    Reasoning = "Reasoning",
}

/**
 * Criteria for when to use this model
 */
export interface SelectionCriteria {
    /**
     * Use this model if cost per query is under this threshold
     */
    costThreshold?: number;
    /**
     * Use this model only if query is under this token count
     */
    maxTokens?: number;
    /**
     * Types of queries this model handles
     */
    queryTypes?: string[];
    [property: string]: any;
}

/**
 * Runtime performance metrics for the AI application
 */
export interface PerformanceMetrics {
    /**
     * Average cost per execution
     */
    averageCost?: number;
    /**
     * Average latency in milliseconds
     */
    averageLatencyMs?: number;
    currency?:         string;
    lastExecutionAt?:  number;
    /**
     * 95th percentile latency in milliseconds
     */
    p95LatencyMs?: number;
    /**
     * 99th percentile latency in milliseconds
     */
    p99LatencyMs?: number;
    /**
     * Success rate (0-1)
     */
    successRate?: number;
    /**
     * Total cost across all executions
     */
    totalCost?: number;
    /**
     * Total number of executions
     */
    totalExecutions?: number;
}

/**
 * Quality metrics for AI application responses
 */
export interface QualityMetrics {
    /**
     * Answer relevancy score (0-1)
     */
    answerRelevancy?: number;
    /**
     * Context precision score (0-1)
     */
    contextPrecision?: number;
    /**
     * Faithfulness to source data (0-1)
     */
    faithfulness?: number;
    /**
     * Rate of hallucinations (0-1)
     */
    hallucinationRate?: number;
}

/**
 * Safety metrics for AI application
 */
export interface SafetyMetrics {
    /**
     * Number of requests blocked by safety filters
     */
    blockedRequests?: number;
    /**
     * Rate of harmful content generated
     */
    harmfulContentRate?: number;
    /**
     * Rate of PII leakage incidents
     */
    piiLeakageRate?: number;
    /**
     * Number of prompt injection attempts detected
     */
    promptInjectionAttempts?: number;
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
