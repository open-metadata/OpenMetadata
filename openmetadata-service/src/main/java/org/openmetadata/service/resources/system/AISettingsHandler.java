/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.resources.system;

import org.openmetadata.schema.configuration.AIPrompts;
import org.openmetadata.schema.configuration.AISettings;
import org.openmetadata.schema.configuration.McpChatSettings;
import org.openmetadata.schema.configuration.MemoryExtractionSettings;
import org.openmetadata.schema.configuration.OntologyAgentSettings;
import org.openmetadata.schema.configuration.PromptConfig;

public class AISettingsHandler {

  public void validateAISettings(AISettings settings) {
    // No numeric ranges to validate; structural validity is enforced by the schema.
  }

  public AISettings mergeAISettings(AISettings defaults, AISettings incoming) {
    AISettings result = defaults;
    if (incoming != null) {
      result =
          new AISettings()
              .withEnabled(firstNonNull(incoming.getEnabled(), defaults.getEnabled()))
              .withMemoryExtraction(
                  mergeExtraction(defaults.getMemoryExtraction(), incoming.getMemoryExtraction()))
              .withOntologyAgent(
                  mergeAgent(defaults.getOntologyAgent(), incoming.getOntologyAgent()))
              .withPrompts(mergePrompts(defaults.getPrompts(), incoming.getPrompts()))
              .withMcpChat(mergeMcpChat(defaults.getMcpChat(), incoming.getMcpChat()));
    }
    return result;
  }

  private McpChatSettings mergeMcpChat(McpChatSettings d, McpChatSettings i) {
    McpChatSettings result = d;
    if (i != null) {
      result =
          new McpChatSettings()
              .withEnabled(firstNonNull(i.getEnabled(), d == null ? null : d.getEnabled()))
              .withSystemPrompt(
                  firstNonNull(i.getSystemPrompt(), d == null ? null : d.getSystemPrompt()));
    }
    return result;
  }

  private MemoryExtractionSettings mergeExtraction(
      MemoryExtractionSettings d, MemoryExtractionSettings i) {
    MemoryExtractionSettings result = d;
    if (i != null) {
      result =
          new MemoryExtractionSettings()
              .withFromFiles(firstNonNull(i.getFromFiles(), d == null ? null : d.getFromFiles()))
              .withFromPages(firstNonNull(i.getFromPages(), d == null ? null : d.getFromPages()));
    }
    return result;
  }

  private OntologyAgentSettings mergeAgent(OntologyAgentSettings d, OntologyAgentSettings i) {
    OntologyAgentSettings result = d;
    if (i != null) {
      result =
          new OntologyAgentSettings()
              .withEnabled(firstNonNull(i.getEnabled(), d == null ? null : d.getEnabled()))
              .withDeriveGlossaryTerms(
                  firstNonNull(
                      i.getDeriveGlossaryTerms(), d == null ? null : d.getDeriveGlossaryTerms()))
              .withDeriveMetrics(
                  firstNonNull(i.getDeriveMetrics(), d == null ? null : d.getDeriveMetrics()))
              .withDeletionPolicy(
                  firstNonNull(i.getDeletionPolicy(), d == null ? null : d.getDeletionPolicy()));
    }
    return result;
  }

  private AIPrompts mergePrompts(AIPrompts d, AIPrompts i) {
    AIPrompts result = d;
    if (i != null) {
      result =
          new AIPrompts()
              .withMemoryExtraction(
                  mergePrompt(d == null ? null : d.getMemoryExtraction(), i.getMemoryExtraction()))
              .withOntologyAgent(
                  mergePrompt(d == null ? null : d.getOntologyAgent(), i.getOntologyAgent()));
    }
    return result;
  }

  private PromptConfig mergePrompt(PromptConfig d, PromptConfig i) {
    PromptConfig result = d;
    if (i != null && i.getSystemPrompt() != null) {
      result = new PromptConfig().withSystemPrompt(i.getSystemPrompt());
    }
    return result;
  }

  private <X> X firstNonNull(X a, X b) {
    return a != null ? a : b;
  }
}
