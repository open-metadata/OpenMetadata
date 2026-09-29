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
package org.openmetadata.service.sse;

import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseEventSink;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;

/**
 * Holds the open Server-Sent Events connections of one feature and keeps them alive.
 *
 * <p>A single shared scheduler per registry sends a periodic heartbeat comment on every registered
 * connection and prunes the ones whose client has disconnected. That keeps the SSE model
 * asynchronous: the request thread returns to the pool right after registration instead of blocking
 * for the lifetime of the stream, which is what leaks one Jetty worker thread per connection.
 *
 * <p>The number of live connections is capped so a burst of clients cannot exhaust memory or the
 * container's connection budget.
 */
@Slf4j
public final class SseConnectionRegistry {

  private static final String HEARTBEAT_COMMENT = "heartbeat";

  private final String name;
  private final int maxActiveStreams;
  private final ScheduledExecutorService scheduler;
  private final Map<Long, Connection> connections = new ConcurrentHashMap<>();
  private final AtomicLong connectionIds = new AtomicLong();
  private final AtomicInteger activeCount = new AtomicInteger();

  public SseConnectionRegistry(String name, int maxActiveStreams, long heartbeatSeconds) {
    this.name = name;
    this.maxActiveStreams = maxActiveStreams;
    this.scheduler = Executors.newSingleThreadScheduledExecutor(daemonThreadFactory(name));
    scheduler.scheduleWithFixedDelay(
        this::sweepQuietly, heartbeatSeconds, heartbeatSeconds, TimeUnit.SECONDS);
  }

  /**
   * Registers an open SSE connection. Returns {@code false} when the active-stream cap is reached,
   * in which case the caller is responsible for closing the sink.
   */
  public boolean register(SseEventSink eventSink, Sse sse, Runnable onClose) {
    final boolean accepted = activeCount.incrementAndGet() <= maxActiveStreams;
    if (accepted) {
      connections.put(connectionIds.incrementAndGet(), new Connection(eventSink, sse, onClose));
    } else {
      activeCount.decrementAndGet();
    }
    return accepted;
  }

  public void close(SseEventSink eventSink) {
    connections.forEach(
        (id, connection) -> {
          if (connection.eventSink() == eventSink) {
            cleanup(id);
          }
        });
  }

  public int activeConnections() {
    return connections.size();
  }

  /** Stops the heartbeat and closes every connection this registry is holding open. */
  public void shutdown() {
    scheduler.shutdownNow();
    connections.keySet().forEach(this::cleanup);
  }

  private void sweepQuietly() {
    try {
      sweep();
    } catch (RuntimeException e) {
      LOG.warn("{} SSE heartbeat sweep failed: {}", name, e.getMessage());
    }
  }

  private void sweep() {
    connections.forEach(
        (id, connection) -> {
          if (connection.eventSink().isClosed()) {
            cleanup(id);
          } else {
            heartbeat(id, connection);
          }
        });
  }

  private void heartbeat(long id, Connection connection) {
    try {
      connection
          .eventSink()
          .send(connection.sse().newEventBuilder().comment(HEARTBEAT_COMMENT).build())
          .whenComplete(
              (result, error) -> {
                if (error != null) {
                  cleanup(id);
                }
              });
    } catch (RuntimeException e) {
      cleanup(id);
    }
  }

  private void cleanup(long id) {
    final Connection connection = connections.remove(id);
    if (connection != null) {
      activeCount.decrementAndGet();
      connection.onClose().run();
      if (!connection.eventSink().isClosed()) {
        connection.eventSink().close();
      }
    }
  }

  private static ThreadFactory daemonThreadFactory(String name) {
    return runnable -> {
      final Thread thread = new Thread(runnable, name + "-sse-heartbeat");
      thread.setDaemon(true);
      return thread;
    };
  }

  private record Connection(SseEventSink eventSink, Sse sse, Runnable onClose) {}
}
