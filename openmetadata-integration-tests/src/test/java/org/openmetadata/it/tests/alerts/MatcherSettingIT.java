package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.AlertMatcherGate;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.api.events.SetAlertMatcherMode;
import org.openmetadata.schema.entity.events.AlertMatcherMode;
import org.openmetadata.schema.entity.events.AlertMatcherSetting;
import org.openmetadata.schema.entity.events.AlertShadowReport;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.events.subscription.ledger.LedgerKeys;
import org.openmetadata.service.events.subscription.matching.AlertMatching;
import org.openmetadata.service.events.subscription.matching.MatcherModes;
import org.openmetadata.service.events.subscription.matching.ShadowReports;

/**
 * Which engine decides matching is one value for the whole cluster. The test changes it, so it
 * runs alone and puts shadow back.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class MatcherSettingIT {

  private static final String MATCHER = "/v1/events/subscriptions/matcher";
  private static final String ROW_ID = "ALERT_MATCHER_SETTING";
  private static final String ROW_KEY = "alertMatcher.setting";

  @AfterEach
  void backToShadow() {
    set(SdkClients.adminClient(), AlertType.NOTIFICATION, AlertMatcherMode.SHADOW);
    set(SdkClients.adminClient(), AlertType.OBSERVABILITY, AlertMatcherMode.SHADOW);
  }

  // Another server made the change, so this one learns of it from the row and not from the call.
  @Test
  void changeReachesEveryTickWithinThirtySeconds(TestNamespace ns) {
    EventSubscription alert = alert(ns, "follows_the_setting");
    assertEquals(AlertMatcherMode.SHADOW, AlertMatching.forTick(alert, null).mode());
    AlertMatcherSetting changedElsewhere =
        MatcherModes.read().withNotification(AlertMatcherMode.PLAN).withTimestamp(1L);

    AlertFixtures.dao()
        .upsertSubscriberExtension(
            ROW_ID, ROW_KEY, "alertMatcherSetting", JsonUtils.pojoToJson(changedElsewhere));

    Awaitility.await("a tick that opens to be decided by the plan")
        .atMost(Duration.ofSeconds(35))
        .pollInterval(Duration.ofSeconds(1))
        .until(() -> AlertMatching.forTick(alert, null).mode() == AlertMatcherMode.PLAN);
  }

  // The ingestion bot may do much, and it is still not an administrator.
  @Test
  void changeRequiresAnAdministrator() {
    OpenMetadataException refused =
        assertThrows(
            OpenMetadataException.class,
            () -> set(SdkClients.botClient(), AlertType.NOTIFICATION, AlertMatcherMode.PLAN));

    assertEquals(403, refused.getStatusCode());
    assertEquals(AlertMatcherMode.SHADOW, MatcherModes.read().getNotification());
    assertThrows(
        OpenMetadataException.class,
        () ->
            SdkClients.botClient()
                .getHttpClient()
                .executeForString(HttpMethod.GET, MATCHER + "/gate", null));
  }

  @Test
  void handWrittenAlertTypesHaveNothingToSwitch() {
    OpenMetadataException refused =
        assertThrows(
            OpenMetadataException.class,
            () -> set(SdkClients.adminClient(), AlertType.CUSTOM, AlertMatcherMode.PLAN));

    assertEquals(400, refused.getStatusCode());
  }

  // A server of the previous release refuses to start reading a settings type it does not know,
  // and its alert code reads rows by alert id. The setting is neither.
  @Test
  void previousReleaseSchemasNeverSeeTheRow() {
    set(SdkClients.adminClient(), AlertType.OBSERVABILITY, AlertMatcherMode.STORED);

    String settingsStore =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/system/settings", null);
    List<String> idsTheAlertCodeLooksAt =
        AlertFixtures.dao().listIdsHavingExtensions(LedgerKeys.all());

    assertFalse(settingsStore.toLowerCase().contains("matcher"), "nothing in the settings store");
    assertFalse(idsTheAlertCodeLooksAt.contains(ROW_ID), "and no row an alert id leads to");
    assertEquals(AlertMatcherMode.STORED, MatcherModes.read().getObservability());
  }

  @Test
  void tickAddsWhatItComparedToTheReportRowAndTheGateReadsIt(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert =
          AlertFixtures.tableAlert(
              ns,
              "compared",
              AlertPublisher.class.getName(),
              List.of(AlertFixtures.external(WEBHOOK, receiver.url("/webhook"))));
      QuietAlert.settle(alert);
      FixtureEvents.insert(FixtureEvents.tableEvents());

      DirectTick.run(alert);

      AlertShadowReport report = ShadowReports.of(alert.getId());
      assertTrue(report.getCompared() >= 3, "every event read was judged by both engines");
      assertEquals(0L, report.getDisagreements());
      assertTrue(report.getMatchedByAnEngine() >= 2);
      assertEquals(2, receiver.received().size(), "and the stored text still decided delivery");
      AlertMatcherGate[] gates =
          SdkClients.adminClient()
              .getHttpClient()
              .execute(HttpMethod.GET, MATCHER + "/gate", null, AlertMatcherGate[].class);
      assertEquals(AlertType.NOTIFICATION, gates[0].getAlertType());
      assertTrue(gates[0].getCompared() >= report.getCompared());
      assertFalse(gates[0].getPasses(), "three events are not evidence");
    }
  }

  private static void set(OpenMetadataClient client, AlertType alertType, AlertMatcherMode mode) {
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            MATCHER,
            new SetAlertMatcherMode().withAlertType(alertType).withMode(mode),
            AlertMatcherSetting.class);
  }

  private static EventSubscription alert(TestNamespace ns, String name) {
    return AlertFixtures.tableAlert(
        ns,
        name,
        AlertPublisher.class.getName(),
        List.of(AlertFixtures.external(WEBHOOK, "http://localhost:9/unused")));
  }
}
