package org.openmetadata.service.alerts;

import static org.openmetadata.service.Entity.ALERT;
import static org.openmetadata.service.Entity.ALERT_ACTION;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.security.policyevaluator.CompiledRule.parseExpression;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.alerts.Alert;
import org.openmetadata.schema.entity.alerts.AlertAction;
import org.openmetadata.schema.entity.alerts.AlertFilterRule;
import org.openmetadata.schema.entity.alerts.TriggerConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Function;
import org.openmetadata.schema.type.ParamAdditionalContext;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerts.emailAlert.EmailAlertPublisher;
import org.openmetadata.service.alerts.gchat.GChatWebhookPublisher;
import org.openmetadata.service.alerts.generic.GenericWebhookPublisher;
import org.openmetadata.service.alerts.msteams.MSTeamsWebhookPublisher;
import org.openmetadata.service.alerts.slack.SlackWebhookEventPublisher;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexResolver;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.CollectionRegistry;
import org.springframework.expression.Expression;
import org.springframework.expression.spel.support.StandardEvaluationContext;

@Slf4j
public class AlertUtil {

  public static AlertsActionPublisher getAlertPublisher(
      Alert alert, AlertAction alertAction, CollectionDAO daoCollection) {
    AlertsActionPublisher publisher;
    switch (alertAction.getAlertActionType()) {
      case SLACK_WEBHOOK:
        publisher = new SlackWebhookEventPublisher(alert, alertAction);
        break;
      case MS_TEAMS_WEBHOOK:
        publisher = new MSTeamsWebhookPublisher(alert, alertAction);
        break;
      case G_CHAT_WEBHOOK:
        publisher = new GChatWebhookPublisher(alert, alertAction);
        break;
      case GENERIC_WEBHOOK:
        publisher = new GenericWebhookPublisher(alert, alertAction);
        break;
      case EMAIL:
        publisher = new EmailAlertPublisher(alert, alertAction, daoCollection);
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

  public static Map<String, Function> getAlertFilterFunctions(ElasticSearchIndexResolver indexResolver) {
    Map<String, Function> alertFunctions = new HashMap<>();
    for (Function func : CollectionRegistry.getInstance().getFunctions(AlertsRuleEvaluator.class)) {
      AlertsRuleEvaluator.AlertRuleType type = AlertsRuleEvaluator.AlertRuleType.valueOf(func.getName());
      ParamAdditionalContext paramAdditionalContext = new ParamAdditionalContext();
      switch (type) {
        case matchAnySource:
          func.setParamAdditionalContext(paramAdditionalContext.withData(new HashSet<>(Entity.getEntityList())));
          break;
        case matchUpdatedBy:
        case matchAnyOwnerName:
          func.setParamAdditionalContext(
              paramAdditionalContext.withData(getEntitiesIndex(List.of(USER, TEAM), indexResolver)));
          break;
        case matchAnyEntityFqn:
        case matchAnyEntityId:
          func.setParamAdditionalContext(
              paramAdditionalContext.withData(getEntitiesIndex(Entity.getEntityList(), indexResolver)));
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

  public static Set<String> getEntitiesIndex(List<String> entities, ElasticSearchIndexResolver indexResolver) {
    Set<String> indexesToSearch = new HashSet<>();
    for (String entityType : entities) {
      try {
        ElasticSearchIndexDefinition.IndexTypeInfo typeInfo =
            ElasticSearchIndexDefinition.getIndexMappingByEntityType(entityType, indexResolver);
        indexesToSearch.add(typeInfo.getIndexInfo().getIndexName());
      } catch (RuntimeException ex) {
        LOG.error("Failing to get Index for EntityType");
      }
    }
    return indexesToSearch;
  }

  public static boolean evaluateAlertConditions(ChangeEvent changeEvent, List<AlertFilterRule> alertFilterRules) {
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

  public static String buildCompleteCondition(List<AlertFilterRule> alertFilterRules) {
    StringBuilder builder = new StringBuilder();
    for (int i = 0; i < alertFilterRules.size(); i++) {
      AlertFilterRule rule = alertFilterRules.get(i);
      builder.append("(");
      if (rule.getEffect() == AlertFilterRule.Effect.INCLUDE) {
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

  public static List<TriggerConfig> getDefaultAlertTriggers() {
    List<TriggerConfig> triggerConfigs = new ArrayList<>();
    TriggerConfig allMetadataTrigger = new TriggerConfig().withType(TriggerConfig.AlertTriggerType.ALL_DATA_ASSETS);
    TriggerConfig specificDataAsset = new TriggerConfig().withType(TriggerConfig.AlertTriggerType.SPECIFIC_DATA_ASSET);
    Set<String> entities = new HashSet<>(Entity.getEntityList());
    // Alert and Alert Action should be removed from entities list
    entities.remove(ALERT);
    entities.remove(ALERT_ACTION);
    specificDataAsset.setEntities(entities);

    triggerConfigs.add(allMetadataTrigger);
    triggerConfigs.add(specificDataAsset);

    return triggerConfigs;
  }

  public static boolean shouldTriggerAlert(String entityType, TriggerConfig config) {
    // OpenMetadataWide Setting apply to all ChangeEvents
    if (config.getType() == TriggerConfig.AlertTriggerType.ALL_DATA_ASSETS) {
      return true;
    }
    return config.getEntities().contains(entityType); // Use Trigger Specific Settings
  }

  public static boolean shouldProcessActivityFeedRequest(ChangeEvent event) {
    // Check Trigger Conditions
    if (!AlertUtil.shouldTriggerAlert(
        event.getEntityType(), ActivityFeedAlertCache.getInstance().getActivityFeedAlert().getTriggerConfig())) {
      return false;
    }
    // Check Spel Conditions
    return AlertUtil.evaluateAlertConditions(
        event, ActivityFeedAlertCache.getInstance().getActivityFeedAlert().getFilteringRules());
  }
}
