package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.FilteringRules;

/**
 * The text stored for an alert is what decides it, and what a server of the previous release
 * evaluates after a rollback, so what the builder writes for one source must not drift, and what
 * it writes for several sources groups the triggers by source.
 */
class CompiledTextTest {

  private static final List<String> FIXTURE_VALUES = List.of("first value", "second 'quoted'");

  @BeforeAll
  static void loadCatalog() {
    EventsSubscriptionRegistry.initialize(AlertCatalog.load());
  }

  // What the builder has always written for one source: the name, the effect, the prefix and
  // the condition with its arguments quoted. Saved alerts hold this text, so it must not drift.
  @Test
  void oneSourceTextIsWhatTheBuilderHasAlwaysWritten() {
    assertEquals(
        "filterByOwnerName | include | AND | matchAnyOwnerName({'first value','second ''quoted'''})",
        rulesOf(
            AlertType.NOTIFICATION, "table", "filterByOwnerName", ArgumentsInput.Effect.INCLUDE));
    assertEquals(
        "filterByOwnerName | exclude | AND | matchAnyOwnerName({'first value','second ''quoted'''})",
        rulesOf(
            AlertType.NOTIFICATION, "table", "filterByOwnerName", ArgumentsInput.Effect.EXCLUDE));
    assertEquals(
        "filterByUpdaterIsBot | include | AND | isBot()",
        rulesOf(
            AlertType.NOTIFICATION, "all", "filterByUpdaterIsBot", ArgumentsInput.Effect.INCLUDE));
    assertEquals(
        "GetTableSchemaChanges | include | AND | matchAnyFieldChange({'columns','dataModel','joins'})",
        actionsOf(
            AlertType.OBSERVABILITY,
            "table",
            "GetTableSchemaChanges",
            ArgumentsInput.Effect.INCLUDE));
    assertEquals(
        "GetPipelineStatusUpdates | exclude | AND | matchPipelineState({'first value','second ''quoted'''})",
        actionsOf(
            AlertType.OBSERVABILITY,
            "pipeline",
            "GetPipelineStatusUpdates",
            ArgumentsInput.Effect.EXCLUDE));
  }

  // The worked example: tables and topics whose schema changed, and pipelines whose run failed.
  // A server of the previous release evaluates this text as it stands.
  @Test
  void multiSourceTextGroupsTriggersBySource() {
    AlertFilteringInput input =
        new AlertFilteringInput()
            .withActions(
                List.of(
                    chosen("GetTableSchemaChanges", ArgumentsInput.Effect.INCLUDE, null, null),
                    chosen("GetTopicSchemaChanges", ArgumentsInput.Effect.INCLUDE, null, null),
                    chosen(
                        "GetPipelineStatusUpdates",
                        ArgumentsInput.Effect.INCLUDE,
                        "pipelineStateList",
                        "failed")));

    FilteringRules stored =
        AlertUtil.validateAndBuildFilteringConditions(
            List.of("table", "topic", "pipeline"), AlertType.OBSERVABILITY, input);

    assertEquals(List.of("table", "topic", "pipeline"), stored.getResources());
    assertEquals(1, stored.getActions().size(), "one rule holds every group");
    assertEquals(ArgumentsInput.Effect.INCLUDE, stored.getActions().getFirst().getEffect());
    assertEquals(
        "(matchAnySource({'table'}) && (matchAnyFieldChange({'columns','dataModel','joins'})))"
            + " || (matchAnySource({'topic'}) && (matchAnyFieldChange({'messageSchema'})))"
            + " || (matchAnySource({'pipeline'}) && (matchPipelineState({'failed'})))",
        stored.getActions().getFirst().getCondition());
  }

  private static ArgumentsInput chosen(
      String name, ArgumentsInput.Effect effect, String argument, String value) {
    List<Argument> arguments =
        argument == null
            ? List.of()
            : List.of(new Argument().withName(argument).withInput(List.of(value)));
    return new ArgumentsInput().withName(name).withEffect(effect).withArguments(arguments);
  }

  private static String rulesOf(
      AlertType type, String source, String filter, ArgumentsInput.Effect effect) {
    AlertFilteringInput input =
        new AlertFilteringInput().withFilters(List.of(selection(definition(filter), effect)));
    return textOf(type, source, input).getRules();
  }

  private static String actionsOf(
      AlertType type, String source, String trigger, ArgumentsInput.Effect effect) {
    AlertFilteringInput input =
        new AlertFilteringInput().withActions(List.of(selection(definition(trigger), effect)));
    return textOf(type, source, input).getActions();
  }

  private static EventFilterRule definition(String name) {
    return AlertCatalog.load().definitions().stream()
        .filter(candidate -> candidate.getName().equals(name))
        .findFirst()
        .orElseThrow();
  }

  private record Compiled(String rules, String actions) {
    String getRules() {
      return rules;
    }

    String getActions() {
      return actions;
    }
  }

  private static Compiled textOf(AlertType type, String source, AlertFilteringInput input) {
    FilteringRules built =
        AlertUtil.validateAndBuildFilteringConditions(List.of(source), type, input);
    return new Compiled(wholeTextOf(built.getRules()), wholeTextOf(built.getActions()));
  }

  // Name, effect, prefix and condition: everything an evaluating server reads.
  private static String wholeTextOf(List<EventFilterRule> rules) {
    List<String> parts = new ArrayList<>();
    for (EventFilterRule rule : listOrEmpty(rules)) {
      parts.add(
          String.join(
              " | ",
              rule.getName(),
              String.valueOf(rule.getEffect()),
              String.valueOf(rule.getPrefixCondition()),
              rule.getCondition()));
    }
    return String.join(" ;; ", parts);
  }

  private static ArgumentsInput selection(EventFilterRule rule, ArgumentsInput.Effect effect) {
    List<Argument> arguments = new ArrayList<>();
    for (String name : listOrEmpty(rule.getArguments())) {
      arguments.add(new Argument().withName(name).withInput(FIXTURE_VALUES));
    }
    return new ArgumentsInput()
        .withName(rule.getName())
        .withEffect(effect)
        .withArguments(arguments);
  }
}
