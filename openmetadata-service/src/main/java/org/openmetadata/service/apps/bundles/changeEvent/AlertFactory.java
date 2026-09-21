package org.openmetadata.service.apps.bundles.changeEvent;

import java.util.Map;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.subscription.channels.ChannelResolution;

public class AlertFactory {
  public static Destination<ChangeEvent> getAlert(
      EventSubscription subscription, SubscriptionDestination config) {
    return getAlert(subscription, config, Map.of());
  }

  /**
   * @param declaredByConsumer the channels the alert's consumer declares for destination types
   */
  public static Destination<ChangeEvent> getAlert(
      EventSubscription subscription,
      SubscriptionDestination config,
      Map<String, String> declaredByConsumer) {
    ChannelResolution served = ChannelResolution.of(config, declaredByConsumer);
    return served
        .channel()
        .map(channel -> channel.publisher(subscription, config))
        .orElseGet(() -> new UnservedDestination(subscription, config, served.channelId()));
  }
}
