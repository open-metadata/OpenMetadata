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
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.SqlStatement;
import org.jdbi.v3.sqlobject.Handler;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.RelationshipMutationSql.Candidate;
import org.openmetadata.service.projection.RelationshipMutationSql.Selection;

/** Captures relationship membership on the source SQL object's actual transaction handle. */
public final class RelationshipMutationCapture implements CaptureDecorator {
  private static final String POINT_UPSERT = "insert";
  private static final String ONTOLOGY_UPSERT = "insertOntologyRelationship";
  private static final Set<String> CATALOG_INSERTS =
      Set.of("bulkInsertAllToRelationship", "bulkInsertAllToRelationshipWithExclusions");
  private static final String BULK_VALUES = "bulkInsertTo";
  private static final String INHERITED_INSERT = "addInheritedVia";
  private final RelationshipSnapshotStore snapshots;
  private final RetainedRelationshipWriter writer;
  private final ConnectionType dialect;

  public RelationshipMutationCapture(
      final RelationshipSnapshotStore snapshots, final ConnectionType dialect) {
    this.snapshots = Objects.requireNonNull(snapshots);
    this.dialect = Objects.requireNonNull(dialect);
    this.writer = new RetainedRelationshipWriter(dialect);
  }

  @Override
  public Handler decorateHandler(final Handler base, final Class<?> type, final Method method) {
    if (!EntityRelationshipDAO.class.isAssignableFrom(type) || method.isDefault()) {
      return base;
    }
    if (method.getDeclaringClass() != EntityRelationshipDAO.class) {
      return CaptureWritePolicy.unsupportedWriteOrRead(base, method);
    }
    final String sql = sql(method);
    if (sql.isBlank()) {
      return CaptureWritePolicy.unsupportedWriteOrRead(base, method);
    }
    if (ONTOLOGY_UPSERT.equals(method.getName())) {
      return guardedUpsert(base, method, sql);
    }
    if (POINT_UPSERT.equals(method.getName())) {
      return pointUpsert(guardedUpsert(base, method, sql), buffered(base, this::upserted));
    }
    if (BULK_VALUES.equals(method.getName())) {
      return buffered(base, arguments -> inserted((List<?>) arguments[0]));
    }
    return captureSelection(method, sql, new SqlObjectBindings(method));
  }

  private static Handler pointUpsert(final Handler guarded, final Handler buffered) {
    return (target, arguments, supplier) ->
        (WrittenRelationship.formerRowMayAddDependencies(
                    (String) arguments[2],
                    (String) arguments[3],
                    (Integer) arguments[4],
                    (String) arguments[6])
                ? guarded
                : buffered)
            .invoke(target, arguments, supplier);
  }

  /**
   * Keeps the row's former dependencies as well as its new ones, buffered for commit. On PostgreSQL
   * the capture runs the DAO's statement itself with RETURNING, so the upsert must return nothing.
   */
  private Handler guardedUpsert(final Handler base, final Method method, final String sql) {
    if (dialect == ConnectionType.POSTGRES && method.getReturnType() != void.class) {
      throw new IllegalArgumentException("Guarded relationship upserts must not return a value");
    }
    final SqlObjectBindings bindings = new SqlObjectBindings(method);
    final RelationshipUpsertCapture upserts =
        new RelationshipUpsertCapture(snapshots, dialect, sql);
    return (target, arguments, supplier) ->
        CaptureTransaction.executeBuffered(
            supplier.getHandle(),
            handle ->
                upserts.upsert(
                    handle,
                    statement -> bindings.apply(statement, arguments),
                    () -> base.invoke(target, arguments, supplier)));
  }

  /** Point writes know their own rows: buffer them after the statement instead of reading back. */
  private Handler buffered(
      final Handler base, final Function<Object[], List<WrittenRelationship>> written) {
    return (target, arguments, supplier) ->
        CaptureTransaction.executeBuffered(
            supplier.getHandle(),
            handle -> {
              final Object result = base.invoke(target, arguments, supplier);
              snapshots.retainWritten(handle, written.apply(arguments));
              return result;
            });
  }

  private List<WrittenRelationship> upserted(final Object[] arguments) {
    return List.of(
        new WrittenRelationship(
            (UUID) arguments[0],
            (UUID) arguments[1],
            (String) arguments[2],
            (String) arguments[3],
            (Integer) arguments[4],
            (String) arguments[5]));
  }

  /** The catalog column default for relationType applies to these inserts. */
  private static List<WrittenRelationship> inserted(final List<?> values) {
    return values.stream()
        .map(EntityRelationshipObject.class::cast)
        .map(
            value ->
                new WrittenRelationship(
                    UUID.fromString(value.getFromId()),
                    UUID.fromString(value.getToId()),
                    value.getFromEntity(),
                    value.getToEntity(),
                    value.getRelation(),
                    ""))
        .toList();
  }

  private Handler captureSelection(
      final Method method, final String sql, final SqlObjectBindings bindings) {
    final SelectedMutation mutation = selectedMutation(method, sql);
    return (target, arguments, supplier) ->
        CaptureTransaction.execute(
            supplier.getHandle(),
            handle ->
                mutation.apply(
                    handle,
                    snapshots.begin(handle),
                    statement -> bindings.apply(statement, arguments)));
  }

  private SelectedMutation selectedMutation(final Method method, final String sql) {
    if (CATALOG_INSERTS.contains(method.getName()) || INHERITED_INSERT.equals(method.getName())) {
      final Candidate candidate =
          RelationshipMutationSql.insertion(sql, INHERITED_INSERT.equals(method.getName()));
      return (handle, mutationId, bindings) -> {
        snapshots.retainCandidates(handle, mutationId, candidate, bindings);
        return writer.insert(handle, mutationId, candidate.inherited());
      };
    }
    final boolean delete = sql.regionMatches(true, 0, "DELETE", 0, 6);
    final Selection selection =
        delete ? RelationshipMutationSql.deletion(sql) : RelationshipMutationSql.repoint(sql);
    if (delete && dialect == ConnectionType.POSTGRES) {
      final var deletion = snapshots.deletion(sql, selection.alias());
      return (handle, mutationId, bindings) ->
          snapshots.deleteReturning(handle, mutationId, deletion, bindings);
    }
    return (handle, mutationId, bindings) -> {
      snapshots.retain(handle, mutationId, selection.clause(), selection.alias(), bindings);
      return delete ? writer.delete(handle, mutationId) : repoint(handle, mutationId, bindings);
    };
  }

  private int repoint(
      final Handle handle, final long mutationId, final Consumer<SqlStatement<?>> bindings) {
    final int changed = writer.repoint(handle, mutationId, bindings);
    snapshots.retainRepointed(handle, mutationId, bindings);
    return changed;
  }

  @FunctionalInterface
  private interface SelectedMutation {
    int apply(Handle handle, long mutationId, Consumer<SqlStatement<?>> bindings);
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
