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
import static org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer.ALERT_INFO_KEY;
import static org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer.ALERT_OFFSET_KEY;
import static org.openmetadata.service.events.subscription.AlertUtil.getStartingOffset;

import com.google.common.util.concurrent.Striped;
import io.dropwizard.db.DataSourceFactory;
import java.lang.reflect.InvocationTargetException;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Properties;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.locks.Lock;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
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
import org.openmetadata.service.audit.AuditLogConsumer;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.events.subscription.AlertRows;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;
import org.openmetadata.service.jdbi3.HikariCPDataSourceFactory.PoolWorkload;
import org.openmetadata.service.jdbi3.QuartzConnectionProvider;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.resources.events.subscription.TypedEvent;
import org.openmetadata.service.util.ChangeEventJsonUtils;
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
import org.quartz.utils.DBConnectionManager;

@Slf4j
public class EventSubscriptionScheduler {
  public static final String ALERT_JOB_GROUP = "OMAlertJobGroup";
  public static final String ALERT_TRIGGER_GROUP = "OMAlertJobGroup";
  private static EventSubscriptionScheduler instance;
  private static volatile boolean initialized = false;
  @Getter private final Scheduler alertsScheduler;
  private static final String SCHEDULER_NAME = "OMEventSubScheduler";
  private static final int SCHEDULER_THREAD_COUNT = 10;
  // A trigger later than this is skipped by acquisition until the misfire handler, which rescans at
  // this period, picks it up again.
  static final long MISFIRE_THRESHOLD_MS = 5_000L;

  // Derived from the scheduler's instance name, which Quartz already requires to be unique per
  // cluster. DBConnectionManager is a process-wide singleton whose registration is an unguarded
  // map put, so two schedulers sharing a datasource name silently discard the first pool; keying
  // off a name that is unique by construction makes that collision unrepresentable.
  private static final String DATA_SOURCE_NAME = SCHEDULER_NAME + "DS";
  private static final String POOL_NAME = SCHEDULER_NAME + "-pool";

  // One connection per worker thread that may be doing job-store work, plus the misfire handler
  // and the cluster manager, which each hold one while they run.
  private static final int POOL_MAX_SIZE = SCHEDULER_THREAD_COUNT + 2;

  // Bounded by construction rather than a per-id map that would grow with the catalog. Updates to
  // one subscription serialize; different subscriptions only collide when they share a stripe.
  private static final Striped<Lock> SUBSCRIPTION_LOCKS = Striped.lock(64);

