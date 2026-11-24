package org.openmetadata.service.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@Execution(ExecutionMode.SAME_THREAD)
class LogicalTestSuitePipelineMigrationTest {
  private static final String MYSQL = "mysql";
  private static final String DATABASE = "suite_pipeline_migration";
  private static final String PASSWORD = "suite-pipeline-test";
  private static final String TABLE_FIELD = "entityFullyQualifiedName";
  private static final List<String> VERSIONS = List.of("2.0.10", "2.1.1");

  @ParameterizedTest
  @ValueSource(strings = {MYSQL, "postgres"})
  void removesOnlyLogicalSuiteTableSettingsAndCanBeReplayed(final String dialect) {
    try (GenericContainer<?> database = database(dialect)) {
      database.start();
      try (Handle handle = open(database, dialect)) {
        createTables(handle, dialect);
        for (final String version : VERSIONS) {
          final Map<String, JsonNode> expected = seedPipelines(handle, dialect);
          final List<String> statements = migrationStatements(version, dialect);
          assertFalse(statements.isEmpty(), version + " must normalize logical suite pipelines");
          statements.forEach(handle::execute);
          assertSuiteIdIndex(handle, dialect);
          assertIndexedSuiteLookup(handle, dialect, statements);
          assertEquals(expected, storedPipelines(handle), version + " first run");
          statements.forEach(handle::execute);
          assertEquals(expected, storedPipelines(handle), version + " replay");
        }
      }
    }
  }

  private static GenericContainer<?> database(final String dialect) {
    final GenericContainer<?> database;
    if (MYSQL.equals(dialect)) {
      database =
          new GenericContainer<>("mysql:8.3.0")
              .withEnv("MYSQL_DATABASE", DATABASE)
              .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
              .withEnv("MYSQL_ROOT_HOST", "%")
              .withCommand("--innodb-buffer-pool-size=64M", "--performance-schema=OFF")
              .withExposedPorts(3306)
              .waitingFor(
                  Wait.forSuccessfulCommand(
                      "mysql --protocol=TCP --host=127.0.0.1 --user=root --password="
                          + PASSWORD
                          + " --execute='SELECT 1'"));
    } else {
      database =
          new GenericContainer<>("postgres:15")
              .withEnv("POSTGRES_DB", DATABASE)
              .withEnv("POSTGRES_PASSWORD", PASSWORD)
              .withExposedPorts(5432)
              .waitingFor(
                  Wait.forLogMessage(".*database system is ready to accept connections.*\\n", 2));
    }
    return database.withCreateContainerCmdModifier(
        command -> command.getHostConfig().withMemory(384L * 1024 * 1024));
  }

  private static Handle open(final GenericContainer<?> database, final String dialect) {
    final boolean mysql = MYSQL.equals(dialect);
    final String url =
        "jdbc:%s://%s:%d/%s%s"
            .formatted(
                mysql ? MYSQL : "postgresql",
                database.getHost(),
                database.getMappedPort(mysql ? 3306 : 5432),
                DATABASE,
                mysql ? "?allowPublicKeyRetrieval=true&useSSL=false" : "");
    return Jdbi.create(url, mysql ? "root" : "postgres", PASSWORD).open();
  }

  private static void createTables(final Handle handle, final String dialect) {
    final String jsonType = MYSQL.equals(dialect) ? "JSON" : "JSONB";
    for (final String table : List.of("test_suite", "ingestion_pipeline_entity")) {
      handle.execute(
          "CREATE TABLE " + table + " (id VARCHAR(36) NOT NULL, json " + jsonType + " NOT NULL)");
    }
    handle.execute("ALTER TABLE ingestion_pipeline_entity ADD PRIMARY KEY (id)");
    handle.execute(
        """
        CREATE TABLE entity_relationship (
          fromId VARCHAR(36) NOT NULL, toId VARCHAR(36) NOT NULL,
          fromEntity VARCHAR(256) NOT NULL, toEntity VARCHAR(256) NOT NULL,
          relation SMALLINT NOT NULL, deleted BOOLEAN NOT NULL DEFAULT FALSE,
          PRIMARY KEY (fromId, toId, relation))
        """);
    handle.execute(
        """
        CREATE INDEX idx_entity_relationship_fromEntity_fromId_relation
        ON entity_relationship (fromEntity, fromId, relation)
        """);
  }

