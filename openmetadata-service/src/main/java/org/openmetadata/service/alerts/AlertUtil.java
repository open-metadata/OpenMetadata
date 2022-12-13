package org.openmetadata.service.alerts;

import static org.openmetadata.service.security.policyevaluator.CompiledRule.parseExpression;

import org.openmetadata.schema.entity.alerts.Alert;
import org.openmetadata.schema.entity.alerts.AlertAction;
import org.openmetadata.service.alerts.emailAlert.EmailAlertPublisher;
import org.openmetadata.service.alerts.generic.GenericWebhookPublisher;
import org.openmetadata.service.alerts.msteams.MSTeamsWebhookPublisher;
import org.openmetadata.service.alerts.slack.SlackWebhookEventPublisher;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.springframework.expression.Expression;

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
}
