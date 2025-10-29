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
 * Create LLM service entity request
 */
export interface CreateLLMService {
    connection?: LlmConnection;
    /**
     * List of fully qualified names of data products this entity is part of.
     */
    dataProducts?: string[];
    /**
     * Description of LLM entity.
     */
    description?: string;
    /**
     * Display Name that identifies this LLM service.
     */
    displayName?: string;
    /**
     * Fully qualified names of the domains the LLM Service belongs to.
     */
    domains?: string[];
    /**
     * The ingestion agent responsible for executing the ingestion pipeline. It will be defined
     * at runtime based on the Ingestion Agent of the service.
     */
    ingestionRunner?: EntityReference;
    /**
     * Name that identifies the this entity instance uniquely
     */
    name: string;
    /**
     * Owners of this LLM service.
     */
    owners?:     EntityReference[];
    serviceType: LlmServiceType;
    /**
     * Tags for this LLM Service.
     */
    tags?: TagLabel[];
}

/**
 * LLM Service Connection.
 */
export interface LlmConnection {
    config?: Connection;
}

/**
 * OpenAI LLM Service Connection Config
 *
 * Anthropic (Claude) LLM Service Connection Config
 *
 * Azure OpenAI Service Connection Config
 *
 * AWS Bedrock LLM Service Connection Config
 *
 * Google Cloud Vertex AI LLM Service Connection Config
 *
 * Ollama (Local LLM) Service Connection Config
 *
 * HuggingFace LLM Service Connection Config
 *
 * Custom LLM Service Connection Config for self-hosted or custom LLM providers
 */
export interface Connection {
    /**
     * OpenAI API Key
     *
     * Anthropic API Key
     *
     * Azure OpenAI API Key
     *
     * HuggingFace API Token
     *
     * Optional API Key for authentication
     */
    apiKey?: string;
    /**
     * Optional custom base URL for OpenAI API (for compatible services)
     *
     * Optional custom base URL for Anthropic API
     *
     * Ollama server URL (e.g., http://localhost:11434)
     *
     * Optional custom base URL (for HuggingFace Inference Endpoints)
     *
     * Base URL for the custom LLM API endpoint
     */
    baseURL?: string;
    /**
     * Maximum number of retries for failed requests
     */
    maxRetries?: number;
    /**
     * Regex to only fetch models with names matching the pattern
     */
    modelFilterPattern?: FilterPattern;
    /**
     * Optional OpenAI Organization ID
     */
    organization?:               string;
    supportsMetadataExtraction?: boolean;
    /**
     * Request timeout in seconds
     */
    timeout?: number;
    /**
     * Service Type
     */
    type?: LlmServiceType;
    /**
     * Azure OpenAI API version
     */
    apiVersion?: string;
    /**
     * Default deployment name to use
     */
    deployment?: string;
    /**
     * Azure OpenAI endpoint URL (e.g., https://your-resource-name.openai.azure.com/)
     */
    endpoint?: string;
    /**
     * Optional ARN of IAM role to assume
     */
    assumeRoleArn?: string;
    /**
     * AWS Access Key ID for authentication
     */
    awsAccessKeyId?: string;
    /**
     * AWS Secret Access Key for authentication
     */
    awsSecretAccessKey?: string;
    /**
     * Optional AWS Session Token for temporary credentials
     */
    awsSessionToken?: string;
    /**
     * AWS region where Bedrock is deployed (e.g., us-east-1)
     */
    region?: string;
    /**
     * GCP service account credentials JSON
     */
    credentials?: string;
    /**
     * GCP region/location (e.g., us-central1)
     */
    location?: string;
    /**
     * GCP Project ID
     */
    projectId?: string;
    /**
     * Type of authentication
     */
    authType?: AuthenticationType;
    /**
     * Additional custom headers for API requests
     */
    headers?: { [key: string]: string };
    /**
     * Whether to verify SSL certificates
     */
    verifySsl?: boolean;
}

/**
 * Type of authentication
 */
export enum AuthenticationType {
    APIKey = "APIKey",
    BasicAuth = "BasicAuth",
    Bearer = "Bearer",
    Custom = "Custom",
    None = "None",
}

/**
 * Regex to only fetch models with names matching the pattern
 *
 * Regex to only fetch entities that matches the pattern.
 */
export interface FilterPattern {
    /**
     * List of strings/regex patterns to match and exclude only database entities that match.
     */
    excludes?: string[];
    /**
     * List of strings/regex patterns to match and include only database entities that match.
     */
    includes?: string[];
}

/**
 * Service Type
 *
 * Service type
 *
 * Type of LLM service provider
 */
export enum LlmServiceType {
    Anthropic = "Anthropic",
    AzureOpenAI = "AzureOpenAI",
    Bedrock = "Bedrock",
    CustomLLM = "CustomLLM",
    HuggingFace = "HuggingFace",
    Ollama = "Ollama",
    OpenAI = "OpenAI",
    VertexAI = "VertexAI",
}

/**
 * The ingestion agent responsible for executing the ingestion pipeline. It will be defined
 * at runtime based on the Ingestion Agent of the service.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Owners of this LLM service.
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
