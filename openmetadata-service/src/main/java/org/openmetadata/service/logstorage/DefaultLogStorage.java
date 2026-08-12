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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;

/**
 * Default implementation of LogStorageInterface that delegates to the existing
 * PipelineServiceClient for backward compatibility.
 */
@Slf4j
public class DefaultLogStorage implements LogStorageInterface {

  private static final Set<String> PAGING_KEYS = Set.of("total", "after");

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
  public InputStream getLogInputStream(String pipelineFQN, UUID runId) {
    // For default implementation, we delegate to the pipeline service client
    // The runId is not used here as the pipeline service client only supports getting latest logs
    Map<String, Object> logs = getLogs(pipelineFQN, runId, null, Integer.MAX_VALUE);
    String logContent = (String) logs.get("logs");
    return new ByteArrayInputStream(logContent.getBytes(StandardCharsets.UTF_8));
  }

  @Override
  public Map<String, Object> getLogs(
      String pipelineFQN, UUID runId, String afterCursor, int limit) {
    try {
      // Note: The default implementation through pipeline service client (Airflow/Argo)
      // doesn't support fetching logs by specific runId - it always returns the latest logs
      // The runId parameter is ignored here for backward compatibility

      // Load the real pipeline with its service. A synthesized stub carries only the name, which
      // is enough for Airflow but not for runners that locate a run by service (Argo builds its
      // workflow label selector from service.name and fails without it).
      IngestionPipeline pipeline =
          Entity.getEntityByName(Entity.INGESTION_PIPELINE, pipelineFQN, "service", Include.ALL);

      // Delegate to pipeline service client (Airflow/Argo)
      Map<String, String> clientLogs =
          pipelineServiceClient.getLastIngestionLogs(pipeline, afterCursor);

      // Convert the response to match our interface
      Map<String, Object> result = new HashMap<>();
      result.put("logs", extractLogContent(clientLogs));
      result.put("after", clientLogs.get("after"));
      result.put("total", clientLogs.getOrDefault("total", "0"));

      return result;
    } catch (Exception e) {
      // If pipeline service client is not available (e.g., in tests or when Airflow is down),
      // return empty logs instead of failing
      LOG.warn(
          "Failed to get logs from pipeline service client for pipeline: {}, runId: {}. Returning empty logs.",
          pipelineFQN,
          runId,
          e);

      Map<String, Object> result = new HashMap<>();
      result.put("logs", "");
      result.put("after", null);
      result.put("total", 0L);
      return result;
    }
  }

  /**
   * Pulls the log text out of a pipeline service client response. Runners key the content by task
   * name (see {@code PipelineServiceClientInterface.TYPE_TO_TASK}), e.g. {@code lineage_task}, so
   * the only fixed keys are the paging ones. Take the remaining entry rather than guessing the task
   * name, which depends on the pipeline type.
   */
  private static String extractLogContent(Map<String, String> clientLogs) {
    if (clientLogs == null) {
      return "";
    }
    return clientLogs.entrySet().stream()
        .filter(e -> !PAGING_KEYS.contains(e.getKey()) && e.getValue() != null)
        .map(Map.Entry::getValue)
        .findFirst()
        .orElse("");
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
      LOG.warn("Failed to get latest run ID from pipeline status", e);
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
