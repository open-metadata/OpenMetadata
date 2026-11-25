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

package org.openmetadata.service.context.outcome;

import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.entity.context.MemoryOutcomes;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.RequestEntityCache;

/**
 * Sets a memory's outcome counters to the values of one recount and reindexes it. The write is
 * absolute, keeps the version and every timestamp, and is skipped when a later recount is already
 * stored, so the service that recounts outcomes can retry or overlap without moving the counts
 * backwards (ADR:2026-10-14-memory-outcome-counters-are-recounted-telemetry).
 */
public final class MemoryOutcomeWriter {

  private MemoryOutcomeWriter() {}

  /** Returns whether the counts were stored: false for a deleted memory or a stale recount. */
  public static boolean write(UUID memoryId, MemoryOutcomes outcomes) {
    long countedAt = Objects.requireNonNull(outcomes.getCountedAt(), "countedAt");
    boolean stored =
        Entity.getCollectionDAO()
                .contextMemoryDAO()
                .recordOutcomes(memoryId, JsonUtils.pojoToJson(outcomes), countedAt)
            > 0;
    if (stored) {
      reindex(memoryId);
    }
    return stored;
  }

  private static void reindex(UUID memoryId) {
    EntityReference memory =
        Entity.getEntityReferenceById(Entity.CONTEXT_MEMORY, memoryId, Include.NON_DELETED);
    // The write bypasses the repository, so it evicts the request cache too: the caller reads the
    // memory back in the same request.
    RequestEntityCache.invalidate(Entity.CONTEXT_MEMORY, memoryId, memory.getFullyQualifiedName());
    EntityRepository.invalidateCacheForEntity(
        Entity.CONTEXT_MEMORY, memoryId, memory.getFullyQualifiedName());
    Entity.getSearchRepository().updateEntity(memory);
  }
}
