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

package org.openmetadata.service.projection;

import java.time.Clock;
import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.jdbi.v3.core.statement.SqlStatement;
import org.jdbi.v3.core.statement.Update;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Coalesced obligations for explicit target generations. SQL leases protect bookkeeping only;
 * delivery adapters must fence every remote write with the allocated revision before acknowledging.
 */
public final class ProjectionWorkStore {
  private static final int MAX_INVALIDATION_KEYS = 1000;
  private static final Comparator<Key> KEY_ORDER =
      Comparator.comparing((Key key) -> key.target().name())
          .thenComparing(Key::generation)
          .thenComparing(Key::entityType)
          .thenComparing(key -> key.entityId().toString());
  private final Jdbi jdbi;
  private final Clock clock;
  private final String invalidateSql;

  public ProjectionWorkStore(final Jdbi jdbi, final Clock clock, final ConnectionType dialect) {
    this.jdbi = Objects.requireNonNull(jdbi);
    this.clock = Objects.requireNonNull(clock);
    this.invalidateSql =
        """
        INSERT INTO metadata_projection_work (target, generation, entityType, entityId, dirtyEpoch, pending)
        VALUES (:target, :generation, :type, :entityId, 1, TRUE)
        """
            + switch (dialect) {
              case MYSQL -> "ON DUPLICATE KEY UPDATE dirtyEpoch = dirtyEpoch + 1, pending = TRUE, nextAttemptAt = 0";
              case POSTGRES -> "ON CONFLICT (target, generation, entityType, entityId) DO UPDATE SET dirtyEpoch = metadata_projection_work.dirtyEpoch + 1, pending = TRUE, nextAttemptAt = 0";
            };
  }

  /** Called by dependency expansion, never on the catalog write path. */
  public void invalidate(final Handle transaction, final List<Key> keys) {
    ProjectionJournal.requireTransaction(transaction);
    if (keys.size() > MAX_INVALIDATION_KEYS) {
      throw new IllegalArgumentException(
          "Invalidation pages must contain at most " + MAX_INVALIDATION_KEYS + " keys");
    }
    if (!keys.isEmpty()) {
      final PreparedBatch batch = transaction.prepareBatch(invalidateSql);
      for (final Key key : keys.stream().distinct().sorted(KEY_ORDER).toList()) {
        bindKey(batch, key);
        batch.add();
      }
      batch.execute();
    }
  }

  public List<Claim> claim(
      final ProjectionTarget target,
      final String generation,
      final int limit,
      final Duration lease) {
    ProjectionJournal.validateClaim(limit, lease);
    return jdbi.inTransaction(
        TransactionIsolationLevel.READ_COMMITTED,
        handle -> {
          final long now = clock.millis();
          final UUID token = UUID.randomUUID();
          final List<Claim> claims =
              handle
                  .createQuery(
                      """
          SELECT id, entityType, entityId, dirtyEpoch, writeRevision FROM metadata_projection_work
          WHERE target = :target AND generation = :generation AND pending = TRUE
            AND nextAttemptAt <= :now AND leaseUntil <= :now
          ORDER BY nextAttemptAt, leaseUntil, id LIMIT :limit FOR UPDATE SKIP LOCKED
          """)
                  .bind("target", target.name())
                  .bind("generation", generation)
                  .bind("now", now)
                  .bind("limit", limit)
                  .map(
                      (row, context) ->
                          new Claim(
                              row.getLong("id"),
                              new Key(
                                  target,
                                  generation,
                                  row.getString("entityType"),
                                  UUID.fromString(row.getString("entityId"))),
                              token,
                              row.getLong("dirtyEpoch"),
                              Math.incrementExact(row.getLong("writeRevision"))))
                  .list();
          lease(handle, claims, token, now + lease.toMillis());
          return List.copyOf(claims);
        });
  }

