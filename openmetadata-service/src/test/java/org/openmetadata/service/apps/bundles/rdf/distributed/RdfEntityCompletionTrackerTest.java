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
package org.openmetadata.service.apps.bundles.rdf.distributed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.PartitionStatus;

class RdfEntityCompletionTrackerTest {

  @Test
  void firesCallbackOnceWhenAllPartitionsComplete() {
    UUID jobId = UUID.randomUUID();
    RdfEntityCompletionTracker tracker = new RdfEntityCompletionTracker(jobId);
    tracker.initializeEntity("table", 3);

    AtomicInteger callbackCount = new AtomicInteger();
    AtomicReference<Boolean> capturedSuccess = new AtomicReference<>();
    tracker.setOnEntityComplete(
        (type, success) -> {
          callbackCount.incrementAndGet();
          capturedSuccess.set(success);
        });

    tracker.recordPartitionComplete("table", false);
    tracker.recordPartitionComplete("table", false);
    assertEquals(0, callbackCount.get(), "callback fires only after all partitions complete");

    tracker.recordPartitionComplete("table", false);
    assertEquals(1, callbackCount.get());
    assertTrue(capturedSuccess.get());
    assertTrue(tracker.isPromoted("table"));

    // Extra completions never re-fire the callback
    tracker.recordPartitionComplete("table", false);
    assertEquals(1, callbackCount.get());
  }

  @Test
  void capturesFailureFromAnyPartition() {
    RdfEntityCompletionTracker tracker = new RdfEntityCompletionTracker(UUID.randomUUID());
    tracker.initializeEntity("dashboard", 2);

    AtomicReference<Boolean> capturedSuccess = new AtomicReference<>();
    tracker.setOnEntityComplete((type, success) -> capturedSuccess.set(success));

    tracker.recordPartitionComplete("dashboard", false);
    tracker.recordPartitionComplete("dashboard", true);
    assertFalse(capturedSuccess.get());
  }

  @Test
  void getStatusReportsAccurateCounts() {
    RdfEntityCompletionTracker tracker = new RdfEntityCompletionTracker(UUID.randomUUID());
    tracker.initializeEntity("topic", 5);
    tracker.recordPartitionComplete("topic", false);
    tracker.recordPartitionComplete("topic", true);

    RdfEntityCompletionTracker.EntityCompletionStatus status = tracker.getStatus("topic");
    assertNotNull(status);
    assertEquals(5, status.totalPartitions());
    assertEquals(2, status.completedPartitions());
    assertEquals(1, status.failedPartitions());
    assertFalse(status.isComplete());
    assertTrue(status.hasFailures());
  }

  @Test
  void untrackedEntityIsIgnored() {
    RdfEntityCompletionTracker tracker = new RdfEntityCompletionTracker(UUID.randomUUID());
    AtomicInteger callbackCount = new AtomicInteger();
    tracker.setOnEntityComplete((type, success) -> callbackCount.incrementAndGet());

    tracker.recordPartitionComplete("never-initialized", false);
    assertEquals(0, callbackCount.get());
  }

  @Test
  void reconcilePromotesEntityWithAllPartitionsCompletedWithoutInMemoryTracking() {
    RdfEntityCompletionTracker tracker = new RdfEntityCompletionTracker(UUID.randomUUID());
    AtomicInteger callbackCount = new AtomicInteger();
    AtomicReference<Boolean> capturedSuccess = new AtomicReference<>();
    tracker.setOnEntityComplete(
        (type, success) -> {
          callbackCount.incrementAndGet();
          capturedSuccess.set(success);
        });

    tracker.reconcileFromDatabase(
        List.of(
            partition("table", PartitionStatus.COMPLETED),
            partition("table", PartitionStatus.COMPLETED)));

    assertEquals(1, callbackCount.get());
    assertTrue(capturedSuccess.get());
    assertTrue(tracker.isPromoted("table"));
    assertEquals(Set.of("table"), tracker.getPromotedEntities());
  }

  @Test
  void reconcileTreatsFailedPartitionsAsDoneAndReportsFailure() {
    RdfEntityCompletionTracker tracker = new RdfEntityCompletionTracker(UUID.randomUUID());
    AtomicReference<Boolean> capturedSuccess = new AtomicReference<>();
    tracker.setOnEntityComplete((type, success) -> capturedSuccess.set(success));

    tracker.reconcileFromDatabase(
        List.of(
            partition("dashboard", PartitionStatus.COMPLETED),
            partition("dashboard", PartitionStatus.FAILED)));

    assertFalse(capturedSuccess.get());
    assertTrue(tracker.isPromoted("dashboard"));
  }

