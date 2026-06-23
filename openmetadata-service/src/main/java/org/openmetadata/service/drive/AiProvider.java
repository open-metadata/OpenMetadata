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

/**
 * Single seam for the platform's AI-backed Context Center steps. OSS ships {@link LlmAiProvider}
 * (direct LLM calls); Collate can ship an AI Studio agent implementation selected at runtime by
 * {@link AiProviderHolder}. One door, two derivers — so an alternate backend swaps both the
 * document-to-pills extraction and the memory-to-ontology derivation in one place.
 */
public interface AiProvider {
  DocumentMemoryExtractor documentExtractor();

  MemoryDeriver memoryDeriver();
}
