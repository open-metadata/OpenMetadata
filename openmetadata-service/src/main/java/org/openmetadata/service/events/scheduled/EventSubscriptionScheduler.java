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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import io.dropwizard.db.DataSourceFactory;
import java.lang.reflect.InvocationTargetException;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.events.AlertSchedulingInfo;
import org.openmetadata.schema.api.events.EventSubscriptionDiagnosticInfo;
import org.openmetadata.schema.api.events.EventsRecord;
import org.openmetadata.schema.entity.events.DestinationHealth;
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
import org.openmetadata.service.apps.bundles.changeEvent.ServerStopping;
import org.openmetadata.service.audit.AuditLogConsumer;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.events.subscription.AlertingSettings;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;
import org.openmetadata.service.events.subscription.matching.AlertMatching;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.resources.events.subscription.TypedEvent;
import org.openmetadata.service.util.ChangeEventJsonUtils;
import org.openmetadata.service.util.DIContainer;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.quartz.Job;
import org.quartz.JobBuilder;
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
  @Getter private final Scheduler alertsScheduler;
  private final AlertReconciler reconciler;
  private static final String SCHEDULER_NAME = "OMEventSubScheduler";
  private static final int SCHEDULER_THREAD_COUNT = 10;
  // Quartz cannot acquire a trigger that is later than this, and a tick may hold a thread for a
  // time budget plus one slow event. Ticks are polls, so misfire handling protects nothing here.
  static final long MISFIRE_THRESHOLD_MS = TimeUnit.MINUTES.toMillis(10);
  // Quartz asks for the worker threads plus three.
  private static final int JOB_STORE_CONNECTIONS_BESIDE_WORKERS = 3;

  private record CustomJobFactory(DIContainer di) implements JobFactory {

    @Override
    public Job newJob(TriggerFiredBundle bundle, Scheduler scheduler) throws SchedulerException {
      try {
        JobDetail jobDetail = bundle.getJobDetail();
        Class<? extends Job> jobClass = jobDetail.getJobClass();
        return jobClass.getDeclaredConstructor(DIContainer.class).newInstance(di);
      } catch (Exception e) {
        throw new SchedulerException("Failed to create job instance", e);
      }
    }
  }

  private EventSubscriptionScheduler(
      OpenMetadataApplicationConfig config,
      PipelineServiceClientInterface pipelineServiceClient,
      OpenMetadataConnectionBuilder openMetadataConnectionBuilder)
      throws SchedulerException {

    AlertingSettings.use(AlertingSettings.from(config.getAlertingConfiguration()));
    ServerStopping.registerShutdownHook();
    StdSchedulerFactory factory = new StdSchedulerFactory();
    factory.initialize(quartzProperties(config.getDataSourceFactory()));
    this.alertsScheduler = factory.getScheduler();

    DIContainer di = new DIContainer();
    di.registerResource(PipelineServiceClientInterface.class, pipelineServiceClient);
    di.registerResource(OpenMetadataConnectionBuilder.class, openMetadataConnectionBuilder);
    this.alertsScheduler.setJobFactory(new CustomJobFactory(di));

    this.alertsScheduler.start();
    this.reconciler = new AlertReconciler(alertsScheduler, MISFIRE_THRESHOLD_MS);
    this.reconciler.start();
    LOG.info(
        "Event Subscription Scheduler started. Instance ID: {}",
        this.alertsScheduler.getSchedulerInstanceId());
  }

  static Properties quartzProperties(DataSourceFactory database) {
    Properties properties = new Properties();
    properties.put("org.quartz.scheduler.instanceName", SCHEDULER_NAME);
    properties.put("org.quartz.scheduler.instanceId", "AUTO");
    properties.put("org.quartz.scheduler.skipUpdateCheck", "true");
    properties.put("org.quartz.threadPool.class", "org.quartz.simpl.SimpleThreadPool");
    properties.put("org.quartz.threadPool.threadCount", String.valueOf(SCHEDULER_THREAD_COUNT));
    properties.put("org.quartz.threadPool.threadPriority", "5");
    properties.put("org.quartz.jobStore.misfireThreshold", String.valueOf(MISFIRE_THRESHOLD_MS));
    properties.put("org.quartz.jobStore.class", "org.quartz.impl.jdbcjobstore.JobStoreTX");
    properties.put("org.quartz.jobStore.useProperties", "true");
    properties.put("org.quartz.jobStore.tablePrefix", "QRTZ_");
    properties.put("org.quartz.jobStore.isClustered", "true");
    properties.put("org.quartz.jobStore.dataSource", "myDS");
    properties.put(
        "org.quartz.dataSource.myDS.maxConnections",
        String.valueOf(SCHEDULER_THREAD_COUNT + JOB_STORE_CONNECTIONS_BESIDE_WORKERS));
    properties.put("org.quartz.dataSource.myDS.validationQuery", "select 1");
    properties.put("org.quartz.dataSource.myDS.driver", database.getDriverClass());
    properties.put("org.quartz.dataSource.myDS.URL", database.getUrl());
    properties.put("org.quartz.dataSource.myDS.user", database.getUser());
    properties.put("org.quartz.dataSource.myDS.password", database.getPassword());
    properties.put("org.quartz.jobStore.driverDelegateClass", driverDelegate(database));
    return properties;
  }

  private static String driverDelegate(DataSourceFactory database) {
    return ConnectionType.MYSQL.label.equals(database.getDriverClass())
        ? "org.quartz.impl.jdbcjobstore.StdJDBCDelegate"
        : "org.quartz.impl.jdbcjobstore.PostgreSQLDelegate";
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
                openMetadataApplicationConfig,
                PipelineServiceClientFactory.createPipelineServiceClient(
                    openMetadataApplicationConfig.getPipelineServiceClientConfiguration()),
                new OpenMetadataConnectionBuilder(openMetadataApplicationConfig));
        initialized = true;
        LOG.info("Event Subscription Scheduler initialized");
      } catch (SchedulerException e) {
        LOG.error("Failed to initialize Event Subscription Scheduler", e);
        throw new RuntimeException("Failed to initialize Event Subscription Scheduler", e);
      }
    } else {
      LOG.info("Event Subscription Scheduler is already initialized");
    }
  }

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
    if (Boolean.FALSE.equals(eventSubscription.getEnabled())) {
      alertsScheduler.deleteJob(getJobKey(eventSubscription));
      LOG.info("Event Subscription {} is disabled, so it has no job", eventSubscription.getName());
    } else {
      // Rows first: a tick that finds no position row does nothing.
      AlertRecord.start(eventSubscription);
      JobDetail jobDetail = jobBuilder(clazz, eventSubscription);
      alertsScheduler.scheduleJob(jobDetail, Set.of(trigger(eventSubscription)), true);
      LOG.info("Event Subscription {} scheduled", eventSubscription.getName());
    }
  }

  /**
   * Brings an alert's job in step with its stored row, from any save path. Saving must never fail
   * because of scheduling: when the scheduler is not running, for example during a migration, this
   * does nothing, and when the call fails the reconciler repairs the job.
   */
  public static void ensureScheduled(EventSubscription alert) {
    if (initialized) {
      try {
        instance.addSubscriptionPublisher(alert, true);
      } catch (SchedulerException | ReflectiveOperationException | RuntimeException e) {
        LOG.warn(
            "Alert {} saved but not scheduled; the reconciler will repair it", alert.getId(), e);
      }
    }
  }

  public static void removeScheduled(UUID alertId) {
    if (initialized) {
      try {
        instance.alertsScheduler.deleteJob(new JobKey(alertId.toString(), ALERT_JOB_GROUP));
      } catch (SchedulerException e) {
        LOG.warn("Job of deleted alert {} not removed; the reconciler will remove it", alertId, e);
      }
    }
  }

  /** How one alert is scheduled right now, so "why is it not firing" is one request. */
  public AlertSchedulingInfo getSchedulingInfo(UUID alertId) throws SchedulerException {
    EventSubscription alert = storedAlert(alertId);
    JobDetail job = alertsScheduler.getJobDetail(new JobKey(alertId.toString(), ALERT_JOB_GROUP));
    TriggerKey triggerKey = new TriggerKey(alertId.toString(), ALERT_TRIGGER_GROUP);
    Trigger trigger = alertsScheduler.getTrigger(triggerKey);
    long latest = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
    long current = AlertRecord.positionOrLatest(alertId).getCurrentOffset();
    AlertReconciler.Verdict verdict = reconciler.lastVerdict(alertId);
    return new AlertSchedulingInfo()
        .withEnabled(!Boolean.FALSE.equals(alert.getEnabled()))
        .withJobClass(job == null ? null : job.getJobClass().getCanonicalName())
        .withTriggerState(alertsScheduler.getTriggerState(triggerKey).name())
        .withPreviousFireTime(timeOf(trigger == null ? null : trigger.getPreviousFireTime()))
        .withNextFireTime(timeOf(trigger == null ? null : trigger.getNextFireTime()))
        .withCurrentOffset(current)
        .withLatestOffset(latest)
        .withLag(Math.max(0, latest - current))
        .withLastReconcileAt(verdict == null ? null : verdict.at())
        .withLastReconcileVerdict(verdict == null ? null : verdict.found());
  }

  private static Long timeOf(Date date) {
    return date == null ? null : date.getTime();
  }

  /** One reconcile round now, on the calling thread. */
  public void reconcileNow() throws SchedulerException {
    reconciler.reconcile();
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
      Class<? extends AbstractEventConsumer> consumerClass, EventSubscription eventSubscription) {
    // The job carries no data. The alert's row is read when a tick opens, and everything a run
    // leaves behind lives in the alert's rows, so there is nothing here that could go stale.
    return JobBuilder.newJob(consumerClass)
        .withIdentity(eventSubscription.getId().toString(), ALERT_JOB_GROUP)
        .build();
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

  @SneakyThrows
  public void updateEventSubscription(EventSubscription eventSubscription) {
    addSubscriptionPublisher(eventSubscription, true);
  }

  public void deleteEventSubscriptionPublisher(EventSubscription deletedEntity)
      throws SchedulerException {
    alertsScheduler.deleteJob(new JobKey(deletedEntity.getId().toString(), ALERT_JOB_GROUP));
    alertsScheduler.unscheduleJob(
        new TriggerKey(deletedEntity.getId().toString(), ALERT_TRIGGER_GROUP));
    LOG.info("Alert publisher deleted for {}", deletedEntity.getName());
  }

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
    EventSubscription alert = storedAlert(subscriptionId);
    return Boolean.FALSE.equals(alert.getEnabled())
        ? new SubscriptionStatus().withStatus(SubscriptionStatus.Status.DISABLED)
        : destinationsWithHealth(alert).stream()
            .filter(destination -> destination.getId().equals(destinationId))
            .findFirst()
            .map(destination -> convertToSubscriptionStatus(destination.getStatusDetails()))
            .orElse(null);
  }

  public List<SubscriptionDestination> listAlertDestinations(UUID subscriptionId) {
    EventSubscription alert = storedAlert(subscriptionId);
    return Boolean.FALSE.equals(alert.getEnabled())
        ? Collections.emptyList()
        : destinationsWithHealth(alert);
  }

  /** Every destination of the alert with its current status: one read, whatever their number. */
  public List<SubscriptionDestination> destinationsWithStatus(EventSubscription alert) {
    List<SubscriptionDestination> destinations = listOrEmpty(alert.getDestinations());
    if (Boolean.FALSE.equals(alert.getEnabled())) {
      destinations.forEach(
          destination ->
              destination.setStatusDetails(
                  new SubscriptionStatus().withStatus(SubscriptionStatus.Status.DISABLED)));
    } else {
      destinationsWithHealth(alert);
    }
    return destinations;
  }

  private static EventSubscription storedAlert(UUID subscriptionId) {
    EntityRepository<? extends EntityInterface> repository =
        Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);
    return (EventSubscription)
        repository.get(null, subscriptionId, repository.getFields("id,destinations,enabled"));
  }

  // Health lives in a row of its own, so registering, editing and restarting never reset it. A
  // destination no tick has reported on yet reads Active when enabled and Disabled otherwise.
  private static List<SubscriptionDestination> destinationsWithHealth(EventSubscription alert) {
    Map<String, DestinationHealth> health =
        AlertRecord.open(alert).map(AlertLedger::health).orElse(Map.of());
    long now = System.currentTimeMillis();
    for (SubscriptionDestination destination : listOrEmpty(alert.getDestinations())) {
      DestinationHealth known = health.get(destination.getId().toString());
      destination.setStatusDetails(
          (known != null ? known : AlertRecord.healthWithoutHistory(destination, now)).getStatus());
    }
    return listOrEmpty(alert.getDestinations());
  }

  public EventsRecord getEventSubscriptionEventsRecord(UUID subscriptionId) {
    long failedEventsCount =
        Entity.getCollectionDAO().changeEventDAO().countFailedEvents(subscriptionId.toString());

    long successfulEventsCount =
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .getSuccessfulRecordCount(subscriptionId.toString());

    long countedTwice =
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .countEventsBothDeliveredAndFailed(subscriptionId.toString());
    long unprocessedEventsCount = getRelevantUnprocessedEvents(subscriptionId);
    long totalEventsCount =
        failedEventsCount + successfulEventsCount - countedTwice + unprocessedEventsCount;

    return new EventsRecord()
        .withTotalEventsCount(totalEventsCount)
        .withFailedEventsCount(failedEventsCount)
        .withPendingEventsCount(unprocessedEventsCount)
        .withSuccessfulEventsCount(successfulEventsCount);
  }

  // Pending counts and the notifications that go out must agree, so a page view is decided by
  // whichever engine decides delivery for this alert.
  private AlertMatching decidingAsATickWould(EventSubscription subscription) {
    Long startingTimestamp =
        getEventSubscriptionOffset(subscription.getId())
            .map(EventSubscriptionOffset::getStartingTimestamp)
            .orElse(null);
    return AlertMatching.forDiagnostics(
        subscription, AlertUtil.alertingWatermark(subscription, startingTimestamp));
  }

  public long getRelevantUnprocessedEvents(UUID subscriptionId) {
    // Fetch subscription ONCE before the loop to avoid N+1 query problem
    // Previously, getEventSubscription was called for each event in the stream
    EventSubscription subscription = getEventSubscription(subscriptionId);
    AlertMatching deciding = decidingAsATickWould(subscription);

    long offset =
        getEventSubscriptionOffset(subscriptionId)
            .map(EventSubscriptionOffset::getCurrentOffset)
            .orElse(Entity.getCollectionDAO().changeEventDAO().getLatestOffset());

    return UnprocessedEvents.countMatching(
        offset, event -> AlertUtil.belongs(deciding, event, AlertUtil.LOG_EVALUATION_ERROR));
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
    // Fetch subscription ONCE before the loop to avoid N+1 query problem
    EventSubscription subscription = getEventSubscription(subscriptionId);
    AlertMatching deciding = decidingAsATickWould(subscription);

    long offset =
        getEventSubscriptionOffset(subscriptionId)
            .map(EventSubscriptionOffset::getCurrentOffset)
            .orElse(Entity.getCollectionDAO().changeEventDAO().getLatestOffset());

    List<String> page =
        Entity.getCollectionDAO()
            .changeEventDAO()
            .listUnprocessedEvents(offset, limit, paginationOffset);
    return UnprocessedEvents.matching(
        page, event -> AlertUtil.belongs(deciding, event, AlertUtil.LOG_EVALUATION_ERROR));
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
        .map(eventJson -> ChangeEventJsonUtils.readOrNull(eventJson, ChangeEvent.class))
        .filter(Objects::nonNull)
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
        .map(e -> ChangeEventJsonUtils.readOrNull(e, ChangeEvent.class))
        .filter(Objects::nonNull)
        .collect(Collectors.toList());
  }

  // Reading never creates the row: an alert that has never run reports the latest offset as both
  // its position and its start, and where it really starts is decided when it is first scheduled.
  public Optional<EventSubscriptionOffset> getEventSubscriptionOffset(UUID subscriptionID) {
    return Optional.of(AlertRecord.positionOrLatest(subscriptionID));
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

  /**
   * Converts a status object to SubscriptionStatus. After JSON deserialization, the statusDetails
   * field (typed as Object in SubscriptionDestination) may be deserialized as a LinkedHashMap
   * instead of SubscriptionStatus. This method handles the conversion.
   */
  private SubscriptionStatus convertToSubscriptionStatus(Object status) {
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

  static final String AUDIT_LOG_JOB_GROUP = "OMAuditLogJobGroup";
  static final String AUDIT_LOG_JOB_ID = "AuditLogConsumerJob";
  private static final int AUDIT_LOG_POLL_INTERVAL_SECONDS = 5;

  /**
   * Schedules the audit log consumer to periodically read from change_event table and write to
   * audit_log table. Uses @DisallowConcurrentExecution to ensure only one instance runs at a time
   * in multi-server setups.
   */
  public void scheduleAuditLogConsumer() throws SchedulerException {
    ensureAuditLogConsumerScheduled(alertsScheduler);
  }

  /**
   * (Re)arms the audit log consumer trigger on every startup. With the clustered {@code JobStoreTX}
   * the job and trigger persist across restarts, so a plain existence check sees the job and skips
   * rescheduling forever. That strands the consumer whenever the persisted trigger stops firing —
   * not only in ERROR/BLOCKED/PAUSED states, but also while still reported as WAITING/NORMAL with a
   * frozen past next-fire-time (an abandoned trigger after an unclean shutdown). We therefore always
   * replace it with a fresh trigger. The consumer offset lives in {@code change_event_consumers},
   * not in Quartz, so re-arming loses no progress; {@code replace=true} swaps atomically so
   * concurrent cluster nodes don't race.
   */
  static void ensureAuditLogConsumerScheduled(Scheduler scheduler) throws SchedulerException {
    JobKey jobKey = new JobKey(AUDIT_LOG_JOB_ID, AUDIT_LOG_JOB_GROUP);
    JobDetail jobDetail =
        JobBuilder.newJob(AuditLogConsumer.class).withIdentity(jobKey).storeDurably().build();
    scheduler.scheduleJob(jobDetail, Set.of(buildAuditLogTrigger()), true);
    LOG.info(
        "Audit log consumer (re)scheduled with poll interval: {} seconds",
        AUDIT_LOG_POLL_INTERVAL_SECONDS);
  }

  private static Trigger buildAuditLogTrigger() {
    return TriggerBuilder.newTrigger()
        .withIdentity(AUDIT_LOG_JOB_ID, AUDIT_LOG_JOB_GROUP)
        .withSchedule(SimpleScheduleBuilder.repeatSecondlyForever(AUDIT_LOG_POLL_INTERVAL_SECONDS))
        .startNow()
        .build();
  }

  public static void shutDown() throws SchedulerException {
    LOG.info("Shutting Down Event Subscription Scheduler");
    if (instance != null) {
      instance.reconciler.stop();
      instance.alertsScheduler.shutdown(true);
    }
  }
}
