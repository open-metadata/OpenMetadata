/*
 *  Copyright 2021 Collate
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

import static org.openmetadata.service.events.subscription.AlertUtil.getFilteredEvents;
import static org.openmetadata.service.events.subscription.AlertUtil.getStartingOffset;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.FailedEvent;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO.ChangeEventRecord;
import org.openmetadata.service.notifications.recipients.RecipientResolver;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.util.DIContainer;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.PersistJobDataAfterExecution;

@Slf4j
@DisallowConcurrentExecution
@PersistJobDataAfterExecution
public abstract class AbstractEventConsumer
    implements Alert<ChangeEvent>, Consumer<ChangeEvent>, Job {
  public static final String DESTINATION_MAP_KEY = "SubscriptionMapKey";
  public static final String ALERT_OFFSET_KEY = "alertOffsetKey";
  public static final String ALERT_PENDING_GAP_SINCE_KEY = "alertPendingGapSinceKey";
  public static final String ALERT_INFO_KEY = "alertInfoKey";
  public static final String OFFSET_EXTENSION = "eventSubscription.Offset";
  public static final String METRICS_EXTENSION = "eventSubscription.metrics";
  public static final String FAILED_EVENT_EXTENSION = "eventSubscription.failedEvent";
  static final long GAP_RESOLVE_TIMEOUT_MS = 30_000;
  protected final DIContainer dependencies;
  private long offset = -1;
  // Highest change_event.offset that is safe to commit after the last poll.
  private long lastReadOffset = -1;
  private long pendingGapSince;
  private boolean gapStateChanged;
  private long startingOffset = -1;

  private AlertMetrics alertMetrics;

  // Collect successful events during HTTP phase, batch write in commit phase.
  // This reduces connection pool contention from N connections to 1.
  // Thread-safety note: ArrayList is not thread-safe, but this is safe because
  // @DisallowConcurrentExecution ensures Quartz won't run the same job concurrently,
  // so this instance is only accessed by a single thread at a time.
  private final List<ChangeEvent> successfulEvents = new ArrayList<>();

  @Getter @Setter private JobDetail jobDetail;
  protected EventSubscription eventSubscription;
  protected Map<UUID, Destination<ChangeEvent>> destinationMap;

  protected AbstractEventConsumer(DIContainer dependencies) {
    this.dependencies = dependencies;
  }

  private void init(JobExecutionContext context) {
    this.jobDetail = context.getJobDetail();
    try {
      Object alertInfoValue = context.getJobDetail().getJobDataMap().get(ALERT_INFO_KEY);
      if (alertInfoValue == null) {
        LOG.error("ALERT_INFO_KEY not found in JobDataMap");
        return;
      }

      if (alertInfoValue instanceof String subscriptionJson) {
        this.eventSubscription = JsonUtils.readValue(subscriptionJson, EventSubscription.class);
        if (this.eventSubscription == null) {
          LOG.error("Failed to deserialize EventSubscription from JSON: {}", subscriptionJson);
          return;
        }
      } else if (alertInfoValue instanceof EventSubscription subscription) {
        this.eventSubscription = subscription;
      } else {
        LOG.error(
            "Unexpected type for ALERT_INFO_KEY: {}. Expected String or EventSubscription.",
            alertInfoValue.getClass().getName());
        return;
      }

      EventSubscriptionOffset eventSubscriptionOffset = loadInitialOffset(context);
      this.offset = eventSubscriptionOffset.getCurrentOffset();
      this.startingOffset = eventSubscriptionOffset.getStartingOffset();
      this.lastReadOffset = this.offset;
      this.pendingGapSince = loadPendingGapSince();
      this.gapStateChanged = false;
      this.alertMetrics = loadInitialMetrics();
      this.destinationMap = loadDestinationsMap(context);

      // We do not log warning for custom alert type. eg: Reverse Metadata
      if (this.destinationMap.isEmpty()
          && this.eventSubscription.getAlertType() != CreateEventSubscription.AlertType.CUSTOM) {
        LOG.warn(
            "EventSubscription {} has no destinations configured",
            this.eventSubscription.getName());
      }

      this.doInit(context);
    } catch (Exception e) {
      LOG.error("Failed to initialize EventConsumer from JobDataMap", e);
      this.eventSubscription = null;
    }
  }

  protected void doInit(JobExecutionContext context) {
    // To be implemented by the Subclass if needed
  }

  public enum FailureTowards {
    SUBSCRIBER,
    PUBLISHER
  }

  @Override
  public void handleFailedEvent(EventPublisherException ex, boolean errorOnSub) {
    if (ex.getChangeEventWithSubscription() == null) {
      LOG.error(
          "Change Event with Subscription is null in EventPublisherException: {}", ex.getMessage());
      return;
    }

    UUID failingSubscriptionId = ex.getChangeEventWithSubscription().getLeft();
    ChangeEvent changeEvent = ex.getChangeEventWithSubscription().getRight();
    LOG.debug(
        "Change Event Failed for Event Subscription: {} ,  for Subscription : {} , Change Event : {} ",
        eventSubscription.getName(),
        failingSubscriptionId,
        changeEvent);

    FailureTowards source = errorOnSub ? FailureTowards.SUBSCRIBER : FailureTowards.PUBLISHER;

    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .upsertFailedEvent(
            eventSubscription.getId().toString(),
            String.format("%s-%s", FAILED_EVENT_EXTENSION, changeEvent.getId()),
            JsonUtils.pojoToJson(
                new FailedEvent()
                    .withFailingSubscriptionId(failingSubscriptionId)
                    .withChangeEvent(changeEvent)
                    .withRetriesLeft(eventSubscription.getRetries())
                    .withReason(ex.getMessage())
                    .withTimestamp(System.currentTimeMillis())),
            source.toString());
  }

  private EventSubscriptionOffset loadInitialOffset(JobExecutionContext context) {
    Object offsetValue = jobDetail.getJobDataMap().get(ALERT_OFFSET_KEY);
    if (offsetValue != null) {
      EventSubscriptionOffset offset = null;
      if (offsetValue instanceof String offsetJson) {
        offset = JsonUtils.readValue(offsetJson, EventSubscriptionOffset.class);
      } else if (offsetValue instanceof EventSubscriptionOffset existingOffset) {
        offset = existingOffset;
      }
      if (offset != null) {
        return offset;
      }
    }

    EventSubscriptionOffset dbOffset = getStartingOffset(eventSubscription.getId());
    if (dbOffset != null) {
      context.getJobDetail().getJobDataMap().put(ALERT_OFFSET_KEY, JsonUtils.pojoToJson(dbOffset));
      return dbOffset;
    }

    LOG.warn("No offset found for subscription {}, using default", eventSubscription.getId());
    return getStartingOffset(eventSubscription.getId());
  }

  private long loadPendingGapSince() {
    Object value = jobDetail.getJobDataMap().get(ALERT_PENDING_GAP_SINCE_KEY);
    if (value instanceof Number number) {
      return number.longValue();
    }
    if (value instanceof String stringValue && !stringValue.isBlank()) {
      try {
        return Long.parseLong(stringValue);
      } catch (NumberFormatException e) {
        LOG.warn(
            "Invalid pending gap timestamp '{}' for event subscription {}",
            stringValue,
            eventSubscription.getId());
      }
    }
    return 0L;
  }

  private Map<UUID, Destination<ChangeEvent>> loadDestinationsMap(JobExecutionContext context) {
    Map<UUID, Destination<ChangeEvent>> dMap = new HashMap<>();
    if (eventSubscription.getDestinations() == null) {
      return dMap;
    }
    for (SubscriptionDestination subscriptionDest : eventSubscription.getDestinations()) {
      dMap.put(
          subscriptionDest.getId(), AlertFactory.getAlert(eventSubscription, subscriptionDest));
    }
    return dMap;
  }

  private AlertMetrics loadInitialMetrics() {
    String json =
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .getSubscriberExtension(eventSubscription.getId().toString(), METRICS_EXTENSION);
    if (json != null) {
      return JsonUtils.readValue(json, AlertMetrics.class);
    }
    return new AlertMetrics().withTotalEvents(0).withFailedEvents(0).withSuccessEvents(0);
  }

  @Override
  public void publishEvents(Map<ChangeEvent, Set<UUID>> events) {
    if (events.isEmpty()) {
      return;
    }
    Map<ChangeEvent, Set<UUID>> filteredEvents = getFilteredEvents(eventSubscription, events);
    RecipientResolver resolver = new RecipientResolver();
    int successDeliveries = 0;
    int failedDeliveries = 0;
    for (Map.Entry<ChangeEvent, Set<UUID>> eventWithReceivers : filteredEvents.entrySet()) {
      EventDeliveryResult result =
          publishEvent(eventWithReceivers.getKey(), eventWithReceivers.getValue(), resolver);
      // Record once per (event, subscription): the table has no destination dimension, so
      // recording per type would duplicate rows and break Postgres ON CONFLICT.
      if (result.delivered()) {
        successfulEvents.add(eventWithReceivers.getKey());
      }
      successDeliveries += result.successCount();
      failedDeliveries += result.failedCount();
    }
    alertMetrics.withSuccessEvents(alertMetrics.getSuccessEvents() + successDeliveries);
    alertMetrics.withFailedEvents(alertMetrics.getFailedEvents() + failedDeliveries);
  }

  private EventDeliveryResult publishEvent(
      ChangeEvent event, Set<UUID> destinationIds, RecipientResolver resolver) {
    // Group destinations by type to enable cross-destination recipient deduplication
    Map<SubscriptionType, List<Destination<ChangeEvent>>> destinationsByType =
        groupDestinationsByType(destinationIds);
    int successCount = 0;
    int failedCount = 0;
    for (Map.Entry<SubscriptionType, List<Destination<ChangeEvent>>> entry :
        destinationsByType.entrySet()) {
      if (sendToDestinationType(event, entry.getValue(), resolver)) {
        successCount++;
      } else {
        failedCount++;
      }
    }
    return new EventDeliveryResult(successCount > 0, successCount, failedCount);
  }

  private record EventDeliveryResult(boolean delivered, int successCount, int failedCount) {}

  private boolean sendToDestinationType(
      ChangeEvent event, List<Destination<ChangeEvent>> destinations, RecipientResolver resolver) {
    Destination<ChangeEvent> publisher = destinations.getFirst();
    // Resolve recipients from all destinations of this type for deduplication
    Set<Recipient> recipients = Set.of();
    if (publisher.requiresRecipients()) {
      List<SubscriptionDestination> subDestinations =
          destinations.stream().map(Destination::getSubscriptionDestination).toList();
      recipients = resolver.resolveRecipients(event, subDestinations);
    }
    // Send via primary destination only, with deduplicated recipients (one send per type).
    // Empty recipients is treated as successful (no-op send).
    boolean status = true;
    if (!publisher.requiresRecipients() || !recipients.isEmpty()) {
      try {
        publisher.sendMessage(event, recipients);
      } catch (EventPublisherException e) {
        LOG.error("Failed to send alert: {}", e.getMessage());
        handleFailedEvent(e, true);
        status = false;
      }
    }
    return status;
  }

  private Map<SubscriptionType, List<Destination<ChangeEvent>>> groupDestinationsByType(
      Set<UUID> destinationIds) {
    return destinationIds.stream()
        .map(destinationMap::get)
        .filter(Objects::nonNull)
        .filter(Destination::getEnabled)
        .collect(Collectors.groupingBy(dest -> dest.getSubscriptionDestination().getType()));
  }

  @Override
  public void commit(JobExecutionContext jobExecutionContext) {
    long currentTime = System.currentTimeMillis();

    // Batch write all successful events in ONE DB call instead of N calls.
    // This reduces connection pool contention significantly.
    // Important: We catch exceptions here to ensure offset is always updated.
    // If batch record fails but events were already sent to destinations,
    // we must still advance the offset to prevent duplicate HTTP calls on retry.
    if (!successfulEvents.isEmpty()) {
      try {
        batchRecordSuccessfulEvents(eventSubscription.getId(), currentTime);
      } catch (Exception e) {
        LOG.error(
            "Batch recording failed for {} events in subscription {}. "
                + "Events were delivered but success records lost. Continuing with offset update.",
            successfulEvents.size(),
            eventSubscription.getId(),
            e);
      } finally {
        successfulEvents.clear();
      }
    }

    EventSubscriptionOffset eventSubscriptionOffset =
        new EventSubscriptionOffset()
            .withCurrentOffset(offset)
            .withStartingOffset(startingOffset)
            .withTimestamp(currentTime);

    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .upsertSubscriberExtension(
            eventSubscription.getId().toString(),
            OFFSET_EXTENSION,
            "eventSubscriptionOffset",
            JsonUtils.pojoToJson(eventSubscriptionOffset));

    jobExecutionContext
        .getJobDetail()
        .getJobDataMap()
        .put(ALERT_OFFSET_KEY, JsonUtils.pojoToJson(eventSubscriptionOffset));

    persistPendingGapState(jobExecutionContext);

    jobExecutionContext
        .getJobDetail()
        .getJobDataMap()
        .put(ALERT_INFO_KEY, JsonUtils.pojoToJson(eventSubscription));

    AlertMetrics metrics =
        new AlertMetrics()
            .withTotalEvents(alertMetrics.getTotalEvents())
            .withFailedEvents(alertMetrics.getFailedEvents())
            .withSuccessEvents(alertMetrics.getSuccessEvents())
            .withTimestamp(currentTime);

    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .upsertSubscriberExtension(
            eventSubscription.getId().toString(),
            METRICS_EXTENSION,
            "alertMetrics",
            JsonUtils.pojoToJson(metrics));
  }

  private void batchRecordSuccessfulEvents(UUID subscriptionId, long timestamp) {
    List<String> changeEventIds = new ArrayList<>();
    List<String> subscriptionIds = new ArrayList<>();
    List<String> jsonList = new ArrayList<>();
    List<Long> timestamps = new ArrayList<>();

    for (ChangeEvent event : successfulEvents) {
      changeEventIds.add(event.getId().toString());
      subscriptionIds.add(subscriptionId.toString());
      jsonList.add(JsonUtils.pojoToJson(event));
      timestamps.add(timestamp);
    }

    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .batchUpsertSuccessfulChangeEvents(changeEventIds, subscriptionIds, jsonList, timestamps);
  }

  @Override
  public ResultList<ChangeEvent> pollEvents(long offset, long batchSize) {
    var records =
        Entity.getCollectionDAO().changeEventDAO().listWithOffset((int) batchSize, offset);
    CursorPlan cursorPlan =
        planCursor(offset, pendingGapSince, records, System.currentTimeMillis());
    gapStateChanged = cursorPlan.pendingGapSince() != pendingGapSince;
    pendingGapSince = cursorPlan.pendingGapSince();
    lastReadOffset = cursorPlan.offset();

    if (cursorPlan.skippedGap()) {
      LOG.warn(
          "Event subscription {} skipping unfilled change_event gap [{} .. {}] after {}ms",
          eventSubscription.getId(),
          offset + 1,
          cursorPlan.offset(),
          GAP_RESOLVE_TIMEOUT_MS);
    }

    List<ChangeEvent> changeEvents = new ArrayList<>();
    List<EntityError> errorEvents = new ArrayList<>();
    for (int index = 0; index < cursorPlan.recordCount(); index++) {
      var eventRecord = records.get(index);
      try {
        ChangeEvent event = JsonUtils.readValue(eventRecord.json(), ChangeEvent.class);
        if (event == null) {
          // JsonUtils.readValue returns null (it does not throw) on a null/blank json column, which
          // would add a null ChangeEvent to the delivered batch and NPE downstream. Route it to
          // errorEvents like any other unparseable row instead of silently delivering null.
          throw new IllegalStateException(
              "Null or blank change_event.json at offset " + eventRecord.offset());
        }
        changeEvents.add(event);
      } catch (Exception ex) {
        errorEvents.add(
            new EntityError().withMessage(ex.getMessage()).withEntity(eventRecord.json()));
        LOG.error(
            "Error in Parsing Change Event : {} , Message: {} ",
            eventRecord.json(),
            ex.getMessage(),
            ex);
      }
    }
    return new ResultList<>(changeEvents, errorEvents, null, null, cursorPlan.recordCount());
  }

  /**
   * Advances only across a contiguous prefix of committed offsets. AUTO_INCREMENT values become
   * visible at commit, so a concurrent transaction can temporarily hide a lower offset while a
   * higher offset is already readable. Waiting at that gap prevents permanent event loss. A gap
   * that remains unfilled is eventually treated as a rolled-back insert so consumers cannot stall
   * forever.
   */
  static CursorPlan planCursor(
      long currentOffset, long pendingGapSince, List<ChangeEventRecord> records, long now) {
    if (records.isEmpty()) {
      return new CursorPlan(currentOffset, 0L, 0, false);
    }

    int contiguousCount = 0;
    long expectedOffset = currentOffset + 1;
    while (contiguousCount < records.size()
        && records.get(contiguousCount).offset() == expectedOffset) {
      contiguousCount++;
      expectedOffset++;
    }

    if (contiguousCount > 0) {
      return new CursorPlan(currentOffset + contiguousCount, 0L, contiguousCount, false);
    }
    if (pendingGapSince == 0L) {
      return new CursorPlan(currentOffset, now, 0, false);
    }
    if (now - pendingGapSince >= GAP_RESOLVE_TIMEOUT_MS) {
      return new CursorPlan(records.getFirst().offset() - 1, 0L, 0, true);
    }
    return new CursorPlan(currentOffset, pendingGapSince, 0, false);
  }

  record CursorPlan(long offset, long pendingGapSince, int recordCount, boolean skippedGap) {}

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {
    this.init(jobExecutionContext);
    if (this.eventSubscription == null) {
      LOG.error("Skipping job execution - EventSubscription could not be loaded");
      return;
    }
    long batchSize = 0;
    Map<ChangeEvent, Set<UUID>> eventsWithReceivers = new HashMap<>();
    try {
      ResultList<ChangeEvent> batch = pollEvents(offset, eventSubscription.getBatchSize());
      batchSize = batch.getPaging().getTotal();
      eventsWithReceivers.putAll(createEventsWithReceivers(batch.getData()));
      if (!eventsWithReceivers.isEmpty()) {
        alertMetrics.withTotalEvents(alertMetrics.getTotalEvents() + eventsWithReceivers.size());
        publishEvents(eventsWithReceivers);
      }
    } catch (Exception e) {
      LOG.error(
          "Error in polling events for alert : {} , Offset : {} , Batch Size : {} ",
          e.getMessage(),
          offset,
          batchSize,
          e);

    } finally {
      if (lastReadOffset > offset) {
        offset = lastReadOffset;
        commit(jobExecutionContext);
      } else if (gapStateChanged) {
        persistPendingGapState(jobExecutionContext);
      }
    }
  }

  private void persistPendingGapState(JobExecutionContext jobExecutionContext) {
    jobExecutionContext
        .getJobDetail()
        .getJobDataMap()
        .put(ALERT_PENDING_GAP_SINCE_KEY, Long.toString(pendingGapSince));
  }

  public EventSubscription getEventSubscription() {
    return eventSubscription;
  }

  private Map<ChangeEvent, Set<UUID>> createEventsWithReceivers(List<ChangeEvent> events) {
    Map<ChangeEvent, Set<UUID>> eventsWithReceivers =
        new TreeMap<>(Comparator.comparing(ChangeEvent::getId));
    for (ChangeEvent changeEvent : events) {
      Set<UUID> receivers = Set.of(destinationMap.keySet().toArray(UUID[]::new));
      eventsWithReceivers.put(changeEvent, receivers);
    }
    return eventsWithReceivers;
  }
}
