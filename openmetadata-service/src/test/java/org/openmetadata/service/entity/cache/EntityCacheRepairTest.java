package org.openmetadata.service.entity.cache;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.Entity.TABLE;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.config.CacheConfiguration;

class EntityCacheRepairTest {
  @Test
  void repairEvictsAStaleIdAndBothRenameAliasesButRetainsUnrelatedEntries() {
    final Fixture fixture = new Fixture();
    final UUID other = UUID.randomUUID();
    fixture.local.byId().put(EntityCacheKeys.id(TABLE, other), "unrelated");
    fixture.prime("previous");
    fixture.prime("current");
    fixture.repair.scheduleRepair(TABLE, fixture.id, "current", "previous");
    assertNotNull(fixture.local.byId().getIfPresent(EntityCacheKeys.id(TABLE, fixture.id)));
    fixture.tasks.removeFirst().run();
    fixture.assertMissing("current");
    fixture.assertMissing("previous");
    assertEquals("unrelated", fixture.local.byId().getIfPresent(EntityCacheKeys.id(TABLE, other)));
  }

  @Test
  void repeatedWritesCoalesceUntilRepairStartsAndThenCanScheduleAgain() {
    final Fixture fixture = new Fixture();
    for (int index = 0; index < 100; index++) {
      fixture.repair.scheduleRepair(TABLE, fixture.id, "same", null);
    }
    assertEquals(1, fixture.tasks.size());
    fixture.tasks.removeFirst().run();
    fixture.prime("same");
    fixture.repair.scheduleRepair(TABLE, fixture.id, "same", null);
    assertEquals(1, fixture.tasks.size());
    fixture.tasks.removeFirst().run();
    fixture.assertMissing("same");
  }

  @Test
  void renamesDuringTheDelayHaveIndependentRepairs() {
    final Fixture fixture = new Fixture();
    fixture.repair.scheduleRepair(TABLE, fixture.id, "first", "original");
    fixture.repair.scheduleRepair(TABLE, fixture.id, "second", "first");
    assertEquals(2, fixture.tasks.size());
    fixture.prime("first");
    fixture.prime("second");
    fixture.tasks.forEach(Runnable::run);
    fixture.assertMissing("first");
    fixture.assertMissing("second");
  }

  @Test
  void repairSupportsIdOnlyAndNameOnlyRequests() {
    final Fixture fixture = new Fixture();
    fixture.prime("name");
    fixture.repair.scheduleRepair(TABLE, null, "name", "name");
    fixture.tasks.removeFirst().run();
    assertNull(fixture.local.byName().getIfPresent(EntityCacheKeys.name(TABLE, "name")));
    assertNotNull(fixture.local.byId().getIfPresent(EntityCacheKeys.id(TABLE, fixture.id)));
    fixture.repair.scheduleRepair(TABLE, fixture.id, null, null);
    fixture.tasks.removeFirst().run();
    fixture.assertMissing("name");
  }

  @Test
  void rejectedSchedulingDoesNotPreventALaterRepair() {
    final Fixture fixture = new Fixture();
    fixture.reject = true;
    fixture.repair.scheduleRepair(TABLE, fixture.id, "name", null);
    assertTrue(fixture.tasks.isEmpty());
    fixture.reject = false;
    fixture.prime("name");
    fixture.repair.scheduleRepair(TABLE, fixture.id, "name", null);
    assertEquals(1, fixture.tasks.size());
    fixture.tasks.removeFirst().run();
    fixture.assertMissing("name");
  }

  @Test
  void stoppedSchedulersAndMissingEntityTypesDoNotAcceptRepairs() {
    final Fixture fixture = new Fixture();
    fixture.repair.scheduleRepair(null, fixture.id, "name", null);
    assertTrue(fixture.tasks.isEmpty());
    fixture.repair.start();
    assertEquals(1, fixture.executorsCreated);
    fixture.stopped = true;
    fixture.repair.scheduleRepair(TABLE, fixture.id, "name", null);
    assertTrue(fixture.tasks.isEmpty());
    fixture.repair.start();
    assertEquals(2, fixture.executorsCreated);
  }

