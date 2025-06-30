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
import static org.openmetadata.service.Entity.TEST_SUITE;
import static org.openmetadata.service.Entity.THREAD;
import static org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer.OFFSET_EXTENSION;
import static org.openmetadata.service.security.policyevaluator.CompiledRule.parseExpression;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.entity.events.StatusContext;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.entity.events.TestDestinationStatus;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.support.SimpleEvaluationContext;

@Slf4j
public final class AlertUtil {
  private AlertUtil() {}

  public static <T> void validateExpression(String condition, Class<T> clz) {
    if (condition == null) {
      return;
    }
    Expression expression = parseExpression(condition);
    AlertsRuleEvaluator ruleEvaluator = new AlertsRuleEvaluator(null);
    SimpleEvaluationContext context =
        SimpleEvaluationContext.forReadOnlyDataBinding()
            .withInstanceMethods()
            .withRootObject(ruleEvaluator)
            .build();
    try {
      expression.getValue(context, clz);
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
      SimpleEvaluationContext context =
          SimpleEvaluationContext.forReadOnlyDataBinding()
              .withInstanceMethods()
              .withRootObject(ruleEvaluator)
              .build();
      result = Boolean.TRUE.equals(expression.getValue(context, Boolean.class));
      LOG.debug("Alert evaluated as Result : {}", result);
      return result;
    } else {
      return true;
    }
  }

  public static String buildCompleteCondition(List<EventFilterRule> alertFilterRules) {
    StringBuilder builder = new StringBuilder();
    for (int i = 0; i < alertFilterRules.size(); i++) {
      builder.append(getWrappedCondition(alertFilterRules.get(i), i));
    }
    return builder.toString();
  }

  private static String getWrappedCondition(EventFilterRule rule, int index) {
    String prefixCondition = "";

    // First Condition, no need to add prefix
    if (index != 0) {
      String rawCondition = getRawCondition(rule.getPrefixCondition());
      prefixCondition = nullOrEmpty(rawCondition) ? " && " : rawCondition;
    }

    StringBuilder builder = new StringBuilder();
    builder.append("(");
    if (rule.getEffect() == ArgumentsInput.Effect.INCLUDE) {
      builder.append(rule.getCondition());
    } else {
      builder.append("!");
      builder.append(rule.getCondition());
    }
    builder.append(")");
    return String.format("%s%s", prefixCondition, builder);
  }

  private static String getRawCondition(ArgumentsInput.PrefixCondition prefixCondition) {
    if (prefixCondition.equals(ArgumentsInput.PrefixCondition.AND)) {
      return " && ";
    } else if (prefixCondition.equals(ArgumentsInput.PrefixCondition.OR)) {
      return " || ";
    } else {
      return "";
    }
  }

