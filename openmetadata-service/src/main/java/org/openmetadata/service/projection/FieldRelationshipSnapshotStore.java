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

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.Query;
import org.jdbi.v3.core.statement.SqlStatement;
import org.jdbi.v3.core.statement.Update;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.FieldRelationshipSnapshot.Endpoint;
import org.openmetadata.service.projection.FieldRelationshipSnapshot.Metadata;

/** Retains field dependencies in SQL so request threads never materialize the full fan-out. */
public final class FieldRelationshipSnapshotStore {
  static final String COLUMNS =
      "fromFQNHash, toFQNHash, fromFQN, toFQN, fromType, toType, relation, jsonSchema, json";
  private final Jdbi jdbi;
  private final ProjectionJournal journal;

  public FieldRelationshipSnapshotStore(final Jdbi jdbi, final ProjectionJournal journal) {
    this.jdbi = Objects.requireNonNull(jdbi);
    this.journal = Objects.requireNonNull(journal);
  }

  long begin(final Handle handle) {
    return journal.capture(handle, new FieldRelationshipMutation(1));
  }

  /** Reads stored rows back, so a key the database coerced is never captured as written. */
  static List<BufferedMembership> read(
      final Handle handle,
      final String selection,
      final Consumer<SqlStatement<?>> bindings,
      final ConnectionType dialect) {
    final Query query = handle.createQuery("SELECT " + COLUMNS + " " + selection);
    bindings.accept(query);
    return query
        .map(
            (row, context) ->
                new BufferedMembership(
                    BufferedMembership.Table.FIELD_RELATIONSHIPS,
                    Arrays.asList(
                        row.getString("fromFQNHash"),
                        row.getString("toFQNHash"),
                        row.getString("fromFQN"),
                        row.getString("toFQN"),
                        row.getString("fromType"),
                        row.getString("toType"),
                        row.getInt("relation"),
                        row.getString("jsonSchema"),
                        new BufferedMembership.JsonText(row.getString("json"), dialect))))
        .list();
  }

  /** Buffers rows a point write left, retained at commit under one header per transaction. */
  void retainRows(final Handle handle, final List<BufferedMembership> rows) {
    journal.captureMembership(handle, rows);
  }

  int deleteReturning(
      final Handle handle,
      final long mutationId,
      final String sql,
      final Consumer<SqlStatement<?>> bindings) {
    return DeletedMembershipCapture.execute(
        handle,
        mutationId,
        new DeletedMembershipCapture.Statement(
            "metadata_projection_field_relationship", COLUMNS, sql, COLUMNS),
        bindings);
  }

  int retain(
      final Handle handle,
      final long mutationId,
      final String selection,
      final Consumer<SqlStatement<?>> bindings) {
    ProjectionJournal.requireTransaction(handle);
    final Update capture =
        handle.createUpdate(
            "INSERT INTO metadata_projection_field_relationship (mutationId, "
                + COLUMNS
                + ") "
                + "SELECT :projectionMutationId, "
                + COLUMNS
                + " "
                + selection
                + " FOR UPDATE");
    bindings.accept(capture);
    return capture.bind("projectionMutationId", mutationId).execute();
  }

  void retainUpdated(
      final Handle handle,
      final long mutationId,
      final String columns,
      final Consumer<SqlStatement<?>> bindings) {
    final Update capture =
        handle.createUpdate(
            "INSERT INTO metadata_projection_field_relationship (mutationId, "
                + COLUMNS
                + ") "
                + "SELECT mutationId, "
                + columns
                + " FROM metadata_projection_field_relationship WHERE mutationId = :projectionMutationId");
    bindings.accept(capture);
    capture.bind("projectionMutationId", mutationId).execute();
  }

  public List<FieldRelationshipSnapshot> page(
      final long mutationId, final long after, final int limit) {
    if (mutationId < 1 || after < 0 || limit < 1 || limit > 1000) {
      throw new IllegalArgumentException(
          "Field relationship pages require a mutation ID, nonnegative cursor and 1 to 1000 rows");
    }
    return List.copyOf(jdbi.withHandle(handle -> readPage(handle, mutationId, after, limit)));
  }

  static List<FieldRelationshipSnapshot> readPage(
      final Handle handle, final long mutationId, final long after, final int limit) {
    return handle
        .createQuery(
            "SELECT * FROM metadata_projection_field_relationship WHERE mutationId = :mutationId AND id > :after ORDER BY id LIMIT :limit")
        .bind("mutationId", mutationId)
        .bind("after", after)
        .bind("limit", limit)
        .map(
            (row, context) ->
                new FieldRelationshipSnapshot(
                    row.getLong("id"),
                    new Endpoint(
                        row.getString("fromFQNHash"),
                        row.getString("fromFQN"),
                        row.getString("fromType")),
                    new Endpoint(
                        row.getString("toFQNHash"),
                        row.getString("toFQN"),
                        row.getString("toType")),
                    row.getInt("relation"),
                    new Metadata(row.getString("jsonSchema"), row.getString("json"))))
        .list();
  }
}
