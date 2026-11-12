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
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Gives every stored destination an id of its own. Requests could set a destination's id, so two
 * destinations, of one alert or of two, may share one, and destinations stored before ids were
 * assigned have none. The first destination read keeps a shared id; the others get fresh ones.
 */
@Slf4j
public final class DestinationIdMigration {

  /** Run once per version through {@code DataMigrationStep}. */
  public static final String STEP_NAME = "alert-destination-ids";

  private static final String DESTINATIONS = "destinations";
  private static final String ID = "id";

  private DestinationIdMigration() {}

  public static void giveEveryDestinationItsOwnId(CollectionDAO dao) {
    Set<UUID> taken = new HashSet<>();
    for (String json : dao.eventSubscriptionDAO().listAllEventsSubscriptions()) {
      withOwnIds(json, taken)
          .ifPresent(
              rewritten -> {
                EventSubscription alert = JsonUtils.readValue(json, EventSubscription.class);
                dao.eventSubscriptionDAO()
                    .update(alert.getId(), alert.getFullyQualifiedName(), rewritten);
                LOG.info("Alert {} has its destinations' ids made its own", alert.getName());
              });
    }
  }

  // Only the ids that are missing or already taken change: the rest of the row is kept as it was.
  static Optional<String> withOwnIds(String json, Set<UUID> taken) {
    JsonNode row = JsonUtils.readTree(json);
    boolean changed = false;
    for (JsonNode destination : row.path(DESTINATIONS)) {
      Optional<UUID> id = idOf(destination);
      if (id.isEmpty() || !taken.add(id.get())) {
        UUID fresh = UUID.randomUUID();
        taken.add(fresh);
        ((ObjectNode) destination).put(ID, fresh.toString());
        changed = true;
      }
    }
    return changed ? Optional.of(JsonUtils.pojoToJson(row)) : Optional.empty();
  }

  private static Optional<UUID> idOf(JsonNode destination) {
    String text = destination.path(ID).asText(null);
    return Optional.ofNullable(text).filter(it -> !it.isBlank()).map(UUID::fromString);
  }
}
