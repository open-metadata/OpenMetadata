package org.openmetadata.service.events.subscription;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.Comparator;
import java.util.List;
import java.util.SortedSet;
import java.util.TreeSet;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FilteringRules;

/**
 * What an alert watches and when it fires, as the user chose it, and the stored text compiled
 * from those choices. Validation is for what changes: a definition stored long ago under older
 * rules must never stop its alert from being renamed or switched back on.
 */
@Slf4j
public final class AlertDefinition {

  private AlertDefinition() {}

  public static boolean isSameDefinition(EventSubscription one, EventSubscription other) {
    return Canonical.of(one).equals(Canonical.of(other));
  }

  /** Rejects a definition that cannot be built. For a new alert or a definition that changed. */
  public static FilteringRules compileStrictly(EventSubscription alert) {
    return AlertUtil.validateAndBuildFilteringConditions(
        sourcesOf(alert), alert.getAlertType(), alert.getInput());
  }

  /**
   * The stored text under today's catalog, so a fix to a condition reaches alerts saved before
   * it. A definition that cannot be compiled keeps the whole text it has.
   */
  public static FilteringRules compileOrKeep(EventSubscription alert, FilteringRules stored) {
    FilteringRules compiled = stored;
    try {
      compiled =
          AlertUtil.rebuildStoredFilteringConditions(
              sourcesOf(alert), alert.getAlertType(), alert.getInput());
    } catch (RuntimeException e) {
      LOG.info("Alert {} keeps its stored conditions: {}", alert.getName(), e.getMessage());
    }
    return compiled;
  }

  private static List<String> sourcesOf(EventSubscription alert) {
    return alert.getFilteringRules() == null
        ? List.of()
        : listOrEmpty(alert.getFilteringRules().getResources());
  }

  /**
   * The definition with everything left out that does not change its meaning, so a save that
   * only rebuilds the same selections does not look like a change: the UI sends an empty list of
   * triggers with every save.
   */
  private record Canonical(
      AlertType alertType,
      SortedSet<String> sources,
      List<Selection> filters,
      List<Selection> triggers) {

    static Canonical of(EventSubscription alert) {
      AlertFilteringInput input = alert.getInput();
      return new Canonical(
          alert.getAlertType(),
          new TreeSet<>(sourcesOf(alert)),
          selections(input == null ? null : input.getFilters()),
          selections(input == null ? null : input.getActions()));
    }

    private static List<Selection> selections(List<ArgumentsInput> chosen) {
      return listOrEmpty(chosen).stream()
          .map(Selection::of)
          .sorted(Comparator.comparing(Selection::name))
          .toList();
    }
  }

  // prefixCondition only says how this selection is joined to the one before it.
  private record Selection(String name, ArgumentsInput.Effect effect, List<Value> arguments) {

    static Selection of(ArgumentsInput chosen) {
      ArgumentsInput.Effect effect =
          chosen.getEffect() == null ? ArgumentsInput.Effect.INCLUDE : chosen.getEffect();
      List<Value> arguments =
          listOrEmpty(chosen.getArguments()).stream()
              .map(Value::of)
              .sorted(Comparator.comparing(Value::name))
              .toList();
      return new Selection(chosen.getName(), effect, arguments);
    }
  }

  private record Value(String name, List<String> input) {

    static Value of(Argument argument) {
      return new Value(argument.getName(), List.copyOf(listOrEmpty(argument.getInput())));
    }
  }
}
