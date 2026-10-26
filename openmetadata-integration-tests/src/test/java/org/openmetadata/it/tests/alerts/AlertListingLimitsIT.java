package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.ApiAssertions.assertBadRequest;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/** Alert event listings answer a bounded number of rows, and never the entity each event holds. */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class AlertListingLimitsIT {

  private static final String BASE = "/v1/events/subscriptions";
  private static final String OVER_THE_LIMIT = "1001";

  @Test
  void everyListingRefusesMoreRowsThanTheLimit(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = webhookAlert(ns, "listing_limit", receiver);

      for (String path : listingsOf(alert)) {
        assertBadRequest(() -> get(path, OVER_THE_LIMIT), path + " accepted limit=1001");
      }
    }
  }

  @Test
  void listedEventsCarryWhatTheAlertPageShowsButNotTheEntity(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      receiver.answer("/failing", 500);
      EventSubscription delivered = webhookAlert(ns, "listing_delivered", receiver);
      EventSubscription failed = webhookAlert(ns, "listing_failed", receiver, "/failing");
      QuietAlert.settle(delivered);
      QuietAlert.settle(failed);

      FixtureEvents.insert(FixtureEvents.tableEvents().subList(1, 2));
      DirectTick.run(delivered);
      DirectTick.run(failed);

      assertChangeEventsHaveNoEntity(
          rows(BASE + "/id/" + delivered.getId() + "/listSuccessfullySentChangeEvents"));
      assertChangeEventsHaveNoEntity(failedChangeEvents(failed));
      assertChangeEventsHaveNoEntity(typedEventData(delivered));
      assertChangeEventsHaveNoEntity(typedEventData(failed));
    }
  }

  private static void assertChangeEventsHaveNoEntity(List<JsonNode> events) {
    assertFalse(events.isEmpty(), "the alert listed no events");
    for (JsonNode event : events) {
      assertFalse(event.has("entity"), "listed event still embeds the entity: " + event);
      assertTrue(event.has("changeDescription"), "the alert page shows the change: " + event);
      assertTrue(event.has("entityType") && event.has("eventType") && event.has("timestamp"));
    }
  }

  private static List<JsonNode> failedChangeEvents(EventSubscription alert) throws Exception {
    return rows(BASE + "/id/" + alert.getId() + "/failedEvents").stream()
        .map(row -> row.get("changeEvent"))
        .toList();
  }

  private static List<JsonNode> typedEventData(EventSubscription alert) throws Exception {
    return rows(BASE + "/id/" + alert.getId() + "/listEvents").stream()
        .flatMap(row -> elements(row.get("data")))
        .map(AlertListingLimitsIT::changeEventOf)
        .toList();
  }

  // A failed row wraps its change event; a delivered row is the change event itself.
  private static JsonNode changeEventOf(JsonNode data) {
    return data.has("changeEvent") ? data.get("changeEvent") : data;
  }

  private static List<String> listingsOf(EventSubscription alert) {
    String byId = BASE + "/id/" + alert.getId();
    String byName = BASE + "/name/" + alert.getFullyQualifiedName();
    return List.of(
        byId + "/listEvents",
        byId + "/diagnosticInfo",
        byName + "/diagnosticInfo",
        byId + "/failedEvents",
        byName + "/failedEvents",
        BASE + "/listAllFailedEvents",
        byId + "/listSuccessfullySentChangeEvents",
        byName + "/listSuccessfullySentChangeEvents");
  }

  private static List<JsonNode> rows(String path) throws Exception {
    JsonNode answer = JsonUtils.readTree(get(path, "50"));
    return elements(answer.has("data") ? answer.get("data") : answer).toList();
  }

  private static Stream<JsonNode> elements(JsonNode array) {
    return StreamSupport.stream(array.spliterator(), false);
  }

  private static String get(String path, String limit) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.GET,
            path,
            null,
            RequestOptions.builder().queryParam("limit", limit).build());
  }

  private static EventSubscription webhookAlert(
      TestNamespace ns, String name, RecordingReceiver receiver) {
    return webhookAlert(ns, name, receiver, "/webhook");
  }

  private static EventSubscription webhookAlert(
      TestNamespace ns, String name, RecordingReceiver receiver, String path) {
    return AlertFixtures.tableAlert(
        ns, name, null, List.of(AlertFixtures.external(WEBHOOK, receiver.url(path))));
  }
}
