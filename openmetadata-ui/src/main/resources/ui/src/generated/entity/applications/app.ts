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
export interface App {
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
     * In case the app supports scheduling, list of different app schedules
     */
    appSchedule?: any[] | boolean | AppScheduleClass | number | number | null | string;
    /**
     * Application Screenshots.
     */
    appScreenshots?: string[];
    /**
     * This schema defines the type of application.
     */
    appType: AppType;
    /**
     * Bot User Associated with this application.
     */
    bot?: EntityReference;
    /**
     * Change that lead to this version of the entity.
     */
    changeDescription?: ChangeDescription;
    /**
     * Fully Qualified ClassName for the Schedule
     */
    className: string;
    /**
     * When `true` indicates the entity has been soft deleted.
     */
    deleted?: boolean;
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
     * Domains the asset belongs to. When not set, the asset inherits the domain from the parent
     * it belongs to.
     */
    domains?: EntityReference[];
    /**
     * Event Subscriptions for the Application.
     */
    eventSubscriptions?: EntityReference[];
    /**
     * Features of the Application.
     */
    features?: string;
    /**
     * FullyQualifiedName same as `name`.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the resource corresponding to this entity.
     */
    href?: string;
    /**
     * Unique identifier of this application.
     */
    id: string;
    /**
     * Change that lead to this version of the entity.
     */
    incrementalChangeDescription?: ChangeDescription;
    /**
     * Name of the Application.
     */
    name:                          string;
    openMetadataServerConnection?: OpenMetadataConnection;
    /**
     * Owners of this workflow.
     */
    owners?: EntityReference[];
    /**
     * Permission used by Native Applications.
     */
    permission: Permissions;
    /**
     * References to pipelines deployed for this database service to extract metadata, usage,
     * lineage etc..
     */
    pipelines?: EntityReference[];
    /**
     * Flag to enable/disable preview for the application. If the app is in preview mode, it
     * can't be installed.
     */
    preview?: boolean;
    /**
     * Privacy Policy for the developer
     */
    privacyPolicyUrl?: string;
    /**
     * Application Private configuration loaded at runtime.
     */
    privateConfiguration?: PrivateConfig;
    provider?:             ProviderType;
    /**
     * Execution Configuration.
     */
    runtime: ExecutionContext;
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
 * Add domains to the selected assets.
 *
 * Remove domains from the selected assets.
 *
 * Add a Custom Property to the selected assets.
 *
 * Remove Owner Action Type
 *
 * Add an owner to the selected assets.
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
     * Update the domains even if they are defined in the asset. By default, we will only apply
     * the domains to assets without domains.
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
    tags?: TierElement[];
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
     * Domains to apply
     */
    domains?: EntityReference[];
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
    tier?: TierElement;
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
     * Propagate domains from the parent through lineage
     */
    propagateDomains?: boolean;
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
    /**
     * List of configurations to stop propagation based on conditions
     */
    propagationStopConfigs?: PropagationStopConfig[];
}

/**
 * Domains to apply
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
 * Bot User Associated with this application.
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
 * Configuration to stop lineage propagation based on conditions
 */
export interface PropagationStopConfig {
    /**
     * The metadata attribute to check for stopping propagation
     */
    metadataAttribute: MetadataAttribute;
    /**
     * List of attribute values that will stop propagation when any of them is matched
     */
    value: Array<TagLabel | string>;
}

/**
 * The metadata attribute to check for stopping propagation
 */
