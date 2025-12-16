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
 * Ollama (Local LLM) Service Connection Config
 */
export interface OllamaConnection {
    /**
     * Ollama server URL (e.g., http://localhost:11434)
     */
    baseURL: string;
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
    type?: OllamaType;
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
export enum OllamaType {
    Ollama = "Ollama",
}
