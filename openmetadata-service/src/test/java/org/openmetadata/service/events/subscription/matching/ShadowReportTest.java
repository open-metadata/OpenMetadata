package org.openmetadata.service.events.subscription.matching;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.AlertMatcherGate;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.AlertConditionCoverage;
import org.openmetadata.schema.entity.events.AlertMatcherMode;
import org.openmetadata.schema.entity.events.AlertShadowDisagreement;
import org.openmetadata.schema.entity.events.AlertShadowReport;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.events.subscription.AlertCatalog;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.events.subscription.AlertingSettings;
import org.openmetadata.service.events.subscription.EventsSubscriptionRegistry;

/**
 * The stored condition text decides and the plan is evaluated beside it. Where a disagreement is
 * needed, the alert chooses one filter twice, which is where the two really differ: for a name
 * chosen twice today's builder stores the first choice's arguments with the last choice's effect,
 * twice over, so "created and not updated" is stored as "not created". The plan keeps both.
 */
class ShadowReportTest {

  private static final AlertingSettings DEFAULTS =
      new AlertingSettings(Duration.ofSeconds(60), false);

  @BeforeEach
  void shadowMode() {
    EventsSubscriptionRegistry.initialize(AlertCatalog.load());
    AlertingSettings.use(DEFAULTS.withMatcherMode(AlertMatcherMode.SHADOW));
  }

  @AfterEach
  void restore() {
    AlertingSettings.use(DEFAULTS);
  }

  @Test
  void disagreementIsRecordedWithEventAndAlert() {
    AlertMatching matching = AlertMatching.forTick(createdButNotUpdated(), null);
    ChangeEvent deleted = tableEvent(EventType.ENTITY_DELETED);
    matching.nextEventIsAt(41L);

    boolean decided = matching.matches(deleted);

    AlertShadowReport report = matching.tally().addedTo(null);
    AlertShadowDisagreement recorded = report.getLatestDisagreements().getFirst();
    assertTrue(decided, "the stored text decides, and what it stores is 'not created'");
    assertEquals(1L, report.getDisagreements());
    assertEquals(deleted.getId(), recorded.getEventId());
    assertEquals(41L, recorded.getOffset());
    assertEquals("table", recorded.getSubjectType());
    assertEquals("yes", recorded.getStoredText());
    assertEquals("no", recorded.getPlan());
  }

  @Test
  void agreementCountsWhatWasExercised() {
    AlertMatching matching = AlertMatching.forTick(created(), null);

    matching.matches(tableEvent(EventType.ENTITY_CREATED));
    matching.matches(tableEvent(EventType.ENTITY_UPDATED));

    AlertShadowReport report = matching.tally().addedTo(null);
    AlertConditionCoverage coverage = report.getConditions().get("filterByEventType");
    assertEquals(2L, report.getCompared());
    assertEquals(0L, report.getDisagreements());
    assertEquals(1L, report.getMatchedByAnEngine(), "both rejecting an event proves nothing");
    assertEquals(Map.of("table", 1L), report.getMatchedBySubjectType());
    assertTrue(coverage.getYes() > 0 && coverage.getNo() > 0);
  }

  // Text stored under another catalog means something else than the plan built here.
  @Test
  void definitionSavedUnderAnotherCatalogIsNotCompared() {
    EventSubscription alert = createdButNotUpdated();
    alert
        .getFilteringRules()
        .getRules()
        .getFirst()
        .setCondition("matchAnyEventType({'entityRestored'})");
    AlertMatching matching = AlertMatching.forTick(alert, null);

    matching.matches(tableEvent(EventType.ENTITY_DELETED));

    AlertShadowReport report = matching.tally().addedTo(null);
    assertEquals(1L, report.getNotComparable());
    assertEquals(0L, report.getCompared());
    assertEquals(0L, report.getDisagreements());
  }

  @Test
  void shadowStopsAfterTenSecondsInATick() {
    AtomicLong nanos = new AtomicLong();
    AlertMatching matching =
        AlertMatching.forTick(
            created(), null, () -> nanos.getAndAdd(Duration.ofSeconds(3).toNanos()));

    for (int event = 0; event < 6; event++) {
      matching.matches(tableEvent(EventType.ENTITY_CREATED));
    }

    AlertShadowReport report = matching.tally().addedTo(null);
    assertEquals(4L, report.getCompared(), "three seconds each: the fourth passes ten");
    assertEquals(2L, report.getSkipped());
  }

  @Test
  void reportKeepsTheLatestTwentyDisagreements() {
    AlertMatching matching = AlertMatching.forTick(createdButNotUpdated(), null);
    for (long offset = 1; offset <= 25; offset++) {
      matching.nextEventIsAt(offset);
      matching.matches(tableEvent(EventType.ENTITY_DELETED));
    }

    AlertShadowReport report = matching.tally().addedTo(null);

    assertEquals(25L, report.getDisagreements());
    assertEquals(20, report.getLatestDisagreements().size());
    assertEquals(25L, report.getLatestDisagreements().getLast().getOffset());
  }

