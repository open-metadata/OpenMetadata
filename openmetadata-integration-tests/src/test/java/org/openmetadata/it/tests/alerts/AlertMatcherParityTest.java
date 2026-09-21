package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.AlertCatalogSource;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.service.events.subscription.AlertCatalog;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.events.subscription.EventsSubscriptionRegistry;
import org.openmetadata.service.events.subscription.matching.ConditionEvaluator;
import org.openmetadata.service.events.subscription.matching.MatchingPlan;
import org.openmetadata.service.events.subscription.matching.PlanMatcher;

/**
 * Does this event belong to this alert? The answers of the code this work started from, for every
 * alert of the corpus and every event, are kept in a file, so whatever decides matching later has
 * something to agree with that cannot drift along with it.
 */
class AlertMatcherParityTest {

  @Test
  void planAgreesWithStoredTextForEveryCatalogEntry() {
    Map<String, ChangeEvent> events = MatchingCorpus.events();
    List<String> disagreements = new ArrayList<>();
    for (MatchingCorpus.Case alert : MatchingCorpus.cases()) {
      String storedText = answersOfStoredText(alert, events);
      String plan = answersOfThePlan(alertOf(alert), events);
      if (!storedText.equals(plan)) {
        disagreements.add(
            alert.key() + "\n  stored text: " + storedText + "\n  plan:        " + plan);
      }
    }
    assertEquals(List.of(), disagreements);
  }

  // "Failed" together with "failed in suite X" means failures in suite X, in one group.
  @Test
  void triggerPairsKeepTheirMeaning() {
    Map<String, ChangeEvent> events = MatchingCorpus.events();
    int pairs = 0;
    for (AlertCatalogSource source : AlertCatalog.load().sourcesOf(AlertType.OBSERVABILITY)) {
      List<EventFilterRule> triggers =
          EventsSubscriptionRegistry.getObservabilityDescriptor(source.getName())
              .getSupportedActions();
      for (EventFilterRule first : triggers) {
        for (EventFilterRule second : otherThan(first, triggers)) {
          for (ArgumentsInput.Effect effect : ArgumentsInput.Effect.values()) {
            AlertFilteringInput input =
                new AlertFilteringInput()
                    .withActions(
                        List.of(
                            MatchingCorpus.selection(first, ArgumentsInput.Effect.INCLUDE),
                            MatchingCorpus.selection(second, effect)));
            assertBothEnginesAgree(
                new MatchingCorpus.Case(
                    source.getName() + " " + first.getName() + " + " + second.getName(),
                    AlertType.OBSERVABILITY,
                    source.getName(),
                    input),
                events);
            pairs++;
          }
        }
      }
    }
    assertTrue(pairs >= 8, "too few pairs to mean anything: " + pairs);
  }

  // A user has no owners, so "owner is not X" says nothing against it.
  @Test
  void excludeOwnerFilterOnAllStillDeliversUserEvents() {
    MatchingCorpus.Case alert =
        caseWith(AlertType.NOTIFICATION, "all", "filterByOwnerName", ArgumentsInput.Effect.EXCLUDE);
    ChangeEvent userCreated = MatchingCorpus.events().get("user created");

    assertEquals("yes", answerOfStoredText(alert, userCreated));
    assertEquals("yes", answerOfThePlan(alertOf(alert), userCreated));
  }

  // The forms never offer it and compiled text has always joined with AND.
  @Test
  void orPrefixConditionIsIgnored() {
    FilterResourceDescriptor table =
        EventsSubscriptionRegistry.getEntityNotificationDescriptor("table");
    ArgumentsInput ownedByAdmin =
        MatchingCorpus.selection(
            definition(table, "filterByOwnerName"), ArgumentsInput.Effect.INCLUDE);
    ArgumentsInput orCreated =
        MatchingCorpus.selection(
                definition(table, "filterByEventType"), ArgumentsInput.Effect.INCLUDE)
            .withPrefixCondition(ArgumentsInput.PrefixCondition.OR);
    MatchingCorpus.Case alert =
        new MatchingCorpus.Case(
            "owner OR created",
            AlertType.NOTIFICATION,
            "table",
            new AlertFilteringInput().withFilters(List.of(ownedByAdmin, orCreated)));
    ChangeEvent ownedButUpdated = MatchingCorpus.events().get("table described by a bot");

    assertEquals("no", answerOfStoredText(alert, ownedButUpdated));
    assertEquals("no", answerOfThePlan(alertOf(alert), ownedButUpdated));
  }

