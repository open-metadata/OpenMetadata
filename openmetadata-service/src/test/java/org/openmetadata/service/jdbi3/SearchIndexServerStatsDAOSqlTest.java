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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Guards the Postgres upsert used by {@code StageStatsTracker.flush}. A malformed column
 * reference (e.g. {@code search_index_server_statsIreaderWarnings} instead of {@code
 * search_index_server_stats.readerWarnings}) makes Postgres reject every conflicting flush.
 */
class SearchIndexServerStatsDAOSqlTest {
  private static final String TABLE = "search_index_server_stats";
  private static final Pattern ASSIGNMENT =
      Pattern.compile("(\\w+)\\s*=\\s*([\\w.]+)\\s*\\+\\s*EXCLUDED\\.(\\w+)");

  @Test
  void postgresIncrementStatsQualifiesEveryExistingColumnWithTable() {
    String sql = postgresIncrementStatsSql();
    String setClause = sql.substring(sql.indexOf("DO UPDATE SET") + "DO UPDATE SET".length());

    Matcher matcher = ASSIGNMENT.matcher(setClause);
    int assignments = 0;
    while (matcher.find()) {
      assignments++;
      String column = matcher.group(1);
      assertEquals(TABLE + "." + column, matcher.group(2), "Bad existing-value reference");
      assertEquals(column, matcher.group(3), "Bad EXCLUDED reference");
    }
    assertEquals(15, assignments, "Unexpected number of increment assignments: " + setClause);
    assertFalse(
        Pattern.compile(TABLE + "[A-Za-z]").matcher(setClause).find(),
        "Table name must be followed by '.' before a column name: " + setClause);
  }

  private static String postgresIncrementStatsSql() {
    Method method =
        Arrays.stream(SearchReindexDAOs.SearchIndexServerStatsDAO.class.getDeclaredMethods())
            .filter(m -> m.getName().equals("incrementStats"))
            .findFirst()
            .orElse(null);
    assertNotNull(method, "incrementStats not found");
    return Arrays.stream(method.getAnnotationsByType(ConnectionAwareSqlUpdate.class))
        .filter(a -> a.connectionType() == ConnectionType.POSTGRES)
        .map(ConnectionAwareSqlUpdate::value)
        .findFirst()
        .orElseThrow(() -> new AssertionError("No POSTGRES incrementStats query"));
  }
}
