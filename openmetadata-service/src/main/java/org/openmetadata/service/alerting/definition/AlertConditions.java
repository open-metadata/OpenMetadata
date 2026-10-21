/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.alerting.definition;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The rules an alert stores, built from the filters and triggers a user chose for each of its
 * sources.
 */
public final class AlertConditions {

  public static FilteringRules validateAndBuildFilteringConditions(
      List<String> resource,
      CreateEventSubscription.AlertType alertType,
      AlertFilteringInput input) {
    return buildFilteringConditions(resource, alertType, input, false);
  }

  /**
   * For a definition that is already stored: what an earlier release offered still builds, so an
   * alert saved then keeps its meaning. A new or changed definition may only use what is offered.
   */
  public static FilteringRules rebuildStoredFilteringConditions(
      List<String> resource,
      CreateEventSubscription.AlertType alertType,
      AlertFilteringInput input) {
    return buildFilteringConditions(resource, alertType, input, true);
  }

  private static FilteringRules buildFilteringConditions(
      List<String> resource,
      CreateEventSubscription.AlertType alertType,
      AlertFilteringInput input,
      boolean withWhatEarlierReleasesOffered) {
    boolean compiled =
        alertType.equals(CreateEventSubscription.AlertType.NOTIFICATION)
            || alertType.equals(CreateEventSubscription.AlertType.OBSERVABILITY);
    if (compiled) {
      SeveralSources.requireCombinable(alertType, resource);
    } else if (resource.size() != 1) {
      throw new BadRequestException(
          "One resource can be specified. Zero or Multiple resources are not supported.");
    }
    return compiled && SeveralSources.distinct(resource).size() > 1
        ? SeveralSources.compile(
            resource,
            sourcesOf(resource, alertType, withWhatEarlierReleasesOffered),
            input == null ? new AlertFilteringInput() : input)
        : buildForOneSource(resource, alertType, input, compiled, withWhatEarlierReleasesOffered);
  }

  // The text an alert with one source has always had, byte for byte.
  private static FilteringRules buildForOneSource(
      List<String> resource,
      CreateEventSubscription.AlertType alertType,
      AlertFilteringInput input,
      boolean compiled,
      boolean withWhatEarlierReleasesOffered) {
    FilteringRules built =
        new FilteringRules()
            .withResources(resource)
            .withRules(Collections.emptyList())
            .withActions(Collections.emptyList());
    if (compiled && input != null) {
      FilterResourceDescriptor source =
          sourceOf(resource.get(0), alertType, withWhatEarlierReleasesOffered);
      built
          .withRules(
              buildRulesList(
                  buildFilteringRulesMap(source.getSupportedFilters()), input.getFilters()))
          .withActions(triggersOf(source, alertType, input));
    } else if (compiled) {
      sourceOf(resource.get(0), alertType, withWhatEarlierReleasesOffered);
    }
    return built;
  }

  private static List<FilterResourceDescriptor> sourcesOf(
      List<String> names,
      CreateEventSubscription.AlertType alertType,
      boolean withWhatEarlierReleasesOffered) {
    return SeveralSources.distinct(names).stream()
        .map(name -> sourceOf(name, alertType, withWhatEarlierReleasesOffered))
        .toList();
  }

  // Only Observability alerts have triggers; a Notification alert stores an empty list.
  private static List<EventFilterRule> triggersOf(
      FilterResourceDescriptor source,
      CreateEventSubscription.AlertType alertType,
      AlertFilteringInput input) {
    return alertType.equals(CreateEventSubscription.AlertType.OBSERVABILITY)
        ? buildRulesList(buildFilteringRulesMap(source.getSupportedActions()), input.getActions())
        : Collections.emptyList();
  }

  private static FilterResourceDescriptor sourceOf(
      String name, CreateEventSubscription.AlertType alertType, boolean withEarlierReleases) {
    FilterResourceDescriptor source;
    if (withEarlierReleases) {
      source = EventsSubscriptionRegistry.getBuildableDescriptor(alertType, name);
    } else if (alertType.equals(CreateEventSubscription.AlertType.OBSERVABILITY)) {
      source = EventsSubscriptionRegistry.getObservabilityDescriptor(name);
    } else {
      source = EventsSubscriptionRegistry.getEntityNotificationDescriptor(name);
    }
    return source;
  }

  private static Map<String, EventFilterRule> buildFilteringRulesMap(
      List<EventFilterRule> filteringRules) {
    return filteringRules.stream()
        .collect(
            Collectors.toMap(
                EventFilterRule::getName,
                eventFilterRule -> JsonUtils.deepCopy(eventFilterRule, EventFilterRule.class)));
  }

  private static List<EventFilterRule> buildRulesList(
      Map<String, EventFilterRule> lookUp, List<ArgumentsInput> input) {
    List<EventFilterRule> rules = new ArrayList<>();
    listOrEmpty(input)
        .forEach(
            argumentsInput ->
                rules.add(
                    getFilterRule(lookUp, argumentsInput, buildInputArgumentsMap(argumentsInput))));
    return rules;
  }

  /** One chosen filter or trigger as the rule that is stored for it, arguments filled in. */
  public static EventFilterRule ruleOf(EventFilterRule definition, ArgumentsInput chosen) {
    return getFilterRule(
        Map.of(definition.getName(), JsonUtils.deepCopy(definition, EventFilterRule.class)),
        chosen,
        buildInputArgumentsMap(chosen));
  }

  private static Map<String, List<String>> buildInputArgumentsMap(ArgumentsInput filter) {
    return filter.getArguments().stream()
        .collect(Collectors.toMap(Argument::getName, Argument::getInput));
  }

  private static EventFilterRule getFilterRule(
      Map<String, EventFilterRule> supportedFilters,
      ArgumentsInput filterDetails,
      Map<String, List<String>> inputArgMap) {
    if (!supportedFilters.containsKey(filterDetails.getName())) {
      throw new BadRequestException(
          "Give Resource doesn't support the filter " + filterDetails.getName());
    }
    EventFilterRule rule =
        supportedFilters.get(filterDetails.getName()).withEffect(filterDetails.getEffect());
    if (rule.getInputType().equals(EventFilterRule.InputType.NONE)) {
      return rule;
    } else {
      String formulatedCondition = rule.getCondition();
      for (String argName : rule.getArguments()) {
        List<String> inputList = inputArgMap.get(argName);
        if (nullOrEmpty(inputList)) {
          throw new BadRequestException("Input for argument " + argName + " is missing");
        }

        formulatedCondition =
            formulatedCondition.replace(
                String.format("${%s}", argName),
                String.format("{%s}", convertInputListToString(inputList)));
      }
      return rule.withCondition(formulatedCondition);
    }
  }

  public static String convertInputListToString(List<String> valueList) {
    if (CommonUtil.nullOrEmpty(valueList)) {
      return "";
    }

    StringBuilder result = new StringBuilder();
    result.append("'").append(valueList.get(0).replace("'", "''")).append("'");

    for (int i = 1; i < valueList.size(); i++) {
      result.append(",'").append(valueList.get(i).replace("'", "''")).append("'");
    }

    return result.toString();
  }

  private AlertConditions() {}
}
