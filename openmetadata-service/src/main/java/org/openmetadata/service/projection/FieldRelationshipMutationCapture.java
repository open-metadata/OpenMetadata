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

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.SqlStatement;
import org.jdbi.v3.core.statement.Update;
import org.jdbi.v3.sqlobject.Handler;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.FieldRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.FieldRelationshipDAO.FieldRelationship;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.FieldRelationshipKeys.Key;
import org.openmetadata.service.projection.FieldRelationshipMutationSql.Selection;

/** Captures field changes on the DAO's connection, before destructive writes discard dependencies. */
public final class FieldRelationshipMutationCapture implements CaptureDecorator {
  private static final int KEY_PAGE_SIZE = 100;
  private static final String LOCKED = " FOR UPDATE";
  private static final String POINT_SELECTION =
      "FROM field_relationship WHERE fromFQNHash = :fromFQNHash AND toFQNHash = :toFQNHash AND relation = :relation";
  private static final String KEY_SELECTION =
      "FROM field_relationship WHERE <projectionKeyPredicate>";
  private final FieldRelationshipSnapshotStore snapshots;
  private final ConnectionType dialect;
  private final RetainedMembershipWriter writer;

  public FieldRelationshipMutationCapture(
      final FieldRelationshipSnapshotStore snapshots, final ConnectionType dialect) {
    this.snapshots = Objects.requireNonNull(snapshots);
    this.dialect = Objects.requireNonNull(dialect);
    this.writer =
        new RetainedMembershipWriter(RetainedMembershipWriter.Source.FIELD_RELATIONSHIP, dialect);
  }

  @Override
  public Handler decorateHandler(final Handler base, final Class<?> type, final Method method) {
    if (!FieldRelationshipDAO.class.isAssignableFrom(type) || method.isDefault()) {
      return base;
    }
    if (method.getDeclaringClass() != FieldRelationshipDAO.class) {
      return CaptureWritePolicy.unsupportedWriteOrRead(base, method);
    }
    return switch (method.getName()) {
      case "insert" -> pointWrite(base, new SqlObjectBindings(method), null);
      case "upsert" -> pointWrite(
          base,
          new SqlObjectBindings(method),
          FieldRelationshipMutationSql.upsertGuard(sql(method), dialect));
      case "insertMany" -> insertBatch(base);
      default -> selectedMutation(base, method);
    };
  }

  /**
   * Point writes read their stored row back and buffer it for commit, instead of inserting a header
   * and snapshot rows per call. An upsert's guard creates or locks the row first, so its former
   * metadata is read before the write. Reads that follow an applied write poison the transaction
   * if they fail, in place of a savepoint.
   */
  private Handler pointWrite(
      final Handler base, final SqlObjectBindings bindings, final String guardSql) {
    return (target, arguments, supplier) ->
        CaptureTransaction.executeBuffered(
            supplier.getHandle(),
            handle -> {
              final Consumer<SqlStatement<?>> bind =
                  statement -> bindings.apply(statement, arguments);
              final PointWrite source = () -> base.invoke(target, arguments, supplier);
              return guardSql == null
                  ? insertPoint(handle, bind, source)
                  : upsertPoint(handle, bind, guardSql, source);
            });
  }

  private Object insertPoint(
      final Handle handle, final Consumer<SqlStatement<?>> bindings, final PointWrite source)
      throws Exception {
    final Object result = source.execute();
    CaptureTransaction.afterWrite(handle, () -> retainPoint(handle, bindings, List.of()));
    return result;
  }

  /** The guard creates or locks the row, so everything after it runs as post-write capture. */
  private Object upsertPoint(
      final Handle handle,
      final Consumer<SqlStatement<?>> bindings,
      final String guardSql,
      final PointWrite source)
      throws Exception {
    final Update guard = handle.createUpdate(guardSql);
    bindings.accept(guard);
    guard.execute();
    return CaptureTransaction.afterWrite(
        handle,
        () -> {
          final List<BufferedMembership> before = readPoint(handle, bindings, LOCKED);
          final Object result = source.execute();
          retainPoint(handle, bindings, before);
          return result;
        });
  }

