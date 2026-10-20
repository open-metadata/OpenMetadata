package org.openmetadata.service.alerting.definition;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.events.AlertConditionCapability;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The filters and triggers a set of sources shares, the same whatever order the sources were
 * picked in. A source may call a condition its own way; a condition several sources share takes
 * the name they all give it, and the catalog's own name when they give it different ones. The
 * sources are read in name order, so a condition lists in the order the first of them lists it.
 * ADR:2026-10-20-a-condition-several-sources-share-takes-the-label-they-agree-on
 */
final class SharedConditions {

  private SharedConditions() {}

  /** What every chosen source supports. */
  static List<AlertConditionCapability> filtersOfEvery(List<FilterResourceDescriptor> chosen) {
    List<FilterResourceDescriptor> sources = inNameOrder(chosen);
    List<AlertConditionCapability> filters = new ArrayList<>();
    if (!sources.isEmpty()) {
      for (EventFilterRule own : Kind.FILTER.of(sources.getFirst())) {
        filterSharedBy(own.getName(), sources)
            .ifPresent(filter -> filters.add(capability(filter, namesOf(sources))));
      }
    }
    return filters;
  }

  /** What at least one chosen source supports, with the sources each one applies to. */
  static List<AlertConditionCapability> triggersOfAny(List<FilterResourceDescriptor> chosen) {
    List<AlertConditionCapability> triggers = new ArrayList<>();
    supportingEachTrigger(chosen)
        .forEach(
            (name, sources) -> {
              EventFilterRule trigger =
                  sharedBy(Kind.TRIGGER.definition(name), copiesOf(sources, Kind.TRIGGER, name));
              triggers.add(capability(trigger, namesOf(sources)));
            });
    return triggers;
  }

  /** The filter as every chosen source supports it; empty when one of them does not support it. */
  static Optional<EventFilterRule> filterSharedBy(
      String name, List<FilterResourceDescriptor> chosen) {
    List<EventFilterRule> copies = copiesOf(chosen, Kind.FILTER, name);
    boolean everywhere = !chosen.isEmpty() && copies.size() == chosen.size();
    return everywhere
        ? Optional.of(sharedBy(Kind.FILTER.definition(name), copies))
        : Optional.empty();
  }

  private static Map<String, List<FilterResourceDescriptor>> supportingEachTrigger(
      List<FilterResourceDescriptor> chosen) {
    Map<String, List<FilterResourceDescriptor>> supporting = new LinkedHashMap<>();
    for (FilterResourceDescriptor source : inNameOrder(chosen)) {
      for (EventFilterRule own : Kind.TRIGGER.of(source)) {
        supporting.computeIfAbsent(own.getName(), name -> new ArrayList<>()).add(source);
      }
    }
    return supporting;
  }

  private static EventFilterRule sharedBy(
      EventFilterRule definition, List<EventFilterRule> copies) {
    Set<Label> labels = copies.stream().map(Label::of).collect(Collectors.toSet());
    EventFilterRule shared = JsonUtils.deepCopy(definition, EventFilterRule.class);
    if (labels.size() == 1) {
      Label agreed = labels.iterator().next();
      shared.withDisplayName(agreed.displayName()).withDescription(agreed.description());
    }
    return shared;
  }

  private static List<EventFilterRule> copiesOf(
      List<FilterResourceDescriptor> sources, Kind kind, String name) {
    return sources.stream()
        .map(source -> kind.of(source).stream().filter(rule -> name.equals(rule.getName())))
        .flatMap(named -> named.findFirst().stream())
        .toList();
  }

  private static List<FilterResourceDescriptor> inNameOrder(List<FilterResourceDescriptor> chosen) {
    return chosen.stream().sorted(Comparator.comparing(FilterResourceDescriptor::getName)).toList();
  }

  private static AlertConditionCapability capability(EventFilterRule rule, List<String> sources) {
    return new AlertConditionCapability().withCondition(rule).withSources(sources);
  }

  private static List<String> namesOf(List<FilterResourceDescriptor> sources) {
    return sources.stream().map(FilterResourceDescriptor::getName).toList();
  }

  private enum Kind {
    FILTER(
        FilterResourceDescriptor::getSupportedFilters,
        EventsSubscriptionRegistry::filterDefinitions),
    TRIGGER(
        FilterResourceDescriptor::getSupportedActions,
        EventsSubscriptionRegistry::triggerDefinitions);

    private final Function<FilterResourceDescriptor, List<EventFilterRule>> ofSource;
    private final Supplier<List<EventFilterRule>> definitions;

    Kind(
        Function<FilterResourceDescriptor, List<EventFilterRule>> ofSource,
        Supplier<List<EventFilterRule>> definitions) {
      this.ofSource = ofSource;
      this.definitions = definitions;
    }

    List<EventFilterRule> of(FilterResourceDescriptor source) {
      return listOrEmpty(ofSource.apply(source));
    }

    // Every source names conditions the catalog defines: the catalog refuses to load otherwise.
    EventFilterRule definition(String name) {
      return definitions.get().stream()
          .filter(definition -> name.equals(definition.getName()))
          .findFirst()
          .orElseThrow();
    }
  }

  private record Label(String displayName, String description) {
    static Label of(EventFilterRule rule) {
      return new Label(rule.getDisplayName(), rule.getDescription());
    }
  }
}