  @Test
  void reconcileDoesNotPromoteWhenPartitionsStillPending() {
    RdfEntityCompletionTracker tracker = new RdfEntityCompletionTracker(UUID.randomUUID());
    AtomicInteger callbackCount = new AtomicInteger();
    tracker.setOnEntityComplete((type, success) -> callbackCount.incrementAndGet());

    tracker.reconcileFromDatabase(
        List.of(
            partition("topic", PartitionStatus.COMPLETED),
            partition("topic", PartitionStatus.PENDING),
            partition("topic", PartitionStatus.PROCESSING)));

    assertEquals(0, callbackCount.get());
    assertFalse(tracker.isPromoted("topic"));
    assertTrue(tracker.getPromotedEntities().isEmpty());
  }

  @Test
  void reconcileSkipsAlreadyPromotedEntityOnSecondPass() {
    RdfEntityCompletionTracker tracker = new RdfEntityCompletionTracker(UUID.randomUUID());
    AtomicInteger callbackCount = new AtomicInteger();
    tracker.setOnEntityComplete((type, success) -> callbackCount.incrementAndGet());

    List<RdfIndexPartition> partitions =
        List.of(
            partition("pipeline", PartitionStatus.COMPLETED),
            partition("pipeline", PartitionStatus.COMPLETED));

    tracker.reconcileFromDatabase(partitions);
    tracker.reconcileFromDatabase(partitions);

    assertEquals(1, callbackCount.get());
    assertTrue(tracker.isPromoted("pipeline"));
  }

  @Test
  void reconcileWithEmptyPartitionListPromotesNothing() {
    RdfEntityCompletionTracker tracker = new RdfEntityCompletionTracker(UUID.randomUUID());
    AtomicInteger callbackCount = new AtomicInteger();
    tracker.setOnEntityComplete((type, success) -> callbackCount.incrementAndGet());

    tracker.reconcileFromDatabase(List.of());

    assertEquals(0, callbackCount.get());
    assertTrue(tracker.getPromotedEntities().isEmpty());
  }

  @Test
  void reconcileCatchesThrowingCallbackButStillMarksPromoted() {
    RdfEntityCompletionTracker tracker = new RdfEntityCompletionTracker(UUID.randomUUID());
    AtomicInteger callbackCount = new AtomicInteger();
    tracker.setOnEntityComplete(
        (type, success) -> {
          callbackCount.incrementAndGet();
          throw new IllegalStateException("promotion consumer blew up");
        });

    List<RdfIndexPartition> partitions =
        List.of(
            partition("mlmodel", PartitionStatus.COMPLETED),
            partition("mlmodel", PartitionStatus.COMPLETED));

    tracker.reconcileFromDatabase(partitions);
    assertTrue(tracker.isPromoted("mlmodel"));
    assertEquals(1, callbackCount.get());

    tracker.reconcileFromDatabase(partitions);
    assertEquals(1, callbackCount.get());
  }

  @Test
  void getPromotedEntitiesReturnsImmutableCopy() {
    RdfEntityCompletionTracker tracker = new RdfEntityCompletionTracker(UUID.randomUUID());
    tracker.reconcileFromDatabase(List.of(partition("container", PartitionStatus.COMPLETED)));

    Set<String> promoted = tracker.getPromotedEntities();
    assertEquals(Set.of("container"), promoted);
    assertThrows(UnsupportedOperationException.class, () -> promoted.add("chart"));
  }

  @Test
  void reconcileWithNullCallbackMarksPromotedWithoutError() {
    RdfEntityCompletionTracker tracker = new RdfEntityCompletionTracker(UUID.randomUUID());

    tracker.reconcileFromDatabase(
        List.of(
            partition("glossaryTerm", PartitionStatus.COMPLETED),
            partition("glossaryTerm", PartitionStatus.FAILED)));

    assertTrue(tracker.isPromoted("glossaryTerm"));
    assertEquals(Set.of("glossaryTerm"), tracker.getPromotedEntities());
  }

  private static RdfIndexPartition partition(String entityType, PartitionStatus status) {
    return RdfIndexPartition.builder()
        .id(UUID.randomUUID())
        .entityType(entityType)
        .status(status)
        .build();
  }
}
