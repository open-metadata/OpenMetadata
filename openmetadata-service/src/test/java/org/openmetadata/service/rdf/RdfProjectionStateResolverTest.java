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

package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.LongSupplier;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.rdf.RdfProjectionState;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs.AppExtensionTimeSeries;

class RdfProjectionStateResolverTest {
  private static final int PAGE = RdfProjectionStateResolver.RUN_PAGE_SIZE;
  private final AppExtensionTimeSeries runStore = mock(AppExtensionTimeSeries.class);
  private final AtomicBoolean degraded = new AtomicBoolean();
  private static final long MARK = 1_000;
  private final RdfProjectionStateResolver resolver =
      new RdfProjectionStateResolver(runStore, degraded::get);
  private final RdfProjectionStateResolver markedResolver = resolverWithMark(() -> MARK);

  private RdfProjectionStateResolver resolverWithMark(final LongSupplier rdfDisabledAt) {
    return new RdfProjectionStateResolver(runStore, degraded::get, rdfDisabledAt);
  }

  private void givenRuns(final String... runs) {
    when(runStore.listAppExtensionByName("RdfIndexApp", PAGE, 0, "status"))
        .thenReturn(List.of(runs));
  }

  @Test
  void reportsRebuildingUntilTheFirstPostMigrationRun() {
    when(runStore.listAppExtensionByName("RdfIndexApp", PAGE, 0, "status")).thenReturn(List.of());

    assertEquals(RdfProjectionState.REBUILDING, resolver.resolve());
  }

  @Test
  void reportsRebuildingWhileTheFirstRunIsStarting() {
    final AppRunRecord run = new AppRunRecord().withStatus(AppRunRecord.Status.STARTED);
    when(runStore.listAppExtensionByName("RdfIndexApp", PAGE, 0, "status"))
        .thenReturn(List.of(JsonUtils.pojoToJson(run)));

    assertEquals(RdfProjectionState.REBUILDING, resolver.resolve());
  }

  @Test
  void reportsReadyOnceTheFirstRunSucceedsOnAnEmptyCatalog() {
    final AppRunRecord run = new AppRunRecord().withStatus(AppRunRecord.Status.SUCCESS);
    when(runStore.listAppExtensionByName("RdfIndexApp", PAGE, 0, "status"))
        .thenReturn(List.of(JsonUtils.pojoToJson(run)));

    assertEquals(RdfProjectionState.READY, resolver.resolve());
  }

  @ParameterizedTest
  @MethodSource("projectionStates")
  void mapsLatestApplicationRunState(
      final AppRunRecord.Status runStatus, final RdfProjectionState expectedState) {
    final AppRunRecord run = new AppRunRecord().withStatus(runStatus);
    when(runStore.listAppExtensionByName("RdfIndexApp", PAGE, 0, "status"))
        .thenReturn(List.of(JsonUtils.pojoToJson(run)));

    assertEquals(expectedState, resolver.resolve());
  }

