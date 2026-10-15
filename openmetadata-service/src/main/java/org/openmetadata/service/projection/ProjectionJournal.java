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

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.Update;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.openmetadata.service.util.FullyQualifiedName;

/** Transactional mutation capture and independent, recoverable dependency expansion per target. */
public final class ProjectionJournal {
  private static final int MAX_PAGE_SIZE = 1000;
  private static final int MAX_ERROR_LENGTH = 8192;
  private static final int MAX_CURSOR_LENGTH = 2048;
  private final Jdbi jdbi;
  private final Clock clock;
  private final Set<ProjectionTarget> targets;

  public ProjectionJournal(
      final Jdbi jdbi, final Clock clock, final Set<ProjectionTarget> targets) {
    this.jdbi = Objects.requireNonNull(jdbi);
    this.clock = Objects.requireNonNull(clock);
    this.targets = Set.copyOf(targets);
    if (targets.isEmpty()) {
      throw new IllegalArgumentException("At least one projection target is required");
    }
  }

  /** Capture on the mutation's handle; the caller must let capture failure abort the mutation. */
  public long capture(final Handle transaction, final MutationFacts mutation) {
    return captureAll(transaction, List.of(mutation)).getFirst();
  }

  public List<Long> captureAll(
      final Handle transaction, final List<? extends MutationFacts> mutations) {
    requireTransaction(transaction);
    if (mutations.size() > MAX_PAGE_SIZE) {
      throw new IllegalArgumentException("Capture batches must contain at most 1000 facts");
    }
    if (mutations.isEmpty()) {
      return List.of();
    }
    final List<Long> ids = insertMutations(transaction, mutations);
    final ProjectionCaptureBuffer buffer = ProjectionCapturePlugin.buffer(transaction);
    if (buffer == null) {
      insertConsumers(transaction, ids);
    } else {
      buffer.consumers(this, ids);
    }
    return List.copyOf(ids);
  }

  void captureDeferred(final Handle transaction, final List<? extends MutationFacts> mutations) {
    requireTransaction(transaction);
    ProjectionCapturePlugin.requireBuffer(transaction).append(this, mutations);
  }

  /** Buffers membership rows known from a point write; they share one header per kind at commit. */
  void captureMembership(final Handle transaction, final List<BufferedMembership> rows) {
    requireTransaction(transaction);
    ProjectionCapturePlugin.requireBuffer(transaction).retain(this, rows);
  }

  void persistBuffered(
      final Handle transaction,
      final List<MutationFacts> facts,
      final List<Long> consumers,
      final List<BufferedMembership> membership) {
    requireTransaction(transaction);
    final List<BufferedMembership.Table> tables =
        membership.stream().map(BufferedMembership::table).distinct().toList();
    final List<MutationFacts> mutations = new ArrayList<>(facts);
    tables.forEach(table -> mutations.add(table.header()));
    final List<Long> ids = new ArrayList<>(consumers);
    if (!mutations.isEmpty()) {
      final List<Long> inserted = insertMutations(transaction, mutations);
      ids.addAll(inserted);
      persistMembership(
          transaction, membership, tables, inserted.subList(facts.size(), inserted.size()));
    }
    if (!ids.isEmpty()) {
      insertConsumers(transaction, ids);
    }
  }

  private static void persistMembership(
      final Handle transaction,
      final List<BufferedMembership> membership,
      final List<BufferedMembership.Table> tables,
      final List<Long> headers) {
    for (int index = 0; index < tables.size(); index++) {
      final BufferedMembership.Table table = tables.get(index);
      BufferedMembership.insert(
          transaction,
          table,
          headers.get(index),
          membership.stream().filter(row -> row.table() == table).toList());
    }
  }

  private List<Long> insertMutations(
      final Handle handle, final List<? extends MutationFacts> mutations) {
    final Update insert =
        handle.createUpdate(
            """
        INSERT INTO metadata_projection_mutation
          (mutationType, formatVersion, createdAt, entityType, entityId, operation, beforeFqn, afterFqn,
            beforeFqnHash, afterFqnHash) VALUES
        """
                + valueTuples(mutations.size(), 10));
    for (int row = 0; row < mutations.size(); row++) {
      bindMutation(insert, row * 10, mutations.get(row));
    }
    final List<Long> ids = insert.executeAndReturnGeneratedKeys("id").mapTo(Long.class).list();
    if (ids.size() != mutations.size()) {
      throw new IllegalStateException("Database did not return every captured mutation identifier");
    }
    return ids;
  }

