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
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/** Cross-entity extension deletion retains UUIDs in SQL, never extension payloads. */
public final class ExtensionSnapshotStore {
  private final Jdbi jdbi;
  private final ProjectionJournal journal;
  private final ConnectionType dialect;

  public ExtensionSnapshotStore(
      final Jdbi jdbi, final ProjectionJournal journal, final ConnectionType dialect) {
    this.jdbi = Objects.requireNonNull(jdbi);
    this.journal = Objects.requireNonNull(journal);
    this.dialect = Objects.requireNonNull(dialect);
  }

  void delete(final Handle handle, final String extension) {
    final long mutation = journal.capture(handle, new ExtensionMutation(1, null));
    if (dialect == ConnectionType.POSTGRES) {
      DeletedMembershipCapture.execute(
          handle,
          mutation,
          new DeletedMembershipCapture.Statement(
              "metadata_projection_extension",
              "entityId",
              "DELETE FROM entity_extension WHERE extension = :extension",
              "id"),
          statement -> statement.bind("extension", extension));
    } else {
      deleteRetained(handle, mutation, extension);
    }
  }

  private static void deleteRetained(
      final Handle handle, final long mutation, final String extension) {
    handle
        .createUpdate(
            """
        INSERT INTO metadata_projection_extension (mutationId, entityId)
        SELECT :mutation, id FROM entity_extension WHERE extension = :extension FOR UPDATE
        """)
        .bind("mutation", mutation)
        .bind("extension", extension)
        .execute();
    // entity_extension has no index on extension: drive the delete from the retained owners so each
    // row is a primary-key lookup instead of a second scan of the whole table.
    handle
        .createUpdate(
            """
        DELETE e FROM metadata_projection_extension retained STRAIGHT_JOIN entity_extension e
          ON e.id = JSON_UNQUOTE(JSON_QUOTE(retained.entityId)) AND e.extension = :extension
        WHERE retained.mutationId = :mutation
        """)
        .bind("mutation", mutation)
        .bind("extension", extension)
        .execute();
  }

  public List<Owner> page(final long mutationId, final long after, final int limit) {
    if (mutationId < 1 || after < 0 || limit < 1 || limit > 1000) {
      throw new IllegalArgumentException(
          "Extension pages require a mutation ID, nonnegative cursor and 1 to 1000 rows");
    }
    return jdbi.withHandle(
        handle ->
            List.copyOf(
                handle
                    .createQuery(
                        """
        SELECT id, entityId FROM metadata_projection_extension
        WHERE mutationId = :mutation AND id > :after ORDER BY id LIMIT :limit
        """)
                    .bind("mutation", mutationId)
                    .bind("after", after)
                    .bind("limit", limit)
                    .map(
                        (row, context) ->
                            new Owner(
                                row.getLong("id"), UUID.fromString(row.getString("entityId"))))
                    .list()));
  }

  public record Owner(long id, UUID entityId) {}
}
