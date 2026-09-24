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
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.channels.Channel;
import org.openmetadata.service.events.subscription.channels.ChannelResolution;
import org.openmetadata.service.events.subscription.targets.TargetResolver;
import org.openmetadata.service.notifications.EventContent;
import org.openmetadata.service.notifications.recipients.RecipientResolver;

/**
 * An alert's channels for one tick. A destination nothing can be sent through is not attempted,
 * with its own reason, and never joins its channel. The others are sent through their channel
 * together, so a person several of them name is reached once. Each channel is isolated from the
 * others, and what an event renders is rendered once for all of them.
 */
@Slf4j
final class TickChannels implements ChannelDelivery {
  private final EventSubscription alert;
  private final Map<UUID, Destination<ChangeEvent>> destinations;
  private final TickHealth health;
  private final TargetResolver resolver;

  TickChannels(
      EventSubscription alert,
      Map<UUID, Destination<ChangeEvent>> destinations,
      TickHealth health) {
    RecipientResolver recipients = new RecipientResolver();
    this.alert = alert;
    this.destinations = destinations;
    this.health = health;
    this.resolver = new TargetResolver(recipients::recipientsOf);
  }

  @Override
  public Delivery deliver(ChangeEvent event) {
    return deliver(event, destinations.keySet());
  }

  /**
   * Counted by channel, as a delivery always has been: a channel whose destinations were not
   * attempted counts, and one that failed counts once, however many of its destinations failed.
   */
  Delivery deliver(ChangeEvent event, Set<UUID> destinationIds) {
    List<Destination<ChangeEvent>> enabled = enabledAmong(destinationIds);
    enabled.stream()
        .filter(UnservedDestination.class::isInstance)
        .map(UnservedDestination.class::cast)
        .forEach(this::notAttempted);
    EventContent content = new EventContent(event, alert);
    List<Delivery.Failure> failures = new ArrayList<>();
    servedByChannel(enabled)
        .forEach(
            (channel, group) ->
                sendThrough(channel, group, event, content).ifPresent(failures::add));
    return new Delivery(channelsAmong(enabled), failures);
  }

  // In the order the alert declares them: that order decides which destination sends first.
  private List<Destination<ChangeEvent>> enabledAmong(Set<UUID> destinationIds) {
    return destinations.entrySet().stream()
        .filter(entry -> destinationIds.contains(entry.getKey()))
        .map(Map.Entry::getValue)
        .filter(Destination::getEnabled)
        .toList();
  }

  private void notAttempted(UnservedDestination unserved) {
    String channelId = ChannelResolution.of(unserved.getSubscriptionDestination()).channelId();
    health.notAttempted(destinationIdOf(unserved), channelId, unserved.cause(), unserved.reason());
  }

  private static Map<Channel, List<Destination<ChangeEvent>>> servedByChannel(
      List<Destination<ChangeEvent>> enabled) {
    return enabled.stream()
        .filter(destination -> !(destination instanceof UnservedDestination))
        .collect(
            Collectors.groupingBy(
                TickChannels::servingChannel, LinkedHashMap::new, Collectors.toList()));
  }

  private static int channelsAmong(List<Destination<ChangeEvent>> enabled) {
    return (int)
        enabled.stream()
            .map(destination -> ChannelResolution.of(destination.getSubscriptionDestination()))
            .map(ChannelResolution::channelId)
            .distinct()
            .count();
  }

  private Optional<Delivery.Failure> sendThrough(
      Channel channel,
      List<Destination<ChangeEvent>> group,
      ChangeEvent event,
      EventContent content) {
    try {
      return new ChannelDispatch(channel, group, resolver, health)
          .send(event, content)
          .map(TickChannels::failureOf);
    } catch (EventPublisherException e) {
      LOG.error("Failed to send alert: {}", e.getMessage());
      return Optional.of(failureOf(e));
    } catch (RuntimeException e) {
      // Anything unexpected costs this channel for this event, never the rest of the batch.
      LOG.error("Unexpected error sending alert for change event {}", event.getId(), e);
      return Optional.of(unexpectedFailure(group, e));
    }
  }

  private static Delivery.Failure unexpectedFailure(
      List<Destination<ChangeEvent>> group, RuntimeException cause) {
    return new Delivery.Failure(
        destinationIdOf(group.getFirst()),
        String.format("Unexpected error while sending: %s", cause.getMessage()));
  }

  private static Delivery.Failure failureOf(EventPublisherException failure) {
    UUID destinationId =
        failure.getChangeEventWithSubscription() == null
            ? null
            : failure.getChangeEventWithSubscription().getLeft();
    return new Delivery.Failure(destinationId, failure.getMessage());
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
