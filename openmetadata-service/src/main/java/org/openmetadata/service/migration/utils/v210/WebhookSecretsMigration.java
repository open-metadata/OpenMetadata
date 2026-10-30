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
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerting.channel.DestinationSecrets;
import org.openmetadata.service.alerting.channel.webhook.ProfileWebhookSecrets;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Brings stored webhook configurations, on alert destinations and on user and team profiles, to the
 * form new writes store: encrypted in the entity row, its versions and the change descriptions
 * recorded with them, and masked in the stored change events of users and teams. Values already in
 * that form are kept, so running it again changes nothing.
 */
@Slf4j
public final class WebhookSecretsMigration {
  public static final String PROFILE_STEP_NAME = "encryptProfileWebhookSecrets";
  public static final String ALERT_STEP_NAME = "encryptAlertDestinationSecrets";
  private static final int PAGE_SIZE = 500;

  private WebhookSecretsMigration() {}

  public static void encryptProfileWebhookSecrets(Handle handle, ConnectionType connectionType) {
    if (isKeyDefined()) {
      Sql sql = new Sql(connectionType);
      for (String table : List.of("user_entity", "team_entity")) {
        rewriteById(handle, sql, table, ProfileWebhookSecrets::encryptEntityTree);
      }
      for (String entityType : List.of(Entity.USER, Entity.TEAM)) {
        rewriteVersions(handle, sql, entityType, ProfileWebhookSecrets::encryptEntityTree);
      }
      rewriteChangeEvents(handle, sql);
    }
  }

  public static void encryptAlertDestinationSecrets(Handle handle, ConnectionType connectionType) {
    if (isKeyDefined()) {
      Sql sql = new Sql(connectionType);
      rewriteById(handle, sql, "event_subscription_entity", DestinationSecrets::encryptAlertTree);
      rewriteVersions(handle, sql, Entity.EVENT_SUBSCRIPTION, DestinationSecrets::encryptAlertTree);
    }
  }

  private static boolean isKeyDefined() {
    boolean defined = Fernet.getInstance().isKeyDefined();
    if (!defined) {
      LOG.info("No Fernet key is configured; webhook secrets stay as stored");
    }
    return defined;
  }

  private static void rewriteById(
      Handle handle, Sql sql, String table, Predicate<JsonNode> transform) {
    String cursor = "";
    int rewritten = 0;
    List<Map<String, Object>> rows;
    do {
      rows =
          handle
              .createQuery(sql.selectById(table))
              .bind("id", cursor)
              .bind("pageSize", PAGE_SIZE)
              .mapToMap()
              .list();
      PreparedBatch batch = handle.prepareBatch(sql.updateById(table));
      for (Map<String, Object> row : rows) {
        cursor = String.valueOf(row.get("id"));
        String json = rewritten(row, transform);
        if (json != null) {
          batch.bind("id", cursor).bind("json", json).add();
        }
      }
      rewritten += execute(batch);
    } while (rows.size() == PAGE_SIZE);
    LOG.info("Encrypted the webhook secrets of {} rows of {}", rewritten, table);
  }

  private static void rewriteVersions(
      Handle handle, Sql sql, String entityType, Predicate<JsonNode> transform) {
    String cursorId = "";
    String cursorExtension = "";
    int rewritten = 0;
    List<Map<String, Object>> rows;
    do {
      rows =
          handle
              .createQuery(sql.selectVersions())
              .bind("prefix", entityType + ".version.%")
              .bind("id", cursorId)
              .bind("extension", cursorExtension)
              .bind("pageSize", PAGE_SIZE)
              .mapToMap()
              .list();
      PreparedBatch batch = handle.prepareBatch(sql.updateVersion());
      for (Map<String, Object> row : rows) {
        cursorId = String.valueOf(row.get("id"));
        cursorExtension = String.valueOf(row.get("extension"));
        String json = rewritten(row, transform);
        if (json != null) {
          batch.bind("id", cursorId).bind("extension", cursorExtension).bind("json", json).add();
        }
      }
      rewritten += execute(batch);
    } while (rows.size() == PAGE_SIZE);
    LOG.info("Encrypted the webhook secrets of {} versions of {}", rewritten, entityType);
  }

