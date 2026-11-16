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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.IdBatches;
import org.openmetadata.service.migration.utils.v210.ODCSCustomPropertiesMigration;

@Isolated("migrates current data contracts and their version history")
class ODCSCustomPropertiesMigrationIT {
  private static final String LEGACY_RULES =
      """
      [{"rule":"rowCount","customProperties":{"threshold":3000000000,
      "enabled":true,"unset":null,"payload":{"customProperties":{"keep":"map"}}}}]
      """;

  @Test
  void migratesCurrentAndHistoricalContractsAcrossPagesAndIsIdempotent() throws Exception {
    try (Handle handle = TestSuiteBootstrap.getJdbi().open()) {
      handle.begin();
      try {
        String id = UUID.randomUUID().toString();
        String orphanId = UUID.randomUUID().toString();
        seed(handle, id, orphanId);
        assertTrue(
            ODCSCustomPropertiesMigration.migrate(handle, dialect()) >= IdBatches.BATCH_SIZE + 3);
        assertCurrentAndHistory(handle, id, orphanId);
        assertEquals(0, ODCSCustomPropertiesMigration.migrate(handle, dialect()));
      } finally {
        handle.rollback();
      }
    }
  }

  private static void seed(Handle handle, String id, String orphanId) {
    String json = contractJson(id);
    handle
        .createUpdate(
            "INSERT INTO data_contract_entity (fqnHash, json) VALUES (:id, " + jsonValue() + ")")
        .bind("id", id)
        .bind("json", json)
        .execute();
    for (int version = 0; version <= IdBatches.BATCH_SIZE; version++) {
      insertVersion(handle, id, "dataContract.version." + version, "dataContract", json);
    }
    insertVersion(
        handle, orphanId, "dataContract.version.0.1", "dataContract", contractJson(orphanId));
    insertVersion(handle, id, "table.version.0.1", "table", json);
    insertVersion(handle, id, "dataContract.other", "dataContract", json);
  }

  private static String contractJson(String id) {
    ObjectNode contract = JsonUtils.getObjectMapper().createObjectNode();
    contract
        .put("id", id)
        .put("name", "odcs_" + id)
        .put("fullyQualifiedName", "odcs_" + id)
        .put("updatedAt", 1000)
        .put("updatedBy", "admin")
        .put("deleted", false);
    contract.set("odcsQualityRules", JsonUtils.readTree(LEGACY_RULES));
    return contract.toString();
  }

  private static void insertVersion(
      Handle handle, String id, String extension, String schema, String json) {
    handle
        .createUpdate(
            "INSERT INTO entity_extension (id, extension, jsonSchema, json) "
                + "VALUES (:id, :extension, :schema, "
                + jsonValue()
                + ")")
        .bind("id", id)
        .bind("extension", extension)
        .bind("schema", schema)
        .bind("json", json)
        .execute();
  }

  private static void assertCurrentAndHistory(Handle handle, String id, String orphanId)
      throws Exception {
    String current =
        handle
            .createQuery("SELECT json FROM data_contract_entity WHERE id = :id")
            .bind("id", id)
            .mapTo(String.class)
            .one();
    assertMigrated(current);
    var versions =
        handle
            .createQuery(
                "SELECT json FROM entity_extension WHERE id IN (:id, :orphan) "
                    + "AND jsonSchema = 'dataContract' AND extension LIKE 'dataContract.version.%'")
            .bind("id", id)
            .bind("orphan", orphanId)
            .mapTo(String.class)
            .list();
    assertEquals(IdBatches.BATCH_SIZE + 2, versions.size());
    for (String version : versions) {
      assertMigrated(version);
    }
    assertOtherExtensionsUnchanged(handle, id);
  }

  private static void assertMigrated(String json) throws Exception {
    JsonNode properties = JsonUtils.readTree(json).at("/odcsQualityRules/0/customProperties");
    assertTrue(properties.isArray());
    assertEquals(4, properties.size());
    DataContract contract = JsonUtils.readValue(json, DataContract.class);
    var values = contract.getOdcsQualityRules().getFirst().getCustomProperties();
    assertTrue(
        values.stream()
            .anyMatch(
                value ->
                    "threshold".equals(value.getProperty())
                        && Long.valueOf(3_000_000_000L).equals(value.getValue())));
    assertTrue(
        values.stream()
            .anyMatch(
                value ->
                    "enabled".equals(value.getProperty())
                        && Boolean.TRUE.equals(value.getValue())));
    assertTrue(
        values.stream()
            .anyMatch(value -> "unset".equals(value.getProperty()) && value.getValue() == null));
    assertTrue(
        values.stream()
            .anyMatch(
                value ->
                    "payload".equals(value.getProperty())
                        && JsonUtils.valueToTree(value.getValue())
                            .at("/customProperties/keep")
                            .asText()
                            .equals("map")));
  }

  private static void assertOtherExtensionsUnchanged(Handle handle, String id) {
    var others =
        handle
            .createQuery(
                "SELECT json FROM entity_extension WHERE id = :id "
                    + "AND extension IN ('table.version.0.1', 'dataContract.other')")
            .bind("id", id)
            .mapTo(String.class)
            .list();
    assertEquals(2, others.size());
    others.forEach(
        json ->
            assertTrue(
                JsonUtils.readTree(json).at("/odcsQualityRules/0/customProperties").isObject()));
  }

  private static String jsonValue() {
    return dialect() == ConnectionType.MYSQL ? ":json" : "CAST(:json AS JSONB)";
  }

  private static ConnectionType dialect() {
    return "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
        ? ConnectionType.MYSQL
        : ConnectionType.POSTGRES;
  }
}
