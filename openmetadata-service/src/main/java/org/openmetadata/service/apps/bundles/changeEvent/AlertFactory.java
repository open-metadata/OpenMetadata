package org.openmetadata.service.apps.bundles.changeEvent;

import java.util.Map;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.subscription.channels.Channel;
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
        .map(channel -> publisherOrUnserved(channel, subscription, config))
        .orElseGet(
            () ->
                UnservedDestination.ofAnUnregisteredChannel(
                    subscription, config, served.channelId()));
  }

  // A destination saved under older rules may hold a configuration its channel now refuses. That
  // must cost this destination only, never the alert's tick.
  private static Destination<ChangeEvent> publisherOrUnserved(
      Channel channel, EventSubscription subscription, SubscriptionDestination config) {
    try {
      return channel.publisher(subscription, config);
    } catch (RuntimeException e) {
      return new UnservedDestination(
          subscription, config, "its stored configuration is not usable: " + e.getMessage());
    }
  }
}
