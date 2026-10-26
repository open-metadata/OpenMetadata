package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FailedEvent;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/** Alert event listings answer a bounded number of rows, and never the entity each event holds. */
@ExtendWith(TestNamespaceExtension.class)
class AlertListingLimitsIT {

  private static final String BASE = "/v1/events/subscriptions";
  private static final String OVER_THE_LIMIT = "1001";
  private static final String PUBLISHER = "PUBLISHER";

  @Test
  void everyListingRefusesMoreRowsThanTheLimit(TestNamespace ns) {
    EventSubscription alert = createAlert(ns, "listing_limit");

    for (String path : listingsOf(alert)) {
      OpenMetadataException refused =
          assertThrows(
              OpenMetadataException.class,
              () -> get(path, OVER_THE_LIMIT),
              path + " accepted limit=1001");
      assertEquals(400, refused.getStatusCode(), path);
    }
  }

  @Test
  void listedEventsCarryWhatTheAlertPageShowsButNotTheEntity(TestNamespace ns) throws Exception {
    EventSubscription alert = createAlert(ns, "listing_rows");
    insertFailedEvent(alert, changeEvent());
    insertDeliveredEvent(alert, changeEvent());

    String byId = BASE + "/id/" + alert.getId();
    assertChangeEventsHaveNoEntity(rows(byId + "/listSuccessfullySentChangeEvents"));
    assertChangeEventsHaveNoEntity(
        rows(byId + "/failedEvents").stream().map(row -> row.get("changeEvent")).toList());
    assertChangeEventsHaveNoEntity(
        rows(byId + "/listEvents").stream()
            .flatMap(row -> elements(row.get("data")))
            .map(data -> data.has("changeEvent") ? data.get("changeEvent") : data)
            .toList());
  }

  private static void assertChangeEventsHaveNoEntity(List<JsonNode> events) {
    assertFalse(events.isEmpty(), "the alert listed no events");
    for (JsonNode event : events) {
      assertFalse(event.has("entity"), "listed event still embeds the entity: " + event);
      assertTrue(event.has("changeDescription"), "the alert page shows the change: " + event);
      assertTrue(event.has("entityType") && event.has("eventType") && event.has("timestamp"));
    }
  }

  private static ChangeEvent changeEvent() {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(Entity.TABLE)
        .withEntityId(UUID.randomUUID())
        .withUserName("admin")
        .withTimestamp(System.currentTimeMillis())
        .withChangeDescription(new ChangeDescription().withPreviousVersion(0.1))
        .withEntity("{\"name\":\"orders\",\"description\":\"a whole entity\"}");
  }

  private static void insertFailedEvent(EventSubscription alert, ChangeEvent event) {
    FailedEvent failed =
        new FailedEvent()
            .withFailingSubscriptionId(alert.getId())
            .withChangeEvent(event)
            .withReason("receiver answered 500")
            .withTimestamp(System.currentTimeMillis());
    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .upsertFailedEvent(
            alert.getId().toString(),
            "failedEvent-" + event.getId(),
            JsonUtils.pojoToJson(failed),
            PUBLISHER);
  }

  private static void insertDeliveredEvent(EventSubscription alert, ChangeEvent event) {
    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .batchUpsertSuccessfulChangeEvents(
            List.of(event.getId().toString()),
            List.of(alert.getId().toString()),
            List.of(JsonUtils.pojoToJson(event)),
            List.of(event.getTimestamp()));
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

  private static String get(String path, String limit) {
    return SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.GET,
            path,
            null,
            RequestOptions.builder().queryParam("limit", limit).build());
  }

  private static EventSubscription createAlert(TestNamespace ns, String name) {
    Webhook webhook =
        new Webhook().withEndpoint(URI.create("http://localhost:8585/api/v1/test/webhook/test"));
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix(name))
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(true)
            .withDestinations(
                List.of(
                    new SubscriptionDestination()
                        .withId(UUID.randomUUID())
                        .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
                        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
                        .withConfig(webhook)));
    return SdkClients.adminClient().eventSubscriptions().create(request);
  }
}
