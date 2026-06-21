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
 * Configuration for AI features: memory extraction, the Ontology Agent, and tunable LLM
 * system prompts.
 */
export interface AISettings {
    enabled?:          boolean;
    mcpChat?:          McpChat;
    memoryExtraction?: MemoryExtraction;
    ontologyAgent?:    OntologyAgent;
    prompts?:          Prompts;
}

/**
 * MCP Chat assistant. The LLM provider and credentials are configured at the platform
 * level via llmConfiguration; this only governs chat enablement and behavior.
 */
export interface McpChat {
    enabled?:      boolean;
    systemPrompt?: string;
}

export interface MemoryExtraction {
    fromFiles?: boolean;
    fromPages?: boolean;
}

export interface OntologyAgent {
    deletionPolicy?:      DeletionPolicy;
    deriveGlossaryTerms?: boolean;
    deriveMetrics?:       boolean;
    enabled?:             boolean;
}

export enum DeletionPolicy {
    Cascade = "cascade",
    Deprecate = "deprecate",
    Orphan = "orphan",
}

export interface Prompts {
    memoryExtraction?: PromptConfig;
    ontologyAgent?:    PromptConfig;
}

export interface PromptConfig {
    systemPrompt?: string;
}
