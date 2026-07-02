/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.resources.services.ingestionpipelines;

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
 * Manages open Server-Sent Events connections for ingestion progress streaming.
 *
 * <p>A single shared scheduler keeps every registered connection alive with a periodic heartbeat
 * comment and prunes connections whose client has disconnected. This keeps the SSE model
 * asynchronous: the request thread returns to the pool immediately after registration instead of
 * blocking for the lifetime of the stream, which is what previously leaked one Jetty worker thread
 * per connection.
 */
@Slf4j
public final class ProgressSseManager {

  private static final int MAX_ACTIVE_STREAMS = 500;
  private static final long HEARTBEAT_SECONDS = 25;
  private static final String HEARTBEAT_COMMENT = "heartbeat";

  private static final ProgressSseManager INSTANCE = new ProgressSseManager();

  private final Map<Long, Connection> connections = new ConcurrentHashMap<>();
  private final AtomicLong connectionIds = new AtomicLong();
  private final AtomicInteger activeCount = new AtomicInteger();
  private final ScheduledExecutorService scheduler;

  private ProgressSseManager() {
    this.scheduler = Executors.newSingleThreadScheduledExecutor(daemonThreadFactory());
    this.scheduler.scheduleWithFixedDelay(
        this::sweepQuietly, HEARTBEAT_SECONDS, HEARTBEAT_SECONDS, TimeUnit.SECONDS);
  }

  public static ProgressSseManager getInstance() {
    return INSTANCE;
  }

  /**
   * Registers an open SSE connection. Returns {@code false} when the active-stream cap is reached,
   * in which case the caller is responsible for closing the sink.
   */
  public boolean register(SseEventSink eventSink, Sse sse, Runnable onClose) {
    boolean accepted = activeCount.incrementAndGet() <= MAX_ACTIVE_STREAMS;
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

  private void sweepQuietly() {
    try {
      sweep();
    } catch (RuntimeException e) {
      LOG.warn("Progress SSE heartbeat sweep failed: {}", e.getMessage());
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
    Connection connection = connections.remove(id);
    if (connection != null) {
      activeCount.decrementAndGet();
      connection.onClose().run();
      if (!connection.eventSink().isClosed()) {
        connection.eventSink().close();
      }
    }
  }

  private static ThreadFactory daemonThreadFactory() {
    return runnable -> {
      Thread thread = new Thread(runnable, "progress-sse-heartbeat");
      thread.setDaemon(true);
      return thread;
    };
  }

  private record Connection(SseEventSink eventSink, Sse sse, Runnable onClose) {}
}
