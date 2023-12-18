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

import static org.openmetadata.schema.api.events.CreateEventSubscription.SubscriptionType.ACTIVITY_FEED;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.security.policyevaluator.CompiledRule.parseExpression;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;
import javax.ws.rs.BadRequestException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventFilterRule;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.FilteringRules;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Function;
import org.openmetadata.schema.type.ParamAdditionalContext;
import org.openmetadata.schema.type.SubscriptionFilterOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.email.EmailPublisher;
import org.openmetadata.service.events.subscription.gchat.GChatPublisher;
import org.openmetadata.service.events.subscription.generic.GenericPublisher;
import org.openmetadata.service.events.subscription.msteams.MSTeamsPublisher;
import org.openmetadata.service.events.subscription.slack.SlackEventPublisher;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.CollectionRegistry;
import org.openmetadata.service.search.models.IndexMapping;
import org.springframework.expression.Expression;

@Slf4j
public final class AlertUtil {
  private AlertUtil() {}

  public static SubscriptionPublisher getNotificationsPublisher(
      EventSubscription subscription, CollectionDAO daoCollection) {
    validateSubscriptionConfig(subscription);
    SubscriptionPublisher publisher;
    switch (subscription.getSubscriptionType()) {
      case SLACK_WEBHOOK:
        publisher = new SlackEventPublisher(subscription, daoCollection);
        break;
      case MS_TEAMS_WEBHOOK:
        publisher = new MSTeamsPublisher(subscription, daoCollection);
        break;
      case G_CHAT_WEBHOOK:
        publisher = new GChatPublisher(subscription, daoCollection);
        break;
      case GENERIC_WEBHOOK:
        publisher = new GenericPublisher(subscription, daoCollection);
        break;
      case EMAIL:
        publisher = new EmailPublisher(subscription, daoCollection);
        break;
      case ACTIVITY_FEED:
        throw new IllegalArgumentException("Cannot create Activity Feed as Publisher.");
      default:
        throw new IllegalArgumentException("Invalid Alert Action Specified.");
    }
    return publisher;
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
        case matchAnySource:
          func.setParamAdditionalContext(
              paramAdditionalContext.withData(new HashSet<>(Entity.getEntityList())));
          break;
        case matchUpdatedBy:
        case matchAnyOwnerName:
          func.setParamAdditionalContext(
              paramAdditionalContext.withData(getEntitiesIndex(List.of(USER, TEAM))));
          break;
        case matchAnyEntityFqn:
        case matchAnyEntityId:
          func.setParamAdditionalContext(
              paramAdditionalContext.withData(getEntitiesIndex(Entity.getEntityList())));
          break;
        case matchAnyEventType:
          List<String> eventTypes = Stream.of(EventType.values()).map(EventType::value).toList();
          func.setParamAdditionalContext(
              paramAdditionalContext.withData(new HashSet<>(eventTypes)));
          break;
        case matchIngestionPipelineState:
          List<String> ingestionPipelineState =
              Stream.of(PipelineStatusType.values()).map(PipelineStatusType::value).toList();
          func.setParamAdditionalContext(
              paramAdditionalContext.withData(new HashSet<>(ingestionPipelineState)));
          break;
        case matchTestResult:
          List<String> testResultStatus =
              Stream.of(TestCaseStatus.values()).map(TestCaseStatus::value).toList();
          func.setParamAdditionalContext(
              paramAdditionalContext.withData(new HashSet<>(testResultStatus)));
          break;
        default:
          LOG.error("Invalid Function name : {}", type);
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
    if (config == null) {
      return true;
    }
    if (config.getResources().size() == 1 && config.getResources().get(0).equals("all")) {
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
}
