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
package org.openmetadata.service.search.elasticsearch;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import es.co.elastic.clients.elasticsearch._types.BulkIndexByScrollFailure;
import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.elasticsearch.core.DeleteByQueryRequest;
import es.co.elastic.clients.elasticsearch.core.DeleteByQueryResponse;
import es.co.elastic.clients.elasticsearch.core.UpdateByQueryRequest;
import es.co.elastic.clients.elasticsearch.core.UpdateByQueryResponse;
import es.co.elastic.clients.elasticsearch.tasks.GetTasksResponse;
import es.co.elastic.clients.json.JsonpUtils;
import es.co.elastic.clients.transport.ElasticsearchTransport;
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

/**
 * The Elasticsearch client every manager holds: the search checks of {@link
 * ShardFailureAwareElasticsearchClient}, and {@link ByQueryPolicy} on every update-by-query and
 * delete-by-query. Overriding the request methods covers the builder-lambda overloads too, so none
 * of the call sites can bypass the policy.
 */
@Slf4j
public class ByQueryAwareElasticsearchClient extends ShardFailureAwareElasticsearchClient {
  private static final String UPDATE_BY_QUERY = "update-by-query";
  private static final String DELETE_BY_QUERY = "delete-by-query";
  private static final String MATCH_ALL = "{\"match_all\":{}}";
  private static final String TASK_POLL_TIMEOUT = "30s";
  private static final long TASK_WAIT_LIMIT_MILLIS = Duration.ofMinutes(30).toMillis();
  // Waiting on a task that has not finished yet answers with a timeout; it is still running.
  private static final Set<Integer> STILL_RUNNING_STATUSES = Set.of(408, 429);

  public ByQueryAwareElasticsearchClient(final ElasticsearchTransport transport) {
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

  private ByQueryPolicy.Target target(
      final String operation, final List<String> indexes, final Query query) {
    return new ByQueryPolicy.Target(
        operation,
        indexes,
        () -> query == null ? MATCH_ALL : JsonpUtils.toJsonString(query, _jsonpMapper()));
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

  private Optional<ByQueryOutcome> pollTask(final String taskId) throws IOException {
    Optional<ByQueryOutcome> finished = Optional.empty();
    try {
      final GetTasksResponse task =
          tasks()
              .get(
                  g ->
                      g.taskId(taskId)
                          .waitForCompletion(true)
                          .timeout(t -> t.time(TASK_POLL_TIMEOUT)));
      if (task.completed()) {
        finished =
            Optional.of(
                ByQueryOutcome.fromTaskResult(
                    JsonUtils.readTree(JsonpUtils.toJsonString(task, _jsonpMapper()))));
      }
    } catch (ElasticsearchException e) {
      if (!STILL_RUNNING_STATUSES.contains(e.status())) {
        throw e;
      }
    }
    return finished;
  }

  /** A task still running after the wait limit is cancelled, and its documents repaired. */
  private ByQueryOutcome abandon(final String taskId) {
    try {
      tasks().cancel(c -> c.taskId(taskId));
    } catch (IOException | ElasticsearchException e) {
      LOG.warn("Could not cancel search task {} after waiting for it", taskId, e);
    }
    return ByQueryOutcome.stillRunning();
  }

  private static ByQueryOutcome outcome(
      final Long versionConflicts,
      final List<BulkIndexByScrollFailure> failures,
      final Boolean timedOut) {
    return new ByQueryOutcome(
        versionConflicts == null ? 0 : versionConflicts,
        listOrEmpty(failures).stream().map(f -> String.valueOf(f.cause().reason())).toList(),
        Boolean.TRUE.equals(timedOut));
  }
}
