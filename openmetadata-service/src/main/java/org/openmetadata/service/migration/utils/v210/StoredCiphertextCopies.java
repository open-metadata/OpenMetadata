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
import com.google.common.collect.Lists;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Query;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * The Fernet tokens held by alert destinations that are also stored somewhere else. Fernet
 * encryption is randomized, so a token the server wrote for one destination field is stored at that
 * field only, and in the versions of the alert that holds it. A token found at a second field, in
 * another alert, in a table that holds secrets ({@link #isSecretStore}) or in a version of an entity
 * of those tables is reported. Only those rows are read, so the cost follows the number of
 * services, pipelines, users and apps, never the number of data assets or events. Read before any
 * webhook secret is rewritten.
 */
@Slf4j
final class StoredCiphertextCopies {
  private static final String ALERTS = "event_subscription_entity";
  private static final String VERSIONS = "entity_extension";
  // The tables that hold secrets, as release 2.1 names them; every service table is one too.
  private static final List<String> SECRET_STORES =
      List.of(
          "ingestion_pipeline_entity",
          "user_entity",
          "team_entity",
          "bot_entity",
          "workflow_definition_entity",
          "test_suite",
          "installed_apps",
          "apps_marketplace",
          "automations_workflow",
          "openmetadata_settings",
          "user_session",
          "user_tokens");
  // The tables above whose rows are not versioned entities.
  private static final List<String> UNVERSIONED =
      List.of("openmetadata_settings", "user_session", "user_tokens");
  private static final int ID_BATCH = 500;
  private static final Pattern TOKEN =
      Pattern.compile(StoredWebhookSecrets.FERNET_PREFIX + "[A-Za-z0-9_=-]+");

  private final ConnectionType connectionType;
  // Each token a destination field holds, and the alert of every field that holds it.
  private final Map<String, List<String>> heldBy = new HashMap<>();
  // Where else each of those tokens is stored: an alert or entity id, or a table name.
  private final Map<String, Set<String>> storedIn = new HashMap<>();

  private StoredCiphertextCopies(ConnectionType connectionType) {
    this.connectionType = connectionType;
  }

  static Set<String> find(Handle handle, ConnectionType connectionType) {
    StoredCiphertextCopies copies = new StoredCiphertextCopies(connectionType);
    copies.readAlerts(handle);
    if (!copies.heldBy.isEmpty()) {
      List<String> stores = copies.secretStores(handle);
      copies.readVersions(handle, stores);
      for (String table : stores) {
        copies.readStore(handle, table, null);
      }
    }
    Set<String> found = copies.storedElsewhere();
    LOG.info("{} stored webhook values are held at more than one place", found.size());
    return found;
  }

  private void readAlerts(Handle handle) {
    try (Stream<Map<String, Object>> rows =
        rowsHoldingTokens(handle, ALERTS + " WHERE ", "id", null)) {
      rows.forEach(
          row -> {
            String alertId = String.valueOf(row.get("id"));
            String json = String.valueOf(row.get("json"));
            destinationTokens(JsonUtils.readTree(json))
                .forEach(
                    token -> heldBy.computeIfAbsent(token, it -> new ArrayList<>()).add(alertId));
            tokensIn(json).forEach(token -> storedIn(token, alertId));
          });
    }
  }

  /**
   * Reads the versions of the alerts and of every versioned entity that holds secrets. They are
   * found by their entity's id, through the primary key of the versions table, so no other version
   * is read, on any database and collation. A version belongs to the entity with its id, so an
   * alert's own versions are not elsewhere.
   */
  private void readVersions(Handle handle, List<String> stores) {
    List<String> versioned = new ArrayList<>(List.of(ALERTS));
    stores.stream().filter(table -> !UNVERSIONED.contains(table)).forEach(versioned::add);
    for (String table : versioned) {
      List<String> ids = handle.createQuery("SELECT id FROM " + table).mapTo(String.class).list();
      for (List<String> batch : Lists.partition(ids, ID_BATCH)) {
        readRows(handle, VERSIONS + " WHERE id IN (<ids>) AND ", "id", VERSIONS, batch);
      }
    }
  }

  private void readStore(Handle handle, String table, String idColumn) {
    readRows(handle, table + " WHERE ", idColumn, table, null);
  }

  private void readRows(
      Handle handle, String fromWhere, String idColumn, String table, List<String> ids) {
    try (Stream<Map<String, Object>> rows = rowsHoldingTokens(handle, fromWhere, idColumn, ids)) {
      rows.forEach(
          row -> {
            String place = idColumn == null ? table : String.valueOf(row.get(idColumn));
            tokensIn(String.valueOf(row.get("json")))
                .filter(heldBy::containsKey)
                .forEach(token -> storedIn(token, place));
          });
    }
  }

  private Set<String> storedElsewhere() {
    return heldBy.entrySet().stream()
        .filter(
            held -> {
              String alertId = held.getValue().getFirst();
              boolean elsewhere =
                  storedIn.getOrDefault(held.getKey(), Set.of()).stream()
                      .anyMatch(place -> !place.equals(alertId));
              return held.getValue().size() > 1 || elsewhere;
            })
        .map(Map.Entry::getKey)
        .collect(Collectors.toSet());
  }

  private void storedIn(String token, String place) {
    storedIn.computeIfAbsent(token, it -> new HashSet<>()).add(place);
  }

  private static Stream<String> destinationTokens(JsonNode alert) {
    Stream.Builder<String> tokens = Stream.builder();
    for (JsonNode destination : alert.path("destinations")) {
      JsonNode config = destination.path("config");
      StoredWebhookSecrets.destinationFields(destination).stream()
          .map(field -> config.at(field).asText())
          .filter(StoredWebhookSecrets::isLegacyCiphertext)
          .forEach(tokens::add);
    }
    return tokens.build();
  }

  private static Stream<String> tokensIn(String json) {
    Stream.Builder<String> tokens = Stream.builder();
    Matcher matcher = TOKEN.matcher(json);
    while (matcher.find()) {
      tokens.add(matcher.group());
    }
    return tokens.build();
  }

  // The tables of this database that hold secrets, but the alerts.
  private List<String> secretStores(Handle handle) {
    String schema = isMySql() ? "DATABASE()" : "current_schema()";
    return handle
        .createQuery(
            "SELECT table_name FROM information_schema.columns WHERE table_schema = "
                + schema
                + " AND column_name = 'json'")
        .mapTo(String.class)
        .stream()
        .filter(table -> isSecretStore(table.toLowerCase(Locale.ROOT)))
        .distinct()
        .toList();
  }

  /** Every service table, as each is named for its service, and the other tables with secrets. */
  static boolean isSecretStore(String table) {
    return "dbservice_entity".equals(table)
        || table.endsWith("_service_entity")
        || SECRET_STORES.contains(table);
  }

  // fromWhere names the table and any condition to apply before the JSON is read as text.
  private Stream<Map<String, Object>> rowsHoldingTokens(
      Handle handle, String fromWhere, String idColumn, List<String> ids) {
    String jsonText = isMySql() ? "CAST(json AS CHAR)" : "json::text";
    String id = idColumn == null ? "" : idColumn + ", ";
    Query query =
        handle.createQuery(
            "SELECT "
                + id
                + jsonText
                + " AS json FROM "
                + fromWhere
                + jsonText
                + " LIKE '%"
                + StoredWebhookSecrets.FERNET_PREFIX
                + "%'");
    if (ids != null) {
      query.bindList("ids", ids);
    }
    return query.mapToMap().stream();
  }

  private boolean isMySql() {
    return connectionType == ConnectionType.MYSQL;
  }
}
