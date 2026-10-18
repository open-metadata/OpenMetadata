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
import java.util.function.Function;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.SqlStatement;
import org.jdbi.v3.sqlobject.Handler;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.TagUsageKeys.Key;
import org.openmetadata.service.projection.TagUsageMutationSql.Selection;
import org.openmetadata.service.util.FullyQualifiedName;

/** Captures current-schema tag writes on the DAO's actual transaction, before destructive cleanup. */
public final class TagUsageMutationCapture implements CaptureDecorator {
  private static final String KEY_SELECTION = "FROM tag_usage WHERE <projectionKeyPredicate>";
  private static final int KEY_PAGE_SIZE = 100;
  private final TagUsageSnapshotStore snapshots;
  private final ConnectionType dialect;
  private final RetainedMembershipWriter writer;

  public TagUsageMutationCapture(
      final TagUsageSnapshotStore snapshots, final ConnectionType dialect) {
    this.snapshots = Objects.requireNonNull(snapshots);
    this.dialect = Objects.requireNonNull(dialect);
    this.writer = new RetainedMembershipWriter(RetainedMembershipWriter.Source.TAG_USAGE, dialect);
  }

  @Override
  public Handler decorateHandler(final Handler base, final Class<?> type, final Method method) {
    if (!TagUsageDAO.class.isAssignableFrom(type) || method.isDefault()) {
      return base;
    }
    if (method.getDeclaringClass() != TagUsageDAO.class) {
      return CaptureWritePolicy.unsupportedWriteOrRead(base, method);
    }
    return switch (method.getName()) {
      case "applyTag" -> buffered(
          base, CaptureTransaction::executeBuffered, TagUsageMutationCapture::applied);
        // A JDBC batch can apply some rows before another fails; its savepoint undoes them.
      case "applyTagsBatchInternal" -> buffered(
          base, CaptureTransaction::execute, TagUsageMutationCapture::appliedBatch);
      case "deleteTagsBatchInternal" -> deleteBatch();
        // This migration-only statement references targetFQN, removed from the schema in 1.1.
      case "upsertFQNHash" -> base;
      default -> selectedMutation(base, method);
    };
  }

  /** Applied usage is fully named by the call, so capture buffers it instead of reading it back. */
  private Handler buffered(
      final Handler base,
      final CaptureTransaction.Boundary boundary,
      final Function<Object[], List<BufferedMembership>> written) {
    return (target, arguments, supplier) ->
        boundary.run(
            supplier.getHandle(),
            handle -> {
              final Object result = base.invoke(target, arguments, supplier);
              snapshots.retainWritten(handle, written.apply(arguments));
              return result;
            });
  }

  /** {@code applyTag} binds both locators through {@code @BindFQN}, which hashes them. */
  private static List<BufferedMembership> applied(final Object[] arguments) {
    return List.of(
        TagUsageSnapshotStore.written(
            (Integer) arguments[0],
            (String) arguments[1],
            FullyQualifiedName.buildHash((String) arguments[2]),
            FullyQualifiedName.buildHash((String) arguments[3])));
  }

  private static List<BufferedMembership> appliedBatch(final Object[] arguments) {
    final List<BufferedMembership> rows = new ArrayList<>();
    for (int row = 0; row < batchSize(arguments); row++) {
      rows.add(
          TagUsageSnapshotStore.written(
              (Integer) ((List<?>) arguments[0]).get(row),
              (String) ((List<?>) arguments[1]).get(row),
              (String) ((List<?>) arguments[2]).get(row),
              (String) ((List<?>) arguments[3]).get(row)));
    }
    return rows;
  }

  private static int batchSize(final Object[] arguments) {
    return Arrays.stream(arguments)
        .mapToInt(argument -> ((List<?>) argument).size())
        .min()
        .orElseThrow();
  }

  private Handler deleteBatch() {
    return (target, arguments, supplier) ->
        CaptureTransaction.execute(
            supplier.getHandle(),
            handle -> {
              final long mutationId = retainDeletedBatch(handle, arguments);
              return mutationId == 0
                  ? 0
                  : writer.mutate(handle, mutationId, "DELETE FROM tag_usage", statement -> {});
            });
  }

  private long retainDeletedBatch(final Handle handle, final Object[] arguments) {
    final int size = batchSize(arguments);
    if (size == 0) {
      return 0;
    }
    final long mutationId = snapshots.begin(handle);
    for (int offset = 0; offset < size; offset += KEY_PAGE_SIZE) {
      final List<Key> keys = new ArrayList<>();
      for (int i = offset; i < Math.min(size, offset + KEY_PAGE_SIZE); i++) {
        keys.add(
            new Key(
                (Integer) ((List<?>) arguments[0]).get(i),
                (String) ((List<?>) arguments[1]).get(i),
                (String) ((List<?>) arguments[2]).get(i)));
      }
      snapshots.retain(
          handle, mutationId, KEY_SELECTION, statement -> TagUsageKeys.bind(statement, keys));
    }
    return mutationId;
  }

  private Handler selectedMutation(final Handler base, final Method method) {
    final String sql = sql(method);
    if (sql.isBlank()) {
      return CaptureWritePolicy.unsupportedWriteOrRead(base, method);
    }
    final Selection selection = TagUsageMutationSql.selection(sql);
    final SqlObjectBindings bindings = new SqlObjectBindings(method);
    return (target, arguments, supplier) ->
        CaptureTransaction.execute(
            supplier.getHandle(),
            handle -> {
              final long mutationId = snapshots.begin(handle);
              final Consumer<SqlStatement<?>> bind =
                  statement -> bindings.apply(statement, arguments);
              if (selection.updatedColumns() == null && dialect == ConnectionType.POSTGRES) {
                return snapshots.deleteReturning(handle, mutationId, sql, bind);
              }
              snapshots.retain(handle, mutationId, selection.selection(), bind);
              final int changed = writer.mutate(handle, mutationId, selection.mutation(), bind);
              if (selection.updatedColumns() != null) {
                snapshots.retainUpdated(handle, mutationId, selection.updatedColumns(), bind);
              }
              return changed;
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
