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

import static org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer.ALERT_INFO_KEY;
import static org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer.ALERT_OFFSET_KEY;
import static org.openmetadata.service.events.subscription.AlertUtil.getStartingOffset;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.events.EventSubscriptionDiagnosticInfo;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.FailedEventResponse;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.JsonUtils;
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
    AlertPublisher alertPublisher = new AlertPublisher();
    if (Boolean.FALSE.equals(
        eventSubscription.getEnabled())) { // Only add webhook that is enabled for publishing events
      eventSubscription
          .getDestinations()
          .forEach(
              sub ->
                  sub.setStatusDetails(
                      getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status.DISABLED)));
      LOG.info(
          "Event Subscription started as {} : status {} for all Destinations",
          eventSubscription.getName(),
          SubscriptionStatus.Status.ACTIVE);
    } else {
      eventSubscription
          .getDestinations()
          .forEach(
              sub ->
                  sub.setStatusDetails(
                      getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status.ACTIVE)));
      JobDetail jobDetail =
          jobBuilder(
              alertPublisher,
              eventSubscription,
              String.format("%s", eventSubscription.getId().toString()));
      Trigger trigger = trigger(eventSubscription);

      // Schedule the Job
      alertsScheduler.scheduleJob(jobDetail, trigger);

      LOG.info(
          "Event Subscription started as {} : status {} for all Destinations",
          eventSubscription.getName(),
          SubscriptionStatus.Status.ACTIVE);
    }
  }

  private JobDetail jobBuilder(
      AlertPublisher publisher, EventSubscription eventSubscription, String jobIdentity) {
    JobDataMap dataMap = new JobDataMap();
    dataMap.put(ALERT_INFO_KEY, eventSubscription);
    dataMap.put(ALERT_OFFSET_KEY, getStartingOffset(eventSubscription.getId()));
    JobBuilder jobBuilder =
        JobBuilder.newJob(publisher.getClass())
            .withIdentity(jobIdentity, ALERT_JOB_GROUP)
            .usingJobData(dataMap);
    return jobBuilder.build();
  }

  private Trigger trigger(EventSubscription eventSubscription) {
    return TriggerBuilder.newTrigger()
        .withIdentity(eventSubscription.getId().toString(), ALERT_TRIGGER_GROUP)
        .withSchedule(
            SimpleScheduleBuilder.repeatSecondlyForever(eventSubscription.getPollInterval()))
        .startNow()
        .build();
  }

  private SubscriptionStatus getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status status) {
    return new SubscriptionStatus().withStatus(status).withTimestamp(System.currentTimeMillis());
  }

  @Transaction
  @SneakyThrows
  public void updateEventSubscription(EventSubscription eventSubscription) {
    // Remove Existing Subscription Publisher
    deleteEventSubscriptionPublisher(eventSubscription);
    if (Boolean.TRUE.equals(eventSubscription.getEnabled())) {
      addSubscriptionPublisher(eventSubscription);
    }
  }

  @Transaction
  public void deleteEventSubscriptionPublisher(EventSubscription deletedEntity)
      throws SchedulerException {
    alertsScheduler.deleteJob(new JobKey(deletedEntity.getId().toString(), ALERT_JOB_GROUP));
    alertsScheduler.unscheduleJob(
        new TriggerKey(deletedEntity.getId().toString(), ALERT_TRIGGER_GROUP));
    LOG.info("Alert publisher deleted for {}", deletedEntity.getName());
  }

  public SubscriptionStatus getStatusForEventSubscription(UUID subscriptionId, UUID destinationId) {
    Optional<EventSubscription> eventSubscriptionOpt =
        getEventSubscriptionFromScheduledJob(subscriptionId);

    if (eventSubscriptionOpt.isPresent()) {
      return eventSubscriptionOpt.get().getDestinations().stream()
          .filter(destination -> destination.getId().equals(destinationId))
          .map(SubscriptionDestination::getStatusDetails)
          .findFirst()
          .orElse(null);
    }

    EntityRepository<? extends EntityInterface> subscriptionRepository =
        Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);

    // If the event subscription was not found in the scheduled job, check the repository
    Optional<EventSubscription> subscriptionOpt =
        Optional.ofNullable(
            (EventSubscription)
                subscriptionRepository.get(
                    null, subscriptionId, subscriptionRepository.getFields("id")));

    return subscriptionOpt
        .filter(subscription -> Boolean.FALSE.equals(subscription.getEnabled()))
        .map(
            subscription -> new SubscriptionStatus().withStatus(SubscriptionStatus.Status.DISABLED))
        .orElse(null);
  }

  public List<SubscriptionDestination> listAlertDestinations(UUID subscriptionId) {
    Optional<EventSubscription> eventSubscriptionOpt =
        getEventSubscriptionFromScheduledJob(subscriptionId);

    // If the EventSubscription is not found in the scheduled job, retrieve it from the repository
    EventSubscription eventSubscription =
        eventSubscriptionOpt.orElseGet(
            () -> {
              EntityRepository<? extends EntityInterface> subscriptionRepository =
                  Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);

              return (EventSubscription)
                  subscriptionRepository.get(
                      null,
                      subscriptionId,
                      subscriptionRepository.getFields("id,destinations,enabled"));
            });

    if (eventSubscription != null && Boolean.FALSE.equals(eventSubscription.getEnabled())) {
      return Collections.emptyList();
    }

    return eventSubscription.getDestinations();
  }

  public EventSubscriptionDiagnosticInfo getEventSubscriptionDiagnosticInfo(
      UUID subscriptionId, int limit) {
    boolean isAllEventsPublished = checkIfPublisherPublishedAllEvents(subscriptionId);
    EventSubscriptionOffset latestOffset = getLatestOffset();

    long currentOffset =
        getEventSubscriptionOffset(subscriptionId)
            .map(EventSubscriptionOffset::getOffset)
            .orElse(0L);

    long unpublishedEventCount = getUnpublishedEventCount(subscriptionId);
    List<ChangeEvent> unprocessedEvents =
        Optional.ofNullable(getUnpublishedEvents(subscriptionId, limit))
            .orElse(Collections.emptyList());

    return new EventSubscriptionDiagnosticInfo()
        .withLatestOffset(latestOffset.getOffset())
        .withCurrentOffset(currentOffset)
        .withHasProcessedAllEvents(isAllEventsPublished)
        .withUnprocessedEventsCount(unpublishedEventCount)
        .withUnprocessedEventsList(unprocessedEvents);
  }

  public static EventSubscriptionOffset getLatestOffset() {
    return new EventSubscriptionOffset()
        .withOffset(Entity.getCollectionDAO().changeEventDAO().getLatestOffset());
  }

  public boolean checkIfPublisherPublishedAllEvents(UUID subscriptionID) {
    long countOfEvents = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();

    return getEventSubscriptionOffset(subscriptionID)
        .map(offset -> offset.getOffset() == countOfEvents)
        .orElse(false);
  }

  public long getUnpublishedEventCount(UUID subscriptionID) {
    long countOfEvents = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();

    return getEventSubscriptionOffset(subscriptionID)
        .map(offset -> Math.abs(countOfEvents - offset.getOffset()))
        .orElse(countOfEvents);
  }

  public List<ChangeEvent> getUnpublishedEvents(UUID subscriptionId, int limit) {
    long offset =
        getEventSubscriptionOffset(subscriptionId)
            .map(EventSubscriptionOffset::getOffset)
            .orElse(Entity.getCollectionDAO().changeEventDAO().getLatestOffset());

    List<String> unprocessedEventJsonList =
        Entity.getCollectionDAO().changeEventDAO().listUnprocessedEvents(offset, limit);

    return unprocessedEventJsonList.stream()
        .map(eventJson -> JsonUtils.readValue(eventJson, ChangeEvent.class))
        .collect(Collectors.toList());
  }

  public List<FailedEventResponse> getFailedEventsByIdAndSource(
      UUID subscriptionId, String source, int limit) {
    if (CommonUtil.nullOrEmpty(source)) {
      return Entity.getCollectionDAO()
          .changeEventDAO()
          .listFailedEventsById(subscriptionId.toString(), limit);
    } else {
      return Entity.getCollectionDAO()
          .changeEventDAO()
          .listFailedEventsByIdAndSource(subscriptionId.toString(), source, limit);
    }
  }

  public List<FailedEventResponse> getAllFailedEvents(String source, int limit) {
    if (CommonUtil.nullOrEmpty(source)) {
      return Entity.getCollectionDAO().changeEventDAO().listAllFailedEvents(limit);
    } else {
      return Entity.getCollectionDAO().changeEventDAO().listAllFailedEventsBySource(source, limit);
    }
  }

  public Optional<EventSubscription> getEventSubscriptionFromScheduledJob(UUID id) {
    try {
      JobDetail jobDetail =
          alertsScheduler.getJobDetail(new JobKey(id.toString(), ALERT_JOB_GROUP));

      return Optional.ofNullable(jobDetail)
          .map(detail -> (EventSubscription) detail.getJobDataMap().get(ALERT_INFO_KEY));

    } catch (SchedulerException ex) {
      LOG.error("Failed to get Event Subscription from Job, Subscription Id : {}", id, ex);
    }

    return Optional.empty();
  }

  public Optional<EventSubscriptionOffset> getEventSubscriptionOffset(UUID subscriptionID) {
    try {
      JobDetail jobDetail =
          alertsScheduler.getJobDetail(new JobKey(subscriptionID.toString(), ALERT_JOB_GROUP));
      if (jobDetail != null) {
        return Optional.ofNullable(
            (EventSubscriptionOffset) jobDetail.getJobDataMap().get(ALERT_OFFSET_KEY));
      }
    } catch (Exception ex) {
      LOG.error(
          "Failed to get Event Subscription from Job, Subscription Id : {}, Exception: ",
          subscriptionID.toString(),
          ex);
    }
    return Optional.empty();
  }

  public boolean doesRecordExist(UUID id) {
    return Entity.getCollectionDAO().changeEventDAO().recordExists(id.toString()) > 0;
  }

  public boolean doesFailedRecordExistBySubscriptionId(UUID id) {
    return Entity.getCollectionDAO().changeEventDAO().failedRecordExists(id.toString()) > 0;
  }

  public static void shutDown() throws SchedulerException {
    LOG.info("Shutting Down Event Subscription Scheduler");
    if (instance != null) {
      instance.alertsScheduler.shutdown(true);
    }
  }
}
