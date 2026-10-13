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

package org.openmetadata.service.apps.bundles.dataRetention;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.applications.configuration.internal.DataRetentionConfiguration;
import org.openmetadata.schema.utils.JsonUtils;

class DataRetentionTest {
  @Test
  void zeroOrMissingRetentionMeansForever() {
    assertFalse(DataRetention.isRetentionEnabled(null));
    assertFalse(DataRetention.isRetentionEnabled(0));
    assertTrue(DataRetention.isRetentionEnabled(1));
  }

  /**
   * workflowRetentionPeriod is deliberately not `required`, so an app configuration saved before it
   * existed must fall back to the schema default instead of deserializing to null - the app reads
   * it as an int.
   */
  @Test
  void workflowRetentionFallsBackToDefaultForConfigsSavedWithoutIt() {
    DataRetentionConfiguration config =
        JsonUtils.readValue(
            "{\"changeEventRetentionPeriod\": 7}", DataRetentionConfiguration.class);

    assertEquals(30, config.getWorkflowRetentionPeriod());
  }

  /**
   * Models the drain the automation-workflow cleanup runs: each batch fetches up to BATCH_SIZE ids
   * oldest-first and reports only the rows it actually deleted, so one permanently undeletable row
   * heads every batch. This pins the predicate choice, not the delete itself - that needs a live
   * repository and is covered by DataRetentionAppIT.
   */
  @Test
  void aPoisonRowDoesNotStopTheWorkflowDrain() {
    int batchSize = 10;
    int backlog = 50;

    // The old `deleted < batchSize` predicate ended the run as soon as a batch came back short,
    // which a batch containing the poison row always does.
    BatchDrain.Result shortBatchStops =
        BatchDrain.drain(
            poisonBacklog(backlog, batchSize), deleted -> deleted < batchSize, batchSize);
    assertEquals(
        batchSize - 1,
        shortBatchStops.deleted(),
        "stopping on a short batch clears only one batch per run");

    BatchDrain.Result zeroProgressStops =
        BatchDrain.drain(poisonBacklog(backlog, batchSize), deleted -> deleted == 0, batchSize);
    assertEquals(
        backlog - 1,
        zeroProgressStops.deleted(),
        "stopping on zero progress drains the backlog down to the poison row");
    assertFalse(
        zeroProgressStops.hitIterationCap(), "an all-poison batch must end the drain, not spin");
  }

  /** A backlog of {@code remaining} rows in which the oldest row can never be deleted. */
  private static Supplier<Integer> poisonBacklog(int remaining, int batchSize) {
    AtomicInteger left = new AtomicInteger(remaining);
    return () -> {
      int fetched = Math.min(batchSize, left.get());
      int deleted = Math.max(0, fetched - 1);
      left.addAndGet(-deleted);
      return deleted;
    };
  }
}
