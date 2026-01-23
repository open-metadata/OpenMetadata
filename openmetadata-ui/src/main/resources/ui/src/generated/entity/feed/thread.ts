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
 * This schema defines the Thread entity. A Thread is a collection of posts made by the
 * users. The first post that starts a thread is **about** a data asset **from** a user.
 * Other users can respond to this post by creating new posts in the thread. Note that bot
 * users can also interact with a thread. A post can contains links that mention Users or
 * other Data Assets.
 */
export interface Thread {
    /**
     * Data asset about which this thread is created for with format
     * <#E::{entities}::{entityName}::{field}::{fieldValue}.
     */
    about: string;
    /**
     * User or team this thread is addressed to in format
     * <#E::{entities}::{entityName}::{field}::{fieldValue}.
     */
    addressedTo?: string;
    /**
     * Details about the announcement. This is only applicable if thread is of type announcement.
     */
    announcement?: AnnouncementDetails;
    /**
     * Card style for the thread.
     */
    cardStyle?: CardStyle;
    /**
     * Change that led to this version of the Thread.
     */
    changeDescription?: ChangeDescription;
    /**
     * Details about the Chatbot conversation. This is only applicable if thread is of type
     * Chatbot.
     */
    chatbot?: ChatbotDetails;
    /**
     * User who created the thread.
     */
    createdBy?: string;
    /**
     * Domain the entity belongs to.
     */
    domains?: string[];
    /**
     * Reference to the entity in `about` that the thread belongs to.
     */
    entityRef?: EntityReference;
    /**
     * Link to the entity in `about` that the thread belongs to.
     */
    entityUrlLink?: string;
    /**
     * Entity Id of the entity in `about` that the thread belongs to.
     */
    feedInfo?: FeedInfo;
    /**
     * Operation on thread, whether the field was added, or updated or deleted.
     */
    fieldOperation?: FieldOperation;
    /**
     * User or team that generated the thread.
     */
    generatedBy?: GeneratedBy;
    /**
     * Link to the resource corresponding to this entity.
     */
    href?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id: string;
    /**
     * Bot user that performed the action on behalf of the actual user.
     */
    impersonatedBy?: string;
    /**
     * The main message of the thread in Markdown format.
     */
    message: string;
    posts?:  Post[];
    /**
     * The total count of posts in the thread.
     */
    postsCount?: number;
    /**
     * Reactions for the thread.
     */
    reactions?: Reaction[];
    /**
     * When `true` indicates the thread has been resolved.
     */
    resolved?: boolean;
    /**
     * Details about the task. This is only applicable if thread is of type task.
     */
    task?: TaskDetails;
    /**
     * Timestamp of the first post created the thread in Unix epoch time milliseconds.
     */
    threadTs?: number;
    type?:     ThreadType;
    /**
     * Last update time corresponding to the new version of the entity in Unix epoch time
     * milliseconds.
     */
    updatedAt?: number;
    /**
     * User who made the update.
     */
    updatedBy?: string;
}

/**
 * Details about the announcement. This is only applicable if thread is of type announcement.
 */
export interface AnnouncementDetails {
    /**
     * Announcement description in Markdown format. See markdown support for more details.
     */
    description?: string;
    /**
     * Timestamp of when the announcement should end
     */
    endTime: number;
    /**
     * Timestamp of the start time from when the announcement should be shown.
     */
    startTime: number;
}

/**
 * Card style for the thread.
 */
export enum CardStyle {
    Assets = "assets",
    CustomProperties = "customProperties",
    Default = "default",
    Description = "description",
    Domain = "domain",
    EntityCreated = "entityCreated",
    EntityDeleted = "entityDeleted",
    EntitySoftDeleted = "entitySoftDeleted",
    LogicalTestCaseAdded = "logicalTestCaseAdded",
    Owner = "owner",
    Tags = "tags",
    TestCaseResult = "testCaseResult",
}

/**
 * Change that led to this version of the Thread.
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
 * Details about the Chatbot conversation. This is only applicable if thread is of type
 * Chatbot.
 */
export interface ChatbotDetails {
    /**
     * The query being discussed with the Chatbot
     */
    query?: string;
    [property: string]: any;
}

