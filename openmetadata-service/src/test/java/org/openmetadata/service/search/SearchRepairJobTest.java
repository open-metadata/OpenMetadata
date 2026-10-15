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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.ProjectionRepairStateDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.ProjectionRepairStateDAO.RepairState;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchReindexLockDAO;
import org.openmetadata.service.search.SearchRepairJob.Steps;

class SearchRepairJobTest {
  private static final long NOW = 1_800_000_000_000L;
  private static final long LAST_PASS_UNTIL = NOW - Duration.ofMinutes(15).toMillis();

  private final CollectionDAO collectionDAO = mock(CollectionDAO.class);
  private final SearchReindexLockDAO locks = mock(SearchReindexLockDAO.class);
  private final StoredRepairState repairState = new StoredRepairState();
  private final SearchRepository searchRepository = mock(SearchRepository.class);
  private final SearchClient searchClient = mock(SearchClient.class);
  private final SearchIndexCheck indexCheck = mock(SearchIndexCheck.class);
  private final ChangedDocumentsRepair changedDocuments = mock(ChangedDocumentsRepair.class);
  private SearchRepairJob job;

  @BeforeEach
  void wireBoundaries() {
    when(collectionDAO.searchReindexLockDAO()).thenReturn(locks);
    when(collectionDAO.projectionRepairStateDAO()).thenReturn(repairState);
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchClient.isClientAvailable()).thenReturn(true);
    when(locks.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(true);
    job =
        new SearchRepairJob(
            collectionDAO, searchRepository, new Steps(indexCheck, changedDocuments), () -> NOW);
  }

  @Test
  void aPassRechecksTheLastWindowsOverlapAndStopsShortOfTheSettleTime() throws Exception {
    repairState.stored = new RepairState(LAST_PASS_UNTIL, NOW);
    final List<long[]> windows = recordWindows();

    assertTrue(job.runPassNow(false, SearchRepairJob.SETTLE));

    final long until = NOW - SearchRepairJob.SETTLE.toMillis();
    assertEquals(1, windows.size());
    assertEquals(LAST_PASS_UNTIL - SearchRepairJob.OVERLAP.toMillis(), windows.getFirst()[0]);
    assertEquals(until, windows.getFirst()[1]);
    assertEquals(new RepairState(until, NOW), repairState.stored);
  }

  @Test
  void theFirstPassLooksBackFromNow() throws Exception {
    final List<long[]> windows = recordWindows();

    job.runPassNow(false, Duration.ZERO);

    final long since =
        NOW - SearchRepairJob.FIRST_LOOKBACK.toMillis() - SearchRepairJob.OVERLAP.toMillis();
    assertEquals(since, windows.getFirst()[0]);
    assertEquals(new RepairState(NOW, NOW), repairState.stored);
  }

  @Test
  void aFailedPassLeavesItsWindowForTheNextPass() throws Exception {
    final RepairState before = new RepairState(LAST_PASS_UNTIL, NOW);
    repairState.stored = before;
    when(changedDocuments.repair(anyLong(), anyLong(), any()))
        .thenThrow(new IOException("search is overloaded"));

    assertTrue(job.runPassNow(false, SearchRepairJob.SETTLE));

    assertEquals(before, repairState.stored);
    verify(locks).releaseLock(anyString(), anyString());
  }

  @Test
  void anIndexCheckThatFailsDoesNotHoldBackTheRepair() throws Exception {
    repairState.stored = new RepairState(LAST_PASS_UNTIL, NOW);
    doThrow(new IOException("aliases unreadable")).when(indexCheck).repairUnusableIndexes();

    job.runPassNow(false, SearchRepairJob.SETTLE);

    assertEquals(NOW - SearchRepairJob.SETTLE.toMillis(), repairState.stored.changedSince());
  }

  @Test
  void aPassAnotherServerHoldsIsNotRun() {
    when(locks.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(false);

    assertFalse(job.runPassNow(false, SearchRepairJob.SETTLE));

    assertNull(repairState.stored);
    verifyNoInteractions(indexCheck, changedDocuments);
  }

  @Test
  void unavailableSearchLeavesTheWindowUntouched() {
    final RepairState before = new RepairState(LAST_PASS_UNTIL, NOW);
    repairState.stored = before;
    when(searchClient.isClientAvailable()).thenReturn(false);

    job.runPassNow(false, SearchRepairJob.SETTLE);

    assertEquals(before, repairState.stored);
    verifyNoInteractions(indexCheck, changedDocuments);
  }

  @Test
  void theSweepRunsOnceADayAndRecordsWhenItRan() {
    final long yesterday = NOW - SearchRepairJob.SWEEP_INTERVAL.toMillis();
    repairState.stored = new RepairState(LAST_PASS_UNTIL, yesterday);
    when(changedDocuments.repairableTypes()).thenReturn(List.of());

    job.runPassNow(false, SearchRepairJob.SETTLE);

    assertEquals(NOW, repairState.stored.sweptAt());
  }

  @Test
  void aSweepThatRanTodayIsNotRepeated() {
    final long anHourAgo = NOW - Duration.ofHours(1).toMillis();
    repairState.stored = new RepairState(LAST_PASS_UNTIL, anHourAgo);

    job.runPassNow(false, SearchRepairJob.SETTLE);

    assertEquals(anHourAgo, repairState.stored.sweptAt());
  }

  private List<long[]> recordWindows() throws Exception {
    final List<long[]> windows = new ArrayList<>();
    when(changedDocuments.repair(anyLong(), anyLong(), any()))
        .thenAnswer(
            invocation -> {
              windows.add(new long[] {invocation.getArgument(0), invocation.getArgument(1)});
              return 0;
            });
    return windows;
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
