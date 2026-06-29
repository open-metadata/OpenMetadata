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

import org.openmetadata.schema.entity.context.ContextMemory;

/**
 * Decides whether a {@link ContextMemory} maps to a Glossary Term and/or Metric (REUSE / CREATE /
 * SKIP) given grounding {@link MemoryContext}. The OSS implementation asks an LLM; alternate
 * implementations (e.g. a Collate AI Studio agent) are selected via {@code AiProviderHolder}.
 */
public interface MemoryDeriver {
  MemoryDerivation derive(ContextMemory memory, MemoryContext context);
}
