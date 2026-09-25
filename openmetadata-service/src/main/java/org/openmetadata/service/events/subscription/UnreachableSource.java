package org.openmetadata.service.events.subscription;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

/**
 * Why a selected source can never produce a match with what has been chosen so far. Such a
 * definition still builds and saves, and at runtime nothing guesses: the source simply never
 * fires. The form shows the reason as a warning beside the source.
 */
@Slf4j
final class UnreachableSource {

  private static final String BY_EVENT_TYPE = "filterByEventType";
  private static final String BY_NAME = "filterByFqn";
  private static final String SERVICE_SUFFIX = "Service";

  private UnreachableSource() {}

  static String reason(
      FilterResourceDescriptor source,
      List<FilterResourceDescriptor> selected,
      AlertFilteringInput input) {
    String reason = null;
    if (noChosenTriggerApplies(source, input)) {
      reason = "No chosen trigger applies to this source, so none of its events match.";
    } else if (noChosenEventTypeIsEmitted(source, input)) {
      reason = "This source never emits any of the chosen event types.";
    } else if (selected.size() > 1 && everyChosenNameIsElsewhere(source, input)) {
      reason = "Every chosen name belongs to another kind of service than this source's.";
    }
    return reason;
  }

  private static boolean noChosenTriggerApplies(
      FilterResourceDescriptor source, AlertFilteringInput input) {
    List<ArgumentsInput> triggers = listOrEmpty(input.getActions());
    return !triggers.isEmpty()
        && triggers.stream()
            .noneMatch(
                chosen ->
                    listOrEmpty(source.getSupportedActions()).stream()
                        .anyMatch(rule -> rule.getName().equals(chosen.getName())));
  }

  private static boolean noChosenEventTypeIsEmitted(
      FilterResourceDescriptor source, AlertFilteringInput input) {
    List<String> wanted = includedValuesOf(input, BY_EVENT_TYPE);
    List<String> emitted =
        ResourceEventTypes.forResource(source.getName()).stream()
            .map(eventType -> eventType.value())
            .toList();
    return !wanted.isEmpty() && wanted.stream().noneMatch(emitted::contains);
  }

  // A name is matched by prefix, and its first part is a service. A service name is only unique
  // within its own kind of service, so only a name whose service exists somewhere, and nowhere
  // among the kinds this source lives under, says the source is out of reach.
  private static boolean everyChosenNameIsElsewhere(
      FilterResourceDescriptor source, AlertFilteringInput input) {
    List<String> names = includedValuesOf(input, BY_NAME);
    List<String> ownServiceTypes =
        listOrEmpty(source.getContainerEntities()).stream()
            .filter(type -> type.endsWith(SERVICE_SUFFIX))
            .toList();
    boolean elsewhere = !names.isEmpty() && !ownServiceTypes.isEmpty();
    for (int index = 0; elsewhere && index < names.size(); index++) {
      String service = names.get(index).split("\\.", 2)[0];
      elsewhere =
          ownServiceTypes.stream().noneMatch(type -> exists(type, service))
              && existsAsAnotherKindOfService(service, ownServiceTypes);
    }
    return elsewhere;
  }

  private static boolean existsAsAnotherKindOfService(String service, List<String> ownTypes) {
    return Entity.getEntityList().stream()
        .filter(type -> type.endsWith(SERVICE_SUFFIX) && !ownTypes.contains(type))
        .anyMatch(type -> exists(type, service));
  }

  private static boolean exists(String serviceType, String name) {
    boolean exists = false;
    try {
      exists = Entity.getEntityByName(serviceType, name, "", Include.NON_DELETED) != null;
    } catch (RuntimeException e) {
      LOG.debug("No {} named {}", serviceType, name);
    }
    return exists;
  }

  private static List<String> includedValuesOf(AlertFilteringInput input, String filter) {
    List<String> values = new ArrayList<>();
    for (ArgumentsInput chosen : listOrEmpty(input.getFilters())) {
      boolean included =
          filter.equals(chosen.getName()) && chosen.getEffect() != ArgumentsInput.Effect.EXCLUDE;
      if (included) {
        for (Argument argument : listOrEmpty(chosen.getArguments())) {
          values.addAll(listOrEmpty(argument.getInput()));
        }
      }
    }
    return values;
  }
}
