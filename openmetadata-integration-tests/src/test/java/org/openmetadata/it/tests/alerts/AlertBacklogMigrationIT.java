package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory.EXTERNAL;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.EMAIL;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;
import org.openmetadata.service.migration.utils.v210.AlertBacklogMigration;

/**
 * The upgrade to the release where one destination costs only itself. An alert the previous
 * release stopped sending, because it could not build one of its destinations, sends again from
 * the upgrade on, not from the changes retained since it stopped.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class AlertBacklogMigrationIT {

  @Test
  void anAlertThePreviousReleaseCouldNotSendStartsFromTheUpgrade(TestNamespace ns) {
    EventSubscription unknownField =
        storedWith(
            ns,
            "unknown_field",
            destination(
                EMAIL, Map.of("receivers", List.of("a@example.com"), "httpMethod", "POST")));
    EventSubscription refusedEndpoint =
        storedWith(ns, "refused_endpoint", destination(WEBHOOK, Map.of("endpoint", "ftp://x.io")));
    EventSubscription healthy =
        storedWith(
            ns, "healthy", destination(WEBHOOK, Map.of("endpoint", "http://localhost:9/unused")));
    EventSubscription disabled = createdDisabled(ns);
    FixtureEvents.insert(FixtureEvents.tableEvents());
    long latest = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();

    AlertBacklogMigration.skipBacklogOfAlertsThePreviousReleaseCouldNotSend(
        Entity.getCollectionDAO());

    assertEquals(latest, AlertFixtures.offsetOf(unknownField.getId()));
    assertEquals(latest, AlertFixtures.offsetOf(refusedEndpoint.getId()));
    assertTrue(AlertFixtures.offsetOf(healthy.getId()) < latest, "a healthy alert keeps its place");
    assertFalse(AlertRecord.hasRows(disabled.getId()), "a disabled alert is left as it is");
  }

  private static EventSubscription storedWith(
      TestNamespace ns, String name, SubscriptionDestination destination) {
    EventSubscription alert =
        AlertFixtures.tableAlert(
            ns, name, null, List.of(AlertFixtures.external(WEBHOOK, "http://localhost:9/unused")));
    QuietAlert.settle(alert);
    return AlertFixtures.writeBehindTheServer(alert.withDestinations(List.of(destination)));
  }

  private static EventSubscription createdDisabled(TestNamespace ns) {
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("disabled"))
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of(Entity.TABLE))
            .withEnabled(false)
            .withPollInterval(86400)
            .withDestinations(
                List.of(AlertFixtures.external(WEBHOOK, "http://localhost:9/unused")));
    EventSubscription alert =
        AlertFixtures.stored(SdkClients.adminClient().eventSubscriptions().create(request).getId());
    return AlertFixtures.writeBehindTheServer(
        alert.withDestinations(
            List.of(destination(WEBHOOK, Map.of("endpoint", "ftp://disabled.io")))));
  }

  private static SubscriptionDestination destination(
      SubscriptionDestination.SubscriptionType type, Map<String, Object> config) {
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(type)
        .withCategory(EXTERNAL)
        .withEnabled(true)
        .withConfig(config);
  }
}
