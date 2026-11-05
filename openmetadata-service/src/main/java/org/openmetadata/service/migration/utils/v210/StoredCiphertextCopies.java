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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.alerting.channel.WebhookSecrets;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.secrets.OwnedCiphertext;

/**
 * The Fernet tokens held by alert destinations that are also stored somewhere else. Fernet
 * encryption is randomized, so a token the server wrote for one destination field is stored at that
 * field only, and in the history of the alert that holds it: its versions, its change descriptions
 * and the change events recorded for it. A token found at a second field, in another alert, or in
 * any other row of any table with a {@code json} column is reported. Read before any webhook secret
 * is rewritten.
 */
@Slf4j
final class StoredCiphertextCopies {
  private static final String ALERTS = "event_subscription_entity";
  private static final String VERSIONS = "entity_extension";
  private static final String ALERT_ENTITY_TYPE = "eventsubscription";
  private static final List<String> EVENT_FIELDS = List.of("", "/changeEvent");
  private static final Pattern TOKEN = Pattern.compile(Fernet.FERNET_PREFIX + "[A-Za-z0-9_=-]+");

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
      copies.readStore(handle, VERSIONS, "id");
      for (String table : copies.otherStores(handle)) {
        copies.readStore(handle, table, null);
      }
    }
    Set<String> found = copies.storedElsewhere();
    LOG.info("{} stored webhook values are held at more than one place", found.size());
    return found;
  }

  private void readAlerts(Handle handle) {
    try (Stream<Map<String, Object>> rows = rowsHoldingTokens(handle, ALERTS, "id")) {
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

  private void readStore(Handle handle, String table, String idColumn) {
    try (Stream<Map<String, Object>> rows = rowsHoldingTokens(handle, table, idColumn)) {
      rows.forEach(
          row -> {
            String json = String.valueOf(row.get("json"));
            List<String> held = tokensIn(json).filter(heldBy::containsKey).toList();
            if (!held.isEmpty()) {
              String place =
                  idColumn == null ? placeOf(json, table) : String.valueOf(row.get(idColumn));
              held.forEach(token -> storedIn(token, place));
            }
          });
    }
  }

  // A change event recorded for an alert, as stored or inside a failed event, is that alert's own
  // history; any other row is a place of its own.
  private static String placeOf(String json, String table) {
    JsonNode row = JsonUtils.readTree(json);
    return EVENT_FIELDS.stream()
        .map(field -> field.isEmpty() ? row : row.at(field))
        .filter(event -> ALERT_ENTITY_TYPE.equalsIgnoreCase(event.path("entityType").asText()))
        .map(event -> event.path("entityId").asText())
        .filter(entityId -> !entityId.isEmpty())
        .findFirst()
        .orElse(table);
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
      WebhookSecrets.fieldsIn(config).stream()
          .map(field -> config.at(field).asText())
          .filter(value -> Fernet.isTokenized(value) && !OwnedCiphertext.isOwned(value))
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

  // Every table with a json column, as this database names them, but the alerts and the versions.
  private List<String> otherStores(Handle handle) {
    String schema = isMySql() ? "DATABASE()" : "current_schema()";
    return handle
        .createQuery(
            "SELECT table_name FROM information_schema.columns WHERE table_schema = "
                + schema
                + " AND column_name = 'json'")
        .mapTo(String.class)
        .stream()
        .filter(table -> isOtherStore(table.toLowerCase(Locale.ROOT)))
        .distinct()
        .toList();
  }

  private static boolean isOtherStore(String table) {
    return !ALERTS.equals(table) && !VERSIONS.equals(table);
  }

  private Stream<Map<String, Object>> rowsHoldingTokens(
      Handle handle, String table, String idColumn) {
    String jsonText = isMySql() ? "CAST(json AS CHAR)" : "json::text";
    String id = idColumn == null ? "" : idColumn + ", ";
    return handle
        .createQuery(
            "SELECT "
                + id
                + jsonText
                + " AS json FROM "
                + table
                + " WHERE "
                + jsonText
                + " LIKE '%"
                + Fernet.FERNET_PREFIX
                + "%'")
        .mapToMap()
        .stream();
  }

  private boolean isMySql() {
    return connectionType == ConnectionType.MYSQL;
  }
}
