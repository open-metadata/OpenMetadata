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
   * The automation-workflow cleanup deletes per entity and reports only the rows it actually
   * removed, so a batch in which every delete fails reports 0. That has to end the drain: the batch
   * query is ordered oldest first, so a retry would hand back the same rows forever.
   */
  @Test
  void aBatchThatDeletesNothingEndsTheDrain() {
    AtomicInteger batches = new AtomicInteger();

    BatchDrain.drain(batches::incrementAndGet, deleted -> deleted < 10, 10);
    assertEquals(1, batches.get(), "a first batch reporting fewer rows than asked is drained");

    batches.set(0);
    BatchDrain.Result result =
        BatchDrain.drain(
            () -> {
              batches.incrementAndGet();
              return 0;
            },
            deleted -> deleted < 10,
            10);

    assertEquals(1, batches.get(), "a batch that removed nothing must not be retried");
    assertEquals(0, result.deleted());
    assertFalse(result.hitIterationCap(), "the drain must finish, not exhaust its iteration cap");
  }
}
