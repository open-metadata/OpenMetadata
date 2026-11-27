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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.alerting.channel.DestinationConfig;
import org.openmetadata.service.events.consumer.ledger.AlertRecord;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Alerts the previous release could not send. It built every destination of an alert before each
 * run, and one it could not build stopped the whole alert, silently, on every run. Now a
 * destination costs only itself and a stored configuration is read as it was accepted, so such an
 * alert sends again. The first thing it would send is every change retained since it stopped, which
 * nobody is waiting for, so its backlog is skipped once and it starts from the upgrade.
 */
@Slf4j
public final class AlertBacklogMigration {

  /**
   * Run once per version through {@code DataMigrationStep}; a re-run would skip again what such an
   * alert has not sent yet since the upgrade.
   */
  public static final String STEP_NAME = "alert-backlog-skip";

  private AlertBacklogMigration() {}

  public static void skipBacklogOfAlertsThePreviousReleaseCouldNotSend(CollectionDAO dao) {
    for (String json : dao.eventSubscriptionDAO().listAllEventsSubscriptions()) {
      EventSubscription alert = JsonUtils.readValue(json, EventSubscription.class);
      Optional<String> stopped =
          Boolean.FALSE.equals(alert.getEnabled())
              ? Optional.empty()
              : whyThePreviousReleaseCouldNotSend(alert);
      stopped.ifPresent(
          reason -> {
            AlertRecord.skipBacklog(alert.getId());
            LOG.info(
                "Alert {} starts from the upgrade: the previous release could not send it: {}",
                alert.getName(),
                reason);
          });
    }
  }

  static Optional<String> whyThePreviousReleaseCouldNotSend(EventSubscription alert) {
    return listOrEmpty(alert.getDestinations()).stream()
        .map(AlertBacklogMigration::whyItCouldNotBeBuilt)
        .flatMap(Optional::stream)
        .findFirst();
  }

  // As the previous release built a destination: its configuration read strictly as its type
  // defines it, and a webhook's endpoint checked by the rule that release applied.
  private static Optional<String> whyItCouldNotBeBuilt(SubscriptionDestination destination) {
    Optional<String> reason = Optional.empty();
    try {
      switch (destination.getType()) {
        case EMAIL -> DestinationConfig.submitted(destination, EmailAlertConfig.class, "email");
        case SLACK, MS_TEAMS, G_CHAT -> DestinationConfig.submitted(
            destination, Webhook.class, "webhook");
        case WEBHOOK -> PreviousReleaseEndpointRule.require(
            DestinationConfig.submitted(destination, Webhook.class, "webhook"));
        default -> LOG.debug("Destination {} needs no configuration", destination.getId());
      }
    } catch (RuntimeException e) {
      reason = Optional.of(String.valueOf(e.getMessage()));
    }
    return reason;
  }
}
