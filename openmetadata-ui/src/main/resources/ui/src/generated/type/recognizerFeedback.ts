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
 * User who provided the feedback
 *
 * This schema defines the EntityReference type used for referencing an entity.
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
