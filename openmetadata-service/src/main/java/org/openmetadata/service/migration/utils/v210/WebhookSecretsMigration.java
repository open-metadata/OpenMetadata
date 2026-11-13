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
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Brings stored webhook configurations, on alert destinations and on user and team profiles, to the
 * form new writes store: in the entity row, each secret encrypted for the destination or profile
 * webhook that holds it, and in its versions, the change descriptions recorded with them and the
 * stored change events, the mask, since nothing sends from those. Plaintext is encrypted for its
 * webhook. Ciphertext is carried over where releases before 2.1 stored it encrypted, the bearer and
 * OAuth2 credentials of an alert destination, each copy for the destination that holds it; any
 * other value stays as stored and is entered again before its webhook sends. Values already in that
 * form are kept, so running it again changes nothing. The
 * rules it applies are frozen in {@link StoredWebhookSecrets}; a row it cannot read stops the step
 * with an error that names the row.
 */
@Slf4j
public final class WebhookSecretsMigration {
  public static final String PROFILE_STEP_NAME = "bindProfileWebhookSecrets";
  public static final String ALERT_STEP_NAME = "bindAlertDestinationSecrets";
  private static final int PAGE_SIZE = 500;
  private static final String USER = "user";
  private static final String TEAM = "team";
  private static final String ALERT = "eventsubscription";

  private WebhookSecretsMigration() {}

  public static void bindProfileWebhookSecrets(Handle handle, ConnectionType connectionType) {
    if (isKeyDefined()) {
      Sql sql = new Sql(connectionType);
      StoredWebhookSecrets secrets = new StoredWebhookSecrets(Fernet.getInstance().getCachedKeys());
      rewriteById(handle, sql, "user_entity", row -> secrets.bindProfileEntity(USER, row));
      rewriteById(handle, sql, "team_entity", row -> secrets.bindProfileEntity(TEAM, row));
      rewriteVersions(handle, sql, "user_entity", USER, StoredWebhookSecrets::maskProfileEntity);
      rewriteVersions(handle, sql, "team_entity", TEAM, StoredWebhookSecrets::maskProfileEntity);
      rewriteChangeEvents(
          handle, sql, List.of(USER, TEAM), StoredWebhookSecrets::maskProfileEntity);
    }
  }

  public static void bindAlertDestinationSecrets(Handle handle, ConnectionType connectionType) {
    if (isKeyDefined()) {
      Sql sql = new Sql(connectionType);
      StoredWebhookSecrets secrets = new StoredWebhookSecrets(Fernet.getInstance().getCachedKeys());
      rewriteById(handle, sql, "event_subscription_entity", secrets::bindAlert);
      rewriteVersions(
          handle, sql, "event_subscription_entity", ALERT, StoredWebhookSecrets::maskAlert);
      rewriteChangeEvents(handle, sql, List.of(ALERT), StoredWebhookSecrets::maskAlert);
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
        String json = rewritten(row, transform, table + " row " + cursor);
        if (json != null) {
          batch.bind("id", cursor).bind("json", json).add();
        }
      }
      rewritten += execute(batch);
    } while (rows.size() == PAGE_SIZE);
    LOG.info("Bound the webhook secrets of {} rows of {}", rewritten, table);
  }

  /**
   * Masks the versions of every row of {@code table}. Versions are found by their entity's id,
   * through the primary key of the versions table, so no other entity's versions are read, on any
   * database and collation.
   */
  private static void rewriteVersions(
      Handle handle, Sql sql, String table, String entityType, Predicate<JsonNode> transform) {
    int rewritten = 0;
    List<String> ids = idPage(handle, table, "", PAGE_SIZE);
    while (!ids.isEmpty()) {
      List<Map<String, Object>> rows =
          handle
              .createQuery(sql.selectVersions())
              .bindList("ids", ids)
              .bind("prefix", entityType + ".version.%")
              .mapToMap()
              .list();
      PreparedBatch update = handle.prepareBatch(sql.updateVersion());
      for (Map<String, Object> row : rows) {
        String id = String.valueOf(row.get("id"));
        String extension = String.valueOf(row.get("extension"));
        String json = rewritten(row, transform, "version " + extension + " of " + id);
        if (json != null) {
          update.bind("id", id).bind("extension", extension).bind("json", json).add();
        }
      }
      rewritten += execute(update);
      ids = ids.size() < PAGE_SIZE ? List.of() : idPage(handle, table, ids.getLast(), PAGE_SIZE);
    }
    LOG.info("Masked the webhook secrets of {} versions of {}", rewritten, entityType);
  }

  /** The next {@code size} ids of {@code table} after {@code after}, so no table is held whole. */
  private static List<String> idPage(Handle handle, String table, String after, int size) {
    return handle
        .createQuery("SELECT id FROM " + table + " WHERE id > :after ORDER BY id LIMIT :size")
        .bind("after", after)
        .bind("size", size)
        .mapTo(String.class)
        .list();
  }

  // A change event carries the entity as written and its change description; nothing sends from an
  // event, so it keeps the mask.
  private static void rewriteChangeEvents(
      Handle handle, Sql sql, List<String> entityTypes, Predicate<JsonNode> maskEntity) {
    long cursor = 0;
    int rewritten = 0;
    List<Map<String, Object>> rows;
    do {
      rows =
          handle
              .createQuery(sql.selectChangeEvents())
              .bindList("entityTypes", entityTypes)
              .bind("offset", cursor)
              .bind("pageSize", PAGE_SIZE)
              .mapToMap()
              .list();
      PreparedBatch batch = handle.prepareBatch(sql.updateChangeEvent());
      for (Map<String, Object> row : rows) {
        cursor = ((Number) row.get("event_offset")).longValue();
        String json =
            rewritten(
                row,
                event -> StoredWebhookSecrets.maskChangeEvent(event, maskEntity),
                "change event " + cursor);
        if (json != null) {
          batch.bind("offset", cursor).bind("json", json).add();
        }
      }
      rewritten += execute(batch);
    } while (rows.size() == PAGE_SIZE);
    LOG.info("Masked the webhook secrets of {} change events of {}", rewritten, entityTypes);
  }

  /**
   * The row's JSON once transformed, or null when it stays as stored. A row that cannot be read or
   * rewritten stops the step, naming the row, rather than being left as it is.
   */
  private static String rewritten(
      Map<String, Object> row, Predicate<JsonNode> transform, String rowName) {
    try {
      JsonNode tree = JsonUtils.readTree(String.valueOf(row.get("json")));
      return transform.test(tree) ? JsonUtils.pojoToJson(tree) : null;
    } catch (RuntimeException e) {
      throw new IllegalStateException(
          "The webhook secrets of " + rowName + " could not be brought to the 2.1 form", e);
    }
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
          + " AS json FROM entity_extension WHERE id IN (<ids>) AND extension LIKE :prefix AND "
          + jsonText()
          + " LIKE '%endpoint%'";
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
          + " AS json FROM change_event WHERE entityType IN (<entityTypes>) AND "
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
