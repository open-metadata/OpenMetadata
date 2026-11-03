/*
 *  Copyright 2025 Collate
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import jakarta.ws.rs.core.GenericType;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseBroadcaster;
import jakarta.ws.rs.sse.SseEventSink;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressUpdate;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressUpdateType;
import org.openmetadata.service.resources.services.ingestionpipelines.ProgressSseManager;
import org.slf4j.LoggerFactory;

class ServiceProgressStreamerTest {
  private final List<CapturingSink> sinks = new ArrayList<>();

  private CapturingSink sink() {
    CapturingSink sink = new CapturingSink();
    sinks.add(sink);
    return sink;
  }

  @AfterEach
  void closeStreams() {
    sinks.forEach(ProgressSseManager.getInstance()::close);
  }

  @Test
  void filtersReplayedAndLiveEventsForEachSubscriber() {
    IngestionProgressTracker tracker = new IngestionProgressTracker(new SimpleMeterRegistry());
    UUID hiddenRun = UUID.randomUUID();
    UUID visibleRun = UUID.randomUUID();
    tracker.updateProgress("svc.hidden", hiddenRun, processing(hiddenRun));
    tracker.updateProgress("svc.visible", visibleRun, processing(visibleRun));
    CapturingSink restricted = sink();
    CapturingSink unrestricted = sink();

    ServiceProgressStreamer.stream(
        "svc",
        restricted,
        new StubSse(),
        tracker,
        event ->
            "svc.visible".equals(event.event().getPipelineFqn())
                ? Optional.of(event.event())
                : Optional.empty());
    ServiceProgressStreamer.stream(
        "svc", unrestricted, new StubSse(), tracker, snapshot -> Optional.of(snapshot.event()));
    assertEquals(1, restricted.data.size());
    assertEquals(2, unrestricted.data.size());

    tracker.updateProgress("svc.hidden", hiddenRun, terminal(hiddenRun));
    tracker.updateProgress("svc.visible", visibleRun, terminal(visibleRun));
    assertEquals(2, restricted.data.size());
    assertTrue(restricted.data.stream().allMatch(data -> data.contains("svc.visible")));
    assertEquals(4, unrestricted.data.size());
  }

  @Test
  void subscriberFailureClosesOnlyItsConnection() {
    IngestionProgressTracker tracker = new IngestionProgressTracker(new SimpleMeterRegistry());
    UUID run = UUID.randomUUID();
    tracker.updateProgress("svc.metadata", run, processing(run));
    CapturingSink broken = sink();
    CapturingSink healthy = sink();
    Logger logger = (Logger) LoggerFactory.getLogger(ServiceProgressStreamer.class);
    ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
    try {
      ServiceProgressStreamer.stream(
          "svc",
          broken,
          new StubSse(),
          tracker,
          event -> {
            throw new IllegalStateException("secret-bearing exception details");
          });
      ServiceProgressStreamer.stream(
          "svc", healthy, new StubSse(), tracker, snapshot -> Optional.of(snapshot.event()));
      assertTrue(broken.isClosed());
      assertTrue(broken.data.isEmpty());
      tracker.updateProgress("svc.metadata", run, terminal(run));
      assertEquals(2, healthy.data.size());
      List<ILoggingEvent> failures =
          appender.list.stream()
              .filter(event -> event.getFormattedMessage().contains(run.toString()))
              .toList();
      assertEquals(1, failures.size());
      String message = failures.getFirst().getFormattedMessage();
      assertTrue(message.contains("svc.metadata"));
      assertTrue(message.contains("IllegalStateException"));
      assertFalse(message.contains("secret-bearing"));
      assertNull(failures.getFirst().getThrowableProxy());
    } finally {
      logger.detachAppender(appender);
      appender.stop();
    }
  }

  @Test
  void failedSendClosesTheConnection() {
    IngestionProgressTracker tracker = new IngestionProgressTracker(new SimpleMeterRegistry());
    CapturingSink sink = sink();
    sink.failSends = true;
    ServiceProgressStreamer.stream(
        "svc", sink, new StubSse(), tracker, snapshot -> Optional.of(snapshot.event()));

    UUID run = UUID.randomUUID();
    tracker.updateProgress("svc.metadata", run, processing(run));

    assertTrue(sink.isClosed());
    assertTrue(sink.data.isEmpty());
  }

  @Test
  void testReplayThenLiveMultiplexAcrossPipelines() {
    IngestionProgressTracker tracker = new IngestionProgressTracker(new SimpleMeterRegistry());
    UUID run1 = UUID.randomUUID();
    UUID run2 = UUID.randomUUID();
    tracker.updateProgress("svc.metadata", run1, processing(run1));

    CapturingSink sink = sink();
    ServiceProgressStreamer.stream(
        "svc", sink, new StubSse(), tracker, snapshot -> Optional.of(snapshot.event()));

    assertEquals(1, sink.data.size());

    tracker.updateProgress("svc.lineage", run2, processing(run2));
    assertEquals(2, sink.data.size());
    assertTrue(sink.data.get(1).contains("svc.lineage"));
    assertTrue(sink.data.get(1).contains(run2.toString()));
  }

  @Test
  void testStreamStaysOpenAfterOneRunTerminal() {
    IngestionProgressTracker tracker = new IngestionProgressTracker(new SimpleMeterRegistry());
    UUID run1 = UUID.randomUUID();
    UUID run2 = UUID.randomUUID();

    CapturingSink sink = sink();
    ServiceProgressStreamer.stream(
        "svc", sink, new StubSse(), tracker, snapshot -> Optional.of(snapshot.event()));

    tracker.updateProgress("svc.metadata", run1, terminal(run1));
    tracker.updateProgress("svc.lineage", run2, processing(run2));

    assertTrue(sink.data.stream().anyMatch(d -> d.contains(run2.toString())));
    assertEquals(false, sink.isClosed());
  }

  private static ProgressUpdate processing(UUID runId) {
    return new ProgressUpdate()
        .withRunId(runId.toString())
        .withTimestamp(System.currentTimeMillis())
        .withUpdateType(ProgressUpdateType.PROCESSING);
  }

  private static ProgressUpdate terminal(UUID runId) {
    return new ProgressUpdate()
        .withRunId(runId.toString())
        .withTimestamp(System.currentTimeMillis())
        .withUpdateType(ProgressUpdateType.PIPELINE_COMPLETE);
  }

  static class CapturingSink implements SseEventSink {
    final List<String> data = new ArrayList<>();
    boolean failSends;
    private boolean closed = false;

    @Override
    public boolean isClosed() {
      return closed;
    }

    @Override
    public CompletionStage<?> send(OutboundSseEvent event) {
      if (failSends) {
        return CompletableFuture.failedFuture(new IllegalStateException("Disconnected"));
      }
      Object payload = event.getData();
      // Ignore data-less frames (e.g. the ProgressSseManager heartbeat comment) so a
      // heartbeat sweep firing mid-test cannot perturb the payload assertions.
      if (payload != null) {
        data.add((String) payload);
      }
      return CompletableFuture.completedFuture(null);
    }

    @Override
    public void close() {
      closed = true;
    }
  }

  static class StubSse implements Sse {
    @Override
    public OutboundSseEvent newEvent(String data) {
      return new StubEvent(data);
    }

    @Override
    public OutboundSseEvent newEvent(String name, String data) {
      return new StubEvent(data);
    }

    // Return a functional builder (not a thrower): the ProgressSseManager heartbeat builds
    // comment events via newEventBuilder(), so throwing here would let a heartbeat sweep close
    // the sink mid-test and make it flaky.
    @Override
    public OutboundSseEvent.Builder newEventBuilder() {
      return new StubBuilder();
    }

    @Override
    public SseBroadcaster newBroadcaster() {
      throw new UnsupportedOperationException();
    }
  }

  static class StubBuilder implements OutboundSseEvent.Builder {
    private Object data;

    @Override
    public OutboundSseEvent.Builder id(String id) {
      return this;
    }

    @Override
    public OutboundSseEvent.Builder name(String name) {
      return this;
    }

    @Override
    public OutboundSseEvent.Builder reconnectDelay(long milliseconds) {
      return this;
    }

    @Override
    public OutboundSseEvent.Builder mediaType(MediaType mediaType) {
      return this;
    }

    @Override
    public OutboundSseEvent.Builder comment(String comment) {
      return this;
    }

    @Override
    @SuppressWarnings("rawtypes")
    public OutboundSseEvent.Builder data(Class type, Object payload) {
      this.data = payload;
      return this;
    }

    @Override
    public OutboundSseEvent.Builder data(GenericType type, Object payload) {
      this.data = payload;
      return this;
    }

    @Override
    public OutboundSseEvent.Builder data(Object payload) {
      this.data = payload;
      return this;
    }

    @Override
    public OutboundSseEvent build() {
      return new StubEvent(data == null ? null : data.toString());
    }
  }

  record StubEvent(String payload) implements OutboundSseEvent {
    @Override
    public Class<?> getType() {
      return String.class;
    }

    @Override
    public Type getGenericType() {
      return String.class;
    }

    @Override
    public MediaType getMediaType() {
      return MediaType.TEXT_PLAIN_TYPE;
    }

    @Override
    public String getComment() {
      return null;
    }

    @Override
    public String getId() {
      return null;
    }

    @Override
    public String getName() {
      return null;
    }

    @Override
    public long getReconnectDelay() {
      return -1;
    }

    @Override
    public boolean isReconnectDelaySet() {
      return false;
    }

    @Override
    public Object getData() {
      return payload;
    }
  }
}
