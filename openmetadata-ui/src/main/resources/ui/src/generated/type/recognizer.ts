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