  @Test
  void resolveConfiguredReadsTheRunStoreOfTheRunningServer() {
    RdfProjectionHealth.markReady();
    final AppRunRecord run = new AppRunRecord().withStatus(AppRunRecord.Status.SUCCESS);
    when(runStore.listAppExtensionByName("RdfIndexApp", PAGE, 0, "status"))
        .thenReturn(List.of(JsonUtils.pojoToJson(run)));
    final CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.appExtensionTimeSeriesDao()).thenReturn(runStore);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);

      assertEquals(RdfProjectionState.READY, RdfProjectionStateResolver.resolveConfigured());
    }
  }

  @Test
  void reportsDegradedForMalformedRunState() {
    when(runStore.listAppExtensionByName("RdfIndexApp", PAGE, 0, "status"))
        .thenReturn(List.of("not-json"));

    assertEquals(RdfProjectionState.DEGRADED, resolver.resolve());
  }

  @Test
  void reportsDegradedWhenAnIncrementalWriteFailsAfterACompletedRebuild() {
    final AppRunRecord run = new AppRunRecord().withStatus(AppRunRecord.Status.COMPLETED);
    when(runStore.listAppExtensionByName("RdfIndexApp", PAGE, 0, "status"))
        .thenReturn(List.of(JsonUtils.pojoToJson(run)));
    degraded.set(true);

    assertEquals(RdfProjectionState.DEGRADED, resolver.resolve());
  }

  @Test
  void aRunSkippedForTheLockLeavesTheStateOfTheRunBeforeIt() {
    when(runStore.listAppExtensionByName("RdfIndexApp", PAGE, 0, "status"))
        .thenReturn(List.of(skippedRun(), run(AppRunRecord.Status.COMPLETED)));

    assertEquals(RdfProjectionState.READY, resolver.resolve());
  }

  @Test
  void onlySkippedRunsReportRebuilding() {
    when(runStore.listAppExtensionByName("RdfIndexApp", PAGE, 0, "status"))
        .thenReturn(List.of(skippedRun()));

    assertEquals(RdfProjectionState.REBUILDING, resolver.resolve());
  }

  @Test
  void aRunStoppedWhileIndexingStillReportsDegraded() {
    when(runStore.listAppExtensionByName("RdfIndexApp", PAGE, 0, "status"))
        .thenReturn(List.of(run(AppRunRecord.Status.STOPPED), run(AppRunRecord.Status.COMPLETED)));

    assertEquals(RdfProjectionState.DEGRADED, resolver.resolve());
  }

  @Test
  void readsPastAFullPageOfSkippedRuns() {
    when(runStore.listAppExtensionByName("RdfIndexApp", PAGE, 0, "status"))
        .thenReturn(Collections.nCopies(PAGE, skippedRun()));
    when(runStore.listAppExtensionByName("RdfIndexApp", PAGE, PAGE, "status"))
        .thenReturn(List.of(run(AppRunRecord.Status.FAILED)));

    assertEquals(RdfProjectionState.DEGRADED, resolver.resolve());
  }

  @Test
  void stopsPagingAfterTheCapAndReportsRebuilding() {
    when(runStore.listAppExtensionByName(eq("RdfIndexApp"), eq(PAGE), anyInt(), eq("status")))
        .thenReturn(Collections.nCopies(PAGE, skippedRun()));

    assertEquals(RdfProjectionState.REBUILDING, resolver.resolve());
    verify(runStore, times(RdfProjectionStateResolver.MAX_RUN_PAGES))
        .listAppExtensionByName(eq("RdfIndexApp"), eq(PAGE), anyInt(), eq("status"));
  }

  @Test
  void aSuccessfulRunThatFoundRdfOffIsSkippedLikeAFlaggedFailure() {
    givenRuns(unchangedRun(MARK + 1), run(AppRunRecord.Status.COMPLETED, MARK + 1));

    assertEquals(RdfProjectionState.READY, markedResolver.resolve());
  }

  @Test
  void onlyRunsThatFoundRdfOffReportRebuilding() {
    givenRuns(unchangedRun(MARK + 1), unchangedRun(MARK + 2));

    assertEquals(RdfProjectionState.REBUILDING, markedResolver.resolve());
  }

  @Test
  void aSuccessContextWithoutTheFlagIsNotSkipped() {
    final AppRunRecord indexed =
        new AppRunRecord()
            .withStatus(AppRunRecord.Status.SUCCESS)
            .withStartTime(MARK + 1)
            .withSuccessContext(new SuccessContext().withStats(new Stats()));
    givenRuns(JsonUtils.pojoToJson(indexed));

    assertEquals(RdfProjectionState.READY, markedResolver.resolve());
  }

  @Test
  void readyWhenTheNewestProjectingRunStartedAfterRdfWasLastOff() {
    givenRuns(run(AppRunRecord.Status.SUCCESS, MARK + 1));

    assertEquals(RdfProjectionState.READY, markedResolver.resolve());
  }

  @Test
  void degradedWhenTheNewestProjectingRunStartedBeforeRdfWasLastOff() {
    givenRuns(run(AppRunRecord.Status.SUCCESS, MARK - 1));

    assertEquals(RdfProjectionState.DEGRADED, markedResolver.resolve());
  }

  @Test
  void aRunThatStartedBeforeTheMarkStaysDegradedBehindFlaggedRunsAfterIt() {
    givenRuns(unchangedRun(MARK + 5), run(AppRunRecord.Status.SUCCESS, MARK - 1));

    assertEquals(RdfProjectionState.DEGRADED, markedResolver.resolve());
  }

  @Test
  void aRunInFlightStillReportsRebuildingBeforeTheMark() {
    givenRuns(run(AppRunRecord.Status.RUNNING, MARK - 1));

    assertEquals(RdfProjectionState.REBUILDING, markedResolver.resolve());
  }

  @Test
  void aRunWithoutAStartTimeFallsBackToItsTimestamp() {
    final AppRunRecord run =
        new AppRunRecord().withStatus(AppRunRecord.Status.SUCCESS).withTimestamp(MARK + 1);
    givenRuns(JsonUtils.pojoToJson(run));

    assertEquals(RdfProjectionState.READY, markedResolver.resolve());
  }

  @Test
  void degradedWhenTheMarkCannotBeRead() {
    givenRuns(run(AppRunRecord.Status.SUCCESS, MARK + 1));

    assertEquals(RdfProjectionState.DEGRADED, resolverWithMark(failingMark()).resolve());
  }

  @Test
  void theMarkIsNotReadWhenTheStateIsNotReady() {
    givenRuns(run(AppRunRecord.Status.FAILED, MARK - 1));

    assertEquals(RdfProjectionState.DEGRADED, resolverWithMark(failingMark()).resolve());
  }

  @Test
  void noProjectingRunHasNotProjectedSinceRdfWasOff() {
    givenRuns();

    assertFalse(markedResolver.hasProjectedSinceRdfWasOff());
  }

  @Test
  void aRunOlderThanTheMarkHasNotProjectedSinceRdfWasOff() {
    givenRuns(run(AppRunRecord.Status.SUCCESS, MARK - 1));

    assertFalse(markedResolver.hasProjectedSinceRdfWasOff());
  }

  @Test
  void aRunStartedAtOrAfterTheMarkHasProjectedSinceRdfWasOff() {
    givenRuns(run(AppRunRecord.Status.SUCCESS, MARK));

    assertTrue(markedResolver.hasProjectedSinceRdfWasOff());
  }

  @Test
  void aFailedRunAfterTheMarkCountsSoARestartDoesNotRetryIt() {
    givenRuns(run(AppRunRecord.Status.FAILED, MARK + 1));

    assertTrue(markedResolver.hasProjectedSinceRdfWasOff());
  }

  @Test
  void onlyFlaggedRunsHaveNotProjectedSinceRdfWasOff() {
    givenRuns(unchangedRun(MARK + 1), skippedRun());

    assertFalse(markedResolver.hasProjectedSinceRdfWasOff());
  }

  @Test
  void anUnflaggedFailedRunOlderThanTheMarkHasNotProjectedSinceRdfWasOff() {
    givenRuns(run(AppRunRecord.Status.FAILED, MARK - 1));

    assertFalse(markedResolver.hasProjectedSinceRdfWasOff());
  }

  @Test
  void aMalformedRunNeverTriggersAnotherRun() {
    givenRuns("not-json");

    assertTrue(markedResolver.hasProjectedSinceRdfWasOff());
  }

  @Test
  void aMarkReadFailureReachesTheCaller() {
    givenRuns(run(AppRunRecord.Status.SUCCESS, MARK + 1));

    assertThrows(
        IllegalStateException.class,
        () -> resolverWithMark(failingMark()).hasProjectedSinceRdfWasOff());
  }

  private static LongSupplier failingMark() {
    return () -> {
      throw new IllegalStateException("health row unreadable");
    };
  }

  private static String run(final AppRunRecord.Status status, final long startTime) {
    return JsonUtils.pojoToJson(new AppRunRecord().withStatus(status).withStartTime(startTime));
  }

  private static String unchangedRun(final long startTime) {
    return JsonUtils.pojoToJson(
        new AppRunRecord()
            .withStatus(AppRunRecord.Status.SUCCESS)
            .withStartTime(startTime)
            .withSuccessContext(RdfProjectionStateResolver.successContextOfUnchangedProjection()));
  }

  private static String run(final AppRunRecord.Status status) {
    return JsonUtils.pojoToJson(new AppRunRecord().withStatus(status));
  }

  private static String skippedRun() {
    final IndexingError held =
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.JOB)
            .withMessage("Skipped: another RDF reindex is running");
    return JsonUtils.pojoToJson(
        new AppRunRecord()
            .withStatus(AppRunRecord.Status.STOPPED)
            .withFailureContext(RdfProjectionStateResolver.failureContext(held, true)));
  }

  private static Stream<Arguments> projectionStates() {
    return Stream.of(
        Arguments.of(AppRunRecord.Status.SUCCESS, RdfProjectionState.READY),
        Arguments.of(AppRunRecord.Status.COMPLETED, RdfProjectionState.READY),
        Arguments.of(AppRunRecord.Status.RUNNING, RdfProjectionState.REBUILDING),
        Arguments.of(AppRunRecord.Status.PENDING, RdfProjectionState.REBUILDING),
        Arguments.of(AppRunRecord.Status.FAILED, RdfProjectionState.DEGRADED),
        Arguments.of(AppRunRecord.Status.ACTIVE_ERROR, RdfProjectionState.DEGRADED),
        Arguments.of(AppRunRecord.Status.STOPPED, RdfProjectionState.DEGRADED));
  }
}
