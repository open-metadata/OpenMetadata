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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;
import org.jdbi.v3.core.statement.StatementContext;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.utils.JsonUtils;

final class CaptureQueryPlan {
  private CaptureQueryPlan() {}

  static String explainRetainedDelete(
      final StatementContext context, final RdfTestDatabase.Backend backend) {
    final String prefix =
        backend == RdfTestDatabase.Backend.MYSQL
            ? "EXPLAIN FORMAT=JSON "
            : "EXPLAIN (FORMAT JSON) ";
    try (final var statement =
        context.getConnection().prepareStatement(prefix + context.getParsedSql().getSql())) {
      final var names = context.getParsedSql().getParameters().getParameterNames();
      for (int index = 0; index < names.size(); index++) {
        context
            .getBinding()
            .findForName(names.get(index), context)
            .orElseThrow()
            .apply(index + 1, statement, context);
      }
      try (final var row = statement.executeQuery()) {
        assertTrue(row.next());
        return row.getString(1);
      }
    } catch (SQLException failure) {
      throw new IllegalStateException("Could not inspect retained-delete query plan", failure);
    }
  }

  static void assertIndexedSourceLookup(
      final String plan, final String table, final int minimumKeyParts) {
    assertTrue(
        !CommonUtil.nullOrEmpty(plan), "The retained source DELETE must have been explained");
    final var source =
        JsonUtils.readTree(plan).findValues("table").stream()
            .filter(node -> table.equals(node.path("table_name").asText()))
            .findFirst()
            .orElseThrow();
    assertTrue(source.path("used_key_parts").size() >= minimumKeyParts, plan);
    assertTrue(source.path("rows_examined_per_scan").asLong(Long.MAX_VALUE) <= 2, plan);
  }
}
