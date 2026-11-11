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

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectReader;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.IdBatches;

/** Repairs stored ODCS quality rules before the new array-typed model deserializes them. */
@Slf4j
public final class ODCSCustomPropertiesMigration {
  private static final String CUSTOM_PROPERTIES = "customProperties";
  private static final ObjectReader READER =
      JsonUtils.getObjectMapper().reader().with(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS);

  private ODCSCustomPropertiesMigration() {}

  public static int migrate(Handle handle, ConnectionType connectionType) {
    int current =
        IdBatches.fold(
            handle,
            "data_contract_entity",
            0,
            (count, ids) -> count + migrateCurrentBatch(handle, connectionType, ids));
    int migrated = current + migrateHistory(handle, connectionType);
    LOG.info("Migrated ODCS custom properties in {} contract rows and versions", migrated);
    return migrated;
  }

  private static int migrateCurrentBatch(
      Handle handle, ConnectionType connectionType, List<String> ids) {
    List<StoredContract> rows =
        handle
            .createQuery("SELECT id, json FROM data_contract_entity WHERE id IN (<ids>)")
            .bindList("ids", ids)
            .map((rs, ctx) -> new StoredContract(rs.getString("id"), null, rs.getString("json")))
            .list();
    return migrateRows(handle, connectionType, rows);
  }

  private static int migrateHistory(Handle handle, ConnectionType connectionType) {
    int migrated = 0;
    List<StoredContract> batch = nextVersions(handle, "", "");
    while (!batch.isEmpty()) {
      migrated += migrateRows(handle, connectionType, batch);
      StoredContract last = batch.getLast();
      batch = nextVersions(handle, last.id(), last.extension());
    }
    return migrated;
  }

  private static List<StoredContract> nextVersions(
      Handle handle, String afterId, String afterExtension) {
    // A contract can have more than one page of versions under the same id.
    return handle
        .createQuery(
            "SELECT id, extension, json FROM entity_extension "
                + "WHERE jsonSchema = 'dataContract' AND extension LIKE 'dataContract.version.%' "
                + "AND (id > :afterId OR (id = :afterId AND extension > :afterExtension)) "
                + "ORDER BY id, extension LIMIT :limit")
        .bind("afterId", afterId)
        .bind("afterExtension", afterExtension)
        .bind("limit", IdBatches.BATCH_SIZE)
        .map(
            (rs, ctx) ->
                new StoredContract(
                    rs.getString("id"), rs.getString("extension"), rs.getString("json")))
        .list();
  }

  private static int migrateRows(
      Handle handle, ConnectionType connectionType, List<StoredContract> rows) {
    int migrated = 0;
    for (StoredContract row : rows) {
      String json = migrateJson(row.json());
      if (!json.equals(row.json())) {
        update(handle, connectionType, row, json);
        migrated++;
      }
    }
    return migrated;
  }

  private static void update(
      Handle handle, ConnectionType connectionType, StoredContract row, String json) {
    boolean history = row.extension() != null;
    String table = history ? "entity_extension" : "data_contract_entity";
    String value = connectionType == ConnectionType.MYSQL ? ":json" : "CAST(:json AS JSONB)";
    var update =
        handle
            .createUpdate(
                "UPDATE "
                    + table
                    + " SET json = "
                    + value
                    + " WHERE id = :id"
                    + (history ? " AND extension = :extension" : ""))
            .bind("id", row.id())
            .bind("json", json);
    if (history) {
      update.bind("extension", row.extension());
    }
    update.execute();
  }

  static String migrateJson(String json) {
    try {
      JsonNode contract = READER.readTree(json);
      return rewriteRules(contract.path("odcsQualityRules")) ? contract.toString() : json;
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException(
          "Cannot migrate ODCS custom properties in invalid contract JSON", e);
    }
  }

  private static boolean rewriteRules(JsonNode rules) {
    boolean changed = false;
    if (rules.isArray()) {
      for (JsonNode rule : rules) {
        if (rule instanceof ObjectNode holder
            && holder.get(CUSTOM_PROPERTIES) instanceof ObjectNode properties) {
          ArrayNode pairs = holder.arrayNode();
          properties
              .properties()
              .forEach(
                  property ->
                      pairs
                          .addObject()
                          .put("property", property.getKey())
                          .set("value", property.getValue()));
          holder.set(CUSTOM_PROPERTIES, pairs);
          changed = true;
        }
      }
    }
    return changed;
  }

  private record StoredContract(String id, String extension, String json) {}
}