  @Test
  void shutdownClearsPendingKeysSoRestartCanRepairTheSameEntity() {
    final Fixture fixture = new Fixture();
    fixture.repair.scheduleRepair(TABLE, fixture.id, "name", null);
    fixture.repair.shutdown();
    fixture.tasks.clear();
    fixture.stopped = true;
    fixture.repair.start();
    fixture.stopped = false;
    fixture.repair.scheduleRepair(TABLE, fixture.id, "name", null);
    assertEquals(1, fixture.tasks.size());
  }

  @Test
  void interruptedShutdownRetainsTheCallerInterruptAndStopsOutstandingWork() throws Exception {
    final Fixture fixture = new Fixture();
    when(fixture.executor.awaitTermination(2, TimeUnit.SECONDS))
        .thenThrow(new InterruptedException());
    try {
      fixture.repair.shutdown();
      assertTrue(Thread.currentThread().isInterrupted());
      assertTrue(fixture.cancelled);
    } finally {
      Thread.interrupted();
    }
  }

  @Test
  void shutdownCancelsWorkThatDoesNotTerminateWithinTheExistingDeadline() throws Exception {
    final Fixture fixture = new Fixture();
    when(fixture.executor.awaitTermination(2, TimeUnit.SECONDS)).thenReturn(false);
    fixture.repair.shutdown();
    assertTrue(fixture.cancelled);
  }

  @Test
  void productionSchedulerRepairsAndCanRestartAfterShutdown() {
    final EntityLocalCache local = local();
    final EntityCacheRepair repair = new EntityCacheRepair(local);
    final UUID id = UUID.randomUUID();
    try {
      repair.start();
      local.byId().put(EntityCacheKeys.id(TABLE, id), "stale");
      repair.scheduleRepair(TABLE, id, null, null);
      await()
          .atMost(Duration.ofSeconds(5))
          .until(() -> local.byId().getIfPresent(EntityCacheKeys.id(TABLE, id)) == null);
      repair.shutdown();
      repair.start();
      local.byId().put(EntityCacheKeys.id(TABLE, id), "another stale value");
      repair.scheduleRepair(TABLE, id, null, null);
      await()
          .atMost(Duration.ofSeconds(5))
          .until(() -> local.byId().getIfPresent(EntityCacheKeys.id(TABLE, id)) == null);
    } finally {
      repair.shutdown();
    }
    assertFalse(Thread.currentThread().isInterrupted());
  }

  private static EntityLocalCache local() {
    return new EntityLocalCache(key -> "loaded", key -> "loaded", new CacheConfiguration());
  }

  private static final class Fixture {
    private final UUID id = UUID.randomUUID();
    private final EntityLocalCache local = local();
    private final ScheduledExecutorService executor = mock(ScheduledExecutorService.class);
    private final List<Runnable> tasks = new ArrayList<>();
    private final EntityCacheRepair repair;
    private boolean reject;
    private boolean stopped;
    private boolean cancelled;
    private int executorsCreated;

    private Fixture() {
      try {
        when(executor.awaitTermination(2, TimeUnit.SECONDS)).thenReturn(true);
      } catch (InterruptedException exception) {
        throw new AssertionError(exception);
      }
      when(executor.isShutdown()).thenAnswer(invocation -> stopped);
      when(executor.shutdownNow())
          .thenAnswer(
              invocation -> {
                cancelled = true;
                return List.of();
              });
      when(executor.schedule(any(Runnable.class), eq(500L), eq(TimeUnit.MILLISECONDS)))
          .thenAnswer(
              invocation -> {
                if (reject) {
                  throw new RejectedExecutionException("Scheduler closed");
                }
                tasks.add(invocation.getArgument(0));
                return null;
              });
      repair =
          new EntityCacheRepair(
              local,
              () -> {
                executorsCreated++;
                return executor;
              });
    }

    private void prime(final String name) {
      local.byId().put(EntityCacheKeys.id(TABLE, id), "stale");
      local.byName().put(EntityCacheKeys.name(TABLE, name), "stale");
    }

    private void assertMissing(final String name) {
      assertNull(local.byId().getIfPresent(EntityCacheKeys.id(TABLE, id)));
      assertNull(local.byName().getIfPresent(EntityCacheKeys.name(TABLE, name)));
    }
  }
}
