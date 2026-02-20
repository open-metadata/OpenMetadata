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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class EntityCompletionTrackerTest {

  @Test
  void testBasicTracking() {
    UUID jobId = UUID.randomUUID();
    EntityCompletionTracker tracker = new EntityCompletionTracker(jobId);

    tracker.initializeEntity("table", 3);
    tracker.initializeEntity("topic", 2);

    assertFalse(tracker.isPromoted("table"));
    assertFalse(tracker.isPromoted("topic"));
    assertEquals(jobId, tracker.getJobId());
  }

  @Test
  void testPartitionCompletionTriggersPromotion() throws InterruptedException {
    UUID jobId = UUID.randomUUID();
    EntityCompletionTracker tracker = new EntityCompletionTracker(jobId);

    CountDownLatch latch = new CountDownLatch(1);
    AtomicReference<String> promotedEntity = new AtomicReference<>();
    AtomicBoolean promotionSuccess = new AtomicBoolean();

    tracker.initializeEntity("table", 3);
    tracker.setOnEntityComplete(
        (entityType, success) -> {
          promotedEntity.set(entityType);
          promotionSuccess.set(success);
          latch.countDown();
        });

    // Complete all partitions successfully
    tracker.recordPartitionComplete("table", false);
    tracker.recordPartitionComplete("table", false);
    tracker.recordPartitionComplete("table", false);

    assertTrue(latch.await(1, TimeUnit.SECONDS), "Callback should be invoked");
    assertEquals("table", promotedEntity.get());
    assertTrue(promotionSuccess.get());
    assertTrue(tracker.isPromoted("table"));
  }

  @Test
  void testPartitionFailureMarksEntityAsFailed() throws InterruptedException {
    UUID jobId = UUID.randomUUID();
    EntityCompletionTracker tracker = new EntityCompletionTracker(jobId);

    CountDownLatch latch = new CountDownLatch(1);
    AtomicBoolean promotionSuccess = new AtomicBoolean(true);

    tracker.initializeEntity("table", 3);
    tracker.setOnEntityComplete(
        (entityType, success) -> {
          promotionSuccess.set(success);
          latch.countDown();
        });

    // Complete with one failure
    tracker.recordPartitionComplete("table", false);
    tracker.recordPartitionComplete("table", true); // This one failed
    tracker.recordPartitionComplete("table", false);

    assertTrue(latch.await(1, TimeUnit.SECONDS), "Callback should be invoked");
    assertFalse(promotionSuccess.get(), "Entity should be marked as failed");
    assertTrue(tracker.isPromoted("table"));
  }

  @Test
  void testMultipleEntitiesIndependentTracking() throws InterruptedException {
    UUID jobId = UUID.randomUUID();
    EntityCompletionTracker tracker = new EntityCompletionTracker(jobId);

    CountDownLatch latch = new CountDownLatch(2);

    tracker.initializeEntity("table", 2);
    tracker.initializeEntity("topic", 1);
    tracker.setOnEntityComplete((entityType, success) -> latch.countDown());

    // Complete topic first (only 1 partition)
    tracker.recordPartitionComplete("topic", false);
    assertTrue(tracker.isPromoted("topic"));
    assertFalse(tracker.isPromoted("table"));

    // Complete table (2 partitions)
    tracker.recordPartitionComplete("table", false);
    assertFalse(tracker.isPromoted("table"));
    tracker.recordPartitionComplete("table", false);
    assertTrue(tracker.isPromoted("table"));

    assertTrue(latch.await(1, TimeUnit.SECONDS), "Both callbacks should be invoked");
    assertEquals(2, tracker.getPromotedEntities().size());
  }

  @Test
  void testGetStatus() {
    UUID jobId = UUID.randomUUID();
    EntityCompletionTracker tracker = new EntityCompletionTracker(jobId);

    tracker.initializeEntity("table", 4);
    tracker.recordPartitionComplete("table", false);
    tracker.recordPartitionComplete("table", true);

    EntityCompletionTracker.EntityCompletionStatus status = tracker.getStatus("table");
    assertNotNull(status);
    assertEquals("table", status.entityType());
    assertEquals(4, status.totalPartitions());
    assertEquals(2, status.completedPartitions());
    assertEquals(1, status.failedPartitions());
    assertFalse(status.isComplete());
    assertTrue(status.hasFailures());
    assertFalse(status.promoted());
  }

  @Test
  void testGetStatusForUnknownEntity() {
    UUID jobId = UUID.randomUUID();
    EntityCompletionTracker tracker = new EntityCompletionTracker(jobId);

    assertNull(tracker.getStatus("unknown"));
  }

  @Test
  void testCallbackOnlyCalledOnce() throws InterruptedException {
    UUID jobId = UUID.randomUUID();
    EntityCompletionTracker tracker = new EntityCompletionTracker(jobId);

    java.util.concurrent.atomic.AtomicInteger callCount =
        new java.util.concurrent.atomic.AtomicInteger(0);

    tracker.initializeEntity("table", 2);
    tracker.setOnEntityComplete((entityType, success) -> callCount.incrementAndGet());

    // Complete all partitions
    tracker.recordPartitionComplete("table", false);
    tracker.recordPartitionComplete("table", false);

    // Try to complete again (shouldn't trigger callback)
    tracker.recordPartitionComplete("table", false);
    tracker.recordPartitionComplete("table", false);

    Thread.sleep(100); // Give time for any spurious callbacks
    assertEquals(1, callCount.get(), "Callback should only be called once per entity");
  }

  @Test
  void testRecordPartitionCompleteForUntrackedEntity() {
    UUID jobId = UUID.randomUUID();
    EntityCompletionTracker tracker = new EntityCompletionTracker(jobId);

    // Should not throw, just log a warning
    tracker.recordPartitionComplete("unknown", false);
    assertFalse(tracker.isPromoted("unknown"));
  }

  @Test
  void testGetPromotedEntitiesIsImmutable() {
    UUID jobId = UUID.randomUUID();
    EntityCompletionTracker tracker = new EntityCompletionTracker(jobId);

    tracker.initializeEntity("table", 1);
    tracker.recordPartitionComplete("table", false);

    var promoted = tracker.getPromotedEntities();
    try {
      promoted.add("hacked");
    } catch (UnsupportedOperationException e) {
      // Expected - set is immutable
    }
    assertEquals(1, tracker.getPromotedEntities().size());
  }
}
