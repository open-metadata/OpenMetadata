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
 * This schema defines the Search Service entity, such as ElasticSearch, OpenSearch.
 */
export interface SearchService {
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    connection?:        SearchConnection;
    /**
     * List of data products this entity is part of.
     */
    dataProducts?: EntityReference[];
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
    /**
     * Description of a search service instance.
     */
    description?: string;
    /**
     * Display Name that identifies this search service.
     */
    displayName?: string;
    /**
     * Domain the search service belongs to.
     */
    domain?: EntityReference;
    /**
     * Followers of this entity.
     */
    followers?: EntityReference[];
    /**
     * FullyQualifiedName same as `name`.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this search service.
     */
    href?: string;
    /**
     * Unique identifier of this search service instance.
     */
    id: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * The ingestion agent responsible for executing the ingestion pipeline.
     */
    ingestionRunner?: EntityReference;
    /**
     * Name that identifies this search service.
     */
    name: string;
    /**
     * Owners of this search service.
     */
    owners?: EntityReference[];
    /**
     * References to pipelines deployed for this search service to extract metadata etc..
     */
    pipelines?: EntityReference[];
    /**
     * Type of search service such as S3, GCS, AZURE...
     */
    serviceType: SearchServiceType;
    /**
     * Tags for this search Service.
     */
    tags?: TagLabel[];
    /**
     * Last test connection results for this service
     */
    testConnectionResult?: TestConnectionResult;
    /**
     * Last update time corresponding to the new version of the entity in Unix epoch time
     * milliseconds.
     */
    updatedAt?: number;
    /**
     * User who made the update.
     */
    updatedBy?: string;
    /**
     * Metadata version of the entity.
     */
    version?: number;
}

/**
 * Change that lead to this version of the entity.
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
 * search Connection.
 */
export interface SearchConnection {
    config?: ConfigClass;
}

/**
 * ElasticSearch Connection.
 *
 * OpenSearch Connection Config
 *
 * Custom Search Service connection to build a source that is not supported by OpenMetadata
 * yet.
 */
export interface ConfigClass {
    /**
     * Choose Auth Config Type.
     */
    authType?:            AuthConfigurationType;
    connectionArguments?: { [key: string]: any };
    /**
     * Connection Timeout in Seconds
     */
    connectionTimeoutSecs?: number;
    /**
     * Host and port of the ElasticSearch service.
     *
     * Host and port of the OpenSearch service.
     */
    hostPort?: string;
    /**
     * Regex to only fetch search indexes that matches the pattern.
     */
    searchIndexFilterPattern?:   FilterPattern;
    sslConfig?:                  SSLConfig;
    supportsMetadataExtraction?: boolean;
    /**
     * ElasticSearch Type
     *
     * OpenSearch Type
     *
     * Custom search service type
     */
    type?:              SearchServiceType;
    verifySSL?:         VerifySSL;
    connectionOptions?: { [key: string]: string };
    /**
     * Source Python Class Name to instantiated by the ingestion workflow
     */
    sourcePythonClass?: string;
}

/**
 * Choose Auth Config Type.
 *
 * Basic Auth Configuration for ElasticSearch
 *
 * API Key Authentication for ElasticSearch
 *
 * AWS credentials configs.
 */
