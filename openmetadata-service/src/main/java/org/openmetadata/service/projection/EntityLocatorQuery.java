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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Query;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/** Bounded reads of entity identity and locator on the writer's transaction handle. */
final class EntityLocatorQuery {
  static final int PAGE_SIZE = 100;
  private final String fqnExpression;

  EntityLocatorQuery(final ConnectionType dialect) {
    fqnExpression = fqnExpression(dialect);
  }

  static String fqnExpression(final ConnectionType dialect) {
    return switch (dialect) {
      case MYSQL -> "CASE WHEN JSON_TYPE(JSON_EXTRACT(json, '$.fullyQualifiedName')) = 'STRING' THEN JSON_UNQUOTE(JSON_EXTRACT(json, '$.fullyQualifiedName')) ELSE JSON_UNQUOTE(JSON_EXTRACT(json, '$.name')) END";
      case POSTGRES -> "COALESCE(json->>'fullyQualifiedName', json->>'name')";
    };
  }

  LinkedHashMap<UUID, String> readIds(
      final Handle handle, final Source source, final List<String> ids, final boolean lock) {
    return rows(
        handle
            .createQuery(
                select(source) + " WHERE id IN (<ids>) ORDER BY id" + (lock ? " FOR UPDATE" : ""))
            .bindList("ids", ids));
  }

  private String select(final Source source) {
    return "SELECT id, " + fqnExpression + " AS fqn FROM " + source.table();
  }

  private static LinkedHashMap<UUID, String> rows(final Query query) {
    return query.reduceRows(
        new LinkedHashMap<>(),
        (rows, row) -> {
          rows.put(
              UUID.fromString(row.getColumn("id", String.class)),
              row.getColumn("fqn", String.class));
          return rows;
        });
  }

  record Source(String table, String type) {
    Source {
      if (table == null || !table.matches("[a-z][a-z0-9_]*")) {
        throw new IllegalArgumentException("Invalid entity table: " + table);
      }
      if (type == null || type.isBlank()) {
        throw new IllegalArgumentException("Entity type is required for projection capture");
      }
    }
  }
}