  // Only the first source used to route conversations, so one about the second was missed.
  @Test
  void routingConsidersEverySource() {
    EventSubscription tablesAndTopics =
        new EventSubscription()
            .withName("tables and topics")
            .withAlertType(AlertType.NOTIFICATION)
            .withFilteringRules(
                new FilteringRules()
                    .withResources(List.of("table", "topic"))
                    .withRules(List.of())
                    .withActions(List.of()));
    Map<String, ChangeEvent> events = MatchingCorpus.events();

    for (String label :
        List.of("conversation about the topic", "topic schema changed", "table created")) {
      ChangeEvent event = events.get(label);
      assertEquals(
          "yes",
          answerOf(
              () ->
                  AlertUtil.checkIfChangeEventIsAllowed(
                      event, tablesAndTopics.getFilteringRules())),
          label);
      assertEquals("yes", answerOfThePlan(tablesAndTopics, event), label);
    }
    assertEquals("no", answerOfThePlan(tablesAndTopics, events.get("pipeline run failed")));
  }

  // A conversation is not a change event, so it meets no group of triggers, excluded ones included.
  @Test
  void conversationNeverMeetsTriggers() {
    MatchingCorpus.Case alert =
        new MatchingCorpus.Case(
            "schema did not change",
            AlertType.OBSERVABILITY,
            "table",
            new AlertFilteringInput()
                .withActions(
                    List.of(
                        MatchingCorpus.selection(
                            definitionOfTrigger("table", "GetTableSchemaChanges"),
                            ArgumentsInput.Effect.EXCLUDE))));
    ChangeEvent aboutTheTable = MatchingCorpus.events().get("conversation about the table");

    assertEquals("no", answerOfStoredText(alert, aboutTheTable));
    assertEquals("no", answerOfThePlan(alertOf(alert), aboutTheTable));
  }

  // One name chosen twice is not a pair: today's builder keeps only the last choice of a name,
  // twice over, which the plan does not imitate and the shadow report exists to surface.
  private static List<EventFilterRule> otherThan(EventFilterRule one, List<EventFilterRule> all) {
    return all.stream().filter(rule -> !rule.getName().equals(one.getName())).toList();
  }

  // The grouped text is what a server of the previous release evaluates, with today's code.
  @Test
  void groupedTextMatchesThePlanForTheWorkedExample() {
    AlertFilteringInput triggers =
        new AlertFilteringInput()
            .withActions(
                List.of(
                    MatchingCorpus.selection(
                        definitionOfTrigger("table", "GetTableSchemaChanges"),
                        ArgumentsInput.Effect.INCLUDE),
                    MatchingCorpus.selection(
                        definitionOfTrigger("topic", "GetTopicSchemaChanges"),
                        ArgumentsInput.Effect.EXCLUDE),
                    MatchingCorpus.selection(
                        definitionOfTrigger("pipeline", "GetPipelineStatusUpdates"),
                        ArgumentsInput.Effect.INCLUDE)));
    EventSubscription workedExample =
        severalSources(AlertType.OBSERVABILITY, List.of("table", "topic", "pipeline"), triggers);
    Map<String, ChangeEvent> events = MatchingCorpus.events();

    assertEquals(
        answersOfItsStoredText(workedExample, events), answersOfThePlan(workedExample, events));
    assertEquals("yes", answerOfThePlan(workedExample, events.get("table columns changed")));
    assertEquals("no", answerOfThePlan(workedExample, events.get("topic schema changed")));
    assertEquals("yes", answerOfThePlan(workedExample, events.get("pipeline run failed")));
    assertEquals("no", answerOfThePlan(workedExample, events.get("conversation about the table")));
  }

  @Test
  void severalSourcesWithoutTriggersAgreeOnEveryEvent() {
    Map<String, ChangeEvent> events = MatchingCorpus.events();
    for (List<String> sources :
        List.of(
            List.of("table", "topic"),
            List.of("conversation", "task"),
            List.of("glossary", "tag"))) {
      EventSubscription alert =
          severalSources(AlertType.NOTIFICATION, sources, new AlertFilteringInput());

      assertEquals(
          answersOfItsStoredText(alert, events),
          answersOfThePlan(alert, events),
          sources.toString());
    }
  }

