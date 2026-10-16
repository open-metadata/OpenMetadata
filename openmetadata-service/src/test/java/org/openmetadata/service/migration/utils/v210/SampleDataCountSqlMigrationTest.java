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
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Runs the 2.1.0 statement that clamps a saved auto-classification {@code sampleDataCount} to the
 * schema maximum against real MySQL and PostgreSQL. The statement is read from the shipped {@code
 * postDataMigrationSQLScript.sql}, so the test fails if either dialect drifts from what upgrades
 * really run.
 */
@Testcontainers(disabledWithoutDocker = true)
class SampleDataCountSqlMigrationTest {
  private static final String PASSWORD = "sample-data-count-test";
  private static final String DATABASE = "sample_count_test";
  private static final String MYSQL_DIALECT = "mysql";
  private static final String POSTGRES_DIALECT = "postgres";
  private static final String SAMPLE_DATA_COUNT = "sampleDataCount";
  private static final int MAXIMUM = 1000;

  private static final String ABOVE = "above";
  private static final String JUST_ABOVE = "just_above";
  private static final String AT_MAXIMUM = "at_maximum";
  private static final String BELOW = "below";
  private static final String UNSET = "unset";
  private static final String PROFILER = "profiler";

  @Container
  static final GenericContainer<?> MYSQL =
      new GenericContainer<>(DockerImageName.parse("mysql:8.0"))
          .withEnv("MYSQL_DATABASE", DATABASE)
          .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
          .withExposedPorts(3306);

  @Container
  static final GenericContainer<?> POSTGRES =
      new GenericContainer<>(DockerImageName.parse("postgres:15"))
          .withEnv("POSTGRES_DB", DATABASE)
          .withEnv("POSTGRES_PASSWORD", PASSWORD)
          .withExposedPorts(5432);

  private record Fixture(String name, String config) {}

  private record Database(Handle handle, String dialect) {
    boolean isPostgres() {
      return POSTGRES_DIALECT.equals(dialect);
    }

    String jsonValue() {
      return isPostgres() ? "CAST(:json AS JSON)" : ":json";
    }

    String jsonText() {
      return isPostgres() ? "CAST(json AS TEXT)" : "CAST(json AS CHAR)";
    }
  }

  private static final List<Fixture> FIXTURES =
      List.of(
          new Fixture(ABOVE, autoClassification(", \"sampleDataCount\": 5000")),
          new Fixture(
              JUST_ABOVE,
              autoClassification(
                  ", \"sampleDataCount\": 1001, \"enableAutoClassification\": true")),
          new Fixture(AT_MAXIMUM, autoClassification(", \"sampleDataCount\": 1000")),
          new Fixture(BELOW, autoClassification(", \"sampleDataCount\": 200")),
          new Fixture(UNSET, autoClassification("")),
          new Fixture(PROFILER, "{\"type\": \"Profiler\", \"sampleDataCount\": 5000}"));

  static Stream<String> dialects() {
    return Stream.of(MYSQL_DIALECT, POSTGRES_DIALECT);
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void clampsAutoClassificationCountsAboveTheMaximum(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = seed(new Database(handle, dialect));
      Map<String, JsonNode> before = configs(db);

      runClampStatement(db);

      Map<String, JsonNode> after = configs(db);
      assertEquals(MAXIMUM, after.get(ABOVE).path(SAMPLE_DATA_COUNT).asInt());
      assertEquals(MAXIMUM, after.get(JUST_ABOVE).path(SAMPLE_DATA_COUNT).asInt());
      assertTrue(after.get(JUST_ABOVE).path("enableAutoClassification").asBoolean());
      assertEquals(before.get(JUST_ABOVE).size(), after.get(JUST_ABOVE).size());
    }
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void leavesCountsWithinTheMaximumAndOtherPipelinesUntouched(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = seed(new Database(handle, dialect));
      Map<String, JsonNode> before = configs(db);

      runClampStatement(db);

      Map<String, JsonNode> after = configs(db);
      for (String name : List.of(AT_MAXIMUM, BELOW, UNSET, PROFILER)) {
        assertEquals(before.get(name), after.get(name), name);
      }
    }
  }

