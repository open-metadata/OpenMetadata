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
package org.openmetadata.service.rdf.maintenance;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfStorageMaintenanceConfig;
import org.openmetadata.service.apps.bundles.rdf.RdfReindexRunLock;
import org.openmetadata.service.jdbi3.InMemoryRdfReindexLockDAO;
import org.openmetadata.service.rdf.RdfLiveWriteStore;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.storage.CompactionResult;
import org.slf4j.LoggerFactory;

/**
 * The cluster compacts once per interval, never while a reindex holds the RDF lock, and retries
 * only a compaction Fuseki never started. Two service instances sharing one lock table stand in
 * for two servers.
 */
class RdfStorageMaintenanceServiceTest {
  private static final CompactionResult SUCCEEDED =
      new CompactionResult(CompactionResult.Outcome.SUCCEEDED, "1", null, Duration.ofSeconds(3));
  private static final CompactionResult FAILED =
      new CompactionResult(CompactionResult.Outcome.FAILED, "2", "ENOSPC", Duration.ofSeconds(1));

  private final InMemoryRdfReindexLockDAO locks = new InMemoryRdfReindexLockDAO();
  private final RdfRepository repository = mock(RdfRepository.class);
  private final RdfLiveWriteStore compactions = mock(RdfLiveWriteStore.class);
  private final RdfStorageMaintenanceConfig config =
      new RdfStorageMaintenanceConfig().withCompactionIntervalHours(24).withMaxDurationMinutes(30);
  private RdfStorageMaintenanceService serverA;
  private RdfStorageMaintenanceService serverB;

  @BeforeEach
  void setUp() {
    doAnswer(invocation -> invocation.<Function<RdfRepository, ?>>getArgument(1).apply(repository))
        .when(repository)
        .withServingWritesPaused(anyString(), any());
    when(repository.compact(any())).thenReturn(SUCCEEDED);
    when(compactions.lastCompaction()).thenReturn(Instant.now());
    serverA = service("server-a");
    serverB = service("server-b");
  }

  @AfterEach
  void tearDown() {
    serverA.close();
    serverB.close();
  }

  @Test
  void theFirstCheckAfterStartupCompactsWithWritesPausedForTheConfiguredBudget() {
    final CompactionResult result = serverA.compactIfDue();

    assertEquals(SUCCEEDED, result);
    verify(repository).withServingWritesPaused(anyString(), any());
    verify(repository).compact(Duration.ofMinutes(30));
  }

  @Test
  void onlyOneServerCompactsPerInterval() {
    assertNotNull(serverA.compactIfDue());

    assertNull(serverB.compactIfDue());
    assertNull(serverA.compactIfDue());
    verify(repository, times(1)).compact(any());
  }

  @Test
  void theNextCompactionIsDueOnceTheIntervalHasPassed() {
    serverA.compactIfDue();
    locks.expireAll();

    assertNotNull(serverB.compactIfDue());
    verify(repository, times(2)).compact(any());
  }

  @Test
  void aCompactionFusekiRanAndFailedWaitsForTheNextInterval() {
    when(repository.compact(any())).thenReturn(FAILED);

    assertEquals(FAILED, serverA.compactIfDue());
    assertNull(serverB.compactIfDue(), "a copy the volume could not hold fails again");
    verify(repository, times(1)).compact(any());
  }

  @Test
  void aCompactionThatCouldNotBeStartedIsRetriedOnTheNextCheck() {
    final CompactionResult unreachable =
        new CompactionResult(
            CompactionResult.Outcome.UNKNOWN, null, "Connection refused", Duration.ZERO);
    final CompactionResult refused =
        new CompactionResult(CompactionResult.Outcome.FAILED, null, "HTTP 500", Duration.ZERO);
    when(repository.compact(any())).thenReturn(unreachable, refused, SUCCEEDED);

    assertEquals(unreachable, serverA.compactIfDue());
    assertEquals(refused, serverB.compactIfDue());
    assertEquals(SUCCEEDED, serverA.compactIfDue());
    assertNull(serverB.compactIfDue());
  }

