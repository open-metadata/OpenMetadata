package org.openmetadata.service.alerts;

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
import org.openmetadata.schema.entity.alerts.Alert;
import org.openmetadata.schema.entity.alerts.AlertAction;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Function;
import org.openmetadata.schema.type.ParamAdditionalContext;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerts.emailAlert.EmailAlertPublisher;
import org.openmetadata.service.alerts.generic.GenericWebhookPublisher;
import org.openmetadata.service.alerts.msteams.MSTeamsWebhookPublisher;
import org.openmetadata.service.alerts.slack.SlackWebhookEventPublisher;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.CollectionRegistry;
import org.springframework.expression.Expression;

@Slf4j
public class AlertUtil {

  public static AlertsActionPublisher getAlertPublisher(
      Alert alert, AlertAction alertAction, CollectionDAO daoCollection) {
    AlertsActionPublisher publisher;
    switch (alertAction.getAlertActionType()) {
      case SLACK_WEBHOOK:
        publisher = new SlackWebhookEventPublisher(alert, alertAction, daoCollection);
        break;
      case MS_TEAMS_WEBHOOK:
        publisher = new MSTeamsWebhookPublisher(alert, alertAction, daoCollection);
        break;
      case GENERIC_WEBHOOK:
        publisher = new GenericWebhookPublisher(alert, alertAction, daoCollection);
        break;
      case EMAIL:
        publisher = new EmailAlertPublisher(alert, alertAction, daoCollection);
        break;
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
      AlertsRuleEvaluator.AlertRuleType type = AlertsRuleEvaluator.AlertRuleType.valueOf(func.getName());
      ParamAdditionalContext paramAdditionalContext = new ParamAdditionalContext();
      switch (type) {
        case matchAnySource:
          func.setParamAdditionalContext(paramAdditionalContext.withData(new HashSet<>(Entity.getEntityList())));
          break;
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
}