export interface AuthConfigurationType {
    /**
     * Elastic Search Password for Login
     */
    password?: string;
    /**
     * Elastic Search Username for Login
     */
    username?: string;
    /**
     * Elastic Search API Key for API Authentication
     */
    apiKey?: string;
    /**
     * Elastic Search API Key ID for API Authentication
     */
    apiKeyId?: string;
    /**
     * The Amazon Resource Name (ARN) of the role to assume. Required Field in case of Assume
     * Role
     */
    assumeRoleArn?: string;
    /**
     * An identifier for the assumed role session. Use the role session name to uniquely
     * identify a session when the same role is assumed by different principals or for different
     * reasons. Required Field in case of Assume Role
     */
    assumeRoleSessionName?: string;
    /**
     * The Amazon Resource Name (ARN) of the role to assume. Optional Field in case of Assume
     * Role
     */
    assumeRoleSourceIdentity?: string;
    /**
     * AWS Access key ID.
     */
    awsAccessKeyId?: string;
    /**
     * AWS Region
     */
    awsRegion?: string;
    /**
     * AWS Secret Access Key.
     */
    awsSecretAccessKey?: string;
    /**
     * AWS Session Token.
     */
    awsSessionToken?: string;
    /**
     * EndPoint URL for the AWS
     */
    endPointURL?: string;
    /**
     * The name of a profile to use with the boto session.
     */
    profileName?: string;
}

/**
 * Regex to only fetch search indexes that matches the pattern.
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
 * SSL Config
 */
export interface SSLConfig {
    /**
     * SSL Certificates
     */
    certificates?: SSLCertificates;
    [property: string]: any;
}

/**
 * SSL Certificates
 *
 * SSL Certificates By Path
 *
 * SSL Certificates By Values
 */
export interface SSLCertificates {
    /**
     * CA Certificate Path
     */
    caCertPath?: string;
    /**
     * Client Certificate Path
     */
    clientCertPath?: string;
    /**
     * Private Key Path
     */
    privateKeyPath?: string;
    /**
     * CA Certificate Value
     */
    caCertValue?: string;
    /**
     * Client Certificate Value
     */
    clientCertValue?: string;
    /**
     * Private Key Value
     */
    privateKeyValue?: string;
    /**
     * Staging Directory Path
     */
    stagingDir?: string;
}

/**
 * ElasticSearch Type
 *
 * ElasticSearch service type
 *
 * OpenSearch Type
 *
 * OpenSearch service type
 *
 * Custom search service type
 *
 * Type of search service such as S3, GCS, AZURE...
 *
 * Type of search service such as ElasticSearch or OpenSearch.
 */
export enum SearchServiceType {
    CustomSearch = "CustomSearch",
    ElasticSearch = "ElasticSearch",
    OpenSearch = "OpenSearch",
}

/**
 * Client SSL verification. Make sure to configure the SSLConfig if enabled.
 */
export enum VerifySSL {
    Ignore = "ignore",
    NoSSL = "no-ssl",
    Validate = "validate",
}

/**
 * List of data products this entity is part of.
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
 * Domain the search service belongs to.
 *
 * The ingestion agent responsible for executing the ingestion pipeline.
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
     * An icon to associate with GlossaryTerm, Tag, Domain or Data Product.
     */
    iconURL?: string;
}

/**
 * Last test connection results for this service
 *
 * TestConnectionResult is the definition that will encapsulate result of running the test
 * connection steps.
 */
export interface TestConnectionResult {
    /**
     * Last time that the test connection was executed
     */
    lastUpdatedAt?: number;
    /**
     * Test Connection Result computation status.
     */
    status?: StatusType;
    /**
     * Steps to test the connection. Order matters.
     */
    steps: TestConnectionStepResult[];
}

/**
 * Test Connection Result computation status.
 *
 * Enum defining possible Test Connection Result status
 */
export enum StatusType {
    Failed = "Failed",
    Running = "Running",
    Successful = "Successful",
}

/**
 * Function that tests one specific element of the service. E.g., listing schemas, lineage,
 * or tags.
 */
export interface TestConnectionStepResult {
    /**
     * In case of failed step, this field would contain the actual error faced during the step.
     */
    errorLog?: string;
    /**
     * Is this step mandatory to be passed?
     */
    mandatory: boolean;
    /**
     * Results or exceptions to be shared after running the test. This message comes from the
     * test connection definition
     */
    message?: string;
    /**
     * Name of the step being tested
     */
    name: string;
    /**
     * Did the step pass successfully?
     */
    passed: boolean;
}
