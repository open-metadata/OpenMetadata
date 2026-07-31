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
package org.openmetadata.service.search.capability;

/**
 * Per-entity-type flags that drive what the search-indexing layer can safely do. Today the only
 * consumer is {@code IndexUpdateScript.compatibleWith(...)} — soft-delete propagation must NOT
 * target an entity whose docs do not carry a top-level {@code deleted} field. The record is built
 * once per entity at registration time (see {@code Entity.registerEntity}) so new entity types
 * gain a correct capability record by default and can never silently drift.
 *
 * <p>The field set is intentionally minimal. New flags should be added only when a script or
 * validator actually consults them; otherwise we accumulate dead metadata.
 */
public record EntityIndexCapability(
    String entityType, boolean isTimeSeries, boolean hasFieldDeleted) {

  public static EntityIndexCapability forEntity(String entityType) {
    return new EntityIndexCapability(entityType, false, true);
  }

  public static EntityIndexCapability forTimeSeries(String entityType) {
    return new EntityIndexCapability(entityType, true, false);
  }
}
