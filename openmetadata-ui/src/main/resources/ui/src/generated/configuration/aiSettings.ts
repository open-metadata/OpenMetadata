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
  /**
   * Whether AI features are globally enabled.
   */
  enabled?: boolean;
  /**
   * Settings controlling which source types feed the memory extraction pipeline.
   */
  memoryExtraction?: MemoryExtractionSettings;
  /**
   * Settings for the Ontology Agent that derives Glossary Terms and Metrics from
   * ContextMemory.
   */
  ontologyAgent?: OntologyAgentSettings;
  /**
   * Tunable LLM system prompts for each AI sub-system.
   */
  prompts?: AIPrompts;
}

/**
 * Settings controlling which source types feed the memory extraction pipeline.
 */
export interface MemoryExtractionSettings {
  /**
   * Extract knowledge pills from uploaded files (ContextFile entities).
   */
  fromFiles?: boolean;
  /**
   * Extract knowledge pills from knowledge-base pages (ContextMemory from pages).
   */
  fromPages?: boolean;
}

/**
 * Settings for the Ontology Agent that derives Glossary Terms and Metrics from
 * ContextMemory.
 */
export interface OntologyAgentSettings {
  /**
   * What to do with Ontology-Agent-owned entities when their source ContextMemory is
   * deleted.
   */
  deletionPolicy?: AIDeletionPolicy;
  /**
   * Whether the Ontology Agent should propose new Glossary Terms derived from memory.
   */
  deriveGlossaryTerms?: boolean;
  /**
   * Whether the Ontology Agent should propose new Metrics derived from memory.
   */
  deriveMetrics?: boolean;
  /**
   * Whether the Ontology Agent pipeline is enabled.
   */
  enabled?: boolean;
}

/**
 * What to do with Ontology-Agent-owned entities when their source ContextMemory is
 * deleted.
 *
 * Deletion policy for entities owned by the Ontology Agent.
 */
export enum AIDeletionPolicy {
  Cascade = 'cascade',
  Deprecate = 'deprecate',
  Orphan = 'orphan',
}

/**
 * Tunable LLM system prompts for each AI sub-system.
 */
export interface AIPrompts {
  /**
   * System prompt configuration for the memory-extraction pipeline.
   */
  memoryExtraction?: PromptConfig;
  /**
   * System prompt configuration for the Ontology Agent.
   */
  ontologyAgent?: PromptConfig;
}

/**
 * System prompt configuration for the memory-extraction pipeline.
 *
 * System prompt configuration for the Ontology Agent.
 *
 * Tunable system-prompt configuration for a single AI sub-system.
 */
export interface PromptConfig {
  /**
   * The LLM system prompt text. Leave empty to use the built-in default.
   */
  systemPrompt?: string;
}