/**
 * Reference to the entity in `about` that the thread belongs to.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Reference to the test case for efficient querying of dimensional time series
 *
 * Test case that this result is for.
 *
 * Test definition that this result is for.
 *
 * User who reacted.
 *
 * User who provided the feedback
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
 * Entity Id of the entity in `about` that the thread belongs to.
 */
export interface FeedInfo {
    entitySpecificInfo?: Info;
    /**
     * Field Name message for the feed.
     */
    fieldName?: string;
    /**
     * Header message for the feed.
     */
    headerMessage?: string;
}

/**
 * This schema defines the schema for Assets addition/deletion Updates.
 *
 * This schema defines the custom properties addition/deltion schema on feed.
 *
 * This schema defines the schema for Description Updates.
 *
 * EntityInfo In case of Entity Created, Updated Or Deleted.
 *
 * This schema defines the schema for Test Case Result Updates for Feed.
 */
export interface Info {
    updatedAssets?: EntityReference[];
    /**
     * Previous Custom Property.
     */
    previousValue?: any;
    /**
     * Updated Custom Property.
     */
    updatedValue?: any;
    /**
     * The difference between the previous and new descriptions.
     */
    diffMessage?: string;
    /**
     * The new description of the entity.
     */
    newDescription?: string;
    /**
     * The previous description of the entity.
     */
    previousDescription?: string;
    /**
     * Previous Domains.
     */
    previousDomains?: EntityReference[];
    /**
     * Updated Domains.
     */
    updatedDomains?: EntityReference[];
    /**
     * Entity Details in case of Creation , Soft Deletion and Deletion.
     */
    entity?: any;
    /**
     * Summary of test case execution
     */
    entityTestResultSummary?: Array<any[] | boolean | number | number | null | EntityTestResultSummaryObject | string>;
    /**
     * Summary of test case execution
     */
    parameterValues?: TestCaseParameterValue[];
    /**
     * Test Case Result for last 7 days.
     */
    testCaseResult?: TestCaseResult[];
}

export interface EntityTestResultSummaryObject {
    /**
     * Status of the test case.
     */
    status?: TestCaseStatus;
    /**
     * Name of the test case.
     */
    testCaseName?: string;
    /**
     * Timestamp of the test case execution.
     */
    timestamp?: number;
    [property: string]: any;
}

/**
 * Status of the test case.
 *
 * Status of Test Case run.
 *
 * Status of the test for this dimension combination
 */
