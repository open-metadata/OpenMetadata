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

import com.google.common.util.concurrent.Striped;
import java.lang.reflect.InvocationTargetException;
import java.util.Collections;
import java.util.List;
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
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.events.EventSubscriptionDiagnosticInfo;
import org.openmetadata.schema.api.events.EventsRecord;
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
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.audit.AuditLogConsumer;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.exception.EntityNotFoundException;
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

    Properties properties = new Properties();
    properties.put("org.quartz.scheduler.instanceName", SCHEDULER_NAME);
    properties.put("org.quartz.scheduler.instanceId", "AUTO");
    properties.put("org.quartz.scheduler.skipUpdateCheck", "true");
    properties.put("org.quartz.threadPool.class", "org.quartz.simpl.SimpleThreadPool");
    properties.put("org.quartz.threadPool.threadCount", String.valueOf(SCHEDULER_THREAD_COUNT));
    properties.put("org.quartz.threadPool.threadPriority", "5");
    properties.put("org.quartz.jobStore.misfireThreshold", "60000");
    properties.put("org.quartz.jobStore.class", "org.quartz.impl.jdbcjobstore.JobStoreTX");
    properties.put("org.quartz.jobStore.useProperties", "true");
    properties.put("org.quartz.jobStore.tablePrefix", "QRTZ_");
    properties.put("org.quartz.jobStore.isClustered", "true");
    // No org.quartz.dataSource.* properties: those make Quartz build its own c3p0 pool from a
    // captured static password. The pool is registered against this name below.
    properties.put("org.quartz.jobStore.dataSource", DATA_SOURCE_NAME);
    if (ConnectionType.MYSQL.label.equals(config.getDataSourceFactory().getDriverClass())) {
      properties.put(
          "org.quartz.jobStore.driverDelegateClass",
          "org.quartz.impl.jdbcjobstore.StdJDBCDelegate");
    } else {
      properties.put(
          "org.quartz.jobStore.driverDelegateClass",
          "org.quartz.impl.jdbcjobstore.PostgreSQLDelegate");
    }

    StdSchedulerFactory factory = new StdSchedulerFactory();
    factory.initialize(properties);
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
        EventSubscription committed = readCommitted(subscriptionId);
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
    EventSubscription current = readCommitted(subscriptionId);
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

  /** The committed row, or null once the subscription has been deleted. */
  private EventSubscription readCommitted(UUID subscriptionId) {
    EntityRepository<? extends EntityInterface> repository =
        Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);
    try {
      return (EventSubscription) repository.get(null, subscriptionId, repository.getFields("*"));
    } catch (EntityNotFoundException deleted) {
      return null;
    }
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
    Optional<EventSubscription> eventSubscriptionOpt =
        getEventSubscriptionFromScheduledJob(subscriptionId);

    if (eventSubscriptionOpt.isPresent()) {
      // Find the destination and get its status
      Optional<SubscriptionDestination> destinationOpt =
          eventSubscriptionOpt.get().getDestinations().stream()
              .filter(destination -> destination.getId().equals(destinationId))
              .findFirst();
      if (destinationOpt.isPresent()) {
        Object status = destinationOpt.get().getStatusDetails();
        return convertToSubscriptionStatus(status);
      }
      return null;
    }

    EntityRepository<? extends EntityInterface> subscriptionRepository =
        Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);

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

    return Entity.getCollectionDAO().changeEventDAO().listUnprocessedEvents(offset).parallelStream()
        .map(
            eventJson -> {
              ChangeEvent event = ChangeEventJsonUtils.readOrNull(eventJson, ChangeEvent.class);
              return event != null
                      && AlertUtil.isChangeEventAllowed(
                          event, filteringRules, startingTimestamp, AlertUtil.LOG_EVALUATION_ERROR)
                  ? event
                  : null;
            })
        .filter(Objects::nonNull)
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

    return Entity.getCollectionDAO()
        .changeEventDAO()
        .listUnprocessedEvents(offset, limit, paginationOffset)
        .parallelStream()
        .map(
            eventJson -> {
              ChangeEvent event = ChangeEventJsonUtils.readOrNull(eventJson, ChangeEvent.class);
              return event != null
                      && AlertUtil.isChangeEventAllowed(
                          event, filteringRules, startingTimestamp, AlertUtil.LOG_EVALUATION_ERROR)
                  ? event
                  : null;
            })
        .filter(Objects::nonNull)
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

  public Optional<EventSubscriptionOffset> getEventSubscriptionOffset(UUID subscriptionID) {
    EventSubscriptionOffset offset = getStartingOffset(subscriptionID);
    if (offset != null && offset.getCurrentOffset() != null) {
      return Optional.of(offset);
    }

    try {
      JobDetail jobDetail =
          alertsScheduler.getJobDetail(new JobKey(subscriptionID.toString(), ALERT_JOB_GROUP));
      if (jobDetail != null) {
        Object offsetValue = jobDetail.getJobDataMap().get(ALERT_OFFSET_KEY);
        if (offsetValue instanceof String offsetJson) {
          EventSubscriptionOffset jobOffset =
              JsonUtils.readValue(offsetJson, EventSubscriptionOffset.class);
          if (jobOffset != null) {
            return Optional.of(jobOffset);
          }
        } else if (offsetValue instanceof EventSubscriptionOffset jobOffset) {
          return Optional.of(jobOffset);
        }
      }
    } catch (Exception ex) {
      LOG.error(
          "Failed to get Event Subscription offset from Job, Subscription Id : {}",
          subscriptionID,
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
      instance.alertsScheduler.shutdown(true);
    }
  }
}