  private static void lease(
      final Handle handle, final List<Claim> claims, final UUID token, final long until) {
    if (!claims.isEmpty()) {
      handle
          .createUpdate(
              """
          UPDATE metadata_projection_work SET leaseToken = :token, leaseUntil = :until,
            writeRevision = writeRevision + 1 WHERE id IN (<ids>)
          """)
          .bind("token", token.toString())
          .bind("until", until)
          .bindList("ids", claims.stream().map(Claim::id).toList())
          .execute();
    }
  }

  public boolean complete(final Claim claim) {
    return jdbi.withHandle(
        handle -> {
          final Update update =
              handle.createUpdate(
                  """
          UPDATE metadata_projection_work SET appliedEpoch = GREATEST(appliedEpoch, :epoch),
            pending = (dirtyEpoch > :epoch), leaseToken = NULL, leaseUntil = 0,
            attempts = 0, nextAttemptAt = 0, lastError = NULL, uncertain = FALSE
          WHERE id = :id AND leaseToken = :token AND leaseUntil > :now AND pending = TRUE
          """);
          bindClaim(update, claim);
          return update.execute() == 1;
        });
  }

  public boolean retry(
      final Claim claim, final String reason, final Duration delay, final boolean uncertain) {
    ProjectionJournal.validateDelay(delay);
    return jdbi.withHandle(
        handle -> {
          final Update update =
              handle.createUpdate(
                  """
          UPDATE metadata_projection_work SET leaseToken = NULL, leaseUntil = 0,
            attempts = CASE WHEN dirtyEpoch > :epoch THEN 0 ELSE LEAST(attempts + 1, 2147483646) END,
            nextAttemptAt = CASE WHEN dirtyEpoch > :epoch THEN 0 ELSE :next END,
            lastError = :reason, uncertain = (uncertain OR :uncertain)
          WHERE id = :id AND leaseToken = :token AND leaseUntil > :now AND pending = TRUE
          """);
          bindClaim(update, claim);
          update
              .bind("next", clock.millis() + delay.toMillis())
              .bind("reason", ProjectionJournal.truncateError(reason))
              .bind("uncertain", uncertain);
          return update.execute() == 1;
        });
  }

  public long pending(final ProjectionTarget target, final String generation) {
    return count(target, generation, false);
  }

  public long uncertain(final ProjectionTarget target, final String generation) {
    return count(target, generation, true);
  }

  private long count(
      final ProjectionTarget target, final String generation, final boolean onlyUncertain) {
    return jdbi.withHandle(
        handle ->
            handle
                .createQuery(
                    """
        SELECT COUNT(*) FROM metadata_projection_work
        WHERE target = :target AND generation = :generation AND pending = TRUE
        """
                        + (onlyUncertain ? " AND uncertain = TRUE" : ""))
                .bind("target", target.name())
                .bind("generation", generation)
                .mapTo(Long.class)
                .one());
  }

  private static void bindKey(final SqlStatement<?> statement, final Key key) {
    statement
        .bind("target", key.target().name())
        .bind("generation", key.generation())
        .bind("type", key.entityType())
        .bind("entityId", key.entityId().toString());
  }

  private void bindClaim(final Update update, final Claim claim) {
    update
        .bind("id", claim.id())
        .bind("token", claim.token().toString())
        .bind("epoch", claim.epoch())
        .bind("now", clock.millis());
  }

  public record Key(ProjectionTarget target, String generation, String entityType, UUID entityId) {
    public Key {
      Objects.requireNonNull(target, "target");
      Objects.requireNonNull(entityId, "entityId");
      requireIdentifier(generation, "generation");
      requireIdentifier(entityType, "entityType");
    }

    private static void requireIdentifier(final String value, final String name) {
      if (value == null || value.isBlank() || value.length() > 128) {
        throw new IllegalArgumentException(name + " must contain 1 to 128 characters");
      }
    }
  }

  public record Claim(long id, Key key, UUID token, long epoch, long revision) {}
}
