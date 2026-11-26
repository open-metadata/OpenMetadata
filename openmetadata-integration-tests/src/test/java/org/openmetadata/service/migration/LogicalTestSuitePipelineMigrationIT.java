package org.openmetadata.service.migration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.tests.migration.ScratchDatabasePerTest;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v212.LogicalTestSuitePipelineMigration;

@ExtendWith(ScratchDatabasePerTest.class)
class LogicalTestSuitePipelineMigrationIT {
  private static final String MYSQL = "mysql";
  private static final String TABLE_FIELD = "entityFullyQualifiedName";
  private static final List<String> VERSIONS = List.of("2.1.2");

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.migration.ScratchDatabasePerTest#laneDialect")
  void removesOnlyLogicalSuiteTableSettingsAndCanBeReplayed(final String dialect)
      throws ReflectiveOperationException {
    try (Handle handle = ScratchDatabasePerTest.jdbi().open()) {
      for (final String version : VERSIONS) {
        createTables(handle, dialect);
        final Map<String, JsonNode> expected = seedPipelines(handle, dialect);
        runMigration(handle, dialect, version);
        assertSuiteIdIndex(handle, dialect);
        assertIndexedSuiteLookup(handle, dialect);
        assertEquals(expected, storedPipelines(handle), version + " first run");
        invalidatePostgresIndex(handle, dialect);
        try (Handle retry = ScratchDatabasePerTest.jdbi().open()) {
          runMigration(retry, dialect, version);
          assertSuiteIdIndex(retry, dialect);
          assertIndexedSuiteLookup(retry, dialect);
          assertEquals(expected, storedPipelines(retry), version + " retry in a new session");
        }
        for (final String table :
            List.of("entity_relationship", "ingestion_pipeline_entity", "test_suite")) {
          handle.execute("DROP TABLE " + table);
        }
      }
    }
  }

