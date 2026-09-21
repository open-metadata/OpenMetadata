package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory.EXTERNAL;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.EMAIL;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.G_CHAT;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.MS_TEAMS;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.SLACK;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.AlertMatcherMode;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.subscription.AlertingSettings;
import org.openmetadata.service.events.subscription.matching.ShadowReports;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * A fixed set of change events goes through a real tick to every channel, and what the tick sent
 * and recorded is checked: three events are read, two of them are about the alert's table, and
 * each channel receives those two.
 *
 * <p>Isolated, because an alert counts every change event it reads, including another test's.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class DispatchScenariosIT {
  private static final String TABLE_FQN = "golden_service.golden_db.golden_schema.orders";
  private static final int ONE_DAY_SECONDS = 86400;
  private static final int EVERY_ROW = 1000;
  private static final int EVENTS_READ = 3;
  private static final int EVENTS_ABOUT_THE_TABLE = 2;
  private static final List<String> HTTP_CHANNELS =
      List.of("/gchat", "/slack", "/teams", "/webhook");

  @Test
  void everyChannelReceivesEachMatchingEventOnce(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = createAlert(ns, "dispatch_all_channels", everyChannel(receiver));
      QuietAlert.settle(alert);
      AlertMetrics before = counters(alert);

      FixtureEvents.insert(FixtureEvents.tableEvents());
      DirectTick.run(alert);

      assertEveryChannelDelivered(receiver, alert, before);
    }
  }

  // The plan decides what is delivered here, and what is delivered must not change.
  @Test
  void planDecidingDeliversTheSame(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = createAlert(ns, "dispatch_plan_decides", everyChannel(receiver));
      QuietAlert.settle(alert);
      AlertMetrics before = counters(alert);
      AlertingSettings.use(AlertingSettings.current().withMatcherMode(AlertMatcherMode.PLAN));

      FixtureEvents.insert(FixtureEvents.tableEvents());
      DirectTick.run(alert);

      assertEveryChannelDelivered(receiver, alert, before);
      assertEquals(0L, ShadowReports.of(alert.getId()).getDisagreements());
    } finally {
      AlertingSettings.use(new AlertingSettings(Duration.ofSeconds(60), false));
    }
  }

  // Every tick of this test stops after one event and runs again at once. What the ticks send
  // and record together must be what one tick sends and records.
  @Test
  void ticksStoppedByTheBudgetAddUpToTheSame(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = createAlert(ns, "dispatch_small_budget", everyChannel(receiver));
      QuietAlert.settle(alert);
      AlertMetrics before = counters(alert);
      long openedAt = AlertFixtures.offsetOf(alert.getId());
      AlertingSettings.use(new AlertingSettings(Duration.ofNanos(1), false));

      FixtureEvents.insert(FixtureEvents.tableEvents());
      DirectTick.run(alert);
      Awaitility.await("the ticks that run at once")
          .atMost(Duration.ofSeconds(60))
          .until(() -> AlertFixtures.offsetOf(alert.getId()) == openedAt + EVENTS_READ);
      QuietAlert.awaitScheduledTickIsOver(alert);

      assertEveryChannelDelivered(receiver, alert, before);
    } finally {
      AlertingSettings.use(new AlertingSettings(Duration.ofSeconds(60), false));
    }
  }

  // Two webhooks are one channel, so an event that fails on one of them is a failed event, and
  // the other endpoint still receives it.
  @Test
  void oneDeadEndpointFailsItsOwnDestinationOnly(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      receiver.answer("/dead", 500);
      EventSubscription alert =
          createAlert(
              ns,
              "dispatch_dead_endpoint",
              List.of(
                  AlertFixtures.external(WEBHOOK, receiver.url("/dead")),
                  AlertFixtures.external(WEBHOOK, receiver.url("/live"))));
      QuietAlert.settle(alert);
      AlertMetrics before = counters(alert);

      FixtureEvents.insert(FixtureEvents.tableEvents());
      DirectTick.run(alert);

      assertEquals(
          Map.of("/dead", (long) EVENTS_ABOUT_THE_TABLE, "/live", (long) EVENTS_ABOUT_THE_TABLE),
          sendsByPath(receiver));
      AlertMetrics after = counters(alert);
      assertEquals(EVENTS_READ, after.getTotalEvents() - before.getTotalEvents());
      assertEquals(0, after.getSuccessEvents() - before.getSuccessEvents());
      assertEquals(EVENTS_ABOUT_THE_TABLE, after.getFailedEvents() - before.getFailedEvents());
      List<JsonNode> failures = failures(alert);
      assertEquals(EVENTS_ABOUT_THE_TABLE, failures.size());
      assertTrue(
          failures.getFirst().get("reason").asText().contains("1 of 2 recipients failed"),
          failures.getFirst().toString());

      List<SubscriptionStatus> status = statusOfEachDestination(alert);
      assertEquals(SubscriptionStatus.Status.AWAITING_RETRY, status.get(0).getStatus());
      assertEquals(500, status.get(0).getLastFailedStatusCode());
      assertTrue(
          status
              .get(0)
              .getLastFailedReason()
              .startsWith("1 of 1 recipients failed. configured endpoint: "),
          status.get(0).getLastFailedReason());
      assertEquals(SubscriptionStatus.Status.ACTIVE, status.get(1).getStatus());
    }
  }

  private static void assertEveryChannelDelivered(
      RecordingReceiver receiver, EventSubscription alert, AlertMetrics before) {
    Map<String, Long> expected =
        HTTP_CHANNELS.stream()
            .collect(Collectors.toMap(path -> path, path -> (long) EVENTS_ABOUT_THE_TABLE));
    assertEquals(expected, sendsByPath(receiver));
    assertTrue(receiver.received().stream().allMatch(send -> "POST".equals(send.method())));
    assertFalse(receiver.received().stream().anyMatch(RecordingReceiver.Received::signed));
    assertTrue(bodiesOf(receiver, "/slack").allMatch(body -> body.has("blocks")));
    assertTrue(bodiesOf(receiver, "/teams").allMatch(body -> body.has("attachments")));
    assertTrue(bodiesOf(receiver, "/gchat").allMatch(body -> body.has("cardsV2")));
    assertTrue(
        bodiesOf(receiver, "/webhook")
            .allMatch(body -> TABLE_FQN.equals(body.get("entityFullyQualifiedName").asText())),
        "a webhook receives the event as it is");

    // Five channels per matching event, and the mail server that is off counts as delivered.
    AlertMetrics after = counters(alert);
    assertEquals(EVENTS_READ, after.getTotalEvents() - before.getTotalEvents());
    assertEquals(
        EVENTS_ABOUT_THE_TABLE * alert.getDestinations().size(),
        after.getSuccessEvents() - before.getSuccessEvents());
    assertEquals(0, after.getFailedEvents() - before.getFailedEvents());
    assertTrue(failures(alert).isEmpty());
    assertEquals(EVENTS_ABOUT_THE_TABLE, deliveredEvents(alert));

    List<SubscriptionStatus> status = statusOfEachDestination(alert);
    status
        .subList(0, HTTP_CHANNELS.size())
        .forEach(http -> assertEquals(SubscriptionStatus.Status.ACTIVE, http.getStatus()));
    SubscriptionStatus email = status.getLast();
    assertEquals(SubscriptionStatus.Status.FAILED, email.getStatus());
    assertTrue(
        email.getLastFailedReason().startsWith("Not attempted: the mail server is not enabled"),
        email.getLastFailedReason());
  }

  private static Map<String, Long> sendsByPath(RecordingReceiver receiver) {
    return receiver.received().stream()
        .collect(Collectors.groupingBy(RecordingReceiver.Received::path, Collectors.counting()));
  }

  private static Stream<JsonNode> bodiesOf(RecordingReceiver receiver, String path) {
    return receiver.received().stream()
        .filter(send -> path.equals(send.path()))
        .map(send -> JsonUtils.readTree(send.body()));
  }

  private static List<SubscriptionDestination> everyChannel(RecordingReceiver receiver) {
    return List.of(
        AlertFixtures.external(WEBHOOK, receiver.url("/webhook")),
        AlertFixtures.external(SLACK, receiver.url("/slack")),
        AlertFixtures.external(MS_TEAMS, receiver.url("/teams")),
        AlertFixtures.external(G_CHAT, receiver.url("/gchat")),
        new SubscriptionDestination()
            .withType(EMAIL)
            .withCategory(EXTERNAL)
            .withConfig(Map.of("receivers", Set.of("oncall@example.com"))));
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
    return AlertFixtures.stored(id);
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

  private static int deliveredEvents(EventSubscription alert) {
    return Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .getSuccessfulChangeEventBySubscriptionId(alert.getId().toString(), EVERY_ROW, 0)
        .size();
  }

  private static List<JsonNode> failures(EventSubscription alert) {
    CollectionDAO dao = Entity.getCollectionDAO();
    return dao
        .changeEventDAO()
        .listFailedEventsById(alert.getId().toString(), EVERY_ROW, 0)
        .stream()
        .map(JsonUtils::valueToTree)
        .toList();
  }

  // In the order the alert declares its destinations.
  private static List<SubscriptionStatus> statusOfEachDestination(EventSubscription alert) {
    Map<UUID, SubscriptionDestination> afterTick =
        EventSubscriptionScheduler.getInstance().listAlertDestinations(alert.getId()).stream()
            .collect(Collectors.toMap(SubscriptionDestination::getId, destination -> destination));
    return alert.getDestinations().stream()
        .map(declared -> afterTick.get(declared.getId()).getStatusDetails())
        .map(status -> JsonUtils.convertValue(status, SubscriptionStatus.class))
        .toList();
  }
}
