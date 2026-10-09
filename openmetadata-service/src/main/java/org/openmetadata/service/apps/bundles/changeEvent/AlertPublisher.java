package org.openmetadata.service.apps.bundles.changeEvent;

import static org.openmetadata.service.alerting.matching.AlertMatching.getFilteredEvents;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.alerting.channel.ChannelDelivery;
import org.openmetadata.service.alerting.channel.Delivery;
import org.openmetadata.service.alerting.channel.DeliveryMemory;
import org.openmetadata.service.alerting.channel.Destination;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.AlertTelemetry;
import org.openmetadata.service.util.DIContainer;

/**
 * The consumer of an alert: it sends each event its rules let through to the alert's destinations,
 * channel by channel, and reports each destination's health when the tick commits.
 */
@Slf4j
public class AlertPublisher extends AbstractEventConsumer {
  private static final int MAX_FAILURE_REASON_LENGTH = 2000;

  protected Map<UUID, Destination<ChangeEvent>> destinationMap;
  private TickHealth healthOfThisTick;
  private TickChannels channelsOfThisTick;

  public AlertPublisher(DIContainer di) {
    super(di);
  }

  public boolean getEnabled() {
    return getEventSubscription().getEnabled();
  }

  @Override
  protected void beginTick() {
    openDestinations(loadDestinationsMap());
    DeliveryMemory.begin();
  }

  // What one tick delivers through, made fresh when it starts. Unit tests open a tick the same way.
  void openTick(Map<UUID, Destination<ChangeEvent>> destinations) {
    openTick();
    openDestinations(destinations);
  }

  private void openDestinations(Map<UUID, Destination<ChangeEvent>> destinations) {
    this.destinationMap = destinations;
    this.healthOfThisTick = new TickHealth();
    this.channelsOfThisTick = new TickChannels(eventSubscription, destinations, healthOfThisTick);
  }

  private Map<UUID, Destination<ChangeEvent>> loadDestinationsMap() {
    // In the order the alert declares them: that order decides which destination sends first and
    // which one supplies the configuration when several share a type.
    Map<UUID, Destination<ChangeEvent>> dMap = new LinkedHashMap<>();
    if (eventSubscription.getDestinations() == null) {
      return dMap;
    }
    for (SubscriptionDestination subscriptionDest : eventSubscription.getDestinations()) {
      subscriptionDest.setStatusDetails(null);
      dMap.put(
          subscriptionDest.getId(), AlertFactory.getAlert(eventSubscription, subscriptionDest));
    }
    return dMap;
  }

  @Override
  protected void handle(List<ChangeEvent> events) {
    Map<ChangeEvent, Set<UUID>> filteredEvents =
        getFilteredEvents(
            eventSubscription, withReceivers(events), ledger.watermark(), this::deadLetterEvent);
    int successDeliveries = 0;
    int failedDeliveries = 0;
    for (Map.Entry<ChangeEvent, Set<UUID>> eventWithReceivers : filteredEvents.entrySet()) {
      EventDeliveryResult result =
          publishEvent(eventWithReceivers.getKey(), eventWithReceivers.getValue());
      // Record once per (event, subscription): the table has no destination dimension, so
      // recording per type would duplicate rows and break Postgres ON CONFLICT.
      if (result.delivered()) {
        ledger.delivered(eventWithReceivers.getKey());
      }
      successDeliveries += result.successCount();
      failedDeliveries += result.failedCount();
    }
    ledger.channelOutcomes(successDeliveries, failedDeliveries);
  }

  // Every event goes to every destination, in the order they were read.
  private Map<ChangeEvent, Set<UUID>> withReceivers(List<ChangeEvent> events) {
    Map<ChangeEvent, Set<UUID>> eventsWithReceivers = new LinkedHashMap<>();
    for (ChangeEvent changeEvent : events) {
      eventsWithReceivers.put(changeEvent, new LinkedHashSet<>(destinationMap.keySet()));
    }
    return eventsWithReceivers;
  }

  /** An event we could not even filter is a publisher-side failure, so record it as one. */
  private void deadLetterEvent(ChangeEvent event, Exception error) {
    LOG.error(
        "Event Subscription: {} could not evaluate filters for change event {}",
        eventSubscription.getName(),
        event.getId(),
        error);
    handleFailedEvent(
        new EventPublisherException(
            String.format("Failed to evaluate alert filters: %s", error.getMessage()),
            Pair.of(eventSubscription.getId(), event)),
        false);
  }

  private EventDeliveryResult publishEvent(ChangeEvent event, Set<UUID> destinationIds) {
    Delivery delivery = channelsOfThisTick().deliver(event, destinationIds);
    recordSendFailures(event, delivery);
    return new EventDeliveryResult(
        delivery.delivered() > 0, delivery.delivered(), delivery.failures().size());
  }

  private record EventDeliveryResult(boolean delivered, int successCount, int failedCount) {}

  // One failure row per event and alert. It names the first failing destination and lists every
  // one, so a second failure on the same event adds detail and never overwrites the first.
  private void recordSendFailures(ChangeEvent event, Delivery delivery) {
    if (delivery.anyFailed()) {
      recordSendFailure(
          new EventPublisherException(
              StringUtils.abbreviate(delivery.reasons(), MAX_FAILURE_REASON_LENGTH),
              Pair.of(delivery.failures().getFirst().destinationId(), event)));
    }
  }

  private void recordSendFailure(EventPublisherException failure) {
    try {
      handleFailedEvent(failure, true);
    } catch (RuntimeException recordingError) {
      LOG.error("Failed to record a send failure: {}", failure.getMessage(), recordingError);
    }
  }

  private TickChannels channelsOfThisTick() {
    if (channelsOfThisTick == null) {
      throw new IllegalStateException("An alert's channels exist only while its tick runs");
    }
    return channelsOfThisTick;
  }

  /**
   * The alert's channels for this tick, for a consumer that makes its own work to send it through.
   * The consumer counts what it sent and records what failed, through {@link #recordDelivery} and
   * {@link #recordFailure}; the tick writes each destination's health when it ends.
   *
   * @throws IllegalStateException outside a tick
   */
  protected final ChannelDelivery channels() {
    return channelsOfThisTick();
  }

  // A channel that cannot send, such as a mail server switched off, is said once per tick, not
  // once per event and destination.
  @Override
  protected void beforeCommit() {
    healthOfThisTick.reportTo(
        (destinationId, outcome) -> {
          ledger.destinationOutcome(destinationId, outcome);
          AlertTelemetry.destinationOutcome(outcome);
        });
    healthOfThisTick
        .notAttemptedChannels()
        .forEach(
            (channelId, why) ->
                LOG.info(
                    "Alert {} did not attempt channel {} in this tick: {}",
                    eventSubscription.getName(),
                    channelId,
                    why));
  }

  @Override
  protected void endTick() {
    DeliveryMemory.end();
    closeDestinations();
    channelsOfThisTick = null;
  }

  private void closeDestinations() {
    for (Destination<ChangeEvent> destination : destinationMap.values()) {
      try {
        destination.close();
      } catch (RuntimeException e) {
        LOG.warn("Failed to close a destination of {}", eventSubscription.getName(), e);
      }
    }
  }
}
