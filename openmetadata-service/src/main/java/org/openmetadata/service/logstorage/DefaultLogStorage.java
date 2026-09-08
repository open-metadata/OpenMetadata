/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.logstorage;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.UnhandledServerException;

/**
 * Default implementation of LogStorageInterface that delegates to the existing
 * PipelineServiceClient for backward compatibility.
 */
@Slf4j
public class DefaultLogStorage implements LogStorageInterface {

  private static final Set<String> PAGING_KEYS =
      Set.of("total", "after", PipelineServiceClientInterface.LOGS_ERROR_KEY);

  private PipelineServiceClientInterface pipelineServiceClient;

  @Override
  public void initialize(Map<String, Object> config) throws IOException {
    this.pipelineServiceClient =
        (PipelineServiceClientInterface) config.get("pipelineServiceClient");
    if (this.pipelineServiceClient == null) {
      throw new IOException("PipelineServiceClient is required for DefaultLogStorage");
    }
    LOG.info("DefaultLogStorage initialized");
  }

  @Override
  public void appendLogs(String pipelineFQN, UUID runId, String logContent) {
    // Default implementation doesn't support direct log writes
    throw new UnsupportedOperationException(
        "DefaultLogStorage does not support direct log writes. Logs are managed by the pipeline service.");
  }

  @Override
  public InputStream getLogInputStream(String pipelineFQN, UUID runId) throws IOException {
    // For default implementation, we delegate to the pipeline service client
    // The runId is not used here as the pipeline service client only supports getting latest logs
    Map<String, Object> logs = getLogs(pipelineFQN, runId, null, Integer.MAX_VALUE);
    String error = (String) logs.get(PipelineServiceClientInterface.LOGS_ERROR_KEY);
    if (error != null) {
      throw new IOException(error);
    }
    String logContent = (String) logs.get("logs");
    return new ByteArrayInputStream(logContent.getBytes(StandardCharsets.UTF_8));
  }

  @Override
  public Map<String, Object> getLogs(
      String pipelineFQN, UUID runId, String afterCursor, int limit) {
    // Load the real pipeline with its service: a runner may locate the run by service, not by
    // pipeline name alone, so a name-only stub finds nothing.
    IngestionPipeline pipeline =
        Entity.getEntityByName(Entity.INGESTION_PIPELINE, pipelineFQN, "service", Include.ALL);
    try {
      // Note: The default implementation through pipeline service client (Airflow/Argo)
      // doesn't support fetching logs by specific runId - it always returns the latest logs
      // The runId parameter is ignored here for backward compatibility

      // Delegate to pipeline service client (Airflow/Argo)
      Map<String, String> clientLogs =
          pipelineServiceClient.getLastIngestionLogs(pipeline, afterCursor);

      // Convert the response to match our interface
      Map<String, Object> result = new HashMap<>();
      String error = clientLogs.get(PipelineServiceClientInterface.LOGS_ERROR_KEY);
      if (error != null) {
        result.put(PipelineServiceClientInterface.LOGS_ERROR_KEY, error);
        return result;
      }
      result.put("logs", extractLogContent(clientLogs));
      result.put("after", clientLogs.get("after"));
      result.put("total", clientLogs.getOrDefault("total", "0"));

      return result;
    } catch (Exception e) {
      // Let the failure surface. Returning empty logs here made an unreachable pipeline service
      // look like a run that simply produced none.
      LOG.error("Failed to get logs for pipeline: {}, runId: {}", pipelineFQN, runId, e);
      throw new UnhandledServerException(
          String.format("Failed to get logs for pipeline %s", pipelineFQN), e);
    }
  }

  /**
   * Pulls the log text out of a client response. Runners key it by task name (see {@code
   * PipelineServiceClientInterface.TYPE_TO_TASK}), e.g. {@code lineage_task}, so only the paging
   * keys are fixed. Take the remaining entries instead of guessing the task name. Today a response
   * carries exactly one task, but iterate in key order so more than one stays deterministic.
   */
  public static String extractLogContent(Map<String, String> clientLogs) {
    if (clientLogs == null) {
      return "";
    }
    return clientLogs.entrySet().stream()
        .filter(e -> !PAGING_KEYS.contains(e.getKey()) && e.getValue() != null)
        .sorted(Map.Entry.comparingByKey())
        .map(Map.Entry::getValue)
        .collect(Collectors.joining("\n"));
  }

  @Override
  public UUID getLatestRunId(String pipelineFQN) {
    // Try to get the latest run ID from pipeline status
    try {
      // Same reason as getLogs above: the runner needs the pipeline's service to find its runs.
      IngestionPipeline pipeline =
          Entity.getEntityByName(Entity.INGESTION_PIPELINE, pipelineFQN, "service", Include.ALL);

      List<PipelineStatus> statuses = pipelineServiceClient.getQueuedPipelineStatus(pipeline);
      if (!statuses.isEmpty()) {
        // Return the run ID of the most recent status
        PipelineStatus latestStatus = statuses.get(0);
        if (latestStatus.getRunId() != null) {
          return UUID.fromString(latestStatus.getRunId());
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to get latest run ID for pipeline: {}", pipelineFQN, e);
    }

    // If no run ID found, generate a new one
    return UUID.randomUUID();
  }

  @Override
  public List<UUID> listRuns(String pipelineFQN, int limit) {
    // Default implementation only supports getting the latest run
    UUID latestRunId = getLatestRunId(pipelineFQN);
    return latestRunId != null ? Collections.singletonList(latestRunId) : Collections.emptyList();
  }

  @Override
  public void deleteLogs(String pipelineFQN, UUID runId) {
    // Default implementation doesn't support deleting logs
    LOG.warn(
        "DefaultLogStorage does not support deleting logs for pipeline: {}, runId: {}",
        pipelineFQN,
        runId);
  }

  @Override
  public void deleteAllLogs(String pipelineFQN) {
    // Default implementation doesn't support deleting logs
    LOG.warn("DefaultLogStorage does not support deleting all logs for pipeline: {}", pipelineFQN);
  }

  @Override
  public boolean logsExist(String pipelineFQN, UUID runId) {
    try {
      Map<String, Object> logs = getLogs(pipelineFQN, runId, null, 1);
      String logContent = (String) logs.get("logs");
      return logContent != null && !logContent.isEmpty();
    } catch (Exception e) {
      return false;
    }
  }

  @Override
  public String getStorageType() {
    return "default";
  }

  @Override
  public void closeStream(String pipelineFQN, UUID runId) {
    // Default implementation doesn't manage streams - logs are handled by pipeline service client
    LOG.debug(
        "DefaultLogStorage closeStream called for pipeline: {}, runId: {} - no action needed",
        pipelineFQN,
        runId);
  }

  @Override
  public void close() {
    // Nothing to close for default implementation
  }
}
