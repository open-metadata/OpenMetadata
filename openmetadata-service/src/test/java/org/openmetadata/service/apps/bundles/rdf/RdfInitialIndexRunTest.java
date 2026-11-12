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
import java.util.function.LongSupplier;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs.AppExtensionTimeSeries;
import org.openmetadata.service.rdf.RdfProjectionStateResolver;

class RdfInitialIndexRunTest {
  private static final long MARK = 1_000;
  private final AppExtensionTimeSeries runStore = mock(AppExtensionTimeSeries.class);
  private final AtomicInteger queuedRuns = new AtomicInteger();

  private RdfInitialIndexRun initialRun(final boolean rdfEnabled, final LongSupplier mark) {
    final RdfProjectionStateResolver resolver =
        new RdfProjectionStateResolver(runStore, () -> false, mark);
    return new RdfInitialIndexRun(
        resolver::hasProjectedSinceRdfWasOff, () -> rdfEnabled, queuedRuns::incrementAndGet);
  }

  private RdfInitialIndexRun initialRun(final boolean rdfEnabled) {
    return initialRun(rdfEnabled, () -> MARK);
  }

  private void givenRuns(final String... runs) {
    when(runStore.listAppExtensionByName("RdfIndexApp", 10, 0, "status")).thenReturn(List.of(runs));
  }

  private static String run(final AppRunRecord.Status status, final long startTime) {
    return JsonUtils.pojoToJson(new AppRunRecord().withStatus(status).withStartTime(startTime));
  }

  private static String runThatFoundRdfOff(final long startTime) {
    return JsonUtils.pojoToJson(
        new AppRunRecord()
            .withStatus(AppRunRecord.Status.SUCCESS)
            .withStartTime(startTime)
            .withSuccessContext(RdfProjectionStateResolver.successContextOfUnchangedProjection()));
  }

  @Test
  void queuesOneRunWhenNoRunRecordExists() {
    givenRuns();

    assertTrue(initialRun(true).run());
    assertEquals(1, queuedRuns.get());
  }

  @Test
  void queuesWhenOnlyRunsThatFoundRdfOffExist() {
    givenRuns(runThatFoundRdfOff(MARK + 1), runThatFoundRdfOff(MARK + 2));

    assertTrue(initialRun(true).run());
    assertEquals(1, queuedRuns.get());
  }

  @Test
  void queuesWhenTheProjectingRunStartedBeforeRdfWasLastOff() {
    givenRuns(runThatFoundRdfOff(MARK + 1), run(AppRunRecord.Status.SUCCESS, MARK - 1));

    assertTrue(initialRun(true).run());
    assertEquals(1, queuedRuns.get());
  }

  @Test
  void queuesNothingOnRestartWhenARunStartedAfterRdfWasLastOff() {
    givenRuns(run(AppRunRecord.Status.SUCCESS, MARK + 1));

    assertFalse(initialRun(true).run());
    assertEquals(0, queuedRuns.get());
  }

  @Test
  void aFailedRunAfterTheMarkIsNotRetriedAtEveryRestart() {
    givenRuns(run(AppRunRecord.Status.FAILED, MARK + 1));

    assertFalse(initialRun(true).run());
    assertEquals(0, queuedRuns.get());
  }

  @Test
  void queuesNothingWhenTheRunIsStillInFlight() {
    givenRuns(run(AppRunRecord.Status.RUNNING, MARK + 1));

    assertFalse(initialRun(true).run());
    assertEquals(0, queuedRuns.get());
  }

  @Test
  void queuesNothingWhenRdfIsOff() {
    givenRuns();

    assertFalse(initialRun(false).run());
    assertEquals(0, queuedRuns.get());
  }

  @Test
  void aRejectedEnqueueDoesNotFailStartup() {
    givenRuns();
    final RdfProjectionStateResolver resolver =
        new RdfProjectionStateResolver(runStore, () -> false, () -> MARK);
    final RdfInitialIndexRun rejected =
        new RdfInitialIndexRun(
            resolver::hasProjectedSinceRdfWasOff,
            () -> true,
            () -> {
              throw new IllegalStateException("scheduler not started");
            });

    assertFalse(rejected.run());
  }

  @Test
  void aMarkReadFailureDoesNotFailStartupOrQueueARun() {
    givenRuns(run(AppRunRecord.Status.SUCCESS, MARK + 1));

    assertFalse(
        initialRun(
                true,
                () -> {
                  throw new IllegalStateException("health row unreadable");
                })
            .run());
    assertEquals(0, queuedRuns.get());
  }
}
