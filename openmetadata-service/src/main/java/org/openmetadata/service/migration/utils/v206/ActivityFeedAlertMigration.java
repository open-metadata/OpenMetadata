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

package org.openmetadata.service.migration.utils.v206;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.databases.DatasourceConfig;

/**
 * Lets data contract changes and entity status changes (workflow approvals) reach the activity
 * feed on an existing install. The seed only creates a missing alert, so the stored alert is edited
 * in place: deleting and re-seeding it would reset its id, consumer offset and any setting an admin
 * changed, such as {@code enabled}.
 */
@Slf4j
public final class ActivityFeedAlertMigration {
  static final String ALERT_NAME = "ActivityFeedAlert";

  // Rule name → value its set condition must contain.
  private static final Map<String, String> RULE_ADDITIONS =
      Map.of("matchAnyFieldChange", Entity.FIELD_ENTITY_STATUS, "matchAnySource", "dataContract");

  // Input filter argument (shown when the alert is opened) → value its list must contain.
  private static final Map<String, String> INPUT_ADDITIONS =
      Map.of("fieldChangeList", Entity.FIELD_ENTITY_STATUS, "sourceList", "dataContract");

  private static final String SELECT = "SELECT json FROM event_subscription_entity WHERE name = :n";
  private static final String UPDATE_MYSQL =
      "UPDATE event_subscription_entity SET json = :json WHERE name = :n";
  private static final String UPDATE_POSTGRES =
      "UPDATE event_subscription_entity SET json = :json::jsonb WHERE name = :n";

  private ActivityFeedAlertMigration() {}

  public static void migrate(Handle handle) {
    Optional<String> stored =
        handle.createQuery(SELECT).bind("n", ALERT_NAME).mapTo(String.class).findFirst();
    if (stored.isEmpty()) {
      LOG.info("{} not stored yet; the seed creates it with the new rules", ALERT_NAME);
      return;
    }
    ObjectNode alert = (ObjectNode) JsonUtils.readTree(stored.get());
    if (addMissingValues(alert)) {
      handle
          .createUpdate(isMySql() ? UPDATE_MYSQL : UPDATE_POSTGRES)
          .bind("json", JsonUtils.pojoToJson(alert))
          .bind("n", ALERT_NAME)
          .execute();
      LOG.info("Added entityStatus and dataContract to {}", ALERT_NAME);
    }
  }

  /** Adds the values this release admits; returns whether the alert changed. */
  static boolean addMissingValues(ObjectNode alert) {
    boolean changed = false;
    for (JsonNode rule : alert.path("filteringRules").path("rules")) {
      String value = RULE_ADDITIONS.get(rule.path("name").asText());
      if (value != null) {
        changed |= addToCondition((ObjectNode) rule, value);
      }
    }
    for (JsonNode filter : alert.path("input").path("filters")) {
      for (JsonNode argument : filter.path("arguments")) {
        String value = INPUT_ADDITIONS.get(argument.path("name").asText());
        if (value != null) {
          changed |= addToList(argument.path("input"), value);
        }
      }
    }
    return changed;
  }

  // A condition is a single call over a literal set, e.g. matchAnySource({'table', 'topic'}).
  private static boolean addToCondition(ObjectNode rule, String value) {
    String condition = rule.path("condition").asText();
    String quoted = "'" + value + "'";
    int setEnd = condition.lastIndexOf("})");
    if (condition.contains(quoted) || setEnd < 0) {
      return false;
    }
    rule.put(
        "condition", condition.substring(0, setEnd) + ", " + quoted + condition.substring(setEnd));
    return true;
  }

  private static boolean addToList(JsonNode list, String value) {
    if (!(list instanceof ArrayNode array)) {
      return false;
    }
    for (JsonNode item : array) {
      if (value.equals(item.asText())) {
        return false;
      }
    }
    array.add(value);
    return true;
  }

  private static boolean isMySql() {
    return Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL());
  }
}
