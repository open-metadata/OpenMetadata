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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class SearchIndexPartitionTest {

  @Test
  void testProgressPercent_NoProgress() {
    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(UUID.randomUUID())
            .entityType("table")
            .rangeStart(0)
            .rangeEnd(1000)
            .cursor(0)
            .build();

    assertEquals(0.0, partition.getProgressPercent());
  }

  @Test
  void testProgressPercent_PartialProgress() {
    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(UUID.randomUUID())
            .entityType("table")
            .rangeStart(0)
            .rangeEnd(1000)
            .cursor(250)
            .build();

    assertEquals(25.0, partition.getProgressPercent());
  }

  @Test
  void testProgressPercent_Complete() {
    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(UUID.randomUUID())
            .entityType("table")
            .rangeStart(0)
            .rangeEnd(1000)
            .cursor(1000)
            .build();

    assertEquals(100.0, partition.getProgressPercent());
  }

  @Test
  void testProgressPercent_EmptyRange() {
    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(UUID.randomUUID())
            .entityType("table")
            .rangeStart(0)
            .rangeEnd(0)
            .cursor(0)
            .build();

    assertEquals(100.0, partition.getProgressPercent());
  }

  @Test
  void testProgressPercent_NonZeroStart() {
    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .jobId(UUID.randomUUID())
            .entityType("table")
            .rangeStart(1000)
            .rangeEnd(2000)
            .cursor(1500)
            .build();

    assertEquals(50.0, partition.getProgressPercent());
  }

  @Test
  void testIsComplete_CompletedStatus() {
    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .status(PartitionStatus.COMPLETED)
            .build();

    assertTrue(partition.isComplete());
  }

  @Test
  void testIsComplete_FailedStatus() {
    SearchIndexPartition partition =
        SearchIndexPartition.builder().id(UUID.randomUUID()).status(PartitionStatus.FAILED).build();

    assertTrue(partition.isComplete());
  }

  @Test
  void testIsComplete_NonCompleteStatuses() {
    for (PartitionStatus status :
        new PartitionStatus[] {
          PartitionStatus.PENDING, PartitionStatus.PROCESSING, PartitionStatus.CANCELLED
        }) {
      SearchIndexPartition partition =
          SearchIndexPartition.builder().id(UUID.randomUUID()).status(status).build();

      assertFalse(partition.isComplete(), "Status " + status + " should not be complete");
    }
  }

  @Test
  void testIsClaimable_PendingStatus() {
    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .status(PartitionStatus.PENDING)
            .build();

    assertTrue(partition.isClaimable());
  }

  @Test
  void testIsClaimable_NonClaimableStatuses() {
    for (PartitionStatus status :
        new PartitionStatus[] {
          PartitionStatus.PROCESSING,
          PartitionStatus.COMPLETED,
          PartitionStatus.FAILED,
          PartitionStatus.CANCELLED
        }) {
      SearchIndexPartition partition =
          SearchIndexPartition.builder().id(UUID.randomUUID()).status(status).build();

      assertFalse(partition.isClaimable(), "Status " + status + " should not be claimable");
    }
  }

  @Test
  void testGetRemainingCount() {
    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .rangeStart(0)
            .rangeEnd(1000)
            .cursor(300)
            .build();

    assertEquals(700, partition.getRemainingCount());
  }

  @Test
  void testGetRemainingCount_Complete() {
    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .rangeStart(0)
            .rangeEnd(1000)
            .cursor(1000)
            .build();

    assertEquals(0, partition.getRemainingCount());
  }

  @Test
  void testGetRemainingCount_CursorBeyondRange() {
    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(UUID.randomUUID())
            .rangeStart(0)
            .rangeEnd(1000)
            .cursor(1500) // Shouldn't happen, but test defensive coding
            .build();

    assertEquals(0, partition.getRemainingCount());
  }

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

  @Test
  void testFullPartitionLifecycle() {
    UUID id = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();

    // Create pending partition
    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(id)
            .jobId(jobId)
            .entityType("table")
            .partitionIndex(0)
            .rangeStart(0)
            .rangeEnd(1000)
            .estimatedCount(1000)
            .workUnits(1500) // complexity factor applied
            .priority(50)
            .status(PartitionStatus.PENDING)
            .cursor(0)
            .processedCount(0)
            .successCount(0)
            .failedCount(0)
            .retryCount(0)
            .build();

    assertTrue(partition.isClaimable());
    assertFalse(partition.isComplete());
    assertEquals(0.0, partition.getProgressPercent());

    // Claim partition
    SearchIndexPartition claimed =
        partition.toBuilder()
            .status(PartitionStatus.PROCESSING)
            .assignedServer("server-1")
            .claimedAt(System.currentTimeMillis())
            .startedAt(System.currentTimeMillis())
            .build();

    assertFalse(claimed.isClaimable());
    assertFalse(claimed.isComplete());

    // Progress through partition
    SearchIndexPartition inProgress =
        claimed.toBuilder()
            .cursor(500)
            .processedCount(500)
            .successCount(490)
            .failedCount(10)
            .lastUpdateAt(System.currentTimeMillis())
            .build();

    assertEquals(50.0, inProgress.getProgressPercent());
    assertEquals(500, inProgress.getRemainingCount());

    // Complete partition
    SearchIndexPartition completed =
        inProgress.toBuilder()
            .status(PartitionStatus.COMPLETED)
            .cursor(1000)
            .processedCount(1000)
            .successCount(980)
            .failedCount(20)
            .completedAt(System.currentTimeMillis())
            .lastUpdateAt(System.currentTimeMillis())
            .build();

    assertTrue(completed.isComplete());
    assertFalse(completed.isClaimable());
    assertEquals(100.0, completed.getProgressPercent());
    assertEquals(0, completed.getRemainingCount());
  }
}
