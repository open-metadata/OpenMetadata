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

package org.openmetadata.service.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

/**
 * Verifies the shipped {@code tableDiff.json} seed and the 2.1.2 MySQL/PostgreSQL migration files
 * that append {@code Vertica} to existing deployments' {@code tableDiff} definition.
 */
class VerticaTableDiffMigrationTest {
  private static final String TABLE_DIFF_SEED = "json/data/tests/tableDiff.json";
  private static final String VERTICA = "Vertica";
  private static final List<String> LEGACY_SUPPORTED_SERVICES =
      List.of(
          "Snowflake",
          "BigQuery",
          "Athena",
          "Redshift",
          "Postgres",
          "MySQL",
          "Mssql",
          "Oracle",
          "Trino",
          "SapHana",
          "Databricks",
          "UnityCatalog",
          "AzureSQL");

  @Test
  void seededTableDiffIncludesVerticaAlongsideExistingServices() throws IOException {
    TestDefinition tableDiff = readSeededTableDiff();

    assertTrue(
        tableDiff.getSupportedServices().containsAll(LEGACY_SUPPORTED_SERVICES),
        "tableDiff.json must keep all previously supported services");
    assertTrue(
        tableDiff.getSupportedServices().contains(VERTICA),
        "tableDiff.json must include Vertica in supportedServices");
  }

  @ParameterizedTest(name = "{0} 2.1.2 migration parses cleanly and uses default process")
  @MethodSource("dialects")
  void migrationScriptParsesIntoOneTableDiffStatement(ConnectionType connectionType) {
    Path versionDir = nativeMigrationsRoot().resolve("2.1.2");
    String dialect = connectionType == ConnectionType.MYSQL ? "mysql" : "postgres";
    Path schemaFile = versionDir.resolve(dialect).resolve("schemaChanges.sql");
    Path postScript = versionDir.resolve(dialect).resolve("postDataMigrationSQLScript.sql");

    assertTrue(Files.isRegularFile(schemaFile), "Missing " + schemaFile);
    assertTrue(Files.isRegularFile(postScript), "Missing " + postScript);
    assertTrue(
        MigrationFile.parseSQLFile(schemaFile.toFile(), connectionType).isEmpty(),
        "2.1.2 schemaChanges.sql should have no DDL statements for " + dialect);

    List<String> statements = MigrationFile.parseSQLFile(postScript.toFile(), connectionType);
    assertEquals(1, statements.size(), "Expected one UPDATE statement in " + postScript);
    assertTrue(statements.getFirst().contains("UPDATE test_definition"));
    assertTrue(statements.getFirst().contains(VERTICA));
    assertEquals(1, MigrationFile.parseSqlUnits(postScript.toFile(), connectionType).size());

    MigrationFile migrationFile =
        new MigrationFile(versionDir.toFile(), null, connectionType, null, false);
    assertEquals(
        MigrationFile.DEFAULT_MIGRATION_PROCESS_CLASS,
        migrationFile.getMigrationProcessClassName());
  }

  private static Stream<ConnectionType> dialects() {
    return Stream.of(ConnectionType.MYSQL, ConnectionType.POSTGRES);
  }

  private static TestDefinition readSeededTableDiff() throws IOException {
    try (InputStream stream =
        VerticaTableDiffMigrationTest.class.getClassLoader().getResourceAsStream(TABLE_DIFF_SEED)) {
      assertNotNull(stream, "Missing classpath seed " + TABLE_DIFF_SEED);
      String json = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
      return JsonUtils.readValue(json, TestDefinition.class);
    }
  }

  private static Path nativeMigrationsRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve("bootstrap/sql/migrations"))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the OpenMetadata repository root");
    }
    return current.resolve("bootstrap/sql/migrations/native");
  }
}
