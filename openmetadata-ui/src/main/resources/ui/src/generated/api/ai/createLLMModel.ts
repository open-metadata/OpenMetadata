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
 * Create LLM Model entity request
 */
export interface CreateLLMModel {
    /**
     * Base model name
     */
    baseModel: string;
    /**
     * Certifications this model has received
     */
    certifications?: string[];
    /**
     * Cost metrics for model usage
     */
    costMetrics?: CostMetrics;
    /**
     * List of fully qualified names of data products this entity is part of.
     */
    dataProducts?: string[];
    /**
     * Deployment and availability information
     */
    deploymentInfo?: DeploymentInfo;
    /**
     * Description of the LLM model. Its capabilities, use cases, and limitations.
     */
    description?: string;
    /**
     * Display Name that identifies this LLM model.
     */
    displayName?: string;
    /**
     * Fully qualified names of the domains the LLM Model belongs to.
     */
    domains?: string[];
    /**
     * Entity extension data with custom attributes added to the entity.
     */
    extension?: any;
    /**
     * Governance status - tracks unauthorized/shadow AI models
     */
    governanceStatus?: GovernanceStatus;
    /**
     * Model performance metrics and evaluation results
     */
    modelEvaluation?: ModelEvaluation;
    /**
     * Model provider (e.g., 'OpenAI', 'Anthropic', 'Meta')
     */
    modelProvider?: string;
    /**
     * Detailed model specifications
     */
    modelSpecifications?: ModelSpecifications;
    /**
     * Version of the model
     */
    modelVersion?: string;
    /**
     * Name that identifies this LLM model.
     */
    name: string;
    /**
     * Owners of this LLM Model
     */
    owners?: EntityReference[];
    /**
     * Regulatory compliance standards met
     */
    regulatoryCompliance?: string[];
    /**
     * Link to the LLM service where this model is hosted
     */
    service: string;
    /**
     * Tags for this LLM Model
     */
    tags?: TagLabel[];
    /**
     * Training data and methodology information
     */
    trainingMetadata?: TrainingMetadata;
}

/**
 * Cost metrics for model usage
 *
 * Cost metrics for using this model
 */
export interface CostMetrics {
    currency?: string;
    /**
     * Estimated monthly cost
     */
    estimatedMonthlyCost?: number;
    /**
     * Estimated monthly token usage
     */
    estimatedMonthlyUsage?: number;
    /**
     * Cost per 1000 input tokens
     */
    inputCostPer1kTokens?: number;
    /**
     * Cost per 1000 output tokens
     */
    outputCostPer1kTokens?: number;
}

/**
 * Deployment and availability information
 *
 * Deployment information for the model
 */
export interface DeploymentInfo {
    availabilityZones?: string[];
    deploymentType?:    DeploymentType;
    /**
     * API endpoint for the model
     */
    endpoint?: string;
    /**
     * Deployment region
     */
    region?: string;
}

export enum DeploymentType {
    API = "API",
    Hybrid = "Hybrid",
    OnPremise = "OnPremise",
    SelfHosted = "SelfHosted",
}

/**
 * Governance status - tracks unauthorized/shadow AI models
 */
export enum GovernanceStatus {
    Approved = "Approved",
    PendingReview = "PendingReview",
    Rejected = "Rejected",
    Unauthorized = "Unauthorized",
}

/**
 * Model performance metrics and evaluation results
 *
 * Comprehensive evaluation metrics for the LLM model
 */
export interface ModelEvaluation {
    accuracyMetrics?: AccuracyMetrics;
    /**
     * LLM BIAS EVALUATION - critical for governance
     */
    biasMetrics?:       BiasMetrics;
    evaluatedAt?:       number;
    evaluationDataset?: EntityReference;
    fairnessMetrics?:   FairnessMetrics;
    robustnessMetrics?: RobustnessMetrics;
    safetyMetrics?:     SafetyMetrics;
}

export interface AccuracyMetrics {
    accuracy?:   number;
    bleuScore?:  number;
    f1Score?:    number;
    precision?:  number;
    recall?:     number;
    rougeScore?: number;
    [property: string]: any;
}

/**
 * LLM BIAS EVALUATION - critical for governance
 */
