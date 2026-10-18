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

import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/** Adapts declared DAO statements without copying their business selection or rename expressions. */
final class FieldRelationshipMutationSql {
  private static final Pattern DELETE =
      Pattern.compile("(?is)^DELETE\\s+FROM\\s+field_relationship\\s+(WHERE\\s+.+|<cond>)$");
  private static final Pattern UPDATE =
      Pattern.compile("(?is)^UPDATE\\s+field_relationship\\s+SET\\s+(.+?)\\s+(WHERE\\s+.+)$");
  private static final Pattern UPSERT =
      Pattern.compile(
          "(?is)^(.+) ON (?:DUPLICATE KEY UPDATE|CONFLICT \\(fromFQNHash, toFQNHash, relation\\) DO UPDATE SET) .+$");

  private FieldRelationshipMutationSql() {}

  static String upsertGuard(final String sql, final ConnectionType dialect) {
    final Matcher upsert = UPSERT.matcher(sql);
    if (!upsert.matches()) {
      throw new IllegalArgumentException("Unsupported field relationship upsert: " + sql);
    }
    return upsert.group(1)
        + switch (dialect) {
          case MYSQL -> " ON DUPLICATE KEY UPDATE fromFQNHash = field_relationship.fromFQNHash";
          case POSTGRES -> " ON CONFLICT (fromFQNHash, toFQNHash, relation) DO UPDATE SET fromFQNHash = field_relationship.fromFQNHash";
        };
  }

  static Selection selection(final String sql) {
    final String normalized = sql.strip().replaceFirst(";\\s*$", "").strip();
    final Matcher delete = DELETE.matcher(normalized);
    if (delete.matches()) {
      return new Selection(
          "DELETE FROM field_relationship", "FROM field_relationship " + delete.group(1), null);
    }
    final Matcher update = UPDATE.matcher(normalized);
    if (!update.matches()) {
      throw new IllegalArgumentException("Unsupported field relationship mutation: " + sql);
    }
    return new Selection(
        "UPDATE field_relationship SET " + update.group(1),
        "FROM field_relationship " + update.group(2),
        updatedColumns(update.group(1)));
  }

  private static String updatedColumns(final String assignments) {
    final String[] columns = FieldRelationshipSnapshotStore.COLUMNS.split(", ");
    for (final String assignment : assignments.split(",(?=\\s*\\w+\\s*=)")) {
      final String[] parts = assignment.strip().split("\\s*=\\s*", 2);
      final int index =
          switch (parts[0]) {
            case "toFQNHash" -> 1;
            case "toFQN" -> 3;
            default -> throw new IllegalArgumentException(
                "Unsupported field relationship assignment: " + assignment);
          };
      columns[index] = parts[1];
    }
    return String.join(", ", columns);
  }

  record Selection(String mutation, String selection, String updatedColumns) {}
}
