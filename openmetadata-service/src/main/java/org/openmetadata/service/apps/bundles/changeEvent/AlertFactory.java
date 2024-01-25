package org.openmetadata.service.apps.bundles.changeEvent;

import static org.openmetadata.schema.api.events.CreateEventSubscription.AlertType.ACTIVITY_FEED;

import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.apps.bundles.changeEvent.email.EmailPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.gchat.GChatPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.generic.GenericPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.MSTeamsPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.slack.SlackEventPublisher;

public class AlertFactory {
  public static Destination<ChangeEvent> getAlert(SubscriptionDestination config) {
    return switch (config.getType()) {
      case SLACK -> new SlackEventPublisher(config);
      case MS_TEAMS -> new MSTeamsPublisher(config);
      case G_CHAT -> new GChatPublisher(config);
      case GENERIC -> new GenericPublisher(config);
      case EMAIL -> new EmailPublisher(config);
      case ACTIVITY_FEED -> throw new IllegalArgumentException(
          "Cannot create Activity Feed as Publisher.");
    };
  }
}