  private Void retainPoint(
      final Handle handle,
      final Consumer<SqlStatement<?>> bindings,
      final List<BufferedMembership> before) {
    final List<BufferedMembership> retained = new ArrayList<>(before);
    retained.addAll(readPoint(handle, bindings, ""));
    snapshots.retainRows(handle, retained);
    return null;
  }

  @FunctionalInterface
  private interface PointWrite {
    Object execute() throws Exception;
  }

  private List<BufferedMembership> readPoint(
      final Handle handle, final Consumer<SqlStatement<?>> bindings, final String lock) {
    final List<BufferedMembership> rows =
        FieldRelationshipSnapshotStore.read(handle, POINT_SELECTION + lock, bindings, dialect);
    requireRetainedKeys(rows.size(), 1);
    return rows;
  }

  private Handler insertBatch(final Handler base) {
    return (target, arguments, supplier) -> {
      @SuppressWarnings("unchecked")
      final List<FieldRelationship> rows = (List<FieldRelationship>) arguments[0];
      if (rows.isEmpty()) {
        return null;
      }
      return CaptureTransaction.execute(
          supplier.getHandle(),
          handle -> {
            final Object result = base.invoke(target, arguments, supplier);
            retainBatch(handle, rows);
            return result;
          });
    };
  }

  private void retainBatch(final Handle handle, final List<FieldRelationship> rows) {
    final long mutationId = snapshots.begin(handle);
    for (int offset = 0; offset < rows.size(); offset += KEY_PAGE_SIZE) {
      final List<Key> keys =
          rows.subList(offset, Math.min(rows.size(), offset + KEY_PAGE_SIZE)).stream()
              .map(row -> new Key(row.getFromFQNHash(), row.getToFQNHash(), row.getRelation()))
              .toList();
      final int retained =
          snapshots.retain(
              handle,
              mutationId,
              KEY_SELECTION,
              statement -> FieldRelationshipKeys.bind(statement, keys));
      requireRetainedKeys(retained, keys.stream().distinct().count());
    }
  }

  private static void requireRetainedKeys(final int actual, final long expected) {
    // INSERT IGNORE may coerce invalid keys; committing them would leave an uncaptured source row.
    if (actual != expected) {
      throw new IllegalStateException(
          "Field relationship capture retained " + actual + " of " + expected + " expected keys");
    }
  }

  private Handler selectedMutation(final Handler base, final Method method) {
    final String sql = sql(method);
    if (sql.isBlank()) {
      return CaptureWritePolicy.unsupportedWriteOrRead(base, method);
    }
    final Selection selection = FieldRelationshipMutationSql.selection(sql);
    final SqlObjectBindings bindings = new SqlObjectBindings(method);
    return (target, arguments, supplier) ->
        CaptureTransaction.execute(
            supplier.getHandle(),
            handle -> {
              final long mutationId = snapshots.begin(handle);
              final Consumer<SqlStatement<?>> bind =
                  statement -> bindings.apply(statement, arguments);
              if (selection.updatedColumns() == null && dialect == ConnectionType.POSTGRES) {
                snapshots.deleteReturning(handle, mutationId, sql, bind);
                return null;
              }
              snapshots.retain(handle, mutationId, selection.selection(), bind);
              writer.mutate(handle, mutationId, selection.mutation(), bind);
              if (selection.updatedColumns() != null) {
                snapshots.retainUpdated(handle, mutationId, selection.updatedColumns(), bind);
              }
              return null;
            });
  }

  private String sql(final Method method) {
    return Arrays.stream(method.getAnnotationsByType(ConnectionAwareSqlUpdate.class))
        .filter(annotation -> annotation.connectionType() == dialect)
        .map(ConnectionAwareSqlUpdate::value)
        .findFirst()
        .orElseGet(
            () ->
                method.isAnnotationPresent(SqlUpdate.class)
                    ? method.getAnnotation(SqlUpdate.class).value()
                    : "");
  }
}
