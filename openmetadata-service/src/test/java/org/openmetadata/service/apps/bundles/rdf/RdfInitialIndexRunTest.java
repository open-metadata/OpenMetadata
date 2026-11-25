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

package org.openmetadata.service.apps.bundles.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs.AppExtensionTimeSeries;

class RdfInitialIndexRunTest {
  private final AppExtensionTimeSeries runStore = mock(AppExtensionTimeSeries.class);
  private final AtomicInteger queuedRuns = new AtomicInteger();

  private RdfInitialIndexRun initialRun(final boolean rdfEnabled) {
    return new RdfInitialIndexRun(runStore, () -> rdfEnabled, queuedRuns::incrementAndGet);
  }

  @Test
  void queuesOneRunWhenNoRunRecordExists() {
    when(runStore.listAppExtensionByName("RdfIndexApp", 1, 0, "status")).thenReturn(List.of());

    assertTrue(initialRun(true).run());
    assertEquals(1, queuedRuns.get());
  }

  @Test
  void queuesNothingOnRestartWhenARunRecordExists() {
    final AppRunRecord finished = new AppRunRecord().withStatus(AppRunRecord.Status.SUCCESS);
    when(runStore.listAppExtensionByName("RdfIndexApp", 1, 0, "status"))
        .thenReturn(List.of(JsonUtils.pojoToJson(finished)));

    assertFalse(initialRun(true).run());
    assertEquals(0, queuedRuns.get());
  }

  @Test
  void queuesNothingWhenTheFirstRunIsStillInFlight() {
    final AppRunRecord running = new AppRunRecord().withStatus(AppRunRecord.Status.RUNNING);
    when(runStore.listAppExtensionByName("RdfIndexApp", 1, 0, "status"))
        .thenReturn(List.of(JsonUtils.pojoToJson(running)));

    assertFalse(initialRun(true).run());
    assertEquals(0, queuedRuns.get());
  }

  @Test
  void queuesNothingWhenRdfIsOff() {
    when(runStore.listAppExtensionByName("RdfIndexApp", 1, 0, "status")).thenReturn(List.of());

    assertFalse(initialRun(false).run());
    assertEquals(0, queuedRuns.get());
  }

  @Test
  void aRejectedEnqueueDoesNotFailStartup() {
    when(runStore.listAppExtensionByName("RdfIndexApp", 1, 0, "status")).thenReturn(List.of());
    final RdfInitialIndexRun rejected =
        new RdfInitialIndexRun(
            runStore,
            () -> true,
            () -> {
              throw new IllegalStateException("scheduler not started");
            });

    assertFalse(rejected.run());
  }
}
