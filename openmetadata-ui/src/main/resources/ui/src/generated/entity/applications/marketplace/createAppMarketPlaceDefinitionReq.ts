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
 * This schema defines the applications for Open-Metadata.
 */
export interface CreateAppMarketPlaceDefinitionReq {
    /**
     * This schema defines the type of the agent.
     */
    agentType?: AgentType;
    /**
     * Allow users to configure the app from the UI. If `false`, the `configure` step will be
     * hidden.
     */
    allowConfiguration?: boolean;
    /**
     * Application Configuration object.
     */
    appConfiguration?: any[] | boolean | number | null | CollateAIAppConfig | string;
    /**
     * Application Logo Url.
     */
    appLogoUrl?: string;
    /**
     * Application Screenshots.
     */
    appScreenshots?: string[];
    /**
     * This schema defines the type of application.
     */
    appType: AppType;
    /**
     * Full Qualified ClassName for the the application. Use can use
     * 'org.openmetadata.service.apps.AbstractNativeApplication' if you don't have one yet.
     */
    className: string;
    /**
     * Description of the Application.
     */
    description?: string;
    /**
     * Developer For the Application.
     */
    developer?: string;
    /**
     * Url for the developer
     */
    developerUrl?: string;
    /**
     * Display Name for the application.
     */
    displayName?: string;
    /**
     * Fully qualified name of the domain the Table belongs to.
     */
    domain?: string;
    /**
     * The app will be installable only if this flag is set to true.
     */
    enabled?: boolean;
    /**
     * Event subscriptions that will be created when the application is installed.
     */
    eventSubscriptions?: CreateEventSubscription[];
    /**
     * Features of the Application.
     */
    features?: string;
    /**
     * Name of the Application.
     */
    name: string;
    /**
     * Owners of this workflow.
     */
    owners?: EntityReference[];
    /**
     * Permission used by Native Applications.
     */
    permission: Permissions;
    /**
     * Privacy Policy for the developer
     */
    privacyPolicyUrl?: string;
    /**
     * If app type is live, user can provide additional runtime context.
     */
    runtime?: ExecutionContext;
    /**
     * This schema defines the Schedule Type of Application.
     */
    scheduleType: ScheduleType;
    /**
     * Fully Qualified class name for the Python source that will execute the external
     * application.
     */
    sourcePythonClass?: string;
    /**
     * Support Email for the application
     */
    supportEmail?: string;
    /**
     * If the app run can be interrupted as part of the execution.
     */
    supportsInterrupt?: boolean;
    /**
     * A system app cannot be uninstalled or modified.
     */
    system?: boolean;
    /**
     * Tags associated with the entity.
     */
    tags?: TagLabel[];
}

/**
 * This schema defines the type of the agent.
 *
 * This schema defines the type of application.
 */
export enum AgentType {
    CollateAI = "CollateAI",
    Metadata = "Metadata",
}

/**
 * Configuration for the CollateAI External Application.
 *
 * Configuration for the Automator External Application.
 *
 * This schema defines the Slack App Token Configuration
 *
 * No configuration needed to instantiate the Data Insights Pipeline. The logic is handled
 * in the backend.
 *
 * Search Indexing App.
 *
 * Configuration for the Collate AI Quality Agent.
 *
 * Configuration for the AutoPilot Application.
 */
