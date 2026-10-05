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
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;

/**
 * DB-backed relay used when no Redis is configured. The producing pod enqueues a frame and a writer
 * thread drains the queue into {@code ws_relay_message} in batched inserts, so callers never block on
 * the DB; every pod polls a trailing time window for new rows (skipping its own) and delivers to its
 * local sockets. Broadcast, not claim — a socket is single-homed, so each pod delivering to its own
 * sockets is exactly-once; no lease needed. Keying the poll on time rather than an auto-increment id
 * means a frame that becomes visible out of insert order (e.g. a batch committing at once) is still
 * inside the window; a bounded dedupe set stops re-delivery across polls.
 */
@Slf4j
public class DbWebSocketRelay implements WebSocketRelay {

  static final long DEFAULT_POLL_INTERVAL_MS = 1000L;
  static final long DEFAULT_MESSAGE_TTL_MS = TimeUnit.MINUTES.toMillis(1);
  static final long DEFAULT_CLEANUP_INTERVAL_MS = TimeUnit.SECONDS.toMillis(30);
  // How often the writer thread drains queued frames; well under the poll interval so producer-side
  // batching adds no visible latency on top of the consumer's 1s poll.
  static final long DEFAULT_FLUSH_INTERVAL_MS = 100L;
  // Each poll re-reads frames from the last this-many ms. Must exceed the longest gap between a
  // consumer's successful polls — commit latency plus any dispatch stall such as a GC pause — so a
  // frame created during a stall is still re-read on the next poll; kept well under the message
  // TTL.
  static final long DEFAULT_RESCAN_WINDOW_MS = 15_000L;
  // Max rows delivered per poll and max frames per batched insert; the drain loops until the queue
  // empties. Not tied to correctness — purely memory/round-trip tuning.
  private static final int FETCH_LIMIT = 1000;
  private static final int MAX_BATCH = 1000;
  // Offers are dropped once the queue is full; frames are transient, so shedding is acceptable.
  private static final int QUEUE_CAPACITY = 10_000;
  // Dedupe set over the rescan window; sized well above its row count so a window id is not evicted
  // before it ages out (eldest ids drop first). An overflow re-delivers a frame, never drops one.
  private static final int DELIVERED_IDS_MAX = 4096;

  private final WsRelayDAO dao;
  private final String instanceId;
  private final long pollIntervalMs;
  private final long messageTtlMs;
  private final long cleanupIntervalMs;
  private final long flushIntervalMs;
  private final long rescanWindowMs;
  // Seam for tests: default delivers to the live WebSocketManager; a test can route to a probe.
  private final Consumer<WsRelayDAO.RelayRow> deliver;

  // Frames published by callers, drained off-thread by the writer into batched inserts.
  private final BlockingQueue<WsRelayDAO.Frame> pending = new ArrayBlockingQueue<>(QUEUE_CAPACITY);

  private final AtomicBoolean running = new AtomicBoolean(false);
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
  // Reads (poll + cleanup) and writes (drain) run on separate single threads so a slow insert never
  // delays delivery and vice versa.
  private ScheduledExecutorService scheduler;
  private ScheduledExecutorService writer;

  public DbWebSocketRelay(WsRelayDAO dao) {
    this(
        dao,
        generateInstanceId(),
        DEFAULT_POLL_INTERVAL_MS,
        DEFAULT_MESSAGE_TTL_MS,
        DEFAULT_CLEANUP_INTERVAL_MS,
        DEFAULT_FLUSH_INTERVAL_MS,
        DEFAULT_RESCAN_WINDOW_MS,
        DbWebSocketRelay::deliverToLocalManager);
  }

  DbWebSocketRelay(
      WsRelayDAO dao,
      String instanceId,
      long pollIntervalMs,
      long messageTtlMs,
      long cleanupIntervalMs,
      long flushIntervalMs,
      long rescanWindowMs,
      Consumer<WsRelayDAO.RelayRow> deliver) {
    this.dao = dao;
    this.instanceId = instanceId;
    this.pollIntervalMs = pollIntervalMs;
    this.messageTtlMs = messageTtlMs;
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.flushIntervalMs = flushIntervalMs;
    this.rescanWindowMs = rescanWindowMs;
    this.deliver = deliver;
  }

