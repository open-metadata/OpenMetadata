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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

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
}