  public static boolean shouldTriggerAlert(ChangeEvent event, FilteringRules config) {
    if (config == null) {
      return true;
    }
    // OpenMetadataWide Setting apply to all ChangeEvents
    if (config.getResources().size() == 1 && config.getResources().get(0).equals("all")) {
      return true;
    }

    // Trigger Specific Settings
    if (event.getEntityType().equals(THREAD)
        && (config.getResources().get(0).equals("announcement")
            || config.getResources().get(0).equals("task")
            || config.getResources().get(0).equals("conversation"))) {
      Thread thread = AlertsRuleEvaluator.getThread(event);
      return config.getResources().get(0).equalsIgnoreCase(thread.getType().value());
    }

    // Test Suite
    if (config.getResources().get(0).equals(TEST_SUITE)) {
      return event.getEntityType().equals(TEST_SUITE)
          || event.getEntityType().equals(Entity.TEST_CASE);
    }

    return config.getResources().contains(event.getEntityType()); // Use Trigger Specific Settings
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

  public static TestDestinationStatus buildTestDestinationStatus(
      TestDestinationStatus.Status status, Integer statusCode, Long timestamp) {
    return new TestDestinationStatus()
        .withStatus(status)
        .withStatusCode(statusCode)
        .withTimestamp(timestamp);
  }

  public static TestDestinationStatus buildTestDestinationStatus(
      TestDestinationStatus.Status status, StatusContext statusContext) {
    return new TestDestinationStatus()
        .withStatus(status)
        .withReason(statusContext.getStatusInfo())
        .withStatusCode(statusContext.getStatusCode())
        .withStatusInfo(statusContext.getStatusInfo())
        .withHeaders(statusContext.getHeaders())
        .withEntity(statusContext.getEntity())
        .withMediaType(statusContext.getMediaType())
        .withLocation(URI.create(statusContext.getLocation()))
        .withTimestamp(statusContext.getTimestamp());
  }

  public static Map<ChangeEvent, Set<UUID>> getFilteredEvents(
      EventSubscription eventSubscription, Map<ChangeEvent, Set<UUID>> events) {
    return events.entrySet().stream()
        .filter(
            entry ->
                checkIfChangeEventIsAllowed(entry.getKey(), eventSubscription.getFilteringRules()))
        .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
  }

  public static boolean checkIfChangeEventIsAllowed(
      ChangeEvent event, FilteringRules filteringRules) {
    boolean triggerChangeEvent = AlertUtil.shouldTriggerAlert(event, filteringRules);

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
    long startingOffset;
    long currentOffset;
    String json =
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .getSubscriberExtension(eventSubscriptionId.toString(), OFFSET_EXTENSION);
    if (json != null) {
      EventSubscriptionOffset offsetFromDb =
          JsonUtils.readValue(json, EventSubscriptionOffset.class);
      startingOffset = offsetFromDb.getStartingOffset();
      currentOffset = offsetFromDb.getCurrentOffset();
    } else {
      currentOffset = Entity.getCollectionDAO().changeEventDAO().getLatestOffset();
      startingOffset = currentOffset;
    }
    return new EventSubscriptionOffset()
        .withCurrentOffset(currentOffset)
        .withStartingOffset(startingOffset);
  }

  public static FilteringRules validateAndBuildFilteringConditions(
      List<String> resource,
      CreateEventSubscription.AlertType alertType,
      AlertFilteringInput input) {
    if (resource.size() != 1) {
      throw new BadRequestException(
          "One resource can be specified. Zero or Multiple resources are not supported.");
    }

    if (alertType.equals(CreateEventSubscription.AlertType.NOTIFICATION)) {
      Map<String, EventFilterRule> supportedFilters =
          buildFilteringRulesMap(
              EventsSubscriptionRegistry.getEntityNotificationDescriptor(resource.get(0))
                  .getSupportedFilters());
      // Input validation
      if (input != null) {
        return new FilteringRules()
            .withResources(resource)
            .withRules(buildRulesList(supportedFilters, input.getFilters()))
            .withActions(Collections.emptyList());
      }
    } else if (alertType.equals(CreateEventSubscription.AlertType.OBSERVABILITY)) {
      // Build a Map of Entity Filter Name
      Map<String, EventFilterRule> supportedFilters =
          buildFilteringRulesMap(
              EventsSubscriptionRegistry.getObservabilityDescriptor(resource.get(0))
                  .getSupportedFilters());

      // Build a Map of Actions
      Map<String, EventFilterRule> supportedActions =
          buildFilteringRulesMap(
              EventsSubscriptionRegistry.getObservabilityDescriptor(resource.get(0))
                  .getSupportedActions());

      // Input validation
      if (input != null) {
        return new FilteringRules()
            .withResources(resource)
            .withRules(buildRulesList(supportedFilters, input.getFilters()))
            .withActions(buildRulesList(supportedActions, input.getActions()));
      }
    }
    return new FilteringRules()
        .withResources(resource)
        .withRules(Collections.emptyList())
        .withActions(Collections.emptyList());
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