  // The reconcile re-reads after applying, so a peer committing mid-flight costs one more round.
  // The bound stops a subscription being rewritten in a tight loop from spinning here forever.
  private static final int SCHEDULE_SYNC_ATTEMPTS = 3;

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
    // Resolve the configured consumer on the calling thread so a bad className still fails the
    // request instead of only surfacing when the job first fires.
    newPublisher(eventSubscription);
    SubscriptionStatus.Status status =
        Boolean.FALSE.equals(eventSubscription.getEnabled())
            ? SubscriptionStatus.Status.DISABLED
            : SubscriptionStatus.Status.ACTIVE;
    setDestinationStatuses(eventSubscription, status);
    syncScheduledState(eventSubscription.getId());
    LOG.info(
        "Event Subscription started as {} : status {} for all Destinations",
        eventSubscription.getName(),
        status);
  }

  /**
   * Bring the Quartz schedule in line with the subscription's committed state.
   *
   * <p>The decision cannot be taken from the entity a caller happens to hold. Two requests commit in
   * one order and reach the scheduler in the other, so a disable that committed first but arrived
   * second would delete the job a later enable had just installed, leaving the row enabled with
   * nothing scheduled. Reading the committed row inside a per-subscription lock makes the last
   * caller through the lock see the final state, so the schedule converges on it whichever order the
   * requests arrive in.
   *
   * <p>A peer node holds its own lock and can still commit between this node's read and its write,
   * so the row is read again after applying and applied once more when it moved. That settles on the
   * last committed state no matter which node reached it first.
   */
  private void syncScheduledState(UUID subscriptionId)
      throws SchedulerException,
          ClassNotFoundException,
          NoSuchMethodException,
          InvocationTargetException,
          InstantiationException,
          IllegalAccessException {
    Lock lock = SUBSCRIPTION_LOCKS.get(subscriptionId);
    lock.lock();
    try {
      for (int attempt = 1; attempt <= SCHEDULE_SYNC_ATTEMPTS; attempt++) {
        EventSubscription committed = AlertRows.readOrNull(subscriptionId);
        applyScheduledState(subscriptionId, committed);
        if (isSettled(subscriptionId, committed)) {
          return;
        }
      }
      LOG.warn(
          "Event subscription {} kept changing while its schedule was applied; the next update reconciles it",
          subscriptionId);
    } finally {
      lock.unlock();
    }
  }

  /** Settled means the row has not moved since the decision was taken and the job store agrees. */
  private boolean isSettled(UUID subscriptionId, EventSubscription applied)
      throws SchedulerException {
    EventSubscription current = AlertRows.readOrNull(subscriptionId);
    if (!Objects.equals(versionOf(applied), versionOf(current))) {
      return false;
    }
    return alertsScheduler.checkExists(new JobKey(subscriptionId.toString(), ALERT_JOB_GROUP))
        == shouldBeScheduled(current);
  }

  private void applyScheduledState(UUID subscriptionId, EventSubscription committed)
      throws SchedulerException,
          ClassNotFoundException,
          NoSuchMethodException,
          InvocationTargetException,
          InstantiationException,
          IllegalAccessException {
    if (!shouldBeScheduled(committed)) {
      removeAlertJob(subscriptionId);
      return;
    }
    // The scheduled snapshot is what the status endpoint reads back, so stamp the destinations on
    // it the way the caller's entity was stamped before it used to be serialised into job data.
    setDestinationStatuses(committed, SubscriptionStatus.Status.ACTIVE);
    // Rows first: a tick that finds no position row does nothing.
    AlertRecord.start(committed);
    JobDetail jobDetail = jobBuilder(newPublisher(committed), committed, subscriptionId.toString());
    // Write the job and its trigger in a single job-store transaction rather than deleting the pair
    // and re-adding it. Delete-then-add leaves a window in which the alert is not scheduled at all,
    // and both halves race any other writer holding the same keys -- every peer node reaches this
    // same clustered job store from initializeEventSubscriptions() as it starts up.
    alertsScheduler.scheduleJob(jobDetail, Set.of(trigger(committed)), true);
  }

  private static boolean shouldBeScheduled(EventSubscription subscription) {
    return subscription != null && !Boolean.FALSE.equals(subscription.getEnabled());
  }

  private static Double versionOf(EventSubscription subscription) {
    return subscription == null ? null : subscription.getVersion();
  }

  private AbstractEventConsumer newPublisher(EventSubscription eventSubscription)
      throws ClassNotFoundException,
          NoSuchMethodException,
          InvocationTargetException,
          InstantiationException,
          IllegalAccessException {
    Class<? extends AbstractEventConsumer> clazz =
        Class.forName(
                Optional.ofNullable(eventSubscription.getClassName())
                    .orElse(AlertPublisher.class.getCanonicalName()))
            .asSubclass(AbstractEventConsumer.class);
    return clazz.getDeclaredConstructor(DIContainer.class).newInstance(new DIContainer());
  }

  private void setDestinationStatuses(
      EventSubscription eventSubscription, SubscriptionStatus.Status status) {
    eventSubscription
        .getDestinations()
        .forEach(
            destination ->
                destination.setStatusDetails(getSubscriptionStatusAtCurrentTime(status)));
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
    dataMap.put(ALERT_INFO_KEY, JsonUtils.pojoToJson(eventSubscription));
    EventSubscriptionOffset startingOffset = getStartingOffset(eventSubscription.getId());
    dataMap.put(ALERT_OFFSET_KEY, JsonUtils.pojoToJson(startingOffset));
    JobBuilder jobBuilder =
        JobBuilder.newJob(publisher.getClass())
            .withIdentity(jobIdentity, ALERT_JOB_GROUP)
            .usingJobData(dataMap);
    return jobBuilder.build();
  }

  static Trigger trigger(EventSubscription eventSubscription) {
    return TriggerBuilder.newTrigger()
        .withIdentity(eventSubscription.getId().toString(), ALERT_TRIGGER_GROUP)
        .withSchedule(pollerSchedule(eventSubscription.getPollInterval()))
        .startNow()
        .build();
  }

  // A late poller fires once now and re-anchors its timetable: no wait for the next slot and no
  // burst of catch-up runs.
  private static SimpleScheduleBuilder pollerSchedule(int intervalSeconds) {
    return SimpleScheduleBuilder.repeatSecondlyForever(intervalSeconds)
        .withMisfireHandlingInstructionNowWithExistingCount();
  }

  private SubscriptionStatus getSubscriptionStatusAtCurrentTime(SubscriptionStatus.Status status) {
    return new SubscriptionStatus().withStatus(status).withTimestamp(System.currentTimeMillis());
  }

  @SneakyThrows
  public void updateEventSubscription(EventSubscription eventSubscription) {
    // Only the enabled path reported destination status before, and that is what the response the
    // caller is about to return carries; the schedule itself comes from the committed row.
    if (Boolean.TRUE.equals(eventSubscription.getEnabled())) {
      setDestinationStatuses(eventSubscription, SubscriptionStatus.Status.ACTIVE);
    }
    syncScheduledState(eventSubscription.getId());
  }

  /**
   * Remove the scheduled alert. Unlike an update this does not reconcile from the committed row:
   * every caller runs it before the row is deleted, so the row still reads enabled and reconciling
   * would reinstall the job being torn down. The per-subscription lock is still taken so a delete
   * cannot interleave with an update's read-modify-write.
   */
  public void deleteEventSubscriptionPublisher(EventSubscription deletedEntity)
      throws SchedulerException {
    Lock lock = SUBSCRIPTION_LOCKS.get(deletedEntity.getId());
    lock.lock();
    try {
      removeAlertJob(deletedEntity.getId());
    } finally {
      lock.unlock();
    }
    LOG.info("Alert publisher deleted for {}", deletedEntity.getName());
  }

  /**
   * {@link Scheduler#deleteJob} lists a job's triggers and then unschedules them in separate
   * transactions, so it fails when a trigger it just listed is already gone. Dropping the trigger
   * first leaves it nothing to unschedule. If it fails even so, a writer on another node has
   * installed a pair under this key since, and deleting that would undo work newer than ours -- so
   * stop rather than retry and let the reconcile in {@link #syncScheduledState} settle the outcome.
   */
  private void removeAlertJob(UUID subscriptionId) throws SchedulerException {
    String id = subscriptionId.toString();
    alertsScheduler.unscheduleJob(new TriggerKey(id, ALERT_TRIGGER_GROUP));
    JobKey jobKey = new JobKey(id, ALERT_JOB_GROUP);
    try {
      alertsScheduler.deleteJob(jobKey);
    } catch (SchedulerException lostRace) {
      LOG.debug(
          "Alert job {} changed while being deleted; leaving it to the reconcile",
          jobKey,
          lostRace);
    }
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
    EventSubscription alert = AlertRows.read(subscriptionId);
    return Boolean.FALSE.equals(alert.getEnabled())
        ? new SubscriptionStatus().withStatus(SubscriptionStatus.Status.DISABLED)
        : destinationsWithHealth(alert).stream()
            .filter(destination -> destination.getId().equals(destinationId))
            .findFirst()
            .map(destination -> convertToSubscriptionStatus(destination.getStatusDetails()))
            .orElse(null);
  }

  public List<SubscriptionDestination> listAlertDestinations(UUID subscriptionId) {
    EventSubscription alert = AlertRows.read(subscriptionId);
    return Boolean.FALSE.equals(alert.getEnabled())
        ? Collections.emptyList()
        : destinationsWithHealth(alert);
  }

  /** Every destination of the alert with its current status: one read, whatever their number. */
  public List<SubscriptionDestination> destinationsWithStatus(EventSubscription alert) {
    return destinationsWithHealth(alert);
  }

  // Health lives in a row of its own, so registering, editing and restarting never reset it.
  private static List<SubscriptionDestination> destinationsWithHealth(EventSubscription alert) {
    Map<String, DestinationHealth> health =
        AlertRecord.open(alert).map(AlertLedger::health).orElse(Map.of());
    long now = System.currentTimeMillis();
    for (SubscriptionDestination destination : listOrEmpty(alert.getDestinations())) {
      destination.setStatusDetails(
          statusToShow(alert, destination, health.get(destination.getId().toString()), now));
    }
    return listOrEmpty(alert.getDestinations());
  }

  // Disabled is decided when read, from the alert and the destination as they are now, and never
  // stored. Otherwise the last tick that reached the destination speaks, and Active before any has.
  private static SubscriptionStatus statusToShow(
      EventSubscription alert,
      SubscriptionDestination destination,
      DestinationHealth known,
      long now) {
    boolean switchedOff =
        Boolean.FALSE.equals(alert.getEnabled()) || Boolean.FALSE.equals(destination.getEnabled());
    SubscriptionStatus status;
    if (switchedOff) {
      status = new SubscriptionStatus().withStatus(SubscriptionStatus.Status.DISABLED);
    } else if (known != null) {
      status = known.getStatus();
    } else {
      status =
          new SubscriptionStatus().withStatus(SubscriptionStatus.Status.ACTIVE).withTimestamp(now);
    }
    return status;
  }

  public EventsRecord getEventSubscriptionEventsRecord(UUID subscriptionId) {
    AlertProgress progress = AlertProgress.of(AlertRows.read(subscriptionId));
    AlertProgress.Counts counts = progress.counts();
    long pending = progress.relevantUnreadCount();
    return new EventsRecord()
        .withTotalEventsCount(counts.handled() + pending)
        .withFailedEventsCount(counts.failed())
        .withPendingEventsCount(pending)
        .withSuccessfulEventsCount(counts.delivered());
  }

  public EventSubscriptionDiagnosticInfo getEventSubscriptionDiagnosticInfo(
      UUID subscriptionId, int limit, int paginationOffset, boolean listCountOnly) {
    AlertProgress progress = AlertProgress.of(AlertRows.read(subscriptionId));
    AlertProgress.Counts counts = progress.counts();
    List<ChangeEvent> relevant = progress.relevantUnread(limit, paginationOffset);
    return new EventSubscriptionDiagnosticInfo()
        .withLatestOffset(progress.latestOffset())
        .withCurrentOffset(progress.currentOffset())
        .withStartingOffset(progress.startingOffset())
        .withHasProcessedAllEvents(progress.caughtUp())
        .withSuccessfulEventsCount(counts.delivered())
        .withFailedEventsCount(counts.failed())
        .withTotalUnprocessedEventsCount(progress.unread())
        .withRelevantUnprocessedEventsCount((long) relevant.size())
        .withRelevantUnprocessedEventsList(listCountOnly ? null : relevant)
        .withTotalUnprocessedEventsList(
            listCountOnly ? null : progress.allUnread(limit, paginationOffset));
  }

  public boolean checkIfPublisherPublishedAllEvents(UUID subscriptionID) {
    return AlertProgress.of(AlertRows.read(subscriptionID)).caughtUp();
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

  public Optional<EventSubscription> getEventSubscriptionFromScheduledJob(UUID id) {
    try {
      JobDetail jobDetail =
          alertsScheduler.getJobDetail(new JobKey(id.toString(), ALERT_JOB_GROUP));

      if (jobDetail != null) {
        Object alertInfoValue = jobDetail.getJobDataMap().get(ALERT_INFO_KEY);
        if (alertInfoValue instanceof String subscriptionJson) {
          EventSubscription eventSubscription =
              JsonUtils.readValue(subscriptionJson, EventSubscription.class);
          return Optional.ofNullable(eventSubscription);
        } else if (alertInfoValue instanceof EventSubscription eventSubscription) {
          return Optional.of(eventSubscription);
        }
      }
    } catch (SchedulerException ex) {
      LOG.error("Failed to get Event Subscription from Job, Subscription Id : {}", id, ex);
    } catch (Exception ex) {
      LOG.error("Failed to deserialize Event Subscription, Subscription Id : {}", id, ex);
    }

    return Optional.empty();
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
        .withSchedule(pollerSchedule(AUDIT_LOG_POLL_INTERVAL_SECONDS))
        .startNow()
        .build();
  }

  public static void shutDown() throws SchedulerException {
    LOG.info("Shutting Down Event Subscription Scheduler");
    if (instance != null) {
      instance.alertsScheduler.shutdown(true);
    }
  }
}
