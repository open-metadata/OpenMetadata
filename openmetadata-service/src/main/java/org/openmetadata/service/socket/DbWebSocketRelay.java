/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.socket;

import java.net.InetAddress;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.BiConsumer;
import lombok.extern.slf4j.Slf4j;

/**
 * DB-backed broadcast relay for cross-pod WebSocket delivery — the fallback when no Redis is
 * configured ({@code CACHE_PROVIDER=none}). The producing pod inserts a frame into
 * {@code ws_relay_message}; every pod runs a scheduled poll that reads rows newer than its cursor
 * (skipping its own, skipping expired) and delivers each to its local sockets via
 * {@link WebSocketManager#sendToOneLocal}.
 *
 * <p>Broadcast, not claim: a user's socket is single-homed per pod, so every pod reading the row and
 * delivering to its own sockets yields exactly-once per socket. No lease or ownership registry is
 * needed — unlike the hybrid-runner relay, which must claim because a runner is a shared singleton.
 */
@Slf4j
public class DbWebSocketRelay implements WebSocketRelay {

  static final long DEFAULT_POLL_INTERVAL_MS = 1000L;
  static final long DEFAULT_MESSAGE_TTL_MS = TimeUnit.MINUTES.toMillis(1);
  static final long DEFAULT_CLEANUP_INTERVAL_MS = TimeUnit.SECONDS.toMillis(30);
  private static final int FETCH_LIMIT = 500;
  // Each poll re-reads this many ids below the cursor (kept well under FETCH_LIMIT so new rows are
  // never starved) to catch rows that committed after a higher id the cursor already passed.
  private static final long LOOKBACK_IDS = 100;
  // Bounded seen-set that dedupes the re-read window. Must exceed LOOKBACK_IDS so a window id is
  // never evicted while still being re-scanned; eldest (lowest) ids drop first.
  private static final int DELIVERED_IDS_MAX = 2000;

  private final WsRelayDAO dao;
  private final String instanceId;
  private final long pollIntervalMs;
  private final long messageTtlMs;
  private final long cleanupIntervalMs;
  // Seam for tests: default delivers to the live WebSocketManager; a test can route to a probe.
  private final BiConsumer<UUID, WsRelayDAO.RelayRow> deliver;

