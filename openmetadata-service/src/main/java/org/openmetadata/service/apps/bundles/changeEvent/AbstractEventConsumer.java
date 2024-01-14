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

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.FailedEvent;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
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
  private long offset = -1;
  private AlertMetrics alertMetrics;

  @Getter @Setter private JobDetail jobDetail;
  protected EventSubscription eventSubscription;
  protected Map<UUID, Destination<ChangeEvent>> destinationMap;

  protected AbstractEventConsumer() {}

  private void init(JobExecutionContext context) {
    EventSubscription sub =
        (EventSubscription) context.getJobDetail().getJobDataMap().get(ALERT_INFO_KEY);
    this.jobDetail = context.getJobDetail();
    this.eventSubscription = sub;
    this.offset = loadInitialOffset(context);
    this.alertMetrics = loadInitialMetrics();
    this.destinationMap = loadDestinationsMap(context);
    this.doInit(context);
  }

  protected void doInit(JobExecutionContext context) {
    // To be implemented by the Subclass if needed
  }

  @Override
  public void handleFailedEvent(EventPublisherException ex) {
    UUID failingSubscriptionId = ex.getChangeEventWithSubscription().getLeft();
    ChangeEvent changeEvent = ex.getChangeEventWithSubscription().getRight();
    LOG.debug(
        "Change Event Failed for Event Subscription: {} ,  for Subscription : {} , Change Event : {} ",
        eventSubscription.getName(),
        failingSubscriptionId,
        changeEvent);

    // Update Failed Event with details
    FailedEvent failedEvent =
        new FailedEvent()
            .withFailingSubscriptionId(failingSubscriptionId)
            .withChangeEvent(changeEvent)
            .withRetriesLeft(eventSubscription.getRetries())
            .withTimestamp(System.currentTimeMillis());

    if (eventSubscription.getRetries() == 0) {
      Entity.getCollectionDAO()
          .eventSubscriptionDAO()
          .upsertFailedEvent(
              eventSubscription.getId().toString(),
              String.format("%s-%s", FAILED_EVENT_EXTENSION, changeEvent.getId()),
              JsonUtils.pojoToJson(failedEvent));
    } else {
      // Check in Qtz Map
      Set<FailedEvent> failedEventsList =
          JsonUtils.convertValue(
              jobDetail.getJobDataMap().get(FAILED_EVENT_EXTENSION), new TypeReference<>() {});
      if (failedEventsList == null) {
        failedEventsList = new HashSet<>();
      } else {
        // Remove exising change event
        boolean removeChangeEvent =
            failedEventsList.removeIf(
                failedEvent1 -> {
                  if (failedEvent1
                          .getChangeEvent()
                          .getId()
                          .equals(failedEvent.getChangeEvent().getId())
                      && failedEvent1.getFailingSubscriptionId().equals(failingSubscriptionId)) {
                    failedEvent.withRetriesLeft(failedEvent1.getRetriesLeft());
                    return true;
                  }
                  return false;
                });

        if (removeChangeEvent) {
          if (failedEvent.getRetriesLeft() == 0) {
            // If the Retries are exhausted, then remove the Event from the List to DLQ
            failedEvent.withRetriesLeft(0);
          } else {
            failedEvent.withRetriesLeft(failedEvent.getRetriesLeft() - 1);
          }
        }
      }
      failedEventsList.add(failedEvent);
      jobDetail.getJobDataMap().put(FAILED_EVENT_EXTENSION, failedEventsList);
      Entity.getCollectionDAO()
          .eventSubscriptionDAO()
          .upsertFailedEvent(
              eventSubscription.getId().toString(),
              String.format("%s-%s", FAILED_EVENT_EXTENSION, changeEvent.getId()),
              JsonUtils.pojoToJson(failedEvent));
    }
  }

  private long loadInitialOffset(JobExecutionContext context) {
    EventSubscriptionOffset jobStoredOffset =
        (EventSubscriptionOffset) jobDetail.getJobDataMap().get(ALERT_OFFSET_KEY);
    // If the Job Data Map has the latest offset, use it
    if (jobStoredOffset != null) {
      return jobStoredOffset.getOffset();
    } else {
      EventSubscriptionOffset eventSubscriptionOffset =
          getStartingOffset(eventSubscription.getId());
      // Update the Job Data Map with the latest offset
      context.getJobDetail().getJobDataMap().put(ALERT_OFFSET_KEY, eventSubscriptionOffset);
      return eventSubscriptionOffset.getOffset();
    }
  }

  private Map<UUID, Destination<ChangeEvent>> loadDestinationsMap(JobExecutionContext context) {
    Map<UUID, Destination<ChangeEvent>> dMap =
        (Map<UUID, Destination<ChangeEvent>>)
            context.getJobDetail().getJobDataMap().get(DESTINATION_MAP_KEY);
    if (dMap == null) {
      dMap = new HashMap<>();
      for (SubscriptionDestination subscription : eventSubscription.getDestinations()) {
        dMap.put(subscription.getId(), AlertFactory.getAlert(subscription));
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
        try {
          sendAlert(receiverId, eventWithReceivers.getKey());
          alertMetrics.withSuccessEvents(alertMetrics.getSuccessEvents() + 1);
        } catch (EventPublisherException e) {
          alertMetrics.withFailedEvents(alertMetrics.getFailedEvents() + 1);
          handleFailedEvent(e);
        }
      }
    }
  }

  @Override
  public void commit(JobExecutionContext jobExecutionContext) {
    long currentTime = System.currentTimeMillis();
    // Upsert Offset
    EventSubscriptionOffset eventSubscriptionOffset =
        new EventSubscriptionOffset().withOffset(offset).withTimestamp(currentTime);
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
  public List<ChangeEvent> pollEvents(long offset, long batchSize) {
    // Read from Change Event Table
    List<String> eventJson = Entity.getCollectionDAO().changeEventDAO().list(batchSize, offset);

    List<ChangeEvent> changeEvents = new ArrayList<>();
    for (String json : eventJson) {
      ChangeEvent event = JsonUtils.readValue(json, ChangeEvent.class);
      changeEvents.add(event);
    }
    return changeEvents;
  }

  @Override
  public void execute(JobExecutionContext jobExecutionContext) throws JobExecutionException {
    // Must Have , Before Execute the Init, Quartz Requires a Non-Arg Constructor
    this.init(jobExecutionContext);

    // Poll Events from Change Event Table
    List<ChangeEvent> batch = pollEvents(offset, eventSubscription.getBatchSize());
    int batchSize = batch.size();

    Map<ChangeEvent, Set<UUID>> eventsWithReceivers = createEventsWithReceivers(batch);

    // Retry Failed Events
    Set<FailedEvent> failedEventsList =
        JsonUtils.convertValue(
            jobDetail.getJobDataMap().get(FAILED_EVENT_EXTENSION), new TypeReference<>() {});
    if (failedEventsList != null) {
      Map<ChangeEvent, Set<UUID>> failedChangeEvents =
          failedEventsList.stream()
              .filter(failedEvent -> failedEvent.getRetriesLeft() > 0)
              .collect(
                  Collectors.toMap(
                      FailedEvent::getChangeEvent,
                      failedEvent -> Set.of(failedEvent.getFailingSubscriptionId())));
      eventsWithReceivers.putAll(failedChangeEvents);
    }

    if (!eventsWithReceivers.isEmpty()) {
      // Publish Events
      alertMetrics.withTotalEvents(alertMetrics.getTotalEvents() + eventsWithReceivers.size());
      publishEvents(eventsWithReceivers);

      // Commit the Offset
      offset += batchSize;
      commit(jobExecutionContext);
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
