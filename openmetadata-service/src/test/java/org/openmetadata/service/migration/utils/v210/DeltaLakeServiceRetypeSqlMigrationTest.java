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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.NullNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Stream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Runs the 2.1.0 statements that retire the DeltaLake database connector against real MySQL and
 * PostgreSQL. A DeltaLake service and its children become CustomDatabase, including their version
 * history, and its ingestion pipelines go with everything attached to them. The statements are read
 * from the shipped {@code schemaChanges.sql}, so the test fails if either dialect drifts from what
 * upgrades really run.
 */
@Testcontainers(disabledWithoutDocker = true)
class DeltaLakeServiceRetypeSqlMigrationTest {
  private static final String PASSWORD = "deltalake-retype-test";
  private static final String DATABASE = "deltalake_test";
  private static final String MYSQL_DIALECT = "mysql";
  private static final String POSTGRES_DIALECT = "postgres";
  private static final String DELTA_LAKE = "DeltaLake";
  private static final String CUSTOM_DATABASE = "CustomDatabase";
  private static final int STATEMENT_COUNT = 12;

  private static final String DELTA_SERVICE = "00000000-0000-0000-0000-0000000000d1";
  private static final String DELTA_PIPELINE = "00000000-0000-0000-0000-0000000000d2";
  private static final String MYSQL_SERVICE = "00000000-0000-0000-0000-0000000000a1";
  private static final String MYSQL_PIPELINE = "00000000-0000-0000-0000-0000000000a2";
  private static final String OWNER = "00000000-0000-0000-0000-0000000000f1";

  /** Child entity tables, their version-extension prefix, and the id of each fixture's child. */
  private record Child(String table, String entityType, String deltaId, String mysqlId) {}

  private static final List<Child> CHILDREN =
      List.of(
          new Child("database_entity", "database", id("d3"), id("a3")),
          new Child("database_schema_entity", "databaseSchema", id("d4"), id("a4")),
          new Child("table_entity", "table", id("d5"), id("a5")),
          new Child("stored_procedure_entity", "storedProcedure", id("d6"), id("a6")));

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

  private record Database(Handle handle, String dialect) {
    boolean isPostgres() {
      return POSTGRES_DIALECT.equals(dialect);
    }

    String json(String type) {
      return isPostgres() ? "CAST(:json AS " + type + ")" : ":json";
    }

