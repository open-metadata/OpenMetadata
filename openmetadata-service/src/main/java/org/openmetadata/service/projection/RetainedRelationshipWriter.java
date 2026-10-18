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
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/** Applies source writes to exactly the locked membership retained by capture. */
final class RetainedRelationshipWriter {
  private final ConnectionType dialect;
  private final RetainedMembershipWriter mutations;

  RetainedRelationshipWriter(final ConnectionType dialect) {
    this.dialect = dialect;
    this.mutations =
        new RetainedMembershipWriter(RetainedMembershipWriter.Source.RELATIONSHIP, dialect);
  }

  int delete(final Handle handle, final long mutationId) {
    return mutations.mutate(handle, mutationId, "DELETE FROM entity_relationship", statement -> {});
  }

  int repoint(
      final Handle handle, final long mutationId, final Consumer<SqlStatement<?>> bindings) {
    return mutations.mutate(
        handle, mutationId, "UPDATE entity_relationship SET fromId = :newFromId", bindings);
  }

  int insert(final Handle handle, final long mutationId, final boolean inherited) {
    ProjectionJournal.requireTransaction(handle);
    final String prefix =
        !inherited && dialect == ConnectionType.MYSQL ? "INSERT IGNORE" : "INSERT";
    final String suffix =
        !inherited && dialect == ConnectionType.POSTGRES ? " ON CONFLICT DO NOTHING" : "";
    final String json =
        inherited
            ? "CAST('{\"inherited\":true}' AS JSON"
                + (dialect == ConnectionType.POSTGRES ? "B)" : ")")
            : "NULL";
    return handle
        .createUpdate(
            prefix
                + " INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation, relationType, json) "
                + "SELECT fromId, toId, fromEntity, toEntity, relation, relationType, "
                + json
                + " FROM metadata_projection_relationship WHERE mutationId = :mutationId"
                + suffix)
        .bind("mutationId", mutationId)
        .execute();
  }
}
