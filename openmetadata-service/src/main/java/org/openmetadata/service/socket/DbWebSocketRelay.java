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
import java.util.List;
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

  private final WsRelayDAO dao;
  private final String instanceId;
  private final long pollIntervalMs;
  private final long messageTtlMs;
  private final long cleanupIntervalMs;
  // Seam for tests: default delivers to the live WebSocketManager; a test can route to a probe.
  private final BiConsumer<UUID, WsRelayDAO.RelayRow> deliver;

  private final AtomicBoolean running = new AtomicBoolean(false);
  private final AtomicLong cursor = new AtomicLong(0);
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
    try {
      cursor.set(dao.maxId());
    } catch (Exception e) {
      LOG.warn("DbWebSocketRelay could not seed cursor, starting from 0", e);
    }
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
    List<WsRelayDAO.RelayRow> rows = dao.fetchNewer(cursor.get(), instanceId, now, FETCH_LIMIT);
    if (rows.isEmpty()) {
      return;
    }
    for (WsRelayDAO.RelayRow row : rows) {
      try {
        deliver.accept(UUID.fromString(row.userId()), row);
      } catch (Exception e) {
        LOG.debug("Failed to deliver relayed frame id={} user={}", row.id(), row.userId(), e);
      }
      // Advance even on delivery failure: the row is a best-effort transient notification, and a
      // stuck cursor would re-deliver every later frame to this pod on every poll.
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
