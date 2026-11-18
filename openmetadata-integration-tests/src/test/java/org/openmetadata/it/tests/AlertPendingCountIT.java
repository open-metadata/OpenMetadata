package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.ArrayList;
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

  // Watches tables only, so its own creation event is not counted. It ticks once, when created,
  // and reads one event, so that tick can take only the creation event and never the backlog.
  private static EventSubscription createAlert(TestNamespace ns, String name) {
    Webhook webhook =
        new Webhook().withEndpoint(URI.create("http://localhost:8585/api/v1/test/webhook/pending"));
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix(name))
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of(Entity.TABLE))
            .withEnabled(true)
            .withBatchSize(1)
            .withPollInterval(3600)
            .withDestinations(
                List.of(
                    new SubscriptionDestination()
                        .withId(UUID.randomUUID())
                        .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
                        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
                        .withConfig(webhook)));
    EventSubscription alert = SdkClients.adminClient().eventSubscriptions().create(request);
    ns.trackRoot(Entity.EVENT_SUBSCRIPTION, alert);
    return alert;
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
