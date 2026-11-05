/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.context.center;

import java.util.List;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.type.EntityReference;

/**
 * Turns published memories into glossary terms. The built-in provider has none; Collate's
 * agent-platform provider supplies one through {@link AiProvider#memoryGlossaryDeriver()}.
 *
 * <p>A term it creates has the {@code automation} provider, so it starts in Draft until a person
 * approves it, and a {@code DERIVED_FROM} relationship to its memory, which the memory reads back
 * as {@code derivedEntities}. Write that relationship with {@link MemoryDerivations#record}, so it
 * carries the confidence and reasons a reviewer reads in the glossary.
 *
 * <p>Edits can queue another job while a derivation is running, including on another server. Before
 * publishing, lock and reload the source memory, reject stale or unpublished content, and skip a
 * memory that already has a derived term. Create the term and its provenance in that transaction;
 * do not hold the lock during the agent call.
 */
public interface MemoryGlossaryDeriver {
  /** Derives terms for the memories that define a business concept; returns the terms created. */
  List<EntityReference> derive(List<ContextMemory> memories);
}
