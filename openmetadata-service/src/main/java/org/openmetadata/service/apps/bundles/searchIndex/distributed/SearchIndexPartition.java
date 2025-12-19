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

import java.util.UUID;
import lombok.Builder;
import lombok.Data;
import lombok.With;

/**
 * Represents a partition of entities to be indexed during distributed reindexing.
 *
 * <p>Each partition represents a range of entities (by offset) for a specific entity type. Multiple
 * servers can process different partitions in parallel, enabling horizontal scaling of the
 * reindexing process.
 */
@Data
@Builder(toBuilder = true)
@With
public class SearchIndexPartition {

  /** Unique identifier for this partition */
  private UUID id;

  /** The job this partition belongs to */
  private UUID jobId;

  /** Entity type being indexed (e.g., "table", "dashboard") */
  private String entityType;

  /** Index of this partition within the entity type (0-based) */
  private int partitionIndex;

  /** Starting offset for this partition (inclusive) */
  private long rangeStart;

  /** Ending offset for this partition (exclusive) */
  private long rangeEnd;

  /** Estimated number of entities in this partition */
  private long estimatedCount;

  /**
   * Work units for load balancing (considers entity complexity). Higher work units = more
   * processing time expected.
   */
  private long workUnits;

  /** Priority for processing order (higher = processed first). Used for dependency ordering. */
  private int priority;

  /** Current status of this partition */
  private PartitionStatus status;

  /** Current cursor position (offset of last processed entity) */
  private long cursor;

  /** Number of entities processed so far */
  private long processedCount;

  /** Number of entities successfully indexed */
  private long successCount;

  /** Number of entities that failed to index */
  private long failedCount;

  /** Server instance ID that claimed this partition */
  private String assignedServer;

  /** Timestamp when partition was claimed */
  private Long claimedAt;

  /** Timestamp when processing started */
  private Long startedAt;

  /** Timestamp when processing completed */
  private Long completedAt;

  /** Timestamp of last progress update */
  private Long lastUpdateAt;

  /** Last error message if any */
  private String lastError;

  /** Number of retry attempts */
  private int retryCount;

  /** Calculate progress percentage */
  public double getProgressPercent() {
    long total = rangeEnd - rangeStart;
    if (total <= 0) return 100.0;
    return (cursor - rangeStart) * 100.0 / total;
  }

  /** Check if this partition is complete */
  public boolean isComplete() {
    return status == PartitionStatus.COMPLETED || status == PartitionStatus.FAILED;
  }

  /** Check if this partition can be claimed */
  public boolean isClaimable() {
    return status == PartitionStatus.PENDING;
  }

  /** Get remaining entities to process */
  public long getRemainingCount() {
    return Math.max(0, rangeEnd - cursor);
  }
}
