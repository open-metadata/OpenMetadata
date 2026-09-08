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
package org.openmetadata.service.rdf;

import java.time.Clock;
import java.time.Duration;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.openmetadata.service.monitoring.OntologyMetrics;

/** Shared, ordered delivery and health state. Only acknowledged writes are removed. */
@Slf4j
public final class RdfLiveWriteStore {
  private static final long MAX_HEALTHY_LAG_MILLIS = Duration.ofSeconds(30).toMillis();
  private static final int MAX_ERROR_LENGTH = 8192;
  private final Jdbi jdbi;
  private final Clock clock;

  public RdfLiveWriteStore(final Jdbi jdbi, final Clock clock) {
    this.jdbi = jdbi;
    this.clock = clock;
  }

  public void enqueue(final String payload) {
    jdbi.useTransaction(
        TransactionIsolationLevel.READ_COMMITTED,
        handle -> {
          // Serializing these short transactions makes id order also be commit order. This lock
          // is independent of the consumer fence, so a slow Fuseki write cannot stall producers.
          handle
              .createQuery("SELECT id FROM rdf_live_write_guard WHERE id = 'enqueue' FOR UPDATE")
              .mapTo(String.class)
              .one();
          handle.execute(
              "INSERT INTO rdf_live_write_queue (payload, createdAt) VALUES (?, ?)",
              payload,
              clock.millis());
        });
  }

  public boolean processNext(final Consumer<String> write) {
    return jdbi.inTransaction(
        TransactionIsolationLevel.READ_COMMITTED,
        handle -> {
          final boolean ownsWriter =
              handle
                  .createQuery(
                      "SELECT id FROM rdf_live_write_guard WHERE id = 'drain' FOR UPDATE SKIP LOCKED")
                  .mapTo(String.class)
                  .findOne()
                  .isPresent();
          return ownsWriter && processHead(handle, write);
        });
  }

  private boolean processHead(final Handle handle, final Consumer<String> write) {
    final Entry entry = head(handle);
    if (entry == null || entry.nextAttemptAt() > clock.millis()) {
      return false;
    }
    OntologyMetrics.recordRdfQueueLag(
        Duration.ofMillis(Math.max(0, clock.millis() - entry.createdAt())));
    try {
      write.accept(entry.payload());
    } catch (RuntimeException exception) {
      recordFailure(handle, entry, exception);
      return false;
    }
    handle.execute("DELETE FROM rdf_live_write_queue WHERE id = ?", entry.id());
    return true;
  }

  private void recordFailure(
      final Handle handle, final Entry entry, final RuntimeException failure) {
    final int attempts = Math.min(entry.attempts(), Integer.MAX_VALUE - 1) + 1;
    handle.execute(
        "UPDATE rdf_live_write_queue SET attempts = ?, nextAttemptAt = ?, lastError = ? WHERE id = ?",
        attempts,
        clock.millis() + retryDelayMillis(attempts),
        failureReason(failure),
        entry.id());
    LOG.warn(
        "Live RDF write {} failed (attempt {}); retained for retry", entry.id(), attempts, failure);
  }

  static long retryDelayMillis(final int attempts) {
    return Math.min(60_000, 1000L << Math.min(6, Math.max(0, attempts - 1)));
  }

  static String failureReason(final Throwable failure) {
    final String reason = failure.getClass().getSimpleName() + ": " + failure.getMessage();
    return reason.substring(0, Math.min(reason.length(), MAX_ERROR_LENGTH));
  }

  public long failureVersion() {
    return jdbi.withHandle(
        handle ->
            handle
                .createQuery("SELECT failureVersion FROM rdf_projection_health WHERE id = 'active'")
                .mapTo(Long.class)
                .one());
  }

  public void markDegraded(final String reason) {
    jdbi.useHandle(
        handle ->
            handle.execute(
                "UPDATE rdf_projection_health SET failureVersion = failureVersion + 1, lastError = ?, updatedAt = ? WHERE id = 'active'",
                reason,
                clock.millis()));
  }

  public void markRebuilt(final long failureVersion) {
    jdbi.useHandle(
        handle ->
            handle.execute(
                "UPDATE rdf_projection_health SET repairedVersion = GREATEST(repairedVersion, ?) WHERE id = 'active'",
                failureVersion));
  }

  public boolean isDegraded() {
    return jdbi.withHandle(
        handle -> {
          final boolean unrepaired =
              handle
                  .createQuery(
                      "SELECT failureVersion > repairedVersion FROM rdf_projection_health WHERE id = 'active'")
                  .mapTo(Boolean.class)
                  .one();
          final QueueHead head =
              handle
                  .createQuery(
                      "SELECT createdAt, attempts FROM rdf_live_write_queue ORDER BY id LIMIT 1")
                  .map(
                      (result, context) ->
                          new QueueHead(result.getLong("createdAt"), result.getInt("attempts")))
                  .findOne()
                  .orElse(null);
          return unrepaired
              || (head != null
                  && (head.attempts() > 0
                      || clock.millis() - head.createdAt() >= MAX_HEALTHY_LAG_MILLIS));
        });
  }

  public long pendingWrites() {
    return jdbi.withHandle(
        handle ->
            handle
                .createQuery("SELECT COUNT(*) FROM rdf_live_write_queue")
                .mapTo(Long.class)
                .one());
  }

  private static Entry head(final Handle handle) {
    return handle
        .createQuery(
            "SELECT id, payload, createdAt, attempts, nextAttemptAt FROM rdf_live_write_queue ORDER BY id LIMIT 1")
        .map(
            (result, context) ->
                new Entry(
                    result.getLong("id"),
                    result.getString("payload"),
                    result.getLong("createdAt"),
                    result.getInt("attempts"),
                    result.getLong("nextAttemptAt")))
        .findOne()
        .orElse(null);
  }

  private record Entry(long id, String payload, long createdAt, int attempts, long nextAttemptAt) {}

  private record QueueHead(long createdAt, int attempts) {}
}
