package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
import org.openmetadata.schema.api.events.AlertSchedulingInfo;
import org.openmetadata.schema.api.events.EventSubscriptionDiagnosticInfo;
import org.openmetadata.schema.api.events.EventsRecord;
import org.openmetadata.schema.entity.events.AlertEventInProgress;
import org.openmetadata.schema.entity.events.EventSubscription;
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

  // A tick whose commit fails came back all the same: only one that never does was interrupted.
  @Test
  void aTickWhoseCommitFailsIsNotInterrupted(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert =
          webhookAlert(ns, "commit_fails", FailingCommitConsumer.class.getName(), receiver);
      QuietAlert.settle(alert);
      FixtureEvents.insert(FixtureEvents.tableEvents().subList(0, 1));

      tickWhoseCommitFails(alert);

      assertNull(
          AlertFixtures.dao()
              .getSubscriberExtension(alert.getId().toString(), LedgerKeys.IN_PROGRESS));
    }
  }

  @Test
  void failedCommitsNeverSetAnEventAside(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert =
          webhookAlert(ns, "commit_recovers", FailingCommitConsumer.class.getName(), receiver);
      QuietAlert.settle(alert);
      noteInterruptedTicks(alert, 5);
      FixtureEvents.insert(FixtureEvents.tableEvents().subList(0, 1));

      tickWhoseCommitFails(alert);
      DirectTick.run(alert);

      assertTrue(failuresOf(alert).isEmpty(), "nothing is set aside as interrupted");
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

  // A consumer that makes its own work reads no change events: its counters say what it handled,
  // and the change events after its position are none of its backlog.
  @Test
  void selfDrivenAlertReportsWhatItDeliveredAndNoBacklog(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert =
          webhookAlert(ns, "self_driven", ReportingConsumer.class.getName(), receiver);
      QuietAlert.settle(alert);
      FixtureEvents.insert(FixtureEvents.tableEvents());
      ReportingConsumer.reportOnNextTick(alert.getId(), 2, 1);
      DirectTick.run(alert);

      EventSubscriptionScheduler scheduler = EventSubscriptionScheduler.getInstance();
      EventsRecord record = scheduler.getEventSubscriptionEventsRecord(alert.getId());
      assertEquals(List.of(3L, 2L, 1L, 0L), countsOf(record));
      EventSubscriptionDiagnosticInfo diagnostics =
          scheduler.getEventSubscriptionDiagnosticInfo(alert.getId(), EVERY_ROW, 0, false);
      assertEquals(2L, diagnostics.getSuccessfulEventsCount());
      assertEquals(1L, diagnostics.getFailedEventsCount());
      assertEquals(0L, diagnostics.getTotalUnprocessedEventsCount());
      assertEquals(0L, diagnostics.getRelevantUnprocessedEventsCount());
      assertTrue(diagnostics.getHasProcessedAllEvents());
      assertTrue(diagnostics.getTotalUnprocessedEventsList().isEmpty());
      assertTrue(scheduler.checkIfPublisherPublishedAllEvents(alert.getId()));
    }
  }

  // The count of relevant unprocessed events is the exact backlog, not the size of one
  // limit-bounded page. The sibling EventsRecord counts the same way; see
  // getEventSubscriptionEventsRecord. Covers the scheduler call and the public REST contract.
  @Test
  void diagnosticInfoCountsAllRelevantUnprocessedBeyondThePage(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = webhookAlert(ns, "diagnostic_count", null, receiver);
      QuietAlert.settle(alert);
      int limit = 1;
      FixtureEvents.insert(FixtureEvents.tableEvents().subList(0, 2)); // two table events

      EventSubscriptionDiagnosticInfo diagnostics =
          EventSubscriptionScheduler.getInstance()
              .getEventSubscriptionDiagnosticInfo(alert.getId(), limit, 0, false);

      assertEquals(
          2L,
          diagnostics.getRelevantUnprocessedEventsCount(),
          "relevantUnprocessedEventsCount is the exact backlog, not capped at the page limit");
      assertEquals(2L, diagnostics.getTotalUnprocessedEventsCount());
      assertEquals(limit, diagnostics.getRelevantUnprocessedEventsList().size());
      assertFalse(diagnostics.getHasProcessedAllEvents());

      // The public REST contract returns the same exact count, not a page-capped value.
      String body =
          SdkClients.adminClient()
              .getHttpClient()
              .executeForString(
                  HttpMethod.GET,
                  "/v1/events/subscriptions/id/" + alert.getId() + "/diagnosticInfo?limit=" + limit,
                  null,
                  RequestOptions.builder().build());
      JsonNode answer = JsonUtils.readTree(body);
      assertEquals(
          2L,
          answer.get("relevantUnprocessedEventsCount").asLong(),
          "the REST endpoint reports the exact backlog, not the page limit");
      assertEquals(limit, answer.path("relevantUnprocessedEventsList").size());

      // listCountOnly=true returns the exact count with a null list, as the schema describes.
      String countOnly =
          SdkClients.adminClient()
              .getHttpClient()
              .executeForString(
                  HttpMethod.GET,
                  "/v1/events/subscriptions/id/"
                      + alert.getId()
                      + "/diagnosticInfo?limit="
                      + limit
                      + "&listCountOnly=true",
                  null,
                  RequestOptions.builder().build());
      JsonNode countOnlyAnswer = JsonUtils.readTree(countOnly);
      assertEquals(2L, countOnlyAnswer.get("relevantUnprocessedEventsCount").asLong());
      JsonNode countOnlyList = countOnlyAnswer.path("relevantUnprocessedEventsList");
      assertTrue(
          countOnlyList.isMissingNode() || countOnlyList.isNull() || countOnlyList.isEmpty(),
          "listCountOnly=true returns no list content, just the exact count");
    }
  }

  @Test
  void schedulingOfASelfDrivenAlertShowsNoLag(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert =
          webhookAlert(ns, "self_driven_scheduling", ReportingConsumer.class.getName(), receiver);
      QuietAlert.settle(alert);
      FixtureEvents.insert(FixtureEvents.tableEvents());

      AlertSchedulingInfo answer =
          EventSubscriptionScheduler.getInstance().getSchedulingInfo(alert.getId());

      assertEquals(0L, answer.getLag());
      assertEquals(answer.getLatestOffset(), answer.getCurrentOffset());
    }
  }

  private static List<Long> countsOf(EventsRecord record) {
    return List.of(
        record.getTotalEventsCount(),
        record.getSuccessfulEventsCount(),
        record.getFailedEventsCount(),
        record.getPendingEventsCount());
  }

  private static EventSubscription webhookAlert(
      TestNamespace ns, String name, String className, RecordingReceiver receiver) {
    return AlertFixtures.tableAlert(
        ns, name, className, List.of(AlertFixtures.external(WEBHOOK, receiver.url("/webhook"))));
  }

  // The failure is the commit's, and it still reaches the caller.
  private static void tickWhoseCommitFails(EventSubscription alert) {
    FailingCommitConsumer.fail(alert.getId());
    try {
      assertThrows(IllegalStateException.class, () -> DirectTick.run(alert));
    } finally {
      FailingCommitConsumer.recover(alert.getId());
    }
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
    return AlertFixtures.offsetOf(alert.getId());
  }

  private static List<FailedEventResponse> failuresOf(EventSubscription alert) {
    return Entity.getCollectionDAO()
        .changeEventDAO()
        .listFailedEventsById(alert.getId().toString(), EVERY_ROW, 0);
  }
}
