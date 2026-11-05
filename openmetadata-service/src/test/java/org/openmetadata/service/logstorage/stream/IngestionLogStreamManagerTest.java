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

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.LogStreamEvent;
import org.openmetadata.schema.entity.services.ingestionPipelines.LogStreamEventType;
import org.openmetadata.service.logstorage.stream.IngestionLogStreamManager.LogStreamRequest;
import org.openmetadata.service.logstorage.stream.IngestionLogTailer.LogStreamRun;
import org.openmetadata.service.logstorage.stream.IngestionLogTailer.RunState;

/**
 * Whether viewers of the same run really do share one reader, and what happens once the server's
 * limits are reached. These run against the real scheduler, so they assert on observable outcomes
 * with a bounded wait rather than on internal call counts alone.
 */
class IngestionLogStreamManagerTest {

  private static final LogStreamSettings SETTINGS =
      new LogStreamSettings(
          1, 100, 10, 4096, 1_000_000L, 600, 600, 600, 600, 600, 65_536, 1_000_000, 1, 2);

  private IngestionLogStreamManager manager;
  private TestSse sse;

  @BeforeEach
  void setUp() {
    manager = new IngestionLogStreamManager(SETTINGS);
    sse = new TestSse();
  }

  @AfterEach
  void tearDown() {
    manager.shutdown();
  }

  @Test
  void twoViewersOfTheSameRunShareASingleReader() {
    CountingSource source = new CountingSource("shared output");
    LogStreamRequest request = requestFor("run-a", source);
    RecordingSseEventSink first = new RecordingSseEventSink();
    RecordingSseEventSink second = new RecordingSseEventSink();

    manager.stream(request, first, sse);
    manager.stream(request, second, sse);

    await().atMost(10, SECONDS).until(() -> !first.logs().isEmpty() && !second.logs().isEmpty());
    assertEquals(1, manager.activeRuns(), "both viewers must be served by one tailer");
    assertEquals("shared output", first.logs());
    assertEquals("shared output", second.logs());
    assertEquals(
        1, source.contentReads(), "the run's content must be read from the backend exactly once");
  }

  @Test
  void aRunPastTheServersCapacityIsRefusedRatherThanQueued() {
    manager.stream(requestFor("run-a", new CountingSource("a")), new RecordingSseEventSink(), sse);
    RecordingSseEventSink refused = new RecordingSseEventSink();

    manager.stream(requestFor("run-b", new CountingSource("b")), refused, sse);

    assertEquals(1, manager.activeRuns());
    assertEquals(LogStreamEventType.ERROR, refused.events().get(0).getEventType());
    assertTrue(refused.isClosed(), "a refused viewer must not be left hanging on an open stream");
  }

  @Test
  void aViewerPastTheConnectionCapIsRefusedRatherThanQueued() {
    LogStreamRequest request = requestFor("run-a", new CountingSource("a"));
    manager.stream(request, new RecordingSseEventSink(), sse);
    manager.stream(request, new RecordingSseEventSink(), sse);
    RecordingSseEventSink refused = new RecordingSseEventSink();

    manager.stream(request, refused, sse);

    LogStreamEvent event = refused.events().get(refused.events().size() - 1);
    assertEquals(LogStreamEventType.ERROR, event.getEventType());
    assertTrue(refused.isClosed());
  }

  private LogStreamRequest requestFor(String key, LogTailSource source) {
    return new LogStreamRequest(
        key, new LogStreamRun(UUID.randomUUID().toString(), source, () -> RunState.RUNNING, null));
  }

  /** Hands out its content once, then reports nothing new — like a run that has already ended. */
  private static final class CountingSource implements LogTailSource {

    private final String content;
    private final AtomicInteger contentReads = new AtomicInteger();
    private boolean delivered;

    CountingSource(String content) {
      this.content = content;
    }

    int contentReads() {
      return contentReads.get();
    }

    @Override
    public synchronized LogChunk readNext() {
      LogChunk chunk = new LogChunk("", "done");
      if (!delivered) {
        delivered = true;
        contentReads.incrementAndGet();
        chunk = new LogChunk(content, "done");
      }
      return chunk;
    }
  }
}
