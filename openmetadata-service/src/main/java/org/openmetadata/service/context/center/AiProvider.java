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