  @Test
  void gateCountsOnlyEventsAnEngineMatched() {
    AlertShadowReport busyButUnexercised = exercised().withMatchedByAnEngine(12L);
    busyButUnexercised.setMatchedBySubjectType(Map.of("table", 12L));
    busyButUnexercised.setCompared(1_000_000L);

    AlertMatcherGate gate = gateWith(busyButUnexercised);

    assertFalse(gate.getPasses());
    assertEquals(List.of("table"), gate.getSourcesLackingCoverage());
    assertTrue(gateWith(exercised()).getPasses(), "the same alert, exercised, passes");
  }

  @Test
  void gateRequiresEveryUsedConditionToAnswerYesAndNo() {
    AlertShadowReport onlyEverYes = exercised();
    onlyEverYes.setConditions(
        Map.of("filterByEventType", new AlertConditionCoverage().withYes(5_000L).withNo(3L)));

    AlertMatcherGate gate = gateWith(onlyEverYes);

    assertFalse(gate.getPasses());
    assertEquals(List.of("filterByEventType"), gate.getConditionsLackingCoverage());
  }

  @Test
  void gateFailsWhileAnAlertIsNeverCompared() {
    AlertShadowReport neverCompared = new AlertShadowReport().withNotComparable(700L);
    EventSubscription another = createdButNotUpdated().withName("saved under an older catalog");

    AlertMatcherGate gate =
        MatcherGate.read(
            AlertType.NOTIFICATION,
            List.of(createdButNotUpdated(), another),
            alert -> alert == another ? neverCompared : exercised());

    assertFalse(gate.getPasses());
    assertEquals(List.of("saved under an older catalog"), gate.getAlertsNeverCompared());
  }

  @Test
  void gateFailsOnAnyDisagreement() {
    assertFalse(gateWith(exercised().withDisagreements(1L)).getPasses());
  }

  // A condition an alert uses is listed even when no report has an answer for it yet.
  @Test
  void gateEndpointListsConditionsWithoutCoverage() {
    AlertMatcherGate gate = gateWith(null);

    assertFalse(gate.getPasses());
    assertEquals(List.of("filterByEventType"), gate.getConditionsLackingCoverage());
    assertEquals(1, gate.getAlerts());
    assertEquals(AlertMatcherMode.SHADOW, gate.getMode());
  }

  private static AlertMatcherGate gateWith(AlertShadowReport report) {
    return MatcherGate.read(
        AlertType.NOTIFICATION, List.of(createdButNotUpdated()), alert -> report);
  }

  private static AlertShadowReport exercised() {
    AlertShadowReport report =
        new AlertShadowReport().withCompared(50_000L).withMatchedByAnEngine(1_000L);
    report.setMatchedBySubjectType(Map.of("table", 1_000L));
    report.setConditions(
        Map.of("filterByEventType", new AlertConditionCoverage().withYes(600L).withNo(400L)));
    return report;
  }

  private static EventSubscription created() {
    return alertWith(List.of(eventTypeIs(EventType.ENTITY_CREATED, ArgumentsInput.Effect.INCLUDE)));
  }

  // "Created" and "not updated", both through the one filter there is for event types.
  private static EventSubscription createdButNotUpdated() {
    return alertWith(
        List.of(
            eventTypeIs(EventType.ENTITY_CREATED, ArgumentsInput.Effect.INCLUDE),
            eventTypeIs(EventType.ENTITY_UPDATED, ArgumentsInput.Effect.EXCLUDE)));
  }

  private static EventSubscription alertWith(List<ArgumentsInput> filters) {
    AlertFilteringInput input = new AlertFilteringInput().withFilters(new ArrayList<>(filters));
    return new EventSubscription()
        .withId(UUID.randomUUID())
        .withName("created but not updated")
        .withAlertType(AlertType.NOTIFICATION)
        .withInput(input)
        .withFilteringRules(
            AlertUtil.validateAndBuildFilteringConditions(
                List.of("table"), AlertType.NOTIFICATION, input));
  }

  private static ArgumentsInput eventTypeIs(EventType eventType, ArgumentsInput.Effect effect) {
    return new ArgumentsInput()
        .withName("filterByEventType")
        .withEffect(effect)
        .withArguments(
            List.of(
                new Argument().withName("eventTypeList").withInput(List.of(eventType.value()))));
  }

  private static ChangeEvent tableEvent(EventType eventType) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEntityType("table")
        .withEventType(eventType)
        .withTimestamp(System.currentTimeMillis());
  }
}
