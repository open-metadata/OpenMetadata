package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.SLACK;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.EventsRecord;
import org.openmetadata.schema.entity.events.AlertEventInProgress;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.FailedEventResponse;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.subscription.ledger.LedgerKeys;

/** What one tick records, for the cases today's code could not reach. */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class AlertTickOutcomesIT {

  private static final int EVERY_ROW = 100;

  @Test
  void twoFailingDestinationsAreBothNamed(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      receiver.answer("/webhook", 500);
      receiver.answer("/slack", 503);
      EventSubscription alert =
          AlertFixtures.tableAlert(
              ns,
              "two_failing",
              null,
              List.of(
                  AlertFixtures.external(WEBHOOK, receiver.url("/webhook")),
                  AlertFixtures.external(SLACK, receiver.url("/slack"))));
      QuietAlert.settle(alert);

      FixtureEvents.insert(FixtureEvents.tableEvents().subList(0, 1));
      DirectTick.run(alert);

      List<FailedEventResponse> failures = failuresOf(alert);
      assertEquals(1, failures.size(), "one failure row per event and alert");
      String reason = failures.getFirst().getReason();
      assertTrue(reason.contains("Webhook") && reason.contains("Slack"), reason);
    }
  }

  @Test
  void eventWithDeliveredAndFailureRowsCountsOnce(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      receiver.answer("/slack", 500);
      EventSubscription alert =
          AlertFixtures.tableAlert(
              ns,
              "partly_failed",
              null,
              List.of(
                  AlertFixtures.external(WEBHOOK, receiver.url("/webhook")),
                  AlertFixtures.external(SLACK, receiver.url("/slack"))));
      QuietAlert.settle(alert);

      FixtureEvents.insert(FixtureEvents.tableEvents().subList(0, 1));
      DirectTick.run(alert);

      EventsRecord record =
          EventSubscriptionScheduler.getInstance().getEventSubscriptionEventsRecord(alert.getId());
      assertEquals(1, record.getSuccessfulEventsCount());
      assertEquals(1, record.getFailedEventsCount());
      assertEquals(1, record.getTotalEventsCount() - record.getPendingEventsCount());
    }
  }

  @Test
  void eventThatInterruptsSixTicksIsSetAside(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = webhookAlert(ns, "set_aside", null, receiver);
      QuietAlert.settle(alert);
      noteInterruptedTicks(alert, 6);

      FixtureEvents.insert(FixtureEvents.tableEvents().subList(0, 2));
      DirectTick.run(alert);

      assertEquals(1, receiver.received().size(), "the event after the one set aside is sent");
      List<FailedEventResponse> failures = failuresOf(alert);
      assertEquals(1, failures.size());
      assertTrue(failures.getFirst().getReason().contains("Interrupted repeatedly"));
    }
  }

  @Test
  void interruptedTicksCommitAfterEveryEvent(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert =
          webhookAlert(ns, "commit_each", LatchedConsumer.class.getName(), receiver);
      QuietAlert.settle(alert);
      long openedAt = positionOf(alert);
      noteInterruptedTicks(alert, 3);
      LatchedConsumer.Gate beforeTheSecondEvent = LatchedConsumer.arm(alert.getId(), 2);
      try {
        FixtureEvents.insert(FixtureEvents.tableEvents().subList(0, 2));
        Thread tick = new Thread(() -> DirectTick.run(alert), "careful-tick");
        tick.start();
        assertTrue(beforeTheSecondEvent.awaitReached());

        assertEquals(openedAt + 1, positionOf(alert), "the first event is already committed");

        beforeTheSecondEvent.open();
        tick.join(60_000L);
      } finally {
        LatchedConsumer.disarm(alert.getId());
      }
      assertEquals(openedAt + 2, positionOf(alert));
    }
  }

  @Test
  void schedulingEndpointAnswersWithTriggerStateAndLag(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = webhookAlert(ns, "scheduling", null, receiver);
      QuietAlert.settle(alert);
      FixtureEvents.insert(FixtureEvents.tableEvents());

      String body =
          SdkClients.adminClient()
              .getHttpClient()
              .executeForString(
                  HttpMethod.GET,
                  "/v1/events/subscriptions/id/" + alert.getId() + "/scheduling",
                  null,
                  RequestOptions.builder().build());

      JsonNode answer = JsonUtils.readTree(body);
      assertEquals("NORMAL", answer.get("triggerState").asText());
      assertTrue(answer.get("jobClass").asText().endsWith("AlertPublisher"));
      assertTrue(answer.get("lag").asLong() >= 3);
    }
  }

  private static EventSubscription webhookAlert(
      TestNamespace ns, String name, String className, RecordingReceiver receiver) {
    return AlertFixtures.tableAlert(
        ns, name, className, List.of(AlertFixtures.external(WEBHOOK, receiver.url("/webhook"))));
  }

  private static void noteInterruptedTicks(EventSubscription alert, int attempts) {
    AlertEventInProgress note =
        new AlertEventInProgress()
            .withOffset(positionOf(alert))
            .withAttempts(attempts)
            .withTimestamp(System.currentTimeMillis());
    AlertFixtures.dao()
        .upsertSubscriberExtension(
            alert.getId().toString(),
            LedgerKeys.IN_PROGRESS,
            "alertEventInProgress",
            JsonUtils.pojoToJson(note));
  }

  private static long positionOf(EventSubscription alert) {
    return JsonUtils.readValue(AlertFixtures.position(alert.getId()), EventSubscriptionOffset.class)
        .getCurrentOffset();
  }

  private static List<FailedEventResponse> failuresOf(EventSubscription alert) {
    return Entity.getCollectionDAO()
        .changeEventDAO()
        .listFailedEventsById(alert.getId().toString(), EVERY_ROW, 0);
  }
}