  @Test
  void aCompactionFusekiLostWaitsForTheNextInterval() {
    final CompactionResult lost =
        new CompactionResult(
            CompactionResult.Outcome.UNKNOWN,
            "3",
            "Fuseki no longer reports task 3",
            Duration.ofMinutes(4));
    when(repository.compact(any())).thenReturn(lost);

    assertEquals(lost, serverA.compactIfDue());
    assertNull(serverB.compactIfDue(), "Fuseki restarted during the copy; retrying restarts it");
    verify(repository, times(1)).compact(any());
  }

  @Test
  void aCompactionStillRunningAtItsBudgetWaitsForTheNextInterval() {
    final CompactionResult running =
        new CompactionResult(
            CompactionResult.Outcome.TIMED_OUT, "4", "still running", Duration.ofHours(4));
    when(repository.compact(any())).thenReturn(running);

    assertEquals(running, serverA.compactIfDue());
    assertNull(serverB.compactIfDue(), "a second copy would only queue behind the first");
    verify(repository, times(1)).compact(any());
  }

  @Test
  void aRunningReindexDefersTheCompactionWithoutUsingTheInterval() {
    final RdfReindexRunLock reindex = RdfReindexRunLock.forRun(locks, "reindex-run", "server-c");
    reindex.acquire();

    assertNull(serverA.compactIfDue());
    verify(repository, never()).compact(any());

    reindex.release();
    assertEquals(SUCCEEDED, serverA.compactIfDue());
  }

  @Test
  void theReindexLockIsReleasedAfterACompaction() {
    serverA.compactIfDue();

    assertDoesNotThrow(RdfReindexRunLock.forRun(locks, "reindex-run", "server-c")::acquire);
  }

  @Test
  void aSucceededCompactionIsRecordedForTheWholeCluster() {
    serverA.compactIfDue();

    verify(compactions).recordCompaction();
  }

  @Test
  void aCompactionThatDidNotSucceedIsNotRecorded() {
    when(repository.compact(any())).thenReturn(FAILED);

    serverA.compactIfDue();

    verify(compactions, never()).recordCompaction();
  }

  @Test
  void aStoreWithNothingToCompactCountsAsUpToDate() {
    when(repository.compact(any())).thenReturn(CompactionResult.unsupported());

    serverA.compactIfDue();

    verify(compactions).recordCompaction();
  }

  @Test
  void everyCheckLogsAnErrorOnceNoCompactionSucceededForTwoIntervals() {
    when(compactions.lastCompaction()).thenReturn(Instant.now().minus(Duration.ofHours(49)));
    final Logger logger = (Logger) LoggerFactory.getLogger(RdfStorageMaintenanceService.class);
    final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
    try {
      serverA.compactIfDue();
      serverB.compactIfDue();

      final long overdueErrors =
          appender.list.stream()
              .filter(event -> event.getLevel() == Level.ERROR)
              .filter(event -> event.getFormattedMessage().contains("has not compacted"))
              .count();
      assertEquals(2, overdueErrors, "the server that skipped reports it too");
    } finally {
      logger.detachAppender(appender);
      appender.stop();
    }
  }

  @Test
  void aRecentCompactionLogsNoOverdueError() {
    when(compactions.lastCompaction()).thenReturn(Instant.now().minus(Duration.ofHours(47)));
    final Logger logger = (Logger) LoggerFactory.getLogger(RdfStorageMaintenanceService.class);
    final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
    try {
      serverB.compactIfDue();

      assertTrue(appender.list.stream().noneMatch(event -> event.getLevel() == Level.ERROR));
    } finally {
      logger.detachAppender(appender);
      appender.stop();
    }
  }

  private RdfStorageMaintenanceService service(final String serverId) {
    return new RdfStorageMaintenanceService(
        config, locks, compactions, () -> repository, Clock.systemUTC(), serverId);
  }
}
