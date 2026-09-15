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
import jakarta.ws.rs.sse.SseBroadcaster;
import org.glassfish.jersey.media.sse.OutboundEvent;

/**
 * The {@link Sse} factory the container would inject, built on Jersey's real event implementation
 * so tests exercise the same event objects production does. Jersey's own {@code Sse} binding is not
 * public, and broadcasting is not part of this feature.
 */
final class TestSse implements Sse {

  @Override
  public OutboundSseEvent.Builder newEventBuilder() {
    return new OutboundEvent.Builder();
  }

  @Override
  public SseBroadcaster newBroadcaster() {
    throw new UnsupportedOperationException("Log streaming does not broadcast");
  }
}
