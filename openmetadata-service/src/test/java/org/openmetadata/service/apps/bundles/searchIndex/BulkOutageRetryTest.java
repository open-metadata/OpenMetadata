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
package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.ConnectException;
import java.time.Duration;
import java.util.concurrent.CompletionException;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class BulkOutageRetryTest {
  private static final long PRODUCTION_BACKOFF_MILLIS = 100L;

  @Test
  void aConnectionFailureATimeoutOrAnOverloadedClusterIsAnOutage() {
    assertTrue(BulkOutageRetry.isOutage(new CompletionException(new ConnectException("refused"))));
    assertTrue(BulkOutageRetry.isOutage(new IllegalStateException("request timed out")));
    assertTrue(BulkOutageRetry.isOutage(new IllegalStateException("[429] too_many_requests")));
    assertTrue(
        BulkOutageRetry.isOutage(new IllegalStateException("[503] cluster_block_exception")));
    assertTrue(
        BulkOutageRetry.isOutage(new IllegalStateException("es_rejected_execution_exception")));
  }

  @Test
  void aDocumentTheClusterRejectsIsNotAnOutage() {
    assertFalse(BulkOutageRetry.isOutage(new IllegalStateException("mapper_parsing_exception")));
    assertFalse(
        BulkOutageRetry.isOutage(new IllegalStateException("413 request entity too large")));
    assertFalse(BulkOutageRetry.isOutage(new IllegalStateException((String) null)));
  }

  @Test
  void eachAttemptWaitsLongerUpToAHundredTimesTheFirstWait() {
    assertEquals(100L, BulkOutageRetry.delayMillis(0, PRODUCTION_BACKOFF_MILLIS));
    assertEquals(200L, BulkOutageRetry.delayMillis(1, PRODUCTION_BACKOFF_MILLIS));
    assertEquals(10_000L, BulkOutageRetry.delayMillis(40, PRODUCTION_BACKOFF_MILLIS));
  }

  @Test
  void theAttemptBudgetRidesOutAboutTenMinutes() {
    final long waited =
        IntStream.range(0, BulkOutageRetry.ATTEMPTS)
            .mapToLong(attempt -> BulkOutageRetry.delayMillis(attempt, PRODUCTION_BACKOFF_MILLIS))
            .sum();
    assertTrue(waited >= Duration.ofMinutes(8).toMillis(), "rides out a node restart");
    assertTrue(waited <= Duration.ofMinutes(12).toMillis(), "gives up on a lasting outage");
    assertTrue(BulkOutageRetry.canRetry(BulkOutageRetry.ATTEMPTS - 1));
    assertFalse(BulkOutageRetry.canRetry(BulkOutageRetry.ATTEMPTS));
  }
}
