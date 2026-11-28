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

package org.openmetadata.it.tests.migration.v212;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.tests.migration.ScratchDatabasePerTest;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

/**
 * Runs the 2.1.2 {@code postDataMigrationSQLScript.sql} that appends {@code Vertica} to {@code
 * tableDiff.supportedServices} against real MySQL and PostgreSQL. The statement is loaded through
 * {@link MigrationFile#parseSQLFile} so this exercises the exact SQL upgrades execute.
 */
@ExtendWith(ScratchDatabasePerTest.class)
class VerticaTableDiffSqlMigrationIT {
  private static final String MYSQL_DIALECT = "mysql";
  private static final String POSTGRES_DIALECT = "postgres";
  private static final String TABLE_DIFF = "tableDiff";
  private static final String OTHER_DEFINITION = "tableRowCountToEqual";
  private static final String VERTICA = "Vertica";
  private static final String SEED_PATH = "json/data/tests/tableDiff.json";
  private static final List<String> LEGACY_THIRTEEN_SERVICES =
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

  private record Database(Handle handle, String dialect) {
    boolean isPostgres() {
      return POSTGRES_DIALECT.equals(dialect);
    }

    String jsonValue() {
      return isPostgres() ? "CAST(:json AS JSONB)" : ":json";
    }

    String jsonText() {
      return isPostgres() ? "CAST(json AS TEXT)" : "CAST(json AS CHAR)";
    }
  }

