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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.openmetadata.service.migration.utils.MigrationFile;

class FlowableCharsetMigrationTest {
  private static final String OPENMETADATA_DATABASE_DDL =
      "CREATE DATABASE openmetadata_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;";
  private static final String IDEMPOTENT_OPENMETADATA_DATABASE_DDL =
      "CREATE DATABASE IF NOT EXISTS openmetadata_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;";
  private static final String ALTER_CURRENT_DATABASE =
      "ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";

  @Test
  void mysqlBootstrapUsesAnExplicitUtf8mb4Default() throws IOException {
    assertContains(
        repositoryRoot().resolve("docker/mysql/mysql-script.sql"), OPENMETADATA_DATABASE_DDL);
    assertContains(
        repositoryRoot().resolve("docker/development/distributed-test/config/mysql-init.sql"),
        IDEMPOTENT_OPENMETADATA_DATABASE_DDL);
  }

  @Test
  void mysqlUpgradeChangesTheCurrentDatabaseDefault() {
    final Path schemaChanges =
        repositoryRoot().resolve("bootstrap/sql/migrations/native/2.1.0/mysql/schemaChanges.sql");

    final List<String> statements = MigrationFile.parseSQLFile(schemaChanges.toFile(), MYSQL);

    assertTrue(statements.getLast().endsWith(ALTER_CURRENT_DATABASE), statements.getLast());
  }

  @Test
  void convertsEveryFlowableTableWhenAnyTableNeedsAlignment() {
    final Handle handle = handleWithTables(List.of("ACT_GE_BYTEARRAY", "ACT_RE_DEPLOYMENT"), 1);

    final int converted = FlowableCharsetMigration.alignFlowableTableCharsets(handle);

    assertEquals(2, converted);
    final InOrder statements = inOrder(handle);
    statements.verify(handle).execute("SET SESSION FOREIGN_KEY_CHECKS = 0");
    statements.verify(handle).execute(conversionStatement("ACT_GE_BYTEARRAY"));
    statements.verify(handle).execute(conversionStatement("ACT_RE_DEPLOYMENT"));
    statements.verify(handle).execute("SET SESSION FOREIGN_KEY_CHECKS = 1");
  }

  @Test
  void restoresTheOriginalForeignKeySettingWhenConversionFails() {
    final Handle handle = handleWithTables(List.of("ACT_GE_BYTEARRAY"), 1);
    when(handle.execute(conversionStatement("ACT_GE_BYTEARRAY")))
        .thenThrow(new IllegalStateException("conversion failed"));

    assertThrows(
        IllegalStateException.class,
        () -> FlowableCharsetMigration.alignFlowableTableCharsets(handle));

    verify(handle).execute("SET SESSION FOREIGN_KEY_CHECKS = 1");
  }

  @Test
  void preservesAnAlreadyDisabledForeignKeySetting() {
    final Handle handle = handleWithTables(List.of("ACT_GE_BYTEARRAY"), 0);

    FlowableCharsetMigration.alignFlowableTableCharsets(handle);

    verify(handle, times(2)).execute("SET SESSION FOREIGN_KEY_CHECKS = 0");
  }

  @Test
  void skipsSessionChangesWhenEveryFlowableTableIsAlreadyUtf8mb4() {
    final Handle handle = handleWithTables(List.of(), 1);

    assertEquals(0, FlowableCharsetMigration.alignFlowableTableCharsets(handle));

    verify(handle, never()).execute(anyString());
  }

  private static Handle handleWithTables(
      final List<String> tableNames, final int foreignKeyChecks) {
    final Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(anyString()).mapTo(String.class).list()).thenReturn(tableNames);
    when(handle.createQuery("SELECT @@SESSION.FOREIGN_KEY_CHECKS").mapTo(Integer.class).one())
        .thenReturn(foreignKeyChecks);
    return handle;
  }

  private static String conversionStatement(final String tableName) {
    return "ALTER TABLE `"
        + tableName
        + "` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
  }

  private static void assertContains(final Path path, final String expected) throws IOException {
    assertTrue(Files.readString(path).contains(expected), path + " must contain: " + expected);
  }

  private static Path repositoryRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.exists(current.resolve("bootstrap/sql/migrations"))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the OpenMetadata repository root");
    }
    return current;
  }
}
