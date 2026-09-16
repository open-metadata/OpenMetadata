package org.openmetadata.service.apps.bundles.rdf.distributed;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfIndexPartitionDAO;

class RdfPartitionHeartbeatTest {
  private static final Duration INTERVAL = Duration.ofMillis(20);
  private static final Duration TIMEOUT = Duration.ofSeconds(5);

  @Test
  void renewsTheOriginalClaimAndStopsAfterClose() throws Exception {
    final var partitions = mock(RdfIndexPartitionDAO.class);
    final var claim = claim();
    final var renewals = new ArrayBlockingQueue<Long>(32);
    final var calls = new AtomicInteger();
    when(partitions.updateHeartbeat(anyString(), anyLong(), anyString(), anyLong()))
        .thenAnswer(
            invocation -> {
              assertEquals(claim.getId().toString(), invocation.getArgument(0));
              assertEquals(claim.getAssignedServer(), invocation.getArgument(2));
              assertEquals(claim.getClaimedAt(), invocation.<Long>getArgument(3));
              calls.incrementAndGet();
              renewals.offer(invocation.getArgument(1));
              return 1;
            });

    try (var heartbeat = new RdfPartitionHeartbeat(partitions, () -> List.of(claim), INTERVAL)) {
      final Long first = renewals.poll(5, TimeUnit.SECONDS);
      final Long second = renewals.poll(5, TimeUnit.SECONDS);
      assertTrue(first != null && second != null && second > first);
    }
    final int stoppedAt = calls.get();
    await()
        .during(Duration.ofMillis(80))
        .atMost(TIMEOUT)
        .untilAsserted(() -> assertEquals(stoppedAt, calls.get()));
  }

  @Test
  void aFailedRenewalDoesNotStarveOtherClaimsOrSubsequentTicks() {
    final var partitions = mock(RdfIndexPartitionDAO.class);
    final var failing = claim();
    final var healthy = claim();
    final var active = new AtomicReference<>(List.of(failing, healthy));
    final var failures = new AtomicInteger();
    final var renewals = new AtomicInteger();
    when(partitions.updateHeartbeat(anyString(), anyLong(), anyString(), anyLong()))
        .thenAnswer(
            invocation -> {
              if (failing.getId().toString().equals(invocation.getArgument(0))) {
                failures.incrementAndGet();
                throw new IllegalStateException("Database temporarily unavailable for this claim");
              }
              renewals.incrementAndGet();
              return 1;
            });
    try (var heartbeat = new RdfPartitionHeartbeat(partitions, active::get, INTERVAL)) {
      await().atMost(TIMEOUT).until(() -> failures.get() >= 2 && renewals.get() >= 2);
      active.set(List.of());
      final int observed = renewals.get();
      await()
          .during(Duration.ofMillis(80))
          .atMost(TIMEOUT)
          .until(() -> renewals.get() <= observed + 1);
    }
  }

  @Test
  void rejectsAnIntervalThatWouldContinuouslyRenew() {
    assertThrows(
        IllegalArgumentException.class,
        () -> new RdfPartitionHeartbeat(mock(RdfIndexPartitionDAO.class), List::of, Duration.ZERO));
  }

  private static RdfIndexPartition claim() {
    return RdfIndexPartition.builder()
        .id(UUID.randomUUID())
        .assignedServer("heartbeat-test-server")
        .claimedAt(System.currentTimeMillis() - 1000)
        .build();
  }
}
