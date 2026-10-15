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

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Query;
import org.jdbi.v3.core.statement.SqlStatement;
import org.jdbi.v3.core.statement.Update;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Captures an upsert whose former row can carry a dependency its arguments do not name, keeping
 * both the row's before and after dependencies. Absent rows are serialized first, so a concurrent
 * insert of the same key cannot slip between the before-image and the write.
 */
final class RelationshipUpsertCapture {
  private static final String SOURCE_TABLE = "entity_relationship";
  private static final Pattern UPSERT =
      Pattern.compile(
          "^(.+) ON (?:DUPLICATE KEY UPDATE|CONFLICT \\(fromId, toId, relation, relationType\\) DO UPDATE SET) .+$",
          Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
  private static final String KEY_SELECTION =
      """
      FROM entity_relationship WHERE fromId = :fromId AND toId = :toId
        AND relation = :relation AND relationType = :relationType
      """;
  private static final String CONFLICT_SELECTION =
      """
      FROM entity_relationship WHERE metricGroupMetricId =
        CASE WHEN :fromEntity = 'metricGroup' AND :toEntity = 'metric' AND :relation = 10
          THEN :toId ELSE NULL END
      """;
  private final RelationshipSnapshotStore snapshots;
  private final ConnectionType dialect;
  private final String sourceSql;
  private final String guardSql;
  private final String conflictSelection;

  RelationshipUpsertCapture(
      final RelationshipSnapshotStore snapshots,
      final ConnectionType dialect,
      final String sourceSql) {
    this.snapshots = snapshots;
    this.dialect = dialect;
    this.sourceSql = sourceSql;
    final Matcher upsert = UPSERT.matcher(sourceSql);
    if (!upsert.matches()) {
      throw new IllegalArgumentException(
          "Relationship upsert requires an explicit capture shape: " + sourceSql);
    }
    guardSql =
        upsert.group(1)
            + switch (dialect) {
              case MYSQL -> " ON DUPLICATE KEY UPDATE fromId = entity_relationship.fromId";
              case POSTGRES -> " ON CONFLICT (fromId, toId, relation, relationType) DO NOTHING RETURNING "
                  + snapshots.dependencyColumns(SOURCE_TABLE);
            };
    conflictSelection =
        dialect == ConnectionType.MYSQL
            ? CONFLICT_SELECTION
                + (sourceSql.contains(":relationshipId")
                    ? " OR relationshipId = :relationshipId"
                    : "")
            : null;
  }

  /**
   * Runs the upsert and buffers its former and current dependencies for commit. PostgreSQL returns
   * them from the statements themselves; MySQL reads them around the source statement.
   */
  Object upsert(
      final Handle handle, final Consumer<SqlStatement<?>> bindings, final SourceStatement source)
      throws Exception {
    return dialect == ConnectionType.POSTGRES
        ? upsertReturning(handle, bindings)
        : upsertReadingAround(handle, bindings, source);
  }

  /**
   * An absent row is inserted with its final values and captured by the same statement. An existing
   * row is locked and read, then updated by the source statement returning its new dependencies.
   * A failure aborts the PostgreSQL transaction, so no step needs a savepoint.
   */
  private Object upsertReturning(final Handle handle, final Consumer<SqlStatement<?>> bindings) {
    final List<BufferedMembership> retained =
        new ArrayList<>(dependencies(handle.createQuery(guardSql), bindings));
    if (retained.isEmpty()) {
      retained.addAll(dependencies(handle.createQuery(lockedSelection(KEY_SELECTION)), bindings));
      retained.addAll(
          dependencies(
              handle.createQuery(
                  sourceSql + " RETURNING " + snapshots.dependencyColumns(SOURCE_TABLE)),
              bindings));
    }
    snapshots.retainRows(handle, retained);
    return null;
  }

  /**
   * MySQL has no RETURNING: lock or create the row, then read it before and after the source. The
   * guard may already have inserted the row, so any later failure poisons the transaction instead
   * of leaving that row to commit without its capture.
   */
  private Object upsertReadingAround(
      final Handle handle, final Consumer<SqlStatement<?>> bindings, final SourceStatement source)
      throws Exception {
    final Update guard = handle.createUpdate(guardSql);
    bindings.accept(guard);
    guard.execute();
    return CaptureTransaction.afterWrite(
        handle, () -> captureAroundSource(handle, bindings, source));
  }

  private Object captureAroundSource(
      final Handle handle, final Consumer<SqlStatement<?>> bindings, final SourceStatement source)
      throws Exception {
    final Located before = lockBefore(handle, bindings);
    final Object result = source.execute();
    final List<BufferedMembership> retained = new ArrayList<>(before.rows());
    retained.addAll(dependencies(handle.createQuery(selection(before.selection())), bindings));
    snapshots.retainRows(handle, retained);
    return result;
  }

  /** MySQL ON DUPLICATE KEY can update a different row through a secondary unique index. */
  private Located lockBefore(final Handle handle, final Consumer<SqlStatement<?>> bindings) {
    final List<BufferedMembership> byKey =
        dependencies(handle.createQuery(lockedSelection(KEY_SELECTION)), bindings);
    if (!byKey.isEmpty()) {
      return new Located(KEY_SELECTION, byKey);
    }
    final List<BufferedMembership> byConflict =
        conflictSelection == null
            ? List.of()
            : dependencies(handle.createQuery(lockedSelection(conflictSelection)), bindings);
    if (byConflict.isEmpty()) {
      throw new IllegalStateException("Relationship upsert encountered an uncaptured unique key");
    }
    return new Located(conflictSelection, byConflict);
  }

  private String selection(final String clause) {
    return "SELECT " + snapshots.dependencyColumns(SOURCE_TABLE) + " " + clause;
  }

  private String lockedSelection(final String clause) {
    return selection(clause) + " FOR UPDATE";
  }

  private List<BufferedMembership> dependencies(
      final Query query, final Consumer<SqlStatement<?>> bindings) {
    bindings.accept(query);
    return RelationshipSnapshotStore.membership(query);
  }

  private record Located(String selection, List<BufferedMembership> rows) {}

  /** The DAO's own statement, executed by the capture once its before-image is in hand. */
  @FunctionalInterface
  interface SourceStatement {
    Object execute() throws Exception;
  }
}
