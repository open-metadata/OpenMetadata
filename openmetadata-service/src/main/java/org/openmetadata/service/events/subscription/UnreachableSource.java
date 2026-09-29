package org.openmetadata.service.events.subscription;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.type.FilterResourceDescriptor;

/**
 * Why a selected source can never produce a match with what has been chosen so far. Such a
 * definition still builds and saves, and at runtime nothing guesses: the source simply never
 * fires. The form shows the reason as a warning beside the source.
 */
final class UnreachableSource {

  private static final String BY_EVENT_TYPE = "filterByEventType";

  private UnreachableSource() {}

  // From the catalog only, as the save decides: names are never looked up.
  static String reason(FilterResourceDescriptor source, AlertFilteringInput input) {
    String reason = null;
    if (noChosenTriggerApplies(source, input)) {
      reason = "No chosen trigger applies to this source, so none of its events match.";
    } else if (noChosenEventTypeIsEmitted(source, input)) {
      reason = "This source never emits any of the chosen event types.";
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
