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
package org.openmetadata.service.rdf.storage;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/** What a storage compaction did, as far as the store could tell us. */
public record CompactionResult(Outcome outcome, String taskId, String detail, Duration elapsed) {

  public enum Outcome {
    /** The store reported the compaction finished and the old generation was replaced. */
    SUCCEEDED,
    /** The store reported the compaction failed; the previous generation is still serving. */
    FAILED,
    /** Still running when the wait ran out; writes to the dataset stay blocked until it ends. */
    TIMED_OUT,
    /** The task could no longer be traced, for example after the store restarted. */
    UNKNOWN,
    /** The backend has no compaction to run. */
    UNSUPPORTED
  }

  static CompactionResult of(
      final Outcome outcome,
      final String taskId,
      final String detail,
      final Instant startedAt,
      final Clock clock) {
    return new CompactionResult(
        outcome, taskId, detail, Duration.between(startedAt, clock.instant()));
  }

  public static CompactionResult unsupported() {
    return new CompactionResult(Outcome.UNSUPPORTED, null, null, Duration.ZERO);
  }

  public boolean succeeded() {
    return outcome == Outcome.SUCCEEDED;
  }
}
