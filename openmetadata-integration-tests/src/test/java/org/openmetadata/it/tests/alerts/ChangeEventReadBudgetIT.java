package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
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

/** One tick reads change events up to a byte budget, so large events cannot fill the heap. */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class ChangeEventReadBudgetIT {

  private static final int LARGE_EVENTS = 3;
  private static final int FIVE_MEGABYTES = 5 * 1024 * 1024;

  @Test
  void eachTickReadsLargeEventsOnlyUpToItsBudgetAndDeliversThemAllInOrder(TestNamespace ns)
      throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert =
          AlertFixtures.tableAlert(
              ns,
              "read_budget",
              null,
              List.of(AlertFixtures.external(WEBHOOK, receiver.url("/webhook"))));
      QuietAlert.settle(alert);
      List<String> events = largeEvents();
      FixtureEvents.insert(events);

      List<Integer> deliveredAfterEachTick = new ArrayList<>();
      for (int tick = 0; tick < LARGE_EVENTS; tick++) {
        DirectTick.run(alert);
        deliveredAfterEachTick.add(receiver.received().size());
      }

      assertEquals(List.of(1, 2, 3), deliveredAfterEachTick, "one 5 MB event per 8 MB tick");
      for (int index = 0; index < LARGE_EVENTS; index++) {
        String id = JsonUtils.readTree(events.get(index)).get("id").asText();
        assertEquals(true, receiver.received().get(index).body().contains(id), "in order");
      }
    }
  }

  // A page of unread events holds what one read may load; the events it holds tell where the next
  // page starts.
  @Test
  void diagnosticsListsLargeUnreadEventsOnlyUpToTheReadBudget(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert =
          AlertFixtures.tableAlert(
              ns,
              "read_budget_diagnostics",
              null,
              List.of(AlertFixtures.external(WEBHOOK, receiver.url("/webhook"))));
      QuietAlert.settle(alert);
      FixtureEvents.insert(largeEvents());

      JsonNode answer =
          JsonUtils.readTree(
              SdkClients.adminClient()
                  .getHttpClient()
                  .executeForString(
                      HttpMethod.GET,
                      "/v1/events/subscriptions/id/" + alert.getId() + "/diagnosticInfo",
                      null,
                      RequestOptions.builder().queryParam("limit", "50").build()));

      assertEquals(LARGE_EVENTS, answer.get("totalUnprocessedEventsCount").asInt());
      assertEquals(1, answer.get("totalUnprocessedEventsList").size(), "one 5 MB event per 8 MB");
      assertEquals(1, answer.get("relevantUnprocessedEventsList").size(), "the same page, matched");
    }
  }

  // The described table event, each a new event whose table has a five megabyte description.
  private static List<String> largeEvents() {
    String described = FixtureEvents.tableEvents().get(1);
    List<String> events = new ArrayList<>();
    for (int index = 0; index < LARGE_EVENTS; index++) {
      ObjectNode event = (ObjectNode) JsonUtils.readTree(described);
      ObjectNode table = (ObjectNode) JsonUtils.readTree(event.get("entity").asText());
      table.put("description", "x".repeat(FIVE_MEGABYTES));
      event.put("id", UUID.randomUUID().toString());
      event.put("entity", table.toString());
      events.add(event.toString());
    }
    return events;
  }
}