    String jsonText(String column) {
      return isPostgres() ? "CAST(" + column + " AS TEXT)" : "CAST(" + column + " AS CHAR)";
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void retypesDeltaLakeServiceAndChildrenKeepingTheirMetadata(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = seed(new Database(handle, dialect));

      runDeltaLakeStatements(db);

      Map<String, JsonNode> rows = rows(db);
      JsonNode service = rows.get("dbservice_entity:" + DELTA_SERVICE);
      assertEquals(CUSTOM_DATABASE, service.path("serviceType").asText());
      assertEquals(customDatabaseConfig(), service.path("connection").path("config"));
      assertEquals("curated", service.path("description").asText());
      JsonNode serviceSnapshot =
          rows.get("entity_extension:" + DELTA_SERVICE + ":databaseService.version.0.1");
      assertEquals(CUSTOM_DATABASE, serviceSnapshot.path("serviceType").asText());
      assertEquals(customDatabaseConfig(), serviceSnapshot.path("connection").path("config"));
      for (Child child : CHILDREN) {
        JsonNode entity = rows.get(child.table() + ":" + child.deltaId());
        assertEquals(CUSTOM_DATABASE, entity.path("serviceType").asText(), child.table());
        assertEquals("curated", entity.path("description").asText(), child.table());
        JsonNode snapshot =
            rows.get(
                "entity_extension:" + child.deltaId() + ":" + child.entityType() + ".version.0.1");
        assertEquals(CUSTOM_DATABASE, snapshot.path("serviceType").asText(), child.table());
      }
      assertTrue(
          rows.containsKey("entity_relationship:" + DELTA_SERVICE + ":" + id("d3") + ":0"),
          "the service must keep its databases");
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void deletesDeltaLakePipelinesWithEverythingAttachedToThem(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = seed(new Database(handle, dialect));

      runDeltaLakeStatements(db);

      Map<String, JsonNode> rows = rows(db);
      List<String> leftovers =
          rows.keySet().stream()
              .filter(key -> key.contains(DELTA_PIPELINE) || key.contains("hash-delta-pipeline"))
              .toList();
      assertTrue(leftovers.isEmpty(), "DeltaLake pipeline rows left behind: " + leftovers);
      assertFalse(rows.containsKey("test_connection_definition:" + DELTA_LAKE));
      assertFalse(rows.containsKey("automations_workflow:" + id("d8")));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void leavesOtherServicesUntouched(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = seed(new Database(handle, dialect));
      Map<String, JsonNode> before = withoutDeltaLake(rows(db));

      runDeltaLakeStatements(db);

      assertEquals(before, withoutDeltaLake(rows(db)));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, POSTGRES_DIALECT})
  void secondRunChangesNothing(String dialect) {
    try (Handle handle = open(dialect)) {
      Database db = seed(new Database(handle, dialect));
      runDeltaLakeStatements(db);
      Map<String, JsonNode> afterFirstRun = rows(db);

      runDeltaLakeStatements(db);

      assertEquals(afterFirstRun, rows(db));
    }
  }

  private static String id(String suffix) {
    return "00000000-0000-0000-0000-0000000000" + suffix;
  }

  private static JsonNode customDatabaseConfig() {
    return JsonUtils.readTree("{\"type\": \"CustomDatabase\"}");
  }

  /** Every fixture row except the DeltaLake ones, which the migration is meant to change. */
  private static Map<String, JsonNode> withoutDeltaLake(Map<String, JsonNode> rows) {
    Map<String, JsonNode> others = new TreeMap<>(rows);
    others.keySet().removeIf(key -> key.contains("0000000000d") || key.contains("delta"));
    others.keySet().removeIf(key -> key.endsWith(":" + DELTA_LAKE));
    return others;
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
    db.handle().execute("DROP TABLE IF EXISTS " + String.join(", ", TABLES));
    ddl(db).forEach(db.handle()::execute);
    seedService(db, DELTA_SERVICE, "delta_service", DELTA_LAKE, deltaLakeConfig(), true);
    seedService(db, MYSQL_SERVICE, "mysql_service", "Mysql", mysqlConfig(), false);
    seedPipeline(db, DELTA_SERVICE, DELTA_PIPELINE, "hash-delta-pipeline");
    seedPipeline(db, MYSQL_SERVICE, MYSQL_PIPELINE, "hash-mysql-pipeline");
    for (String name : List.of(DELTA_LAKE, "Mysql")) {
      insert(db, "test_connection_definition", "name", name, "{\"name\": \"%s\"}".formatted(name));
    }
    insertWorkflow(db, id("d8"), DELTA_LAKE);
    insertWorkflow(db, id("a8"), "Mysql");
    return db;
  }

  private static void seedService(
      Database db, String serviceId, String name, String type, String config, boolean deltaLake) {
    String service =
        """
        {"id": "%s", "name": "%s", "serviceType": "%s", "description": "curated",
         "connection": {"config": %s}}"""
            .formatted(serviceId, name, type, config);
    db.handle()
        .createUpdate("INSERT INTO dbservice_entity (json) VALUES (" + db.json("JSONB") + ")")
        .bind("json", service)
        .execute();
    insertExtension(db, serviceId, "databaseService.version.0.1", service);
    for (Child child : CHILDREN) {
      String childId = deltaLake ? child.deltaId() : child.mysqlId();
      String entity =
          """
          {"id": "%s", "name": "%s_%s", "serviceType": "%s", "description": "curated"}"""
              .formatted(childId, name, child.entityType(), type);
      insert(db, child.table(), "id", childId, entity);
      insertExtension(db, childId, child.entityType() + ".version.0.1", entity);
    }
    Child database = CHILDREN.get(0);
    String databaseId = deltaLake ? database.deltaId() : database.mysqlId();
    insertRelationship(db, serviceId, databaseId, "databaseService", "database", 0);
  }

  private static void seedPipeline(Database db, String serviceId, String pipelineId, String hash) {
    db.handle()
        .createUpdate(
            "INSERT INTO ingestion_pipeline_entity (id, fqnHash, json) VALUES (:id, :hash, "
                + db.json("JSON")
                + ")")
        .bind("id", pipelineId)
        .bind("hash", hash)
        .bind("json", "{\"id\": \"%s\", \"name\": \"metadata\"}".formatted(pipelineId))
        .execute();
    insertRelationship(db, serviceId, pipelineId, "databaseService", "ingestionPipeline", 0);
    insertRelationship(db, OWNER, pipelineId, "user", "ingestionPipeline", 8);
    insertExtension(
        db, pipelineId, "ingestionPipeline.version.0.1", "{\"id\": \"%s\"}".formatted(pipelineId));
    db.handle()
        .createUpdate(
            "INSERT INTO entity_extension_time_series (entityFQNHash, extension, json) VALUES "
                + "(:hash, 'ingestionPipeline.pipelineStatus', "
                + db.json("JSONB")
                + ")")
        .bind("hash", hash)
        .bind("json", "{\"runId\": \"run-1\", \"pipelineState\": \"success\"}")
        .execute();
  }

  private static void insertWorkflow(Database db, String workflowId, String connectionType) {
    insert(
        db,
        "automations_workflow",
        "id",
        workflowId,
        """
        {"id": "%s", "workflowType": "TEST_CONNECTION",
         "request": {"connectionType": "%s", "serviceType": "Database"}}"""
            .formatted(workflowId, connectionType));
  }

  private static void insert(Database db, String table, String keyColumn, String key, String json) {
    db.handle()
        .createUpdate(
            "INSERT INTO %s (%s, json) VALUES (:key, %s)"
                .formatted(table, keyColumn, db.json("JSONB")))
        .bind("key", key)
        .bind("json", json)
        .execute();
  }

  private static void insertExtension(Database db, String entityId, String extension, String json) {
    db.handle()
        .createUpdate(
            "INSERT INTO entity_extension (id, extension, jsonSchema, json) VALUES "
                + "(:id, :extension, :schema, "
                + db.json("JSONB")
                + ")")
        .bind("id", entityId)
        .bind("extension", extension)
        .bind("schema", extension.substring(0, extension.indexOf('.')))
        .bind("json", json)
        .execute();
  }

  private static void insertRelationship(
      Database db, String fromId, String toId, String fromEntity, String toEntity, int relation) {
    db.handle()
        .createUpdate(
            "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) "
                + "VALUES (:fromId, :toId, :fromEntity, :toEntity, :relation)")
        .bind("fromId", fromId)
        .bind("toId", toId)
        .bind("fromEntity", fromEntity)
        .bind("toEntity", toEntity)
        .bind("relation", relation)
        .execute();
  }

  /** Every fixture row, keyed by table and primary key, with its JSON parsed for comparison. */
  private static Map<String, JsonNode> rows(Database db) {
    Map<String, JsonNode> rows = new TreeMap<>();
    rows.putAll(keyed(db, "dbservice_entity", "id"));
    for (Child child : CHILDREN) {
      rows.putAll(keyed(db, child.table(), "id"));
    }
    rows.putAll(keyed(db, "ingestion_pipeline_entity", "id"));
    rows.putAll(keyed(db, "test_connection_definition", "name"));
    rows.putAll(keyed(db, "automations_workflow", "id"));
    rows.putAll(keyed(db, "entity_extension", "id", "extension"));
    rows.putAll(keyed(db, "entity_extension_time_series", "entityFQNHash", "extension"));
    db.handle()
        .createQuery("SELECT fromId, toId, relation FROM entity_relationship")
        .map(
            (rs, ctx) ->
                "entity_relationship:%s:%s:%d"
                    .formatted(rs.getString(1), rs.getString(2), rs.getInt(3)))
        .list()
        .forEach(key -> rows.put(key, NullNode.getInstance()));
    return rows;
  }

  private static Map<String, JsonNode> keyed(Database db, String table, String... keyColumns) {
    String keys = String.join(", ", keyColumns);
    Map<String, JsonNode> rows = new TreeMap<>();
    db.handle()
        .createQuery("SELECT %s, %s FROM %s".formatted(keys, db.jsonText("json"), table))
        .map(
            (rs, ctx) -> {
              StringBuilder key = new StringBuilder(table);
              for (int i = 1; i <= keyColumns.length; i++) {
                key.append(':').append(rs.getString(i));
              }
              return Map.entry(
                  key.toString(), JsonUtils.readTree(rs.getString(keyColumns.length + 1)));
            })
        .list()
        .forEach(entry -> rows.put(entry.getKey(), entry.getValue()));
    return rows;
  }

  private static String deltaLakeConfig() {
    return """
        {"type": "DeltaLake", "configSource": {"connection": {"metastoreDb": "jdbc:mysql://m/hive",
         "username": "hive", "password": "fernet:delta-metastore-secret"}}}""";
  }

  private static String mysqlConfig() {
    return """
        {"type": "Mysql", "hostPort": "mysql:3306", "authType": {"password": "fernet:mysql"}}""";
  }

  private static void runDeltaLakeStatements(Database db) {
    deltaLakeStatements(db.dialect()).forEach(statement -> db.handle().execute(statement));
  }

  /** Parsed with the migration framework's own splitter, so it is what an upgrade would execute. */
  private static List<String> deltaLakeStatements(String dialect) {
    ConnectionType connectionType =
        MYSQL_DIALECT.equals(dialect) ? ConnectionType.MYSQL : ConnectionType.POSTGRES;
    List<String> statements =
        MigrationFile.parseSQLFile(migrationFile(dialect).toFile(), connectionType).stream()
            .filter(sql -> sql.contains("'" + DELTA_LAKE + "'"))
            .toList();
    assertEquals(STATEMENT_COUNT, statements.size(), "DeltaLake statements in " + dialect);
    return statements;
  }

  private static Path migrationFile(String dialect) {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve("bootstrap/sql/migrations"))) {
      current = current.getParent();
    }
    assertTrue(current != null, "Could not find the repository root");
    return current.resolve(
        "bootstrap/sql/migrations/native/2.1.0/%s/schemaChanges.sql".formatted(dialect));
  }