export interface CollateAIAppConfig {
    /**
     * Query filter to be passed to ES. E.g.,
     * `{"query":{"bool":{"must":[{"bool":{"should":[{"term":{"domain.displayName.keyword":"DG
     * Anim"}}]}}]}}}`. This is the same payload as in the Explore page.
     */
    filter?: string;
    /**
     * Patch the description if it is empty, instead of raising a suggestion
     */
    patchIfEmpty?: boolean;
    /**
     * Application Type
     */
    type?: Type;
    /**
     * Action to take on those entities. E.g., propagate description through lineage, auto
     * tagging, etc.
     */
    actions?: Action[];
    /**
     * Entities selected to run the automation.
     */
    resources?: Resource;
    /**
     * Bot Token
     */
    botToken?: string;
    /**
     * User Token
     */
    userToken?:             string;
    backfillConfiguration?: BackfillConfiguration;
    /**
     * Maximum number of events processed at a time (Default 100).
     *
     * Maximum number of events sent in a batch (Default 100).
     */
    batchSize?:           number;
    moduleConfiguration?: ModuleConfiguration;
    /**
     * Recreates the DataAssets index on DataInsights. Useful if you changed a Custom Property
     * Type and are facing errors. Bear in mind that recreating the index will delete your
     * DataAssets and a backfill will be needed.
     */
    recreateDataAssetsIndex?: boolean;
    sendToAdmins?:            boolean;
    sendToTeams?:             boolean;
    /**
     * Enable automatic performance tuning based on cluster capabilities and database entity
     * count
     */
    autoTune?: boolean;
    /**
     * Number of threads to use for reindexing
     */
    consumerThreads?: number;
    /**
     * List of Entities to Reindex
     */
    entities?: string[];
    /**
     * Initial backoff time in milliseconds
     */
    initialBackoff?: number;
    /**
     * Maximum backoff time in milliseconds
     */
    maxBackoff?: number;
    /**
     * Maximum number of concurrent requests to the search index
     */
    maxConcurrentRequests?: number;
    /**
     * Maximum number of retries for a failed request
     */
    maxRetries?: number;
    /**
     * Maximum number of events sent in a batch (Default 100).
     */
    payLoadSize?: number;
    /**
     * Number of threads to use for reindexing
     */
    producerThreads?: number;
    /**
     * Queue Size to user internally for reindexing.
     */
    queueSize?: number;
    /**
     * This schema publisher run modes.
     */
    recreateIndex?: boolean;
    /**
     * Recreate Indexes with updated Language
     */
    searchIndexMappingLanguage?: SearchIndexMappingLanguage;
    /**
     * Whether the suggested tests should be active or not upon suggestion
     *
     * Whether the AutoPilot Workflow should be active or not.
     */
    active?: boolean;
    /**
     * Enter the retention period for Activity Threads of type = 'Conversation' records in days
     * (e.g., 30 for one month, 60 for two months).
     */
    activityThreadsRetentionPeriod?: number;
    /**
     * Enter the retention period for change event records in days (e.g., 7 for one week, 30 for
     * one month).
     */
    changeEventRetentionPeriod?: number;
    /**
     * Service Entity Link for which to trigger the application.
     */
    entityLink?: string;
    [property: string]: any;
}

/**
 * Action to take on those entities. E.g., propagate description through lineage, auto
 * tagging, etc.
 *
 * Apply Tags to the selected assets.
 *
 * Remove Tags Action Type
 *
 * Add an owner to the selected assets.
 *
 * Remove Owner Action Type
 *
 * Add a Custom Property to the selected assets.
 *
 * Add Test Cases to the selected assets.
 *
 * Remove Test Cases Action Type
 *
 * Add owners to the selected assets.
 *
 * Remove Custom Properties Action Type
 *
 * Add a Data Product to the selected assets.
 *
 * Remove a Data Product to the selected assets.
 *
 * Propagate description, tags and glossary terms via lineage
 *
 * ML Tagging action configuration for external automator.
 */