  @Override
  public void start() {
    if (!running.compareAndSet(false, true)) {
      return;
    }
    delivered.clear();
    // Seed the dedupe set with frames already in the window so a starting pod does not replay them.
    try {
      for (WsRelayDAO.RelayRow row :
          dao.fetchRecent(instanceId, recentFloor(System.currentTimeMillis()), FETCH_LIMIT)) {
        delivered.add(row.id());
      }
    } catch (Exception e) {
      LOG.warn("DbWebSocketRelay could not seed dedupe set", e);
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
    writer =
        Executors.newSingleThreadScheduledExecutor(
            runnable -> {
              Thread thread = new Thread(runnable, "ws-relay-db-writer");
              thread.setDaemon(true);
              return thread;
            });
    writer.scheduleWithFixedDelay(
        this::flushSafely, flushIntervalMs, flushIntervalMs, TimeUnit.MILLISECONDS);
    LOG.info("DbWebSocketRelay started instance={} pollMs={}", instanceId, pollIntervalMs);
  }

  @Override
  public void stop() {
    if (!running.compareAndSet(true, false)) {
      return;
    }
    if (writer != null) {
      writer.shutdownNow();
      writer = null;
    }
    flushQueue(); // best-effort drain of frames queued before shutdown
    if (scheduler != null) {
      scheduler.shutdownNow();
      scheduler = null;
    }
    LOG.info("DbWebSocketRelay stopped instance={}", instanceId);
  }

  @Override
  public void publish(String scope, String target, String event, String message) {
    if (!running.get() || scope == null) {
      return;
    }
    // Enqueue off the caller's thread; the writer drains in batches. Never block the caller on the
    // DB — local delivery already happened, and frames are transient so a full queue just sheds.
    long expiresAt = System.currentTimeMillis() + messageTtlMs;
    WsRelayDAO.Frame frame =
        new WsRelayDAO.Frame(scope, target, event, message, instanceId, expiresAt);
    if (!pending.offer(frame)) {
      LOG.debug("ws relay queue full, dropping frame scope={} event={}", scope, event);
    }
  }

  // Visible for test/trigger. Drains all queued frames into batched inserts.
  void flushQueue() {
    List<WsRelayDAO.Frame> batch = new ArrayList<>(MAX_BATCH);
    while (pending.drainTo(batch, MAX_BATCH) > 0) {
      try {
        dao.insertBatch(batch);
      } catch (Exception e) {
        LOG.debug("Failed to insert {} ws relay frame(s)", batch.size(), e);
      }
      batch.clear();
    }
  }

  private void flushSafely() {
    try {
      flushQueue();
    } catch (Throwable t) {
      // Keep the writer alive: a throwing task cancels future firings on the executor.
      LOG.warn("DbWebSocketRelay flush failed", t);
    }
  }

  // Visible for test/trigger. Delivers peer frames in the rescan window not yet seen.
  void dispatchOnce() {
    long now = System.currentTimeMillis();
    List<WsRelayDAO.RelayRow> rows = dao.fetchRecent(instanceId, recentFloor(now), FETCH_LIMIT);
    for (WsRelayDAO.RelayRow row : rows) {
      if (!delivered.add(row.id())) {
        continue;
      }
      try {
        deliver.accept(row);
      } catch (Exception e) {
        LOG.debug("Failed to deliver relayed frame id={} scope={}", row.id(), row.scope(), e);
      }
    }
  }

  // Frames live until createdAt + messageTtlMs, so "created within the rescan window" is
  // "expiresAt > now + messageTtlMs - rescanWindow" — a predicate the expiresAt index serves.
  private long recentFloor(long now) {
    return now + messageTtlMs - rescanWindowMs;
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

  private static void deliverToLocalManager(WsRelayDAO.RelayRow row) {
    WebSocketManager manager = WebSocketManager.getInstance();
    if (manager != null) {
      manager.deliverRelayedFrame(row.scope(), row.target(), row.event(), row.payload());
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
