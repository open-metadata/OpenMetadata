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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.search.ReindexContext;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PartitionWorkerTest {

  @Mock private DistributedSearchIndexCoordinator coordinator;
  @Mock private BulkSink bulkSink;
  @Mock private ReindexContext recreateContext;

  private PartitionWorker worker;

  private static final int BATCH_SIZE = 100;
  private static final String TEST_SERVER_ID = "test-server-1";

  @BeforeEach
  void setUp() {
    worker = new PartitionWorker(coordinator, bulkSink, BATCH_SIZE, recreateContext, false);
  }

  @Test
  void testStopAndIsStopped() {
    assertFalse(worker.isStopped());

    worker.stop();

    assertTrue(worker.isStopped());
  }

  @Test
  void testStopMultipleTimes() {
    worker.stop();
    assertTrue(worker.isStopped());

    worker.stop();
    assertTrue(worker.isStopped());
  }

  @Test
  void testBatchResult_Record() {
    PartitionWorker.BatchResult result = new PartitionWorker.BatchResult(95, 5);

    assertEquals(95, result.successCount());
    assertEquals(5, result.failedCount());
  }

  @Test
  void testPartitionResult_Record() {
    PartitionWorker.PartitionResult result = new PartitionWorker.PartitionResult(9500, 500, false);

    assertEquals(9500, result.successCount());
    assertEquals(500, result.failedCount());
    assertFalse(result.wasStopped());
  }

  @Test
  void testPartitionResult_WasStopped() {
    PartitionWorker.PartitionResult result = new PartitionWorker.PartitionResult(5000, 100, true);

    assertEquals(5000, result.successCount());
    assertEquals(100, result.failedCount());
    assertTrue(result.wasStopped());
  }

  @Test
  void testWorkerWithDifferentConfigurations() {
    PartitionWorker workerWithRecreate =
        new PartitionWorker(coordinator, bulkSink, 200, recreateContext, true);

    assertFalse(workerWithRecreate.isStopped());

    PartitionWorker workerWithoutContext =
        new PartitionWorker(coordinator, bulkSink, 50, null, false);

    assertFalse(workerWithoutContext.isStopped());
  }

  @Test
  void testProcessPartition_ImmediatelyStopped() {
    UUID partitionId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();

    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(partitionId)
            .jobId(jobId)
            .entityType("table")
            .partitionIndex(0)
            .rangeStart(0)
            .rangeEnd(1000)
            .estimatedCount(1000)
            .workUnits(1500)
            .priority(50)
            .status(PartitionStatus.PENDING)
            .cursor(0)
            .build();

    doNothing().when(coordinator).updatePartitionProgress(any());

    worker.stop();

    PartitionWorker.PartitionResult result = worker.processPartition(partition);

    assertTrue(result.wasStopped());
    assertEquals(0, result.successCount());
    assertEquals(0, result.failedCount());

    verify(coordinator).updatePartitionProgress(any());
  }

  @Test
  void testPartitionBuilder() {
    UUID partitionId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();

    SearchIndexPartition partition =
        SearchIndexPartition.builder()
            .id(partitionId)
            .jobId(jobId)
            .entityType("user")
            .partitionIndex(1)
            .rangeStart(5000)
            .rangeEnd(10000)
            .estimatedCount(5000)
            .workUnits(7500)
            .priority(75)
            .status(PartitionStatus.PENDING)
            .cursor(5000)
            .build();

    assertEquals(partitionId, partition.getId());
    assertEquals(jobId, partition.getJobId());
    assertEquals("user", partition.getEntityType());
    assertEquals(1, partition.getPartitionIndex());
    assertEquals(5000, partition.getRangeStart());
    assertEquals(10000, partition.getRangeEnd());
    assertEquals(5000, partition.getEstimatedCount());
    assertEquals(7500, partition.getWorkUnits());
    assertEquals(75, partition.getPriority());
    assertEquals(PartitionStatus.PENDING, partition.getStatus());
    assertEquals(5000, partition.getCursor());
  }

  @Test
  void testPartitionToBuilder() {
    UUID partitionId = UUID.randomUUID();
    UUID jobId = UUID.randomUUID();

    SearchIndexPartition original =
        SearchIndexPartition.builder()
            .id(partitionId)
            .jobId(jobId)
            .entityType("table")
            .partitionIndex(0)
            .rangeStart(0)
            .rangeEnd(5000)
            .estimatedCount(5000)
            .workUnits(7500)
            .priority(50)
            .status(PartitionStatus.PENDING)
            .cursor(0)
            .processedCount(0)
            .successCount(0)
            .failedCount(0)
            .build();

    SearchIndexPartition updated =
        original.toBuilder()
            .status(PartitionStatus.PROCESSING)
            .cursor(2500)
            .processedCount(2500)
            .successCount(2400)
            .failedCount(100)
            .startedAt(System.currentTimeMillis())
            .build();

    assertEquals(partitionId, updated.getId());
    assertEquals(jobId, updated.getJobId());
    assertEquals("table", updated.getEntityType());
    assertEquals(PartitionStatus.PROCESSING, updated.getStatus());
    assertEquals(2500, updated.getCursor());
    assertEquals(2500, updated.getProcessedCount());
    assertEquals(2400, updated.getSuccessCount());
    assertEquals(100, updated.getFailedCount());
  }

  @Test
  void testBatchResultEquality() {
    PartitionWorker.BatchResult result1 = new PartitionWorker.BatchResult(100, 5);
    PartitionWorker.BatchResult result2 = new PartitionWorker.BatchResult(100, 5);
    PartitionWorker.BatchResult result3 = new PartitionWorker.BatchResult(100, 10);

    assertEquals(result1, result2);
    assertFalse(result1.equals(result3));
  }

  @Test
  void testPartitionResultEquality() {
    PartitionWorker.PartitionResult result1 = new PartitionWorker.PartitionResult(1000, 50, false);
    PartitionWorker.PartitionResult result2 = new PartitionWorker.PartitionResult(1000, 50, false);
    PartitionWorker.PartitionResult result3 = new PartitionWorker.PartitionResult(1000, 50, true);

    assertEquals(result1, result2);
    assertFalse(result1.equals(result3));
  }
}
