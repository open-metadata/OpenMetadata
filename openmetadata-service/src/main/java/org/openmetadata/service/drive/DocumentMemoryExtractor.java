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

import java.util.List;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.type.EntityReference;

/**
 * Turns a Context Center source's extracted text into reusable {@link ContextMemory} knowledge
 * pills. The OSS implementation calls an LLM; alternate implementations (e.g. a Collate AI Studio
 * agent) are selected via {@code AiProviderHolder}. Side-effect free: persisting the pills is the
 * reconciler's job.
 */
public interface DocumentMemoryExtractor {

  /** Result of a derive pass, carrying chunk-level stats for the source's extractionStats. */
  record DeriveResult(List<ContextMemory> memories, int chunksTotal, int chunksProcessed) {}

  DeriveResult derive(String text, EntityReference sourceRef, ContextMemorySourceType sourceType);
}