  private static void seedUnrelatedSuites(final Handle handle, final String dialect) {
    final String jsonBind = MYSQL.equals(dialect) ? ":json" : "CAST(:json AS JSONB)";
    final var batch =
        handle.prepareBatch("INSERT INTO test_suite (id, json) VALUES (:id, " + jsonBind + ")");
    for (int i = 0; i < 2000; i++) {
      batch.bind("id", UUID.randomUUID().toString()).bind("json", "{\"basic\":false}").add();
    }
    batch.execute();
  }

  private static void assertIndexedSuiteLookup(
      final Handle handle, final String dialect, final List<String> statements) {
    handle.execute(MYSQL.equals(dialect) ? "ANALYZE TABLE test_suite" : "ANALYZE test_suite");
    final String update =
        statements.stream()
            .filter(sql -> sql.contains("entityFullyQualifiedName"))
            .findFirst()
            .orElseThrow();
    final String explain =
        MYSQL.equals(dialect) ? "EXPLAIN FORMAT=JSON " : "EXPLAIN (FORMAT JSON) ";
    final JsonNode plan =
        JsonUtils.readTree(handle.createQuery(explain + update).mapTo(String.class).one());
    final String key = MYSQL.equals(dialect) ? "key" : "Index Name";
    assertTrue(
        plan.findValues(key).stream().anyMatch(value -> "idx_test_suite_id".equals(value.asText())),
        "The populated suite table should be joined through its id index: " + plan);
  }

  private static void assertSuiteIdIndex(final Handle handle, final String dialect) {
    final String sql =
        MYSQL.equals(dialect)
            ? """
          SELECT COUNT(*) FROM information_schema.statistics
          WHERE table_schema = DATABASE() AND table_name = 'test_suite'
            AND index_name = 'idx_test_suite_id' AND column_name = 'id' AND seq_in_index = 1
          """
            : """
          SELECT COUNT(*) FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'test_suite'
            AND indexname = 'idx_test_suite_id' AND indexdef LIKE '%(id)'
          """;
    assertEquals(1, handle.createQuery(sql).mapTo(Integer.class).one());
  }

  private static Map<String, JsonNode> seedPipelines(final Handle handle, final String dialect) {
    for (final String table :
        List.of("entity_relationship", "ingestion_pipeline_entity", "test_suite")) {
      handle.execute("DELETE FROM " + table);
    }
    seedUnrelatedSuites(handle, dialect);
    final Map<String, JsonNode> expected = new LinkedHashMap<>();
    for (final Fixture fixture : fixtures()) {
      final String suiteId = UUID.randomUUID().toString();
      final String pipelineId = UUID.randomUUID().toString();
      final ObjectNode pipeline = pipeline(pipelineId, fixture);
      insertEntity(handle, dialect, "test_suite", suiteId, JsonUtils.readTree(fixture.suiteJson()));
      insertEntity(handle, dialect, "ingestion_pipeline_entity", pipelineId, pipeline);
      insertRelationship(handle, suiteId, pipelineId, fixture);
      if (fixture.removeTable()) {
        ((ObjectNode) pipeline.path("sourceConfig").path("config")).remove(TABLE_FIELD);
      }
      expected.put(pipelineId, pipeline);
    }
    return expected;
  }

