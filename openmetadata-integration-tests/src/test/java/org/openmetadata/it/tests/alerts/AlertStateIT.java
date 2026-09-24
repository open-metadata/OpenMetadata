package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
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
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.AlertHealth;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.events.EventSubscriptionService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.subscription.AlertRows;
import org.openmetadata.service.events.subscription.ledger.LedgerKeys;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
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
    EventSubscriptionScheduler.getInstance().updateEventSubscription(alert);

    SubscriptionStatus afterwards =
        EventSubscriptionScheduler.getInstance()
            .getStatusForEventSubscription(alert.getId(), UUID.fromString(destinationId));
    assertEquals(SubscriptionStatus.Status.FAILED, afterwards.getStatus());
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

  private static JobKey jobKey(EventSubscription alert) {
    return new JobKey(alert.getId().toString(), EventSubscriptionScheduler.ALERT_JOB_GROUP);
  }

  private static String position(EventSubscription alert) {
    return dao().getSubscriberExtension(alert.getId().toString(), LedgerKeys.POSITION);
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
