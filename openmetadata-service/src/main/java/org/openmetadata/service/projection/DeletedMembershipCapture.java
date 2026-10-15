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

import java.util.function.Consumer;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.SqlStatement;

/** PostgreSQL retains exactly the deleted rows without a second lookup of every source key. */
final class DeletedMembershipCapture {
  private DeletedMembershipCapture() {}

  static int execute(
      final Handle handle,
      final long mutationId,
      final Statement statement,
      final Consumer<SqlStatement<?>> bindings) {
    ProjectionJournal.requireTransaction(handle);
    final var capture = handle.createUpdate(statement.sql());
    bindings.accept(capture);
    return capture.bind("projectionMutationId", mutationId).execute();
  }

  record Statement(String table, String columns, String deletion, String returning) {
    String sql() {
      return "WITH projection_deleted ("
          + columns
          + ") AS ("
          + deletion.strip().replaceFirst(";\\s*$", "")
          + " RETURNING "
          + returning
          + ") "
          + "INSERT INTO "
          + table
          + " (mutationId, "
          + columns
          + ") "
          + "SELECT :projectionMutationId, "
          + columns
          + " FROM projection_deleted";
    }
  }
}
