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
 * Create or Update Tag Request with Recognizer Configuration
 */
export interface CreateTagWithRecognizers {
    /**
     * Whether automatic classification is enabled for this tag
     */
    autoClassificationEnabled?: boolean;
    /**
     * Priority for conflict resolution when multiple tags match
     */
    autoClassificationPriority?: number;
    /**
     * Fully qualified name of the classification that this tag is part of
     */
    classification: string;
    /**
     * Description of the tag
     */
    description: string;
    /**
     * Display name for the tag
     */
    displayName?: string;
    /**
     * Name of the tag
     */
    name: string;
    /**
     * Owners of this tag
     */
    owners?: EntityReference[];
    /**
     * Fully qualified name of the parent tag. When null, the tag is at the root of the
     * classification
     */
    parent?: string;
    /**
     * List of recognizers for automatic detection
     */
    recognizers?: Recognizer[];
    /**
     * Reviewers of this tag
     */
    reviewers?: EntityReference[];
    style?:     Style;
}

/**
 * Owners of this tag
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
 * User who added this exception
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
 * Configuration for automatic entity recognition and classification, supporting both
 * pattern-based and context-aware detection methods.
 */
export interface Recognizer {
    /**
     * Minimum confidence score required for detection
     */
    confidenceThreshold?: number;
    /**
     * Description of what this recognizer detects
     */
    description?: string;
    /**
     * Display name for the recognizer
     */
    displayName?: string;
    /**
     * Whether this recognizer is enabled
     */
    enabled?: boolean;
    /**
     * Entity links where this recognizer should NOT run (based on user feedback)
     */
    exceptionList?: RecognizerException[];
    /**
     * Unique identifier of the recognizer
     */
    id?: string;
    /**
     * Whether this is a system default recognizer
     */
    isSystemDefault?: boolean;
    /**
     * Name of the recognizer
     */
    name:             string;
    recognizerConfig: RecognizerConfig;
    /**
     * Languages supported by this recognizer
     */
    supportedLanguages?: string[];
    /**
     * Last update time in Unix epoch time milliseconds
     */
    updatedAt?: number;
    /**
     * User who made the update
     */
    updatedBy?: string;
    /**
     * Version of the recognizer configuration
     */
    version?: number;
}

/**
 * Exception entry for entities where recognizer should not run
 */
export interface RecognizerException {
    addedAt?: number;
    /**
     * User who added this exception
     */
    addedBy?: EntityReference;
    /**
     * Entity link to exclude from recognition
     */
    entityLink: string;
    /**
     * ID of the feedback that triggered this exception
     */
    feedbackId?: string;
    /**
     * Reason for exclusion
     */
    reason?: string;
}

/**
 * Complete recognizer configuration
 *
 * Pattern-based recognizer using regular expressions
 *
 * Deny list recognizer that matches against a list of specific values
 *
 * Context-aware recognizer using surrounding text
 *
 * Custom recognizer with user-defined logic
 */
export interface RecognizerConfig {
    /**
     * List of regex patterns to match
     */
    patterns?: Pattern[];
    /**
     * Entity type this recognizer detects (e.g., EMAIL_ADDRESS, SSN)
     *
     * Entity type this recognizer detects
     */
    supportedEntity: string;
    type:            any;
    /**
     * Whether matching is case sensitive
     */
    caseSensitive?: boolean;
    /**
     * List of values to match against
     */
    denyList?: string[];
    /**
     * Words that indicate the presence of the entity
     */
    contextWords?: string[];
    /**
     * Factor to increase score based on entity length
     */
    increaseFactorByCharLength?: number;
    /**
     * Maximum confidence score
     */
    maxScore?: number;
    /**
     * Minimum confidence score
     */
    minScore?: number;
    /**
     * Custom configuration parameters
     */
    config?: { [key: string]: any };
    /**
     * Optional custom validation function (Python code)
     */
    validatorFunction?: string;
}

export interface Pattern {
    /**
     * Name of the pattern
     */
    name: string;
    /**
     * Regular expression pattern
     */
    regex: string;
    /**
     * Confidence score for this pattern (0.0 to 1.0)
     */
    score?: number;
    [property: string]: any;
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
