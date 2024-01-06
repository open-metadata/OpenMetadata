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
import static org.openmetadata.schema.api.events.CreateEventSubscription.SubscriptionType.ACTIVITY_FEED;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer.OFFSET_EXTENSION;
import static org.openmetadata.service.security.policyevaluator.CompiledRule.parseExpression;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.ws.rs.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.events.Observability;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.EventSubscriptionOffset;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.entity.events.ObservabilityFilters;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Function;
import org.openmetadata.schema.type.ParamAdditionalContext;
import org.openmetadata.schema.type.SubscriptionFilterOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;
import org.openmetadata.service.apps.bundles.changeEvent.email.EmailPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.gchat.GChatPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.generic.GenericPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.MSTeamsPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.slack.SlackEventPublisher;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.search.models.IndexMapping;
import org.openmetadata.service.util.JsonUtils;
import org.springframework.expression.Expression;

@Slf4j
public final class AlertUtil {
  private AlertUtil() {}

  public static AbstractEventConsumer getNotificationsPublisher(EventSubscription subscription) {
    validateSubscriptionConfig(subscription);
    return switch (subscription.getSubscriptionType()) {
      case SLACK_WEBHOOK -> new SlackEventPublisher();
      case MS_TEAMS_WEBHOOK -> new MSTeamsPublisher();
      case G_CHAT_WEBHOOK -> new GChatPublisher();
      case GENERIC_WEBHOOK -> new GenericPublisher();
      case EMAIL -> new EmailPublisher();
      case ACTIVITY_FEED -> throw new IllegalArgumentException(
          "Cannot create Activity Feed as Publisher.");
      default -> throw new IllegalArgumentException("Invalid Alert Action Specified.");
    };
  }

  public static void validateSubscriptionConfig(EventSubscription eventSubscription) {
    // Alert Type Validation
    if (eventSubscription.getAlertType() != CreateEventSubscription.AlertType.CHANGE_EVENT) {
      throw new IllegalArgumentException("Invalid Alert Type");
    }

    // Subscription Config Validation
    if (ACTIVITY_FEED.equals(eventSubscription.getSubscriptionType())) {
      return;
    }
    if (eventSubscription.getSubscriptionConfig() == null) {
      throw new BadRequestException("subscriptionConfig cannot be null.");
    }
  }

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

  public static Map<String, Function> getAlertFilterFunctions() {
    Map<String, Function> alertFunctions = new HashMap<>();
    for (Function func : CollectionRegistry.getInstance().getFunctions(AlertsRuleEvaluator.class)) {
      SubscriptionFilterOperation type = SubscriptionFilterOperation.valueOf(func.getName());
      ParamAdditionalContext paramAdditionalContext = new ParamAdditionalContext();
      switch (type) {
        case matchAnySource -> func.setParamAdditionalContext(
            paramAdditionalContext.withData(new HashSet<>(Entity.getEntityList())));
        case matchUpdatedBy, matchAnyOwnerName -> func.setParamAdditionalContext(
            paramAdditionalContext.withData(getEntitiesIndex(List.of(USER, TEAM))));
        case matchAnyEntityFqn, matchAnyEntityId -> func.setParamAdditionalContext(
            paramAdditionalContext.withData(getEntitiesIndex(Entity.getEntityList())));
        case matchAnyEventType -> {
          List<String> eventTypes = Stream.of(EventType.values()).map(EventType::value).toList();
          func.setParamAdditionalContext(
              paramAdditionalContext.withData(new HashSet<>(eventTypes)));
        }
        case matchIngestionPipelineState -> {
          List<String> ingestionPipelineState =
              Stream.of(PipelineStatusType.values()).map(PipelineStatusType::value).toList();
          func.setParamAdditionalContext(
              paramAdditionalContext.withData(new HashSet<>(ingestionPipelineState)));
        }
        case matchTestResult -> {
          List<String> testResultStatus =
              Stream.of(TestCaseStatus.values()).map(TestCaseStatus::value).toList();
          func.setParamAdditionalContext(
              paramAdditionalContext.withData(new HashSet<>(testResultStatus)));
        }
        default -> LOG.error("Invalid Function name : {}", type);
      }
      alertFunctions.put(func.getName(), func);
    }
    return alertFunctions;
  }

