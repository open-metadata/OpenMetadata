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

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.SqlStatement;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Apps no longer bring their own alerts. A definition could list alerts that installing its app
 * created, without asking whether the caller may create alerts; no shipped app listed any. Each
 * alert an app created was therefore written into a definition by someone, an admin or not: it is
 * kept for an admin to review, disabled and no longer tied to the app. The list leaves every stored
 * app, definition, version and change event, which can no longer be read with it.
 */
@Slf4j
public final class AppEventSubscriptionRemoval {

  /** Run once per version through {@code DataMigrationStep}. */
  public static final String STEP_NAME = "app-event-subscriptions-removal";

  private static final String FIELD = "eventSubscriptions";
  private static final String APP_ALERT_LINKS =
      " FROM entity_relationship"
          + " WHERE fromEntity = :app AND toEntity = :alert AND relation = :contains";

  private AppEventSubscriptionRemoval() {}

  public static void removeAppEventSubscriptions(
      Handle handle, ConnectionType connectionType, CollectionDAO dao) {
    List<String> appAlerts =
        bindLinks(handle.createQuery("SELECT DISTINCT toId" + APP_ALERT_LINKS))
            .mapTo(String.class)
            .list();
    appAlerts.forEach(id -> disable(dao.eventSubscriptionDAO(), UUID.fromString(id)));
    bindLinks(handle.createUpdate("DELETE" + APP_ALERT_LINKS)).execute();
    removeFieldSql(connectionType).forEach(sql -> handle.createUpdate(sql).execute());
    StoredChangeEventCleanup.removeEntityFields(
        handle,
        connectionType,
        Set.of(Entity.APPLICATION, Entity.APP_MARKET_PLACE_DEF),
        Set.of(FIELD));
  }

  private static void disable(EntityDAO<?> alerts, UUID id) {
    String json = alerts.findById(alerts.getTableName(), id, alerts.getCondition(Include.ALL));
    if (json != null) {
      ObjectNode alert = (ObjectNode) JsonUtils.readTree(json);
      alert.put("enabled", false);
      alerts.update(id, alert.path("fullyQualifiedName").asText(), JsonUtils.pojoToJson(alert));
      LOG.warn(
          "Alert {} was created by an app install and is now disabled; review it before enabling",
          alert.path("name").asText());
    }
  }

  private static <S extends SqlStatement<S>> S bindLinks(S statement) {
    return statement
        .bind("app", Entity.APPLICATION)
        .bind("alert", Entity.EVENT_SUBSCRIPTION)
        .bind("contains", Relationship.CONTAINS.ordinal());
  }

  private static List<String> removeFieldSql(ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> List.of(
          "UPDATE apps_marketplace SET json = JSON_REMOVE(json, '$.eventSubscriptions')"
              + " WHERE JSON_CONTAINS_PATH(json, 'one', '$.eventSubscriptions')",
          "UPDATE installed_apps SET json = JSON_REMOVE(json, '$.eventSubscriptions')"
              + " WHERE JSON_CONTAINS_PATH(json, 'one', '$.eventSubscriptions')",
          "UPDATE entity_extension SET json = JSON_REMOVE(json, '$.eventSubscriptions')"
              + " WHERE (extension LIKE 'app.version.%'"
              + " OR extension LIKE 'appMarketPlaceDefinition.version.%')"
              + " AND JSON_CONTAINS_PATH(json, 'one', '$.eventSubscriptions')");
      case POSTGRES -> List.of(
          "UPDATE apps_marketplace SET json = json - 'eventSubscriptions'"
              + " WHERE json -> 'eventSubscriptions' IS NOT NULL",
          "UPDATE installed_apps SET json = json - 'eventSubscriptions'"
              + " WHERE json -> 'eventSubscriptions' IS NOT NULL",
          "UPDATE entity_extension SET json = json - 'eventSubscriptions'"
              + " WHERE (extension LIKE 'app.version.%'"
              + " OR extension LIKE 'appMarketPlaceDefinition.version.%')"
              + " AND json -> 'eventSubscriptions' IS NOT NULL");
    };
  }
}
