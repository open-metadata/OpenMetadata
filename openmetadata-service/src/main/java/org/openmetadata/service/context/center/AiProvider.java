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

package org.openmetadata.service.context.center;

import java.util.Optional;
import org.openmetadata.schema.api.context.ExtractionAvailability;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.llm.LLMCompletionClient;

/**
 * Single seam for the platform's AI-backed Context Center steps. OSS ships {@link LlmAiProvider}
 * (direct LLM calls); Collate ships an agent-platform implementation selected at runtime by {@link
 * AiProviderHolder}. The seam sits at candidate altitude — memories in, memories or terms out — so
 * an alternate backend swaps the engine without the callers or the artifact shape changing.
 */
public interface AiProvider {
  DocumentMemoryExtractor documentExtractor();

  /**
   * The deriver that turns published memories into glossary terms, when this provider has one.
   * Only Collate's provider overrides this, so OSS derives no glossary terms from memories.
   */
  default Optional<MemoryGlossaryDeriver> memoryGlossaryDeriver() {
    return Optional.empty();
  }

  /**
   * The model that judges whether a reworded fact is one another document already states: the
   * built-in LLM client unless a provider supplies its own. Without one, only identical facts link.
   */
  default Optional<LLMCompletionClient> duplicateJudge() {
    return Optional.ofNullable(LLMClientHolder.get());
  }

  /**
   * Whether memories can be extracted now, and why not: uploads and article edits extract only
   * while it is. By default that takes the LLM layer and {@code memoryExtractionEnabled}, and never
   * answers {@code ProviderDisabled}: only a provider with a platform of its own, such as Collate's,
   * does, while that platform is switched off.
   *
   * <p>Article prepare and update call it, so an override must be cheap, must never throw or return
   * null, and must answer the same way throughout one request.
   */
  default ExtractionAvailability extractionAvailability() {
    return LLMClientHolder.isMemoryExtractionEnabled()
        ? new ExtractionAvailability().withAvailable(true)
        : new ExtractionAvailability().withAvailable(false).withReason(whyLlmCannotExtract());
  }

  /** Unavailable, not off, only while extraction is switched on but its LLM failed to build. */
  private static ExtractionAvailability.Reason whyLlmCannotExtract() {
    final boolean switchedOnButUnbuilt =
        LLMClientHolder.isMemoryExtractionSwitchedOn()
            && LLMClientHolder.getUnavailableReason().isPresent();
    return switchedOnButUnbuilt
        ? ExtractionAvailability.Reason.ProviderUnavailable
        : ExtractionAvailability.Reason.ExtractionDisabled;
  }
}
