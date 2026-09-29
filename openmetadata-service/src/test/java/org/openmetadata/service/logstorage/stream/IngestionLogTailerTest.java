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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.LogStreamEndReason;
import org.openmetadata.schema.entity.services.ingestionPipelines.LogStreamEvent;
import org.openmetadata.schema.entity.services.ingestionPipelines.LogStreamEventType;
import org.openmetadata.service.logstorage.stream.IngestionLogTailer.LogStreamRun;
import org.openmetadata.service.logstorage.stream.IngestionLogTailer.RunState;

/**
 * Behaviour of the shared reader that backs every live log stream.
 *
 * <p>The properties under test are the ones that keep the feature from becoming a load generator:
 * one reader per run no matter how many viewers watch it, a reader that stops on its own once the
 * run is over or has gone quiet, and no reader at all once the last viewer leaves. Time is driven
 * by a fake clock so timeouts are asserted exactly instead of waited for.
 */
class IngestionLogTailerTest {

  private static final String RUN_ID = UUID.randomUUID().toString();
  private static final long ONE_SECOND_NANOS = 1_000_000_000L;
  private static final LogStreamSettings SETTINGS =
      new LogStreamSettings(1, 100, 10, 4096, 512L, 600, 60, 10, 30, 5, 64, 1_000_000, 10, 10);

  private FakeClock clock;
  private FakeSource source;
  private AtomicReference<RunState> runState;
  private AtomicInteger terminations;
  private TestSse sse;

  @BeforeEach
  void setUp() {
    clock = new FakeClock();
    source = new FakeSource();
    runState = new AtomicReference<>(RunState.RUNNING);
    terminations = new AtomicInteger();
    sse = new TestSse();
  }

  @Test
  void deliversNewContentToAViewerAsItAppears() {
    IngestionLogTailer tailer = newTailer();
    RecordingSseEventSink sink = attach(tailer);

    source.produce("first line");
    tailer.poll();
    source.produce("second line");
    tailer.poll();

    assertEquals("first line\nsecond line", sink.logs());
  }

  @Test
  void everyViewerOfARunSharesOneReader() {
    IngestionLogTailer tailer = newTailer();
    RecordingSseEventSink first = attach(tailer);
    RecordingSseEventSink second = attach(tailer);
    RecordingSseEventSink third = attach(tailer);

    source.produce("shared line");
    tailer.poll();

    assertEquals(3, tailer.viewerCount());
    assertEquals(2, source.reads(), "one read for the content plus one that finds nothing new");
    assertEquals("shared line", first.logs());
    assertEquals("shared line", second.logs());
    assertEquals("shared line", third.logs());
  }

  @Test
  void aViewerJoiningLateSeesWhatItMissed() {
    IngestionLogTailer tailer = newTailer();
    attach(tailer);
    source.produce("emitted before the second viewer connected");
    tailer.poll();

    RecordingSseEventSink late = attach(tailer);

    assertEquals("emitted before the second viewer connected", late.logs());
    assertTrue(
        late.events().stream().allMatch(LogStreamEvent::getReplay),
        "backlog delivered to a late viewer must be flagged as a replay");
  }

  @Test
  void aBacklogTooBigToReplayTellsTheViewerToFetchTheHistory() {
    IngestionLogTailer tailer = newTailer();
    attach(tailer);
    for (int chunk = 0; chunk < 10; chunk++) {
      source.produce("x".repeat(40));
      tailer.poll();
    }

    RecordingSseEventSink late = attach(tailer);

    assertTrue(
        late.events().stream().anyMatch(LogStreamEvent::getTruncated),
        "a viewer that cannot be given the whole backlog must be told so");
  }

  @Test
  void closesTheStreamOnceAFinishedRunHasGoneQuiet() {
    IngestionLogTailer tailer = newTailer();
    RecordingSseEventSink sink = attach(tailer);
    source.produce("last line of the run");
    tailer.poll();

    runState.set(RunState.FINISHED);
    clock.advanceSeconds(SETTINGS.finishGraceSeconds());
    tailer.poll();

    assertEquals(LogStreamEndReason.RUN_FINISHED, endReason(sink));
    assertTrue(sink.isClosed(), "the sink must be closed so the client sees the stream end");
    assertTrue(tailer.isTerminated());
    assertEquals(1, terminations.get());
  }

  @Test
  void keepsStreamingWhileTheRunIsStillGoing() {
    IngestionLogTailer tailer = newTailer();
    RecordingSseEventSink sink = attach(tailer);

    clock.advanceSeconds(SETTINGS.finishGraceSeconds() * 3L);
    tailer.poll();

    assertFalse(tailer.isTerminated());
    assertFalse(sink.isClosed());
  }

