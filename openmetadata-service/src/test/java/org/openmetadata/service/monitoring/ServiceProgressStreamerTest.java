package org.openmetadata.service.monitoring;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseBroadcaster;
import jakarta.ws.rs.sse.SseEventSink;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressUpdate;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressUpdateType;

class ServiceProgressStreamerTest {

  @Test
  void testReplayThenLiveMultiplexAcrossPipelines() {
    IngestionProgressTracker tracker = new IngestionProgressTracker(new SimpleMeterRegistry());
    UUID run1 = UUID.randomUUID();
    UUID run2 = UUID.randomUUID();
    tracker.updateProgress("svc.metadata", run1, processing(run1));

    CapturingSink sink = new CapturingSink();
    ServiceProgressStreamer.stream("svc", sink, new StubSse(), tracker);

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

    CapturingSink sink = new CapturingSink();
    ServiceProgressStreamer.stream("svc", sink, new StubSse(), tracker);

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
    private boolean closed = false;

    @Override
    public boolean isClosed() {
      return closed;
    }

    @Override
    public CompletionStage<?> send(OutboundSseEvent event) {
      data.add((String) event.getData());
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

    @Override
    public OutboundSseEvent.Builder newEventBuilder() {
      throw new UnsupportedOperationException();
    }

    @Override
    public SseBroadcaster newBroadcaster() {
      throw new UnsupportedOperationException();
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
    public jakarta.ws.rs.core.MediaType getMediaType() {
      return jakarta.ws.rs.core.MediaType.TEXT_PLAIN_TYPE;
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
