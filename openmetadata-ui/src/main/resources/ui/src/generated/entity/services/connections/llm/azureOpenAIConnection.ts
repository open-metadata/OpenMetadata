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
 * Azure OpenAI Service Connection Config
 */
export interface AzureOpenAIConnection {
    /**
     * Azure OpenAI API Key
     */
    apiKey: string;
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
    endpoint: string;
    /**
     * Maximum number of retries for failed requests
     */
    maxRetries?: number;
    /**
     * Regex to only fetch models with names matching the pattern
     */
    modelFilterPattern?:         FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Request timeout in seconds
     */
    timeout?: number;
    /**
     * Service Type
     */
    type?: AzureOpenAIType;
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
 */
export enum AzureOpenAIType {
    AzureOpenAI = "AzureOpenAI",
}
