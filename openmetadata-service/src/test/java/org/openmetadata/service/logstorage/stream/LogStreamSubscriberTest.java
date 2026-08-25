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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.LogStreamEvent;
import org.openmetadata.schema.entity.services.ingestionPipelines.LogStreamEventType;

/**
 * The ceiling that stops a browser which has stopped reading from pinning a run's whole log in the
 * server's heap.
 */
class LogStreamSubscriberTest {

  private static final String RUN_ID = "11111111-1111-1111-1111-111111111111";
  private static final int CONTENT_CHARS = 200;
  private static final long CEILING_BYTES = 400;

  private final TestSse sse = new TestSse();

  @Test
  void keepsServingAViewerWhoseBacklogIsUnderTheCeiling() {
    RecordingSseEventSink sink = new RecordingSseEventSink(false);
    LogStreamSubscriber subscriber = subscriberFor(sink);

    assertTrue(subscriber.send(logsEvent("a".repeat(CONTENT_CHARS))));
    assertTrue(
        subscriber.send(logsEvent("a")),
        "a viewer holding less than the ceiling must keep receiving events");
  }

  /**
   * The ceiling is charged in bytes on the wire, not characters. Counting characters would let a
   * stalled viewer holding multi-byte content pin several times the configured memory before it was
   * dropped — the same payload measured two ways is the whole point of this test.
   */
  @Test
  void chargesMultiByteContentByWhatItWeighsEncoded() {
    RecordingSseEventSink sink = new RecordingSseEventSink(false);
    LogStreamSubscriber subscriber = subscriberFor(sink);

    assertTrue(subscriber.send(logsEvent("例".repeat(CONTENT_CHARS))));
    assertFalse(
        subscriber.send(logsEvent("a")),
        "content of the same character count but three bytes per character must cross the ceiling");
  }

  private LogStreamSubscriber subscriberFor(RecordingSseEventSink sink) {
    return new LogStreamSubscriber(sink, sse, CEILING_BYTES);
  }

  private static LogStreamEvent logsEvent(String content) {
    return new LogStreamEvent()
        .withEventType(LogStreamEventType.LOGS)
        .withRunId(RUN_ID)
        .withLogs(content);
  }
}