  private static final List<String> TABLES =
      List.of(
          "dbservice_entity",
          "database_entity",
          "database_schema_entity",
          "table_entity",
          "stored_procedure_entity",
          "ingestion_pipeline_entity",
          "entity_extension",
          "entity_extension_time_series",
          "entity_relationship",
          "test_connection_definition",
          "automations_workflow");

  private static List<String> ddl(Database db) {
    String jsonb = db.isPostgres() ? "JSONB" : "JSON";
    String serviceTable =
        db.isPostgres()
            ? """
              CREATE TABLE dbservice_entity (
                id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
                serviceType VARCHAR(256) GENERATED ALWAYS AS (json ->> 'serviceType') STORED NOT NULL,
                json JSONB NOT NULL,
                PRIMARY KEY (id))"""
            : """
              CREATE TABLE dbservice_entity (
                id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
                serviceType VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.serviceType') NOT NULL,
                json JSON NOT NULL,
                PRIMARY KEY (id))""";
    Stream<String> children =
        CHILDREN.stream()
            .map(
                child ->
                    "CREATE TABLE %s (id VARCHAR(36) NOT NULL, json %s NOT NULL, PRIMARY KEY (id))"
                        .formatted(child.table(), jsonb));
    return Stream.concat(
            Stream.of(serviceTable),
            Stream.concat(
                children,
                Stream.of(
                    // Postgres keeps ingestion pipelines in a JSON (not JSONB) column.
                    "CREATE TABLE ingestion_pipeline_entity (id VARCHAR(36) NOT NULL, "
                        + "fqnHash VARCHAR(768) NOT NULL, json JSON NOT NULL, PRIMARY KEY (id))",
                    ("CREATE TABLE entity_extension (id VARCHAR(36) NOT NULL, extension "
                            + "VARCHAR(256) NOT NULL, jsonSchema VARCHAR(256) NOT NULL, json %s "
                            + "NOT NULL, PRIMARY KEY (id, extension))")
                        .formatted(jsonb),
                    ("CREATE TABLE entity_extension_time_series (entityFQNHash VARCHAR(768) NOT "
                            + "NULL, extension VARCHAR(256) NOT NULL, json %s NOT NULL)")
                        .formatted(jsonb),
                    ("CREATE TABLE entity_relationship (fromId VARCHAR(36) NOT NULL, toId "
                            + "VARCHAR(36) NOT NULL, fromEntity VARCHAR(256) NOT NULL, toEntity "
                            + "VARCHAR(256) NOT NULL, relation SMALLINT NOT NULL, json %s, "
                            + "PRIMARY KEY (fromId, toId, relation))")
                        .formatted(jsonb),
                    "CREATE TABLE test_connection_definition (name VARCHAR(256) NOT NULL, json %s NOT NULL)"
                        .formatted(jsonb),
                    "CREATE TABLE automations_workflow (id VARCHAR(36) NOT NULL, json %s NOT NULL)"
                        .formatted(jsonb))))
        .toList();
  }
}
