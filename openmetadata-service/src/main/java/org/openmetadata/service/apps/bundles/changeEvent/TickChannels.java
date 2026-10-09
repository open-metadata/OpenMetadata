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

package org.openmetadata.service.apps.bundles.changeEvent;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.channels.Channel;
import org.openmetadata.service.events.subscription.channels.ChannelResolution;
import org.openmetadata.service.notifications.EventContent;
import org.openmetadata.service.notifications.recipients.RecipientResolver;

/**
 * An alert's channels for one tick. A destination nothing can be sent through is not attempted,
 * with its own reason, never joins its channel, and fails the event. The others are sent through
 * their channel
 * together, so a person several of them name is reached once. Each channel is isolated from the
 * others, and what an event renders is rendered once for all of them.
 */
@Slf4j
final class TickChannels implements ChannelDelivery {
  private final EventSubscription alert;
  private final Map<UUID, Destination<ChangeEvent>> destinations;
  private final TickHealth health;
  private final RecipientResolver recipients;

  TickChannels(
      EventSubscription alert,
      Map<UUID, Destination<ChangeEvent>> destinations,
      TickHealth health) {
    this.alert = alert;
    this.destinations = destinations;
    this.health = health;
    this.recipients = new RecipientResolver();
  }

  @Override
  public Delivery deliver(ChangeEvent event) {
    return deliver(event, destinations.keySet());
  }

  /**
   * Counted by channel, as a delivery always has been: a channel that failed counts once, however
   * many of its destinations failed. Nothing went out through a channel that could not try, so it
   * failed too, and so did the unusable destinations of a channel, once, with their reason.
   */
  Delivery deliver(ChangeEvent event, Set<UUID> destinationIds) {
    List<Destination<ChangeEvent>> enabled = enabledAmong(destinationIds);
    EventContent content = new EventContent(event, alert);
    int delivered = 0;
    List<Delivery.Failure> failures = new ArrayList<>();
    for (List<Destination<ChangeEvent>> group : servedByChannel(enabled).values()) {
      switch (sendThrough(group, event, content)) {
        case ChannelResult.Delivered ignored -> delivered++;
        case ChannelResult.Failed failed -> failures.add(failed.failure());
      }
    }
    unservedByChannel(enabled).values().forEach(unserved -> failures.add(notAttempted(unserved)));
    return new Delivery(delivered, failures);
  }

  // In the order the alert declares them: that order decides which destination sends first.
  private List<Destination<ChangeEvent>> enabledAmong(Set<UUID> destinationIds) {
    return destinations.entrySet().stream()
        .filter(entry -> destinationIds.contains(entry.getKey()))
        .map(Map.Entry::getValue)
        .filter(Destination::getEnabled)
        .toList();
  }

  private Delivery.Failure notAttempted(List<UnservedDestination> ofOneChannel) {
    ofOneChannel.forEach(this::notAttempted);
    UnservedDestination first = ofOneChannel.getFirst();
    return ChannelResult.Failed.notAttempted(first.getSubscriptionDestination(), first.reason())
        .failure();
  }

  private void notAttempted(UnservedDestination unserved) {
    health.notAttempted(
        destinationIdOf(unserved), channelIdOf(unserved), unserved.cause(), unserved.reason());
  }

  private static Map<String, List<UnservedDestination>> unservedByChannel(
      List<Destination<ChangeEvent>> enabled) {
    return enabled.stream()
        .filter(UnservedDestination.class::isInstance)
        .map(UnservedDestination.class::cast)
        .collect(
            Collectors.groupingBy(
                TickChannels::channelIdOf, LinkedHashMap::new, Collectors.toList()));
  }

  private static String channelIdOf(Destination<ChangeEvent> destination) {
    return ChannelResolution.of(destination.getSubscriptionDestination()).channelId();
  }

  // By the id of the channel that serves each one; the channel itself is found where a failure
  // to find it costs only its own destinations.
  private static Map<String, List<Destination<ChangeEvent>>> servedByChannel(
      List<Destination<ChangeEvent>> enabled) {
    return enabled.stream()
        .filter(destination -> !(destination instanceof UnservedDestination))
        .collect(
            Collectors.groupingBy(
                TickChannels::channelIdOf, LinkedHashMap::new, Collectors.toList()));
  }

  // Anything that throws costs this channel for this event, never the rest of the batch, and
  // each of its destinations reads failed: nothing it had to send went out.
  private ChannelResult sendThrough(
      List<Destination<ChangeEvent>> group, ChangeEvent event, EventContent content) {
    ChannelResult result;
    try {
      result =
          new ChannelDispatch(servingChannel(group.getFirst()), group, recipients, health)
              .send(event, content);
    } catch (EventPublisherException e) {
      LOG.error("Failed to send alert: {}", e.getMessage());
      result = failedByAll(group, ChannelResult.Failed.of(e));
    } catch (RuntimeException e) {
      LOG.error("Unexpected error sending alert for change event {}", event.getId(), e);
      result = failedByAll(group, unexpectedFailure(group, e));
    }
    return result;
  }

  private ChannelResult failedByAll(
      List<Destination<ChangeEvent>> group, ChannelResult.Failed failed) {
    group.forEach(
        destination ->
            health.channelFailed(destinationIdOf(destination), failed.failure().reason()));
    return failed;
  }

  private static ChannelResult.Failed unexpectedFailure(
      List<Destination<ChangeEvent>> group, RuntimeException cause) {
    return new ChannelResult.Failed(
        new Delivery.Failure(
            destinationIdOf(group.getFirst()),
            String.format("Unexpected error while sending: %s", cause.getMessage())));
  }

  // A destination that has a publisher was built through the channel that serves it.
  private static Channel servingChannel(Destination<ChangeEvent> destination) {
    ChannelResolution resolution = ChannelResolution.of(destination.getSubscriptionDestination());
    return resolution
        .channel()
        .orElseThrow(
            () -> new IllegalStateException("No channel " + resolution.channelId() + " serves it"));
  }

  private static UUID destinationIdOf(Destination<ChangeEvent> destination) {
    return destination.getSubscriptionDestination().getId();
  }
}
