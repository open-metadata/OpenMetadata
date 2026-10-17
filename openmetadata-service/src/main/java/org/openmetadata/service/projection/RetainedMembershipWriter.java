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
import java.util.stream.IntStream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.SqlStatement;
import org.jdbi.v3.core.statement.Update;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/** Changes exactly the locked retained keys without transferring a large dependency set to Java. */
final class RetainedMembershipWriter {
  enum Source {
    RELATIONSHIP(
        "entity_relationship",
        "relationship",
        List.of("fromId", "toId", "relation", "relationType")),
    TAG_USAGE("tag_usage", "tag_usage", List.of("source", "tagFQNHash", "targetFQNHash")),
    FIELD_RELATIONSHIP(
        "field_relationship",
        "field_relationship",
        List.of("fromFQNHash", "toFQNHash", "relation"));

    private final String table;
    private final String retainedTable;
    private final List<String> keys;

    Source(final String table, final String retained, final List<String> keys) {
      this.table = table;
      this.retainedTable = "metadata_projection_" + retained;
      this.keys = keys;
    }
  }

  private final Source source;
  private final ConnectionType dialect;

  RetainedMembershipWriter(final Source source, final ConnectionType dialect) {
    this.source = source;
    this.dialect = dialect;
  }

  int mutate(
      final Handle handle,
      final long mutationId,
      final String mutation,
      final Consumer<SqlStatement<?>> bindings) {
    ProjectionJournal.requireTransaction(handle);
    int changed = execute(handle, mutationId, sql(mutation, 0), bindings);
    if (dialect == ConnectionType.POSTGRES
        && source == Source.TAG_USAGE
        && hasNullKeys(handle, mutationId)) {
      for (int nullKeys = 1; nullKeys < 4; nullKeys++) {
        changed =
            Math.addExact(changed, execute(handle, mutationId, sql(mutation, nullKeys), bindings));
      }
    }
    return changed;
  }

  private static int execute(
      final Handle handle,
      final long mutationId,
      final String sql,
      final Consumer<SqlStatement<?>> bindings) {
    final Update update = handle.createUpdate(sql).bind("projectionMutationId", mutationId);
    bindings.accept(update);
    return update.execute();
  }

  private boolean hasNullKeys(final Handle handle, final long mutationId) {
    return handle
        .createQuery(
            "SELECT 1 FROM metadata_projection_tag_usage WHERE mutationId = :id "
                + "AND (tagFQNHash IS NULL OR targetFQNHash IS NULL) LIMIT 1")
        .bind("id", mutationId)
        .mapTo(Integer.class)
        .findOne()
        .isPresent();
  }

  private String sql(final String mutation, final int nullKeys) {
    final String retained = "(" + retainedKeys(nullKeys) + ") retained";
    final String match = keyMatch(nullKeys);
    final boolean delete = mutation.equals("DELETE FROM " + source.table);
    if (dialect == ConnectionType.POSTGRES) {
      return mutation + (delete ? " USING " : " FROM ") + retained + " WHERE " + match;
    }
    return delete
        ? "DELETE " + source.table + " FROM " + source.table + " JOIN " + retained + " ON " + match
        : "UPDATE "
            + source.table
            + " JOIN "
            + retained
            + " ON "
            + match
            + " SET "
            + mutation.substring(("UPDATE " + source.table + " SET ").length());
  }

  private String retainedKeys(final int nullKeys) {
    final String columns =
        String.join(
            ", ",
            IntStream.range(0, source.keys.size())
                .mapToObj(index -> source.keys.get(index) + " AS projectionKey" + index)
                .toList());
    return "SELECT "
        + columns
        + " FROM "
        + source.retainedTable
        + " WHERE mutationId = :projectionMutationId"
        + nullableSelection(nullKeys);
  }

  private String nullableSelection(final int nullKeys) {
    if (dialect != ConnectionType.POSTGRES || source != Source.TAG_USAGE) {
      return "";
    }
    return " AND tagFQNHash IS "
        + ((nullKeys & 1) == 0 ? "NOT " : "")
        + "NULL"
        + " AND targetFQNHash IS "
        + ((nullKeys & 2) == 0 ? "NOT " : "")
        + "NULL";
  }

  private String keyMatch(final int nullKeys) {
    final List<String> predicates = new ArrayList<>();
    for (int index = 0; index < source.keys.size(); index++) {
      final String column = source.table + "." + source.keys.get(index);
      final boolean nullable = source == Source.TAG_USAGE && index > 0;
      predicates.add(
          dialect == ConnectionType.POSTGRES && nullable && (nullKeys & (1 << (index - 1))) != 0
              ? column + " IS NULL"
              : column
                  + (dialect == ConnectionType.MYSQL && nullable ? " <=> " : " = ")
                  + retainedKey(index));
    }
    return String.join(" AND ", predicates);
  }

  private String retainedKey(final int index) {
    final String key = "retained.projectionKey" + index;
    // JSON's string round-trip gives the value literal coercibility: the source column's
    // collation wins without converting its indexed key. A binary cast forces prefix scans.
    // Tag/field hashes already share the ascii_bin collation from their source migrations.
    return dialect == ConnectionType.MYSQL && source == Source.RELATIONSHIP && index != 2
        ? "JSON_UNQUOTE(JSON_QUOTE(" + key + "))"
        : key;
  }
}