  public static Set<String> getEntitiesIndex(List<String> entities) {
    Set<String> indexesToSearch = new HashSet<>();
    for (String entityType : entities) {
      try {
        IndexMapping indexMapping = Entity.getSearchRepository().getIndexMapping(entityType);
        indexesToSearch.add(indexMapping.getIndexName());
      } catch (RuntimeException ex) {
        LOG.error("Failing to get Index for EntityType");
      }
    }
    return indexesToSearch;
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
      if (rule.getEffect() == EventFilterRule.Effect.INCLUDE) {
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
    // OpenMetadataWide Setting apply to all ChangeEvents
    if (config == null
        || (config.getResources().size() == 1 && config.getResources().get(0).equals("all"))) {
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

  public static List<ChangeEvent> getFilteredEvent(
      List<ChangeEvent> events, FilteringRules filteringRules) {
    List<ChangeEvent> filteredEvents = new ArrayList<>();
    for (ChangeEvent event : events) {
      boolean triggerChangeEvent =
          AlertUtil.shouldTriggerAlert(event.getEntityType(), filteringRules);

      if (filteringRules != null) {
        // Evaluate Rules
        triggerChangeEvent = AlertUtil.evaluateAlertConditions(event, filteringRules.getRules());

        if (triggerChangeEvent) {
          // Evaluate Actions
          triggerChangeEvent =
              AlertUtil.evaluateAlertConditions(event, filteringRules.getActions());
        }
      }

      if (triggerChangeEvent) {
        filteredEvents.add(event);
      }
    }
    return filteredEvents;
  }

  public static EventSubscriptionOffset getInitialAlertOffsetFromDb(UUID eventSubscriptionId) {
    int eventSubscriptionOffset;
    String json =
        Entity.getCollectionDAO()
            .eventSubscriptionDAO()
            .getSubscriberExtension(eventSubscriptionId.toString(), OFFSET_EXTENSION);
    if (json != null) {
      EventSubscriptionOffset offsetFromDb =
          JsonUtils.readValue(json, EventSubscriptionOffset.class);
      eventSubscriptionOffset = offsetFromDb.getOffset();
    } else {
      eventSubscriptionOffset = Entity.getCollectionDAO().changeEventDAO().listCount();
    }
    return new EventSubscriptionOffset().withOffset(eventSubscriptionOffset);
  }

  public static FilteringRules validateAndBuildFilteringConditions(
      CreateEventSubscription createEventSubscription) {
    // Resource Validation
    List<EventFilterRule> finalRules = new ArrayList<>();
    List<EventFilterRule> actions = new ArrayList<>();
    List<String> resource = createEventSubscription.getFilteringRules().getResources();
    if (resource.size() > 1) {
      throw new BadRequestException(
          "Only one resource can be specified for Observability filtering");
    }

    // Build a Map of Entity Filter Name
    Map<String, EventFilterRule> supportedFilters =
        EventsSubscriptionRegistry.getObservabilityDescriptor(resource.get(0))
            .getSupportedFilters()
            .stream()
            .collect(
                Collectors.toMap(EventFilterRule::getName, eventFilterRule -> eventFilterRule));
    // Build a Map of Actions
    Map<String, EventFilterRule> supportedActions =
        EventsSubscriptionRegistry.getObservabilityDescriptor(resource.get(0))
            .getSupportedActions()
            .stream()
            .collect(
                Collectors.toMap(EventFilterRule::getName, eventFilterRule -> eventFilterRule));

    // Input validation
    if (createEventSubscription.getObservability() != null) {
      Observability obscFilter = createEventSubscription.getObservability();
      listOrEmpty(obscFilter.getFilters())
          .forEach(
              filter ->
                  finalRules.add(
                      getFilterRule(
                          supportedFilters, filter.getName(), buildInputArgumentsMap(filter))));
      listOrEmpty(obscFilter.getActions())
          .forEach(
              action ->
                  actions.add(
                      getFilterRule(
                          supportedActions, action.getName(), buildInputArgumentsMap(action))));
    }
    return new FilteringRules()
        .withResources(createEventSubscription.getFilteringRules().getResources())
        .withRules(finalRules)
        .withActions(actions);
  }

  private static Map<String, List<String>> buildInputArgumentsMap(ObservabilityFilters filter) {
    return filter.getArguments().stream()
        .collect(Collectors.toMap(Argument::getName, Argument::getInput));
  }

  private static EventFilterRule getFilterRule(
      Map<String, EventFilterRule> supportedFilters,
      String name,
      Map<String, List<String>> inputArgMap) {
    if (!supportedFilters.containsKey(name)) {
      throw new BadRequestException("Give Resource doesn't support the filter " + name);
    }
    EventFilterRule rule = supportedFilters.get(name);
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
                String.format("${%s}", argName), convertInputListToString(inputList));
      }
      return rule.withCondition(formulatedCondition);
    }
  }

  private static String convertInputListToString(List<String> valueList) {
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
