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
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.FailedEvent;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.util.DIContainer;
import org.openmetadata.service.util.ResultList;
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
  public static final String ALERT_INFO_KEY = "alertInfoKey";
  public static final String OFFSET_EXTENSION = "eventSubscription.Offset";
  public static final String METRICS_EXTENSION = "eventSubscription.metrics";
  public static final String FAILED_EVENT_EXTENSION = "eventSubscription.failedEvent";
  protected final DIContainer dependencies;
  private long offset = -1;
  private long startingOffset = -1;

  private AlertMetrics alertMetrics;

  @Getter @Setter private JobDetail jobDetail;
  protected EventSubscription eventSubscription;
  protected Map<UUID, Destination<ChangeEvent>> destinationMap;

  protected AbstractEventConsumer(DIContainer dependencies) {
    this.dependencies = dependencies;
  }

  private void init(JobExecutionContext context) {
    EventSubscription sub =
        (EventSubscription) context.getJobDetail().getJobDataMap().get(ALERT_INFO_KEY);
    this.jobDetail = context.getJobDetail();
    this.eventSubscription = sub;
    EventSubscriptionOffset eventSubscriptionOffset = loadInitialOffset(context);
    this.offset = eventSubscriptionOffset.getCurrentOffset();
    this.startingOffset = eventSubscriptionOffset.getStartingOffset();
    this.alertMetrics = loadInitialMetrics();
    this.destinationMap = loadDestinationsMap(context);
    this.doInit(context);
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

  private void recordSuccessfulChangeEvent(UUID eventSubscriptionId, ChangeEvent event) {
    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .upsertSuccessfulChangeEvent(
            event.getId().toString(),
            eventSubscriptionId.toString(),
            JsonUtils.pojoToJson(event),
            System.currentTimeMillis());
  }

  private EventSubscriptionOffset loadInitialOffset(JobExecutionContext context) {
    EventSubscriptionOffset jobStoredOffset =
        (EventSubscriptionOffset) jobDetail.getJobDataMap().get(ALERT_OFFSET_KEY);
    // If the Job Data Map has the latest offset, use it
    if (jobStoredOffset != null) {
      return jobStoredOffset;
    } else {
      EventSubscriptionOffset eventSubscriptionOffset =
          getStartingOffset(eventSubscription.getId());
      // Update the Job Data Map with the latest offset
      context.getJobDetail().getJobDataMap().put(ALERT_OFFSET_KEY, eventSubscriptionOffset);
      return eventSubscriptionOffset;
    }
  }

  private Map<UUID, Destination<ChangeEvent>> loadDestinationsMap(JobExecutionContext context) {
    Map<UUID, Destination<ChangeEvent>> dMap =
        (Map<UUID, Destination<ChangeEvent>>)
            context.getJobDetail().getJobDataMap().get(DESTINATION_MAP_KEY);
    if (dMap == null) {
      dMap = new HashMap<>();
      for (SubscriptionDestination subscriptionDest : eventSubscription.getDestinations()) {
        dMap.put(
            subscriptionDest.getId(), AlertFactory.getAlert(eventSubscription, subscriptionDest));
      }
      context.getJobDetail().getJobDataMap().put(DESTINATION_MAP_KEY, dMap);
    }
    return dMap;
  }

  private AlertMetrics loadInitialMetrics() {
    AlertMetrics metrics = (AlertMetrics) jobDetail.getJobDataMap().get(METRICS_EXTENSION);
    if (metrics != null) {
      return metrics;
    } else {
      String json =
          Entity.getCollectionDAO()
              .eventSubscriptionDAO()
              .getSubscriberExtension(eventSubscription.getId().toString(), METRICS_EXTENSION);
      if (json != null) {
        return JsonUtils.readValue(json, AlertMetrics.class);
      }
      // Update the Job Data Map with the latest offset
      return new AlertMetrics().withTotalEvents(0).withFailedEvents(0).withSuccessEvents(0);
    }
  }

  @Override
  public void publishEvents(Map<ChangeEvent, Set<UUID>> events) {
    // If no events return
    if (events.isEmpty()) {
      return;
    }

    // Filter the Change Events based on Alert Trigger Config
    Map<ChangeEvent, Set<UUID>> filteredEvents = getFilteredEvents(eventSubscription, events);

    for (var eventWithReceivers : filteredEvents.entrySet()) {
      for (UUID receiverId : eventWithReceivers.getValue()) {
        boolean status = sendAlert(receiverId, eventWithReceivers.getKey());
        if (status) {
          recordSuccessfulChangeEvent(eventSubscription.getId(), eventWithReceivers.getKey());
          alertMetrics.withSuccessEvents(alertMetrics.getSuccessEvents() + 1);
        } else {
          alertMetrics.withFailedEvents(alertMetrics.getFailedEvents() + 1);
        }
      }
    }
  }

  @Override
  public void commit(JobExecutionContext jobExecutionContext) {
    long currentTime = System.currentTimeMillis();
    // Upsert Offset
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
        .put(ALERT_OFFSET_KEY, eventSubscriptionOffset);

    // Upsert Metrics
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

    jobExecutionContext.getJobDetail().getJobDataMap().put(METRICS_EXTENSION, alertMetrics);

    // Populate the Destination map
    jobExecutionContext.getJobDetail().getJobDataMap().put(DESTINATION_MAP_KEY, destinationMap);
  }

  @Override
  public ResultList<ChangeEvent> pollEvents(long offset, long batchSize) {
    List<String> eventJson = Entity.getCollectionDAO().changeEventDAO().list(batchSize, offset);
    List<ChangeEvent> changeEvents = new ArrayList<>();
    List<EntityError> errorEvents = new ArrayList<>();
    for (String json : eventJson) {
      try {
        ChangeEvent event = JsonUtils.readValue(json, ChangeEvent.class);
        changeEvents.add(event);
      } catch (Exception ex) {
        errorEvents.add(new EntityError().withMessage(ex.getMessage()).withEntity(json));
        LOG.error("Error in Parsing Change Event : {} , Message: {} ", json, ex.getMessage(), ex);
      }
    }
    return new ResultList<>(changeEvents, errorEvents, null, null, eventJson.size());
  }

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {
    // Must Have , Before Execute the Init, Quartz Requires a Non-Arg Constructor
    this.init(jobExecutionContext);
    long batchSize = 0;
    Map<ChangeEvent, Set<UUID>> eventsWithReceivers = new HashMap<>();
    try {
      // Poll Events from Change Event Table
      ResultList<ChangeEvent> batch = pollEvents(offset, eventSubscription.getBatchSize());
      batchSize = batch.getPaging().getTotal();
      eventsWithReceivers.putAll(createEventsWithReceivers(batch.getData()));
      // Publish Events
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
      if (!eventsWithReceivers.isEmpty()) {
        // Commit the Offset
        offset += batchSize;
        commit(jobExecutionContext);
      }
    }
  }

  public EventSubscription getEventSubscription() {
    return (EventSubscription) jobDetail.getJobDataMap().get(ALERT_INFO_KEY);
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