  @ParameterizedTest
  @MethodSource("dialects")
  void secondRunChangesNothing(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = seed(new Database(handle, dialect));
      runClampStatement(db);
      Map<String, JsonNode> afterFirstRun = configs(db);

      runClampStatement(db);

      assertEquals(afterFirstRun, configs(db));
    }
  }

  private static String autoClassification(String extraFields) {
    return "{\"type\": \"AutoClassification\"%s}".formatted(extraFields);
  }

  private static Handle open(String dialect) {
    return MYSQL_DIALECT.equals(dialect)
        ? Jdbi.create(
                "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
                    .formatted(MYSQL.getHost(), MYSQL.getMappedPort(3306), DATABASE),
                "root",
                PASSWORD)
            .open()
        : Jdbi.create(
                "jdbc:postgresql://%s:%d/%s"
                    .formatted(POSTGRES.getHost(), POSTGRES.getMappedPort(5432), DATABASE),
                "postgres",
                PASSWORD)
            .open();
  }

  private static Database seed(Database db) {
    db.handle().execute("DROP TABLE IF EXISTS ingestion_pipeline_entity");
    db.handle().execute(db.isPostgres() ? POSTGRES_PIPELINE_TABLE : MYSQL_PIPELINE_TABLE);
    FIXTURES.forEach(fixture -> insert(db, fixture));
    return db;
  }

  private static void insert(Database db, Fixture fixture) {
    String json =
        """
        {"id": "%s", "name": "%s", "sourceConfig": {"config": %s}}"""
            .formatted(UUID.randomUUID(), fixture.name(), fixture.config());
    db.handle()
        .createUpdate(
            "INSERT INTO ingestion_pipeline_entity (json) VALUES (" + db.jsonValue() + ")")
        .bind("json", json)
        .execute();
  }

  /** Each pipeline's stored source config, keyed by pipeline name. */
  private static Map<String, JsonNode> configs(Database db) {
    Map<String, JsonNode> configs = new LinkedHashMap<>();
    db.handle()
        .createQuery("SELECT " + db.jsonText() + " FROM ingestion_pipeline_entity")
        .mapTo(String.class)
        .forEach(
            json -> {
              JsonNode pipeline = JsonUtils.readTree(json);
              configs.put(
                  pipeline.path("name").asText(), pipeline.path("sourceConfig").path("config"));
            });
    return configs;
  }

  private static void runClampStatement(Database db) {
    clampStatements(db.dialect()).forEach(statement -> db.handle().execute(statement));
  }

  /** Parsed with the migration framework's own splitter, so it is what an upgrade would execute. */
  private static List<String> clampStatements(String dialect) {
    ConnectionType connectionType =
        MYSQL_DIALECT.equals(dialect) ? ConnectionType.MYSQL : ConnectionType.POSTGRES;
    List<String> statements =
        MigrationFile.parseSQLFile(migrationFile(dialect).toFile(), connectionType).stream()
            .filter(sql -> sql.contains(SAMPLE_DATA_COUNT))
            .toList();
    assertEquals(1, statements.size(), "Expected one sampleDataCount statement in " + dialect);
    return statements;
  }

  private static Path migrationFile(String dialect) {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve("bootstrap/sql/migrations"))) {
      current = current.getParent();
    }
    assertTrue(current != null, "Could not find the repository root");
    return current.resolve(
        "bootstrap/sql/migrations/native/2.1.0/%s/postDataMigrationSQLScript.sql"
            .formatted(dialect));
  }

  private static final String MYSQL_PIPELINE_TABLE =
      """
      CREATE TABLE ingestion_pipeline_entity (
        id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
        name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
        json JSON NOT NULL,
        PRIMARY KEY (id))
      """;

  /** The column is JSON, not JSONB, as created in v001, so the statement must cast back. */
  private static final String POSTGRES_PIPELINE_TABLE =
      """
      CREATE TABLE ingestion_pipeline_entity (
        id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
        name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
        json JSON NOT NULL,
        PRIMARY KEY (id))
      """;
}
