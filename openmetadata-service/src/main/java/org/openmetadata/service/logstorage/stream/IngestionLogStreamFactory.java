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
package org.openmetadata.service.logstorage.stream;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.logstorage.stream.IngestionLogStreamManager.LogStreamRequest;
import org.openmetadata.service.logstorage.stream.IngestionLogTailer.LogStreamRun;
import org.openmetadata.service.logstorage.stream.IngestionLogTailer.RunState;

/**
 * Builds the {@link LogStreamRequest} for a pipeline run: which backend holds the run's log, how to
 * read it forward, and how to tell that the run is over.
 *
 * <p>The choice of source follows where the bytes actually are rather than what the pipeline is
 * configured for, because the two cursor formats are not interchangeable: object storage paginates
 * by line offset while the pipeline service paginates by fixed-size chunk.
 */
public class IngestionLogStreamFactory {

  private static final String LATEST_RUN = "last";

  private final IngestionPipelineRepository repository;
  private final PipelineServiceClientInterface pipelineServiceClient;
  private final LogStreamSettings settings;

  public IngestionLogStreamFactory(
      IngestionPipelineRepository repository,
      PipelineServiceClientInterface pipelineServiceClient) {
    this(repository, pipelineServiceClient, LogStreamSettings.defaults());
  }

  IngestionLogStreamFactory(
      IngestionPipelineRepository repository,
      PipelineServiceClientInterface pipelineServiceClient,
      LogStreamSettings settings) {
    this.repository = repository;
    this.pipelineServiceClient = pipelineServiceClient;
    this.settings = settings;
  }

  /**
   * Whether anything on this deployment holds ingestion logs. With neither a pipeline service nor
   * object storage there is nothing to tail, and a client is better told so than handed a stream
   * that looks like a run with no output.
   */
  public boolean hasLogBackend() {
    return pipelineServiceClient != null || repository.isS3LogStorageEnabled();
  }

  public LogStreamRequest request(IngestionPipeline pipeline, String runId, String startCursor) {
    final String fqn = pipeline.getFullyQualifiedName();
    final boolean storageBacked = readsFromLogStorage(pipeline, runId);
    final LogTailSource source =
        storageBacked
            ? storageSource(fqn, runId, startCursor)
            : pipelineServiceSource(pipeline, runId, startCursor);
    final LogStreamRun run =
        new LogStreamRun(runId, source, () -> runState(fqn, runId), startCursor);
    return new LogStreamRequest(key(storageBacked, fqn, runId), run);
  }

  /**
   * Object storage owns a run's log when the run stored it there, or when the run is still going
   * and its pipeline ships logs there. Otherwise the pipeline service is the only place the log
   * exists. A run with no status row yet counts as going: it was most likely just triggered.
   */
  private boolean readsFromLogStorage(IngestionPipeline pipeline, String runId) {
    final boolean runGoing = runState(pipeline.getFullyQualifiedName(), runId) != RunState.FINISHED;
    return repository.readsRunLogsFromStorage(pipeline, runId, runGoing);
  }

  private LogTailSource storageSource(String fqn, String runId, String startCursor) {
    final UUID run = UUID.fromString(runId);
    return new StorageLogTailSource(
        (after, limit) -> repository.getLogs(fqn, run, after, limit),
        startCursor,
        settings.linesPerRead());
  }

  private LogTailSource pipelineServiceSource(
      IngestionPipeline pipeline, String runId, String startCursor) {
    return new PipelineServiceLogTailSource(
        after -> pipelineServiceClient.getIngestionLogs(pipeline, after, runId), startCursor);
  }

  /**
   * Reads the run's state from the pipeline's own status rows rather than asking the pipeline
   * service, so a long stream costs one indexed query every probe interval and no backend call.
   */
  private RunState runState(String fqn, String runId) {
    return stateOf(repository.getRecentPipelineStatuses(fqn), runId);
  }

  /**
   * The state of the streamed run as the status rows report it. A run with no row of its own is
   * {@link RunState#UNKNOWN} rather than finished, because only a handful of recent runs are kept:
   * a missing row describes both a run that aged out of that window and one that was triggered
   * seconds ago and has not written its first status yet. The tailer treats the two the same way —
   * it waits longer before closing — instead of telling a user that a run about to start is over.
   *
   * <p>A stream that did not name a run follows the pipeline's latest status.
   *
   * @param recentStatuses the pipeline's recent statuses, newest first
   */
  static RunState stateOf(List<PipelineStatus> recentStatuses, String runId) {
    return listOrEmpty(recentStatuses).stream()
        .filter(status -> runId == null || runId.equals(status.getRunId()))
        .findFirst()
        .map(PipelineStatus::getPipelineState)
        .map(IngestionLogStreamFactory::toRunState)
        .orElse(RunState.UNKNOWN);
  }

  private static RunState toRunState(PipelineStatusType state) {
    return IngestionPipelineRepository.FINISHED_RUN_STATES.contains(state)
        ? RunState.FINISHED
        : RunState.RUNNING;
  }

  private static String key(boolean storageBacked, String fqn, String runId) {
    return (storageBacked ? "storage:" : "service:")
        + fqn
        + "/"
        + (runId == null ? LATEST_RUN : runId);
  }
}
