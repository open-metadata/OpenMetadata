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
package org.openmetadata.service.rdf.repair;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.OptionalLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.ProjectionRepairStateDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.ProjectionRepairStateDAO.RepairState;
import org.openmetadata.service.jobs.ScheduledRepairJob;
import org.openmetadata.service.rdf.RdfRepository;

class RdfRepairJobTest {
  private static final long NOW = 1_800_000_000_000L;
  private static final long LAST_PASS_UNTIL = NOW - Duration.ofMinutes(15).toMillis();
  private static final RepairState LAST_PASS = new RepairState(LAST_PASS_UNTIL, NOW);

  private final CollectionDAO collectionDAO = mock(CollectionDAO.class);
  private final RdfReindexLockDAO locks = mock(RdfReindexLockDAO.class);
  private final StoredRepairState repairState = new StoredRepairState();
  private final RdfRepository rdf = mock(RdfRepository.class);
  private final RdfProjectionCheck projectionCheck = mock(RdfProjectionCheck.class);
  private final ChangedEntitiesRdfRepair changedEntities = mock(ChangedEntitiesRdfRepair.class);
  private final RdfOrphanSweep orphanSweep = mock(RdfOrphanSweep.class);
  private RdfRepository current = rdf;
  private boolean rebuildRunning;
  private OptionalLong oldestQueuedWrite = OptionalLong.empty();
  private RdfRepairJob job;

  @BeforeEach
  void wireBoundaries() {
    when(collectionDAO.rdfReindexLockDAO()).thenReturn(locks);
    when(collectionDAO.projectionRepairStateDAO()).thenReturn(repairState);
    when(locks.tryAcquireLock(
            eq(RdfRepairJob.LOCK_KEY), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(true);
    when(rdf.isEnabled()).thenReturn(true);
    when(rdf.isStorageReachable()).thenReturn(true);
    repairState.stored = LAST_PASS;
    job =
        new RdfRepairJob(
            collectionDAO,
            () -> current,
            new RdfRepairJob.Steps(
                projectionCheck,
                changedEntities,
                orphanSweep,
                () -> rebuildRunning,
                () -> oldestQueuedWrite),
            () -> NOW);
  }

  @Test
  void aPassChecksTheProjectionThenTheEntitiesChangedSinceTheLastOne() throws Exception {
    assertTrue(job.runPassNow(false, ScheduledRepairJob.SETTLE));

    verify(projectionCheck).rebuildIfNeeded();
    verify(changedEntities)
        .repair(
            eq(LAST_PASS_UNTIL - ScheduledRepairJob.OVERLAP.toMillis()),
            eq(NOW - ScheduledRepairJob.SETTLE.toMillis()),
            any());
    assertEquals(NOW - ScheduledRepairJob.SETTLE.toMillis(), repairState.stored.changedSince());
  }

  @Test
  void aPassWaitsWhileAnRdfRebuildRuns() {
    rebuildRunning = true;

    job.runPassNow(false, ScheduledRepairJob.SETTLE);

    assertWaited();
  }

  @Test
  void aPassWaitsWhileLiveWritesAreBehind() {
    oldestQueuedWrite = OptionalLong.of(NOW - Duration.ofMinutes(2).toMillis());

    job.runPassNow(false, ScheduledRepairJob.SETTLE);

    assertWaited();
  }

  @Test
  void writesQueuedMomentsAgoDoNotHoldThePassBack() throws Exception {
    oldestQueuedWrite = OptionalLong.of(NOW - Duration.ofSeconds(10).toMillis());

    job.runPassNow(false, ScheduledRepairJob.SETTLE);

    verify(projectionCheck).rebuildIfNeeded();
  }

  @Test
  void aPassWaitsWhileTheStoreDoesNotAnswer() {
    when(rdf.isStorageReachable()).thenReturn(false);

    job.runPassNow(false, ScheduledRepairJob.SETTLE);

    assertWaited();
  }

  @Test
  void aPassWaitsWhileRdfIsOff() {
    current = null;

    job.runPassNow(false, ScheduledRepairJob.SETTLE);

    assertWaited();
  }

  private void assertWaited() {
    assertEquals(LAST_PASS, repairState.stored);
    verifyNoInteractions(projectionCheck, changedEntities, orphanSweep);
  }

  /** The {@code projection_repair_state} row, kept in memory. */
  private static final class StoredRepairState implements ProjectionRepairStateDAO {
    private RepairState stored;

    @Override
    public RepairState find(final String name) {
      return stored;
    }

    @Override
    public void upsert(final String name, final long changedSince, final long sweptAt) {
      stored = new RepairState(changedSince, sweptAt);
    }
  }
}
