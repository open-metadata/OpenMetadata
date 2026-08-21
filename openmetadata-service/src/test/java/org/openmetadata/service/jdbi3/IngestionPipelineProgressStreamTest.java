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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import jakarta.ws.rs.sse.OutboundSseEvent;
import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseEventSink;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Consumer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressUpdate;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressUpdateType;
import org.openmetadata.service.monitoring.IngestionProgressTracker;
import org.openmetadata.service.monitoring.IngestionProgressTracker.ProgressState;
import org.openmetadata.service.resources.services.ingestionpipelines.ProgressSseManager;

class IngestionPipelineProgressStreamTest {

  private final List<SseEventSink> registeredSinks = new ArrayList<>();

  @AfterEach
  void closeProgressStreams() {
    registeredSinks.forEach(ProgressSseManager.getInstance()::close);
  }

  @Test
  void streamProgressEmitsExistingSnapshotThenSubsequentLiveUpdate() {
    String pipelineFqn = "service.pipeline";
    UUID runId = UUID.randomUUID();
    IngestionProgressTracker tracker = new IngestionProgressTracker(new SimpleMeterRegistry());
    ProgressUpdate snapshot = update(runId, ProgressUpdateType.DISCOVERY, "snapshot");
    ProgressUpdate liveUpdate = update(runId, ProgressUpdateType.PROCESSING, "live");
    tracker.updateProgress(pipelineFqn, runId, snapshot);
    CapturingSink sink = capturingSink();

    repositoryWith(tracker).streamProgress(pipelineFqn, runId, sink, sse());
    tracker.updateProgress(pipelineFqn, runId, liveUpdate);

    assertMessages(sink, "snapshot", "live");
  }

  @Test
  void streamProgressDoesNotReplayLiveUpdateDeliveredDuringListenerRegistration() {
    String pipelineFqn = "service.pipeline";
    UUID runId = UUID.randomUUID();
    ProgressUpdate liveUpdate = update(runId, ProgressUpdateType.PROCESSING, "live");
    IngestionProgressTracker tracker =
        new UpdateDuringListenerRegistrationTracker(runId, liveUpdate);
    CapturingSink sink = capturingSink();

    repositoryWith(tracker).streamProgress(pipelineFqn, runId, sink, sse());

    assertMessages(sink, "live");
  }

  @Test
  void streamProgressDoesNotReplaySnapshotWhenDelayedListenerReceivesSameInstance() {
    String pipelineFqn = "service.pipeline";
    UUID runId = UUID.randomUUID();
    ProgressUpdate snapshot = update(runId, ProgressUpdateType.DISCOVERY, "snapshot");
    DelayedSnapshotListenerTracker tracker = new DelayedSnapshotListenerTracker();
    tracker.updateProgress(pipelineFqn, runId, snapshot);
    CapturingSink sink = capturingSink();

    repositoryWith(tracker).streamProgress(pipelineFqn, runId, sink, sse());
    tracker.deliverDelayedCallback(snapshot);

    assertMessages(sink, "snapshot");
  }

  @Test
  void streamProgressDoesNotEmitStaleSnapshotAfterLiveTerminalUpdate() {
    String pipelineFqn = "service.pipeline";
    UUID runId = UUID.randomUUID();
    ProgressUpdate snapshot = update(runId, ProgressUpdateType.PROCESSING, "snapshot");
    ProgressUpdate terminalUpdate = update(runId, ProgressUpdateType.PIPELINE_COMPLETE, "terminal");
    IngestionProgressTracker tracker =
        new UpdateDuringSnapshotReadTracker(runId, snapshot, terminalUpdate);
    DelayedFirstSendSink sink = delayedFirstSendSink();

    repositoryWith(tracker).streamProgress(pipelineFqn, runId, sink, sse());

    assertMessages(sink, "terminal");
    assertFalse(sink.isClosed());

    sink.completeFirstSend();

    assertTrue(sink.isClosed());
  }

  private IngestionPipelineRepository repositoryWith(IngestionProgressTracker tracker) {
    IngestionPipelineRepository repository =
        mock(IngestionPipelineRepository.class, Mockito.CALLS_REAL_METHODS);
    repository.setProgressTracker(tracker);
    return repository;
  }

  private CapturingSink capturingSink() {
    CapturingSink sink = new CapturingSink();
    registeredSinks.add(sink);
    return sink;
  }

  private DelayedFirstSendSink delayedFirstSendSink() {
    DelayedFirstSendSink sink = new DelayedFirstSendSink();
    registeredSinks.add(sink);
    return sink;
  }

