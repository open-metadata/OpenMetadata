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
package org.openmetadata.it.search.shape;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.ProtocolException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * The shape canary reports {@link Outcome#REJECTED} when the engine refuses a document. An engine
 * that never answered has refused nothing, and calling that REJECTED blames the document under test
 * for a slow cluster — which is how a deadline overrun once surfaced as
 * "databaseSchema/tags.count/1k must index + be queryable but got REJECTED".
 */
class ShapeCanaryTest {

  /** Stands in for the shaded {@code DeadlineTimeoutException} the OpenSearch transport throws. */
  private static final class DeadlineTimeoutException extends RuntimeException {
    private DeadlineTimeoutException() {
      super("Deadline: 2026-09-09T09:04:05.390+0000, -1339 MILLISECONDS overdue");
    }
  }

  @Test
  @DisplayName("A missed request deadline is a transport failure, however deeply it is wrapped")
  void deadlineOverrunIsTransport() {
    assertTrue(
        ShapeCanary.isTransportFailure(
            new RuntimeException(
                "error while performing request", new DeadlineTimeoutException())));
  }

  @Test
  @DisplayName("A dropped or desynchronised connection is a transport failure")
  void ioFailureIsTransport() {
    assertTrue(ShapeCanary.isTransportFailure(new IOException("connection reset")));
    assertTrue(
        ShapeCanary.isTransportFailure(
            new RuntimeException(
                "GET failed",
                new ProtocolException("Frame type(34) length(6627898) exceeds MAX_FRAME_SIZE"))));
  }

  @Test
  @DisplayName("An engine refusal is not a transport failure — it is the finding under test")
  void mappingRejectionIsNotTransport() {
    assertFalse(
        ShapeCanary.isTransportFailure(
            new RuntimeException(
                "Request failed: [mapper_parsing_exception] The number of nested documents has"
                    + " exceeded the allowed limit of [10000]",
                new RuntimeException("Request failed: [mapper_parsing_exception]"))));
  }

  @Test
  @DisplayName("A cyclic cause chain terminates instead of spinning")
  void cyclicCauseChainTerminates() {
    final Throwable inner = new RuntimeException("inner");
    final Throwable outer = new RuntimeException("outer", inner);
    inner.initCause(outer);
    assertFalse(ShapeCanary.isTransportFailure(outer));
  }
}
