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
 * Payload for Suggestion tasks.
 */
export interface SuggestionPayload {
    /**
     * Confidence score for AI-generated suggestions (0-100).
     */
    confidence?: number;
    /**
     * Current value of the field.
     */
    currentValue?: string;
    /**
     * Path to the field being updated (e.g., 'columns.customer_id.description').
     */
    fieldPath: string;
    /**
     * Explanation of why this suggestion was made.
     */
    reasoning?: string;
    /**
     * Source of the suggestion.
     */
    source?: Source;
    /**
     * Suggested new value for the field.
     */
    suggestedValue: string;
    /**
     * Type of suggestion.
     */
    suggestionType: SuggestionType;
}

/**
 * Source of the suggestion.
 */
export enum Source {
    Agent = "Agent",
    AutoPilot = "AutoPilot",
    Ingestion = "Ingestion",
    User = "User",
}

/**
 * Type of suggestion.
 */
export enum SuggestionType {
    CustomProperty = "CustomProperty",
    Description = "Description",
    Domain = "Domain",
    Owner = "Owner",
    Tag = "Tag",
    Tier = "Tier",
}