  private void bindMutation(final Update insert, final int offset, final MutationFacts mutation) {
    insert
        .bind(offset, mutation.kind().name())
        .bind(offset + 1, mutation.formatVersion())
        .bind(offset + 2, clock.millis());
    switch (mutation) {
      case EntityMutation entity -> bindEntity(insert, offset + 3, entity);
      case EntityPrefixMutation prefix -> bindPrefix(insert, offset + 3, prefix);
      case RelationshipMutation ignored -> bindMembership(insert, offset);
      case TagUsageMutation ignored -> bindMembership(insert, offset);
      case FieldRelationshipMutation ignored -> bindMembership(insert, offset);
      case ExtensionMutation extension -> {
        bindMembership(insert, offset);
        insert.bind(
            offset + 4, extension.entityId() == null ? null : extension.entityId().toString());
      }
    }
  }

  private static void bindMembership(final Update insert, final int offset) {
    for (int i = 3; i < 10; i++) {
      insert.bindNull(offset + i, Types.VARCHAR);
    }
  }

  private static void bindEntity(
      final Update insert, final int offset, final EntityMutation mutation) {
    insert
        .bind(offset, mutation.entityType())
        .bind(offset + 1, mutation.entityId().toString())
        .bind(offset + 2, mutation.operation().name())
        .bind(offset + 3, mutation.beforeFqn())
        .bind(offset + 4, mutation.afterFqn())
        .bind(offset + 5, FullyQualifiedName.buildHash(mutation.beforeFqn()))
        .bind(offset + 6, FullyQualifiedName.buildHash(mutation.afterFqn()));
  }

  private static void bindPrefix(
      final Update insert, final int offset, final EntityPrefixMutation mutation) {
    insert
        .bind(offset, mutation.entityType())
        .bindNull(offset + 1, Types.VARCHAR)
        .bindNull(offset + 2, Types.VARCHAR)
        .bind(offset + 3, mutation.oldPrefix())
        .bind(offset + 4, mutation.newPrefix())
        .bind(offset + 5, mutation.oldPrefixHash())
        .bind(offset + 6, mutation.newPrefixHash());
  }

  private void insertConsumers(final Handle handle, final List<Long> ids) {
    final Update insert =
        handle.createUpdate(
            "INSERT INTO metadata_projection_consumer (mutationId, target) VALUES "
                + valueTuples(ids.size() * targets.size(), 2));
    int binding = 0;
    for (final long id : ids) {
      for (final ProjectionTarget target : targets) {
        insert.bind(binding++, id).bind(binding++, target.name());
      }
    }
    insert.execute();
  }

  static String valueTuples(final int rows, final int columns) {
    final String tuple = "(" + String.join(",", Collections.nCopies(columns, "?")) + ")";
    return String.join(",", Collections.nCopies(rows, tuple));
  }

  public List<Claim> claim(final ProjectionTarget target, final int limit, final Duration lease) {
    validateClaim(limit, lease);
    return jdbi.inTransaction(
        TransactionIsolationLevel.READ_COMMITTED,
        handle -> {
          final long now = clock.millis();
          final UUID token = UUID.randomUUID();
          final List<Claim> claims = selectClaims(handle, target, limit, now, token);
          if (!claims.isEmpty()) {
            handle
                .createUpdate(
                    """
            UPDATE metadata_projection_consumer SET leaseToken = :token, leaseUntil = :until
            WHERE target = :target AND mutationId IN (<ids>)
            """)
                .bind("token", token.toString())
                .bind("until", now + lease.toMillis())
                .bind("target", target.name())
                .bindList("ids", claims.stream().map(Claim::id).toList())
                .execute();
          }
          return List.copyOf(claims);
        });
  }

  private List<Claim> selectClaims(
      final Handle handle,
      final ProjectionTarget target,
      final int limit,
      final long now,
      final UUID token) {
    // IDs are allocation order, not commit order. Every poll considers all unfinished rows.
    return handle
        .createQuery(
            """
        SELECT m.*, c.cursorValue, c.attempts FROM metadata_projection_consumer c
        JOIN metadata_projection_mutation m ON m.id = c.mutationId
        WHERE c.target = :target AND c.completed = FALSE AND c.nextAttemptAt <= :now AND c.leaseUntil <= :now
        ORDER BY c.nextAttemptAt, c.leaseUntil, c.mutationId LIMIT :limit FOR UPDATE OF c SKIP LOCKED
        """)
        .bind("target", target.name())
        .bind("now", now)
        .bind("limit", limit)
        .map(
            (row, context) ->
                new Claim(
                    row.getLong("id"),
                    target,
                    token,
                    mapMutation(row),
                    row.getString("cursorValue"),
                    row.getInt("attempts")))
        .list();
  }

