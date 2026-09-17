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
package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.concurrent.atomic.AtomicLong;
import org.openmetadata.schema.system.StepStats;

/**
 * The submitted/success/failed/warnings quartet a bulk processor reports into.
 *
 * <p>Exists to carry those four counters across a class boundary: {@link ColumnIndexPipeline} owns
 * the column stats but the sink owns the processor that increments them, so one of them has to hand
 * the quartet to the other. {@link #toStats} then replaces the copy of the folding arithmetic each
 * sink kept for columns.
 *
 * <p>The sinks' own entity and process-stage counters are deliberately left as plain fields. They
 * never cross a boundary, and threading ~30 call sites through an accessor would lengthen the code
 * this decomposition is meant to shorten.
 */
record BulkCounters(
    AtomicLong submitted, AtomicLong success, AtomicLong failed, AtomicLong warnings) {

  static BulkCounters create() {
    return new BulkCounters(
        new AtomicLong(0), new AtomicLong(0), new AtomicLong(0), new AtomicLong(0));
  }

  /**
   * Totals are derived from success + failed + warnings rather than read from {@link #submitted}:
   * a doc that fails to build increments failed without ever being submitted, and reading
   * {@code submitted} would drop it from the total. Warnings are counted so skipped stale
   * references stay visible without being reported as failures.
   *
   * @param extraFailed failures counted outside the bulk processor, e.g. doc-build errors
   */
  StepStats toStats(long extraFailed) {
    return statsOf(success.get(), failed.get() + extraFailed, warnings.get());
  }

  StepStats toStats() {
    return toStats(0L);
  }

  /**
   * For counters a sink keeps outside a {@link BulkCounters} — its entity and process-stage
   * quartets — so the folding arithmetic still has one implementation.
   */
  static StepStats statsOf(long success, long failed, long warnings) {
    return new StepStats()
        .withTotalRecords((int) (success + failed + warnings))
        .withSuccessRecords((int) success)
        .withFailedRecords((int) failed)
        .withWarningRecords((int) warnings);
  }
}
