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

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class SearchIndexPartitionTest {

  @Test
  void testToBuilder() {
    UUID id = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();

    SearchIndexPartition original =
        SearchIndexPartition.builder()
            .id(id)
            .jobId(jobId)
            .entityType("table")
            .partitionIndex(0)
            .rangeStart(0)
            .rangeEnd(1000)
            .cursor(0)
            .status(PartitionStatus.PENDING)
            .processedCount(0)
            .successCount(0)
            .failedCount(0)
            .retryCount(0)
            .build();

    SearchIndexPartition updated =
        original.toBuilder()
            .status(PartitionStatus.PROCESSING)
            .cursor(500)
            .processedCount(500)
            .successCount(480)
            .failedCount(20)
            .assignedServer("server-1")
            .build();

    // Original unchanged
    assertEquals(PartitionStatus.PENDING, original.getStatus());
    assertEquals(0, original.getCursor());

    // Updated has new values
    assertEquals(PartitionStatus.PROCESSING, updated.getStatus());
    assertEquals(500, updated.getCursor());
    assertEquals(500, updated.getProcessedCount());
    assertEquals(480, updated.getSuccessCount());
    assertEquals(20, updated.getFailedCount());
    assertEquals("server-1", updated.getAssignedServer());

    // Unchanged values preserved
    assertEquals(id, updated.getId());
    assertEquals(jobId, updated.getJobId());
    assertEquals("table", updated.getEntityType());
    assertEquals(0, updated.getRangeStart());
    assertEquals(1000, updated.getRangeEnd());
  }
}
