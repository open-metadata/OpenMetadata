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
package org.openmetadata.service.search;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;

/**
 * What one update-by-query or delete-by-query did, from its response or its finished task.
 *
 * @param versionConflicts documents skipped because a write changed them while they were scanned
 * @param failures per-document or per-shard failures; a task that ended in an error is one
 */
public record ByQueryOutcome(long versionConflicts, List<String> failures, boolean timedOut) {
  public static final ByQueryOutcome COMPLETE = new ByQueryOutcome(0, List.of(), false);

  public ByQueryOutcome {
    failures = List.copyOf(failures);
  }

  /** Every matched document was written or deleted. */
  public boolean isComplete() {
    return versionConflicts == 0 && failures.isEmpty() && !timedOut;
  }

  /** Only conflicts are left, so running the same request again can finish the job. */
  public boolean hasOnlyConflicts() {
    return versionConflicts > 0 && failures.isEmpty() && !timedOut;
  }

  public static ByQueryOutcome failed(final String failure) {
    return new ByQueryOutcome(0, List.of(failure), false);
  }

  public static ByQueryOutcome stillRunning() {
    return new ByQueryOutcome(0, List.of(), true);
  }

  /**
   * Reads a finished background task ({@code GET _tasks/<id>}): its {@code error}, or the by-query
   * {@code response} it stored.
   */
  public static ByQueryOutcome fromTaskResult(final JsonNode taskResult) {
    final JsonNode error = taskResult.path("error");
    final ByQueryOutcome outcome;
    if (!error.isMissingNode() && !error.isNull()) {
      outcome = failed(error.path("type").asText() + ": " + error.path("reason").asText());
    } else {
      final JsonNode response = taskResult.path("response");
      outcome =
          new ByQueryOutcome(
              response.path("version_conflicts").asLong(),
              failureReasons(response.path("failures")),
              response.path("timed_out").asBoolean());
    }
    return outcome;
  }

  private static List<String> failureReasons(final JsonNode failures) {
    final List<String> reasons = new ArrayList<>();
    failures.forEach(failure -> reasons.add(failure.path("cause").path("reason").asText()));
    return reasons;
  }

  public String describe() {
    return String.format(
        "%d version conflict(s), %d failure(s)%s%s",
        versionConflicts,
        failures.size(),
        timedOut ? ", timed out" : "",
        failures.isEmpty() ? "" : ": " + String.join("; ", failures));
  }
}
