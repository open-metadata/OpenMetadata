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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/** Backfills persisted authorization and subscription resource references for Conversation V2. */
@Slf4j
public final class ConversationReferenceMigration {
  private static final String LEGACY_RESOURCE = "thread";
  private static final String CONVERSATION_RESOURCE = "conversation";
  private static final List<String> REFERENCE_TABLES =
      List.of("policy_entity", "event_subscription_entity");

  private ConversationReferenceMigration() {}

  public static MigrationSummary migrate(Handle handle, ConnectionType connectionType) {
    int rowsScanned = 0;
    int rowsUpdated = 0;
    for (String table : REFERENCE_TABLES) {
      if (tableExists(handle, table)) {
        TableSummary summary = migrateTable(handle, connectionType, table);
        rowsScanned += summary.rowsScanned();
        rowsUpdated += summary.rowsUpdated();
      }
    }
    MigrationSummary summary = new MigrationSummary(rowsScanned, rowsUpdated);
    LOG.info("Conversation resource reference migration complete: {}", summary);
    return summary;
  }

  static boolean replaceThreadReferences(JsonNode node) {
    boolean changed = false;
    if (node instanceof ObjectNode object) {
      changed = replaceObjectValues(object);
    } else if (node instanceof ArrayNode array) {
      changed = replaceArrayValues(array);
    }
    return changed;
  }

  private static TableSummary migrateTable(
      Handle handle, ConnectionType connectionType, String table) {
    List<Map<String, Object>> rows =
        handle.createQuery("SELECT id, json FROM " + table).mapToMap().list();
    int updated = 0;
    for (Map<String, Object> row : rows) {
      ObjectNode json = (ObjectNode) JsonUtils.readTree(row.get("json").toString());
      if (replaceThreadReferences(json)) {
        updateJson(handle, connectionType, table, row.get("id").toString(), json.toString());
        updated++;
      }
    }
    return new TableSummary(rows.size(), updated);
  }

  private static boolean replaceObjectValues(ObjectNode object) {
    boolean changed = false;
    for (Map.Entry<String, JsonNode> field : object.properties()) {
      JsonNode value = field.getValue();
      if (value.isTextual()) {
        String replacement = replaceResourceText(value.asText());
        if (!replacement.equals(value.asText())) {
          object.set(field.getKey(), TextNode.valueOf(replacement));
          changed = true;
        }
      } else if (replaceThreadReferences(value)) {
        changed = true;
      }
    }
    return changed;
  }

  private static boolean replaceArrayValues(ArrayNode array) {
    boolean changed = false;
    for (int index = 0; index < array.size(); index++) {
      JsonNode value = array.get(index);
      if (value.isTextual()) {
        String replacement = replaceResourceText(value.asText());
        if (!replacement.equals(value.asText())) {
          array.set(index, TextNode.valueOf(replacement));
          changed = true;
        }
      } else if (replaceThreadReferences(value)) {
        changed = true;
      }
    }
    return changed;
  }

  private static String replaceResourceText(String value) {
    String replacement = value;
    if (LEGACY_RESOURCE.equalsIgnoreCase(value)) {
      replacement = CONVERSATION_RESOURCE;
    } else {
      replacement =
          value
              .replace("'thread'", "'conversation'")
              .replace("\"thread\"", "\"conversation\"")
              .replace("'Thread'", "'conversation'")
              .replace("\"Thread\"", "\"conversation\"");
    }
    return replacement;
  }

  private static void updateJson(
      Handle handle, ConnectionType connectionType, String table, String id, String json) {
    String jsonValue = connectionType == ConnectionType.POSTGRES ? ":json::jsonb" : ":json";
    handle
        .createUpdate("UPDATE " + table + " SET json = " + jsonValue + " WHERE id = :id")
        .bind("json", json)
        .bind("id", id)
        .execute();
  }

  private static boolean tableExists(Handle handle, String table) {
    boolean exists;
    try {
      handle.createQuery("SELECT 1 FROM " + table + " LIMIT 1").mapTo(Integer.class).findFirst();
      exists = true;
    } catch (RuntimeException exception) {
      exists = false;
    }
    return exists;
  }

  public record MigrationSummary(int rowsScanned, int rowsUpdated) {}

  private record TableSummary(int rowsScanned, int rowsUpdated) {}
}
