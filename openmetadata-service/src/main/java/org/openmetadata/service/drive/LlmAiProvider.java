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

package org.openmetadata.service.drive;

import org.openmetadata.service.drive.memory.MemoryDeriver;
import org.openmetadata.service.drive.memory.MemoryExtractor;
import org.openmetadata.service.llm.LLMClientHolder;

/**
 * Default {@link AiProvider}: both derivers call the shared {@link
 * org.openmetadata.service.llm.LLMCompletionClient} held by {@link LLMClientHolder}. The client is
 * read at construction, matching the prior direct {@code new MemoryExtractor(LLMClientHolder.get())}
 * wiring this provider replaces.
 */
public final class LlmAiProvider implements AiProvider {

  @Override
  public DocumentMemoryExtractor documentExtractor() {
    return new ContextMemoryExtractor(LLMClientHolder.get());
  }

  @Override
  public MemoryDeriver memoryDeriver() {
    return new MemoryExtractor(LLMClientHolder.get());
  }
}