  private static EventSubscription severalSources(
      AlertType alertType, List<String> sources, AlertFilteringInput input) {
    return new EventSubscription()
        .withName(String.join("+", sources))
        .withAlertType(alertType)
        .withInput(input)
        .withFilteringRules(
            AlertUtil.validateAndBuildFilteringConditions(sources, alertType, input));
  }

  private static String answersOfItsStoredText(
      EventSubscription alert, Map<String, ChangeEvent> events) {
    List<String> answers = new ArrayList<>();
    for (ChangeEvent event : events.values()) {
      answers.add(
          answerOf(() -> AlertUtil.checkIfChangeEventIsAllowed(event, alert.getFilteringRules())));
    }
    return String.join(" ", answers);
  }

  private static void assertBothEnginesAgree(
      MatchingCorpus.Case alert, Map<String, ChangeEvent> events) {
    assertEquals(
        answersOfStoredText(alert, events), answersOfThePlan(alertOf(alert), events), alert.key());
  }

  private static MatchingCorpus.Case caseWith(
      AlertType alertType, String source, String filter, ArgumentsInput.Effect effect) {
    FilterResourceDescriptor offered =
        EventsSubscriptionRegistry.getEntityNotificationDescriptor(source);
    return new MatchingCorpus.Case(
        source + " " + filter,
        alertType,
        source,
        new AlertFilteringInput()
            .withFilters(List.of(MatchingCorpus.selection(definition(offered, filter), effect))));
  }

  private static EventFilterRule definition(FilterResourceDescriptor source, String filter) {
    return source.getSupportedFilters().stream()
        .filter(rule -> filter.equals(rule.getName()))
        .findFirst()
        .orElseThrow();
  }

  private static EventFilterRule definitionOfTrigger(String source, String trigger) {
    return EventsSubscriptionRegistry.getObservabilityDescriptor(source)
        .getSupportedActions()
        .stream()
        .filter(rule -> trigger.equals(rule.getName()))
        .findFirst()
        .orElseThrow();
  }

  private static EventSubscription alertOf(MatchingCorpus.Case alert) {
    return new EventSubscription()
        .withName(alert.key())
        .withAlertType(alert.alertType())
        .withInput(alert.input())
        .withFilteringRules(
            AlertUtil.validateAndBuildFilteringConditions(
                List.of(alert.source()), alert.alertType(), alert.input()));
  }

  private static String answersOfThePlan(EventSubscription alert, Map<String, ChangeEvent> events) {
    List<String> answers = new ArrayList<>();
    for (ChangeEvent event : events.values()) {
      answers.add(answerOfThePlan(alert, event));
    }
    return String.join(" ", answers);
  }

  private static String answerOfThePlan(EventSubscription alert, ChangeEvent event) {
    MatchingPlan plan = MatchingPlan.of(alert).orElseThrow();
    return answerOf(() -> PlanMatcher.matches(plan, event, new ConditionEvaluator(event)));
  }

  private static String answerOfStoredText(MatchingCorpus.Case alert, ChangeEvent event) {
    FilteringRules storedText =
        AlertUtil.validateAndBuildFilteringConditions(
            List.of(alert.source()), alert.alertType(), alert.input());
    return answerOf(() -> AlertUtil.checkIfChangeEventIsAllowed(event, storedText));
  }

  static String answersOfStoredText(MatchingCorpus.Case alert, Map<String, ChangeEvent> events) {
    FilteringRules storedText =
        AlertUtil.validateAndBuildFilteringConditions(
            List.of(alert.source()), alert.alertType(), alert.input());
    List<String> answers = new ArrayList<>();
    for (ChangeEvent event : events.values()) {
      answers.add(answerOf(() -> AlertUtil.checkIfChangeEventIsAllowed(event, storedText)));
    }
    return String.join(" ", answers);
  }

  interface Engine {
    boolean matches();
  }

  // An exception is an answer too: today it sets the event aside, and so must whatever comes next.
  static String answerOf(Engine engine) {
    String answer;
    try {
      answer = engine.matches() ? "yes" : "no";
    } catch (RuntimeException e) {
      answer = "threw:" + e.getClass().getSimpleName();
    }
    return answer;
  }
}
