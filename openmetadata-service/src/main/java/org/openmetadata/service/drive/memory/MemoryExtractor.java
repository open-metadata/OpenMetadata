/*
 * Copyright 2024 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.service.drive.memory;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.service.llm.LLMCompletionClient;
import org.openmetadata.service.util.AISettingsUtil;

/**
 * Pure derivation step: asks the LLM to decide whether a ContextMemory maps to a Glossary Term
 * and/or Metric (REUSE existing / CREATE new / SKIP). Returns SKIP/SKIP when the LLM produces
 * an empty response.
 */
@Slf4j
public class MemoryExtractor implements MemoryDeriver {
  static final String FALLBACK_PROMPT =
      "You are a memory agent. Decide whether the memory maps to a Glossary Term and/or Metric "
          + "(REUSE existing / CREATE new / SKIP). Return ONLY a JSON array with one object "
          + "{termVerdict, metricVerdict}.";

  private final LLMCompletionClient llmClient;

  public MemoryExtractor(LLMCompletionClient llmClient) {
    this.llmClient = llmClient;
  }

  @Override
  public MemoryDerivation derive(ContextMemory memory, MemoryContext context) {
    final String prompt = AISettingsUtil.memoryAgentPrompt(AISettingsUtil.get(), FALLBACK_PROMPT);
    final String userPrompt = MemoryPromptBuilder.build(memory, context);
    final List<MemoryDerivation> verdicts =
        llmClient.completeStructured(prompt, userPrompt, MemoryDerivation.class);
    MemoryDerivation result = empty();
    if (!nullOrEmpty(verdicts)) {
      result = verdicts.getFirst();
    }
    return result;
  }

  private MemoryDerivation empty() {
    final MemoryVerdict skip =
        new MemoryVerdict(MemoryAction.SKIP, null, null, null, null, null, null, null, null, null);
    return new MemoryDerivation(skip, skip);
  }
}
