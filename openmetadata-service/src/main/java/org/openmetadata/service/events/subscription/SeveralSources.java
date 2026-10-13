package org.openmetadata.service.events.subscription;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.AlertSourceKind;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.type.FilterResourceDescriptor;

/**
 * An alert that watches several sources. The sources are "any of", the filters "all of", and a
 * trigger applies only to the sources that support it: a table event is never asked about a topic
 * trigger. Whatever breaks one of these rules is refused with a message that names the rule.
 */
public final class SeveralSources {

  static final String GROUPED_TRIGGERS = "triggersBySource";

  private SeveralSources() {}

  /** Not empty, every name known, the wildcard alone, and one kind: kinds share no filters. */
  public static void requireCombinable(AlertType alertType, List<String> sources) {
    if (sources.isEmpty()) {
      throw new BadRequestException("An alert needs at least one source.");
    }
    Set<AlertSourceKind> kinds = new LinkedHashSet<>();
    for (String source : distinct(sources)) {
      AlertSourceKind kind = EventsSubscriptionRegistry.kindOf(alertType, source);
      if (kind == null) {
        throw new BadRequestException(
            String.format("'%s' is not a source of %s alerts.", source, alertType.value()));
      }
      kinds.add(kind);
    }
    if (kinds.contains(AlertSourceKind.ALL) && distinct(sources).size() > 1) {
      throw new BadRequestException(
          "The source 'all' already watches everything, so it cannot be combined with others.");
    }
    if (kinds.size() > 1) {
      throw new BadRequestException(
          "Sources of different kinds cannot be combined: "
              + describe(alertType, sources)
              + ". They share no filters; use one alert for each kind.");
    }
  }

  /**
   * The definition as the condition text that decides matching: the triggers become one rule that
   * groups them by source.
   */
  public static FilteringRules compile(
      List<String> sources, List<FilterResourceDescriptor> catalog, AlertFilteringInput input) {
    List<EventFilterRule> filters = new ArrayList<>();
    for (ArgumentsInput chosen : listOrEmpty(input.getFilters())) {
      filters.add(filterEverySourceSupports(chosen, catalog));
    }
    List<EventFilterRule> triggers = new ArrayList<>();
    if (!listOrEmpty(input.getActions()).isEmpty()) {
      triggers.add(triggersGroupedBySource(input.getActions(), catalog));
    }
    return new FilteringRules().withResources(sources).withRules(filters).withActions(triggers);
  }

  // A filter runs on every event. On a type that cannot evaluate it, it would drop all of that
  // type's events, or keep all of them.
  private static EventFilterRule filterEverySourceSupports(
      ArgumentsInput chosen, List<FilterResourceDescriptor> catalog) {
    List<String> without =
        catalog.stream()
            .filter(source -> definitionOf(chosen, source.getSupportedFilters()).isEmpty())
            .map(FilterResourceDescriptor::getName)
            .toList();
    if (!without.isEmpty()) {
      throw new BadRequestException(
          String.format(
              "Filter '%s' is not supported by: %s. A filter applies to every event, so every source of the alert must support it.",
              chosen.getName(), String.join(", ", without)));
    }
    EventFilterRule definition =
        definitionOf(chosen, catalog.getFirst().getSupportedFilters()).orElseThrow();
    return AlertUtil.ruleOf(definition, chosen);
  }

  private static EventFilterRule triggersGroupedBySource(
      List<ArgumentsInput> chosen, List<FilterResourceDescriptor> catalog) {
    for (ArgumentsInput trigger : chosen) {
      boolean supported =
          catalog.stream()
              .anyMatch(source -> definitionOf(trigger, source.getSupportedActions()).isPresent());
      if (!supported) {
        throw new BadRequestException(
            String.format(
                "Trigger '%s' is not supported by any source of the alert.", trigger.getName()));
      }
    }
    // A source none of the chosen triggers applies to has no branch, so its events answer no.
    String grouped =
        catalog.stream()
            .map(source -> branchOf(source, chosen))
            .flatMap(Optional::stream)
            .collect(Collectors.joining(" || "));
    return new EventFilterRule()
        .withName(GROUPED_TRIGGERS)
        .withEffect(ArgumentsInput.Effect.INCLUDE)
        .withCondition(grouped);
  }

  private static Optional<String> branchOf(
      FilterResourceDescriptor source, List<ArgumentsInput> chosen) {
    List<String> own = new ArrayList<>();
    for (ArgumentsInput trigger : chosen) {
      definitionOf(trigger, source.getSupportedActions())
          .map(definition -> AlertUtil.ruleOf(definition, trigger))
          .map(SeveralSources::wrapped)
          .ifPresent(own::add);
    }
    String ofThisSource =
        String.format(
            "matchAnySource({%s})", AlertUtil.convertInputListToString(List.of(source.getName())));
    return own.isEmpty()
        ? Optional.empty()
        : Optional.of("(" + ofThisSource + " && " + String.join(" && ", own) + ")");
  }

  // An excluded trigger is negated inside its own group.
  private static String wrapped(EventFilterRule rule) {
    boolean excluded = rule.getEffect() == ArgumentsInput.Effect.EXCLUDE;
    return (excluded ? "(!" : "(") + rule.getCondition() + ")";
  }

  private static Optional<EventFilterRule> definitionOf(
      ArgumentsInput chosen, List<EventFilterRule> definitions) {
    return listOrEmpty(definitions).stream()
        .filter(definition -> definition.getName().equals(chosen.getName()))
        .findFirst();
  }

  // Letter case is ignored here, and only here: events keep matching a source's name exactly.
  static List<String> distinct(List<String> sources) {
    Set<String> seen = new LinkedHashSet<>();
    return sources.stream().filter(source -> seen.add(source.toLowerCase(Locale.ROOT))).toList();
  }

  private static String describe(AlertType alertType, List<String> sources) {
    return distinct(sources).stream()
        .map(
            source ->
                source + " is " + articleFor(EventsSubscriptionRegistry.kindOf(alertType, source)))
        .collect(Collectors.joining(", "));
  }

  private static String articleFor(AlertSourceKind kind) {
    return switch (kind) {
      case ENTITY -> "an entity source";
      case ACTIVITY -> "an activity source";
      case ALL -> "the wildcard";
    };
  }
}
