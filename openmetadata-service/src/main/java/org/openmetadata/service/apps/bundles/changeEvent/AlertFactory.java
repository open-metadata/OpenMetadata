package org.openmetadata.service.apps.bundles.changeEvent;

import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.apps.bundles.changeEvent.email.EmailPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.feed.ActivityFeedPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.gchat.GChatPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.generic.GenericPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.MSTeamsPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.slack.SlackEventPublisher;
import org.openmetadata.service.governance.workflows.WorkflowEventConsumer;

public class AlertFactory {
  public static Destination<ChangeEvent> getAlert(
      EventSubscription subscription, SubscriptionDestination config) {
    return switch (config.getType()) {
      case SLACK -> new SlackEventPublisher(subscription, config);
      case MS_TEAMS -> new MSTeamsPublisher(subscription, config);
      case G_CHAT -> new GChatPublisher(subscription, config);
      case WEBHOOK -> new GenericPublisher(subscription, config);
      case EMAIL -> new EmailPublisher(subscription, config);
      case ACTIVITY_FEED -> new ActivityFeedPublisher(subscription, config);
      case GOVERNANCE_WORKFLOW_CHANGE_EVENT -> new WorkflowEventConsumer(subscription, config);
    };
  }
}
