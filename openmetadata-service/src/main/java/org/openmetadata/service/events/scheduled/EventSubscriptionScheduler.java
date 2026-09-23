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
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.apps.bundles.changeEvent.ServerStopping;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.events.subscription.AlertingSettings;
import org.openmetadata.service.events.subscription.channels.Channels;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.jdbi3.HikariCPDataSourceFactory.PoolWorkload;
import org.openmetadata.service.jdbi3.QuartzConnectionProvider;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.resources.events.subscription.TypedEvent;
import org.openmetadata.service.util.ChangeEventJsonUtils;
import org.openmetadata.service.util.DIContainer;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;
import org.quartz.Job;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.Trigger;
import org.quartz.impl.StdSchedulerFactory;
import org.quartz.spi.JobFactory;
import org.quartz.spi.TriggerFiredBundle;
import org.quartz.utils.DBConnectionManager;

@Slf4j
public class EventSubscriptionScheduler {
  public static final String ALERT_JOB_GROUP = AlertJobs.JOB_GROUP;
  public static final String ALERT_TRIGGER_GROUP = AlertJobs.TRIGGER_GROUP;
  private static EventSubscriptionScheduler instance;
  private static volatile boolean initialized = false;
  @Getter private final Scheduler alertsScheduler;
  private final AlertReconciler reconciler;
  private static final String SCHEDULER_NAME = "OMEventSubScheduler";
  private static final int SCHEDULER_THREAD_COUNT = 10;
  // Quartz cannot acquire a trigger that is later than this, and a tick may hold a thread for a
  // time budget plus one slow event. Ticks are polls, so misfire handling protects nothing here.
  static final long MISFIRE_THRESHOLD_MS = TimeUnit.MINUTES.toMillis(10);

  // Derived from the scheduler's instance name, which Quartz already requires to be unique per
  // cluster. DBConnectionManager is a process-wide singleton whose registration is an unguarded
  // map put, so two schedulers sharing a datasource name silently discard the first pool; keying
  // off a name that is unique by construction makes that collision unrepresentable.
  private static final String DATA_SOURCE_NAME = SCHEDULER_NAME + "DS";
  private static final String POOL_NAME = SCHEDULER_NAME + "-pool";

  // One connection per worker thread that may be doing job-store work, plus the misfire handler,
  // the cluster manager and the reconciler, which each hold one while they run.
  private static final int POOL_MAX_SIZE = SCHEDULER_THREAD_COUNT + 3;

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
    // Must precede getScheduler(): that is where the job store resolves its datasource name.
    DBConnectionManager.getInstance()
        .addConnectionProvider(
            DATA_SOURCE_NAME,
            new QuartzConnectionProvider(
                config
                    .getDataSourceFactory()
                    .buildSubsystemPool(
                        POOL_NAME, POOL_MAX_SIZE, null, PoolWorkload.SHORT_STATEMENTS)));
    this.alertsScheduler = factory.getScheduler();

    DIContainer di = new DIContainer();
    di.registerResource(PipelineServiceClientInterface.class, pipelineServiceClient);
    di.registerResource(OpenMetadataConnectionBuilder.class, openMetadataConnectionBuilder);
    this.alertsScheduler.setJobFactory(new CustomJobFactory(di));

    this.alertsScheduler.start();
    AlertJobs.start(alertsScheduler);
    this.reconciler = new AlertReconciler(AlertJobs.view(), MISFIRE_THRESHOLD_MS);
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
    // No org.quartz.dataSource.* properties: those make Quartz build its own c3p0 pool from a
    // captured static password. The pool is registered against this name by the constructor.
    properties.put("org.quartz.jobStore.dataSource", DATA_SOURCE_NAME);
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

  /**
   * @deprecated the schedule is reconciled from the committed row, so {@code reinstall} no longer
   *     changes anything. Use {@link #addSubscriptionPublisher(EventSubscription)}.
   */
  @Deprecated(forRemoval = true)
  public void addSubscriptionPublisher(EventSubscription eventSubscription, boolean reinstall)
      throws SchedulerException,
          ClassNotFoundException,
          NoSuchMethodException,
          InvocationTargetException,
          InstantiationException,
          IllegalAccessException {
    addSubscriptionPublisher(eventSubscription);
  }

  public void addSubscriptionPublisher(EventSubscription eventSubscription)
      throws SchedulerException,
          ClassNotFoundException,
          NoSuchMethodException,
          InvocationTargetException,
          InstantiationException,
          IllegalAccessException {
    requireConsumerClass(eventSubscription);
    AlertJobs.converge(eventSubscription.getId());
  }

  /**
   * Brings an alert's job in step with its stored row, from any save path. Saving must never fail
   * because of scheduling: when the scheduler is not running, for example during a migration, this
   * does nothing, and when the call fails the reconciler repairs the job.
   */
  public static void ensureScheduled(EventSubscription alert) {
    if (initialized) {
      try {
        instance.addSubscriptionPublisher(alert);
      } catch (SchedulerException | ReflectiveOperationException | RuntimeException e) {
        LOG.warn(
            "Alert {} saved but not scheduled; the reconciler will repair it", alert.getId(), e);
      }
    }
  }

