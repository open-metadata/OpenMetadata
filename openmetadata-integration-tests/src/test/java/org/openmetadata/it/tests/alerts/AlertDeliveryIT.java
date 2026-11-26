package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory.EXTERNAL;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.AlertSchedulingInfo;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.events.EventSubscriptionDiagnosticInfo;
import org.openmetadata.schema.api.events.EventsRecord;
import org.openmetadata.schema.entity.events.AlertMetrics;
import org.openmetadata.schema.entity.events.AlertType;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.Effect;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.events.EventSubscriptionService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.consumer.ledger.LedgerKeys;

/** Isolated for the same reason as the dispatch scenarios: it drives a tick over inserted events. */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class AlertDeliveryIT {

  private static final String LIVE_USER = "admin";
  private static final String ALERTS_PATH = "/v1/events/subscriptions";
  private static final int ONE_DAY_SECONDS = 86400;
  private static final String SWITCH_OFF =
      "[{\"op\":\"replace\",\"path\":\"/enabled\",\"value\":false}]";
  private static final String SWITCH_ON =
      "[{\"op\":\"replace\",\"path\":\"/enabled\",\"value\":true}]";
  private static final String DESCRIBE =
      "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"edited\"}]";

  @Test
  void mentionOfDeletedUserStillNotifiesOthers(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = createMentionAlert(ns, receiver.url("/mentions"));
      QuietAlert.settle(alert);
      String ghost = ns.prefix("ghost_user");
      ChangeEvent comment =
          conversationSaying("ping <#E::user::" + ghost + "> and <#E::user::" + LIVE_USER + ">");

      Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(comment));
      DirectTick.run(alert);

      List<RecordingReceiver.Received> received = receiver.received();
      assertEquals(1, received.size(), "the live mention must still be notified");
      assertTrue(received.getFirst().body().contains(comment.getId().toString()));
    }
  }

  // Tables and topics whose schema changed and pipelines whose run failed, in one alert. Each
  // event meets only the trigger of its own type, and a conversation meets none.
  @Test
  void multiSourceWorkedExample(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = createWorkedExample(ns, receiver.url("/webhook"));
      QuietAlert.settle(alert);
      int deliveredBefore = counters(alert).getSuccessEvents();
      Map<String, ChangeEvent> events = SampleEvents.events();
      List<String> sent =
          List.of(
              "table created",
              "table columns changed",
              "topic schema changed",
              "pipeline run failed",
              "conversation about the table");

      FixtureEvents.insert(
          sent.stream().map(label -> JsonUtils.pojoToJson(events.get(label))).toList());
      DirectTick.run(alert);

      List<String> received =
          receiver.received().stream()
              .map(request -> JsonUtils.readTree(request.body()).get("entityType").asText())
              .sorted()
              .toList();
      assertEquals(List.of("pipeline", "table", "topic"), received);
      assertEquals(3, counters(alert).getSuccessEvents() - deliveredBefore, "counters that agree");
    }
  }

  // Endpoints that route by query parameter are different addresses, and one address reached
  // through two destinations is still one.
  @Test
  void endpointsThatRouteByQueryParameterEachReceiveTheEvent(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert =
          AlertFixtures.tableAlert(
              ns,
              "routes_by_query",
              null,
              List.of(routedTo(receiver, "a"), routedTo(receiver, "b"), routedTo(receiver, "a")));
      QuietAlert.settle(alert);

      FixtureEvents.insert(
          List.of(JsonUtils.pojoToJson(SampleEvents.events().get("table created"))));
      DirectTick.run(alert);

      List<String> routes =
          receiver.received().stream().map(RecordingReceiver.Received::query).sorted().toList();
      assertEquals(List.of("route=a", "route=b"), routes);
    }
  }

  // The second patch is merged into the first one's session, so the save compares the alert with
  // the version from before it was switched off. While it is off its position row stays where it
  // stopped, and no read reports what came after it as a backlog.
  @Test
  void alertSwitchedBackOnSendsOnlyWhatHappensFromThen(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = webhookTableAlert(ns, "switched_back_on", receiver);
      QuietAlert.settle(alert);
      EventSubscriptionService alerts = SdkClients.adminClient().eventSubscriptions();
      alerts.patch(alert.getId(), JsonUtils.readTree(SWITCH_OFF));
      FixtureEvents.insert(List.of(sampleEvent("table created")));

      assertTrue(
          AlertFixtures.offsetOf(alert.getId())
              < Entity.getCollectionDAO().changeEventDAO().getLatestOffset(),
          "the position row stays behind the events written while the alert is off");
      assertNothingPending(alert);

      alerts.patch(alert.getId(), JsonUtils.readTree(SWITCH_ON));
      QuietAlert.awaitScheduledTickIsOver(alert);
      DirectTick.run(alert);
      assertEquals(0, receiver.received().size(), "nothing from while it was off");

      FixtureEvents.insert(List.of(sampleEvent("table columns changed")));
      DirectTick.run(alert);
      assertEquals(1, receiver.received().size(), "and what happens once it is on");
      assertRunning(alert);
    }
  }

  // An alert created switched off never runs, and reading it writes no position. Releases 2.0.2
  // to 2.0.x wrote one the first time its page was read, and an upgrade carries that row over.
  @Test
  void alertCreatedOffWithAPositionAnOlderReleaseWroteHasNothingPending(TestNamespace ns)
      throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = createdSwitchedOff(ns, "created_off", receiver);
      assertNothingPending(alert);
      assertNull(AlertFixtures.position(alert.getId()), "a read writes no position");

      writePositionAtTheLatestOffset(alert);
      FixtureEvents.insert(List.of(sampleEvent("table created")));
      assertNothingPending(alert);

      SdkClients.adminClient()
          .eventSubscriptions()
          .patch(alert.getId(), JsonUtils.readTree(SWITCH_ON));
      QuietAlert.awaitScheduledTickIsOver(alert);
      DirectTick.run(alert);
      assertEquals(0, receiver.received().size(), "nothing from before it was switched on");

      FixtureEvents.insert(List.of(sampleEvent("table columns changed")));
      DirectTick.run(alert);
      assertEquals(1, receiver.received().size(), "and what happens once it is on");
      assertRunning(alert);
    }
  }

  @Test
  void editOfAnAlertThatStaysOnKeepsWhatItHasNotSentYet(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = webhookTableAlert(ns, "edited_while_on", receiver);
      QuietAlert.settle(alert);
      FixtureEvents.insert(List.of(sampleEvent("table created")));

      SdkClients.adminClient()
          .eventSubscriptions()
          .patch(alert.getId(), JsonUtils.readTree(DESCRIBE));
      QuietAlert.awaitScheduledTickIsOver(alert);
      DirectTick.run(alert);

      assertEquals(1, receiver.received().size());
    }
  }

  // The calls the alert's page, its diagnostics and its scheduling view make: not running, nothing
  // it will still process, and its position as stored.
  private static void assertNothingPending(EventSubscription alert) {
    HttpClient rest = SdkClients.adminClient().getHttpClient();
    String byId = ALERTS_PATH + "/id/" + alert.getId();

    EventsRecord record =
        rest.execute(HttpMethod.GET, byId + "/eventsRecord", null, EventsRecord.class);
    assertEquals(0L, record.getPendingEventsCount());
    assertFalse(record.getEnabled());

    EventSubscriptionDiagnosticInfo diagnostics = diagnosticsOf(alert);
    assertFalse(diagnostics.getEnabled());
    assertStoredPositionReported(alert, diagnostics);
    assertEquals(0L, diagnostics.getRelevantUnprocessedEventsCount());
    assertEquals(0L, diagnostics.getTotalUnprocessedEventsCount());
    assertTrue(diagnostics.getRelevantUnprocessedEventsList().isEmpty());
    assertTrue(diagnostics.getTotalUnprocessedEventsList().isEmpty());
    assertTrue(diagnostics.getHasProcessedAllEvents());

    AlertSchedulingInfo scheduling =
        rest.execute(HttpMethod.GET, byId + "/scheduling", null, AlertSchedulingInfo.class);
    assertEquals(0L, scheduling.getLag());

    assertTrue(
        rest.execute(
            HttpMethod.GET,
            ALERTS_PATH + "/" + alert.getId() + "/processedEvents",
            null,
            Boolean.class));
  }

  private static void assertRunning(EventSubscription alert) {
    EventsRecord record =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                ALERTS_PATH + "/id/" + alert.getId() + "/eventsRecord",
                null,
                EventsRecord.class);
    assertTrue(record.getEnabled());
    EventSubscriptionDiagnosticInfo diagnostics = diagnosticsOf(alert);
    assertTrue(diagnostics.getEnabled());
    assertStoredPositionReported(alert, diagnostics);
  }

  // An alert with no position row reads as standing at the latest offset of that moment, which the
  // response's own latest offset, read just after it, can only have passed.
  private static void assertStoredPositionReported(
      EventSubscription alert, EventSubscriptionDiagnosticInfo diagnostics) {
    String stored = AlertFixtures.position(alert.getId());
    if (stored == null) {
      assertEquals(diagnostics.getStartingOffset(), diagnostics.getCurrentOffset());
      assertTrue(diagnostics.getCurrentOffset() <= diagnostics.getLatestOffset());
    } else {
      EventSubscriptionOffset position = JsonUtils.readValue(stored, EventSubscriptionOffset.class);
      assertEquals(position.getCurrentOffset(), diagnostics.getCurrentOffset());
      assertEquals(position.getStartingOffset(), diagnostics.getStartingOffset());
    }
  }

  private static EventSubscriptionDiagnosticInfo diagnosticsOf(EventSubscription alert) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            ALERTS_PATH + "/id/" + alert.getId() + "/diagnosticInfo",
            null,
            EventSubscriptionDiagnosticInfo.class);
  }

  private static EventSubscription createdSwitchedOff(
      TestNamespace ns, String name, RecordingReceiver receiver) {
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix(name))
            .withAlertType(AlertType.NOTIFICATION)
            .withResources(List.of(Entity.TABLE))
            .withEnabled(false)
            .withBatchSize(100)
            .withPollInterval(ONE_DAY_SECONDS)
            .withDestinations(List.of(AlertFixtures.external(WEBHOOK, receiver.url("/webhook"))));
    return AlertFixtures.stored(
        SdkClients.adminClient().eventSubscriptions().create(request).getId());
  }

  private static void writePositionAtTheLatestOffset(EventSubscription alert) {
    long latest = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
    long now = System.currentTimeMillis();
    EventSubscriptionOffset position =
        new EventSubscriptionOffset()
            .withCurrentOffset(latest)
            .withStartingOffset(latest)
            .withStartingTimestamp(now)
            .withTimestamp(now);
    AlertFixtures.dao()
        .upsertSubscriberExtension(
            alert.getId().toString(),
            LedgerKeys.POSITION,
            "eventSubscriptionOffset",
            JsonUtils.pojoToJson(position));
  }

  private static EventSubscription webhookTableAlert(
      TestNamespace ns, String name, RecordingReceiver receiver) {
    return AlertFixtures.tableAlert(
        ns, name, null, List.of(AlertFixtures.external(WEBHOOK, receiver.url("/webhook"))));
  }

  private static String sampleEvent(String label) {
    return JsonUtils.pojoToJson(SampleEvents.events().get(label));
  }

  private static SubscriptionDestination routedTo(RecordingReceiver receiver, String route) {
    return new SubscriptionDestination()
        .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
        .withConfig(
            new Webhook()
                .withEndpoint(URI.create(receiver.url("/routed")))
                .withQueryParams(Map.of("route", route)));
  }

  private static EventSubscription createWorkedExample(TestNamespace ns, String endpoint) {
    AlertFilteringInput triggers =
        new AlertFilteringInput()
            .withActions(
                List.of(
                    new ArgumentsInput().withName("GetTableSchemaChanges"),
                    new ArgumentsInput().withName("GetTopicSchemaChanges"),
                    new ArgumentsInput()
                        .withName("GetPipelineStatusUpdates")
                        .withArguments(
                            List.of(
                                new Argument()
                                    .withName("pipelineStateList")
                                    .withInput(List.of("failed"))))));
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("worked_example"))
            .withAlertType(AlertType.OBSERVABILITY)
            .withResources(List.of("table", "topic", "pipeline"))
            .withInput(triggers)
            .withEnabled(true)
            .withBatchSize(100)
            .withPollInterval(ONE_DAY_SECONDS)
            .withDestinations(
                List.of(
                    AlertFixtures.external(
                        SubscriptionDestination.SubscriptionType.WEBHOOK, endpoint)));
    return AlertFixtures.stored(
        SdkClients.adminClient().eventSubscriptions().create(request).getId());
  }

  private static AlertMetrics counters(EventSubscription alert) {
    String stored =
        AlertFixtures.dao().getSubscriberExtension(alert.getId().toString(), LedgerKeys.COUNTERS);
    return stored == null
        ? new AlertMetrics().withSuccessEvents(0)
        : JsonUtils.readValue(stored, AlertMetrics.class);
  }

  private static EventSubscription createMentionAlert(TestNamespace ns, String endpoint) {
    ArgumentsInput mentionsTheLiveUser =
        new ArgumentsInput()
            .withName("filterByMentionedName")
            .withEffect(Effect.INCLUDE)
            .withArguments(
                List.of(new Argument().withName("userList").withInput(List.of(LIVE_USER))));
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("mention_alert"))
            .withAlertType(AlertType.NOTIFICATION)
            .withResources(List.of(Entity.CONVERSATION))
            .withInput(new AlertFilteringInput().withFilters(List.of(mentionsTheLiveUser)))
            .withEnabled(true)
            .withBatchSize(100)
            .withPollInterval(ONE_DAY_SECONDS)
            .withDestinations(
                List.of(
                    new SubscriptionDestination()
                        .withType(WEBHOOK)
                        .withCategory(EXTERNAL)
                        .withConfig(new Webhook().withEndpoint(URI.create(endpoint)))));
    UUID id = SdkClients.adminClient().eventSubscriptions().create(request).getId();
    return Entity.getEntity(Entity.EVENT_SUBSCRIPTION, id, "*", Include.NON_DELETED);
  }

  private static ChangeEvent conversationSaying(String message) {
    UUID conversationId = UUID.randomUUID();
    Conversation conversation =
        new Conversation()
            .withId(conversationId)
            .withAbout("<#E::table::golden_service.golden_db.golden_schema.orders>")
            .withEntityRef(new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE))
            .withMessage(message);
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(EventType.ENTITY_CREATED)
        .withEntityType(Entity.CONVERSATION)
        .withEntityId(conversationId)
        .withUserName(LIVE_USER)
        .withTimestamp(System.currentTimeMillis())
        .withEntity(JsonUtils.pojoToJson(conversation));
  }
}
