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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Adds up {@link SinkResult}s into one. Keeps the counts, at most {@link
 * SinkResultSummary#MAX_ERRORS} errors, without their causes, and at most {@link
 * SinkResultSummary#MAX_COMMIT_IDS} commit ids, so memory stays flat however many results it adds.
 */
final class SinkResultTotals {
  private final List<SinkResult.SinkError> errors = new ArrayList<>();
  private final List<String> commitIds = new ArrayList<>();
  private int syncedCount;
  private int failedCount;
  private int skippedCount;
  private boolean success = true;

  void add(SinkResult result) {
    syncedCount += result.getSyncedCount();
    failedCount += result.getFailedCount();
    skippedCount += result.getSkippedCount();
    success = success && result.isSuccess();
    addErrors(Optional.ofNullable(result.getErrors()).orElse(List.of()));
    SinkResultSummary.commitIdsOf(result).forEach(this::addCommitId);
  }

  /** Counts one failed entity per error, for entities that reached no provider. */
  void addFailures(List<SinkResult.SinkError> failures) {
    failedCount += failures.size();
    success = success && failures.isEmpty();
    addErrors(failures);
  }

  SinkResult toResult() {
    return SinkResult.builder()
        .success(success)
        .syncedCount(syncedCount)
        .failedCount(failedCount)
        .skippedCount(skippedCount)
        .errors(errors.isEmpty() ? null : List.copyOf(errors))
        .metadata(Map.of(SinkResultSummary.COMMIT_IDS_KEY, List.copyOf(commitIds)))
        .build();
  }

  private void addErrors(List<SinkResult.SinkError> newErrors) {
    newErrors.stream()
        .limit(Math.max(0, SinkResultSummary.MAX_ERRORS - errors.size()))
        .forEach(
            error ->
                errors.add(
                    SinkResult.SinkError.builder()
                        .entityFqn(error.getEntityFqn())
                        .errorMessage(error.getErrorMessage())
                        .errorCode(error.getErrorCode())
                        .build()));
  }

  private void addCommitId(String commitId) {
    if (commitIds.size() < SinkResultSummary.MAX_COMMIT_IDS) {
      commitIds.add(commitId);
    }
  }
}