  private static MutationFacts mapMutation(final ResultSet row) throws SQLException {
    return switch (MutationFacts.Kind.valueOf(row.getString("mutationType"))) {
      case RELATIONSHIPS -> new RelationshipMutation(row.getInt("formatVersion"));
      case TAG_USAGE -> new TagUsageMutation(row.getInt("formatVersion"));
      case FIELD_RELATIONSHIPS -> new FieldRelationshipMutation(row.getInt("formatVersion"));
      case EXTENSIONS -> new ExtensionMutation(
          row.getInt("formatVersion"),
          row.getString("entityId") == null ? null : UUID.fromString(row.getString("entityId")));
      case ENTITY -> new EntityMutation(
          row.getInt("formatVersion"),
          row.getString("entityType"),
          UUID.fromString(row.getString("entityId")),
          EntityMutation.Operation.valueOf(row.getString("operation")),
          row.getString("beforeFqn"),
          row.getString("afterFqn"));
      case ENTITY_PREFIX -> new EntityPrefixMutation(
          row.getInt("formatVersion"),
          row.getString("entityType"),
          row.getString("beforeFqn"),
          row.getString("afterFqn"));
    };
  }

  /** Persist a dependency page and its continuation in the same short SQL transaction. */
  public boolean advance(
      final Claim claim,
      final String cursor,
      final boolean complete,
      final Consumer<Handle> expansion) {
    validateCursor(cursor, complete);
    return jdbi.inTransaction(
        TransactionIsolationLevel.READ_COMMITTED,
        handle -> {
          final boolean ownsClaim = ownsClaim(handle, claim);
          if (ownsClaim) {
            expansion.accept(handle);
            handle.execute(
                """
            UPDATE metadata_projection_consumer SET cursorValue = ?, completed = ?, leaseToken = NULL,
              leaseUntil = 0, attempts = 0, nextAttemptAt = 0, lastError = NULL
            WHERE mutationId = ? AND target = ?
            """,
                cursor,
                complete,
                claim.id(),
                claim.target().name());
          }
          return ownsClaim;
        });
  }

  public boolean retry(final Claim claim, final String reason, final Duration delay) {
    validateDelay(delay);
    return jdbi.inTransaction(
        TransactionIsolationLevel.READ_COMMITTED,
        handle -> {
          final boolean ownsClaim = ownsClaim(handle, claim);
          if (ownsClaim) {
            handle.execute(
                """
            UPDATE metadata_projection_consumer SET leaseToken = NULL, leaseUntil = 0,
              attempts = LEAST(attempts + 1, 2147483646), nextAttemptAt = ?, lastError = ?
            WHERE mutationId = ? AND target = ?
            """,
                clock.millis() + delay.toMillis(),
                truncateError(reason),
                claim.id(),
                claim.target().name());
          }
          return ownsClaim;
        });
  }

  private boolean ownsClaim(final Handle handle, final Claim claim) {
    return handle
        .createQuery(
            """
        SELECT mutationId FROM metadata_projection_consumer
        WHERE mutationId = :id AND target = :target AND completed = FALSE
          AND leaseToken = :token AND leaseUntil > :now FOR UPDATE
        """)
        .bind("id", claim.id())
        .bind("target", claim.target().name())
        .bind("token", claim.token().toString())
        .bind("now", clock.millis())
        .mapTo(Long.class)
        .findOne()
        .isPresent();
  }

  static void requireTransaction(final Handle handle) {
    if (!handle.isInTransaction()) {
      throw new IllegalStateException("Projection capture requires the active catalog transaction");
    }
  }

  static void validateClaim(final int limit, final Duration lease) {
    if (limit < 1
        || limit > MAX_PAGE_SIZE
        || lease.toMillis() < 1
        || lease.compareTo(Duration.ofMinutes(10)) > 0) {
      throw new IllegalArgumentException(
          "Projection claims require 1 to 1000 rows and a lease of 1 ms to 10 minutes");
    }
  }

  static void validateDelay(final Duration delay) {
    if (delay.toMillis() < 1 || delay.compareTo(Duration.ofHours(1)) > 0) {
      throw new IllegalArgumentException("Projection retry delay must be 1 ms to 1 hour");
    }
  }

  static String truncateError(final String error) {
    Objects.requireNonNull(error, "error");
    return error.substring(0, Math.min(error.length(), MAX_ERROR_LENGTH));
  }

  private static void validateCursor(final String cursor, final boolean complete) {
    if ((!complete && (cursor == null || cursor.isBlank()))
        || (cursor != null && cursor.length() > MAX_CURSOR_LENGTH)) {
      throw new IllegalArgumentException(
          "Incomplete expansion requires a bounded continuation cursor");
    }
  }

  public record Claim(
      long id,
      ProjectionTarget target,
      UUID token,
      MutationFacts mutation,
      String cursor,
      int attempts) {}
}
