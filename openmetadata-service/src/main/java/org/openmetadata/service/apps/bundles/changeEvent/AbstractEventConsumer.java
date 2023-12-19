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

import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.errors.RetriableException;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

@Slf4j
@DisallowConcurrentExecution
public abstract class AbstractEventConsumer implements Consumer<ChangeEvent>, Job {
  public static final String ALERT_OFFSET_KEY = "alertOffsetKey";
  public static final String ALERT_INFO_KEY = "alertInfoKey";
  private static final String OFFSET_EXTENSION = "eventSubscription.Offset";
  protected static final int BACKOFF_NORMAL = 0;
  protected static final int BACKOFF_3_SECONDS = 3 * 1000;
  protected static final int BACKOFF_30_SECONDS = 30 * 1000;
  protected static final int BACKOFF_5_MINUTES = 5 * 60 * 1000;
  protected static final int BACKOFF_1_HOUR = 60 * 60 * 1000;
  protected static final int BACKOFF_24_HOUR = 24 * 60 * 60 * 1000;

  @Getter protected int currentBackoffTime = BACKOFF_NORMAL;
  private int offset = -1;

  @Getter @Setter private JobDetail jobDetail;
  protected EventSubscription eventSubscription;

  protected AbstractEventConsumer() {}

  private void init(JobExecutionContext context) {
    EventSubscription sub =
        (EventSubscription) context.getJobDetail().getJobDataMap().get(ALERT_INFO_KEY);
    this.jobDetail = context.getJobDetail();
    this.eventSubscription = sub;
    this.offset = loadInitialOffset();
    this.doInit(context);
  }

  protected abstract void doInit(JobExecutionContext context);

  protected void sendAlert(List<ChangeEvent> list) {
    /* This method needs to be over-ridden by specific Publisher for sending Alert */

  }

  @Override
  public void handleFailedEvents(List<ChangeEvent> failedEvents) {}

  @Override
  public void handleException(Exception e) {}

  private int loadInitialOffset() {
    int eventSubscriptionOffset;
    String json =
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .getSubscriberOffset(eventSubscription.getId().toString(), OFFSET_EXTENSION);
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

  @Override
  public boolean publishEvents(List<ChangeEvent> events) throws InterruptedException {
    // Publish to the given Alert Actions
    // Evaluate Alert Trigger Config

    // Filter the Change Events based on Alert Trigger Config
    List<ChangeEvent> filteredEvents = new ArrayList<>();
    for (ChangeEvent event : events) {
      boolean triggerChangeEvent =
          AlertUtil.shouldTriggerAlert(
              event.getEntityType(), eventSubscription.getFilteringRules());

      // Evaluate ChangeEvent Alert Filtering
      if (eventSubscription.getFilteringRules() != null
          && !AlertUtil.evaluateAlertConditions(
              event, eventSubscription.getFilteringRules().getRules())) {
        triggerChangeEvent = false;
      }

      if (triggerChangeEvent) {
        // Ignore the event since change description is null
        if (event.getChangeDescription() != null) {
          filteredEvents.add(event);
        } else {
          LOG.info(
              "Email Publisher Event Will be Ignored Since Change Description is null. Received Event: {}",
              event);
        }
      }
    }

    try {
      sendAlert(filteredEvents);
      return true;
    } catch (RetriableException ex) {
      setNextBackOff();
      LOG.error(
          "Failed to publish event in batch {} due to {}, will try again in {} ms",
          filteredEvents,
          ex,
          currentBackoffTime);
      Thread.sleep(currentBackoffTime);
    } catch (Exception e) {
      LOG.error("[AbstractAlertPublisher] error {}", e.getMessage(), e);
    }
    return false;
  }

  @Override
  public void commitOffset(JobExecutionContext jobExecutionContext, int offset) {
    EventSubscriptionOffset eventSubscriptionOffset =
        new EventSubscriptionOffset().withOffset(offset).withTimestamp(System.currentTimeMillis());
    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .upsertSubscriberOffset(
            eventSubscription.getId().toString(),
            OFFSET_EXTENSION,
            "eventSubscriptionOffset",
            JsonUtils.pojoToJson(eventSubscriptionOffset));

    // Update the Job Data Map with the latest offset
    jobExecutionContext.getJobDetail().getJobDataMap().put(ALERT_OFFSET_KEY, offset);
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

    try {
      List<ChangeEvent> batch = pollEvents(offset, 100);
      if (!batch.isEmpty()) {
        boolean success = publishEvents(batch);
        if (success) {
          offset += batch.size();
        } else {
          handleFailedEvents(batch);
        }
      }
    } catch (InterruptedException e) {
      LOG.error("Interrupted while polling events", e);
      Thread.currentThread().interrupt();
    } catch (Exception e) {
      handleException(e);
    } finally {
      LOG.debug(
          "Committing offset for eventSubscription {}  {}", eventSubscription.getName(), offset);
      commitOffset(jobExecutionContext, offset);
    }
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
