package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.MetricMigrationSqlFixture.currentConnectionType;
import static org.openmetadata.it.tests.MetricMigrationSqlFixture.readMigrationScripts;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * The 2.1.0 and 2.1.1 migrations move context memories from their own {@code status}
 * onto the shared {@code entityStatus} vocabulary, in the memory table and its version history. Runs the shipped
 * statements against copies of those tables, twice, to prove they are complete and idempotent.
 */
@Isolated("executes the shipped memory status migration statements against the shared database")
class ContextMemoryStatusMigrationIT {
  private static final String MEMORY_TABLE = "context_memory";
  private static final String EXTENSION_TABLE = "entity_extension";
  private static final String MEMORY_SCHEMA = "contextMemory";

  @Test
  void migrationMovesMemoryStatusOntoEntityStatus() throws Exception {
    ConnectionType connectionType = currentConnectionType();
    List<String> statements = memoryStatusStatements(connectionType);
    assertEquals(
        5, statements.size(), "three memory-table updates and two version-history updates");
    String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    String memoryTable = "it_memory_status_" + suffix;
    String extensionTable = "it_memory_versions_" + suffix;
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();
    try {
      jdbi.useHandle(
          handle -> {
            createFixture(handle, memoryTable, extensionTable, connectionType);
            for (String statement : statements) {
              String fixtureStatement =
                  statement
                      .replace("UPDATE " + MEMORY_TABLE, "UPDATE " + memoryTable)
                      .replace("UPDATE " + EXTENSION_TABLE, "UPDATE " + extensionTable);
              handle.execute(fixtureStatement);
              handle.execute(fixtureStatement);
            }
            assertMemories(readJson(handle, memoryTable));
            assertVersionHistory(readJson(handle, extensionTable));
          });
    } finally {
      jdbi.useHandle(
          handle -> {
            handle.execute("DROP TABLE IF EXISTS " + memoryTable);
            handle.execute("DROP TABLE IF EXISTS " + extensionTable);
          });
    }
  }

  private static List<String> memoryStatusStatements(ConnectionType connectionType)
      throws Exception {
    List<String> statements = new ArrayList<>();
    statements.addAll(
        readMigrationScripts(connectionType).postStatements().stream()
            .filter(
                statement ->
                    statement.contains("UPDATE " + MEMORY_TABLE)
                        || (statement.contains("UPDATE " + EXTENSION_TABLE)
                            && statement.contains("'" + MEMORY_SCHEMA + "'")))
            .toList());
    statements.addAll(MetricMigrationSqlFixture.readSchemaStatements("2.1.1", connectionType));
    return List.copyOf(statements);
  }

  private static void createFixture(
      Handle handle, String memoryTable, String extensionTable, ConnectionType connectionType) {
    String jsonType = connectionType == ConnectionType.MYSQL ? "JSON" : "JSONB";
    handle.execute(
        "CREATE TABLE " + memoryTable + " (id VARCHAR(36) PRIMARY KEY, json " + jsonType + ")");
    handle.execute(
        "CREATE TABLE "
            + extensionTable
            + " (id VARCHAR(36) PRIMARY KEY, jsonSchema VARCHAR(256), json "
            + jsonType
            + ")");
    insert(handle, memoryTable, connectionType, "active", "{\"status\":\"Active\"}");
    insert(handle, memoryTable, connectionType, "draft", "{\"status\":\"Draft\"}");
    insert(handle, memoryTable, connectionType, "archived", "{\"status\":\"Archived\"}");
    insert(handle, memoryTable, connectionType, "superseded", "{\"status\":\"Superseded\"}");
    insert(handle, memoryTable, connectionType, "invalidated", "{\"status\":\"Invalidated\"}");
    insert(handle, memoryTable, connectionType, "nullStatus", "{\"status\":null}");
    insert(handle, memoryTable, connectionType, "noStatus", "{\"name\":\"noStatus\"}");
    insert(handle, memoryTable, connectionType, "staged", "{\"entityStatus\":\"Superseded\"}");
    insertVersion(handle, extensionTable, connectionType, "memoryVersion", MEMORY_SCHEMA);
    insertVersion(
        handle,
        extensionTable,
        connectionType,
        "memoryRetiredVersion",
        MEMORY_SCHEMA,
        "Superseded");
    insertVersion(handle, extensionTable, connectionType, "termVersion", "glossaryTerm");
  }

  private static void insert(
      Handle handle, String table, ConnectionType connectionType, String id, String json) {
    handle
        .createUpdate(
            "INSERT INTO " + table + " (id, json) VALUES (:id, " + jsonValue(connectionType) + ")")
        .bind("id", id)
        .bind("json", json)
        .execute();
  }

  private static void insertVersion(
      Handle handle, String table, ConnectionType connectionType, String id, String jsonSchema) {
    insertVersion(handle, table, connectionType, id, jsonSchema, "Draft");
  }

  private static void insertVersion(
      Handle handle,
      String table,
      ConnectionType connectionType,
      String id,
      String jsonSchema,
      String status) {
    handle
        .createUpdate(
            "INSERT INTO "
                + table
                + " (id, jsonSchema, json) VALUES (:id, :jsonSchema, "
                + jsonValue(connectionType)
                + ")")
        .bind("id", id)
        .bind("jsonSchema", jsonSchema)
        .bind("json", "{\"status\":\"" + status + "\"}")
        .execute();
  }

  private static String jsonValue(ConnectionType connectionType) {
    return connectionType == ConnectionType.MYSQL ? ":json" : "CAST(:json AS JSONB)";
  }

  private static Map<String, JsonNode> readJson(Handle handle, String table) {
    return handle.createQuery("SELECT id, json FROM " + table).mapToMap().list().stream()
        .collect(
            Collectors.toMap(
                row -> row.get("id").toString(),
                row -> JsonUtils.readTree(row.get("json").toString())));
  }

  private static void assertMemories(Map<String, JsonNode> memories) {
    assertEquals("Approved", stage(memories, "active"));
    assertEquals("Draft", stage(memories, "draft"));
    assertEquals("Archived", stage(memories, "archived"));
    assertEquals("Deprecated", stage(memories, "superseded"));
    assertEquals("Rejected", stage(memories, "invalidated"));
    assertEquals("Approved", stage(memories, "nullStatus"), "a memory without status was Active");
    assertEquals("Approved", stage(memories, "noStatus"), "a memory without status was Active");
    assertEquals("Deprecated", stage(memories, "staged"), "an existing stage is left alone");
    memories.forEach((id, json) -> assertFalse(json.has("status"), id + " still has status"));
  }

  private static void assertVersionHistory(Map<String, JsonNode> versions) {
    assertEquals("Draft", stage(versions, "memoryVersion"));
    assertEquals("Deprecated", stage(versions, "memoryRetiredVersion"));
    assertFalse(versions.get("memoryVersion").has("status"));
    assertFalse(versions.get("memoryRetiredVersion").has("status"));
    assertTrue(versions.get("termVersion").has("status"), "other entities' history is untouched");
    assertFalse(versions.get("termVersion").has("entityStatus"));
  }

  private static String stage(Map<String, JsonNode> rows, String id) {
    return rows.get(id).path("entityStatus").asText(null);
  }
}
