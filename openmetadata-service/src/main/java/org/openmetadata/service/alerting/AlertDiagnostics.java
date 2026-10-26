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

package org.openmetadata.service.alerting;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.events.EventSubscriptionDiagnosticInfo;
import org.openmetadata.schema.api.events.EventsRecord;
import org.openmetadata.schema.entity.events.DestinationHealth;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.alerting.matching.AlertMatching;
import org.openmetadata.service.events.consumer.AlertRows;
import org.openmetadata.service.events.consumer.ledger.AlertLedger;
import org.openmetadata.service.events.consumer.ledger.AlertProgress;
import org.openmetadata.service.events.consumer.ledger.AlertRecord;
import org.openmetadata.service.events.consumer.ledger.PendingCount;

/**
 * What an alert has done and has still to do, as its page and its diagnostics show it: the events
 * it handled and those its rules still let through, and each destination's status.
 */
@Slf4j
public final class AlertDiagnostics {

  private AlertDiagnostics() {}

  public static EventsRecord eventsRecord(UUID alertId) {
    EventSubscription alert = AlertRows.read(alertId);
    AlertProgress progress = AlertProgress.of(alert);
    AlertProgress.Counts counts = progress.counts();
    PendingCount pending = pendingCount(alert, progress);
    return new EventsRecord()
        .withTotalEventsCount(counts.handled() + pending.count())
        .withFailedEventsCount(counts.failed())
        .withPendingEventsCount(pending.count())
        .withSuccessfulEventsCount(counts.delivered())
        .withCountsAreLowerBound(pending.lowerBound());
  }

  public static EventSubscriptionDiagnosticInfo diagnosticInfo(
      UUID alertId, int limit, int paginationOffset, boolean listCountOnly) {
    EventSubscription alert = AlertRows.read(alertId);
    AlertProgress progress = AlertProgress.of(alert);
    AlertProgress.Counts counts = progress.counts();
    PendingCount pending = pendingCount(alert, progress);
    return new EventSubscriptionDiagnosticInfo()
        .withLatestOffset(progress.latestOffset())
        .withCurrentOffset(progress.currentOffset())
        .withStartingOffset(progress.startingOffset())
        .withHasProcessedAllEvents(progress.caughtUp())
        .withSuccessfulEventsCount(counts.delivered())
        .withFailedEventsCount(counts.failed())
        .withTotalUnprocessedEventsCount(progress.unread())
        .withRelevantUnprocessedEventsCount(pending.count())
        .withRelevantUnprocessedEventsCountIsLowerBound(pending.lowerBound())
        .withRelevantUnprocessedEventsList(
            listCountOnly ? null : relevantUnread(progress, limit, paginationOffset))
        .withTotalUnprocessedEventsList(
            listCountOnly ? null : progress.allUnread(limit, paginationOffset));
  }

  // Shared by every request for the alert at its position, and run at most a few at a time.
  private static PendingCount pendingCount(EventSubscription alert, AlertProgress progress) {
    PendingCounts.Key key =
        new PendingCounts.Key(
            alert.getId(), alert.getVersion(), progress.currentOffset(), progress.latestOffset());
    return PendingCounts.shared(
        key, () -> progress.relevantUnreadCount(AlertDiagnostics::matchingRules));
  }

  private static List<ChangeEvent> relevantUnread(
      AlertProgress progress, int limit, int paginationOffset) {
    return progress.relevantUnread(limit, paginationOffset, AlertDiagnostics::matchingRules);
  }

  public static SubscriptionStatus destinationStatus(UUID alertId, UUID destinationId) {
    EventSubscription alert = AlertRows.read(alertId);
    return Boolean.FALSE.equals(alert.getEnabled())
        ? new SubscriptionStatus().withStatus(SubscriptionStatus.Status.DISABLED)
        : destinationsWithHealth(alert).stream()
            .filter(destination -> destination.getId().equals(destinationId))
            .findFirst()
            .map(destination -> convertToSubscriptionStatus(destination.getStatusDetails()))
            .orElse(null);
  }

  public static List<SubscriptionDestination> listDestinations(UUID alertId) {
    EventSubscription alert = AlertRows.read(alertId);
    return Boolean.FALSE.equals(alert.getEnabled())
        ? Collections.emptyList()
        : destinationsWithHealth(alert);
  }

  /** Every destination of the alert with its current status: one read, whatever their number. */
  public static List<SubscriptionDestination> destinationsWithStatus(EventSubscription alert) {
    return destinationsWithHealth(alert);
  }

  // The alert's own rules, from when it started alerting: what it still has to send.
  private static Predicate<ChangeEvent> matchingRules(EventSubscription alert, Long started) {
    Long since = AlertMatching.alertingWatermark(alert, started);
    return event ->
        AlertMatching.isChangeEventAllowed(
            event, alert.getFilteringRules(), since, AlertMatching.LOG_EVALUATION_ERROR);
  }

  // Health lives in a row of its own, so registering, editing and restarting never reset it.
  private static List<SubscriptionDestination> destinationsWithHealth(EventSubscription alert) {
    Map<String, DestinationHealth> health =
        AlertRecord.open(alert).map(AlertLedger::health).orElse(Map.of());
    long now = System.currentTimeMillis();
    for (SubscriptionDestination destination : listOrEmpty(alert.getDestinations())) {
      destination.setStatusDetails(
          statusToShow(alert, destination, health.get(destination.getId().toString()), now));
    }
    return listOrEmpty(alert.getDestinations());
  }

  // Disabled is decided when read, from the alert and the destination as they are now, and never
  // stored. Otherwise the last tick that reached the destination speaks, and Active before any has.
  private static SubscriptionStatus statusToShow(
      EventSubscription alert,
      SubscriptionDestination destination,
      DestinationHealth known,
      long now) {
    boolean switchedOff =
        Boolean.FALSE.equals(alert.getEnabled()) || Boolean.FALSE.equals(destination.getEnabled());
    SubscriptionStatus status;
    if (switchedOff) {
      status = new SubscriptionStatus().withStatus(SubscriptionStatus.Status.DISABLED);
    } else if (known != null) {
      status = known.getStatus();
    } else {
      status =
          new SubscriptionStatus().withStatus(SubscriptionStatus.Status.ACTIVE).withTimestamp(now);
    }
    return status;
  }

  /**
   * Converts a status object to SubscriptionStatus. After JSON deserialization, the statusDetails
   * field (typed as Object in SubscriptionDestination) may be deserialized as a LinkedHashMap
   * instead of SubscriptionStatus. This method handles the conversion.
   */
  private static SubscriptionStatus convertToSubscriptionStatus(Object status) {
    if (status == null) {
      return null;
    }
    if (status instanceof SubscriptionStatus subscriptionStatus) {
      return subscriptionStatus;
    }
    try {
      String json = JsonUtils.pojoToJson(status);
      return JsonUtils.readValue(json, SubscriptionStatus.class);
    } catch (Exception e) {
      LOG.error("Failed to convert status to SubscriptionStatus: {}", status, e);
      return null;
    }
  }
}
