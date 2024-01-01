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

import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.ACTIVE;
import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.AWAITING_RETRY;
import static org.openmetadata.schema.entity.events.SubscriptionStatus.Status.FAILED;
import static org.openmetadata.service.events.subscription.AlertUtil.getFilteredEvent;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.BiPredicate;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.FailedEvent;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.AlertUtil;
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
public abstract class AbstractEventConsumer implements Consumer<ChangeEvent>, Job {
  public static final BiPredicate<FailedEvent, FailedEvent> eventMatch =
      (f1, f2) -> f1.getChangeEvent().equals(f2.getChangeEvent());
  public static final String ALERT_OFFSET_KEY = "alertOffsetKey";
  public static final String ALERT_INFO_KEY = "alertInfoKey";
  private static final String OFFSET_EXTENSION = "eventSubscription.Offset";
  private static final String METRICS_EXTENSION = "eventSubscription.metrics";
  private static final String FAILED_EVENT_EXTENSION = "eventSubscription.failedEvent";
  protected static final int BACKOFF_NORMAL = 0;
  protected static final int BACKOFF_3_SECONDS = 3 * 1000;
  protected static final int BACKOFF_30_SECONDS = 30 * 1000;
  protected static final int BACKOFF_5_MINUTES = 5 * 60 * 1000;
  protected static final int BACKOFF_1_HOUR = 60 * 60 * 1000;
  protected static final int BACKOFF_24_HOUR = 24 * 60 * 60 * 1000;

  @Getter protected int currentBackoffTime = BACKOFF_NORMAL;
  private int offset = -1;
  private AlertMetrics alertMetrics;

  @Getter @Setter private JobDetail jobDetail;
  protected EventSubscription eventSubscription;

  protected AbstractEventConsumer() {}

  private void init(JobExecutionContext context) {
    EventSubscription sub =
        (EventSubscription) context.getJobDetail().getJobDataMap().get(ALERT_INFO_KEY);
    this.jobDetail = context.getJobDetail();
    this.eventSubscription = sub;
    this.offset = loadInitialOffset();
    this.alertMetrics = loadInitialMetrics();
    this.doInit(context);
  }

  protected abstract void doInit(JobExecutionContext context);

  protected void sendAlert(ChangeEvent event) throws EventPublisherException {
    /* This method needs to be over-ridden by specific Publisher for sending Alert */

  }

  @Override
  public void handleFailedEvent(EventPublisherException ex) {
    LOG.debug(
        "Failed in for Publisher : {} , Change Event : {} ",
        eventSubscription.getName(),
        ex.getChangeEvent());

    FailedEvent failedEvent =
        new FailedEvent()
            .withChangeEvent(ex.getChangeEvent())
            .withReason(ex.getMessage())
            .withRetriesLeft(eventSubscription.getRetries())
            .withTimestamp(System.currentTimeMillis());

    // Check in Qtz Map
    Set<FailedEvent> failedEventsList =
        JsonUtils.convertValue(
            jobDetail.getJobDataMap().get(FAILED_EVENT_EXTENSION), new TypeReference<>() {});
    if (failedEventsList == null) {
      failedEventsList = new HashSet<>();
    }

    // Test If the Failing Event is present in the List
    boolean removeChangeEvent =
        failedEventsList.removeIf(
            (failedEvent1) -> {
              boolean matched = eventMatch.test(failedEvent1, failedEvent);
              if (matched) {
                failedEvent.withRetriesLeft(failedEvent1.getRetriesLeft() - 1);
              }
              return matched;
            });

    // Check if the event was removed
    if (removeChangeEvent) {
      if (failedEvent.getRetriesLeft() == 0) {
        // If the Retries are exhausted, then remove the Event from the List to DLQ
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .upsertFailedEvent(
                eventSubscription.getId().toString(),
                FAILED_EVENT_EXTENSION,
                JsonUtils.pojoToJson(failedEvent.withRetriesLeft(0)));
      } else {
        failedEvent.withRetriesLeft(failedEvent.getRetriesLeft() - 1);
      }
    }
    failedEventsList.add(failedEvent);
    jobDetail.getJobDataMap().put(FAILED_EVENT_EXTENSION, failedEventsList);
  }