  public static void removeScheduled(UUID alertId) {
    if (initialized) {
      try {
        AlertJobs.removeNow(alertId);
      } catch (SchedulerException e) {
        LOG.warn("Job of deleted alert {} not removed; the reconciler will remove it", alertId, e);
      }
    }
  }

  /** How one alert is scheduled right now, so "why is it not firing" is one request. */
  public AlertSchedulingInfo getSchedulingInfo(UUID alertId) throws SchedulerException {
    EventSubscription alert = storedAlert(alertId);
    AlertJobView jobs = AlertJobs.view();
    JobDetail job = jobs.job(alertId).orElse(null);
    Trigger trigger = jobs.trigger(alertId).orElse(null);
    long latest = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
    long current = AlertRecord.positionOrLatest(alertId).getCurrentOffset();
    AlertReconciler.Verdict verdict = reconciler.lastVerdict(alertId);
    return new AlertSchedulingInfo()
        .withEnabled(!Boolean.FALSE.equals(alert.getEnabled()))
        .withJobClass(job == null ? null : job.getJobClass().getCanonicalName())
        .withTriggerState(jobs.triggerState(alertId).name())
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
      return AlertJobs.view().exists(eventSubscription.getId());
    } catch (SchedulerException e) {
      LOG.error("Failed to check if subscription is registered: {}", eventSubscription.getId(), e);
      return false;
    }
  }

  // A save naming a consumer this server cannot load fails here, not at the first tick.
  private static void requireConsumerClass(EventSubscription alert) throws ClassNotFoundException {
    if (alert.getClassName() != null) {
      Class.forName(alert.getClassName()).asSubclass(AbstractEventConsumer.class);
    }
  }

  private SubscriptionStatus getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status status) {
    return new SubscriptionStatus().withStatus(status).withTimestamp(System.currentTimeMillis());
  }

  @SneakyThrows
  public void updateEventSubscription(EventSubscription eventSubscription) {
    addSubscriptionPublisher(eventSubscription);
  }

  /**
   * Remove the scheduled alert. Unlike an update this does not reconcile from the committed row:
   * every caller runs it before the row is deleted, so the row still reads enabled and reconciling
   * would reinstall the job being torn down. The per-subscription lock is still taken so a delete
   * cannot interleave with an update's read-modify-write.
   */
  public void deleteEventSubscriptionPublisher(EventSubscription deletedEntity)
      throws SchedulerException {
    AlertJobs.removeNow(deletedEntity.getId());
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

  public long getRelevantUnprocessedEvents(UUID subscriptionId) {
    // Fetch subscription ONCE before the loop to avoid N+1 query problem
    // Previously, getEventSubscription was called for each event in the stream
    EventSubscription subscription = getEventSubscription(subscriptionId);
    FilteringRules filteringRules = subscription.getFilteringRules();
    Long startingTimestamp =
        AlertUtil.alertingWatermark(
            subscription,
            getEventSubscriptionOffset(subscriptionId)
                .map(EventSubscriptionOffset::getStartingTimestamp)
                .orElse(null));

    long offset =
        getEventSubscriptionOffset(subscriptionId)
            .map(EventSubscriptionOffset::getCurrentOffset)
            .orElse(Entity.getCollectionDAO().changeEventDAO().getLatestOffset());

    return UnprocessedEvents.countMatching(
        offset,
        event ->
            AlertUtil.isChangeEventAllowed(
                event, filteringRules, startingTimestamp, AlertUtil.LOG_EVALUATION_ERROR));
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
    FilteringRules filteringRules = subscription.getFilteringRules();
    Long startingTimestamp =
        AlertUtil.alertingWatermark(
            subscription,
            getEventSubscriptionOffset(subscriptionId)
                .map(EventSubscriptionOffset::getStartingTimestamp)
                .orElse(null));

    long offset =
        getEventSubscriptionOffset(subscriptionId)
            .map(EventSubscriptionOffset::getCurrentOffset)
            .orElse(Entity.getCollectionDAO().changeEventDAO().getLatestOffset());

    List<String> page =
        Entity.getCollectionDAO()
            .changeEventDAO()
            .listUnprocessedEvents(offset, limit, paginationOffset);
    return UnprocessedEvents.matching(
        page,
        event ->
            AlertUtil.isChangeEventAllowed(
                event, filteringRules, startingTimestamp, AlertUtil.LOG_EVALUATION_ERROR));
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
    return AlertJobs.jobKey(subscriptionId);
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

  /** Schedules the audit log consumer, which copies change events into the audit log. */
  public void scheduleAuditLogConsumer() throws SchedulerException {
    AuditLogSchedule.ensureScheduled(alertsScheduler);
  }

  public static void shutDown() throws SchedulerException {
    LOG.info("Shutting Down Event Subscription Scheduler");
    if (instance != null) {
      instance.reconciler.stop();
      AlertJobs.stop();
      instance.alertsScheduler.shutdown(true);
      Channels.closeTransports();
    }
  }
}