  private static void createTables(final Handle handle, final String dialect) {
    final String suiteJsonType = MYSQL.equals(dialect) ? "JSON" : "JSONB";
    handle.execute(
        "CREATE TABLE test_suite (id VARCHAR(36) NOT NULL, json " + suiteJsonType + " NOT NULL)");
    // Matches v001: ingestion_pipeline_entity.json is JSON (not JSONB) on PostgreSQL.
    handle.execute(
        "CREATE TABLE ingestion_pipeline_entity (id VARCHAR(36) NOT NULL, json JSON NOT NULL)");
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

  private static void assertIndexedSuiteLookup(final Handle handle, final String dialect)
      throws ReflectiveOperationException {
    handle.execute(MYSQL.equals(dialect) ? "ANALYZE TABLE test_suite" : "ANALYZE test_suite");
    final List<String> fields =
        MYSQL.equals(dialect)
            ? List.of("MYSQL_CLEANUP", "MYSQL_ALIGN_BASIC")
            : List.of("POSTGRES_CLEANUP", "POSTGRES_ALIGN_BASIC");
    final String explain =
        MYSQL.equals(dialect) ? "EXPLAIN FORMAT=JSON " : "EXPLAIN (FORMAT JSON) ";
    final String key = MYSQL.equals(dialect) ? "key" : "Index Name";
    for (final String fieldName : fields) {
      final Field statement = LogicalTestSuitePipelineMigration.class.getDeclaredField(fieldName);
      statement.setAccessible(true);
      final JsonNode plan =
          JsonUtils.readTree(
              handle.createQuery(explain + statement.get(null)).mapTo(String.class).one());
      assertTrue(
          plan.findValues(key).stream()
              .anyMatch(value -> "idx_test_suite_id".equals(value.asText())),
          fieldName + " should join test_suite through idx_test_suite_id: " + plan);
    }
  }

  private static void invalidatePostgresIndex(final Handle handle, final String dialect) {
    if (!MYSQL.equals(dialect)) {
      handle.execute(
          "UPDATE pg_index SET indisvalid = false WHERE indexrelid = 'idx_test_suite_id'::regclass");
    }
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
      final ObjectNode config = (ObjectNode) pipeline.path("sourceConfig").path("config");
      if (fixture.removeTable()) {
        config.remove(TABLE_FIELD);
      } else if (fixture.expectedTableJson() != null) {
        config.set(TABLE_FIELD, JsonUtils.readTree(fixture.expectedTableJson()));
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
            true,
            null),
        new Fixture(
            "logical_table",
            "{\"basic\":false}",
            "\"service.db.schema.table\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            true,
            null),
        new Fixture(
            "missing_basic",
            "{}",
            "\"logical_suite\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            true,
            null),
        new Fixture(
            "null_basic",
            "{\"basic\":null}",
            "\"logical_suite\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            true,
            null),
        new Fixture(
            "deleted",
            "{\"basic\":false}",
            "\"logical_suite\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            true,
            true,
            null),
        new Fixture(
            "basic_missing_ref",
            "{\"basic\":true}",
            "\"service.db.schema.table\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            false,
            null),
        new Fixture(
            "basic_matching",
            "{\"basic\":true,\"basicEntityReference\":{\"fullyQualifiedName\":\"service.db.schema.orders\"}}",
            "\"service.db.schema.orders\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            false,
            null),
        new Fixture(
            "basic_mismatch_quoted",
            "{\"basic\":true,\"basicEntityReference\":{\"fullyQualifiedName\":\"svc.db.\\\"schema.name\\\".other_table\"}}",
            "\"service.db.schema.table\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            false,
            "\"svc.db.\\\"schema.name\\\".other_table\""),
        new Fixture(
            "basic_case_mismatch",
            "{\"basic\":true,\"basicEntityReference\":{\"fullyQualifiedName\":\"service.db.schema.orders\"}}",
            "\"service.db.schema.ORDERS\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            false,
            "\"service.db.schema.orders\""),
        new Fixture(
            "basic_non_string",
            "{\"basic\":true,\"basicEntityReference\":{\"fullyQualifiedName\":\"service.db.schema.orders\"}}",
            "42",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            false,
            "\"service.db.schema.orders\""),
        new Fixture(
            "basic_absent",
            "{\"basic\":true,\"basicEntityReference\":{\"fullyQualifiedName\":\"service.db.schema.orders\"}}",
            null,
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            false,
            null),
        new Fixture(
            "basic_null_table",
            "{\"basic\":true,\"basicEntityReference\":{\"fullyQualifiedName\":\"service.db.schema.orders\"}}",
            "null",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            false,
            null),
        new Fixture(
            "absent",
            "{\"basic\":false}",
            null,
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            false,
            null),
        new Fixture(
            "null_table",
            "{\"basic\":false}",
            "null",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            true,
            null),
        new Fixture(
            "metadata",
            "{\"basic\":false}",
            "\"table\"",
            "metadata",
            "testSuite",
            "ingestionPipeline",
            0,
            false,
            false,
            null),
        new Fixture(
            "other_parent",
            "{\"basic\":false}",
            "\"table\"",
            "TestSuite",
            "databaseService",
            "ingestionPipeline",
            0,
            false,
            false,
            null),
        new Fixture(
            "other_child",
            "{\"basic\":false}",
            "\"table\"",
            "TestSuite",
            "testSuite",
            "pipeline",
            0,
            false,
            false,
            null),
        new Fixture(
            "other_relation",
            "{\"basic\":false}",
            "\"table\"",
            "TestSuite",
            "testSuite",
            "ingestionPipeline",
            1,
            false,
            false,
            null));
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
    final String jsonBind =
        MYSQL.equals(dialect)
            ? ":json"
            : "test_suite".equals(table) ? "CAST(:json AS JSONB)" : "CAST(:json AS JSON)";
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

  private static void runMigration(final Handle handle, final String dialect, final String version)
      throws ReflectiveOperationException {
    Path root = Path.of("").toAbsolutePath();
    while (root != null && !Files.isDirectory(root.resolve("bootstrap/sql/migrations"))) {
      root = root.getParent();
    }
    if (root == null) {
      throw new IllegalStateException("Cannot find migration scripts");
    }
    final MigrationDAO migrationDAO = mock(MigrationDAO.class);
    // Unrelated steps in these release entry points have their own regression suites.
    when(migrationDAO.getSqlQuery(anyString(), anyString()))
        .thenAnswer(
            invocation -> {
              final String marker = invocation.getArgument(1, String.class);
              return marker.endsWith(":" + LogicalTestSuitePipelineMigration.STEP_NAME)
                  ? null
                  : "already applied";
            });
    final MigrationFile file =
        new MigrationFile(
            root.resolve("bootstrap/sql/migrations/native").resolve(version).toFile(),
            migrationDAO,
            MYSQL.equals(dialect) ? ConnectionType.MYSQL : ConnectionType.POSTGRES,
            new OpenMetadataApplicationConfig(),
            false);
    final MigrationProcessImpl migration =
        (MigrationProcessImpl)
            Class.forName(file.getMigrationProcessClassName())
                .getConstructor(MigrationFile.class)
                .newInstance(file);
    for (final var entry :
        Map.of("handle", (Object) handle, "migrationDAO", migrationDAO).entrySet()) {
      final Field field = MigrationProcessImpl.class.getDeclaredField(entry.getKey());
      field.setAccessible(true);
      field.set(migration, entry.getValue());
    }
    migration.runDataMigration();
    verify(migrationDAO)
        .upsertServerMigrationSQL(
            eq(version),
            anyString(),
            eq(
                "data-migration-step:"
                    + version
                    + ":"
                    + LogicalTestSuitePipelineMigration.STEP_NAME));
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
      boolean removeTable,
      String expectedTableJson) {}
}
