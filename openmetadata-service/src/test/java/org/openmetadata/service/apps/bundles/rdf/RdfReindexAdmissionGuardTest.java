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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexJobDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexJobDAO.SearchIndexJobRecord;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchReindexLockDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchReindexLockDAO.SearchReindexLockRecord;

@DisplayName("RdfReindexAdmissionGuard")
class RdfReindexAdmissionGuardTest {

  private static final long START_MS = 1_000_000_000L;
  private static final long POLL_MS = 60_000L;
  private static final long DEFERRAL_MS = 180_000L;

  private CollectionDAO collectionDAO;
  private SearchReindexLockDAO lockDAO;
  private SearchIndexJobDAO jobDAO;
  private final AtomicLong clock = new AtomicLong(START_MS);
  private final AtomicInteger waits = new AtomicInteger();
  private Supplier<Optional<AppRunRecord>> latestRun = Optional::empty;

  @BeforeEach
  void setUp() {
    collectionDAO = mock(CollectionDAO.class);
    lockDAO = mock(SearchReindexLockDAO.class);
    jobDAO = mock(SearchIndexJobDAO.class);
    when(collectionDAO.searchReindexLockDAO()).thenReturn(lockDAO);
    when(collectionDAO.searchIndexJobDAO()).thenReturn(jobDAO);
    when(lockDAO.findByKey(anyString())).thenReturn(null);
    when(jobDAO.findByStatuses(any())).thenReturn(List.of());
    clock.set(START_MS);
    waits.set(0);
  }

  @AfterEach
  void clearInterruptFlag() {
    Thread.interrupted();
  }

  private RdfReindexAdmissionGuard guard() {
    return new RdfReindexAdmissionGuard(
        collectionDAO,
        () -> latestRun.get(),
        clock::get,
        millis -> {
          waits.incrementAndGet();
          clock.addAndGet(millis);
        },
        POLL_MS,
        DEFERRAL_MS);
  }

  private SearchReindexLockRecord lockExpiringAt(long expiresAt) {
    return new SearchReindexLockRecord(
        "SEARCH_REINDEX_LOCK", "job-1", "server-1", START_MS - 1000, START_MS, expiresAt);
  }

  private SearchIndexJobRecord jobWithHeartbeat(String status, long updatedAt) {
    return new SearchIndexJobRecord(
        "job-abc",
        status,
        null,
        null,
        null,
        0,
        0,
        0,
        0,
        null,
        null,
        START_MS - 5000,
        null,
        null,
        updatedAt,
        null,
        null,
        null);
  }

  private AppRunRecord runWith(AppRunRecord.Status status, long timestamp) {
    return new AppRunRecord().withStatus(status).withTimestamp(timestamp);
  }

  @Test
  @DisplayName("admits immediately when no search activity signals exist")
  void admitsImmediatelyWhenIdle() {
    RdfReindexAdmissionGuard.AdmissionResult result = guard().awaitAdmission();

    assertTrue(result.admitted());
    assertEquals(0, waits.get());
    assertEquals(0, result.waitedMs());
  }

  @Test
  @DisplayName("unexpired lock defers; admission follows once the lock clears")
  void unexpiredLockDefersUntilCleared() {
    when(lockDAO.findByKey(anyString()))
        .thenReturn(lockExpiringAt(START_MS + 3_600_000L))
        .thenReturn(lockExpiringAt(START_MS + 3_600_000L))
        .thenReturn(null);

    RdfReindexAdmissionGuard.AdmissionResult result = guard().awaitAdmission();

    assertTrue(result.admitted());
    assertEquals(2, waits.get());
    assertEquals(2 * POLL_MS, result.waitedMs());
  }

  @Test
  @DisplayName("expired lock rows are ignored")
  void expiredLockIsIgnored() {
    when(lockDAO.findByKey(anyString())).thenReturn(lockExpiringAt(START_MS - 1));

    assertTrue(guard().currentContention().isEmpty());
  }

  @Test
  @DisplayName("active job with fresh heartbeat blocks; stale heartbeat does not")
  void jobFreshnessGovernsContention() {
    when(jobDAO.findByStatuses(any()))
        .thenReturn(List.of(jobWithHeartbeat("RUNNING", START_MS - 30_000)));
    assertTrue(guard().currentContention().isPresent());

    when(jobDAO.findByStatuses(any()))
        .thenReturn(
            List.of(
                jobWithHeartbeat(
                    "RUNNING", START_MS - RdfReindexAdmissionGuard.ACTIVITY_FRESHNESS_MS - 1)));
    assertTrue(guard().currentContention().isEmpty());
  }

  @Test
  @DisplayName("live app run with fresh timestamp blocks; terminal or stale runs do not")
  void appRunFreshnessGovernsContention() {
    latestRun = () -> Optional.of(runWith(AppRunRecord.Status.RUNNING, START_MS - 30_000));
    assertTrue(guard().currentContention().isPresent());

    latestRun = () -> Optional.of(runWith(AppRunRecord.Status.COMPLETED, START_MS - 30_000));
    assertTrue(guard().currentContention().isEmpty());

    latestRun =
        () ->
            Optional.of(
                runWith(
                    AppRunRecord.Status.RUNNING,
                    START_MS - RdfReindexAdmissionGuard.ACTIVITY_FRESHNESS_MS - 1));
    assertTrue(guard().currentContention().isEmpty());
  }

  @Test
  @DisplayName("never-clearing contention exhausts the deferral window")
  void defersToTimeoutWhenContentionPersists() {
    when(lockDAO.findByKey(anyString())).thenReturn(lockExpiringAt(Long.MAX_VALUE));

    RdfReindexAdmissionGuard.AdmissionResult result = guard().awaitAdmission();

    assertFalse(result.admitted());
    assertEquals(DEFERRAL_MS / POLL_MS, waits.get());
    assertTrue(result.waitedMs() >= DEFERRAL_MS);
    assertTrue(result.contention().contains("job-1"));
  }

  @Test
  @DisplayName("interrupt during deferral stops polling instead of spinning")
  void interruptStopsDeferralLoop() {
    when(lockDAO.findByKey(anyString())).thenReturn(lockExpiringAt(Long.MAX_VALUE));
    RdfReindexAdmissionGuard interruptingGuard =
        new RdfReindexAdmissionGuard(
            collectionDAO,
            () -> latestRun.get(),
            clock::get,
            millis -> {
              waits.incrementAndGet();
              clock.addAndGet(millis);
              Thread.currentThread().interrupt();
            },
            POLL_MS,
            DEFERRAL_MS);

    RdfReindexAdmissionGuard.AdmissionResult result = interruptingGuard.awaitAdmission();

    assertFalse(result.admitted());
    assertEquals(1, waits.get());
  }
}
