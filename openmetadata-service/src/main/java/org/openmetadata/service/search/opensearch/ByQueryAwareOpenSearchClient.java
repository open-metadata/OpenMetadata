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
package org.openmetadata.service.search.opensearch;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.ByQueryOutcome;
import org.openmetadata.service.search.ByQueryPolicy;
import os.org.opensearch.client.opensearch._types.BulkByScrollFailure;
import os.org.opensearch.client.opensearch._types.OpenSearchException;
import os.org.opensearch.client.opensearch._types.query_dsl.Query;
import os.org.opensearch.client.opensearch.core.DeleteByQueryRequest;
import os.org.opensearch.client.opensearch.core.DeleteByQueryResponse;
import os.org.opensearch.client.opensearch.core.UpdateByQueryRequest;
import os.org.opensearch.client.opensearch.core.UpdateByQueryResponse;
import os.org.opensearch.client.opensearch.generic.Body;
import os.org.opensearch.client.opensearch.generic.Requests;
import os.org.opensearch.client.opensearch.generic.Response;
import os.org.opensearch.client.transport.OpenSearchTransport;

/**
 * The OpenSearch client every manager holds: the search checks of {@link
 * ShardFailureAwareOpenSearchClient}, and {@link ByQueryPolicy} on every update-by-query and
 * delete-by-query. Overriding the request methods covers the builder-lambda overloads too, so none
 * of the call sites can bypass the policy.
 */
@Slf4j
public class ByQueryAwareOpenSearchClient extends ShardFailureAwareOpenSearchClient {
  private static final String UPDATE_BY_QUERY = "update-by-query";
  private static final String DELETE_BY_QUERY = "delete-by-query";
  private static final String MATCH_ALL = "{\"match_all\":{}}";
  private static final String TASK_POLL = "?wait_for_completion=true&timeout=30s";
  private static final long TASK_WAIT_LIMIT_MILLIS = Duration.ofMinutes(30).toMillis();
  // Waiting on a task that has not finished yet answers with a timeout; it is still running.
  private static final Set<Integer> STILL_RUNNING_STATUSES = Set.of(408, 429);

  public ByQueryAwareOpenSearchClient(final OpenSearchTransport transport) {
    super(transport);
  }

  @Override
  public UpdateByQueryResponse updateByQuery(final UpdateByQueryRequest request)
      throws IOException {
    final AtomicReference<UpdateByQueryResponse> response = new AtomicReference<>();
    ByQueryPolicy.run(
        target(UPDATE_BY_QUERY, request.index(), request.query()),
        () -> refresh(request.index()),
        () -> {
          final UpdateByQueryResponse sent = super.updateByQuery(request);
          response.set(sent);
          return Boolean.FALSE.equals(request.waitForCompletion())
              ? awaitTask(sent.task())
              : outcome(sent.versionConflicts(), sent.failures(), sent.timedOut());
        });
    return response.get();
  }

  @Override
  public DeleteByQueryResponse deleteByQuery(final DeleteByQueryRequest request)
      throws IOException {
    final AtomicReference<DeleteByQueryResponse> response = new AtomicReference<>();
    ByQueryPolicy.run(
        target(DELETE_BY_QUERY, request.index(), request.query()),
        () -> refresh(request.index()),
        () -> {
          final DeleteByQueryResponse sent = super.deleteByQuery(request);
          response.set(sent);
          return Boolean.FALSE.equals(request.waitForCompletion())
              ? awaitTask(sent.task())
              : outcome(sent.versionConflicts(), sent.failures(), sent.timedOut());
        });
    return response.get();
  }

  private static ByQueryPolicy.Target target(
      final String operation, final List<String> indexes, final Query query) {
    return new ByQueryPolicy.Target(
        operation, indexes, () -> query == null ? MATCH_ALL : query.toJsonString());
  }

  private void refresh(final List<String> indexes) throws IOException {
    indices().refresh(r -> r.index(indexes).ignoreUnavailable(true).allowNoIndices(true));
  }

  private ByQueryOutcome awaitTask(final String taskId) throws IOException {
    final long deadline = System.currentTimeMillis() + TASK_WAIT_LIMIT_MILLIS;
    Optional<ByQueryOutcome> finished = pollTask(taskId);
    while (finished.isEmpty() && System.currentTimeMillis() < deadline) {
      finished = pollTask(taskId);
    }
    return finished.isPresent() ? finished.get() : abandon(taskId);
  }

  /** Reads the task raw: the typed task response rejects stored results it does not model. */
  private Optional<ByQueryOutcome> pollTask(final String taskId) throws IOException {
    try (Response response =
        generic()
            .execute(
                Requests.builder()
                    .method("GET")
                    .endpoint("/_tasks/" + taskId + TASK_POLL)
                    .build())) {
      return finishedTask(
          taskId, response.getStatus(), response.getBody().map(Body::bodyAsString).orElse(""));
    }
  }

  static Optional<ByQueryOutcome> finishedTask(
      final String taskId, final int status, final String body) throws IOException {
    Optional<ByQueryOutcome> finished = Optional.empty();
    if (!STILL_RUNNING_STATUSES.contains(status)) {
      if (status >= 300) {
        throw new IOException(
            String.format("Reading search task %s failed with %d: %s", taskId, status, body));
      }
      final JsonNode taskResult = JsonUtils.readTree(body);
      if (taskResult.path("completed").asBoolean()) {
        finished = Optional.of(ByQueryOutcome.fromTaskResult(taskResult));
      }
    }
    return finished;
  }

  /** A task still running after the wait limit is cancelled, and its documents repaired. */
  private ByQueryOutcome abandon(final String taskId) {
    try {
      tasks().cancel(c -> c.taskId(taskId));
    } catch (IOException | OpenSearchException e) {
      LOG.warn("Could not cancel search task {} after waiting for it", taskId, e);
    }
    return ByQueryOutcome.stillRunning();
  }

  private static ByQueryOutcome outcome(
      final Long versionConflicts,
      final List<BulkByScrollFailure> failures,
      final Boolean timedOut) {
    return new ByQueryOutcome(
        versionConflicts == null ? 0 : versionConflicts,
        listOrEmpty(failures).stream().map(f -> String.valueOf(f.cause().reason())).toList(),
        Boolean.TRUE.equals(timedOut));
  }
}