  static Stream<String> dialects() {
    return ScratchDatabasePerTest.laneDialect();
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void appendsVerticaToLegacyThirteenServiceRowAndLeavesOtherDefinitionsUntouched(String dialect) {
    try (Handle handle = ScratchDatabasePerTest.jdbi().open()) {
      Database db = createTable(handle, dialect);
      insertDefinition(db, TABLE_DIFF, definitionJson(TABLE_DIFF, LEGACY_THIRTEEN_SERVICES));
      insertDefinition(
          db, OTHER_DEFINITION, definitionJson(OTHER_DEFINITION, List.of("Snowflake", "Postgres")));
      JsonNode otherBefore = readDefinition(db, OTHER_DEFINITION);

      int firstRunUpdated = runMigration(db);
      int secondRunUpdated = runMigration(db);

      assertEquals(1, firstRunUpdated, "Legacy tableDiff row must be updated once");
      assertEquals(0, secondRunUpdated, "Second run must update zero rows");
      assertEquals(seededSupportedServices(), supportedServices(db, TABLE_DIFF));
      assertEquals(otherBefore, readDefinition(db, OTHER_DEFINITION));
    }
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void preservesAdminCustomisedServicesWhenAppendingVertica(String dialect) {
    try (Handle handle = ScratchDatabasePerTest.jdbi().open()) {
      Database db = createTable(handle, dialect);
      List<String> customised = List.of("Snowflake", "CustomConnector");
      insertDefinition(db, TABLE_DIFF, definitionJson(TABLE_DIFF, customised));

      assertEquals(1, runMigration(db));
      assertEquals(
          List.of("Snowflake", "CustomConnector", VERTICA), supportedServices(db, TABLE_DIFF));
      assertEquals(0, runMigration(db));
    }
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void leavesEmptyListUntouched(String dialect) {
    try (Handle handle = ScratchDatabasePerTest.jdbi().open()) {
      Database db = createTable(handle, dialect);
      insertDefinition(db, TABLE_DIFF, definitionJson(TABLE_DIFF, List.of()));
      JsonNode before = readDefinition(db, TABLE_DIFF);

      assertEquals(0, runMigration(db));
      assertEquals(before, readDefinition(db, TABLE_DIFF));
    }
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void leavesAbsentOrNullSupportedServicesUntouched(String dialect) {
    try (Handle handle = ScratchDatabasePerTest.jdbi().open()) {
      Database db = createTable(handle, dialect);
      insertDefinition(db, TABLE_DIFF, definitionJsonWithoutSupportedServices(TABLE_DIFF));
      JsonNode beforeAbsent = readDefinition(db, TABLE_DIFF);

      assertEquals(0, runMigration(db));
      assertEquals(beforeAbsent, readDefinition(db, TABLE_DIFF));
      assertFalse(readDefinition(db, TABLE_DIFF).has("supportedServices"));

      db.handle().execute("DELETE FROM test_definition");
      insertDefinition(db, TABLE_DIFF, definitionJsonWithNullSupportedServices(TABLE_DIFF));
      JsonNode beforeNull = readDefinition(db, TABLE_DIFF);

      assertEquals(0, runMigration(db));
      assertEquals(beforeNull, readDefinition(db, TABLE_DIFF));
    }
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void leavesRowAlreadyContainingVerticaUntouched(String dialect) {
    try (Handle handle = ScratchDatabasePerTest.jdbi().open()) {
      Database db = createTable(handle, dialect);
      List<String> alreadyMigrated = new ArrayList<>(LEGACY_THIRTEEN_SERVICES);
      alreadyMigrated.add(VERTICA);
      insertDefinition(db, TABLE_DIFF, definitionJson(TABLE_DIFF, alreadyMigrated));
      JsonNode before = readDefinition(db, TABLE_DIFF);

      assertEquals(0, runMigration(db));
      assertEquals(before, readDefinition(db, TABLE_DIFF));
      assertEquals(1, supportedServices(db, TABLE_DIFF).stream().filter(VERTICA::equals).count());
    }
  }

  private static Database createTable(Handle handle, String dialect) {
    Database db = new Database(handle, dialect);
    handle.execute("DROP TABLE IF EXISTS test_definition");
    handle.execute(db.isPostgres() ? POSTGRES_TEST_DEFINITION_TABLE : MYSQL_TEST_DEFINITION_TABLE);
    return db;
  }

  private static void insertDefinition(Database db, String name, String json) {
    db.handle()
        .createUpdate("INSERT INTO test_definition (json) VALUES (" + db.jsonValue() + ")")
        .bind("json", json)
        .execute();
    assertNotNull(readDefinition(db, name));
  }

  private static int runMigration(Database db) {
    int updated = 0;
    for (String statement : migrationStatements(db.dialect())) {
      updated += db.handle().execute(statement);
    }
    return updated;
  }

  private static JsonNode readDefinition(Database db, String name) {
    String json =
        db.handle()
            .createQuery("SELECT " + db.jsonText() + " FROM test_definition WHERE name = :name")
            .bind("name", name)
            .mapTo(String.class)
            .one();
    return JsonUtils.readTree(json);
  }

  private static List<String> supportedServices(Database db, String name) {
    JsonNode services = readDefinition(db, name).path("supportedServices");
    List<String> result = new ArrayList<>();
    services.forEach(node -> result.add(node.asText()));
    return result;
  }

  private static List<String> seededSupportedServices() {
    try (InputStream stream =
        VerticaTableDiffSqlMigrationIT.class.getClassLoader().getResourceAsStream(SEED_PATH)) {
      assertNotNull(stream, "Missing seed " + SEED_PATH);
      String json = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
      return JsonUtils.readValue(json, TestDefinition.class).getSupportedServices();
    } catch (IOException e) {
      throw new UncheckedIOException("Cannot read seed " + SEED_PATH, e);
    }
  }

  private static List<String> migrationStatements(String dialect) {
    ConnectionType connectionType =
        MYSQL_DIALECT.equals(dialect) ? ConnectionType.MYSQL : ConnectionType.POSTGRES;
    List<String> statements =
        MigrationFile.parseSQLFile(migrationFile(dialect).toFile(), connectionType);
    assertEquals(1, statements.size(), "Expected one statement in 2.1.2 " + dialect + " script");
    return statements;
  }

  private static Path migrationFile(String dialect) {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve("bootstrap/sql/migrations"))) {
      current = current.getParent();
    }
    assertTrue(current != null, "Could not find the repository root");
    return current.resolve(
        "bootstrap/sql/migrations/native/2.1.2/%s/postDataMigrationSQLScript.sql"
            .formatted(dialect));
  }

  private static String definitionJson(String name, List<String> services) {
    return """
        {"id": "%s", "name": "%s", "entityType": "TABLE", "updatedAt": 1700000000000,
         "updatedBy": "admin", "deleted": false, "supportedServices": %s}"""
        .formatted(UUID.randomUUID(), name, JsonUtils.pojoToJson(services));
  }

  private static String definitionJsonWithoutSupportedServices(String name) {
    return """
        {"id": "%s", "name": "%s", "entityType": "TABLE", "updatedAt": 1700000000000,
         "updatedBy": "admin", "deleted": false}"""
        .formatted(UUID.randomUUID(), name);
  }

  private static String definitionJsonWithNullSupportedServices(String name) {
    return """
        {"id": "%s", "name": "%s", "entityType": "TABLE", "updatedAt": 1700000000000,
         "updatedBy": "admin", "deleted": false, "supportedServices": null}"""
        .formatted(UUID.randomUUID(), name);
  }

  private static final String MYSQL_TEST_DEFINITION_TABLE =
      """
      CREATE TABLE test_definition (
        id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
        name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
        json JSON NOT NULL,
        entityType VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.entityType') NOT NULL,
        updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
        updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
        deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
        UNIQUE (name))
      """;

  private static final String POSTGRES_TEST_DEFINITION_TABLE =
      """
      CREATE TABLE test_definition (
        id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
        name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
        json JSONB NOT NULL,
        entityType VARCHAR(36) GENERATED ALWAYS AS (json ->> 'entityType') STORED NOT NULL,
        updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
        updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
        deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
        UNIQUE (name))
      """;
}
