/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.service.monitoring;

import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseEventSink;
import java.util.function.Consumer;
import org.openmetadata.schema.entity.services.ingestionPipelines.ServiceProgressEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.resources.services.ingestionpipelines.ProgressSseManager;

/**
 * Multiplexes progress for every live run of a service onto one SSE connection. Replays the current
 * snapshot of each active run on connect, then streams subsequent updates. Unlike the per-run
 * stream, a single run's terminal event does not close the sink — the connection stays open for the
 * whole page session and is closed only on client disconnect or the {@link ProgressSseManager} cap.
 */
public final class ServiceProgressStreamer {

  private ServiceProgressStreamer() {}

  public static void stream(
      String serviceFqn, SseEventSink eventSink, Sse sse, IngestionProgressTracker tracker) {
    for (ServiceProgressEvent snapshot : tracker.getActiveRunSnapshots(serviceFqn)) {
      send(eventSink, sse, snapshot);
    }
    Consumer<ServiceProgressEvent> listener = event -> send(eventSink, sse, event);
    tracker.registerServiceListener(serviceFqn, listener);
    Runnable onClose = () -> tracker.unregisterServiceListener(serviceFqn, listener);
    if (!ProgressSseManager.getInstance().register(eventSink, sse, onClose)) {
      onClose.run();
      eventSink.close();
    }
  }

  private static void send(SseEventSink eventSink, Sse sse, ServiceProgressEvent event) {
    if (!eventSink.isClosed()) {
      eventSink.send(sse.newEvent(JsonUtils.pojoToJson(event)));
    }
  }
}
