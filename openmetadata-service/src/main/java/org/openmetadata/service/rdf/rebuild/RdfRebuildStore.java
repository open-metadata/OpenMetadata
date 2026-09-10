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
package org.openmetadata.service.rdf.rebuild;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.List;
import java.util.function.Function;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.openmetadata.service.rdf.storage.RdfWriteOutcomeUnknownException;

/** Durable journal and database fences shared by every OpenMetadata server. */
public final class RdfRebuildStore {
  public static final long LEASE_MILLIS = 120_000;
  public static final JournalLimits DEFAULT_LIMITS = new JournalLimits(256L * 1024 * 1024, 100_000);
  public static final String UNCERTAIN_WRITE = "RDF rebuild received an uncertain write outcome";
  private static final String ACTIVE_DATASET =
      "SELECT datasetName FROM rdf_active_dataset WHERE id = 'active'";
  private static final String STATE =
      "SELECT rebuildId, buildDataset, expiresAt, failure FROM rdf_rebuild_state WHERE id = 'active'";

  private final Jdbi jdbi;
  private final Clock clock;
  private final JournalLimits limits;

  public RdfRebuildStore(final Jdbi jdbi, final Clock clock, final JournalLimits limits) {
    this.jdbi = jdbi;
    this.clock = clock;
    this.limits = limits;
  }

  public void initialize(final String configuredDataset) {
    try (Handle handle = jdbi.open()) {
      handle.execute(
          "INSERT INTO rdf_active_dataset (id, datasetName, updatedAt, updatedBy) "
              + "SELECT 'active', ?, ?, 'system' WHERE NOT EXISTS "
              + "(SELECT 1 FROM rdf_active_dataset WHERE id = 'active')",
          configuredDataset,
          clock.millis());
    } catch (UnableToExecuteStatementException exception) {
      // Concurrent startup can win the insert; it must never overwrite an existing promotion.
      if (activeDataset() == null) {
        throw exception;
      }
    }
  }

  public String activeDataset() {
    try (Handle handle = jdbi.open()) {
      return handle.createQuery(ACTIVE_DATASET).mapTo(String.class).findOne().orElse(null);
    }
  }

  public State state() {
    try (Handle handle = jdbi.open()) {
      return state(handle);
    }
  }

  private static State state(final Handle handle) {
    return handle
        .createQuery(STATE)
        .map(
            (result, context) ->
                new State(
                    result.getString("rebuildId"),
                    result.getString("buildDataset"),
                    result.getLong("expiresAt"),
                    result.getString("failure")))
        .findOne()
        .orElse(null);
  }

  public <T> T withActiveLock(final Function<Session, T> action) {
    try (Handle handle = jdbi.open()) {
      return handle.inTransaction(
          TransactionIsolationLevel.READ_COMMITTED,
          transaction -> {
            final String active =
                transaction.createQuery(ACTIVE_DATASET + " FOR UPDATE").mapTo(String.class).one();
            return action.apply(new Session(transaction, active));
          });
    }
  }

  public void withBuildLock(final String rebuildId, final Runnable mutation) {
    try (Handle handle = jdbi.open()) {
      final RuntimeException uncertain =
          handle.inTransaction(
              TransactionIsolationLevel.READ_COMMITTED,
              transaction -> {
                lockBuild(transaction);
                requireOwned(state(transaction), rebuildId);
                try {
                  mutation.run();
                  return null;
                } catch (RuntimeException exception) {
                  if (!RdfWriteOutcomeUnknownException.isPresent(exception)) {
                    throw exception;
                  }
                  // Commit quarantine before releasing the build fence; a waiting cancellation
                  // must not make this dataset eligible for reuse ahead of a late remote write.
                  transaction.execute(
                      "UPDATE rdf_rebuild_state SET failure = ? WHERE id = 'active' AND rebuildId = ?",
                      UNCERTAIN_WRITE,
                      rebuildId);
                  return exception;
                }
              });
      if (uncertain != null) {
        throw uncertain;
      }
    }
  }

  private static void lockBuild(final Handle handle) {
    handle
        .createQuery("SELECT id FROM rdf_rebuild_write_guard WHERE id = 'active' FOR UPDATE")
        .mapTo(String.class)
        .one();
  }

  public boolean append(final String rebuildId, final String payload) {
    final int bytes = payload.getBytes(StandardCharsets.UTF_8).length;
    // A separate connection commits the journal before Fuseki receives the mutation. Rolling back
    // the routing fence after a crash must not erase an already-applied remote write's journal.
    try (Handle handle = jdbi.open()) {
      return handle.inTransaction(transaction -> append(transaction, rebuildId, payload, bytes));
    }
  }