  // A change event carries the entity as written and its change description; delivery reads the
  // profile from the user or the team, never from an event, so the event keeps the mask.
  private static void rewriteChangeEvents(Handle handle, Sql sql) {
    long cursor = 0;
    int rewritten = 0;
    List<Map<String, Object>> rows;
    do {
      rows =
          handle
              .createQuery(sql.selectChangeEvents())
              .bind("offset", cursor)
              .bind("pageSize", PAGE_SIZE)
              .mapToMap()
              .list();
      PreparedBatch batch = handle.prepareBatch(sql.updateChangeEvent());
      for (Map<String, Object> row : rows) {
        cursor = ((Number) row.get("event_offset")).longValue();
        String json = rewritten(row, WebhookSecretsMigration::maskChangeEvent);
        if (json != null) {
          batch.bind("offset", cursor).bind("json", json).add();
        }
      }
      rewritten += execute(batch);
    } while (rows.size() == PAGE_SIZE);
    LOG.info("Masked the profile webhook secrets of {} change events", rewritten);
  }

  private static boolean maskChangeEvent(JsonNode event) {
    boolean changed = ProfileWebhookSecrets.maskEntityTree(event);
    JsonNode entity = event.path("entity");
    if (entity.isTextual() && entity.textValue().startsWith("{")) {
      JsonNode entityTree = JsonUtils.readTree(entity.textValue());
      if (ProfileWebhookSecrets.maskEntityTree(entityTree)) {
        ((ObjectNode) event).put("entity", JsonUtils.pojoToJson(entityTree));
        changed = true;
      }
    } else if (entity.isObject()) {
      changed |= ProfileWebhookSecrets.maskEntityTree(entity);
    }
    return changed;
  }

  /** The row's JSON once transformed, or null when it stays as stored or cannot be read. */
  private static String rewritten(Map<String, Object> row, Predicate<JsonNode> transform) {
    String json = null;
    try {
      JsonNode tree = JsonUtils.readTree(String.valueOf(row.get("json")));
      if (transform.test(tree)) {
        json = JsonUtils.pojoToJson(tree);
      }
    } catch (RuntimeException e) {
      LOG.warn("Skipping a row whose webhook secrets could not be encrypted: {}", e.getMessage());
    }
    return json;
  }

  private static int execute(PreparedBatch batch) {
    int size = batch.size();
    if (size > 0) {
      batch.execute();
    }
    return size;
  }

  /** The statements, per database. A row is read only when its JSON could hold a webhook. */
  private record Sql(ConnectionType connectionType) {
    private boolean isMySql() {
      return connectionType == ConnectionType.MYSQL;
    }

    private String jsonText() {
      return isMySql() ? "CAST(json AS CHAR)" : "json::text";
    }

    private String jsonValue() {
      return isMySql() ? ":json" : ":json::jsonb";
    }

    String selectById(String table) {
      return "SELECT id, "
          + jsonText()
          + " AS json FROM "
          + table
          + " WHERE id > :id AND "
          + jsonText()
          + " LIKE '%endpoint%' ORDER BY id LIMIT :pageSize";
    }

    String updateById(String table) {
      return "UPDATE " + table + " SET json = " + jsonValue() + " WHERE id = :id";
    }

    String selectVersions() {
      return "SELECT id, extension, "
          + jsonText()
          + " AS json FROM entity_extension WHERE extension LIKE :prefix AND "
          + jsonText()
          + " LIKE '%endpoint%' AND (id > :id OR (id = :id AND extension > :extension))"
          + " ORDER BY id, extension LIMIT :pageSize";
    }

    String updateVersion() {
      return "UPDATE entity_extension SET json = "
          + jsonValue()
          + " WHERE id = :id AND extension = :extension";
    }

    String selectChangeEvents() {
      String offset = isMySql() ? "`offset`" : "\"offset\"";
      return "SELECT "
          + offset
          + " AS event_offset, "
          + jsonText()
          + " AS json FROM change_event WHERE entityType IN ('user', 'team') AND "
          + offset
          + " > :offset AND "
          + jsonText()
          + " LIKE '%endpoint%' ORDER BY "
          + offset
          + " LIMIT :pageSize";
    }

    String updateChangeEvent() {
      String offset = isMySql() ? "`offset`" : "\"offset\"";
      return "UPDATE change_event SET json = " + jsonValue() + " WHERE " + offset + " = :offset";
    }
  }
}