  @Test
  void givesUpOnARunThatNeverReportsAndNeverLogs() {
    IngestionLogTailer tailer = newTailer();
    RecordingSseEventSink sink = attach(tailer);

    clock.advanceSeconds(SETTINGS.maxIdleSeconds());
    tailer.poll();

    assertEquals(LogStreamEndReason.IDLE_TIMEOUT, endReason(sink));
    assertTrue(tailer.isTerminated());
  }

  @Test
  void stopsStreamingOnceItHasSentAsMuchAsItWill() {
    IngestionLogTailer tailer = newTailer();
    RecordingSseEventSink sink = attach(tailer);

    source.produce("y".repeat((int) SETTINGS.maxStreamBytes() + 1));
    tailer.poll();

    assertEquals(LogStreamEndReason.MAX_BYTES, endReason(sink));
    assertTrue(tailer.isTerminated());
  }

  @Test
  void stopsReadingTheBackendWhenTheLastViewerLeaves() {
    IngestionLogTailer tailer = newTailer();
    LogStreamSubscriber subscriber = subscriberFor(new RecordingSseEventSink());
    tailer.attach(subscriber, null);

    tailer.detach(subscriber);
    int readsAfterDetach = source.reads();
    tailer.poll();

    assertTrue(tailer.isTerminated());
    assertEquals(readsAfterDetach, source.reads(), "an unwatched run must not be read at all");
  }

  @Test
  void aBackendHiccupDoesNotEndTheStream() {
    IngestionLogTailer tailer = newTailer();
    RecordingSseEventSink sink = attach(tailer);

    source.failNext(new IOException("log file not created yet"));
    tailer.poll();

    assertFalse(tailer.isTerminated(), "a transient read failure must not close a live stream");

    source.produce("logs finally arrived");
    tailer.poll();

    assertEquals("logs finally arrived", sink.logs());
  }

  @Test
  void aPersistentSourceFailureEndsTheStreamWithAnErrorEvent() {
    IngestionLogTailer tailer = newTailer();
    RecordingSseEventSink sink = attach(tailer);

    source.failNext(new LogSourceUnavailableException("Kubernetes pod status could not be parsed"));
    tailer.poll();

    assertTrue(
        tailer.isTerminated(),
        "a failure that will not resolve on a later poll must end the stream, not be retried");
    assertTrue(sink.isClosed());
    LogStreamEvent errorEvent =
        sink.events().stream()
            .filter(event -> event.getEventType() == LogStreamEventType.ERROR)
            .findFirst()
            .orElse(null);
    assertEquals(
        "Kubernetes pod status could not be parsed",
        errorEvent == null ? null : errorEvent.getMessage(),
        "the viewer must see why the stream ended rather than an empty stream until idle timeout");
  }

  @Test
  void aRunWithNoStatusRowIsGivenTimeToStartWritingBeforeTheStreamCloses() {
    runState.set(RunState.UNKNOWN);
    IngestionLogTailer tailer = newTailer();
    RecordingSseEventSink sink = attach(tailer);

    clock.advanceSeconds(SETTINGS.finishGraceSeconds());
    tailer.poll();

    assertFalse(
        tailer.isTerminated(),
        "a just-triggered run has no status row yet and must not be reported as over");

    clock.advanceSeconds(SETTINGS.unknownRunGraceSeconds());
    tailer.poll();

    assertEquals(LogStreamEndReason.RUN_FINISHED, endReason(sink));
  }

  @Test
  void looksUpTheRunStateSparinglyRatherThanOnEveryPoll() {
    AtomicInteger probes = new AtomicInteger();
    IngestionLogTailer tailer =
        newTailer(
            () -> {
              probes.incrementAndGet();
              return RunState.RUNNING;
            },
            clock);
    attach(tailer);

    for (int poll = 0; poll < 5; poll++) {
      tailer.poll();
    }

    assertEquals(1, probes.get(), "the run state must be cached between probe intervals");

    clock.advanceSeconds(SETTINGS.runProbeSeconds());
    tailer.poll();

    assertEquals(2, probes.get());
  }

  @Test
  void everyEventCarriesTheCursorNeededToResume() {
    IngestionLogTailer tailer = newTailer();
    RecordingSseEventSink sink = attach(tailer);

    source.produce("resumable");
    tailer.poll();

    List<LogStreamEvent> events = sink.events();
    assertEquals(1, events.size());
    assertEquals(LogStreamEventType.LOGS, events.get(0).getEventType());
    assertEquals(source.cursor(), events.get(0).getAfter());
    assertEquals(RUN_ID, events.get(0).getRunId());
  }

  @Test
  void aViewerResumingFromItsCursorOnlyGetsWhatItMissed() {
    IngestionLogTailer tailer = newTailer();
    attach(tailer);
    source.produce("already seen");
    tailer.poll();
    String seenUpTo = source.cursor();
    source.produce("missed while disconnected");
    tailer.poll();

    RecordingSseEventSink resumed = attach(tailer, seenUpTo);

    assertEquals("missed while disconnected", resumed.logs());
  }