export interface Action {
    /**
     * Apply tags to the children of the selected assets that match the criteria. E.g., columns,
     * tasks, topic fields,...
     *
     * Remove tags from the children of the selected assets. E.g., columns, tasks, topic
     * fields,...
     *
     * Apply the description to the children of the selected assets that match the criteria.
     * E.g., columns, tasks, topic fields,...
     *
     * Remove descriptions from the children of the selected assets. E.g., columns, tasks, topic
     * fields,...
     *
     * Add tests to the selected table columns
     *
     * Remove tests to the selected table columns
     */
    applyToChildren?: string[];
    /**
     * Update tags even if they are already defined in the asset. By default, incoming tags are
     * merged with the existing ones.
     *
     * Update the domain even if it is defined in the asset. By default, we will only apply the
     * domain to assets without domain.
     *
     * Update the description even if they are already defined in the asset. By default, we'll
     * only add the descriptions to assets without the description set.
     *
     * Update the Custom Property even if it is defined in the asset. By default, we will only
     * apply the owners to assets without the given Custom Property informed.
     *
     * Update the tier even if it is defined in the asset. By default, we will only apply the
     * tier to assets without tier.
     *
     * Update the test even if it is defined in the asset. By default, we will only apply the
     * test to assets without the existing test already existing.
     *
     * Update the owners even if it is defined in the asset. By default, we will only apply the
     * owners to assets without owner.
     *
     * Update the Data Product even if the asset belongs to a different Domain. By default, we
     * will only add the Data Product if the asset has no Domain, or it belongs to the same
     * domain as the Data Product.
     *
     * Update descriptions, tags and Glossary Terms via lineage even if they are already defined
     * in the asset. By default, descriptions are only updated if they are not already defined
     * in the asset, and incoming tags are merged with the existing ones.
     */
    overwriteMetadata?: boolean;
    /**
     * Tags to apply
     *
     * Tags to remove
     */
    tags?: TagLabel[];
    /**
     * Application Type
     */
    type: ActionType;
    /**
     * Remove tags from all the children and parent of the selected assets.
     *
     * Remove descriptions from all the children and parent of the selected assets.
     */
    applyToAll?: boolean;
    /**
     * Remove tags by its label type
     */
    labels?: LabelElement[];
    /**
     * Domain to apply
     */
    domain?: EntityReference;
    /**
     * Description to apply
     */
    description?: string;
    /**
     * Owners to apply
     *
     * Custom Properties keys to remove
     */
    customProperties?: any;
    /**
     * tier to apply
     */
    tier?: TagLabel;
    /**
     * Test Cases to apply
     */
    testCases?: TestCaseDefinitions[];
    /**
     * Remove all test cases
     */
    removeAll?: boolean;
    /**
     * Test Cases to remove
     */
    testCaseDefinitions?: string[];
    /**
     * Owners to apply
     */
    owners?: EntityReference[];
    /**
     * Data Products to apply
     *
     * Data Products to remove
     */
    dataProducts?: EntityReference[];
    /**
     * Propagate the metadata to columns via column-level lineage.
     */
    propagateColumnLevel?: boolean;
    /**
     * Propagate description through lineage
     */
    propagateDescription?: boolean;
    /**
     * Propagate domain from the parent through lineage
     */
    propagateDomain?: boolean;
    /**
     * Propagate glossary terms through lineage
     */
    propagateGlossaryTerms?: boolean;
    /**
     * Propagate owner from the parent
     */
    propagateOwner?: boolean;
    /**
     * Propagate the metadata to the parents (e.g., tables) via lineage.
     */
    propagateParent?: boolean;
    /**
     * Propagate tags through lineage
     */
    propagateTags?: boolean;
    /**
     * Propagate tier from the parent
     */
    propagateTier?: boolean;
    /**
     * Number of levels to propagate lineage. If not set, it will propagate to all levels.
     */
    propagationDepth?: number;
}

/**
 * Domain to apply
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Owners to apply
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
 * Remove tags by its label type
 */
