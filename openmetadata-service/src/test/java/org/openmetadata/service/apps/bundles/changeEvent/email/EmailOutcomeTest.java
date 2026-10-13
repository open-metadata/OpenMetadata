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

package org.openmetadata.service.apps.bundles.changeEvent.email;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.events.errors.EventPublisherException;

class EmailOutcomeTest {
  private static final Duration A_MOMENT = Duration.ofMillis(50);

  @Test
  void acceptedEmailIsDelivered() {
    assertDoesNotThrow(() -> EmailOutcome.await(CompletableFuture.completedFuture(null), A_MOMENT));
  }

  @Test
  void rejectedEmailIsAFailureThatSaysWhy() {
    CompletableFuture<Void> rejected =
        CompletableFuture.failedFuture(new IllegalStateException("550 mailbox unavailable"));

    EventPublisherException failure =
        assertThrows(EventPublisherException.class, () -> EmailOutcome.await(rejected, A_MOMENT));

    assertTrue(failure.getMessage().contains("550 mailbox unavailable"));
  }

  @Test
  void waitThatRunsOutIsAFailure() {
    CompletableFuture<Void> neverAnswers = new CompletableFuture<>();

    EventPublisherException failure =
        assertThrows(
            EventPublisherException.class, () -> EmailOutcome.await(neverAnswers, A_MOMENT));

    assertTrue(failure.getMessage().contains("did not answer"));
  }
}
