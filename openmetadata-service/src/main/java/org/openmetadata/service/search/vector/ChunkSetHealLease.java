package org.openmetadata.service.search.vector;

import java.time.Clock;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.SearchReindexLockDAO;

/**
 * The heal's lease: a row under its own key in the cluster-wide lock table the search reindex and
 * Data Insights runs take theirs in. It is renewed every {@link #HEARTBEAT} while held and expires
 * {@link #EXPIRY} after the last renewal, so a server that stops part way holds it no longer.
 */
@Slf4j
public final class ChunkSetHealLease implements ChunkSetHealRunner.Lease {
  static final String LOCK_KEY = "VECTOR_CHUNK_HEAL";
  static final Duration EXPIRY = Duration.ofMinutes(5);
  static final Duration HEARTBEAT = Duration.ofMinutes(1);

  private final Supplier<SearchReindexLockDAO> locks;
  private final Supplier<String> serverId;
  private final Clock clock;
  private volatile String runId;
  private ScheduledExecutorService heartbeat;

  ChunkSetHealLease(Supplier<SearchReindexLockDAO> locks, Supplier<String> serverId, Clock clock) {
    this.locks = locks;
    this.serverId = serverId;
    this.clock = clock;
  }

  /** The lease of this server, which resolves the lock table only when it is first taken. */
  public static ChunkSetHealLease forCluster() {
    return new ChunkSetHealLease(
        () -> Entity.getCollectionDAO().searchReindexLockDAO(),
        () -> ServerIdentityResolver.getInstance().getServerId(),
        Clock.systemUTC());
  }

  @Override
  public boolean tryAcquire() {
    String candidate = UUID.randomUUID().toString();
    long now = clock.millis();
    boolean acquired =
        locks
            .get()
            .tryAcquireLock(LOCK_KEY, candidate, serverId.get(), now, now + EXPIRY.toMillis());
    if (acquired) {
      runId = candidate;
      heartbeat = startHeartbeat();
    }
    return acquired;
  }

  @Override
  public void release() {
    heartbeat.shutdownNow();
    locks.get().releaseLock(LOCK_KEY, runId);
    runId = null;
  }

  /** A lease lost to expiry only lets another server repeat the pass, which is safe. */
  void renew() {
    long now = clock.millis();
    try {
      if (!locks.get().refreshLock(LOCK_KEY, runId, serverId.get(), now, now + EXPIRY.toMillis())) {
        LOG.debug("The chunk heal lease expired; another server may run the heal as well");
      }
    } catch (RuntimeException e) {
      LOG.debug("Could not renew the chunk heal lease: {}", e.getMessage());
    }
  }

  private ScheduledExecutorService startHeartbeat() {
    ScheduledExecutorService scheduler =
        Executors.newSingleThreadScheduledExecutor(
            Thread.ofVirtual().name("vector-chunk-heal-lease").factory());
    scheduler.scheduleAtFixedRate(
        this::renew, HEARTBEAT.toSeconds(), HEARTBEAT.toSeconds(), TimeUnit.SECONDS);
    return scheduler;
  }
}
