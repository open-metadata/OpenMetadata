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

package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.IndexMappingVersionTracker.MappingDriftState;

/**
 * Decides, per entity type, whether a reindex rewrites the live index in place or builds a new
 * index and promotes it. In place keeps the serving index: there is no alias swap to lose live
 * writes at and no partially built index to promote. A new index is still needed when the index
 * definition changed, when the live index is missing, or when an operator forces one. An index
 * nothing can refill from the database is never rebuilt, forced or not: that only empties it.
 */
public final class ReindexModePlanner {
  public enum Mode {
    IN_PLACE,
    NEW_INDEX,
    /** Nothing can rebuild these documents from the database, so the run leaves them alone. */
    SKIP
  }

  /** What the planner needs to know about an entity type and its live index. */
  public interface LiveIndexState {
    MappingDriftState drift(String entityType);

    boolean exists(String entityType);

    boolean embeddingSettingsMatch(String entityType);

    boolean hasReader(String entityType);
  }

  private ReindexModePlanner() {}

  public static Map<String, Mode> plan(
      final Set<String> entityTypes, final LiveIndexState state, final boolean forceRecreate) {
    final Map<String, Mode> modes = new LinkedHashMap<>();
    for (final String entityType : entityTypes) {
      modes.put(entityType, modeFor(entityType, entityTypes, state, forceRecreate));
    }
    return Collections.unmodifiableMap(modes);
  }

  private static Mode modeFor(
      final String entityType,
      final Set<String> entityTypes,
      final LiveIndexState state,
      final boolean forceRecreate) {
    final Mode mode;
    if (Entity.TABLE_COLUMN.equals(entityType)) {
      // Columns are written while tables are read; a new index is what drops removed columns.
      mode = entityTypes.contains(Entity.TABLE) ? Mode.NEW_INDEX : Mode.SKIP;
    } else if (!state.hasReader(entityType)) {
      mode = Mode.SKIP;
    } else if (forceRecreate || !isLiveIndexReusable(entityType, state)) {
      mode = Mode.NEW_INDEX;
    } else {
      mode = Mode.IN_PLACE;
    }
    return mode;
  }

  private static boolean isLiveIndexReusable(final String entityType, final LiveIndexState state) {
    return state.drift(entityType) == MappingDriftState.CURRENT
        && state.exists(entityType)
        && state.embeddingSettingsMatch(entityType);
  }
}
