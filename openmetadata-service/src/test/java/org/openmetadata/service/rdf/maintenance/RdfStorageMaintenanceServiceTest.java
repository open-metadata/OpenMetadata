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
import static org.junit.jupiter.api.Assertions.assertFalse;
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

import java.time.Clock;
import java.time.Duration;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfStorageMaintenanceConfig;
import org.openmetadata.service.apps.bundles.rdf.RdfReindexRunLock;
import org.openmetadata.service.cluster.ClusterCapabilities;
import org.openmetadata.service.jdbi3.InMemoryRdfReindexLockDAO;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.inference.InferenceRunLock;
import org.openmetadata.service.rdf.storage.CompactionResult;
import org.openmetadata.service.rdf.storage.StorageFacts;

/**
 * The cluster compacts once per interval, never while a reindex holds the RDF lock, and retries
 * only a compaction Fuseki never started. Two service instances sharing one lock table stand in
 * for two servers.
 */
class RdfStorageMaintenanceServiceTest {
  private static final long GIB = 1L << 30;
  private static final CompactionResult SUCCEEDED =
      new CompactionResult(CompactionResult.Outcome.SUCCEEDED, "1", null, Duration.ofSeconds(3));
  private static final CompactionResult FAILED =
      new CompactionResult(CompactionResult.Outcome.FAILED, "2", "ENOSPC", Duration.ofSeconds(1));

  private final InMemoryRdfReindexLockDAO locks = new InMemoryRdfReindexLockDAO();
  private final RdfRepository repository = mock(RdfRepository.class);
  private final RdfStorageMaintenanceConfig config =
      new RdfStorageMaintenanceConfig()
          .withCompactionIntervalHours(24)
          .withMaxDurationMinutes(30)
          .withUrgentFreeSpacePercent(50);
  private ClusterCapabilities cluster = capability -> Set.of();
  private RdfStorageMaintenanceService serverA;
  private RdfStorageMaintenanceService serverB;