export enum MetadataAttribute {
    Description = "description",
    Domain = "domain",
    GlossaryTerms = "glossaryTerms",
    Owner = "owner",
    Tags = "tags",
    Tier = "tier",
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 *
 * tier to apply
 *
 * Domains to apply
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
 * Bot User Associated with this application.
 */
export interface TagLabel {
    /**
     * Description for the tag label.
     *
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this tag.
     *
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Link to the tag resource.
     *
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
     * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
     * relationship (see Classification.json for more details). 'Propagated` indicates a tag
     * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
     * used to determine the tag label.
     */
    labelType?: LabelTypeEnum;
    /**
     * Name of the tag or glossary term.
     *
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Label is from Tags or Glossary.
     */
    source?: TagSource;
    /**
     * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
     * entity must confirm the suggested labels before it is marked as 'Confirmed'.
     */
    state?:  State;
    style?:  Style;
    tagFQN?: string;
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
     */
    fullyQualifiedName?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id?: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type?: string;
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
 * This schema defines the type for labeling an entity with a Tag.
 *
 * tier to apply
 */
export interface TierElement {
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
    tags?: TierElement[];
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
 * Add Domain Action Type.
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
 * Add Owner Action Type.
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

export interface AppScheduleClass {
    /**
     * Cron Expression in case of Custom scheduled Trigger
     */
    cronExpression?:  string;
    scheduleTimeline: ScheduleTimeline;
}

/**
 * This schema defines the Application ScheduleTimeline Options
 */
export enum ScheduleTimeline {
    Custom = "Custom",
    Daily = "Daily",
    Hourly = "Hourly",
    Monthly = "Monthly",
    None = "None",
    Weekly = "Weekly",
}

/**
 * This schema defines the type of application.
 */
export enum AppType {
    External = "external",
    Internal = "internal",
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
 * OpenMetadata Connection Config
 */
export interface OpenMetadataConnection {
    /**
     * OpenMetadata server API version to use.
     */
    apiVersion?: string;
    /**
     * OpenMetadata Server Authentication Provider.
     */
    authProvider?: AuthProvider;
    /**
     * Cluster name to differentiate OpenMetadata Server instance
     */
    clusterName?: string;
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Configuration for Sink Component in the OpenMetadata Ingestion Framework.
     */
    elasticsSearch?: ElasticsSearch;
    /**
     * Validate Openmetadata Server & Client Version.
     */
    enableVersionValidation?: boolean;
    extraHeaders?:            { [key: string]: string };
    /**
     * Force the overwriting of any entity during the ingestion.
     */
    forceEntityOverwriting?: boolean;
    /**
     * OpenMetadata Server Config. Must include API end point ex: http://localhost:8585/api
     */
    hostPort: string;
    /**
     * Include Dashboards for Indexing
     */
    includeDashboards?: boolean;
    /**
     * Include Database Services for Indexing
     */
    includeDatabaseServices?: boolean;
    /**
     * Include Glossary Terms for Indexing
     */
    includeGlossaryTerms?: boolean;
    /**
     * Include Messaging Services for Indexing
     */
    includeMessagingServices?: boolean;
    /**
     * Include MlModels for Indexing
     */
    includeMlModels?: boolean;
    /**
     * Include Pipelines for Indexing
     */
    includePipelines?: boolean;
    /**
     * Include Pipeline Services for Indexing
     */
    includePipelineServices?: boolean;
    /**
     * Include Tags for Policy
     */
    includePolicy?: boolean;
    /**
     * Include Tables for Indexing
     */
    includeTables?: boolean;
    /**
     * Include Tags for Indexing
     */
    includeTags?: boolean;
    /**
     * Include Teams for Indexing
     */
    includeTeams?: boolean;
    /**
     * Include Topics for Indexing
     */
    includeTopics?: boolean;
    /**
     * Include Users for Indexing
     */
    includeUsers?: boolean;
    /**
     * Limit the number of records for Indexing.
     */
    limitRecords?: number;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * Secrets Manager Loader for the Pipeline Service Client.
     */
    secretsManagerLoader?: SecretsManagerClientLoader;
    /**
     * Secrets Manager Provider for OpenMetadata Server.
     */
    secretsManagerProvider?: SecretsManagerProvider;
    /**
     * OpenMetadata Client security configuration.
     */
    securityConfig?: OpenMetadataJWTClientConfig;
    /**
     * SSL Configuration for OpenMetadata Server
     */
    sslConfig?: Config;
    /**
     * If set to true, when creating a service during the ingestion we will store its Service
     * Connection. Otherwise, the ingestion will create a bare service without connection
     * details.
     */
    storeServiceConnection?: boolean;
    /**
     * Flag to enable Data Insight Extraction
     */
    supportsDataInsightExtraction?: boolean;
    /**
     * Flag to enable ElasticSearch Reindexing Extraction
     */
    supportsElasticSearchReindexingExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: OpenmetadataType;
    /**
     * Flag to verify SSL Certificate for OpenMetadata Server.
     */
    verifySSL?: VerifySSL;
}

/**
 * OpenMetadata Server Authentication Provider.
 *
 * OpenMetadata Server Authentication Provider. Make sure configure same auth providers as
 * the one configured on OpenMetadata server.
 */
export enum AuthProvider {
    Auth0 = "auth0",
    AwsCognito = "aws-cognito",
    Azure = "azure",
    Basic = "basic",
    CustomOidc = "custom-oidc",
    Google = "google",
    LDAP = "ldap",
    Okta = "okta",
    Openmetadata = "openmetadata",
    Saml = "saml",
}

/**
 * Regex to only include/exclude databases that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include/exclude schemas that matches the pattern.
 *
 * Regex to only include/exclude tables that matches the pattern.
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
 * Configuration for Sink Component in the OpenMetadata Ingestion Framework.
 */
export interface ElasticsSearch {
    config?: { [key: string]: any };
    /**
     * Type of sink component ex: metadata
     */
    type: string;
}

/**
 * Secrets Manager Loader for the Pipeline Service Client.
 *
 * OpenMetadata Secrets Manager Client Loader. Lets the client know how the Secrets Manager
 * Credentials should be loaded from the environment.
 */
export enum SecretsManagerClientLoader {
    Airflow = "airflow",
    Env = "env",
    Noop = "noop",
}

/**
 * Secrets Manager Provider for OpenMetadata Server.
 *
 * OpenMetadata Secrets Manager Provider. Make sure to configure the same secrets manager
 * providers as the ones configured on the OpenMetadata server.
 */
export enum SecretsManagerProvider {
    Aws = "aws",
    AwsSsm = "aws-ssm",
    AzureKv = "azure-kv",
    DB = "db",
    Gcp = "gcp",
    InMemory = "in-memory",
    Kubernetes = "kubernetes",
    ManagedAws = "managed-aws",
    ManagedAwsSsm = "managed-aws-ssm",
    ManagedAzureKv = "managed-azure-kv",
}

/**
 * OpenMetadata Client security configuration.
 *
 * openMetadataJWTClientConfig security configs.
 */
export interface OpenMetadataJWTClientConfig {
    /**
     * OpenMetadata generated JWT token.
     */
    jwtToken: string;
}

/**
 * SSL Configuration for OpenMetadata Server
 *
 * Client SSL configuration
 *
 * OpenMetadata Client configured to validate SSL certificates.
 */
export interface Config {
    /**
     * The CA certificate used for SSL validation.
     */
    caCertificate?: string;
    /**
     * The SSL certificate used for client authentication.
     */
    sslCertificate?: string;
    /**
     * The private key associated with the SSL certificate.
     */
    sslKey?: string;
}

/**
 * Service Type
 *
 * OpenMetadata service type
 */
export enum OpenmetadataType {
    OpenMetadata = "OpenMetadata",
}

/**
 * Flag to verify SSL Certificate for OpenMetadata Server.
 *
 * Client SSL verification. Make sure to configure the SSLConfig if enabled.
 */
export enum VerifySSL {
    Ignore = "ignore",
    NoSSL = "no-ssl",
    Validate = "validate",
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
 * Application Private configuration loaded at runtime.
 *
 * Private Configuration for the CollateAI External Application.
 */
export interface PrivateConfig {
    /**
     * Collate Server public URL. WAII will use this information to interact with the server.
     * E.g., https://sandbox.getcollate.io
     */
    collateURL?: string;
    /**
     * Limits for the CollateAI Application.
     */
    limits?: AppLimitsConfig;
    /**
     * WAII API Token
     */
    token?: string;
    /**
     * WAII API host URL
     */
    waiiInstance?: string;
    [property: string]: any;
}

/**
 * Limits for the CollateAI Application.
 *
 * Private Configuration for the App Limits.
 */
export interface AppLimitsConfig {
    /**
     * The records of the limits.
     */
    actions: { [key: string]: number };
    /**
     * The start of this limit cycle.
     */
    billingCycleStart: Date;
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