export enum LabelElement {
    Automated = "Automated",
    Manual = "Manual",
    Propagated = "Propagated",
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 *
 * tier to apply
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
    labelType: LabelTypeEnum;
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
export enum LabelTypeEnum {
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
 * Minimum set of requirements to get a Test Case request ready
 */
export interface TestCaseDefinitions {
    /**
     * Compute the passed and failed row count for the test case.
     */
    computePassedFailedRowCount?: boolean;
    parameterValues?:             TestCaseParameterValue[];
    /**
     * Tags to apply
     */
    tags?: TagLabel[];
    /**
     * Fully qualified name of the test definition.
     */
    testDefinition?: string;
    /**
     * If the test definition supports it, use dynamic assertion to evaluate the test case.
     */
    useDynamicAssertion?: boolean;
    [property: string]: any;
}

/**
 * This schema defines the parameter values that can be passed for a Test Case.
 */
export interface TestCaseParameterValue {
    /**
     * name of the parameter. Must match the parameter names in testCaseParameterDefinition
     */
    name?: string;
    /**
     * value to be passed for the Parameters. These are input from Users. We capture this in
     * string and convert during the runtime.
     */
    value?: string;
    [property: string]: any;
}

/**
 * Application Type
 *
 * Add Tags action type.
 *
 * Remove Tags Action Type.
 *
 * Add Owner Action Type.
 *
 * Remove Domain Action Type
 *
 * Add Description Action Type.
 *
 * Add Custom Properties Action Type.
 *
 * Remove Description Action Type
 *
 * Add Tier Action Type.
 *
 * Remove Tier Action Type
 *
 * Add Test Case Action Type.
 *
 * Remove Test Case Action Type
 *
 * Remove Owner Action Type
 *
 * Remove Custom Properties Action Type.
 *
 * Add Data Products Action Type.
 *
 * Remove Data Products Action Type.
 *
 * Lineage propagation action type.
 *
 * ML PII Tagging action type.
 */
export enum ActionType {
    AddCustomPropertiesAction = "AddCustomPropertiesAction",
    AddDataProductAction = "AddDataProductAction",
    AddDescriptionAction = "AddDescriptionAction",
    AddDomainAction = "AddDomainAction",
    AddOwnerAction = "AddOwnerAction",
    AddTagsAction = "AddTagsAction",
    AddTestCaseAction = "AddTestCaseAction",
    AddTierAction = "AddTierAction",
    LineagePropagationAction = "LineagePropagationAction",
    MLTaggingAction = "MLTaggingAction",
    RemoveCustomPropertiesAction = "RemoveCustomPropertiesAction",
    RemoveDataProductAction = "RemoveDataProductAction",
    RemoveDescriptionAction = "RemoveDescriptionAction",
    RemoveDomainAction = "RemoveDomainAction",
    RemoveOwnerAction = "RemoveOwnerAction",
    RemoveTagsAction = "RemoveTagsAction",
    RemoveTestCaseAction = "RemoveTestCaseAction",
    RemoveTierAction = "RemoveTierAction",
}

/**
 * Backfill Configuration
 */
export interface BackfillConfiguration {
    /**
     * Enable Backfill for the configured dates
     */
    enabled?: boolean;
    /**
     * Date for which the backfill will end
     */
    endDate?: Date;
    /**
     * Date from which to start the backfill
     */
    startDate?: Date;
    [property: string]: any;
}

/**
 * Different Module Configurations
 */
export interface ModuleConfiguration {
    /**
     * App Analytics Module configuration
     */
    appAnalytics: AppAnalyticsConfig;
    /**
     * Cost Analysis Insights Module configuration
     */
    costAnalysis: CostAnalysisConfig;
    /**
     * Data Assets Insights Module configuration
     */
    dataAssets: DataAssetsConfig;
    /**
     * Data Quality Insights Module configuration
     */
    dataQuality: DataQualityConfig;
}

/**
 * App Analytics Module configuration
 */
export interface AppAnalyticsConfig {
    /**
     * If Enabled, App Analytics insights will be populated when the App runs.
     */
    enabled: boolean;
}

/**
 * Cost Analysis Insights Module configuration
 */
export interface CostAnalysisConfig {
    /**
     * If Enabled, Cost Analysis insights will be populated when the App runs.
     */
    enabled: boolean;
}

/**
 * Data Assets Insights Module configuration
 */
export interface DataAssetsConfig {
    /**
     * If Enabled, Data Asset insights will be populated when the App runs.
     */
    enabled: boolean;
    /**
     * List of Entities to Reindex
     */
    entities?: string[];
    /**
     * Defines the number of days the Data Assets Insights information will be kept. After it
     * they will be deleted.
     */
    retention?:     number;
    serviceFilter?: ServiceFilter;
}

export interface ServiceFilter {
    serviceName?: string;
    serviceType?: string;
}

/**
 * Data Quality Insights Module configuration
 */
export interface DataQualityConfig {
    /**
     * If Enabled, Data Quality insights will be populated when the App runs.
     */
    enabled: boolean;
}

/**
 * Entities selected to run the automation.
 */
export interface Resource {
    /**
     * Filter JSON tree to be used for rendering the filters in the UI. This comes from
     * Immutable Tree type of react-awesome-query-builder.
     */
    filterJsonTree?: string;
    /**
     * Query filter to be passed to ES. E.g.,
     * `{"query":{"bool":{"must":[{"bool":{"should":[{"term":{"domain.displayName.keyword":"DG
     * Anim"}}]}}]}}}`. This is the same payload as in the Explore page.
     */
    queryFilter?: string;
    /**
     * Type of the entity. E.g., 'table', 'chart',...
     */
    type?: string[];
    [property: string]: any;
}

/**
 * Recreate Indexes with updated Language
 *
 * This schema defines the language options available for search index mappings.
 */
export enum SearchIndexMappingLanguage {
    En = "EN",
    Jp = "JP",
    Zh = "ZH",
}

/**
 * Application Type
 *
 * Application type.
 */
export enum Type {
    AutoPilotApplication = "AutoPilotApplication",
    Automator = "Automator",
    CollateAI = "CollateAI",
    CollateAIQualityAgent = "CollateAIQualityAgent",
    DataInsights = "DataInsights",
    DataInsightsReport = "DataInsightsReport",
    SearchIndexing = "SearchIndexing",
}

/**
 * This schema defines the type of application.
 */
export enum AppType {
    External = "external",
    Internal = "internal",
}

/**
 * This defines schema for sending alerts for OpenMetadata
 */
export interface CreateEventSubscription {
    /**
     * Type of Alert
     */
    alertType: AlertType;
    /**
     * Maximum number of events sent in a batch (Default 10).
     */
    batchSize?: number;
    /**
     * Consumer Class for the Event Subscription. Will use 'AlertPublisher' if not provided.
     */
    className?: string;
    config?:    { [key: string]: any };
    /**
     * A short description of the Alert, comprehensible to regular users.
     */
    description?: string;
    /**
     * Subscription Config.
     */
    destinations?: Destination[];
    /**
     * Display name for this Alert.
     */
    displayName?: string;
    /**
     * Fully qualified name of the domain the Table belongs to.
     */
    domain?: string;
    /**
     * Is the alert enabled.
     */
    enabled?: boolean;
    /**
     * Input for the Filters.
     */
    input?: AlertFilteringInput;
    /**
     * Name that uniquely identifies this Alert.
     */
    name: string;
    /**
     * Owners of this Alert.
     */
    owners?: EntityReference[];
    /**
     * Poll Interval in seconds.
     */
    pollInterval?: number;
    provider?:     ProviderType;
    /**
     * Defines a list of resources that triggers the Event Subscription, Eg All, User, Teams etc.
     */
    resources?: string[];
    /**
     * Number of times to retry callback on failure. (Default 3).
     */
    retries?: number;
    trigger?: Trigger;
}

/**
 * Type of Alert
 *
 * Type of Alerts supported.
 */
export enum AlertType {
    ActivityFeed = "ActivityFeed",
    Custom = "Custom",
    GovernanceWorkflowChangeEvent = "GovernanceWorkflowChangeEvent",
    Notification = "Notification",
    Observability = "Observability",
}

/**
 * Subscription which has a type and the config.
 */
export interface Destination {
    category: SubscriptionCategory;
    config?:  Webhook;
    /**
     * Is the subscription enabled.
     */
    enabled?: boolean;
    /**
     * Unique identifier that identifies this Event Subscription.
     */
    id?: string;
    /**
     * Read timeout in seconds. (Default 12s).
     */
    readTimeout?:   number;
    statusDetails?: TionStatus;
    /**
     * Connection timeout in seconds. (Default 10s).
     */
    timeout?: number;
    type:     SubscriptionType;
}

/**
 * Subscription Endpoint Type.
 */
export enum SubscriptionCategory {
    Admins = "Admins",
    Assignees = "Assignees",
    External = "External",
    Followers = "Followers",
    Mentions = "Mentions",
    Owners = "Owners",
    Teams = "Teams",
    Users = "Users",
}

/**
 * This schema defines webhook for receiving events from OpenMetadata.
 *
 * This schema defines email config for receiving events from OpenMetadata.
 *
 * A generic map that can be deserialized later.
 */
export interface Webhook {
    /**
     * Endpoint to receive the webhook events over POST requests.
     */
    endpoint?: string;
    /**
     * Custom headers to be sent with the webhook request.
     */
    headers?: { [key: string]: any };
    /**
     * HTTP operation to send the webhook request. Supports POST or PUT.
     */
    httpMethod?: HTTPMethod;
    /**
     * Query parameters to be added to the webhook request URL.
     */
    queryParams?: { [key: string]: any };
    /**
     * List of receivers to send mail to
     */
    receivers?: string[];
    /**
     * Secret set by the webhook client used for computing HMAC SHA256 signature of webhook
     * payload and sent in `X-OM-Signature` header in POST requests to publish the events.
     */
    secretKey?: string;
    /**
     * Send the Event to Admins
     *
     * Send the Mails to Admins
     */
    sendToAdmins?: boolean;
    /**
     * Send the Event to Followers
     *
     * Send the Mails to Followers
     */
    sendToFollowers?: boolean;
    /**
     * Send the Event to Owners
     *
     * Send the Mails to Owners
     */
    sendToOwners?: boolean;
    [property: string]: any;
}

/**
 * HTTP operation to send the webhook request. Supports POST or PUT.
 */
export enum HTTPMethod {
    Post = "POST",
    Put = "PUT",
}

/**
 * Current status of the subscription, including details on the last successful and failed
 * attempts, and retry information.
 *
 * Detailed status of the destination during a test operation, including HTTP response
 * information.
 */
export interface TionStatus {
    /**
     * Timestamp of the last failed callback in UNIX UTC epoch time in milliseconds.
     */
    lastFailedAt?: number;
    /**
     * Detailed reason for the last failure received during callback.
     */
    lastFailedReason?: string;
    /**
     * HTTP status code received during the last failed callback attempt.
     */
    lastFailedStatusCode?: number;
    /**
     * Timestamp of the last successful callback in UNIX UTC epoch time in milliseconds.
     */
    lastSuccessfulAt?: number;
    /**
     * Timestamp for the next retry attempt in UNIX epoch time in milliseconds. Only valid if
     * `status` is `awaitingRetry`.
     */
    nextAttempt?: number;
    /**
     * Status is `disabled` when the event subscription was created with `enabled` set to false
     * and it never started publishing events. Status is `active` when the event subscription is
     * functioning normally and a 200 OK response was received for the callback notification.
     * Status is `failed` when a bad callback URL, connection failures, or `1xx` or `3xx`
     * response was received for the callback notification. Status is `awaitingRetry` when the
     * previous attempt at callback timed out or received a `4xx` or `5xx` response. Status is
     * `retryLimitReached` after all retries fail.
     *
     * Overall test status, indicating if the test operation succeeded or failed.
     */
    status?: Status;
    /**
     * Current timestamp of this status in UNIX epoch time in milliseconds.
     *
     * Timestamp when the response was received, in UNIX epoch time milliseconds.
     */
    timestamp?: number;
    /**
     * Body of the HTTP response, if any, returned by the server.
     */
    entity?: string;
    /**
     * HTTP headers returned in the response as a map of header names to values.
     */
    headers?: any;
    /**
     * URL location if the response indicates a redirect or newly created resource.
     */
    location?: string;
    /**
     * Media type of the response entity, if specified (e.g., application/json).
     */
    mediaType?: string;
    /**
     * Detailed reason for failure if the test did not succeed.
     */
    reason?: string;
    /**
     * HTTP status code of the response (e.g., 200 for OK, 404 for Not Found).
     */
    statusCode?: number;
    /**
     * HTTP status reason phrase associated with the status code (e.g., 'Not Found').
     */
    statusInfo?: string;
}

/**
 * Status is `disabled` when the event subscription was created with `enabled` set to false
 * and it never started publishing events. Status is `active` when the event subscription is
 * functioning normally and a 200 OK response was received for the callback notification.
 * Status is `failed` when a bad callback URL, connection failures, or `1xx` or `3xx`
 * response was received for the callback notification. Status is `awaitingRetry` when the
 * previous attempt at callback timed out or received a `4xx` or `5xx` response. Status is
 * `retryLimitReached` after all retries fail.
 *
 * Overall test status, indicating if the test operation succeeded or failed.
 */
export enum Status {
    Active = "active",
    AwaitingRetry = "awaitingRetry",
    Disabled = "disabled",
    Failed = "failed",
    RetryLimitReached = "retryLimitReached",
    StatusFailed = "Failed",
    Success = "Success",
}

/**
 * Subscription Endpoint Type.
 */
export enum SubscriptionType {
    ActivityFeed = "ActivityFeed",
    Email = "Email",
    GChat = "GChat",
    GovernanceWorkflowChangeEvent = "GovernanceWorkflowChangeEvent",
    MSTeams = "MsTeams",
    Slack = "Slack",
    Webhook = "Webhook",
}

/**
 * Input for the Filters.
 *
 * Observability of the event subscription.
 */
export interface AlertFilteringInput {
    /**
     * List of filters for the event subscription.
     */
    actions?: ArgumentsInput[];
    /**
     * List of filters for the event subscription.
     */
    filters?: ArgumentsInput[];
}

/**
 * Observability Filters for Event Subscription.
 */
export interface ArgumentsInput {
    /**
     * Arguments List
     */
    arguments?: Argument[];
    effect?:    Effect;
    /**
     * Name of the filter
     */
    name?: string;
    /**
     * Prefix Condition for the filter.
     */
    prefixCondition?: PrefixCondition;
}

/**
 * Argument for the filter.
 */
export interface Argument {
    /**
     * Value of the Argument
     */
    input?: string[];
    /**
     * Name of the Argument
     */
    name?: string;
}

export enum Effect {
    Exclude = "exclude",
    Include = "include",
}

/**
 * Prefix Condition for the filter.
 *
 * Prefix Condition to be applied to the Condition.
 */
export enum PrefixCondition {
    And = "AND",
    Or = "OR",
}

/**
 * Type of provider of an entity. Some entities are provided by the `system`. Some are
 * entities created and provided by the `user`. Typically `system` provide entities can't be
 * deleted and can only be disabled. Some apps such as AutoPilot create entities with
 * `automation` provider type. These entities can be deleted by the user.
 */
export enum ProviderType {
    Automation = "automation",
    System = "system",
    User = "user",
}

/**
 * Trigger Configuration for Alerts.
 */
export interface Trigger {
    /**
     * Cron Expression in case of Custom scheduled Trigger
     */
    cronExpression?: string;
    /**
     * Schedule Info
     */
    scheduleInfo?: ScheduleInfo;
    triggerType:   TriggerType;
}

/**
 * Schedule Info
 */
export enum ScheduleInfo {
    Custom = "Custom",
    Daily = "Daily",
    Monthly = "Monthly",
    Weekly = "Weekly",
}

/**
 * Trigger Configuration for Alerts.
 */
export enum TriggerType {
    RealTime = "RealTime",
    Scheduled = "Scheduled",
}

/**
 * Permission used by Native Applications.
 *
 * This schema defines the Permission used by Native Application.
 */
export enum Permissions {
    All = "All",
}

/**
 * If app type is live, user can provide additional runtime context.
 *
 * Execution Configuration.
 *
 * Live Execution object.
 *
 * Scheduled Execution Context Configuration.
 */
export interface ExecutionContext {
}

/**
 * This schema defines the Schedule Type of Application.
 *
 * This schema defines the type of application.
 */
export enum ScheduleType {
    Live = "Live",
    NoSchedule = "NoSchedule",
    OnlyManual = "OnlyManual",
    Scheduled = "Scheduled",
    ScheduledOrManual = "ScheduledOrManual",
}
