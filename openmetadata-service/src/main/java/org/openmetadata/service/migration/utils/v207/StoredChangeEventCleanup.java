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

package org.openmetadata.service.migration.utils.v207;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.SqlStatement;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Removes fields from the entity that stored change events carry. Four tables keep a change event:
 * the event log, the audit log, and each alert's sent and failed events. Depending on the code that
 * wrote it, an event holds its entity as a JSON object or as a string of JSON; both are cleaned.
 */
@Slf4j
public final class StoredChangeEventCleanup {

  private static final int BATCH_SIZE = 500;
  private static final String ENTITY = "entity";
  private static final String EVENT = "event";

  private static final List<EventTable> TABLES =
      List.of(
          new EventTable(
              "change_event", List.of("offset"), "json", true, "", "t.entityType", "t.entityType"),
          new EventTable(
              "audit_log_event",
              List.of("id"),
              "event_json",
              false,
              "",
              "t.entity_type",
              "t.entity_type"),
          new EventTable(
              "successful_sent_change_events",
              List.of("change_event_id", "event_subscription_id"),
              "json",
              true,
              "",
              "t.json ->> '$.entityType'",
              "t.json ->> 'entityType'"),
          new EventTable(
              "consumers_dlq",
              List.of("id", "extension"),
              "json",
              true,
              "changeEvent",
              "t.json ->> '$.changeEvent.entityType'",
              "t.json -> 'changeEvent' ->> 'entityType'"));

  private StoredChangeEventCleanup() {}

  public static void removeEntityFields(
      Handle handle, ConnectionType connectionType, Set<String> entityTypes, Set<String> fields) {
    for (EventTable table : TABLES) {
      int cleaned = table.removeEntityFields(handle, connectionType, entityTypes, fields);
      LOG.info("Removed {} from {} rows of {}", fields, cleaned, table.name());
    }
  }

  static Optional<String> withoutEntityFields(
      String storedJson, String eventPath, Set<String> fields) {
    JsonNode root = JsonUtils.readTree(storedJson);
    JsonNode event = eventPath.isEmpty() ? root : root.path(eventPath);
    JsonNode entity = event.path(ENTITY);
    boolean removed =
        entity.isTextual()
            ? removeFromText((ObjectNode) event, entity.asText(), fields)
            : removeFrom(entity, fields);
    return removed ? Optional.of(JsonUtils.pojoToJson(root)) : Optional.empty();
  }

  private static boolean removeFromText(ObjectNode event, String entityJson, Set<String> fields) {
    JsonNode entity = JsonUtils.readTree(entityJson);
    boolean removed = removeFrom(entity, fields);
    if (removed) {
      event.put(ENTITY, JsonUtils.pojoToJson(entity));
    }
    return removed;
  }

  private static boolean removeFrom(JsonNode entity, Set<String> fields) {
    boolean present = entity.isObject() && fields.stream().anyMatch(entity::has);
    if (present) {
      ((ObjectNode) entity).remove(fields);
    }
    return present;
  }

  private record EventTable(
      String name,
      List<String> keys,
      String jsonColumn,
      boolean jsonTyped,
      String eventPath,
      String mysqlEntityType,
      String postgresEntityType) {

    int removeEntityFields(
        Handle handle, ConnectionType connectionType, Set<String> entityTypes, Set<String> fields) {
      int cleaned = 0;
      List<Map<String, Object>> batch = nextBatch(handle, connectionType, entityTypes, null);
      while (!batch.isEmpty()) {
        cleaned += cleanBatch(handle, connectionType, batch, fields);
        Map<String, Object> last = batch.get(batch.size() - 1);
        batch = nextBatch(handle, connectionType, entityTypes, last);
      }
      return cleaned;
    }

    private int cleanBatch(
        Handle handle,
        ConnectionType connectionType,
        List<Map<String, Object>> batch,
        Set<String> fields) {
      int cleaned = 0;
      for (Map<String, Object> row : batch) {
        Optional<String> json = withoutEntityFields((String) row.get(EVENT), eventPath, fields);
        json.ifPresent(value -> update(handle, connectionType, row, value));
        cleaned += json.isPresent() ? 1 : 0;
      }
      return cleaned;
    }

    private List<Map<String, Object>> nextBatch(
        Handle handle,
        ConnectionType connectionType,
        Set<String> entityTypes,
        Map<String, Object> after) {
      String afterClause = after == null ? "" : " AND " + keyTuple() + " > " + bindTuple();
      String sql =
          String.format(
              "SELECT %s, %s AS event FROM %s t WHERE %s IN (<entityTypes>)%s ORDER BY %s LIMIT %d",
              keyList(),
              jsonAsText(connectionType),
              name,
              entityType(connectionType),
              afterClause,
              keyList(),
              BATCH_SIZE);
      return bindKeys(
              handle.createQuery(sql).bindList("entityTypes", List.copyOf(entityTypes)), after)
          .mapToMap()
          .list();
    }

    private void update(
        Handle handle, ConnectionType connectionType, Map<String, Object> row, String json) {
      String sql =
          String.format(
              "UPDATE %s t SET %s = %s WHERE %s = %s",
              name, jsonColumn, jsonValue(connectionType), keyTuple(), bindTuple());
      bindKeys(handle.createUpdate(sql).bind(EVENT, json), row).execute();
    }

    private <S extends SqlStatement<S>> S bindKeys(S statement, Map<String, Object> row) {
      if (row != null) {
        IntStream.range(0, keys.size()).forEach(i -> statement.bind("k" + i, row.get(keys.get(i))));
      }
      return statement;
    }

    private String keyList() {
      return keys.stream().map(key -> "t." + key).collect(Collectors.joining(", "));
    }

    private String keyTuple() {
      return "(" + keyList() + ")";
    }

    private String bindTuple() {
      return IntStream.range(0, keys.size())
          .mapToObj(i -> ":k" + i)
          .collect(Collectors.joining(", ", "(", ")"));
    }

    private String entityType(ConnectionType connectionType) {
      return connectionType == ConnectionType.MYSQL ? mysqlEntityType : postgresEntityType;
    }

    private String jsonAsText(ConnectionType connectionType) {
      return connectionType == ConnectionType.MYSQL
          ? "CAST(t." + jsonColumn + " AS CHAR)"
          : "t." + jsonColumn + "::text";
    }

    private String jsonValue(ConnectionType connectionType) {
      boolean jsonb = connectionType == ConnectionType.POSTGRES && jsonTyped;
      return jsonb ? "CAST(:event AS jsonb)" : ":event";
    }
  }
}
