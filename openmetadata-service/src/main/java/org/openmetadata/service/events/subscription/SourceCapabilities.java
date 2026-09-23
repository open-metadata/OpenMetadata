package org.openmetadata.service.events.subscription;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.api.events.AlertCapabilities;
import org.openmetadata.schema.api.events.AlertCapabilitiesRequest;
import org.openmetadata.schema.api.events.AlertConditionCapability;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.AlertSourceCapability;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.type.FilterResourceDescriptor;

/**
 * What a selection of sources supports, derived where the save derives it, so the form cannot
 * offer something the save would reject. A source that would break a rule is
 * listed with the reason, to be shown disabled rather than fail on save.
 */
public final class SourceCapabilities {

  private SourceCapabilities() {}

  public static AlertCapabilities of(AlertCapabilitiesRequest request) {
    AlertType alertType = request.getAlertType();
    if (alertType != AlertType.NOTIFICATION && alertType != AlertType.OBSERVABILITY) {
      throw new BadRequestException(
          "Alerts of type " + alertType.value() + " have no catalog to choose sources from.");
    }
    List<String> selected = SeveralSources.distinct(listOrEmpty(request.getSources()));
    if (!selected.isEmpty()) {
      SeveralSources.requireCombinable(alertType, selected);
    }
    List<FilterResourceDescriptor> chosen =
        selected.stream().map(source -> offered(alertType, source)).toList();
    AlertFilteringInput input =
        request.getInput() == null ? new AlertFilteringInput() : request.getInput();
    return new AlertCapabilities()
        .withAlertType(alertType)
        .withSources(everySource(alertType, selected, chosen, input))
        .withFilters(filtersEverySourceSupports(chosen))
        .withTriggers(triggersAnySourceSupports(chosen))
        .withContainerEntities(union(chosen, FilterResourceDescriptor::getContainerEntities))
        .withEventTypes(
            union(
                chosen,
                source ->
                    ResourceEventTypes.forResource(source.getName()).stream()
                        .map(eventType -> eventType.value())
                        .toList()));
  }

  private static List<AlertSourceCapability> everySource(
      AlertType alertType,
      List<String> selected,
      List<FilterResourceDescriptor> chosen,
      AlertFilteringInput input) {
    List<FilterResourceDescriptor> all =
        alertType == AlertType.OBSERVABILITY
            ? EventsSubscriptionRegistry.listObservabilityDescriptors()
            : EventsSubscriptionRegistry.listEntityNotificationDescriptors();
    List<AlertSourceCapability> capabilities = new ArrayList<>();
    for (FilterResourceDescriptor source : all) {
      boolean isSelected = selected.stream().anyMatch(source.getName()::equalsIgnoreCase);
      AlertSourceCapability capability =
          new AlertSourceCapability()
              .withName(source.getName())
              .withKind(EventsSubscriptionRegistry.kindOf(alertType, source.getName()))
              .withSelected(isSelected);
      if (isSelected) {
        capability.setWarning(UnreachableSource.reason(source, chosen, input));
      } else {
        capability.setReason(whyItCannotJoin(alertType, selected, source.getName()));
        capability.setCanJoin(capability.getReason() == null);
      }
      capabilities.add(capability);
    }
    return capabilities;
  }

  private static String whyItCannotJoin(AlertType alertType, List<String> selected, String source) {
    String reason = null;
    List<String> withIt = new ArrayList<>(selected);
    withIt.add(source);
    try {
      SeveralSources.requireCombinable(alertType, withIt);
    } catch (BadRequestException e) {
      reason = e.getMessage();
    }
    return reason;
  }

  // A filter runs on every event, so only what every selected source supports is offered.
  private static List<AlertConditionCapability> filtersEverySourceSupports(
      List<FilterResourceDescriptor> chosen) {
    List<AlertConditionCapability> filters = new ArrayList<>();
    List<String> everySource = chosen.stream().map(FilterResourceDescriptor::getName).toList();
    if (!chosen.isEmpty()) {
      for (EventFilterRule filter : listOrEmpty(chosen.getFirst().getSupportedFilters())) {
        boolean everywhere =
            chosen.stream().allMatch(source -> has(source.getSupportedFilters(), filter.getName()));
        if (everywhere) {
          filters.add(
              new AlertConditionCapability().withCondition(filter).withSources(everySource));
        }
      }
    }
    return filters;
  }

  // A trigger only ever meets events of the sources that support it, and says which those are.
  private static List<AlertConditionCapability> triggersAnySourceSupports(
      List<FilterResourceDescriptor> chosen) {
    List<AlertConditionCapability> triggers = new ArrayList<>();
    for (FilterResourceDescriptor source : chosen) {
      for (EventFilterRule trigger : listOrEmpty(source.getSupportedActions())) {
        AlertConditionCapability known =
            triggers.stream()
                .filter(one -> one.getCondition().getName().equals(trigger.getName()))
                .findFirst()
                .orElse(null);
        if (known == null) {
          known =
              new AlertConditionCapability().withCondition(trigger).withSources(new ArrayList<>());
          triggers.add(known);
        }
        known.getSources().add(source.getName());
      }
    }
    return triggers;
  }

  private static boolean has(List<EventFilterRule> definitions, String name) {
    return listOrEmpty(definitions).stream().anyMatch(rule -> rule.getName().equals(name));
  }

  private interface ListOf {
    List<String> of(FilterResourceDescriptor source);
  }

  private static List<String> union(List<FilterResourceDescriptor> chosen, ListOf values) {
    Set<String> all = new LinkedHashSet<>();
    chosen.forEach(source -> all.addAll(listOrEmpty(values.of(source))));
    return new ArrayList<>(all);
  }

  // A source the catalog no longer offers is still described for an alert that already has it, so
  // opening that alert shows what it holds; changing its definition is refused on save.
  private static FilterResourceDescriptor offered(AlertType alertType, String source) {
    FilterResourceDescriptor descriptor;
    try {
      descriptor =
          alertType == AlertType.OBSERVABILITY
              ? EventsSubscriptionRegistry.getObservabilityDescriptor(source)
              : EventsSubscriptionRegistry.getEntityNotificationDescriptor(source);
    } catch (IllegalArgumentException notOffered) {
      descriptor = EventsSubscriptionRegistry.getBuildableDescriptor(alertType, source);
    }
    return descriptor;
  }
}
