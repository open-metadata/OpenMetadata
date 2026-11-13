package org.openmetadata.service.alerting.delivery;

import java.util.Optional;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.alerting.channel.Channel;
import org.openmetadata.service.alerting.channel.ChannelResolution;
import org.openmetadata.service.alerting.channel.Destination;
import org.openmetadata.service.events.consumer.ledger.DestinationOutcome.Cause;

public class AlertFactory {
  public static Destination<ChangeEvent> getAlert(
      EventSubscription subscription, SubscriptionDestination config) {
    ChannelResolution served = ChannelResolution.of(config);
    return served
        .channel()
        .map(channel -> publisherOrUnserved(channel, subscription, config))
        .orElseGet(
            () ->
                UnservedDestination.ofAnUnregisteredChannel(
                    subscription, config, served.channelId()));
  }

  /**
   * Why the destination, as it is stored, cannot be built to send, as {@link #getAlert} finds it;
   * empty when it can. Read on every status read, so a destination reports it before any event
   * reaches it.
   */
  public static Optional<String> unusableBecause(
      EventSubscription subscription, SubscriptionDestination config) {
    return getAlert(subscription, config) instanceof UnservedDestination unserved
            && unserved.cause() == Cause.CONFIGURATION_UNUSABLE
        ? Optional.of(unserved.reason())
        : Optional.empty();
  }

  // A destination saved under older rules may hold a configuration its channel now refuses. That
  // must cost this destination only, never the alert's tick.
  private static Destination<ChangeEvent> publisherOrUnserved(
      Channel channel, EventSubscription subscription, SubscriptionDestination config) {
    try {
      return channel.publisher(subscription, config);
    } catch (RuntimeException e) {
      return UnservedDestination.ofAnUnusableConfiguration(subscription, config, e.getMessage());
    }
  }
}