  private int loadInitialOffset() {
    EventSubscriptionOffset jobStoredOffset =
        (EventSubscriptionOffset) jobDetail.getJobDataMap().get(ALERT_OFFSET_KEY);
    // If the Job Data Map has the latest offset, use it
    if (jobStoredOffset != null) {
      return jobStoredOffset.getOffset();
    } else {
      int eventSubscriptionOffset;
      String json =
          Entity.getCollectionDAO()
              .eventSubscriptionDAO()
              .getSubscriberExtension(eventSubscription.getId().toString(), OFFSET_EXTENSION);
      if (json != null) {
        EventSubscriptionOffset offsetFromDb =
            JsonUtils.readValue(json, EventSubscriptionOffset.class);
        eventSubscriptionOffset = offsetFromDb.getOffset();
      } else {
        eventSubscriptionOffset = Entity.getCollectionDAO().changeEventDAO().listCount();
      }
      // Update the Job Data Map with the latest offset
      return eventSubscriptionOffset;
    }
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
  public void publishEvents(List<ChangeEvent> events) {
    // If no events return
    if (events.isEmpty()) {
      return;
    }

    // Filter the Change Events based on Alert Trigger Config
    List<ChangeEvent> filteredEvents =
        getFilteredEvent(events, eventSubscription.getFilteringRules());

    for (ChangeEvent event : filteredEvents) {
      try {
        sendAlert(event);
      } catch (EventPublisherException e) {
        handleFailedEvent(e);
      }
    }
  }

  @Override
  public void commit(JobExecutionContext jobExecutionContext) {
    long currentTime = System.currentTimeMillis();
    EventSubscriptionOffset eventSubscriptionOffset =
        new EventSubscriptionOffset().withOffset(offset).withTimestamp(currentTime);

    // Upsert Offset to Database
    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .upsertSubscriberExtension(
            eventSubscription.getId().toString(),
            OFFSET_EXTENSION,
            "eventSubscriptionOffset",
            JsonUtils.pojoToJson(eventSubscriptionOffset));

    // Update the Job Data Map with the latest offset
    jobExecutionContext
        .getJobDetail()
        .getJobDataMap()
        .put(ALERT_OFFSET_KEY, eventSubscriptionOffset);

    // Upsert Metrics to Database
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

    // Update the Job Data Map with latest Metrics
    jobExecutionContext.getJobDetail().getJobDataMap().put(METRICS_EXTENSION, alertMetrics);
  }

  public synchronized void setErrorStatus(Long attemptTime, Integer statusCode, String reason) {
    setStatus(FAILED, attemptTime, statusCode, reason, null);
  }

  public synchronized void setAwaitingRetry(Long attemptTime, int statusCode, String reason) {
    setStatus(AWAITING_RETRY, attemptTime, statusCode, reason, attemptTime + currentBackoffTime);
  }

  public synchronized void setSuccessStatus(Long updateTime) {
    SubscriptionStatus subStatus =
        AlertUtil.buildSubscriptionStatus(
            ACTIVE, updateTime, null, null, null, updateTime, updateTime);
    eventSubscription.setStatusDetails(subStatus);
  }

  protected synchronized void setStatus(
      SubscriptionStatus.Status status,
      Long attemptTime,
      Integer statusCode,
      String reason,
      Long timestamp) {
    SubscriptionStatus subStatus =
        AlertUtil.buildSubscriptionStatus(
            status, null, attemptTime, statusCode, reason, timestamp, attemptTime);
    eventSubscription.setStatusDetails(subStatus);
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
    List<ChangeEvent> batch = pollEvents(offset, 100);
    int batchSize = batch.size();

    // Retry Failed Events
    Set<FailedEvent> failedEventsList =
        JsonUtils.convertValue(
            jobDetail.getJobDataMap().get(FAILED_EVENT_EXTENSION), new TypeReference<>() {});
    if (failedEventsList != null) {
      List<ChangeEvent> failedChangeEvents =
          failedEventsList.stream()
              .filter(failedEvent -> failedEvent.getRetriesLeft() > 0)
              .map(FailedEvent::getChangeEvent)
              .toList();
      batch.addAll(failedChangeEvents);
    }

    // Publish Events
    publishEvents(batch);

    // Commit the Offset
    offset += batchSize;
    commit(jobExecutionContext);
  }

  public void setNextBackOff() {
    if (currentBackoffTime == BACKOFF_NORMAL) {
      currentBackoffTime = BACKOFF_3_SECONDS;
    } else if (currentBackoffTime == BACKOFF_3_SECONDS) {
      currentBackoffTime = BACKOFF_30_SECONDS;
    } else if (currentBackoffTime == BACKOFF_30_SECONDS) {
      currentBackoffTime = BACKOFF_5_MINUTES;
    } else if (currentBackoffTime == BACKOFF_5_MINUTES) {
      currentBackoffTime = BACKOFF_1_HOUR;
    } else if (currentBackoffTime == BACKOFF_1_HOUR) {
      currentBackoffTime = BACKOFF_24_HOUR;
    }
  }

  public EventSubscription getEventSubscription() {
    return (EventSubscription) jobDetail.getJobDataMap().get(ALERT_INFO_KEY);
  }
}
