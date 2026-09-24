package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory.EXTERNAL;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.events.AlertHealth;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.events.EventSubscriptionService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.events.scheduled.AlertJobs;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.subscription.AlertRows;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;
import org.openmetadata.service.events.subscription.ledger.LedgerKeys;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionMapper;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;

/**
 * The stored alert is the authority, its job is kept in step from every write path, and what its
 * runs leave behind lives in rows that edits and restarts never reset.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class AlertStateIT {

  private static final int ONE_DAY_SECONDS = 86400;
  // Both tables derive a NOT NULL timestamp column from the document.
  private static final String WITH_TIMESTAMP = "{\"timestamp\":1}";
  private static final String ALERTS_PATH = "/v1/events/subscriptions";
  private static final String ENABLE_PATCH =
      "[{\"op\":\"replace\",\"path\":\"/enabled\",\"value\":true}]";

  @Test
  void everyWritePathKeepsTheJobInStep(TestNamespace ns) throws Exception {
    EventSubscriptionService rest = SdkClients.adminClient().eventSubscriptions();
    CreateEventSubscription request = request(ns, "in_step_rest", true);
    EventSubscription created = rest.create(request);
    assertTrue(jobExists(created), "REST create schedules");
    assertNotNull(position(created), "and creates the position row with it");

    SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.PUT, ALERTS_PATH, request.withEnabled(false), EventSubscription.class);
    assertFalse(jobExists(created), "a REST put that disables removes the job");

    rest.patch(created.getId(), JsonUtils.readTree(ENABLE_PATCH));
    assertTrue(jobExists(created), "and a REST patch that enables schedules it again");

    rest.delete(created.getId().toString(), Map.of("hardDelete", "true"));
    awaitJobAndRowsGone(created);
  }

  @Test
  void repositoryWritePathsKeepTheJobInStep(TestNamespace ns) throws Exception {
    EventSubscription created = create(ns, "in_step_repository", true);

    EventSubscription disabled =
        repository().createOrUpdate(null, created.withEnabled(false), "admin").getEntity();
    assertFalse(jobExists(disabled), "an update that disables removes the job");

    repository().createOrUpdate(null, disabled.withEnabled(true), "admin");
    assertTrue(jobExists(created), "and enabling schedules it again");

    repository().deleteInternal("admin", created.getId(), true, true);
    awaitJobAndRowsGone(created);
  }

  @Test
  void bulkCreateSchedulesEveryAlert(TestNamespace ns) throws Exception {
    EventSubscriptionMapper mapper = new EventSubscriptionMapper();
    List<EventSubscription> alerts =
        List.of(
            mapper.createToEntity(request(ns, "bulk_one", true), "admin"),
            mapper.createToEntity(request(ns, "bulk_two", true), "admin"));

    repository().createMany(null, alerts);

    for (EventSubscription alert : alerts) {
      assertTrue(jobExists(alert), "every alert of a bulk create is scheduled");
      assertNotNull(position(alert));
    }
  }

  // The alert's row is read when a tick opens, and what runs leave behind lives in rows.
  @Test
  void everyJobUsesAlertPublisherAndCarriesNoData(TestNamespace ns) throws Exception {
    EventSubscription plain = create(ns, "no_job_data", true);
    EventSubscription withItsOwnConsumer =
        AlertFixtures.tableAlert(
            ns,
            "own_consumer_job",
            LatchedConsumer.class.getName(),
            List.of(AlertFixtures.external(WEBHOOK, "http://localhost:9/unused")));

    for (EventSubscription alert : List.of(plain, withItsOwnConsumer)) {
      JobDetail job = scheduler().getJobDetail(jobKey(alert));
      assertEquals(AlertPublisher.class, job.getJobClass());
      assertTrue(job.getJobDataMap().isEmpty());
    }
  }

  // An alert switched off behind the server sends nothing, and its own tick removes its job.
  @Test
  void disabledAlertTickWritesNothingAndRemovesItsJob(TestNamespace ns) throws Exception {
    EventSubscription alert = create(ns, "disabled_tick", true);
    QuietAlert.settle(alert);
    String positionBefore = position(alert);
    JobDetail job = scheduler().getJobDetail(jobKey(alert));
    dao().update(alert.withEnabled(false));

    DirectTick.run(alert, job);

    assertEquals(positionBefore, position(alert));
    assertFalse(jobExists(alert));
  }

  @Test
  void deletedAlertJobRemovesItself(TestNamespace ns) throws Exception {
    EventSubscription alert = create(ns, "removes_itself", true);
    QuietAlert.settle(alert);
    JobDetail job = scheduler().getJobDetail(jobKey(alert));
    dao().delete(alert.getId());

    DirectTick.run(alert, job);

    assertFalse(jobExists(alert));
  }

  // A not-found marker can outlive a delete that rolled back; the stored alert still answers.
  @Test
  void aNotFoundMarkerCannotHideALiveAlert(TestNamespace ns) {
    assumeTrue(TestSuiteBootstrap.isRedisEnabled(), "the not-found cache needs Redis");
    EventSubscription alert = create(ns, "marked_gone", false);
    markNotFound(alert);
    try {
      assertNotNull(AlertRows.readOrNull(alert.getId()));
    } finally {
      unmarkNotFound(alert);
    }
  }

  // A tick reads its alert when it opens and again before it ends, on one thread.
  @Test
  void rowReadTwiceOnOneThreadSeesWhatChangedInBetween(TestNamespace ns) {
    EventSubscription alert = create(ns, "read_twice", false);
    assertNotNull(AlertRows.readOrNull(alert.getId()));

    dao().update(alert.withDescription("changed by another server"));

    assertEquals("changed by another server", AlertRows.readOrNull(alert.getId()).getDescription());
  }

  @Test
  void healthSurvivesEditAndRestart(TestNamespace ns) throws Exception {
    EventSubscription alert = create(ns, "health_survives", true);
    String destinationId = alert.getDestinations().getFirst().getId().toString();
    AlertHealth failing = JsonUtils.readValue(health(alert), AlertHealth.class);
    failing
        .getDestinations()
        .get(destinationId)
        .withStatus(
            new SubscriptionStatus()
                .withStatus(SubscriptionStatus.Status.FAILED)
                .withLastFailedReason("connection refused")
                .withTimestamp(System.currentTimeMillis()));
    dao()
        .upsertSubscriberExtension(
            alert.getId().toString(),
            LedgerKeys.HEALTH,
            "alertHealth",
            JsonUtils.pojoToJson(failing));

    repository().createOrUpdate(null, alert.withDescription("edited"), "admin");
    AlertJobs.converge(alert.getId());

    SubscriptionStatus afterwards =
        EventSubscriptionScheduler.getInstance()
            .getStatusForEventSubscription(alert.getId(), UUID.fromString(destinationId));
    assertEquals(SubscriptionStatus.Status.FAILED, afterwards.getStatus());
  }

  // Scheduling follows the commit: nothing while the unit of work is open, nothing if it rolls
  // back.
  @Test
  void saveInsideAnOuterTransactionSchedulesOnlyAfterCommit(TestNamespace ns) throws Exception {
    EventSubscription alert =
        new EventSubscriptionMapper().createToEntity(request(ns, "outer_commit", true), "admin");

    boolean scheduledBeforeCommit =
        repository()
            .executeInTransaction(
                () -> {
                  repository().create(null, alert);
                  return uncheckedJobExists(alert);
                });

    assertFalse(scheduledBeforeCommit);
    assertTrue(jobExists(alert));
  }

  @Test
  void saveThatRollsBackSchedulesNothing(TestNamespace ns) throws Exception {
    EventSubscription alert =
        new EventSubscriptionMapper().createToEntity(request(ns, "outer_rollback", true), "admin");

    assertThrows(
        IllegalStateException.class,
        () ->
            repository()
                .executeInTransaction(
                    () -> {
                      repository().create(null, alert);
                      throw new IllegalStateException("the outer work failed");
                    }));

    assertFalse(jobExists(alert));
    assertNull(AlertRows.readOrNull(alert.getId()));
  }

  @Test
  void deleteThatRollsBackKeepsTheJobAndRows(TestNamespace ns) throws Exception {
    EventSubscription alert = create(ns, "delete_rollback", true);

    assertThrows(
        IllegalStateException.class,
        () ->
            repository()
                .executeInTransaction(
                    () -> {
                      repository().delete("admin", alert.getId(), false, true);
                      throw new IllegalStateException("the outer work failed");
                    }));

    assertNotNull(AlertRows.readOrNull(alert.getId()));
    assertTrue(jobExists(alert));
    assertNotNull(position(alert));
  }

  // An alert another entity contains is deleted with it, through the cascade.
  @Test
  void cascadeDeleteRemovesTheJobAndRows(TestNamespace ns) throws Exception {
    for (boolean hardDelete : List.of(true, false)) {
      EventSubscription alert = create(ns, "cascade_" + hardDelete, true);
      Glossary parent =
          SdkClients.adminClient()
              .glossaries()
              .create(
                  new CreateGlossary()
                      .withName(ns.shortPrefix("owner_" + hardDelete))
                      .withDescription("contains an alert"));
      Entity.getCollectionDAO()
          .relationshipDAO()
          .insert(
              parent.getId(),
              alert.getId(),
              Entity.GLOSSARY,
              Entity.EVENT_SUBSCRIPTION,
              Relationship.CONTAINS.ordinal());

      Entity.getEntityRepository(Entity.GLOSSARY).delete("admin", parent.getId(), true, hardDelete);

      assertNull(AlertRows.readOrNull(alert.getId()));
      awaitJobAndRowsGone(alert);
    }
  }

  // A test send is a question about an endpoint, not something that happened to the alert.
  @Test
  void testSendLeavesLiveHealthUnchanged(TestNamespace ns) throws Exception {
    EventSubscription alert = create(ns, "test_send_health", true);
    SubscriptionDestination destination = alert.getDestinations().getFirst();
    String before = health(alert);
    String storedBefore =
        JsonUtils.pojoToJson(AlertFixtures.stored(alert.getId()).getDestinations());

    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            ALERTS_PATH + "/testDestination",
            Map.of("destinations", List.of(destination)),
            Object.class);

    assertEquals(before, health(alert));
    assertEquals(
        storedBefore, JsonUtils.pojoToJson(AlertFixtures.stored(alert.getId()).getDestinations()));
  }

  @Test
  void diagnosticsReadCreatesNoRow(TestNamespace ns) {
    EventSubscription neverScheduled = create(ns, "never_scheduled", false);

    EventSubscriptionOffset reported =
        EventSubscriptionScheduler.getInstance()
            .getEventSubscriptionOffset(neverScheduled.getId())
            .orElseThrow();

    assertEquals(reported.getStartingOffset(), reported.getCurrentOffset());
    assertNull(position(neverScheduled), "a read must not decide where an alert starts");
  }

  @Test
  void reconcilerRepairsAMissingJobAndSparesYoungLeftovers(TestNamespace ns) throws Exception {
    EventSubscription alert = create(ns, "reconciled", true);
    scheduler().deleteJob(jobKey(alert));
    EventSubscription leftover = new EventSubscription().withId(UUID.randomUUID());
    AlertRecord.start(leftover.withDestinations(List.of()));

    EventSubscriptionScheduler.getInstance().reconcileNow();

    assertTrue(jobExists(alert), "a missing job is scheduled again");
    assertNotNull(position(leftover), "rows younger than five minutes may be a create in flight");
  }

  @Test
  void aNotFoundMarkerCannotCostALiveAlertItsJobOrItsRows(TestNamespace ns) throws Exception {
    assumeTrue(TestSuiteBootstrap.isRedisEnabled(), "the not-found cache needs Redis");
    EventSubscription alert = create(ns, "marked_gone_settled", true);
    scheduler().deleteJob(jobKey(alert));
    backdatePosition(alert);
    markNotFound(alert);
    try {
      AlertJobs.converge(alert.getId());
      assertTrue(jobExists(alert), "the job follows the stored alert, not the marker");

      scheduler().deleteJob(jobKey(alert));
      EventSubscriptionScheduler.getInstance().reconcileNow();

      assertTrue(jobExists(alert), "a live alert's missing job is scheduled again");
      assertNotNull(position(alert), "and its rows are kept, however old they are");
    } finally {
      unmarkNotFound(alert);
    }
  }

  @Test
  void firstReconcileRemovesRowsOfAlertsDeletedBeforeTheUpgrade() throws Exception {
    String gone = UUID.randomUUID().toString();
    EventSubscriptionOffset longAgo =
        new EventSubscriptionOffset()
            .withCurrentOffset(1L)
            .withStartingOffset(1L)
            .withTimestamp(System.currentTimeMillis() - 3_600_000L);
    dao()
        .upsertSubscriberExtension(
            gone, LedgerKeys.POSITION, "eventSubscriptionOffset", JsonUtils.pojoToJson(longAgo));
    AlertMetrics counted =
        new AlertMetrics()
            .withTotalEvents(1)
            .withSuccessEvents(1)
            .withFailedEvents(0)
            .withTimestamp(longAgo.getTimestamp());
    dao()
        .upsertSubscriberExtension(
            gone, LedgerKeys.COUNTERS, "alertMetrics", JsonUtils.pojoToJson(counted));
    dao()
        .batchUpsertSuccessfulChangeEvents(
            List.of(UUID.randomUUID().toString()),
            List.of(gone),
            List.of(WITH_TIMESTAMP),
            List.of(1L));
    dao()
        .upsertFailedEvent(
            gone,
            AbstractEventConsumer.FAILED_EVENT_EXTENSION + "-" + UUID.randomUUID(),
            WITH_TIMESTAMP,
            "test");

    EventSubscriptionScheduler.getInstance().reconcileNow();

    assertTrue(dao().listSubscriberExtensions(gone).isEmpty(), "position and counters");
    assertEquals(0, dao().getSuccessfulRecordCount(gone), "delivered rows");
    assertEquals(0, dao().countFailedEventsById(gone), "failure rows");
  }

  private static EventSubscription create(TestNamespace ns, String name, boolean enabled) {
    UUID id =
        SdkClients.adminClient().eventSubscriptions().create(request(ns, name, enabled)).getId();
    return Entity.getEntity(Entity.EVENT_SUBSCRIPTION, id, "*", Include.NON_DELETED);
  }

  private static CreateEventSubscription request(TestNamespace ns, String name, boolean enabled) {
    SubscriptionDestination destination =
        new SubscriptionDestination()
            .withType(WEBHOOK)
            .withCategory(EXTERNAL)
            .withConfig(new Webhook().withEndpoint(URI.create("http://localhost:9/unused")));
    return new CreateEventSubscription()
        .withName(ns.prefix(name))
        .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
        .withResources(List.of(Entity.TABLE))
        .withEnabled(enabled)
        .withPollInterval(ONE_DAY_SECONDS)
        .withDestinations(List.of(destination));
  }

  // A tick that was running when the delete landed finishes first.
  private static void awaitJobAndRowsGone(EventSubscription alert) {
    Awaitility.await("the job of the deleted alert to be gone")
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(() -> assertFalse(jobExists(alert)));
    assertNull(position(alert), "and every row of the alert");
  }

  private static boolean jobExists(EventSubscription alert) throws SchedulerException {
    return scheduler().checkExists(jobKey(alert));
  }

  private static boolean uncheckedJobExists(EventSubscription alert) {
    try {
      return jobExists(alert);
    } catch (SchedulerException e) {
      throw new IllegalStateException(e);
    }
  }

  private static JobKey jobKey(EventSubscription alert) {
    return new JobKey(alert.getId().toString(), AlertJobs.JOB_GROUP);
  }

  private static String position(EventSubscription alert) {
    return dao().getSubscriberExtension(alert.getId().toString(), LedgerKeys.POSITION);
  }

  // Past the reconciler's minimum age, so rows it thought orphaned would be removed.
  private static void backdatePosition(EventSubscription alert) {
    EventSubscriptionOffset backdated =
        JsonUtils.readValue(position(alert), EventSubscriptionOffset.class)
            .withTimestamp(System.currentTimeMillis() - 3_600_000L);
    dao()
        .upsertSubscriberExtension(
            alert.getId().toString(),
            LedgerKeys.POSITION,
            "eventSubscriptionOffset",
            JsonUtils.pojoToJson(backdated));
  }

  private static void markNotFound(EventSubscription alert) {
    CacheBundle.getNotFoundCache().markNotFoundById(Entity.EVENT_SUBSCRIPTION, alert.getId());
  }

  private static void unmarkNotFound(EventSubscription alert) {
    CacheBundle.getNotFoundCache()
        .invalidate(Entity.EVENT_SUBSCRIPTION, alert.getId(), alert.getFullyQualifiedName());
  }

  private static String health(EventSubscription alert) {
    return dao().getSubscriberExtension(alert.getId().toString(), LedgerKeys.HEALTH);
  }

  private static Scheduler scheduler() {
    return AlertFixtures.scheduler();
  }

  private static EventSubscriptionDAO dao() {
    return Entity.getCollectionDAO().eventSubscriptionDAO();
  }

  private static EventSubscriptionRepository repository() {
    return (EventSubscriptionRepository) Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);
  }
}