  private boolean append(
      final Handle handle, final String rebuildId, final String payload, final int bytes) {
    final int reserved =
        handle.execute(
            "UPDATE rdf_rebuild_state SET journalBytes = journalBytes + ?, journalRecords = journalRecords + 1 "
                + "WHERE id = 'active' AND rebuildId = ? AND failure IS NULL "
                + "AND journalBytes + ? <= ? AND journalRecords < ?",
            bytes,
            rebuildId,
            bytes,
            limits.maxBytes(),
            limits.maxRecords());
    if (reserved == 0) {
      return false;
    }
    handle.execute(
        "INSERT INTO rdf_rebuild_journal (rebuildId, payload) VALUES (?, ?)", rebuildId, payload);
    return true;
  }

  public List<Entry> page(final String rebuildId, final long after, final int limit) {
    try (Handle handle = jdbi.open()) {
      return handle
          .createQuery(
              "SELECT id, payload FROM rdf_rebuild_journal WHERE rebuildId = :run AND id > :after ORDER BY id LIMIT :limit")
          .bind("run", rebuildId)
          .bind("after", after)
          .bind("limit", limit)
          .map((result, context) -> new Entry(result.getLong("id"), result.getString("payload")))
          .list();
    }
  }

  private State requireOwned(final State state, final String rebuildId) {
    if (state == null || !state.rebuildId().equals(rebuildId)) {
      throw new IllegalStateException("RDF rebuild no longer owns its target dataset");
    }
    if (state.failure() != null || state.expiresAt() <= clock.millis()) {
      throw new IllegalStateException(
          state.failure() != null ? state.failure() : "RDF rebuild lease expired");
    }
    return state;
  }

  public final class Session {
    private final Handle handle;
    private final String activeDataset;

    private Session(final Handle handle, final String activeDataset) {
      this.handle = handle;
      this.activeDataset = activeDataset;
    }

    public String activeDataset() {
      return activeDataset;
    }

    public State state() {
      return RdfRebuildStore.state(handle);
    }

    public State requireOwned(final String rebuildId) {
      return RdfRebuildStore.this.requireOwned(state(), rebuildId);
    }

    public void begin(final String rebuildId, final String target) {
      lockBuild(handle);
      final State previous = state();
      if (previous != null && UNCERTAIN_WRITE.equals(previous.failure())) {
        throw new IllegalStateException(
            "Restart Fuseki and clear the failed RDF rebuild state before reusing a dataset with an uncertain write outcome");
      }
      if (previous != null && previous.failure() == null && previous.expiresAt() > clock.millis()) {
        throw new IllegalStateException("An RDF rebuild already owns a target dataset");
      }
      if (previous != null) {
        remove(previous.rebuildId());
      }
      handle.execute(
          "INSERT INTO rdf_rebuild_state (id, rebuildId, buildDataset, expiresAt) VALUES ('active', ?, ?, ?)",
          rebuildId,
          target,
          clock.millis() + LEASE_MILLIS);
    }

    public void heartbeat(final String rebuildId) {
      requireOwned(rebuildId);
      handle.execute(
          "UPDATE rdf_rebuild_state SET expiresAt = ? WHERE id = 'active' AND rebuildId = ?",
          clock.millis() + LEASE_MILLIS,
          rebuildId);
    }

    public boolean promoteIfCaughtUp(
        final String rebuildId, final long replayedThrough, final String updatedBy) {
      lockBuild(handle);
      final State current = requireOwned(rebuildId);
      final long latest =
          handle
              .createQuery(
                  "SELECT COALESCE(MAX(id), 0) FROM rdf_rebuild_journal WHERE rebuildId = :run")
              .bind("run", rebuildId)
              .mapTo(Long.class)
              .one();
      if (latest > replayedThrough) {
        return false;
      }
      handle.execute(
          "UPDATE rdf_active_dataset SET datasetName = ?, updatedAt = ?, updatedBy = ? WHERE id = 'active'",
          current.buildDataset(),
          clock.millis(),
          updatedBy);
      handle.execute("UPDATE rdf_inference_rule SET dirty = TRUE WHERE deleted = FALSE");
      remove(rebuildId);
      return true;
    }

    public void abort(final String rebuildId, final String reason) {
      lockBuild(handle);
      handle.execute(
          "UPDATE rdf_rebuild_state SET failure = COALESCE(failure, ?) WHERE id = 'active' AND rebuildId = ?",
          reason,
          rebuildId);
      handle.execute("DELETE FROM rdf_rebuild_journal WHERE rebuildId = ?", rebuildId);
    }

    private void remove(final String rebuildId) {
      handle.execute("DELETE FROM rdf_rebuild_journal WHERE rebuildId = ?", rebuildId);
      handle.execute(
          "DELETE FROM rdf_rebuild_state WHERE id = 'active' AND rebuildId = ?", rebuildId);
    }
  }

  public record State(String rebuildId, String buildDataset, long expiresAt, String failure) {}

  public record Entry(long id, String payload) {}

  public record JournalLimits(long maxBytes, long maxRecords) {
    public JournalLimits {
      if (maxBytes <= 0 || maxRecords <= 0) {
        throw new IllegalArgumentException("RDF journal limits must be positive");
      }
    }
  }
}
