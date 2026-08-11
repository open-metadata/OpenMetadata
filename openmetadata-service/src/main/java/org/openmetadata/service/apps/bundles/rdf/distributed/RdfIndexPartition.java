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

package org.openmetadata.service.apps.bundles.rdf.distributed;

import java.util.UUID;
import lombok.Builder;
import lombok.Data;
import lombok.With;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionStatus;

@Data
@Builder(toBuilder = true)
@With
public class RdfIndexPartition {
  private UUID id;
  private UUID jobId;
  private String entityType;
  private int partitionIndex;
  private long rangeStart;
  private long rangeEnd;
  private long estimatedCount;
  private long workUnits;
  private int priority;
  private PartitionStatus status;
  private long cursor;
  private long processedCount;
  private long successCount;
  private long failedCount;
  private String assignedServer;
  private Long claimedAt;
  private Long startedAt;
  private Long completedAt;
  private Long lastUpdateAt;
  private String lastError;
  private int retryCount;
  private long claimableAt;
}
