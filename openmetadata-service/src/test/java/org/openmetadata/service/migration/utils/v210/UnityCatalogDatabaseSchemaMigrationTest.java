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
import java.util.Map;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.IdBatches;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Runs the 2.1.0 step that removes {@code databaseSchema} from saved Unity Catalog Test Connection
 * requests against real MySQL and PostgreSQL, over more rows than two id batches hold.
 */
@Testcontainers(disabledWithoutDocker = true)
class UnityCatalogDatabaseSchemaMigrationTest {
  private static final String PASSWORD = "uc-database-schema-test";
  private static final String DATABASE = "uc_database_schema_test";
  private static final String MYSQL_DIALECT = "mysql";
  private static final int ROWS = 2 * IdBatches.BATCH_SIZE + 1;

  /** Unity Catalog requests carrying the key, one in each of the three batches. */
  private static final Map<Integer, String> UNITY_CATALOG_WITH_KEY =
      Map.of(1, "\"default\"", IdBatches.BATCH_SIZE + 10, "\"sales\"", ROWS, "null");

  private static final int UNITY_CATALOG_WITHOUT_KEY = 20;
  private static final int DATABRICKS_WITH_KEY = 30;

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

  @ParameterizedTest
  @ValueSource(strings = {MYSQL_DIALECT, "postgres"})
  void removesTheKeyFromUnityCatalogRequestsInEveryBatchAndNothingElse(String dialect) {
    ConnectionType connectionType =
        MYSQL_DIALECT.equals(dialect) ? ConnectionType.MYSQL : ConnectionType.POSTGRES;
    try (Handle handle = open(dialect)) {
      seed(handle, connectionType);

      assertEquals(
          UNITY_CATALOG_WITH_KEY.size(),
          UnityCatalogDatabaseSchemaMigration.removeFromTestConnectionRequests(
              handle, connectionType));

      for (int row : UNITY_CATALOG_WITH_KEY.keySet()) {
        JsonNode config = config(handle, row);
        assertFalse(config.has("databaseSchema"), "row " + row + " keeps the key");
        assertEquals("h:443", config.path("hostPort").asText(), "row " + row + " lost a field");
      }
      assertFalse(config(handle, UNITY_CATALOG_WITHOUT_KEY).has("databaseSchema"));
      assertTrue(
          config(handle, DATABRICKS_WITH_KEY).has("databaseSchema"),
          "a Databricks request keeps the field its connection still has");
      assertEquals(
          0,
          UnityCatalogDatabaseSchemaMigration.removeFromTestConnectionRequests(
              handle, connectionType),
          "a second run changes nothing");
    }
  }

  private static void seed(Handle handle, ConnectionType connectionType) {
    boolean postgres = connectionType == ConnectionType.POSTGRES;
    handle.execute("DROP TABLE IF EXISTS automations_workflow");
    handle.execute(
        "CREATE TABLE automations_workflow (id VARCHAR(36) NOT NULL, json %s NOT NULL, PRIMARY KEY (id))"
            .formatted(postgres ? "JSONB" : "JSON"));
    PreparedBatch insert =
        handle.prepareBatch(
            "INSERT INTO automations_workflow (id, json) VALUES (:id, %s)"
                .formatted(postgres ? "CAST(:json AS JSONB)" : ":json"));
    for (int row = 1; row <= ROWS; row++) {
      insert.bind("id", id(row)).bind("json", request(row)).add();
    }
    insert.execute();
  }

  /** Every other row is a Snowflake request, so most of each batch matches nothing. */
  private static String request(int row) {
    String connectionType = "Snowflake";
    String schema = null;
    if (UNITY_CATALOG_WITH_KEY.containsKey(row)) {
      connectionType = "UnityCatalog";
      schema = UNITY_CATALOG_WITH_KEY.get(row);
    } else if (row == UNITY_CATALOG_WITHOUT_KEY) {
      connectionType = "UnityCatalog";
    } else if (row == DATABRICKS_WITH_KEY) {
      connectionType = "Databricks";
      schema = "\"default\"";
    }
    String databaseSchema = schema == null ? "" : ", \"databaseSchema\": " + schema;
    return """
        {"id": "%s", "workflowType": "TEST_CONNECTION",
         "request": {"connectionType": "%s", "serviceType": "Database",
                     "connection": {"config": {"type": "%s", "hostPort": "h:443"%s}}}}"""
        .formatted(id(row), connectionType, connectionType, databaseSchema);
  }

  private static JsonNode config(Handle handle, int row) {
    String json =
        handle
            .createQuery("SELECT json FROM automations_workflow WHERE id = :id")
            .bind("id", id(row))
            .mapTo(String.class)
            .one();
    return JsonUtils.readTree(json).path("request").path("connection").path("config");
  }

  private static String id(int row) {
    return "00000000-0000-0000-0000-%012d".formatted(row);
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
}