  @BeforeEach
  void setUp() {
    doAnswer(invocation -> invocation.<Function<RdfRepository, ?>>getArgument(1).apply(repository))
        .when(repository)
        .withServingWritesPaused(anyString(), any());
    when(repository.compact(any())).thenReturn(SUCCEEDED);
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
  void anOlderServerInTheClusterHoldsMaintenanceBack() {
    cluster = capability -> Set.of("old-server (not registered: older than the server registry)");
    serverA.close();
    serverA = service("server-a");

    assertNull(serverA.compactIfDue(), "the old server would keep writing into the compaction");
    verify(repository, never()).compact(any());
    assertNull(locks.findByKey(RdfStorageMaintenanceService.NEXT_COMPACTION_KEY));
  }

  @Test
  void maintenanceStartsOnceEveryServerHoldsWritesBack() {
    final AtomicBoolean upgraded = new AtomicBoolean();
    cluster = capability -> upgraded.get() ? Set.of() : Set.of("old-server (version 2.0.7)");
    serverA.close();
    serverA = service("server-a");
    assertNull(serverA.compactIfDue());

    upgraded.set(true);
    assertEquals(SUCCEEDED, serverA.compactIfDue());
  }

  @Test
  void aClusterThatCannotBeListedHoldsMaintenanceBack() {
    cluster =
        capability -> {
          throw new IllegalStateException("database unavailable");
        };
    serverA.close();
    serverA = service("server-a");

    assertNull(serverA.compactIfDue());
    verify(repository, never()).compact(any());
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
    final RdfReindexRunLock reindex =
        RdfReindexRunLock.forMaintenance(locks, "reindex-run", "server-c");
    reindex.acquire();

    assertNull(serverA.compactIfDue());
    verify(repository, never()).compact(any());

    reindex.release();
    assertEquals(SUCCEEDED, serverA.compactIfDue());
  }

  @Test
  void aRunningInferenceDefersTheCompaction() {
    final InferenceRunLock inference = inferenceLock();
    assertTrue(inference.tryAcquire("inference-run"));

    assertNull(serverA.compactIfDue());
    verify(repository, never()).compact(any());

    inference.release("inference-run");
    assertEquals(SUCCEEDED, serverA.compactIfDue());
  }

  @Test
  void inferenceCannotStartUntilTheCompactionEnds() {
    doAnswer(
            invocation -> {
              assertFalse(inferenceLock().tryAcquire("inference-run"));
              return SUCCEEDED;
            })
        .when(repository)
        .compact(any());

    assertEquals(SUCCEEDED, serverA.compactIfDue());
    assertTrue(inferenceLock().tryAcquire("inference-run"));
  }

  @Test
  void theReindexLockIsReleasedAfterACompaction() {
    serverA.compactIfDue();

    assertDoesNotThrow(RdfReindexRunLock.forMaintenance(locks, "reindex-run", "server-c")::acquire);
  }

  @Test
  void aCompactionThatFreesSpaceLetsTheNextBurstBeCompactedAtOnce() {
    serverA.compactIfDue();
    final Optional<StorageFacts> low = Optional.of(new StorageFacts(100 * GIB, 30 * GIB, false));
    final Optional<StorageFacts> freed = Optional.of(new StorageFacts(100 * GIB, 90 * GIB, false));
    when(repository.storageFacts()).thenReturn(low, freed, low, freed);

    assertEquals(SUCCEEDED, serverB.compactIfDue(), "30% free is below the 50% threshold");
    assertEquals(SUCCEEDED, serverA.compactIfDue(), "the store filled up again");
    verify(repository, times(3)).compact(any());
  }

  @Test
  void aCompactionThatCannotFreeSpaceWaitsForTheNextScheduledOne() {
    serverA.compactIfDue();
    when(repository.storageFacts())
        .thenReturn(Optional.of(new StorageFacts(100 * GIB, 30 * GIB, false)));
    final long before = System.currentTimeMillis();

    assertEquals(SUCCEEDED, serverB.compactIfDue());
    assertNull(serverA.compactIfDue(), "data compaction cannot remove fills the volume");
    verify(repository, times(2)).compact(any());
    final long heldFor =
        locks.findByKey(RdfStorageMaintenanceService.URGENT_COMPACTION_KEY).expiresAt() - before;
    assertTrue(heldFor >= Duration.ofHours(23).toMillis(), "held until the next scheduled run");
  }

  @Test
  void anUrgentCompactionFusekiLostWaitsForTheNextScheduledOne() {
    serverA.compactIfDue();
    when(repository.storageFacts())
        .thenReturn(Optional.of(new StorageFacts(100 * GIB, 5 * GIB, true)));
    final CompactionResult lost =
        new CompactionResult(
            CompactionResult.Outcome.UNKNOWN,
            "4",
            "Fuseki no longer reports task 4",
            Duration.ofMinutes(4));
    when(repository.compact(any())).thenReturn(lost);

    assertEquals(lost, serverB.compactIfDue());
    assertNull(serverA.compactIfDue(), "Fuseki restarted during the copy; retrying restarts it");
    verify(repository, times(2)).compact(any());
  }

  @Test
  void aStoreWithRoomWaitsForTheInterval() {
    serverA.compactIfDue();
    when(repository.storageFacts())
        .thenReturn(Optional.of(new StorageFacts(100 * GIB, 70 * GIB, false)));

    assertNull(serverB.compactIfDue());
    verify(repository, times(1)).compact(any());
  }

  @Test
  void aGuardRefusingWritesIsUrgentWhateverTheThreshold() {
    serverA.compactIfDue();
    when(repository.storageFacts())
        .thenReturn(Optional.of(new StorageFacts(100 * GIB, 90 * GIB, true)));

    assertEquals(SUCCEEDED, serverB.compactIfDue());
  }

  private InferenceRunLock inferenceLock() {
    return InferenceRunLock.forCluster(
        locks, InferenceRunLock.MATERIALIZATION_LOCK_KEY, "server-c");
  }

  private RdfStorageMaintenanceService service(final String serverId) {
    return new RdfStorageMaintenanceService(
        config, locks, () -> repository, Clock.systemUTC(), serverId, cluster);
  }
}
