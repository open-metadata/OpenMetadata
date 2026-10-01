/*
 *  Copyright 2024 Collate
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

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Bounded view of a {@link SinkResult} stored as the node's {@code syncResult} output variable:
 * counts, commit ids and the first {@link #MAX_ERRORS} errors. Synced entity names and exception
 * causes are not included, so the stored size does not grow with the batch.
 */
public record SinkResultSummary(
    boolean success,
    int syncedCount,
    int failedCount,
    List<String> commitIds,
    List<ErrorEntry> errors,
    int unlistedFailures) {

  public static final int MAX_ERRORS = 20;
  public static final int MAX_COMMIT_IDS = 100;
  static final int MAX_ERROR_MESSAGE_LENGTH = 1000;

  /** Metadata key under which a provider reports the ids of all commits it created. */
  public static final String COMMIT_IDS_KEY = "commitOids";

  /** Metadata key under which a provider reports the id of a single commit. */
  public static final String COMMIT_ID_KEY = "commitOid";

  private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

  public record ErrorEntry(String entityFqn, String errorMessage) {}

  public static SinkResultSummary from(SinkResult result) {
    List<SinkResult.SinkError> sinkErrors =
        Optional.ofNullable(result.getErrors()).orElse(List.of());
    List<ErrorEntry> errors =
        sinkErrors.stream()
            .limit(MAX_ERRORS)
            .map(
                error ->
                    new ErrorEntry(
                        error.getEntityFqn(),
                        StringUtils.abbreviate(error.getErrorMessage(), MAX_ERROR_MESSAGE_LENGTH)))
            .toList();
    List<String> commitIds = commitIdsOf(result);
    return new SinkResultSummary(
        result.isSuccess(),
        result.getSyncedCount(),
        result.getFailedCount(),
        commitIds.subList(0, Math.min(commitIds.size(), MAX_COMMIT_IDS)),
        errors,
        Math.max(0, result.getFailedCount() - errors.size()));
  }

  /** Commit ids a provider reported in the result metadata, if any. */
  public static List<String> commitIdsOf(SinkResult result) {
    Map<String, Object> metadata = Optional.ofNullable(result.getMetadata()).orElse(Map.of());
    Object commitIds = metadata.get(COMMIT_IDS_KEY);
    Object commitId = metadata.get(COMMIT_ID_KEY);
    List<String> ids = new ArrayList<>();
    if (commitIds != null) {
      ids.addAll(JsonUtils.convertValue(commitIds, STRING_LIST));
    } else if (commitId != null) {
      ids.add(commitId.toString());
    }
    return ids;
  }
}