export enum TestCaseStatus {
    Aborted = "Aborted",
    Failed = "Failed",
    Queued = "Queued",
    Success = "Success",
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
 * Schema to capture test case result.
 */
export interface TestCaseResult {
    /**
     * List of dimensional test results. Only populated when the test case has dimensionColumns
     * specified.
     */
    dimensionResults?: TestCaseDimensionResult[];
    /**
     * Number of rows that failed.
     */
    failedRows?: number;
    /**
     * Percentage of rows that failed.
     */
    failedRowsPercentage?: number;
    /**
     * Unique identifier of this failure instance
     */
    id?: string;
    /**
     * Incident State ID associated with this result. This association happens when the result
     * is created, and will stay there even when the incident is resolved.
     */
    incidentId?: string;
    /**
     * Upper bound limit for the test case result as defined in the test definition.
     */
    maxBound?: number;
    /**
     * Lower bound limit for the test case result as defined in the test definition.
     */
    minBound?: number;
    /**
     * Number of rows that passed.
     */
    passedRows?: number;
    /**
     * Percentage of rows that passed.
     */
    passedRowsPercentage?: number;
    /**
     * Details of test case results.
     */
    result?: string;
    /**
     * sample data to capture rows/columns that didn't match the expressed testcase.
     */
    sampleData?: string;
    /**
     * Test case that this result is for.
     */
    testCase?: EntityReference;
    /**
     * Fully qualified name of the test case.
     */
    testCaseFQN?: string;
    /**
     * Status of Test Case run.
     */
    testCaseStatus?: TestCaseStatus;
    /**
     * Test definition that this result is for.
     */
    testDefinition?:  EntityReference;
    testResultValue?: TestResultValue[];
    /**
     * Data one which test case result is taken.
     */
    timestamp: number;
    [property: string]: any;
}

/**
 * Test case result for dimensional analysis - supports both single and multi-dimensional
 * groupings
 */
export interface TestCaseDimensionResult {
    /**
     * Composite key for API filtering: 'region=mumbai' or 'region=mumbai,product=laptop'
     */
    dimensionKey: string;
    /**
     * Array of dimension name-value pairs for this result (e.g., [{'name': 'region', 'value':
     * 'mumbai'}, {'name': 'product', 'value': 'laptop'}])
     */
    dimensionValues: DimensionValue[];
    /**
     * Number of rows that failed for this dimension combination
     */
    failedRows?: number;
    /**
     * Percentage of rows that failed for this dimension combination
     */
    failedRowsPercentage?: number;
    /**
     * Unique identifier of this dimensional result instance
     */
    id: string;
    /**
     * Impact score indicating the significance of this dimension for revealing data quality
     * variations. Higher scores indicate dimensions with more significant quality issues
     * considering both failure rate and data volume.
     */
    impactScore?: number;
    /**
     * Number of rows that passed for this dimension combination
     */
    passedRows?: number;
    /**
     * Percentage of rows that passed for this dimension combination
     */
    passedRowsPercentage?: number;
    /**
     * Details of test case results for this dimension combination
     */
    result?: string;
    /**
     * Reference to the test case for efficient querying of dimensional time series
     */
    testCase?: EntityReference;
    /**
     * Reference to the parent TestCaseResult execution that generated this dimensional result
     */
    testCaseResultId: string;
    /**
     * Status of the test for this dimension combination
     */
    testCaseStatus: TestCaseStatus;
    /**
     * Test result values for this dimension combination
     */
    testResultValue?: TestResultValue[];
    /**
     * Timestamp when the dimensional test result was captured (same as parent TestCaseResult)
     */
    timestamp: number;
}

/**
 * A single dimension name-value pair for dimensional test results
 */
export interface DimensionValue {
    /**
     * Name of the dimension (e.g., 'column', 'region', 'tier')
     */
    name: string;
    /**
     * Value for this dimension (e.g., 'address', 'US', 'gold')
     */
    value: string;
}

/**
 * Schema to capture test case result values.
 */
export interface TestResultValue {
    /**
     * name of the value
     */
    name?: string;
    /**
     * predicted value
     */
    predictedValue?: string;
    /**
     * test result value
     */
    value?: string;
    [property: string]: any;
}

/**
 * Operation on thread, whether the field was added, or updated or deleted.
 */
export enum FieldOperation {
    Added = "added",
    Deleted = "deleted",
    None = "none",
    Updated = "updated",
}

/**
 * User or team that generated the thread.
 */
export enum GeneratedBy {
    System = "system",
    User = "user",
}

/**
 * Post within a feed.
 */
export interface Post {
    /**
     * Name of the User posting the message.
     */
    from: string;
    /**
     * Unique identifier that identifies the post.
     */
    id: string;
    /**
     * Message in Markdown format. See Markdown support for more details.
     */
    message: string;
    /**
     * Timestamp of the post in Unix epoch time milliseconds.
     */
    postTs?: number;
    /**
     * Reactions for the post.
     */
    reactions?: Reaction[];
}

/**
 * Reactions for the post.
 *
 * This schema defines the reaction to an entity or a conversation in the activity feeds.
 */
export interface Reaction {
    reactionType: ReactionType;
    /**
     * User who reacted.
     */
    user: EntityReference;
}

/**
 * Type of reaction.
 */
export enum ReactionType {
    Confused = "confused",
    Eyes = "eyes",
    Heart = "heart",
    Hooray = "hooray",
    Laugh = "laugh",
    Rocket = "rocket",
    ThumbsDown = "thumbsDown",
    ThumbsUp = "thumbsUp",
}

/**
 * Details about the task. This is only applicable if thread is of type task.
 */
export interface TaskDetails {
    /**
     * List of users or teams the task is assigned to
     */
    assignees: EntityReference[];
    /**
     * Timestamp when the task was closed in Unix epoch time milliseconds.
     */
    closedAt?: number;
    /**
     * The user that closed the task.
     */
    closedBy?: string;
    /**
     * The recognizer feedback that we're reviewing for the Tag that's supposed to be pointed by
     * this task
     */
    feedback?: RecognizerFeedback;
    /**
     * Unique identifier that identifies the task.
     */
    id: number;
    /**
     * The new value object that was accepted to complete the task.
     */
    newValue?: string;
    /**
     * The value of old object for which the task is created.
     */
    oldValue?: string;
    status?:   ThreadTaskStatus;
    /**
     * The suggestion object to replace the old value for which the task is created.
     */
    suggestion?: string;
    /**
     * The test case resolution status id for which the task is created.
     */
    testCaseResolutionStatusId?: string;
    type:                        TaskType;
}

/**
 * The recognizer feedback that we're reviewing for the Tag that's supposed to be pointed by
 * this task
 *
 * User feedback on auto-applied tags from recognizers
 */
export interface RecognizerFeedback {
    createdAt?: number;
    /**
     * User who provided the feedback
     */
    createdBy?: EntityReference;
    /**
     * Link to the specific field where the tag was incorrectly applied (e.g.,
     * <#E::table::customers::columns::company_name>)
     */
    entityLink: string;
    /**
     * Type of feedback
     */
    feedbackType: FeedbackType;
    /**
     * Unique identifier of the feedback
     */
    id?: string;
    /**
     * Information about which recognizer triggered this
     */
    recognizerInfo?: RecognizerInfo;
    /**
     * How this feedback was resolved
     */
    resolution?: Resolution;
    /**
     * Example values from this field that triggered the false positive (anonymized)
     */
    sampleValues?: string[];
    /**
     * Processing status
     */
    status?: Status;
    /**
     * Tag the user thinks should be applied instead (optional)
     */
    suggestedTag?: string;
    /**
     * Fully qualified name of the incorrectly applied tag
     */
    tagFQN: string;
    /**
     * Additional context from the user
     */
    userComments?: string;
    /**
     * User-selected reason for reporting
     */
    userReason?: UserReason;
}

/**
 * Type of feedback
 */
export enum FeedbackType {
    ContextSpecific = "CONTEXT_SPECIFIC",
    FalsePositive = "FALSE_POSITIVE",
    IncorrectClassification = "INCORRECT_CLASSIFICATION",
    OverlyBroad = "OVERLY_BROAD",
}

/**
 * Information about which recognizer triggered this
 */
export interface RecognizerInfo {
    confidenceScore?: number;
    /**
     * The pattern that matched (for debugging)
     */
    matchPattern?:   string;
    recognizerId?:   string;
    recognizerName?: string;
    [property: string]: any;
}

/**
 * How this feedback was resolved
 */
export interface Resolution {
    action?:          Action;
    resolutionNotes?: string;
    resolvedAt?:      number;
    resolvedBy?:      EntityReference;
    [property: string]: any;
}

export enum Action {
    AddedToExceptionList = "ADDED_TO_EXCEPTION_LIST",
    NoActionNeeded = "NO_ACTION_NEEDED",
    PatternAdjusted = "PATTERN_ADJUSTED",
    RecognizerDisabledForEntity = "RECOGNIZER_DISABLED_FOR_ENTITY",
    ThresholdIncreased = "THRESHOLD_INCREASED",
}

/**
 * Processing status
 */
export enum Status {
    Applied = "APPLIED",
    Pending = "PENDING",
    Rejected = "REJECTED",
    Reviewed = "REVIEWED",
}

/**
 * User-selected reason for reporting
 */
export enum UserReason {
    EncryptedData = "ENCRYPTED_DATA",
    InternalIdentifier = "INTERNAL_IDENTIFIER",
    NotSensitiveData = "NOT_SENSITIVE_DATA",
    Other = "OTHER",
    PublicInformation = "PUBLIC_INFORMATION",
    TestData = "TEST_DATA",
    WrongDataType = "WRONG_DATA_TYPE",
}

/**
 * Status of a task.
 */
export enum ThreadTaskStatus {
    Closed = "Closed",
    Open = "Open",
}

/**
 * Type of a task.
 */
export enum TaskType {
    Generic = "Generic",
    RecognizerFeedbackApproval = "RecognizerFeedbackApproval",
    RequestApproval = "RequestApproval",
    RequestDescription = "RequestDescription",
    RequestTag = "RequestTag",
    RequestTestCaseFailureResolution = "RequestTestCaseFailureResolution",
    UpdateDescription = "UpdateDescription",
    UpdateTag = "UpdateTag",
}

/**
 * Type of thread.
 */
export enum ThreadType {
    Announcement = "Announcement",
    Chatbot = "Chatbot",
    Conversation = "Conversation",
    Task = "Task",
}
