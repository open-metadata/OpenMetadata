package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchReindexLockDAO;

/** The heal's lease is one expiring row of the cluster-wide lock table, under its own key. */
class ChunkSetHealLeaseTest {
  private static final Instant NOW = Instant.parse("2026-11-26T12:00:00Z");
  private static final long EXPIRES = NOW.toEpochMilli() + ChunkSetHealLease.EXPIRY.toMillis();

  private final SearchReindexLockDAO locks = mock(SearchReindexLockDAO.class);
  private final ChunkSetHealLease lease =
      new ChunkSetHealLease(() -> locks, () -> "server-1", Clock.fixed(NOW, ZoneOffset.UTC));

  @Test
  void theLeaseIsTakenUnderItsOwnKeyAndReleasedByTheRunThatTookIt() {
    when(locks.tryAcquireLock(
            eq("VECTOR_CHUNK_HEAL"),
            anyString(),
            eq("server-1"),
            eq(NOW.toEpochMilli()),
            eq(EXPIRES)))
        .thenReturn(true);

    assertTrue(lease.tryAcquire());
    lease.release();

    ArgumentCaptor<String> taken = ArgumentCaptor.forClass(String.class);
    verify(locks)
        .tryAcquireLock(
            eq("VECTOR_CHUNK_HEAL"), taken.capture(), eq("server-1"), anyLong(), anyLong());
    ArgumentCaptor<String> released = ArgumentCaptor.forClass(String.class);
    verify(locks).releaseLock(eq("VECTOR_CHUNK_HEAL"), released.capture());
    assertEquals(taken.getValue(), released.getValue());
  }

  @Test
  void aLeaseAnotherServerHoldsIsNotTaken() {
    when(locks.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(false);

    assertFalse(lease.tryAcquire());
  }

  @Test
  void aRenewalPushesTheExpiryOutByAWholeLease() {
    when(locks.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(true);
    assertTrue(lease.tryAcquire());

    lease.renew();
    lease.release();

    verify(locks)
        .refreshLock(
            eq("VECTOR_CHUNK_HEAL"),
            anyString(),
            eq("server-1"),
            eq(NOW.toEpochMilli()),
            eq(EXPIRES));
  }
}
