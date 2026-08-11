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
package org.openmetadata.service.util.dbtune;

import java.util.Map;
import org.jdbi.v3.core.Handle;

/**
 * Engine-specific auto-tuner. Implementations:
 *
 * <ul>
 *   <li>Read observed table stats and current parameter-group settings from the database.
 *   <li>Compute a recommended table-level reloption set per table (pure logic — see
 *       {@link #recommend(TableStats)}).
 *   <li>Apply the recommendations via {@code ALTER TABLE ... SET (...)} when the operator opts in.
 *   <li>Optionally refresh planner stats on tables that were changed.
 * </ul>
 */
public interface AutoTuner {

  /** Read stats + settings, then turn them into recommendations. Mixes I/O and pure logic. */
  DbTuneResult analyze(Handle handle);

  /**
   * Reads the current per-table reloption / table-option settings for an arbitrary table name —
   * including tables that are not in the static tuning catalog. Returns an empty map if the table
   * has no overrides set (inherits cluster defaults). The returned keys use the same casing the
   * engine reports (lowercase autovacuum_* keys for Postgres, uppercase STATS_* keys for MySQL).
   */
  Map<String, String> currentSettingsForTable(Handle handle, String tableName);

  /**
   * Pure decision function. Given observed table stats, return the recommendation. Exposed
   * separately so unit tests can assert the heuristic without hitting a database.
   */
  TableRecommendation recommend(TableStats stats);

  /**
   * Apply a single actionable recommendation. No-op for non-actionable actions. Idempotent — safe
   * to re-run.
   */
  void apply(Handle handle, TableRecommendation recommendation);

  /** Refresh planner stats for one table after a settings change. */
  void analyzeOne(Handle handle, String tableName);

  /** Build the {@code ALTER TABLE} statement for a recommendation. Engine-specific syntax. */
  String buildAlterStatement(TableRecommendation recommendation);
}
