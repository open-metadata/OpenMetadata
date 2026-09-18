package org.openmetadata.it.tests.alerts;

import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory.EXTERNAL;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.EMAIL;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.G_CHAT;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.MS_TEAMS;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.SLACK;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.subscription.AlertingSettings;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * The no-regression corpus for dispatch: a fixed set of change events goes through a real tick,
 * and everything the tick produces is compared with checked-in files. The files were generated
 * from the code this work started from, so any difference is either a named change or a
 * regression.
 *
 * <p>Isolated, because an alert counts every change event it reads, including another test's.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class GoldenDispatchCorpusTest {

  private static final String TABLE_FQN = "golden_service.golden_db.golden_schema.orders";
  private static final int ONE_DAY_SECONDS = 86400;
  private static final int EVERY_ROW = 1000;
  private static final Path TABLE_EVENTS =
      Path.of("src", "test", "resources", "golden", "dispatch", "fixtures", "table-events.json");

  @Test
  void countersMatchGoldenFiles(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = createAlert(ns, "golden_all_channels", everyChannel(receiver));
      QuietAlert.settle(alert);
      AlertMetrics before = counters(alert);

      insert(tableEvents());
      DirectTick.run(alert);

      GoldenFiles golden = goldenFor(alert, receiver);
      golden.assertMatches("all-channels.sends", sends(receiver, golden));
      golden.assertMatches("all-channels.record", record(alert, before));
    }
  }

  // Every tick of this test stops after one event and runs again at once. What the ticks send
  // and record together must be what the single tick above sends and records.
  @Test
  void ticksStoppedByTheBudgetAddUpToTheSameGoldenFiles(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = createAlert(ns, "golden_small_budget", everyChannel(receiver));
      QuietAlert.settle(alert);
      AlertMetrics before = counters(alert);
      long openedAt = AlertFixtures.offsetOf(alert.getId());
      List<String> events = tableEvents();
      AlertingSettings.use(new AlertingSettings(Duration.ofNanos(1), false));

      insert(events);
      DirectTick.run(alert);
      Awaitility.await("the ticks that run at once")
          .atMost(Duration.ofSeconds(60))
          .until(() -> AlertFixtures.offsetOf(alert.getId()) == openedAt + events.size());
      QuietAlert.awaitScheduledTickIsOver(alert);

      GoldenFiles golden = goldenFor(alert, receiver);
      golden.assertMatches("all-channels.sends", sends(receiver, golden));
      golden.assertMatches("all-channels.record", record(alert, before));
    } finally {
      AlertingSettings.use(new AlertingSettings(Duration.ofSeconds(60), false));
    }
  }

  @Test
  void oneDeadEndpointMatchesGoldenFiles(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      receiver.answer("/dead", 500);
      EventSubscription alert = createAlert(ns, "golden_dead_endpoint", deadAndLive(receiver));
      QuietAlert.settle(alert);
      AlertMetrics before = counters(alert);

      insert(tableEvents());
      DirectTick.run(alert);

      GoldenFiles golden = goldenFor(alert, receiver);
      golden.assertMatches("dead-endpoint.sends", sends(receiver, golden));
      golden.assertMatches("dead-endpoint.record", record(alert, before));
    }
  }

  private static List<SubscriptionDestination> everyChannel(RecordingReceiver receiver) {
    return List.of(
        external(WEBHOOK, receiver.url("/webhook")),
        external(SLACK, receiver.url("/slack")),
        external(MS_TEAMS, receiver.url("/teams")),
        external(G_CHAT, receiver.url("/gchat")),
        new SubscriptionDestination()
            .withType(EMAIL)
            .withCategory(EXTERNAL)
            .withConfig(Map.of("receivers", Set.of("oncall@example.com"))));
  }

  private static List<SubscriptionDestination> deadAndLive(RecordingReceiver receiver) {
    return List.of(
        external(WEBHOOK, receiver.url("/dead")), external(WEBHOOK, receiver.url("/live")));
  }

  private static SubscriptionDestination external(
      SubscriptionDestination.SubscriptionType type, String endpoint) {
    return new SubscriptionDestination()
        .withType(type)
        .withCategory(EXTERNAL)
        .withConfig(new Webhook().withEndpoint(URI.create(endpoint)));
  }

  private static EventSubscription createAlert(
      TestNamespace ns, String name, List<SubscriptionDestination> destinations) {
    ArgumentsInput onlyTheFixtureTable =
        new ArgumentsInput()
            .withName("filterByFqn")
            .withEffect(ArgumentsInput.Effect.INCLUDE)
            .withArguments(
                List.of(new Argument().withName("fqnList").withInput(List.of(TABLE_FQN))));
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix(name))
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of(Entity.TABLE))
            .withInput(new AlertFilteringInput().withFilters(List.of(onlyTheFixtureTable)))
            .withEnabled(true)
            .withBatchSize(100)
            .withPollInterval(ONE_DAY_SECONDS)
            .withDestinations(destinations);
    UUID id = SdkClients.adminClient().eventSubscriptions().create(request).getId();
    return Entity.getEntity(Entity.EVENT_SUBSCRIPTION, id, "*", Include.NON_DELETED);
  }

  private static AlertMetrics counters(EventSubscription alert) {
    String stored =
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .getSubscriberExtension(
                alert.getId().toString(), AbstractEventConsumer.METRICS_EXTENSION);
    return stored == null
        ? new AlertMetrics().withTotalEvents(0).withSuccessEvents(0).withFailedEvents(0)
        : JsonUtils.readValue(stored, AlertMetrics.class);
  }

  private static Map<String, Integer> countedByThisTick(AlertMetrics before, AlertMetrics after) {
    Map<String, Integer> counted = new LinkedHashMap<>();
    counted.put("totalEvents", after.getTotalEvents() - before.getTotalEvents());
    counted.put("successEvents", after.getSuccessEvents() - before.getSuccessEvents());
    counted.put("failedEvents", after.getFailedEvents() - before.getFailedEvents());
    return counted;
  }

  // Literal JSON, so a fixture never changes because a generated class gained a default.
  private static List<String> tableEvents() throws IOException {
    List<String> events = new ArrayList<>();
    for (JsonNode event : JsonUtils.readTree(Files.readString(TABLE_EVENTS))) {
      events.add(event.toString());
    }
    return events;
  }

  private static void insert(List<String> events) {
    CollectionDAO dao = Entity.getCollectionDAO();
    events.forEach(event -> dao.changeEventDAO().insert(event));
  }

  private static GoldenFiles goldenFor(EventSubscription alert, RecordingReceiver receiver) {
    GoldenFiles golden =
        new GoldenFiles()
            .token(alert.getId().toString(), "alert")
            .token(alert.getName(), "alert-name")
            .token(String.valueOf(receiver.port()), "port");
    int position = 0;
    for (SubscriptionDestination destination : alert.getDestinations()) {
      golden.token(destination.getId().toString(), "destination-" + position++);
    }
    return golden;
  }

  // Sorted, so the files do not depend on the order channels are walked in.
  private static List<Map<String, Object>> sends(RecordingReceiver receiver, GoldenFiles golden)
      throws IOException {
    List<Map<String, Object>> sends = new ArrayList<>();
    for (RecordingReceiver.Received request : receiver.received()) {
      Map<String, Object> send = new LinkedHashMap<>();
      send.put("path", request.path());
      send.put("method", request.method());
      send.put("signed", request.signed());
      send.put("body", golden.parse(request.body()));
      sends.add(send);
    }
    sends.sort(Comparator.comparing(send -> send.get("path") + "|" + send.get("body")));
    return sends;
  }

  private static Map<String, Object> record(EventSubscription alert, AlertMetrics before) {
    CollectionDAO dao = Entity.getCollectionDAO();
    String alertId = alert.getId().toString();
    Map<String, Object> record = new LinkedHashMap<>();
    record.put("counters", countedByThisTick(before, counters(alert)));
    record.put("deliveredEventIds", deliveredEventIds(dao, alertId));
    record.put("failures", failures(dao, alertId));
    record.put("destinationStatus", destinationStatus(alert));
    return record;
  }

  private static List<String> deliveredEventIds(CollectionDAO dao, String alertId) {
    return dao
        .eventSubscriptionDAO()
        .getSuccessfulChangeEventBySubscriptionId(alertId, EVERY_ROW, 0)
        .stream()
        .map(row -> JsonUtils.readValue(row, ChangeEvent.class).getId().toString())
        .sorted()
        .toList();
  }

  private static List<JsonNode> failures(CollectionDAO dao, String alertId) {
    return dao.changeEventDAO().listFailedEventsById(alertId, EVERY_ROW, 0).stream()
        .map(JsonUtils::valueToTree)
        .sorted(Comparator.comparing(JsonNode::toString))
        .toList();
  }

  private static List<Map<String, Object>> destinationStatus(EventSubscription alert) {
    List<SubscriptionDestination> afterTick =
        EventSubscriptionScheduler.getInstance().listAlertDestinations(alert.getId());
    List<Map<String, Object>> status = new ArrayList<>();
    for (SubscriptionDestination destination : afterTick) {
      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("destination", destination.getId().toString());
      entry.put("status", destination.getStatusDetails());
      status.add(entry);
    }
    return status;
  }
}