  private static List<Fixture> fixtures() {
    return List.of(
        new Fixture(
            "logical",
            "{\"basic\":false}",
            "\"logical_suite\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            true),
        new Fixture(
            "logical_table",
            "{\"basic\":false}",
            "\"service.db.schema.table\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            true),
        new Fixture(
            "missing_basic",
            "{}",
            "\"logical_suite\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            true),
        new Fixture(
            "null_basic",
            "{\"basic\":null}",
            "\"logical_suite\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            true),
        new Fixture(
            "deleted",
            "{\"basic\":false}",
            "\"logical_suite\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            true,
            true),
        new Fixture(
            "basic",
            "{\"basic\":true}",
            "\"service.db.schema.table\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            false),
        new Fixture(
            "basic_mismatch",
            "{\"basic\":true,\"basicEntityReference\":{\"fullyQualifiedName\":\"other.table\"}}",
            "\"service.db.schema.table\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            false),
        new Fixture(
            "absent",
            "{\"basic\":false}",
            null,
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            false),
        new Fixture(
            "null_table",
            "{\"basic\":false}",
            "null",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            true),
        new Fixture(
            "metadata",
            "{\"basic\":false}",
            "\"table\"",
            "metadata",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            false),
        new Fixture(
            "other_parent",
            "{\"basic\":false}",
            "\"table\"",
            "TestSuite",
            "databaseService",
            "ingestionPipeline",
            0,
            false,
            false),
        new Fixture(
            "other_child",
            "{\"basic\":false}",
            "\"table\"",
            "TestSuite",
            "testSuite",
            "pipeline",
            0,
            false,
            false),
        new Fixture(
            "other_relation",
            "{\"basic\":false}",
            "\"table\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            1,
            false,
            false));
  }

  private static ObjectNode pipeline(final String id, final Fixture fixture) {
    final ObjectNode pipeline =
        (ObjectNode)
            JsonUtils.readTree(
                """
        {"sourceConfig":{"config":{"type":"TestSuite","testCases":[{"name":"kept"}]}},
         "airflowConfig":{"scheduleInterval":"0 * * * *"},"description":"keep this",
         "enabled":true,"updatedAt":1234,"updatedBy":"admin"}
        """);
    pipeline
        .put("id", id)
        .put("name", fixture.name())
        .put("pipelineType", fixture.pipelineType())
        .put("deleted", fixture.deleted());
    if (fixture.tableJson() != null) {
      ((ObjectNode) pipeline.path("sourceConfig").path("config"))
          .set(TABLE_FIELD, JsonUtils.readTree(fixture.tableJson()));
    }
    return pipeline;
  }

  private static void insertEntity(
      final Handle handle,
      final String dialect,
      final String table,
      final String id,
      final JsonNode json) {
    final String jsonBind = MYSQL.equals(dialect) ? ":json" : "CAST(:json AS JSONB)";
    handle
        .createUpdate("INSERT INTO " + table + " (id, json) VALUES (:id, " + jsonBind + ")")
        .bind("id", id)
        .bind("json", json.toString())
        .execute();
  }

  private static void insertRelationship(
      final Handle handle, final String suiteId, final String pipelineId, final Fixture fixture) {
    handle
        .createUpdate(
            """
        INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation, deleted)
        VALUES (:fromId, :toId, :fromEntity, :toEntity, :relation, :deleted)
        """)
        .bind("fromId", suiteId)
        .bind("toId", pipelineId)
        .bind("fromEntity", fixture.fromEntity())
        .bind("toEntity", fixture.toEntity())
        .bind("relation", fixture.relation())
        .bind("deleted", fixture.deleted())
        .execute();
  }

  private static Map<String, JsonNode> storedPipelines(final Handle handle) {
    final Map<String, JsonNode> rows = new LinkedHashMap<>();
    handle
        .createQuery("SELECT id, json FROM ingestion_pipeline_entity")
        .map(
            (row, context) ->
                Map.entry(row.getString("id"), JsonUtils.readTree(row.getString("json"))))
        .forEach(row -> rows.put(row.getKey(), row.getValue()));
    return rows;
  }

  private static List<String> migrationStatements(final String version, final String dialect) {
    Path root = Path.of("").toAbsolutePath();
    while (root != null && !Files.isDirectory(root.resolve("bootstrap/sql/migrations"))) {
      root = root.getParent();
    }
    if (root == null) {
      throw new IllegalStateException("Cannot find migration scripts");
    }
    return MigrationFile.parseSQLFile(
            root.resolve("bootstrap/sql/migrations/native")
                .resolve(version)
                .resolve(dialect)
                .resolve("schemaChanges.sql")
                .toFile(),
            MYSQL.equals(dialect) ? ConnectionType.MYSQL : ConnectionType.POSTGRES)
        .stream()
        .filter(
            sql ->
                sql.contains("entityFullyQualifiedName")
                    || sql.contains("logical_suite_index")
                    || sql.contains("idx_test_suite_id"))
        .toList();
  }

  private record Fixture(
      String name,
      String suiteJson,
      String tableJson,
      String pipelineType,
      String fromEntity,
      String toEntity,
      int relation,
      boolean deleted,
      boolean removeTable) {}
}
