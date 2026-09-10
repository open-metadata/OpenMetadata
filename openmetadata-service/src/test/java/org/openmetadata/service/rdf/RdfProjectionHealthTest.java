package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;

@Isolated
class RdfProjectionHealthTest {
  private final AtomicBoolean unavailable = new AtomicBoolean(true);
  private final AtomicLong failures = new AtomicLong();
  private final AtomicLong repaired = new AtomicLong();
  private final RdfLiveWriteStore store = mock(RdfLiveWriteStore.class);

  @BeforeEach
  void prepareStore() {
    resetLocalHealth();
    doAnswer(
            invocation -> {
              if (unavailable.get()) {
                throw new IllegalStateException("Health writes are temporarily unavailable");
              }
              failures.incrementAndGet();
              return null;
            })
        .when(store)
        .markDegraded(anyString());
    when(store.isDegraded()).thenAnswer(invocation -> failures.get() > repaired.get());
    when(store.failureVersion()).thenAnswer(invocation -> failures.get());
    doAnswer(
            invocation -> {
              repaired.accumulateAndGet(invocation.getArgument(0), Math::max);
              return null;
            })
        .when(store)
        .markRebuilt(anyLong());
  }

  @AfterEach
  void resetLocalHealth() {
    RdfProjectionHealth.initialize(null);
    RdfProjectionHealth.markReady();
  }

  @Test
  void initializationKeepsUnpersistedFailuresUntilSqlRecovers() {
    RdfProjectionHealth.markDegraded();
    assertDoesNotThrow(() -> RdfProjectionHealth.initialize(store));
    assertTrue(RdfProjectionHealth.isDegraded());
    unavailable.set(false);
    RdfProjectionHealth.flushLocalFailures();
    assertTrue(store.isDegraded());
    RdfProjectionHealth.markReady(RdfProjectionHealth.failureVersion());
    assertFalse(RdfProjectionHealth.isDegraded());
  }

  @Test
  void sharedHealthReadFailureDoesNotReportReady() {
    RdfProjectionHealth.initialize(store);
    when(store.isDegraded()).thenThrow(new IllegalStateException("SQL health read unavailable"));
    assertTrue(RdfProjectionHealth.isDegraded());
  }

  @Test
  void rebuildingCannotAcknowledgeAFailureThatHasNotBeenPersisted() {
    RdfProjectionHealth.initialize(store);
    RdfProjectionHealth.markDegraded();
    final long initialVersion = assertDoesNotThrow(RdfProjectionHealth::failureVersion);
    assertDoesNotThrow(() -> RdfProjectionHealth.markReady(initialVersion));
    assertTrue(RdfProjectionHealth.isDegraded());
    unavailable.set(false);
    RdfProjectionHealth.flushLocalFailures();
    assertTrue(store.isDegraded());
    RdfProjectionHealth.markReady(initialVersion);
    assertTrue(RdfProjectionHealth.isDegraded());
    RdfProjectionHealth.markReady(RdfProjectionHealth.failureVersion());
    assertFalse(RdfProjectionHealth.isDegraded());
  }
}
