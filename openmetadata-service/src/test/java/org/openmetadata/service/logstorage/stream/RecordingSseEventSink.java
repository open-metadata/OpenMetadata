/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.logstorage.stream;

import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.SseEventSink;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.services.ingestionPipelines.LogStreamEvent;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * A Server-Sent Events sink that keeps what was written to it, standing in for the servlet
 * container. Sends can be left permanently pending to reproduce a client that stopped reading.
 */
final class RecordingSseEventSink implements SseEventSink {

  private final List<String> payloads = new CopyOnWriteArrayList<>();
  private final boolean acknowledgeSends;
  private volatile boolean closed;

  RecordingSseEventSink() {
    this(true);
  }

  RecordingSseEventSink(boolean acknowledgeSends) {
    this.acknowledgeSends = acknowledgeSends;
  }

  @Override
  public boolean isClosed() {
    return closed;
  }

  @Override
  public CompletionStage<?> send(OutboundSseEvent event) {
    payloads.add(String.valueOf(event.getData()));
    return acknowledgeSends ? CompletableFuture.completedFuture(null) : new CompletableFuture<>();
  }

  @Override
  public void close() {
    closed = true;
  }

  List<String> payloads() {
    return List.copyOf(payloads);
  }

  List<LogStreamEvent> events() {
    return payloads.stream()
        .map(payload -> JsonUtils.readValue(payload, LogStreamEvent.class))
        .collect(Collectors.toList());
  }

  /** Every log line delivered so far, in order, ignoring non-log events. */
  String logs() {
    return events().stream()
        .map(LogStreamEvent::getLogs)
        .filter(logs -> logs != null && !logs.isEmpty())
        .collect(Collectors.joining("\n"));
  }
}
