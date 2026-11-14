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
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.consumer.Consumers;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Alerts named their consumer by its Java class; they now name it by the id its provider
 * registers, so moving a class never changes what an alert names. Each stored alias is rewritten
 * to its consumer's id. A name no registered consumer answers to is left as it is, and logged: the
 * server that has its consumer may still run it.
 */
@Slf4j
public final class ConsumerIdMigration {

  /** Run once per version through {@code DataMigrationStep}. */
  public static final String STEP_NAME = "alert-consumer-ids";

  private static final String CLASS_NAME = "className";

  private ConsumerIdMigration() {}

  public static void storeConsumerIds(CollectionDAO dao) {
    for (String json : dao.eventSubscriptionDAO().listAllEventsSubscriptions()) {
      EventSubscription alert = JsonUtils.readValue(json, EventSubscription.class);
      String named = alert.getClassName();
      Optional<String> id = Consumers.idOf(named);
      if (named != null && id.isEmpty()) {
        LOG.warn(
            "Alert {} names consumer {}, which no registered consumer answers to; left as it is",
            alert.getName(),
            named);
      } else if (id.isPresent() && !id.get().equals(named)) {
        dao.eventSubscriptionDAO()
            .update(alert.getId(), alert.getFullyQualifiedName(), withConsumerId(json, id.get()));
        LOG.info("Alert {} now names consumer {} by its id {}", alert.getName(), named, id.get());
      }
    }
  }

  // Only the consumer's name changes: the rest of the stored row is written back as it was.
  static String withConsumerId(String json, String id) {
    JsonNode row = JsonUtils.readTree(json);
    ((ObjectNode) row).put(CLASS_NAME, id);
    return JsonUtils.pojoToJson(row);
  }
}
