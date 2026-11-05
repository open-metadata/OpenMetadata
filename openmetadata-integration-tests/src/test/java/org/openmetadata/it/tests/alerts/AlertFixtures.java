package org.openmetadata.it.tests.alerts;

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory.EXTERNAL;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.events.AlertType;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.consumer.AlertRows;
import org.openmetadata.service.events.consumer.ledger.LedgerKeys;
import org.openmetadata.service.events.consumer.schedule.AlertJobs;
import org.openmetadata.service.events.consumer.schedule.EventSubscriptionScheduler;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;
import org.openmetadata.service.jdbi3.EventSubscriptionRepository;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.TriggerKey;
import org.quartz.impl.SchedulerRepository;

/** Alerts for tests that drive ticks themselves: polled once a day, so Quartz stays out of it. */
final class AlertFixtures {

  private static final int ONE_DAY_SECONDS = 86400;

  private AlertFixtures() {}

  /**
   * A user who may create alerts and try notification templates, and may edit no alert it did not
   * create.
   */
  static OpenMetadataClient alertCreatorClient() {
    String name = "alertcreator" + UUID.randomUUID().toString().substring(0, 8);
    String email = name + "@open-metadata.org";
    OpenMetadataClient admin = SdkClients.adminClient();
    Rule create =
        new Rule()
            .withName(name + "Create")
            .withOperations(List.of(MetadataOperation.CREATE))
            .withResources(List.of(Entity.EVENT_SUBSCRIPTION, Entity.NOTIFICATION_TEMPLATE))
            .withEffect(Rule.Effect.ALLOW);
    Policy policy =
        admin
            .policies()
            .create(new CreatePolicy().withName(name + "Policy").withRules(List.of(create)));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(name + "Role")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    admin
        .users()
        .create(new CreateUser().withName(name).withEmail(email).withRoles(List.of(role.getId())));
    return SdkClients.createClient(name, email, new String[] {});
  }

  static SubscriptionDestination external(
      SubscriptionDestination.SubscriptionType type, String endpoint) {
    return new SubscriptionDestination()
        .withType(type)
        .withCategory(EXTERNAL)
        .withConfig(new Webhook().withEndpoint(URI.create(endpoint)));
  }

  static EventSubscription tableAlert(
      TestNamespace ns,
      String name,
      String consumerClassName,
      List<SubscriptionDestination> destinations) {
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix(name))
            .withAlertType(AlertType.NOTIFICATION)
            .withResources(List.of(Entity.TABLE))
            .withClassName(consumerClassName)
            .withEnabled(true)
            .withBatchSize(100)
            .withPollInterval(ONE_DAY_SECONDS)
            .withDestinations(destinations);
    return stored(SdkClients.adminClient().eventSubscriptions().create(request).getId());
  }

  // Never from a cache: a test thread keeps what it read before, as any thread does.
  static EventSubscription stored(UUID alertId) {
    return AlertRows.readOrNull(alertId);
  }

  /** Writes the row as an upgrade or another product would, behind the server's back. */
  static EventSubscription writeBehindTheServer(EventSubscription alert) {
    dao().update(alert);
    EntityRepository.invalidateCacheForEntity(
        Entity.EVENT_SUBSCRIPTION, alert.getId(), alert.getFullyQualifiedName());
    return stored(alert.getId());
  }

  static boolean jobExists(UUID alertId) throws SchedulerException {
    return scheduler().checkExists(jobKey(alertId));
  }

  static JobKey jobKey(UUID alertId) {
    return new JobKey(alertId.toString(), AlertJobs.JOB_GROUP);
  }

  static TriggerKey triggerKey(UUID alertId) {
    return new TriggerKey(alertId.toString(), AlertJobs.TRIGGER_GROUP);
  }

  static String position(UUID alertId) {
    return dao().getSubscriberExtension(alertId.toString(), LedgerKeys.POSITION);
  }

  static long offsetOf(UUID alertId) {
    return JsonUtils.readValue(position(alertId), EventSubscriptionOffset.class).getCurrentOffset();
  }

  // Straight into the job store, for states no API call produces.
  static void updateTrigger(String assignment, UUID alertId) {
    Entity.getJdbi()
        .useHandle(
            handle ->
                handle.execute(
                    "UPDATE QRTZ_TRIGGERS SET " + assignment + " WHERE TRIGGER_NAME = ?",
                    alertId.toString()));
  }

  static void updateJob(String assignment, UUID alertId) {
    Entity.getJdbi()
        .useHandle(
            handle ->
                handle.execute(
                    "UPDATE QRTZ_JOB_DETAILS SET " + assignment + " WHERE JOB_NAME = ?",
                    alertId.toString()));
  }

  static Scheduler scheduler() {
    return SchedulerRepository.getInstance().lookup(EventSubscriptionScheduler.SCHEDULER_NAME);
  }

  static EventSubscriptionDAO dao() {
    return Entity.getCollectionDAO().eventSubscriptionDAO();
  }

  static EventSubscriptionRepository repository() {
    return (EventSubscriptionRepository) Entity.getEntityRepository(Entity.EVENT_SUBSCRIPTION);
  }
}