  private Sse sse() {
    Sse sse = mock(Sse.class);
    when(sse.newEvent(anyString()))
        .thenAnswer(
            invocation -> {
              OutboundSseEvent event = mock(OutboundSseEvent.class);
              when(event.getData()).thenReturn(invocation.getArgument(0));
              return event;
            });
    return sse;
  }

  private static ProgressUpdate update(UUID runId, ProgressUpdateType updateType, String message) {
    return new ProgressUpdate()
        .withRunId(runId.toString())
        .withTimestamp(System.currentTimeMillis())
        .withUpdateType(updateType)
        .withMessage(message);
  }

  private static void assertMessages(CapturingSink sink, String... messages) {
    assertEquals(messages.length, sink.payloads.size());
    for (int i = 0; i < messages.length; i++) {
      assertTrue(sink.payloads.get(i).contains(messages[i]));
    }
  }

  private static class CapturingSink implements SseEventSink {
    protected final List<String> payloads = new ArrayList<>();
    private boolean closed;

    @Override
    public boolean isClosed() {
      return closed;
    }

    @Override
    public CompletionStage<?> send(OutboundSseEvent event) {
      capture(event);
      return CompletableFuture.completedFuture(null);
    }

    @Override
    public void close() {
      closed = true;
    }

    protected void capture(OutboundSseEvent event) {
      if (event.getData() != null) {
        payloads.add((String) event.getData());
      }
    }
  }

  private static final class DelayedFirstSendSink extends CapturingSink {
    private final CompletableFuture<Void> firstSend = new CompletableFuture<>();
    private boolean awaitingFirstSend = true;

    @Override
    public CompletionStage<?> send(OutboundSseEvent event) {
      capture(event);
      if (awaitingFirstSend) {
        awaitingFirstSend = false;
        return firstSend;
      }
      return CompletableFuture.completedFuture(null);
    }

    void completeFirstSend() {
      firstSend.complete(null);
    }
  }

  private static final class UpdateDuringListenerRegistrationTracker
      extends IngestionProgressTracker {
    private final UUID expectedRunId;
    private final ProgressUpdate liveUpdate;
    private boolean updateSent;

    private UpdateDuringListenerRegistrationTracker(UUID expectedRunId, ProgressUpdate liveUpdate) {
      super(new SimpleMeterRegistry());
      this.expectedRunId = expectedRunId;
      this.liveUpdate = liveUpdate;
    }

    @Override
    public void registerProgressListener(
        String pipelineFqn, UUID runId, Consumer<ProgressUpdate> listener) {
      super.registerProgressListener(pipelineFqn, runId, listener);
      if (!updateSent && expectedRunId.equals(runId)) {
        updateSent = true;
        updateProgress(pipelineFqn, runId, liveUpdate);
      }
    }
  }

  private static final class UpdateDuringSnapshotReadTracker extends IngestionProgressTracker {
    private final UUID expectedRunId;
    private final ProgressUpdate snapshot;
    private final ProgressUpdate liveUpdate;
    private boolean snapshotRead;

    private UpdateDuringSnapshotReadTracker(
        UUID expectedRunId, ProgressUpdate snapshot, ProgressUpdate liveUpdate) {
      super(new SimpleMeterRegistry());
      this.expectedRunId = expectedRunId;
      this.snapshot = snapshot;
      this.liveUpdate = liveUpdate;
    }

    @Override
    public ProgressState getProgressState(String pipelineFqn, UUID runId) {
      if (!snapshotRead && expectedRunId.equals(runId)) {
        snapshotRead = true;
        updateProgress(pipelineFqn, runId, liveUpdate);
        ProgressState frozenSnapshot = new ProgressState();
        frozenSnapshot.applyUpdate(snapshot);
        return frozenSnapshot;
      }
      return super.getProgressState(pipelineFqn, runId);
    }
  }

  private static final class DelayedSnapshotListenerTracker extends IngestionProgressTracker {
    private Consumer<ProgressUpdate> listener;

    private DelayedSnapshotListenerTracker() {
      super(new SimpleMeterRegistry());
    }

    @Override
    public void registerProgressListener(
        String pipelineFqn, UUID runId, Consumer<ProgressUpdate> registeredListener) {
      super.registerProgressListener(pipelineFqn, runId, registeredListener);
      listener = registeredListener;
    }

    void deliverDelayedCallback(ProgressUpdate snapshot) {
      listener.accept(snapshot);
    }
  }
}
