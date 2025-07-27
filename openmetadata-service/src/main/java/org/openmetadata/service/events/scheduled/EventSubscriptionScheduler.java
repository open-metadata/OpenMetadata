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
import static org.quartz.impl.StdSchedulerFactory.PROP_SCHED_INSTANCE_NAME;
import static org.quartz.impl.StdSchedulerFactory.PROP_THREAD_POOL_PREFIX;

import java.lang.reflect.InvocationTargetException;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Properties;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.events.EventSubscriptionDiagnosticInfo;
import org.openmetadata.schema.api.events.EventsRecord;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.FailedEventResponse;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.resources.events.subscription.TypedEvent;
import org.openmetadata.service.util.DIContainer;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.quartz.Job;
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
import org.quartz.spi.JobFactory;
import org.quartz.spi.TriggerFiredBundle;

@Slf4j
public class EventSubscriptionScheduler {
  public static final String ALERT_JOB_GROUP = "OMAlertJobGroup";
  public static final String ALERT_TRIGGER_GROUP = "OMAlertJobGroup";
  private static EventSubscriptionScheduler instance;
  private static volatile boolean initialized = false;
  private static final Scheduler alertsScheduler;
  private static final String SCHEDULER_NAME = "OpenMetadataEventSubscriptionScheduler";
  private static final int SCHEDULER_THREAD_COUNT = 5;

  static {
    Properties properties = new Properties();
    properties.setProperty(PROP_SCHED_INSTANCE_NAME, SCHEDULER_NAME);
    properties.setProperty(
        PROP_THREAD_POOL_PREFIX + ".threadCount", String.valueOf(SCHEDULER_THREAD_COUNT));

    try {
      StdSchedulerFactory factory = new StdSchedulerFactory();
      factory.initialize(properties);
      alertsScheduler = factory.getScheduler();
    } catch (SchedulerException e) {
      throw new ExceptionInInitializerError("Failed to initialize scheduler: " + e.getMessage());
    }
  }

  private record CustomJobFactory(DIContainer di) implements JobFactory {

    @Override
    public Job newJob(TriggerFiredBundle bundle, Scheduler scheduler) throws SchedulerException {
      try {
        JobDetail jobDetail = bundle.getJobDetail();
        Class<? extends Job> jobClass = jobDetail.getJobClass();
        Job job = jobClass.getDeclaredConstructor(DIContainer.class).newInstance(di);
        return job;
      } catch (Exception e) {
        throw new SchedulerException("Failed to create job instance", e);
      }
    }
  }

  private EventSubscriptionScheduler(
      PipelineServiceClientInterface pipelineServiceClient,
      OpenMetadataConnectionBuilder openMetadataConnectionBuilder)
      throws SchedulerException {
    DIContainer di = new DIContainer();
    di.registerResource(PipelineServiceClientInterface.class, pipelineServiceClient);
    di.registerResource(OpenMetadataConnectionBuilder.class, openMetadataConnectionBuilder);
    this.alertsScheduler.setJobFactory(new CustomJobFactory(di));
    this.alertsScheduler.start();
  }

  @SneakyThrows
  public static EventSubscriptionScheduler getInstance() {
    if (!initialized) {
      throw new RuntimeException("Event Subscription Scheduler is not initialized");
    }
    return instance;
  }

  public static void initialize(OpenMetadataApplicationConfig openMetadataApplicationConfig) {
    if (!initialized) {
      try {
        instance =
            new EventSubscriptionScheduler(
                PipelineServiceClientFactory.createPipelineServiceClient(
                    openMetadataApplicationConfig.getPipelineServiceClientConfiguration()),
                new OpenMetadataConnectionBuilder(openMetadataApplicationConfig));
      } catch (SchedulerException e) {
        throw new RuntimeException("Failed to initialize Event Subscription Scheduler", e);
      }
      initialized = true;
    } else {
      LOG.info("Event Subscription Scheduler is already initialized");
    }
  }

