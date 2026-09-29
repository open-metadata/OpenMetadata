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
import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseEventSink;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.LogStreamEvent;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * One viewer attached to a run's log stream.
 *
 * <p>Writes are fire and forget: {@link SseEventSink#send} hands the event to the container and
 * completes asynchronously. Bytes handed over but not yet flushed to the socket are counted, and a
 * viewer whose backlog crosses the configured ceiling is dropped rather than allowed to pin
 * unbounded memory — a browser that stops reading must not be able to hold a whole run's log in the
 * server's heap.
 */
@Slf4j
public final class LogStreamSubscriber {

  private final SseEventSink sink;
  private final Sse sse;
  private final long maxPendingBytes;
  private final AtomicLong pendingBytes = new AtomicLong();

  public LogStreamSubscriber(SseEventSink sink, Sse sse, long maxPendingBytes) {
    this.sink = sink;
    this.sse = sse;
    this.maxPendingBytes = maxPendingBytes;
  }

  /**
   * Delivers one event. Returns {@code false} when this viewer is gone and must be detached.
   *
   * <p>Never throws: one broken connection must cost its own viewer only, not the shared reader
   * that is fanning the event out to everyone else watching the same run.
   */
  public boolean send(LogStreamEvent event) {
    boolean delivered = false;
    if (sink.isClosed()) {
      LOG.debug("Dropping log stream event for run {}: client disconnected", event.getRunId());
    } else if (pendingBytes.get() > maxPendingBytes) {
      LOG.warn(
          "Dropping log stream viewer for run {}: {} bytes queued exceed the {} byte ceiling",
          event.getRunId(),
          pendingBytes.get(),
          maxPendingBytes);
    } else {
      delivered = render(event);
    }
    return delivered;
  }

  /** Closes this viewer's connection. Never throws, for the same reason {@link #send} does not. */
  public void close() {
    try {
      if (!sink.isClosed()) {
        sink.close();
      }
    } catch (RuntimeException e) {
      LOG.debug("Closing an already broken log stream connection: {}", e.getMessage());
    }
  }

  /**
   * Puts one event on the wire as a single JSON frame. The whole event goes in one frame rather
   * than a frame per log line so that the cursor and the content it belongs to cannot be separated
   * by a dropped connection.
   */
  private boolean render(LogStreamEvent event) {
    boolean delivered = false;
    try {
      emit(sse.newEvent(JsonUtils.pojoToJson(event)));
      delivered = true;
    } catch (RuntimeException e) {
      LOG.debug("Dropping log stream viewer for run {}: {}", event.getRunId(), e.toString());
    }
    return delivered;
  }

  private void emit(OutboundSseEvent event) {
    final long size = size(event);
    pendingBytes.addAndGet(size);
    sink.send(event).whenComplete((result, error) -> pendingBytes.addAndGet(-size));
  }

  private static long size(OutboundSseEvent event) {
    final Object data = event.getData();
    return data instanceof String text ? utf8Length(text) : 0L;
  }

  /**
   * What the event will weigh once encoded, counted rather than measured: the frame goes to the
   * socket as UTF-8, so charging the ceiling by {@code String.length()} would under-count every
   * non-ASCII log line and let a stalled client pin more heap than configured. Counting beats
   * {@code getBytes(UTF_8).length} here because that allocates a second copy of every frame purely
   * to learn its size.
   */
  private static long utf8Length(String text) {
    long bytes = 0;
    for (int index = 0; index < text.length(); index++) {
      final char character = text.charAt(index);
      if (character < 0x80) {
        bytes += 1;
      } else if (character < 0x800) {
        bytes += 2;
      } else if (isSurrogatePairAt(text, index)) {
        // One code point across two chars encodes to four bytes; skip the low half.
        bytes += 4;
        index++;
      } else {
        bytes += 3;
      }
    }
    return bytes;
  }

  private static boolean isSurrogatePairAt(String text, int index) {
    return Character.isHighSurrogate(text.charAt(index))
        && index + 1 < text.length()
        && Character.isLowSurrogate(text.charAt(index + 1));
  }
}
