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

package org.openmetadata.service.resources.services.ingestionpipelines;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseEventSink;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;

class ProgressSseManagerTest {

  @Test
  void closeUnregistersListenerAndClosesSink() {
    ProgressSseManager manager = ProgressSseManager.getInstance();
    int activeBefore = manager.activeConnections();
    SseEventSink eventSink = mock(SseEventSink.class);
    Sse sse = mock(Sse.class);
    AtomicBoolean closed = new AtomicBoolean(false);

    when(eventSink.isClosed()).thenReturn(false);

    assertTrue(manager.register(eventSink, sse, () -> closed.set(true)));
    assertEquals(activeBefore + 1, manager.activeConnections());

    manager.close(eventSink);

    assertTrue(closed.get());
    assertEquals(activeBefore, manager.activeConnections());
    verify(eventSink).close();
  }
}