  private final AtomicBoolean running = new AtomicBoolean(false);
  private final AtomicLong cursor = new AtomicLong(0);
  // Ids at or below the tail at startup predate this pod; never (re)deliver them.
  private volatile long startFloor = 0;
  // Bounded LRU of delivered ids (insertion-order eviction). Accessed only from the single
  // dispatcher thread (and directly from tests), so it needs no synchronization.
  private final Set<Long> delivered =
      Collections.newSetFromMap(
          new LinkedHashMap<>(256, 0.75f, false) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<Long, Boolean> eldest) {
              return size() > DELIVERED_IDS_MAX;
            }
          });
  private ScheduledExecutorService scheduler;

  public DbWebSocketRelay(WsRelayDAO dao) {
    this(
        dao,
        generateInstanceId(),
        DEFAULT_POLL_INTERVAL_MS,
        DEFAULT_MESSAGE_TTL_MS,
        DEFAULT_CLEANUP_INTERVAL_MS,
        DbWebSocketRelay::deliverToLocalManager);
  }

  DbWebSocketRelay(
      WsRelayDAO dao,
      String instanceId,
      long pollIntervalMs,
      long messageTtlMs,
      long cleanupIntervalMs,
      BiConsumer<UUID, WsRelayDAO.RelayRow> deliver) {
    this.dao = dao;
    this.instanceId = instanceId;
    this.pollIntervalMs = pollIntervalMs;
    this.messageTtlMs = messageTtlMs;
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.deliver = deliver;
  }

  @Override
  public void start() {
    if (!running.compareAndSet(false, true)) {
      return;
    }
    // Seed the cursor at the current tail so a starting pod does not replay history.
    long tail = 0;
    try {
      tail = dao.maxId();
    } catch (Exception e) {
      LOG.warn("DbWebSocketRelay could not seed cursor, starting from 0", e);
    }
    cursor.set(tail);
    startFloor = tail;
    delivered.clear();
    scheduler =
        Executors.newSingleThreadScheduledExecutor(
            runnable -> {
              Thread thread = new Thread(runnable, "ws-relay-db-dispatcher");
              thread.setDaemon(true);
              return thread;
            });
    scheduler.scheduleWithFixedDelay(
        this::dispatchSafely, pollIntervalMs, pollIntervalMs, TimeUnit.MILLISECONDS);
    scheduler.scheduleWithFixedDelay(
        this::cleanupSafely, cleanupIntervalMs, cleanupIntervalMs, TimeUnit.MILLISECONDS);
    LOG.info("DbWebSocketRelay started instance={} pollMs={}", instanceId, pollIntervalMs);
  }

  @Override
  public void stop() {
    if (!running.compareAndSet(true, false)) {
      return;
    }
    if (scheduler != null) {
      scheduler.shutdownNow();
      scheduler = null;
    }
    LOG.info("DbWebSocketRelay stopped instance={}", instanceId);
  }

  @Override
  public void publish(UUID userId, String event, String message) {
    if (!running.get() || userId == null) {
      return;
    }
    try {
      long expiresAt = System.currentTimeMillis() + messageTtlMs;
      dao.insert(userId.toString(), event, message, instanceId, expiresAt);
    } catch (Exception e) {
      LOG.debug("Failed to insert ws relay frame: user={} event={}", userId, event, e);
    }
  }

  // Visible for test/trigger. Reads one batch of new frames and delivers them locally.
  void dispatchOnce() {
    long now = System.currentTimeMillis();
    // Re-scan a short trailing window rather than just id > cursor: auto-increment ids are assigned
    // at INSERT but visible at COMMIT, so a row with a lower id can commit after the cursor already
    // passed a higher neighbour. The window re-reads those late committers; the seen-set drops ones
    // already delivered, and the start floor skips rows that predate this pod.
    long from = Math.max(startFloor, cursor.get() - LOOKBACK_IDS);
    List<WsRelayDAO.RelayRow> rows = dao.fetchNewer(from, instanceId, now, FETCH_LIMIT);
    for (WsRelayDAO.RelayRow row : rows) {
      if (row.id() <= startFloor || !delivered.add(row.id())) {
        continue;
      }
      try {
        deliver.accept(UUID.fromString(row.userId()), row);
      } catch (Exception e) {
        LOG.debug("Failed to deliver relayed frame id={} user={}", row.id(), row.userId(), e);
      }
      // Advance even on delivery failure: the row is a best-effort transient notification, and the
      // seen-set prevents re-delivery within the window regardless of the cursor.
      cursor.updateAndGet(current -> Math.max(current, row.id()));
    }
  }

  private void dispatchSafely() {
    try {
      dispatchOnce();
    } catch (Throwable t) {
      // ScheduledExecutorService cancels future firings if a task throws — swallow so polling
      // lives.
      LOG.warn("DbWebSocketRelay dispatch failed", t);
    }
  }

  private void cleanupSafely() {
    try {
      dao.deleteExpired(System.currentTimeMillis());
    } catch (Throwable t) {
      LOG.debug("DbWebSocketRelay cleanup failed", t);
    }
  }

  private static void deliverToLocalManager(UUID userId, WsRelayDAO.RelayRow row) {
    WebSocketManager manager = WebSocketManager.getInstance();
    if (manager != null) {
      manager.sendToOneLocal(userId, row.event(), row.payload());
    }
  }

  private static String generateInstanceId() {
    try {
      String host = InetAddress.getLocalHost().getHostName();
      long pid = ProcessHandle.current().pid();
      long started = System.currentTimeMillis();
      return host + ":" + pid + ":" + started;
    } catch (Exception e) {
      return UUID.randomUUID().toString();
    }
  }
}
