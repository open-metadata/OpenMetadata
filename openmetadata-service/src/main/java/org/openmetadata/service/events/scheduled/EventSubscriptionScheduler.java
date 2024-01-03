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

package org.openmetadata.service.events.scheduled;

import static org.openmetadata.schema.api.events.CreateEventSubscription.SubscriptionType.ACTIVITY_FEED;
import static org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer.ALERT_INFO_KEY;
import static org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer.ALERT_OFFSET_KEY;

import java.util.Objects;
import java.util.UUID;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.TriggerKey;
import org.quartz.impl.StdSchedulerFactory;

@Slf4j
public class EventSubscriptionScheduler {
  public static final String ALERT_JOB_GROUP = "OMAlertJobGroup";
  public static final String ALERT_TRIGGER_GROUP = "OMAlertJobGroup";
  private static final String INVALID_ALERT = "Invalid Alert Type";
  private static EventSubscriptionScheduler instance;
  private static volatile boolean initialized = false;
  private final Scheduler alertsScheduler = new StdSchedulerFactory().getScheduler();

  private EventSubscriptionScheduler() throws SchedulerException {
    this.alertsScheduler.start();
  }

  @SneakyThrows
  public static EventSubscriptionScheduler getInstance() {
    if (!initialized) {
      initialize();
    }
    return instance;
  }

  private static void initialize() throws SchedulerException {
    if (!initialized) {
      instance = new EventSubscriptionScheduler();
      initialized = true;
    } else {
      LOG.info("Event Subscription Scheduler is already initialized");
    }
  }

  @Transaction
  public void addSubscriptionPublisher(EventSubscription eventSubscription)
      throws SchedulerException {
    if (Objects.requireNonNull(eventSubscription.getAlertType())
        == CreateEventSubscription.AlertType.CHANGE_EVENT) {
      AbstractEventConsumer publisher = AlertUtil.getNotificationsPublisher(eventSubscription);
      if (Boolean.FALSE.equals(
          eventSubscription
              .getEnabled())) { // Only add webhook that is enabled for publishing events
        eventSubscription.setStatusDetails(
            getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status.DISABLED));
      } else {
        eventSubscription.setStatusDetails(
            getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status.ACTIVE));
        JobDetail jobDetail =
            jobBuilder(
                publisher,
                eventSubscription,
                String.format("%s", eventSubscription.getId().toString()));
        Trigger trigger = trigger(eventSubscription);

        // Schedule the Job
        alertsScheduler.scheduleJob(jobDetail, trigger);
      }
      LOG.info(
          "Webhook publisher subscription started as {} : status {}",
          eventSubscription.getName(),
          eventSubscription.getStatusDetails().getStatus());
    } else {
      throw new IllegalArgumentException(INVALID_ALERT);
    }
  }

  private JobDetail jobBuilder(
      AbstractEventConsumer consumer, EventSubscription eventSubscription, String jobIdentity) {
    JobDataMap dataMap = new JobDataMap();
    dataMap.put(ALERT_INFO_KEY, eventSubscription);
    dataMap.put(ALERT_OFFSET_KEY, getEventSubscriptionFromScheduledJob(eventSubscription.getId()));
    JobBuilder jobBuilder =
        JobBuilder.newJob(consumer.getClass())
            .withIdentity(jobIdentity, ALERT_JOB_GROUP)
            .usingJobData(dataMap);
    return jobBuilder.build();
  }

  private Trigger trigger(EventSubscription eventSubscription) {
    return TriggerBuilder.newTrigger()
        .withIdentity(eventSubscription.getId().toString(), ALERT_TRIGGER_GROUP)
        .withSchedule(SimpleScheduleBuilder.repeatSecondlyForever(3))
        .startNow()
        .build();
  }

  private SubscriptionStatus getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status status) {
    return new SubscriptionStatus().withStatus(status).withTimestamp(System.currentTimeMillis());
  }

  @Transaction
  @SneakyThrows
  public void updateEventSubscription(EventSubscription eventSubscription) {
    if (Objects.requireNonNull(eventSubscription.getAlertType())
        == CreateEventSubscription.AlertType.CHANGE_EVENT) {
      // Remove Existing Subscription Publisher
      deleteEventSubscriptionPublisher(eventSubscription);
      if (Boolean.TRUE.equals(eventSubscription.getEnabled())
          && (!eventSubscription.getSubscriptionType().equals(ACTIVITY_FEED))) {
        addSubscriptionPublisher(eventSubscription);
      }
    } else {
      throw new IllegalArgumentException(INVALID_ALERT);
    }
  }

  @Transaction
  public void deleteEventSubscriptionPublisher(EventSubscription deletedEntity)
      throws SchedulerException {
    if (Objects.requireNonNull(deletedEntity.getAlertType())
        == CreateEventSubscription.AlertType.CHANGE_EVENT) {
      alertsScheduler.deleteJob(new JobKey(deletedEntity.getId().toString(), ALERT_JOB_GROUP));
      alertsScheduler.unscheduleJob(
          new TriggerKey(deletedEntity.getId().toString(), ALERT_TRIGGER_GROUP));
      LOG.info("Alert publisher deleted for {}", deletedEntity.getName());
    } else {
      throw new IllegalArgumentException(INVALID_ALERT);
    }
  }

  public SubscriptionStatus getStatusForEventSubscription(UUID id) {
    EventSubscription eventSubscription = getEventSubscriptionFromScheduledJob(id);
    if (eventSubscription == null) {
      EntityRepository<? extends EntityInterface> subscriptionRepository =
          Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);
      EventSubscription subscription =
          (EventSubscription)
              subscriptionRepository.get(null, id, subscriptionRepository.getFields("id"));
      if (subscription != null && (Boolean.FALSE.equals(subscription.getEnabled()))) {
        return new SubscriptionStatus().withStatus(SubscriptionStatus.Status.DISABLED);
      }
    } else {
      return eventSubscription.getStatusDetails();
    }
    return null;
  }

  public EventSubscription getEventSubscriptionFromScheduledJob(UUID id) {
    try {
      JobDetail jobDetail =
          alertsScheduler.getJobDetail(new JobKey(id.toString(), ALERT_JOB_GROUP));
      if (jobDetail != null) {
        return ((EventSubscription) jobDetail.getJobDataMap().get(ALERT_INFO_KEY));
      }
    } catch (SchedulerException ex) {
      LOG.error("Failed to get Event Subscription from Job, Subscription Id : {}", id);
    }
    return null;
  }

  public boolean checkIfPublisherPublishedAllEvents(UUID subscriptionID) {
    int countOfEvents = Entity.getCollectionDAO().changeEventDAO().listCount();
    try {
      JobDetail jobDetail =
          alertsScheduler.getJobDetail(new JobKey(subscriptionID.toString(), ALERT_JOB_GROUP));
      if (jobDetail != null) {
        EventSubscriptionOffset offset =
            ((EventSubscriptionOffset) jobDetail.getJobDataMap().get(ALERT_OFFSET_KEY));
        if (offset != null) {
          return offset.getOffset() == countOfEvents;
        }
      }
    } catch (Exception ex) {
      LOG.error(
          "Failed to get Event Subscription from Job, Subscription Id : {}, Exception: ",
          subscriptionID.toString(),
          ex);
    }
    return false;
  }

  public static void shutDown() throws SchedulerException {
    if (instance != null) {
      instance.alertsScheduler.shutdown();
    }
  }
}
