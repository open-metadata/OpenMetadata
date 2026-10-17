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

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlStatement;
import org.jdbi.v3.core.statement.Update;

/** Captures membership in SQL without loading a glossary's asset fan-out on the request thread. */
public final class TagUsageSnapshotStore {
  private static final String COLUMNS = "source, tagFQN, tagFQNHash, targetFQNHash";
  private final Jdbi jdbi;
  private final ProjectionJournal journal;

  public TagUsageSnapshotStore(final Jdbi jdbi, final ProjectionJournal journal) {
    this.jdbi = Objects.requireNonNull(jdbi);
    this.journal = Objects.requireNonNull(journal);
  }

  long begin(final Handle handle) {
    return journal.capture(handle, new TagUsageMutation(1));
  }

  /** Buffers usage a point write applied; its unique key cannot redirect it to another row. */
  void retainWritten(final Handle handle, final List<BufferedMembership> rows) {
    journal.captureMembership(handle, rows);
  }

  static BufferedMembership written(
      final int source, final String tagFqn, final String tagFqnHash, final String targetFqnHash) {
    return new BufferedMembership(
        BufferedMembership.Table.TAG_USAGE, List.of(source, tagFqn, tagFqnHash, targetFqnHash));
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
            "metadata_projection_tag_usage", COLUMNS, sql, COLUMNS),
        bindings);
  }

  void retain(
      final Handle handle,
      final long mutationId,
      final String selection,
      final Consumer<SqlStatement<?>> bindings) {
    ProjectionJournal.requireTransaction(handle);
    final Update capture =
        handle.createUpdate(
            "INSERT INTO metadata_projection_tag_usage (mutationId, "
                + COLUMNS
                + ") "
                + "SELECT :projectionMutationId, "
                + COLUMNS
                + " "
                + selection
                + " FOR UPDATE");
    bindings.accept(capture);
    capture.bind("projectionMutationId", mutationId).execute();
  }

  void retainUpdated(
      final Handle handle,
      final long mutationId,
      final String columns,
      final Consumer<SqlStatement<?>> bindings) {
    final Update capture =
        handle.createUpdate(
            "INSERT INTO metadata_projection_tag_usage (mutationId, "
                + COLUMNS
                + ") "
                + "SELECT mutationId, "
                + columns
                + " FROM metadata_projection_tag_usage WHERE mutationId = :projectionMutationId");
    bindings.accept(capture);
    capture.bind("projectionMutationId", mutationId).execute();
  }

  public List<TagUsageSnapshot> page(final long mutationId, final long after, final int limit) {
    validatePage(mutationId, after, limit);
    return List.copyOf(jdbi.withHandle(handle -> readPage(handle, mutationId, after, limit)));
  }

  static List<TagUsageSnapshot> readPage(
      final Handle handle, final long mutationId, final long after, final int limit) {
    return handle
        .createQuery(
            "SELECT * FROM metadata_projection_tag_usage WHERE mutationId = :mutationId AND id > :after ORDER BY id LIMIT :limit")
        .bind("mutationId", mutationId)
        .bind("after", after)
        .bind("limit", limit)
        .map(
            (row, context) ->
                new TagUsageSnapshot(
                    row.getLong("id"),
                    row.getInt("source"),
                    row.getString("tagFQN"),
                    row.getString("tagFQNHash"),
                    row.getString("targetFQNHash")))
        .list();
  }

  private static void validatePage(final long mutationId, final long after, final int limit) {
    if (mutationId < 1 || after < 0 || limit < 1 || limit > 1000) {
      throw new IllegalArgumentException(
          "Tag usage pages require a mutation ID, nonnegative cursor and 1 to 1000 rows");
    }
  }
}
