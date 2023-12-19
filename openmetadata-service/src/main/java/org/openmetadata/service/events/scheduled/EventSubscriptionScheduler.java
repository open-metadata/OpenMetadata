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

import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
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
  private static final ConcurrentHashMap<UUID, AbstractEventConsumer> alertJobMap =
      new ConcurrentHashMap<>();

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
  @SneakyThrows
  public void addSubscriptionPublisher(EventSubscription eventSubscription) {
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
      alertJobMap.put(eventSubscription.getId(), publisher);
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
    JobBuilder jobBuilder =
        JobBuilder.newJob(consumer.getClass())
            .withIdentity(jobIdentity, ALERT_JOB_GROUP)
            .usingJobData(dataMap);
    return jobBuilder.build();
  }

  private Trigger trigger(EventSubscription eventSubscription) {
    return TriggerBuilder.newTrigger()
        .withIdentity(eventSubscription.getId().toString(), ALERT_TRIGGER_GROUP)
        .withSchedule(SimpleScheduleBuilder.repeatSecondlyForever(10))
        .startNow()
        .build();
  }

  private SubscriptionStatus getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status status) {
    return new SubscriptionStatus().withStatus(status).withTimestamp(System.currentTimeMillis());
  }

  private AbstractEventConsumer getPublisher(UUID id) {
    return alertJobMap.get(id);
  }

  @Transaction
  @SneakyThrows
  public void updateEventSubscription(EventSubscription eventSubscription) {
    if (Objects.requireNonNull(eventSubscription.getAlertType())
        == CreateEventSubscription.AlertType.CHANGE_EVENT) {
      if (Boolean.TRUE.equals(
          eventSubscription.getEnabled())) { // Only add webhook that is enabled for publishing
        // If there was a previous webhook either in disabled state or stopped due
        // to errors, update it and restart publishing
        AbstractEventConsumer previousPublisher = getPublisher(eventSubscription.getId());
        if (previousPublisher == null) {
          if (!ACTIVITY_FEED.equals(eventSubscription.getSubscriptionType())) {
            addSubscriptionPublisher(eventSubscription);
          }
          return;
        }

        // Update the existing publisher
        deleteEventSubscriptionPublisher(eventSubscription);
        addSubscriptionPublisher(eventSubscription);
      } else {
        // Remove the webhook publisher
        removeProcessorForEventSubscription(
            eventSubscription.getId(),
            getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status.DISABLED));
      }
    } else {
      throw new IllegalArgumentException(INVALID_ALERT);
    }
  }

  @Transaction
  @SneakyThrows
  public void removeProcessorForEventSubscription(UUID id, SubscriptionStatus reasonForRemoval) {
    AbstractEventConsumer publisher = alertJobMap.get(id);
    if (publisher != null) {
      alertsScheduler.deleteJob(publisher.getJobDetail().getKey());
      publisher.getEventSubscription().setStatusDetails(reasonForRemoval);
      LOG.info("Alert publisher deleted for {}", publisher.getEventSubscription().getName());
    }
  }

  @Transaction
  public void deleteEventSubscriptionPublisher(EventSubscription deletedEntity)
      throws SchedulerException {
    if (Objects.requireNonNull(deletedEntity.getAlertType())
        == CreateEventSubscription.AlertType.CHANGE_EVENT) {
      AbstractEventConsumer publisher = alertJobMap.remove(deletedEntity.getId());
      if (publisher != null) {
        alertsScheduler.deleteJob(publisher.getJobDetail().getKey());
        alertsScheduler.unscheduleJob(
            new TriggerKey(deletedEntity.getId().toString(), ALERT_TRIGGER_GROUP));
        LOG.info("Alert publisher deleted for {}", publisher.getEventSubscription().getName());
      }
    } else {
      throw new IllegalArgumentException(INVALID_ALERT);
    }
  }

  public SubscriptionStatus getStatusForEventSubscription(UUID id) {
    AbstractEventConsumer publisher = alertJobMap.get(id);
    if (publisher != null) {
      return publisher.getEventSubscription().getStatusDetails();
    }
    return null;
  }

  public static void shutDown() throws SchedulerException {
    if (instance != null) {
      instance.alertsScheduler.shutdown();
    }
  }
}
