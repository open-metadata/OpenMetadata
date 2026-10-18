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
import java.util.StringJoiner;
import org.jdbi.v3.core.statement.SqlStatement;

/** Bounded key predicates also retain the nullable legacy rows supported by cleanup. */
final class TagUsageKeys {
  private TagUsageKeys() {}

  static void bind(final SqlStatement<?> statement, final List<Key> keys) {
    final StringJoiner tuples = new StringJoiner(",");
    final StringJoiner nullable = new StringJoiner(" OR ");
    for (int i = 0; i < keys.size(); i++) {
      final Key key = keys.get(i);
      final String prefix = "projectionKey_" + i;
      statement
          .bind(prefix + "_source", key.source())
          .bind(prefix + "_tag", key.tag())
          .bind(prefix + "_target", key.target());
      if (key.tag() == null || key.target() == null) {
        nullable.add(
            "(source = :"
                + prefix
                + "_source AND "
                + nullableEquality("tagFQNHash", prefix + "_tag")
                + " AND "
                + nullableEquality("targetFQNHash", prefix + "_target")
                + ")");
      } else {
        tuples.add("(:" + prefix + "_source,:" + prefix + "_tag,:" + prefix + "_target)");
      }
    }
    final StringJoiner condition = new StringJoiner(" OR ");
    if (tuples.length() > 0) {
      condition.add("(source, tagFQNHash, targetFQNHash) IN (" + tuples + ")");
    }
    if (nullable.length() > 0) {
      condition.add(nullable.toString());
    }
    statement.define(
        "projectionKeyPredicate", condition.length() == 0 ? "FALSE" : condition.toString());
  }

  private static String nullableEquality(final String column, final String parameter) {
    return "("
        + column
        + " = :"
        + parameter
        + " OR ("
        + column
        + " IS NULL AND CAST(:"
        + parameter
        + " AS CHAR) IS NULL))";
  }

  record Key(int source, String tag, String target) {}
}