export interface BiasMetrics {
    demographicParity?: number;
    dimensionScores?:   DimensionScores;
    disparateImpact?:   number;
    equalizedOdds?:     number;
    /**
     * Overall bias score 0-1, higher = more biased
     */
    overallBiasScore?: number;
    testDataset?:      EntityReference;
    testMethod?:       string;
    [property: string]: any;
}

export interface DimensionScores {
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
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Owners of this LLM Model
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

export interface FairnessMetrics {
    counterfactualFairness?: number;
    groupFairness?:          number;
    individualFairness?:     number;
    [property: string]: any;
}

export interface RobustnessMetrics {
    adversarialRobustness?: number;
    noiseRobustness?:       number;
    outlierSensitivity?:    number;
    [property: string]: any;
}

export interface SafetyMetrics {
    harmfulContentRate?: number;
    piiLeakageRisk?:     number;
    toxicityScore?:      number;
    [property: string]: any;
}

/**
 * Detailed model specifications
 *
 * Technical specifications of the model
 */
export interface ModelSpecifications {
    /**
     * Model architecture (e.g., 'Transformer', 'GPT', 'BERT')
     */
    architecture?: string;
    /**
     * Context window size in tokens
     */
    contextWindow?: number;
    /**
     * Maximum output tokens
     */
    maxOutputTokens?: number;
    /**
     * Number of parameters (e.g., '7B', '70B', '175B')
     */
    parametersCount?: string;
    /**
     * Quantization method if applicable
     */
    quantization?: string;
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
 * Training data and methodology information
 *
 * Training or fine-tuning metadata - critical for data lineage and impact analysis
 */
export interface TrainingMetadata {
    /**
     * Base model this was trained/fine-tuned from
     */
    baseModel?: string;
    /**
     * Detailed data lineage for training - tracks exactly what data was used
     */
    dataLineage?: DataLineage[];
    /**
     * Hyperparameters used for training
     */
    hyperparameters?: Hyperparameters;
    trainedBy?:       string;
    trainingCost?:    TrainingCost;
    /**
     * Datasets used for training - KEY FOR DATA LINEAGE
     */
    trainingDatasets?: EntityReference[];
    trainingJobId?:    string;
    /**
     * Metrics from training process
     */
    trainingMetrics?: TrainingMetrics;
    trainingPeriod?:  TrainingPeriod;
    trainingType?:    TrainingType;
    /**
     * Datasets used for validation
     */
    validationDatasets?: EntityReference[];
}

export interface DataLineage {
    /**
     * Columns used from the dataset
     */
    columns?: string[];
    dataset?: EntityReference;
    /**
     * Transformations applied to the data
     */
    dataTransformations?: string[];
    dateRange?:           DateRange;
    /**
     * How PII was handled in this dataset
     */
    piiHandling?: string;
    /**
     * Number of records used from this dataset
     */
    recordCount?:      number;
    sensitivityLevel?: SensitivityLevel;
    [property: string]: any;
}

export interface DateRange {
    end?:   number;
    start?: number;
    [property: string]: any;
}

export enum SensitivityLevel {
    Confidential = "Confidential",
    Internal = "Internal",
    Public = "Public",
    Restricted = "Restricted",
}

/**
 * Hyperparameters used for training
 */
export interface Hyperparameters {
    batchSize?:    number;
    epochs?:       number;
    learningRate?: number;
    optimizer?:    string;
    warmupSteps?:  number;
    weightDecay?:  number;
    [property: string]: any;
}

export interface TrainingCost {
    computeHours?: number;
    currency?:     string;
    resourceType?: string;
    totalCost?:    number;
    [property: string]: any;
}

/**
 * Metrics from training process
 */
export interface TrainingMetrics {
    accuracy?:       number;
    finalLoss?:      number;
    perplexity?:     number;
    validationLoss?: number;
    [property: string]: any;
}

export interface TrainingPeriod {
    durationHours?: number;
    endDate?:       number;
    startDate?:     number;
    [property: string]: any;
}

export enum TrainingType {
    FullFineTune = "FullFineTune",
    LoRA = "LoRA",
    PrefixTuning = "PrefixTuning",
    PromptTuning = "PromptTuning",
    QLoRA = "QLoRA",
    Rlhf = "RLHF",
}