  @Test
  void aViewerAlreadyUpToDateIsNotSentTheBacklogAgain() {
    IngestionLogTailer tailer = newTailer();
    attach(tailer);
    source.produce("everything so far");
    tailer.poll();

    RecordingSseEventSink resumed = attach(tailer, source.cursor());

    assertTrue(resumed.events().isEmpty(), "a caught-up viewer must not be re-sent the backlog");
  }

  @Test
  void aViewerWhoseCursorTheServerCannotPlaceIsToldTheReplayIsIncomplete() {
    IngestionLogTailer tailer = newTailer();
    attach(tailer);
    source.produce("streamed by the running tailer");
    tailer.poll();

    RecordingSseEventSink resumed = attach(tailer, "a-cursor-from-another-stream");

    assertTrue(
        resumed.events().stream().anyMatch(LogStreamEvent::getTruncated),
        "a replay that may have a gap in it must say so, got: " + resumed.payloads());
    assertEquals("streamed by the running tailer", resumed.logs());
  }

  @Test
  void aRunStateLookupFailureDoesNotEndTheStream() {
    IngestionLogTailer tailer =
        newTailer(
            () -> {
              throw new IllegalStateException("the status table is unreachable");
            },
            clock);
    RecordingSseEventSink sink = attach(tailer);

    clock.advanceSeconds(SETTINGS.unknownRunGraceSeconds());
    tailer.poll();

    assertFalse(
        tailer.isTerminated(), "a failed run-state lookup must not be read as 'the run is over'");
    assertFalse(sink.isClosed());
  }

  @Test
  void aPollFailureClosesTheStreamInsteadOfKillingTheReader() {
    IngestionLogTailer tailer = newTailer(runState::get, new BrokenClock());
    RecordingSseEventSink sink = attach(tailer);

    tailer.poll();

    assertTrue(tailer.isTerminated(), "a stream that cannot be polled must be ended, not orphaned");
    assertTrue(sink.isClosed(), "the client must see the connection close so it can reconnect");
    assertEquals(1, terminations.get(), "the run must give up its tail slot");
  }

  private IngestionLogTailer newTailer() {
    return newTailer(runState::get, clock);
  }

  private IngestionLogTailer newTailer(Supplier<RunState> state, LongSupplier nanoTime) {
    return new IngestionLogTailer(
        new LogStreamRun(RUN_ID, source, state, null),
        SETTINGS,
        nanoTime,
        terminations::incrementAndGet);
  }

  private RecordingSseEventSink attach(IngestionLogTailer tailer) {
    return attach(tailer, null);
  }

  private RecordingSseEventSink attach(IngestionLogTailer tailer, String fromCursor) {
    RecordingSseEventSink sink = new RecordingSseEventSink();
    tailer.attach(subscriberFor(sink), fromCursor);
    return sink;
  }

  private LogStreamSubscriber subscriberFor(RecordingSseEventSink sink) {
    return new LogStreamSubscriber(sink, sse, SETTINGS.maxPendingBytesPerClient());
  }

  private static LogStreamEndReason endReason(RecordingSseEventSink sink) {
    return sink.events().stream()
        .filter(event -> event.getEventType() == LogStreamEventType.COMPLETE)
        .map(LogStreamEvent::getReason)
        .findFirst()
        .orElse(null);
  }

  /** A log source under the test's control, standing in for S3 or the pipeline service. */
  private static final class FakeSource implements LogTailSource {

    private final Deque<String> pending = new ArrayDeque<>();
    private int reads;
    private long offset;
    private IOException failure;

    void produce(String content) {
      pending.add(content);
    }

    void failNext(IOException error) {
      failure = error;
    }

    int reads() {
      return reads;
    }

    String cursor() {
      return Long.toString(offset);
    }

    @Override
    public LogChunk readNext() throws IOException {
      reads++;
      if (failure != null) {
        IOException error = failure;
        failure = null;
        throw error;
      }
      String next = pending.poll();
      if (next != null) {
        offset += next.length();
      }
      return new LogChunk(next == null ? "" : next, cursor());
    }
  }

  /** Wall clock the test moves by hand, so timeouts are asserted rather than waited out. */
  private static final class FakeClock implements LongSupplier {

    private long nanos = 1_000_000_000L;

    void advanceSeconds(long seconds) {
      nanos += seconds * ONE_SECOND_NANOS;
    }

    @Override
    public long getAsLong() {
      return nanos;
    }
  }

  /**
   * A collaborator that works while the tailer is built and fails once it is polled, standing in
   * for anything inside a poll that can fail in a way the tailer does not anticipate.
   */
  private static final class BrokenClock implements LongSupplier {

    private boolean used;

    @Override
    public long getAsLong() {
      if (used) {
        throw new IllegalStateException("the clock is broken");
      }
      used = true;
      return ONE_SECOND_NANOS;
    }
  }
}
