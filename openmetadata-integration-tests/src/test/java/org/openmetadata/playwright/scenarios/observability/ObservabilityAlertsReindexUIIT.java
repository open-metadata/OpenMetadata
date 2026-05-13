package org.openmetadata.playwright.scenarios.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.search.ReindexEntitiesClient;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.it.util.UiTestServer;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.playwright.ui.pages.ObservabilityAlertsPage;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Apps;

/**
 * Observability Alerts list pre/post {@code reindexEntities(recreate=true)} of the
 * alert (eventSubscription) entities. Asserts the alert table row count + visible
 * names are identical after the recreate.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "OBSERVABILITY_ALERTS", mode = ResourceAccessMode.READ_WRITE)
class ObservabilityAlertsReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void alertsListSnapshotSurvivesRecreateReindex(final UiSession ui, final TestNamespace ns)
      throws Exception {
    final OpenMetadataClient client = SdkClients.adminClient();
    final List<EventSubscription> alerts =
        List.of(
            createAlert(client, ns, "alpha"),
            createAlert(client, ns, "beta"),
            createAlert(client, ns, "gamma"));

    final ObservabilityAlertsPage before = ObservabilityAlertsPage.open(ui);
    final long countBefore = before.alertCount();
    final String snapshotBefore = before.textSnapshot();
    assertThat(countBefore).as("alert table must render some rows").isGreaterThan(0);
    before.rawPage().close();

    final List<EntityReference> refs =
        alerts.stream().map(EventSubscription::getEntityReference).toList();
    reindex.recreateAndAwait(refs);

    final ObservabilityAlertsPage after = ObservabilityAlertsPage.open(ui);
    assertThat(after.alertCount()).isEqualTo(countBefore);
    assertThat(after.textSnapshot())
        .as("alert table snapshot must equal pre-reindex")
        .isEqualTo(snapshotBefore);
  }

  private static EventSubscription createAlert(
      final OpenMetadataClient client, final TestNamespace ns, final String tag) throws Exception {
    final Webhook webhook =
        new Webhook().withEndpoint(URI.create("http://localhost:8585/api/v1/test/webhook/" + tag));
    final CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("alert_" + tag))
            .withDescription("Observability alert seed " + tag)
            .withAlertType(CreateEventSubscription.AlertType.OBSERVABILITY)
            .withResources(List.of("testCase"))
            .withEnabled(false)
            .withBatchSize(10)
            .withDestinations(
                List.of(
                    new SubscriptionDestination()
                        .withId(UUID.randomUUID())
                        .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
                        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
                        .withConfig(webhook)));
    return client.eventSubscriptions().create(request);
  }
}
