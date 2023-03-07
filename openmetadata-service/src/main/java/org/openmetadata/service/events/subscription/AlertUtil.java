package org.openmetadata.service.events.subscription;

import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.security.policyevaluator.CompiledRule.parseExpression;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
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
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.events.subscription.emailAlert.EmailPublisher;
import org.openmetadata.service.events.subscription.gchat.GChatPublisher;
import org.openmetadata.service.events.subscription.generic.GenericPublisher;
import org.openmetadata.service.events.subscription.msteams.MSTeamsPublisher;
import org.openmetadata.service.events.subscription.slack.SlackEventPublisher;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.CollectionRegistry;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.support.StandardEvaluationContext;

@Slf4j
public class AlertUtil {

  public static SubscriptionPublisher getAlertPublisher(EventSubscription subscription, CollectionDAO daoCollection) {
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

  public static <T> T validateExpression(String condition, Class<T> clz) {
    if (condition == null) {
      return null;
    }
    Expression expression = parseExpression(condition);
    AlertsRuleEvaluator ruleEvaluator = new AlertsRuleEvaluator(null);
    try {
      return expression.getValue(ruleEvaluator, clz);
    } catch (Exception exception) {
      // Remove unnecessary class details in the exception message
      String message = exception.getMessage().replaceAll("on type .*$", "").replaceAll("on object .*$", "");
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
          func.setParamAdditionalContext(paramAdditionalContext.withData(new HashSet<>(Entity.getEntityList())));
          break;
        case matchUpdatedBy:
        case matchAnyOwnerName:
          func.setParamAdditionalContext(paramAdditionalContext.withData(getEntitiesIndex(List.of(USER, TEAM))));
          break;
        case matchAnyEntityFqn:
        case matchAnyEntityId:
          func.setParamAdditionalContext(paramAdditionalContext.withData(getEntitiesIndex(Entity.getEntityList())));
          break;
        case matchAnyEventType:
          List<String> eventTypes = Stream.of(EventType.values()).map(EventType::value).collect(Collectors.toList());
          func.setParamAdditionalContext(paramAdditionalContext.withData(new HashSet<>(eventTypes)));
          break;
        case matchIngestionPipelineState:
          List<String> ingestionPipelineState =
              Stream.of(PipelineStatusType.values()).map(PipelineStatusType::value).collect(Collectors.toList());
          func.setParamAdditionalContext(paramAdditionalContext.withData(new HashSet<>(ingestionPipelineState)));
          break;
        case matchTestResult:
          List<String> testResultStatus =
              Stream.of(TestCaseStatus.values()).map(TestCaseStatus::value).collect(Collectors.toList());
          func.setParamAdditionalContext(paramAdditionalContext.withData(new HashSet<>(testResultStatus)));
      }
      alertFunctions.put(func.getName(), func);
    }
    return alertFunctions;
  }

  public static Set<String> getEntitiesIndex(List<String> entities) {
    Set<String> indexesToSearch = new HashSet<>();
    for (String entityType : entities) {
      try {
        ElasticSearchIndexDefinition.ElasticSearchIndexType type =
            ElasticSearchIndexDefinition.getIndexMappingByEntityType(entityType);
        indexesToSearch.add(type.indexName);
      } catch (RuntimeException ex) {
        LOG.error("Failing to get Index for EntityType");
      }
    }
    return indexesToSearch;
  }

  public static boolean evaluateAlertConditions(ChangeEvent changeEvent, List<EventFilterRule> alertFilterRules) {
    if (alertFilterRules.size() > 0) {
      boolean result;
      String completeCondition = buildCompleteCondition(alertFilterRules);
      AlertsRuleEvaluator ruleEvaluator = new AlertsRuleEvaluator(changeEvent);
      StandardEvaluationContext evaluationContext = new StandardEvaluationContext(ruleEvaluator);
      Expression expression = parseExpression(completeCondition);
      result = Boolean.TRUE.equals(expression.getValue(evaluationContext, Boolean.class));
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
    if (config.getResources().size() == 1 && config.getResources().get(0).equals("all")) {
      return true;
    }
    return config.getResources().contains(entityType); // Use Trigger Specific Settings
  }

  public static boolean shouldProcessActivityFeedRequest(ChangeEvent event) {
    // Check Trigger Conditions
    if (!AlertUtil.shouldTriggerAlert(
        event.getEntityType(), ActivityFeedAlertCache.getInstance().getActivityFeedAlert().getFilteringRules())) {
      return false;
    }
    // Check Spel Conditions
    return AlertUtil.evaluateAlertConditions(
        event, ActivityFeedAlertCache.getInstance().getActivityFeedAlert().getFilteringRules().getRules());
  }

  public static SubscriptionStatus buildSubscriptionStatus(SubscriptionStatus.Status status, Long lastSuccessful, Long lastFailure, Integer statusCode, String reason, Long nextAttempt, Long timeStamp){
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
