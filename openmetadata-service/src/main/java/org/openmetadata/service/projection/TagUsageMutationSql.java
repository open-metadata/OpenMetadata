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

/** Adapts declared DAO statements; business selection predicates remain in TagUsageDAO. */
final class TagUsageMutationSql {
  private static final Pattern DELETE =
      Pattern.compile("(?is)^DELETE\\s+FROM\\s+tag_usage\\s+(WHERE\\s+.+)$");
  private static final Pattern UPDATE =
      Pattern.compile("(?is)^UPDATE\\s+tag_usage\\s+SET\\s+(.+?)\\s+(WHERE\\s+.+)$");

  private TagUsageMutationSql() {}

  static Selection selection(final String sql) {
    final Matcher delete = DELETE.matcher(sql);
    if (delete.matches()) {
      return new Selection("DELETE FROM tag_usage", "FROM tag_usage " + delete.group(1), null);
    }
    final Matcher update = UPDATE.matcher(sql);
    if (!update.matches()) {
      throw new IllegalArgumentException("Unsupported tag usage mutation: " + sql);
    }
    return new Selection(
        "UPDATE tag_usage SET " + update.group(1),
        "FROM tag_usage " + update.group(2),
        updatedColumns(update.group(1)));
  }

  private static String updatedColumns(final String assignments) {
    // Only these four locator columns can be renamed by the declared DAO statements.
    final String[] columns = {"source", "tagFQN", "tagFQNHash", "targetFQNHash"};
    for (final String assignment : assignments.split(",(?=\\s*\\w+\\s*=)")) {
      final String[] parts = assignment.strip().split("\\s*=\\s*", 2);
      final int index =
          switch (parts[0]) {
            case "tagFQN" -> 1;
            case "tagFQNHash" -> 2;
            case "targetFQNHash" -> 3;
            default -> throw new IllegalArgumentException(
                "Unsupported tag usage assignment: " + assignment);
          };
      columns[index] = parts[1];
    }
    return String.join(", ", columns);
  }

  record Selection(String mutation, String selection, String updatedColumns) {}
}
