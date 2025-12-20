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

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import java.util.Map;
import java.util.UUID;
import lombok.Builder;
import lombok.Data;
import lombok.With;
import org.openmetadata.schema.system.EventPublisherJob;

/**
 * Represents a distributed search index job that coordinates reindexing across multiple servers.
 *
 * <p>A job contains the overall configuration and aggregated statistics. Individual work units are
 * tracked via {@link SearchIndexPartition}.
 */
@Data
@Builder(toBuilder = true)
@With
public class SearchIndexJob {

  /** Unique identifier for this job */
  private UUID id;

  /** Current status of the job */
  private IndexJobStatus status;

  /** Job configuration (entities to index, batch size, etc.) */
  private EventPublisherJob jobConfiguration;

  /** Prefix for staged indices during recreation */
  private String targetIndexPrefix;

  /** Total records across all partitions */
  private long totalRecords;

  /** Total records processed so far */
  private long processedRecords;

  /** Total records successfully indexed */
  private long successRecords;

  /** Total records that failed to index */
  private long failedRecords;

  /** Per-entity type statistics */
  private Map<String, EntityTypeStats> entityStats;

  /** Per-server statistics (for distributed jobs) */
  private Map<String, ServerStats> serverStats;

  /** User who created the job */
  private String createdBy;

  /** Timestamp when job was created */
  private long createdAt;

  /** Timestamp when job started processing */
  private Long startedAt;

  /** Timestamp when job completed */
  private Long completedAt;

  /** Timestamp of last update */
  private long updatedAt;

  /** Error message if job failed */
  private String errorMessage;

  /**
   * Registration deadline timestamp. Servers must register before this deadline to participate in
   * fair work distribution. After the deadline, claiming can begin with accurate server count.
   */
  private Long registrationDeadline;

  /** Number of servers registered for this job before the registration deadline */
  private Integer registeredServerCount;

  /** Calculate overall progress percentage */
  public double getProgressPercent() {
    if (totalRecords <= 0) return 0.0;
    return processedRecords * 100.0 / totalRecords;
  }

  /** Check if job is in a terminal state */
  public boolean isTerminal() {
    return status == IndexJobStatus.COMPLETED
        || status == IndexJobStatus.COMPLETED_WITH_ERRORS
        || status == IndexJobStatus.FAILED
        || status == IndexJobStatus.STOPPED;
  }

  /** Check if job is running */
  public boolean isRunning() {
    return status == IndexJobStatus.RUNNING;
  }

  /** Statistics for a specific entity type */
  @Data
  @Builder
  public static class EntityTypeStats {
    private String entityType;
    private long totalRecords;
    private long processedRecords;
    private long successRecords;
    private long failedRecords;
    private int totalPartitions;
    private int completedPartitions;
    private int failedPartitions;

    public double getProgressPercent() {
      if (totalRecords <= 0) return 0.0;
      return processedRecords * 100.0 / totalRecords;
    }
  }

  /** Statistics for a specific server participating in the job */
  @Data
  @Builder
  public static class ServerStats {
    private String serverId;
    private long processedRecords;
    private long successRecords;
    private long failedRecords;
    private int totalPartitions;
    private int completedPartitions;
    private int processingPartitions;
  }
}
