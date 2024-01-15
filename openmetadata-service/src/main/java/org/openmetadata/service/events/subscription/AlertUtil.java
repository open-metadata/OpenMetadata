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

package org.openmetadata.service.events.subscription;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.THREAD;
import static org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer.OFFSET_EXTENSION;
import static org.openmetadata.service.security.policyevaluator.CompiledRule.parseExpression;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.ws.rs.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.util.JsonUtils;
import org.springframework.expression.Expression;

@Slf4j
public final class AlertUtil {
  private AlertUtil() {}

  public static <T> void validateExpression(String condition, Class<T> clz) {
    if (condition == null) {
      return;
    }
    Expression expression = parseExpression(condition);
    AlertsRuleEvaluator ruleEvaluator = new AlertsRuleEvaluator(null);
    try {
      expression.getValue(ruleEvaluator, clz);
    } catch (Exception exception) {
      // Remove unnecessary class details in the exception message
      String message =
          exception.getMessage().replaceAll("on type .*$", "").replaceAll("on object .*$", "");
      throw new IllegalArgumentException(CatalogExceptionMessage.failedToEvaluate(message));
    }
  }

  public static boolean evaluateAlertConditions(
      ChangeEvent changeEvent, List<EventFilterRule> alertFilterRules) {
    if (!alertFilterRules.isEmpty()) {
      boolean result;
      String completeCondition = buildCompleteCondition(alertFilterRules);
      AlertsRuleEvaluator ruleEvaluator = new AlertsRuleEvaluator(changeEvent);
      Expression expression = parseExpression(completeCondition);
      result = Boolean.TRUE.equals(expression.getValue(ruleEvaluator, Boolean.class));
      LOG.debug("Alert evaluated as Result : {}", result);
      return result;
    } else {
      return true;
    }
  }

  public static String buildCompleteCondition(List<EventFilterRule> alertFilterRules) {
    StringBuilder builder = new StringBuilder();
    for (int i = 0; i < alertFilterRules.size(); i++) {
      EventFilterRule rule = alertFilterRules.get(i);
      builder.append("(");
      if (rule.getEffect() == ArgumentsInput.Effect.INCLUDE) {
        builder.append(rule.getCondition());
      } else {
        builder.append("!");
        builder.append(rule.getCondition());
      }
      builder.append(")");
      if (i != (alertFilterRules.size() - 1)) builder.append(" && ");
    }

    return builder.toString();
  }

  public static boolean shouldTriggerAlert(String entityType, FilteringRules config) {
    if (config == null) {
      return false;
    }
    // OpenMetadataWide Setting apply to all ChangeEvents
    if (config.getResources().size() == 1 && config.getResources().get(0).equals("all")) {
      return true;
    }

    // Trigger Specific Settings
    if (entityType.equals(THREAD)
        && (config.getResources().get(0).equals("announcement")
            || config.getResources().get(0).equals("task"))) {
      return true;
    }

    return config.getResources().contains(entityType); // Use Trigger Specific Settings
  }

  public static boolean shouldProcessActivityFeedRequest(ChangeEvent event) {
    // Check Trigger Conditions
    FilteringRules filteringRules =
        ActivityFeedAlertCache.getActivityFeedAlert().getFilteringRules();
    return AlertUtil.shouldTriggerAlert(event.getEntityType(), filteringRules)
        && AlertUtil.evaluateAlertConditions(event, filteringRules.getRules());
  }

  public static SubscriptionStatus buildSubscriptionStatus(
      SubscriptionStatus.Status status,
      Long lastSuccessful,
      Long lastFailure,
      Integer statusCode,
      String reason,
      Long nextAttempt,
      Long timeStamp) {
    return new SubscriptionStatus()
        .withStatus(status)
        .withLastSuccessfulAt(lastSuccessful)
        .withLastFailedAt(lastFailure)
        .withLastFailedStatusCode(statusCode)
        .withLastFailedReason(reason)
        .withNextAttempt(nextAttempt)
        .withTimestamp(timeStamp);
  }

  public static Map<ChangeEvent, Set<UUID>> getFilteredEvents(
      EventSubscription eventSubscription, Map<ChangeEvent, Set<UUID>> events) {
    return events.entrySet().stream()
        .filter(
            entry ->
                checkIfChangeEventIsAllowed(entry.getKey(), eventSubscription.getFilteringRules()))
        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
  }

