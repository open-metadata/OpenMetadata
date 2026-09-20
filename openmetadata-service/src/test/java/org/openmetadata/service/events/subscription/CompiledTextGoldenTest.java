package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The text stored for an alert is what servers of the previous release evaluate, so for an alert
 * with one source it may never change by a byte. The golden file holds the text today's builder
 * compiles for every source, filter and trigger of the catalog with fixed arguments. Regenerate it
 * with -Dgolden.generate=true only for a named change.
 */
class CompiledTextGoldenTest {

  private static final Path GOLDEN =
      Path.of("src", "test", "resources", "golden", "compiled-text", "single-source.json");
  private static final List<String> FIXTURE_VALUES = List.of("first value", "second 'quoted'");

  @BeforeAll
  static void loadCatalog() {
    EventsSubscriptionRegistry.initialize(AlertCatalog.load());
  }

  @Test
  void singleSourceTextIsByteIdentical() throws IOException {
    Map<String, String> compiled = new TreeMap<>();
    for (FilterResourceDescriptor source :
        EventsSubscriptionRegistry.listEntityNotificationDescriptors()) {
      compileEverySelection(AlertType.NOTIFICATION, source, compiled);
    }
    for (FilterResourceDescriptor source :
        EventsSubscriptionRegistry.listObservabilityDescriptors()) {
      compileEverySelection(AlertType.OBSERVABILITY, source, compiled);
    }
    assertFalse(compiled.isEmpty(), "the catalog was not loaded");

    String text = JsonUtils.pojoToJson(compiled, true) + System.lineSeparator();
    if (Boolean.getBoolean("golden.generate")) {
      Files.createDirectories(GOLDEN.getParent());
      Files.writeString(GOLDEN, text);
    }
    assertEquals(Files.readString(GOLDEN), text);
  }

  private static void compileEverySelection(
      AlertType type, FilterResourceDescriptor source, Map<String, String> compiled) {
    for (EventFilterRule filter : listOrEmpty(source.getSupportedFilters())) {
      for (ArgumentsInput.Effect effect : ArgumentsInput.Effect.values()) {
        AlertFilteringInput input =
            new AlertFilteringInput().withFilters(List.of(selection(filter, effect)));
        compiled.put(
            key(type, source, "filter", filter, effect), textOf(type, source, input).getRules());
      }
    }
    for (EventFilterRule trigger : listOrEmpty(source.getSupportedActions())) {
      for (ArgumentsInput.Effect effect : ArgumentsInput.Effect.values()) {
        AlertFilteringInput input =
            new AlertFilteringInput().withActions(List.of(selection(trigger, effect)));
        compiled.put(
            key(type, source, "trigger", trigger, effect),
            textOf(type, source, input).getActions());
      }
    }
  }

  private record Compiled(String rules, String actions) {
    String getRules() {
      return rules;
    }

    String getActions() {
      return actions;
    }
  }

  private static Compiled textOf(
      AlertType type, FilterResourceDescriptor source, AlertFilteringInput input) {
    FilteringRules built =
        AlertUtil.validateAndBuildFilteringConditions(List.of(source.getName()), type, input);
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

  private static String key(
      AlertType type,
      FilterResourceDescriptor source,
      String kind,
      EventFilterRule rule,
      ArgumentsInput.Effect effect) {
    return String.join("/", type.value(), source.getName(), kind, rule.getName(), effect.value());
  }
}
