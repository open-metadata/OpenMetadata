package org.openmetadata.service.context.center;

import java.util.Optional;

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
}
