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
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.RdfStorageMaintenanceConfig;
import org.openmetadata.service.apps.bundles.rdf.RdfReindexRunLock;
import org.openmetadata.service.jdbi3.InMemoryRdfReindexLockDAO;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.inference.InferenceRunLock;
import org.openmetadata.service.rdf.storage.CompactionResult;

/**
 * The cluster compacts once per interval, never while a reindex holds the RDF lock, and keeps
 * retrying until a compaction succeeds, unless Fuseki restarted during it. Two service instances
 * sharing one lock table stand in for two servers.
 */
class RdfStorageMaintenanceServiceTest {
  private static final CompactionResult SUCCEEDED =
      new CompactionResult(CompactionResult.Outcome.SUCCEEDED, "1", null, Duration.ofSeconds(3));
  private static final CompactionResult FAILED =
      new CompactionResult(CompactionResult.Outcome.FAILED, "2", "ENOSPC", Duration.ofSeconds(1));

  private final InMemoryRdfReindexLockDAO locks = new InMemoryRdfReindexLockDAO();
  private final RdfRepository repository = mock(RdfRepository.class);
  private final RdfStorageMaintenanceConfig config =
      new RdfStorageMaintenanceConfig().withCompactionIntervalHours(24).withMaxDurationMinutes(30);
  private RdfStorageMaintenanceService serverA;
  private RdfStorageMaintenanceService serverB;

  @BeforeEach
  void setUp() {
    doAnswer(invocation -> invocation.<Supplier<?>>getArgument(1).get())
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
  void aCompactionThatDidNotSucceedIsRetriedOnTheNextCheck() {
    when(repository.compact(any())).thenReturn(FAILED, SUCCEEDED);

    assertEquals(FAILED, serverA.compactIfDue());
    assertEquals(SUCCEEDED, serverB.compactIfDue());
    assertNull(serverA.compactIfDue());
  }

  @Test
  void aCompactionThatCouldNotBeStartedIsRetriedOnTheNextCheck() {
    final CompactionResult unreachable =
        new CompactionResult(
            CompactionResult.Outcome.UNKNOWN, null, "Connection refused", Duration.ZERO);
    when(repository.compact(any())).thenReturn(unreachable, SUCCEEDED);

    assertEquals(unreachable, serverA.compactIfDue());
    assertEquals(SUCCEEDED, serverB.compactIfDue());
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

  private InferenceRunLock inferenceLock() {
    return InferenceRunLock.forCluster(
        locks, InferenceRunLock.MATERIALIZATION_LOCK_KEY, "server-c");
  }

  private RdfStorageMaintenanceService service(final String serverId) {
    return new RdfStorageMaintenanceService(
        config, locks, () -> repository, Clock.systemUTC(), serverId);
  }
}
