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
import org.openmetadata.service.sse.SseConnectionRegistry;

/**
 * Manages open Server-Sent Events connections for ingestion progress streaming.
 *
 * <p>Thin named facade over a {@link SseConnectionRegistry} sized for progress streams. The registry
 * owns the heartbeat, the active-stream cap, and the disconnect sweep.
 */
public final class ProgressSseManager {

  private static final int MAX_ACTIVE_STREAMS = 500;
  private static final long HEARTBEAT_SECONDS = 25;

  private static final ProgressSseManager INSTANCE = new ProgressSseManager();

  private final SseConnectionRegistry registry =
      new SseConnectionRegistry("progress", MAX_ACTIVE_STREAMS, HEARTBEAT_SECONDS);

  private ProgressSseManager() {}

  public static ProgressSseManager getInstance() {
    return INSTANCE;
  }

  /**
   * Registers an open SSE connection. Returns {@code false} when the active-stream cap is reached,
   * in which case the caller is responsible for closing the sink.
   */
  public boolean register(SseEventSink eventSink, Sse sse, Runnable onClose) {
    return registry.register(eventSink, sse, onClose);
  }

  public void close(SseEventSink eventSink) {
    registry.close(eventSink);
  }

  public int activeConnections() {
    return registry.activeConnections();
  }
}
