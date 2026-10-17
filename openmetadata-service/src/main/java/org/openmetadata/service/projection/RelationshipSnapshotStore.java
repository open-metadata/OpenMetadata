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
import java.util.UUID;
import java.util.function.Consumer;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.Query;
import org.jdbi.v3.core.statement.SqlStatement;
import org.jdbi.v3.core.statement.Update;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.RelationshipMutationSql.Candidate;
import org.openmetadata.service.projection.RelationshipSnapshot.Endpoint;
import org.openmetadata.service.projection.RelationshipSnapshot.RelatedIds;
import org.openmetadata.service.projection.RelationshipSnapshot.Relation;

/** Retains affected membership in SQL, then exposes bounded immutable pages to dependency rules. */
public final class RelationshipSnapshotStore {
  private static final String SOURCE_COLUMNS =
      "fromId, toId, fromEntity, toEntity, relation, relationType, relationshipId, relationshipTypeId, pipelineId";
  private static final String COLUMNS = "mutationId, " + SOURCE_COLUMNS;
  private final Jdbi jdbi;
  private final ProjectionJournal journal;
  private final ConnectionType dialect;

  public RelationshipSnapshotStore(
      final Jdbi jdbi, final ProjectionJournal journal, final ConnectionType dialect) {
    this.jdbi = Objects.requireNonNull(jdbi);
    this.journal = Objects.requireNonNull(journal);
    this.dialect = Objects.requireNonNull(dialect);
  }

  long begin(final Handle transaction) {
    return journal.capture(transaction, new RelationshipMutation(1));
  }

  int deleteReturning(
      final Handle handle,
      final long mutationId,
      final DeletedMembershipCapture.Statement statement,
      final Consumer<SqlStatement<?>> bindings) {
    return DeletedMembershipCapture.execute(handle, mutationId, statement, bindings);
  }

  DeletedMembershipCapture.Statement deletion(final String sql, final String alias) {
    return new DeletedMembershipCapture.Statement(
        "metadata_projection_relationship", SOURCE_COLUMNS, sql, projectionColumns(alias));
  }

  int retain(
      final Handle transaction,
      final long mutationId,
      final String selection,
      final String alias,
      final Consumer<SqlStatement<?>> bindings) {
    ProjectionJournal.requireTransaction(transaction);
    final Update capture =
        transaction.createUpdate(
            "INSERT INTO metadata_projection_relationship ("
                + COLUMNS
                + ") SELECT :projectionMutationId, "
                + projectionColumns(alias)
                + " "
                + selection
                + lock(alias));
    bindings.accept(capture);
    return capture.bind("projectionMutationId", mutationId).execute();
  }

  int retainCandidates(
      final Handle transaction,
      final long mutationId,
      final Candidate candidate,
      final Consumer<SqlStatement<?>> bindings) {
    ProjectionJournal.requireTransaction(transaction);
    final Update capture =
        transaction.createUpdate(
            "INSERT INTO metadata_projection_relationship ("
                + COLUMNS
                + ") SELECT :projectionMutationId, "
                + candidate.fromExpression()
                + ", "
                + candidate.toExpression()
                + ", :fromEntity, :toEntity, :relation, '', NULL, NULL, NULL "
                + candidate.selection().clause()
                + lock(candidate.selection().alias()));
    bindings.accept(capture);
    return capture.bind("projectionMutationId", mutationId).execute();
  }

  void retainRepointed(
      final Handle transaction, final long mutationId, final Consumer<SqlStatement<?>> bindings) {
    ProjectionJournal.requireTransaction(transaction);
    final Update capture =
        transaction.createUpdate(
            "INSERT INTO metadata_projection_relationship ("
                + COLUMNS
                + ") "
                + "SELECT mutationId, :newFromId, toId, fromEntity, toEntity, relation, relationType, "
                + "relationshipId, relationshipTypeId, pipelineId FROM metadata_projection_relationship WHERE mutationId = :mutationId");
    bindings.accept(capture);
    capture.bind("mutationId", mutationId).execute();
  }

  /** Buffers rows a point write determined from its own arguments, retained at commit. */
  void retainWritten(final Handle transaction, final List<WrittenRelationship> rows) {
    retainRows(transaction, rows.stream().map(WrittenRelationship::membership).toList());
  }

  /** Buffers membership a guarded upsert read or returned, retained at commit. */
  void retainRows(final Handle transaction, final List<BufferedMembership> rows) {
    journal.captureMembership(transaction, rows);
  }

  /** The retained dependency columns of {@code alias}, in snapshot column order. */
  String dependencyColumns(final String alias) {
    return projectionColumns(alias);
  }

  /** Maps rows selected or returned with {@link #dependencyColumns} to buffered membership. */
  static List<BufferedMembership> membership(final Query query) {
    return query
        .map(
            (row, context) ->
                new BufferedMembership(
                    BufferedMembership.Table.RELATIONSHIPS,
                    Arrays.asList(
                        row.getString(1),
                        row.getString(2),
                        row.getString(3),
                        row.getString(4),
                        row.getInt(5),
                        row.getString(6),
                        row.getString(7),
                        row.getString(8),
                        row.getString(9))))
        .list();
  }

  private String lock(final String alias) {
    return dialect == ConnectionType.POSTGRES ? " FOR UPDATE OF " + alias : " FOR UPDATE";
  }

  private String projectionColumns(final String alias) {
    final String pipeline =
        switch (dialect) {
          case POSTGRES -> alias + ".json->'pipeline'->>'id'";
          case MYSQL -> "CASE WHEN JSON_TYPE(JSON_EXTRACT("
              + alias
              + ".json, '$.pipeline.id')) = 'STRING' THEN JSON_UNQUOTE(JSON_EXTRACT("
              + alias
              + ".json, '$.pipeline.id')) ELSE NULL END";
        };
    return alias
        + ".fromId, "
        + alias
        + ".toId, "
        + alias
        + ".fromEntity, "
        + alias
        + ".toEntity, "
        + alias
        + ".relation, "
        + alias
        + ".relationType, "
        + alias
        + ".relationshipId, "
        + alias
        + ".relationshipTypeId, "
        + pipeline;
  }

  public List<RelationshipSnapshot> page(final long mutationId, final long after, final int limit) {
    if (mutationId < 1 || after < 0 || limit < 1 || limit > 1000) {
      throw new IllegalArgumentException(
          "Relationship pages require a mutation ID, nonnegative cursor and 1 to 1000 rows");
    }
    return List.copyOf(jdbi.withHandle(handle -> readPage(handle, mutationId, after, limit)));
  }

  private static List<RelationshipSnapshot> readPage(
      final Handle handle, final long mutationId, final long after, final int limit) {
    return handle
        .createQuery(
            """
        SELECT * FROM metadata_projection_relationship
        WHERE mutationId = :mutationId AND id > :after ORDER BY id LIMIT :limit
        """)
        .bind("mutationId", mutationId)
        .bind("after", after)
        .bind("limit", limit)
        .map(
            (row, context) ->
                new RelationshipSnapshot(
                    row.getLong("id"),
                    new Endpoint(
                        UUID.fromString(row.getString("fromId")), row.getString("fromEntity")),
                    new Endpoint(UUID.fromString(row.getString("toId")), row.getString("toEntity")),
                    new Relation(row.getInt("relation"), row.getString("relationType")),
                    new RelatedIds(
                        uuid(row.getString("relationshipId")),
                        uuid(row.getString("relationshipTypeId")),
                        uuid(row.getString("pipelineId")))))
        .list();
  }

  private static UUID uuid(final String value) {
    return value == null ? null : UUID.fromString(value);
  }
}