  private static boolean checkIfChangeEventIsAllowed(
      ChangeEvent event, FilteringRules filteringRules) {
    boolean triggerChangeEvent =
        AlertUtil.shouldTriggerAlert(event.getEntityType(), filteringRules);

    if (triggerChangeEvent) {
      // Evaluate Rules
      triggerChangeEvent = AlertUtil.evaluateAlertConditions(event, filteringRules.getRules());

      if (triggerChangeEvent) {
        // Evaluate Actions
        triggerChangeEvent = AlertUtil.evaluateAlertConditions(event, filteringRules.getActions());
      }
    }

    return triggerChangeEvent;
  }

  public static EventSubscriptionOffset getStartingOffset(UUID eventSubscriptionId) {
    long eventSubscriptionOffset;
    String json =
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .getSubscriberExtension(eventSubscriptionId.toString(), OFFSET_EXTENSION);
    if (json != null) {
      EventSubscriptionOffset offsetFromDb =
          JsonUtils.readValue(json, EventSubscriptionOffset.class);
      eventSubscriptionOffset = offsetFromDb.getOffset();
    } else {
      eventSubscriptionOffset = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
    }
    return new EventSubscriptionOffset().withOffset(eventSubscriptionOffset);
  }

  public static FilteringRules validateAndBuildFilteringConditions(
      CreateEventSubscription createEventSubscription) {
    // Resource Validation
    List<EventFilterRule> finalRules = new ArrayList<>();
    List<EventFilterRule> actions = new ArrayList<>();
    List<String> resource = createEventSubscription.getResources();
    if (resource.size() > 1) {
      throw new BadRequestException(
          "Only one resource can be specified. Multiple resources are not supported.");
    }

    if (createEventSubscription
        .getAlertType()
        .equals(CreateEventSubscription.AlertType.NOTIFICATION)) {
      Map<String, EventFilterRule> supportedFilters =
          EventsSubscriptionRegistry.getEntityNotificationDescriptor(resource.get(0))
              .getSupportedFilters()
              .stream()
              .collect(
                  Collectors.toMap(
                      EventFilterRule::getName,
                      eventFilterRule ->
                          JsonUtils.deepCopy(eventFilterRule, EventFilterRule.class)));
      // Input validation
      if (createEventSubscription.getInput() != null) {
        listOrEmpty(createEventSubscription.getInput().getFilters())
            .forEach(
                argumentsInput ->
                    finalRules.add(
                        getFilterRule(
                            supportedFilters,
                            argumentsInput,
                            buildInputArgumentsMap(argumentsInput))));
      }
      return new FilteringRules()
          .withResources(resource)
          .withRules(finalRules)
          .withActions(Collections.emptyList());
    } else if (createEventSubscription
        .getAlertType()
        .equals(CreateEventSubscription.AlertType.OBSERVABILITY)) {
      // Build a Map of Entity Filter Name
      Map<String, EventFilterRule> supportedFilters =
          EventsSubscriptionRegistry.getObservabilityDescriptor(resource.get(0))
              .getSupportedFilters()
              .stream()
              .collect(
                  Collectors.toMap(
                      EventFilterRule::getName,
                      eventFilterRule ->
                          JsonUtils.deepCopy(eventFilterRule, EventFilterRule.class)));
      // Build a Map of Actions
      Map<String, EventFilterRule> supportedActions =
          EventsSubscriptionRegistry.getObservabilityDescriptor(resource.get(0))
              .getSupportedActions()
              .stream()
              .collect(
                  Collectors.toMap(
                      EventFilterRule::getName,
                      eventFilterRule ->
                          JsonUtils.deepCopy(eventFilterRule, EventFilterRule.class)));

      // Input validation
      if (createEventSubscription.getInput() != null) {
        listOrEmpty(createEventSubscription.getInput().getFilters())
            .forEach(
                argumentsInput ->
                    finalRules.add(
                        getFilterRule(
                            supportedFilters,
                            argumentsInput,
                            buildInputArgumentsMap(argumentsInput))));
        listOrEmpty(createEventSubscription.getInput().getActions())
            .forEach(
                argumentsInput ->
                    actions.add(
                        getFilterRule(
                            supportedActions,
                            argumentsInput,
                            buildInputArgumentsMap(argumentsInput))));
      }
      return new FilteringRules()
          .withResources(resource)
          .withRules(finalRules)
          .withActions(actions);
    }
    return null;
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
    result.append("'").append(valueList.get(0)).append("'");

    for (int i = 1; i < valueList.size(); i++) {
      result.append(",'").append(valueList.get(i)).append("'");
    }

    return result.toString();
  }
}