  @Transaction
  public void addSubscriptionPublisher(EventSubscription eventSubscription, boolean reinstall)
      throws SchedulerException,
          ClassNotFoundException,
          NoSuchMethodException,
          InvocationTargetException,
          InstantiationException,
          IllegalAccessException {
    Class<? extends AbstractEventConsumer> defaultClass = AlertPublisher.class;
    Class<? extends AbstractEventConsumer> clazz =
        Class.forName(
                Optional.ofNullable(eventSubscription.getClassName())
                    .orElse(defaultClass.getCanonicalName()))
            .asSubclass(AbstractEventConsumer.class);
    // we can use an empty dependency container here because when initializing
    // the consumer because it does need to access any state
    AbstractEventConsumer publisher =
        clazz.getDeclaredConstructor(DIContainer.class).newInstance(new DIContainer());
    if (reinstall && isSubscriptionRegistered(eventSubscription)) {
      deleteEventSubscriptionPublisher(eventSubscription);
    }
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
              publisher,
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

  public boolean isSubscriptionRegistered(EventSubscription eventSubscription) {
    try {
      return alertsScheduler.checkExists(getJobKey(eventSubscription));
    } catch (SchedulerException e) {
      LOG.error("Failed to check if subscription is registered: {}", eventSubscription.getId(), e);
      return false;
    }
  }

  private JobDetail jobBuilder(
      AbstractEventConsumer publisher, EventSubscription eventSubscription, String jobIdentity) {
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
      addSubscriptionPublisher(eventSubscription, true);
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

  @Transaction
  public void deleteSuccessfulAndFailedEventsRecordByAlert(UUID id) {
    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .deleteSuccessfulChangeEventBySubscriptionId(id.toString());

    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .deleteFailedRecordsBySubscriptionId(id.toString());

    Entity.getCollectionDAO().eventSubscriptionDAO().deleteAlertMetrics(id.toString());
  }

  public SubscriptionStatus getStatusForEventSubscription(UUID subscriptionId, UUID destinationId) {
    Optional<EventSubscription> eventSubscriptionOpt =
        getEventSubscriptionFromScheduledJob(subscriptionId);

    if (eventSubscriptionOpt.isPresent()) {
      return (SubscriptionStatus)
          eventSubscriptionOpt.get().getDestinations().stream()
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

  public EventsRecord getEventSubscriptionEventsRecord(UUID subscriptionId) {
    long failedEventsCount =
        Entity.getCollectionDAO().changeEventDAO().countFailedEvents(subscriptionId.toString());

    long successfulEventsCount =
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .getSuccessfulRecordCount(subscriptionId.toString());

    long unprocessedEventsCount = getRelevantUnprocessedEvents(subscriptionId);
    long totalEventsCount = failedEventsCount + successfulEventsCount + unprocessedEventsCount;

    return new EventsRecord()
        .withTotalEventsCount(totalEventsCount)
        .withFailedEventsCount(failedEventsCount)
        .withPendingEventsCount(unprocessedEventsCount)
        .withSuccessfulEventsCount(successfulEventsCount);
  }

  public long getRelevantUnprocessedEvents(UUID subscriptionId) {
    long offset =
        getEventSubscriptionOffset(subscriptionId)
            .map(EventSubscriptionOffset::getCurrentOffset)
            .orElse(Entity.getCollectionDAO().changeEventDAO().getLatestOffset());

    return Entity.getCollectionDAO().changeEventDAO().listUnprocessedEvents(offset).parallelStream()
        .map(
            eventJson -> {
              ChangeEvent event = JsonUtils.readValue(eventJson, ChangeEvent.class);
              return AlertUtil.checkIfChangeEventIsAllowed(
                      event, getEventSubscription(subscriptionId).getFilteringRules())
                  ? event
                  : null;
            })
        .filter(Objects::nonNull) // Remove null entries (events that did not pass filtering)
        .count();
  }

  public EventSubscriptionDiagnosticInfo getEventSubscriptionDiagnosticInfo(
      UUID subscriptionId, int limit, int paginationOffset, boolean listCountOnly) {
    Optional<EventSubscriptionOffset> eventSubscriptionOffsetOptional =
        getEventSubscriptionOffset(subscriptionId);

    long currentOffset =
        eventSubscriptionOffsetOptional.map(EventSubscriptionOffset::getCurrentOffset).orElse(0L);
    long latestOffset = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
    long startingOffset =
        eventSubscriptionOffsetOptional.map(EventSubscriptionOffset::getStartingOffset).orElse(0L);
    long failedEventsCount =
        Entity.getCollectionDAO().changeEventDAO().countFailedEvents(subscriptionId.toString());

    long successfulEventsCount =
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .getSuccessfulRecordCount(subscriptionId.toString());

    long totalUnprocessedEventCount = getUnpublishedEventCount(subscriptionId);

    boolean hasProcessedAllEvents = checkIfPublisherPublishedAllEvents(subscriptionId);

    List<ChangeEvent> unprocessedEvents =
        Optional.ofNullable(getRelevantUnprocessedEvents(subscriptionId, limit, paginationOffset))
            .orElse(Collections.emptyList());

    if (listCountOnly) {
      return new EventSubscriptionDiagnosticInfo()
          .withLatestOffset(latestOffset)
          .withCurrentOffset(currentOffset)
          .withStartingOffset(startingOffset)
          .withHasProcessedAllEvents(hasProcessedAllEvents)
          .withSuccessfulEventsCount(successfulEventsCount)
          .withFailedEventsCount(failedEventsCount)
          .withTotalUnprocessedEventsCount(totalUnprocessedEventCount)
          .withRelevantUnprocessedEventsCount((long) unprocessedEvents.size())
          .withRelevantUnprocessedEventsList(null)
          .withTotalUnprocessedEventsList(null);
    }

    List<ChangeEvent> allUnprocessedEvents =
        getAllUnprocessedEvents(subscriptionId, limit, paginationOffset);

    return new EventSubscriptionDiagnosticInfo()
        .withLatestOffset(Entity.getCollectionDAO().changeEventDAO().getLatestOffset())
        .withCurrentOffset(currentOffset)
        .withStartingOffset(startingOffset)
        .withHasProcessedAllEvents(hasProcessedAllEvents)
        .withSuccessfulEventsCount(successfulEventsCount)
        .withFailedEventsCount(failedEventsCount)
        .withTotalUnprocessedEventsCount(totalUnprocessedEventCount)
        .withTotalUnprocessedEventsList(allUnprocessedEvents)
        .withRelevantUnprocessedEventsCount((long) unprocessedEvents.size())
        .withRelevantUnprocessedEventsList(unprocessedEvents);
  }

  public boolean checkIfPublisherPublishedAllEvents(UUID subscriptionID) {
    long countOfEvents = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();

    return getEventSubscriptionOffset(subscriptionID)
        .map(offset -> offset.getCurrentOffset() == countOfEvents)
        .orElse(false);
  }

  public long getUnpublishedEventCount(UUID subscriptionID) {
    long countOfEvents = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();

    return getEventSubscriptionOffset(subscriptionID)
        .map(offset -> Math.abs(countOfEvents - offset.getCurrentOffset()))
        .orElse(countOfEvents);
  }

  public List<ChangeEvent> getRelevantUnprocessedEvents(
      UUID subscriptionId, int limit, int paginationOffset) {
    long offset =
        getEventSubscriptionOffset(subscriptionId)
            .map(EventSubscriptionOffset::getCurrentOffset)
            .orElse(Entity.getCollectionDAO().changeEventDAO().getLatestOffset());

    return Entity.getCollectionDAO()
        .changeEventDAO()
        .listUnprocessedEvents(offset, limit, paginationOffset)
        .parallelStream()
        .map(
            eventJson -> {
              ChangeEvent event = JsonUtils.readValue(eventJson, ChangeEvent.class);
              return AlertUtil.checkIfChangeEventIsAllowed(
                      event, getEventSubscription(subscriptionId).getFilteringRules())
                  ? event
                  : null;
            })
        .filter(Objects::nonNull) // Remove null entries (events that did not pass filtering)
        .toList();
  }

  public List<ChangeEvent> getAllUnprocessedEvents(
      UUID subscriptionId, int limit, int paginationOffset) {
    long offset =
        getEventSubscriptionOffset(subscriptionId)
            .map(EventSubscriptionOffset::getCurrentOffset)
            .orElse(Entity.getCollectionDAO().changeEventDAO().getLatestOffset());

    return Entity.getCollectionDAO()
        .changeEventDAO()
        .listUnprocessedEvents(offset, limit, paginationOffset)
        .parallelStream()
        .map(eventJson -> JsonUtils.readValue(eventJson, ChangeEvent.class))
        .collect(Collectors.toList());
  }

  public List<FailedEventResponse> getFailedEventsByIdAndSource(
      UUID subscriptionId, String source, int limit, int paginationOffset) {
    if (CommonUtil.nullOrEmpty(source)) {
      return Entity.getCollectionDAO()
          .changeEventDAO()
          .listFailedEventsById(subscriptionId.toString(), limit, paginationOffset);
    } else {
      return Entity.getCollectionDAO()
          .changeEventDAO()
          .listFailedEventsByIdAndSource(
              subscriptionId.toString(), source, limit, paginationOffset);
    }
  }

  public List<TypedEvent> listEventsForSubscription(UUID subscriptionId, int limit, long offset) {
    Optional<EventSubscriptionOffset> eventSubscriptionOffset =
        getEventSubscriptionOffset(subscriptionId);
    if (eventSubscriptionOffset.isEmpty()) {
      return Collections.emptyList();
    }

    return Entity.getCollectionDAO()
        .changeEventDAO()
        .listAllEventsWithStatuses(subscriptionId.toString(), limit, offset);
  }

  private EventSubscription getEventSubscription(UUID eventSubscriptionId) {
    EventSubscriptionRepository repository =
        (EventSubscriptionRepository) Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);
    return repository.get(null, eventSubscriptionId, repository.getFields("*"));
  }

  public List<FailedEventResponse> getFailedEventsById(UUID subscriptionId, int limit, int offset) {
    return Entity.getCollectionDAO()
        .changeEventDAO()
        .listFailedEventsById(subscriptionId.toString(), limit, offset);
  }

  public List<FailedEventResponse> getAllFailedEvents(
      String source, int limit, int paginationOffset) {
    if (CommonUtil.nullOrEmpty(source)) {
      return Entity.getCollectionDAO()
          .changeEventDAO()
          .listAllFailedEvents(limit, paginationOffset);
    } else {
      return Entity.getCollectionDAO()
          .changeEventDAO()
          .listAllFailedEventsBySource(source, limit, paginationOffset);
    }
  }

  public List<ChangeEvent> getSuccessfullySentChangeEventsForAlert(
      UUID id, int limit, int paginationOffset) {
    Optional<EventSubscriptionOffset> eventSubscriptionOffset = getEventSubscriptionOffset(id);
    if (eventSubscriptionOffset.isEmpty()) {
      return Collections.emptyList();
    }

    List<String> successfullySentChangeEvents =
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .getSuccessfulChangeEventBySubscriptionId(id.toString(), limit, paginationOffset);

    return successfullySentChangeEvents.stream()
        .map(e -> JsonUtils.readValue(e, ChangeEvent.class))
        .collect(Collectors.toList());
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

  public int countTotalEvents(UUID id, TypedEvent.Status status) {
    return switch (status) {
      case FAILED -> Entity.getCollectionDAO()
          .eventSubscriptionDAO()
          .countFailedEventsById(id.toString());
      case SUCCESSFUL -> Entity.getCollectionDAO()
          .eventSubscriptionDAO()
          .countSuccessfulEventsBySubscriptionId(id.toString());
      default -> throw new IllegalArgumentException("Unknown event status: " + status);
    };
  }

  public int countTotalEvents(UUID id) {
    return Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .countAllEventsWithStatuses(id.toString());
  }

  public boolean doesRecordExist(UUID id) {
    return Entity.getCollectionDAO().changeEventDAO().recordExists(id.toString()) > 0;
  }

  public static JobKey getJobKey(EventSubscription eventSubscription) {
    return getJobKey(eventSubscription.getId());
  }

  private static JobKey getJobKey(UUID subscriptionId) {
    return new JobKey(subscriptionId.toString(), ALERT_JOB_GROUP);
  }

  public static void shutDown() throws SchedulerException {
    LOG.info("Shutting Down Event Subscription Scheduler");
    if (instance != null) {
      instance.alertsScheduler.shutdown(true);
    }
  }
}
