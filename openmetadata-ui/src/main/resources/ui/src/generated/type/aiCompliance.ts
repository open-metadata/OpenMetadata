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
