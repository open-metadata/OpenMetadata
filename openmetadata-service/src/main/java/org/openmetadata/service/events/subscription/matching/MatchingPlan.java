package org.openmetadata.service.events.subscription.matching;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.service.events.subscription.AlertDefinition;
import org.openmetadata.service.events.subscription.AlertUtil;
import org.openmetadata.service.events.subscription.EventsSubscriptionRegistry;

/**
 * What an alert watches and when it fires, built from what the user chose and today's catalog,
 * never from condition text saved beside it. Filters apply to every event. Triggers are kept by
 * the source they belong to, because a trigger only makes sense for events of that source's type.
 *
 * @param sources the names of the alert's sources, all of them
 * @param filters every chosen filter
 * @param triggersBySource the chosen triggers of each source that supports them
 */
@Slf4j
public record MatchingPlan(
    List<String> sources, List<Selection> filters, Map<String, List<Selection>> triggersBySource) {

  /** One chosen filter or trigger, with its arguments already in its condition. */
  public record Selection(String name, boolean include, String condition) {}

  public boolean hasTriggers() {
    return !triggersBySource.isEmpty();
  }

  /**
   * Empty for an alert whose rules were written by hand, which has no selections to plan from,
   * and for a definition the catalog can no longer build, which then runs on its stored text.
   */
  public static Optional<MatchingPlan> of(EventSubscription alert) {
    Optional<MatchingPlan> plan = Optional.empty();
    boolean planned =
        alert.getFilteringRules() != null
            && AlertDefinition.isCompiledFromSelections(alert, alert.getFilteringRules());
    if (planned) {
      try {
        plan = Optional.of(build(alert));
      } catch (RuntimeException e) {
        LOG.error(
            "The definition of alert {} cannot be built: {}", alert.getName(), e.getMessage());
      }
    }
    return plan;
  }

  private static MatchingPlan build(EventSubscription alert) {
    List<String> sources = List.copyOf(listOrEmpty(alert.getFilteringRules().getResources()));
    AlertFilteringInput input =
        alert.getInput() == null ? new AlertFilteringInput() : alert.getInput();
    List<FilterResourceDescriptor> catalog = new ArrayList<>();
    for (String source : sources) {
      catalog.add(EventsSubscriptionRegistry.getBuildableDescriptor(alert.getAlertType(), source));
    }
    List<Selection> filters = new ArrayList<>();
    for (ArgumentsInput chosen : listOrEmpty(input.getFilters())) {
      filters.add(filterOf(chosen, catalog));
    }
    return new MatchingPlan(sources, filters, triggersBySource(input, catalog));
  }

  // A filter judges the subject of an event, whatever its type, so any source that defines it will
  // do: the definition is written once.
  private static Selection filterOf(ArgumentsInput chosen, List<FilterResourceDescriptor> catalog) {
    for (FilterResourceDescriptor source : catalog) {
      Optional<Selection> built = selectionOf(chosen, source.getSupportedFilters());
      if (built.isPresent()) {
        return built.get();
      }
    }
    throw new IllegalArgumentException("No source of the alert supports " + chosen.getName());
  }

  private static Map<String, List<Selection>> triggersBySource(
      AlertFilteringInput input, List<FilterResourceDescriptor> catalog) {
    Map<String, List<Selection>> bySource = new LinkedHashMap<>();
    for (ArgumentsInput chosen : listOrEmpty(input.getActions())) {
      boolean supported = false;
      for (FilterResourceDescriptor source : catalog) {
        Optional<Selection> built = selectionOf(chosen, source.getSupportedActions());
        built.ifPresent(
            trigger ->
                bySource.computeIfAbsent(source.getName(), name -> new ArrayList<>()).add(trigger));
        supported = supported || built.isPresent();
      }
      if (!supported) {
        throw new IllegalArgumentException("No source of the alert supports " + chosen.getName());
      }
    }
    return bySource;
  }

  private static Optional<Selection> selectionOf(
      ArgumentsInput chosen, List<EventFilterRule> definitions) {
    return listOrEmpty(definitions).stream()
        .filter(definition -> definition.getName().equals(chosen.getName()))
        .findFirst()
        .map(definition -> AlertUtil.ruleOf(definition, chosen))
        .map(
            rule ->
                new Selection(
                    rule.getName(),
                    rule.getEffect() != ArgumentsInput.Effect.EXCLUDE,
                    rule.getCondition()));
  }
}
