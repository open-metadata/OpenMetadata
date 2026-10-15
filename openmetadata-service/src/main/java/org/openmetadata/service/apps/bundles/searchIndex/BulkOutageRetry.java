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

import java.io.IOException;
import java.util.Locale;
import java.util.Set;

/**
 * How a reindex bulk write rides out a search outage. Instead of failing its documents after a
 * few quick retries, a batch keeps retrying for about ten minutes, so a restarted node or a
 * network blip does not drop documents from the run. The batch keeps its request slot meanwhile,
 * which makes the readers wait instead of piling up more batches.
 */
final class BulkOutageRetry {
  /** With the delay capped at a hundred times the first wait, about ten minutes in production. */
  static final int ATTEMPTS = 60;

  /** Waits for a request slot while batches ride out an outage, one slot timeout each. */
  static final int SLOT_WAITS = 10;

  private static final int MAX_DOUBLINGS = 20;
  private static final long MAX_DELAY_FACTOR = 100L;
  private static final Set<String> OUTAGE_MARKERS =
      Set.of(
          "connection refused",
          "connection reset",
          "connection closed",
          "connectexception",
          "timeout",
          "timed out",
          "too_many_requests",
          "rejected_execution",
          "circuit_breaking_exception",
          "cluster_block_exception",
          "no_shard_available",
          "master_not_discovered",
          "node_not_connected",
          "remotetransportexception",
          "service unavailable",
          "[429]",
          "[503]");

  private BulkOutageRetry() {}

  /** Whether {@code error} says the cluster could not take writes rather than rejecting a document. */
  static boolean isOutage(final Throwable error) {
    boolean outage = false;
    for (Throwable cause = error; cause != null && !outage; cause = nextCause(cause)) {
      outage = cause instanceof IOException || namesAnOutage(cause.getMessage());
    }
    return outage;
  }

  static boolean canRetry(final int attemptNumber) {
    return attemptNumber < ATTEMPTS;
  }

  /** Wait before attempt {@code attemptNumber + 1}, doubling up to a hundred times the first. */
  static long delayMillis(final int attemptNumber, final long initialBackoffMillis) {
    final int doublings = Math.clamp(attemptNumber, 0, MAX_DOUBLINGS);
    return Math.min(initialBackoffMillis * MAX_DELAY_FACTOR, initialBackoffMillis << doublings);
  }

  private static boolean namesAnOutage(final String message) {
    final String lowerCase = message == null ? "" : message.toLowerCase(Locale.ROOT);
    return OUTAGE_MARKERS.stream().anyMatch(lowerCase::contains);
  }

  private static Throwable nextCause(final Throwable error) {
    final Throwable cause = error.getCause();
    return cause == error ? null : cause;
  }
}
