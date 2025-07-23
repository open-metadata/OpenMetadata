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

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Interface for pluggable log storage implementations for ingestion pipelines.
 * Each implementation should support storing, streaming, and retrieving logs
 * for pipeline runs identified by FQN and runId.
 */
public interface LogStorageInterface {

  /**
   * Initialize the log storage with configuration
   * @param config Configuration map specific to the implementation
   */
  void initialize(Map<String, Object> config) throws IOException;

  /**
   * Get an output stream to write logs for a pipeline run.
   * This allows remote pipelines to stream logs directly.
   * @param pipelineFQN Fully qualified name of the pipeline
   * @param runId Unique run identifier
   * @return OutputStream for writing logs
   */
  OutputStream getLogOutputStream(String pipelineFQN, UUID runId) throws IOException;

  /**
   * Append log content for a pipeline run
   * @param pipelineFQN Fully qualified name of the pipeline
   * @param runId Unique run identifier
   * @param logContent Log content to append
   */
  void appendLogs(String pipelineFQN, UUID runId, String logContent) throws IOException;

  /**
   * Stream log content for a pipeline run
   * @param pipelineFQN Fully qualified name of the pipeline
   * @param runId Unique run identifier
   * @return InputStream for reading logs
   */
  InputStream getLogInputStream(String pipelineFQN, UUID runId) throws IOException;

  /**
   * Get logs with pagination support
   * @param pipelineFQN Fully qualified name of the pipeline
   * @param runId Unique run identifier
   * @param afterCursor Cursor for pagination (null for beginning)
   * @param limit Maximum number of lines to return
   * @return Map containing "logs" (content), "after" (next cursor), and "total" (total size)
   */
  Map<String, Object> getLogs(String pipelineFQN, UUID runId, String afterCursor, int limit)
      throws IOException;

  /**
   * Get the latest run ID for a pipeline
   * @param pipelineFQN Fully qualified name of the pipeline
   * @return Latest run ID or null if no runs exist
   */
  UUID getLatestRunId(String pipelineFQN) throws IOException;

  /**
   * List available runs for a pipeline
   * @param pipelineFQN Fully qualified name of the pipeline
   * @param limit Maximum number of runs to return
   * @return List of run IDs sorted by timestamp (newest first)
   */
  List<UUID> listRuns(String pipelineFQN, int limit) throws IOException;

  /**
   * Delete logs for a specific run
   * @param pipelineFQN Fully qualified name of the pipeline
   * @param runId Unique run identifier
   */
  void deleteLogs(String pipelineFQN, UUID runId) throws IOException;

  /**
   * Delete all logs for a pipeline
   * @param pipelineFQN Fully qualified name of the pipeline
   */
  void deleteAllLogs(String pipelineFQN) throws IOException;

  /**
   * Check if logs exist for a run
   * @param pipelineFQN Fully qualified name of the pipeline
   * @param runId Unique run identifier
   * @return true if logs exist
   */
  boolean logsExist(String pipelineFQN, UUID runId) throws IOException;

  /**
   * Get the storage type identifier
   * @return Storage type (e.g., "s3", "file", "database")
   */
  String getStorageType();

  /**
   * Clean up resources
   */
  void close() throws IOException;
}
