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

package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;

@Slf4j
public final class FlowableCharsetMigration {
  private static final String FLOWABLE_COLLATION = "utf8mb4_0900_ai_ci";
  private static final String FLOWABLE_TABLES_TO_ALIGN_QUERY =
      """
      SELECT flowable_table.TABLE_NAME
      FROM information_schema.TABLES AS flowable_table
      WHERE flowable_table.TABLE_SCHEMA = DATABASE()
        AND flowable_table.TABLE_TYPE = 'BASE TABLE'
        AND LEFT(UPPER(flowable_table.TABLE_NAME), 4) = 'ACT_'
        AND EXISTS (
          SELECT 1
          FROM information_schema.TABLES AS candidate_table
          LEFT JOIN information_schema.COLUMNS AS candidate_column
            ON candidate_column.TABLE_SCHEMA = candidate_table.TABLE_SCHEMA
            AND candidate_column.TABLE_NAME = candidate_table.TABLE_NAME
          WHERE candidate_table.TABLE_SCHEMA = DATABASE()
            AND candidate_table.TABLE_TYPE = 'BASE TABLE'
            AND LEFT(UPPER(candidate_table.TABLE_NAME), 4) = 'ACT_'
            AND (
              candidate_table.TABLE_COLLATION <> '%s'
              OR candidate_column.CHARACTER_SET_NAME IN ('utf8', 'utf8mb3')
            )
        )
      ORDER BY flowable_table.TABLE_NAME
      """
          .formatted(FLOWABLE_COLLATION);
  private static final String READ_FOREIGN_KEY_CHECKS = "SELECT @@SESSION.FOREIGN_KEY_CHECKS";
  private static final String DISABLE_FOREIGN_KEY_CHECKS = "SET SESSION FOREIGN_KEY_CHECKS = 0";
  private static final String CONVERT_TABLE_SUFFIX =
      " CONVERT TO CHARACTER SET utf8mb4 COLLATE " + FLOWABLE_COLLATION;

  private FlowableCharsetMigration() {}

  public static int alignFlowableTableCharsets(final Handle handle) {
    final List<String> tableNames = findFlowableTablesToAlign(handle);
    if (!nullOrEmpty(tableNames)) {
      convertTables(handle, tableNames);
    }
    return tableNames.size();
  }

  private static List<String> findFlowableTablesToAlign(final Handle handle) {
    return handle.createQuery(FLOWABLE_TABLES_TO_ALIGN_QUERY).mapTo(String.class).list();
  }

  private static void convertTables(final Handle handle, final List<String> tableNames) {
    final int originalForeignKeyChecks = readForeignKeyChecks(handle);
    try {
      handle.execute(DISABLE_FOREIGN_KEY_CHECKS);
      tableNames.forEach(tableName -> convertTable(handle, tableName));
    } finally {
      restoreForeignKeyChecks(handle, originalForeignKeyChecks);
    }
  }

  private static int readForeignKeyChecks(final Handle handle) {
    return handle.createQuery(READ_FOREIGN_KEY_CHECKS).mapTo(Integer.class).one();
  }

  private static void convertTable(final Handle handle, final String tableName) {
    LOG.info("Aligning Flowable table '{}' to {}", tableName, FLOWABLE_COLLATION);
    handle.execute(conversionStatement(tableName));
  }

  static String conversionStatement(final String tableName) {
    return "ALTER TABLE `" + tableName.replace("`", "``") + "`" + CONVERT_TABLE_SUFFIX;
  }

  private static void restoreForeignKeyChecks(
      final Handle handle, final int originalForeignKeyChecks) {
    handle.execute("SET SESSION FOREIGN_KEY_CHECKS = " + originalForeignKeyChecks);
  }
}
