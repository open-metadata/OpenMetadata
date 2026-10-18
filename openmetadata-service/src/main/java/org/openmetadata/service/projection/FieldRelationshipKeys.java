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

/** Uses the source primary key, including relation but excluding the descriptive endpoint types. */
final class FieldRelationshipKeys {
  private FieldRelationshipKeys() {}

  static void bind(final SqlStatement<?> statement, final List<Key> keys) {
    final StringJoiner tuples = new StringJoiner(",");
    for (int i = 0; i < keys.size(); i++) {
      final Key key = keys.get(i);
      final String prefix = "projectionKey_" + i;
      statement
          .bind(prefix + "_from", key.from())
          .bind(prefix + "_to", key.to())
          .bind(prefix + "_relation", key.relation());
      tuples.add("(:" + prefix + "_from,:" + prefix + "_to,:" + prefix + "_relation)");
    }
    statement.define(
        "projectionKeyPredicate",
        keys.isEmpty() ? "FALSE" : "(fromFQNHash, toFQNHash, relation) IN (" + tuples + ")");
  }

  record Key(String from, String to, int relation) {}
}
