package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * The pending count on an alert's page evaluates a bounded number of unread change events, so a
 * large backlog cannot fill the heap. Isolated because it writes change events every alert reads.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class AlertPendingCountIT {

  private static final int CAP = 500;
  private static final int THREE_MEGABYTES = 3 * 1024 * 1024;

  @Test
  void aBacklogLargerThanTheCapIsShownAsALowerBound(TestNamespace ns) throws Exception {
    EventSubscription alert = createAlert(ns, "pending_cap");
    List<String> events = new ArrayList<>();
    for (int index = 0; index < CAP + 100; index++) {
      events.add(changeEvent(""));
    }
    Entity.getCollectionDAO().changeEventDAO().insertBatch(events);

    JsonNode record = eventsRecord(alert);

    assertEquals(CAP, record.get("pendingEventsCount").asInt());
    assertTrue(record.get("countsAreLowerBound").asBoolean());
  }

  @Test
  void largeEventsAreCountedOnlyUpToTheReadBudget(TestNamespace ns) throws Exception {
    EventSubscription alert = createAlert(ns, "pending_budget");
    for (int index = 0; index < 4; index++) {
      Entity.getCollectionDAO().changeEventDAO().insert(changeEvent("x".repeat(THREE_MEGABYTES)));
    }

    JsonNode record = eventsRecord(alert);

    assertTrue(record.get("pendingEventsCount").asInt() < 4, "four 3 MB events pass 8 MB");
    assertTrue(record.get("countsAreLowerBound").asBoolean());
  }

  @Test
  void aSmallBacklogIsCountedExactly(TestNamespace ns) throws Exception {
    EventSubscription alert = createAlert(ns, "pending_exact");
    List<String> events = List.of(changeEvent(""), changeEvent(""), changeEvent(""));
    Entity.getCollectionDAO().changeEventDAO().insertBatch(events);

    JsonNode record = eventsRecord(alert);

    assertEquals(3, record.get("pendingEventsCount").asInt());
    assertFalse(record.get("countsAreLowerBound").asBoolean());
  }

  // Disabled, so no tick moves its position while a test counts, and positioned after every change
  // event its setup wrote: creating it records its own event after the request returns, and the
  // count reads the first CAP unread events whether they match or not, so a setup event among them
  // would push an event of the backlog out of the count.
  private static EventSubscription createAlert(TestNamespace ns, String name) throws Exception {
    Webhook webhook =
        new Webhook().withEndpoint(URI.create("http://localhost:8585/api/v1/test/webhook/pending"));
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix(name))
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of(Entity.TABLE))
            .withEnabled(false)
            .withDestinations(
                List.of(
                    new SubscriptionDestination()
                        .withId(UUID.randomUUID())
                        .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
                        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
                        .withConfig(webhook)));
    EventSubscription alert = SdkClients.adminClient().eventSubscriptions().create(request);
    ns.trackRoot(Entity.EVENT_SUBSCRIPTION, alert);
    awaitNoNewChangeEvents();
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/events/subscriptions/name/" + alert.getFullyQualifiedName() + "/syncOffset",
            null,
            RequestOptions.builder().build());
    return alert;
  }

  private static void awaitNoNewChangeEvents() {
    long[] lastSeen = {-1L, 0L};
    Awaitility.await("change events of the setup to settle")
        .pollInterval(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(60))
        .until(() -> unchangedForFourReads(lastSeen));
  }

  private static boolean unchangedForFourReads(long[] lastSeen) {
    long latest = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
    lastSeen[1] = latest == lastSeen[0] ? lastSeen[1] + 1 : 0;
    lastSeen[0] = latest;
    return lastSeen[1] >= 4;
  }

  private static String changeEvent(String description) {
    UUID tableId = UUID.randomUUID();
    ChangeEvent event =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEventType(EventType.ENTITY_UPDATED)
            .withEntityType(Entity.TABLE)
            .withEntityId(tableId)
            .withEntityFullyQualifiedName("pending_count_service.db.schema." + tableId)
            .withUserName("admin")
            .withTimestamp(System.currentTimeMillis())
            .withEntity(Map.of("id", tableId.toString(), "description", description));
    return JsonUtils.pojoToJson(event);
  }

  private static JsonNode eventsRecord(EventSubscription alert) throws Exception {
    String path = "/v1/events/subscriptions/id/" + alert.getId() + "/eventsRecord";
    String json =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, path, null, RequestOptions.builder().build());
    return JsonUtils.readTree(json);
  }
}
