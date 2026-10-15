/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.search.scripts;

import java.util.Collections;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.search.SearchVersionGuard;
import org.openmetadata.service.search.capability.EntityIndexCapability;

/**
 * Sets the top-level {@code deleted} field on docs in indexes whose schema declares it. Refuses
 * to run against time-series indexes (no {@code deleted} field) — the previous string-template
 * version had no such guard and so polluted child docs of a soft-deleted parent.
 *
 * <p>Also fixes a latent quoting bug: the legacy template was
 * {@code "ctx._source.put('deleted', '%s')"}, which wraps a boolean in single quotes — the
 * resulting field is a string {@code "true"} / {@code "false"} rather than a JSON boolean.
 * Consumers that read {@code _source.deleted} as a boolean (the UI does) accept both forms today
 * but a stricter parser would not.
 */
public record SoftDeleteScript(boolean deleted, Double version, Long updatedAt, Long sourceReadAt)
    implements IndexUpdateScript {

  /** For descendants: their documents carry their own read times, so the write is not ordered. */
  public SoftDeleteScript(boolean deleted) {
    this(deleted, null, null, null);
  }

  /** The entity's own delete or restore, ordered against its other writes when it is prepared. */
  public static SoftDeleteScript forEntity(boolean deleted, EntityInterface<?> entity) {
    return forEntity(deleted, entity, System.currentTimeMillis());
  }

  public static SoftDeleteScript forEntity(
      boolean deleted, EntityInterface<?> entity, long readAt) {
    return new SoftDeleteScript(deleted, entity.getVersion(), entity.getUpdatedAt(), readAt);
  }

  @Override
  public String painless() {
    String update = "ctx._source.put('deleted', " + deleted + ")";
    return isOrdered() ? SearchVersionGuard.guard(update) : update;
  }

  @Override
  public Map<String, Object> params() {
    return isOrdered()
        ? Map.of(
            SearchVersionGuard.VERSION,
            version,
            SearchVersionGuard.UPDATED_AT,
            updatedAt,
            SearchVersionGuard.SOURCE_READ_AT,
            sourceReadAt)
        : Collections.emptyMap();
  }

  private boolean isOrdered() {
    return version != null && updatedAt != null && sourceReadAt != null;
  }

  @Override
  public boolean compatibleWith(EntityIndexCapability capability) {
    return capability != null && capability.hasFieldDeleted();
  }
}
