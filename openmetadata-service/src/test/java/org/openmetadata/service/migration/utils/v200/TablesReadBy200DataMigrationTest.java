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

package org.openmetadata.service.migration.utils.v200;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

/**
 * An upgrade from below 2.0.0 runs the 2.0.0 Java data migration before the 2.1.0 SQL, and the
 * platform code it calls reads these 2.1.0 tables, so the 2.0.0 SQL creates them too. A database
 * past 2.0.0 gets them from 2.1.0 instead, so both copies must define the same table.
 */
class TablesReadBy200DataMigrationTest {

  private static final List<String> TABLES =
      List.of(
          "test_case_incident",
          "metric_group_entity",
          "change_request",
          "custom_property_reference");
  private static final Pattern LEADING_COMMENTS = Pattern.compile("^(\\s*--[^\\n]*\\n)+");

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void the200SqlCreatesTheTablesExactlyAs210Does(ConnectionType dialect) {
    List<String> createdIn200 = statementsOn(statements("2.0.0", dialect));
    List<String> createdIn210 = statementsOn(statements("2.1.0", dialect));

    assertFalse(createdIn210.isEmpty(), "2.1.0 no longer creates " + TABLES);
    assertEquals(createdIn210, createdIn200);
  }

  private static List<String> statementsOn(List<String> statements) {
    return statements.stream().filter(TablesReadBy200DataMigrationTest::isOnATable).toList();
  }

  private static boolean isOnATable(String statement) {
    return TABLES.stream()
        .anyMatch(
            table ->
                Pattern.compile(
                        "^CREATE (TABLE IF NOT EXISTS|(UNIQUE )?INDEX IF NOT EXISTS \\S+\\s+ON) "
                            + table
                            + " \\(")
                    .matcher(statement)
                    .find());
  }

  private static List<String> statements(String version, ConnectionType dialect) {
    Path file =
        repositoryRoot()
            .resolve("bootstrap/sql/migrations/native")
            .resolve(version)
            .resolve(dialect == ConnectionType.MYSQL ? "mysql" : "postgres")
            .resolve("schemaChanges.sql");
    return MigrationFile.parseSQLFile(file.toFile(), dialect).stream()
        .map(TablesReadBy200DataMigrationTest::withoutLeadingComments)
        .toList();
  }

  // The parser keeps the comment lines that precede a statement, and the two files comment
  // differently.
  private static String withoutLeadingComments(String statement) {
    return LEADING_COMMENTS.matcher(statement).replaceFirst("").strip();
  }

  private static Path repositoryRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve("bootstrap/sql/migrations"))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the OpenMetadata repository root");
    }
    return current;
  }
}
