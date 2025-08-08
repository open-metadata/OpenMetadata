package org.openmetadata.dsl.core;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class DSLParser {

  public static DSLCondition parseCondition(String expression) {
    // For now, simple implementation - in real system this would use ANTLR parser
    return DSLCondition.builder().expression(expression).type("parsed").build();
  }

  public static List<DSLAction> parseActions(String actionsExpression) {
    // For now, simple implementation - in real system this would parse complex action chains
    List<DSLAction> actions = new ArrayList<>();

    // Simple parsing for demo purposes
    if (actionsExpression.contains("notify")) {
      actions.add(DSLAction.notify("slack"));
    }
    if (actionsExpression.contains("webhook")) {
      actions.add(DSLAction.webhook("http://example.com"));
    }
    if (actionsExpression.contains("ticket")) {
      actions.add(DSLAction.createTicket("JIRA"));
    }

    return actions;
  }

  public static DSLCondition parseConditionWithParameters(
      String template, Map<String, Object> parameters) {
    String processedExpression = template;

    // Simple parameter substitution
    for (Map.Entry<String, Object> param : parameters.entrySet()) {
      String placeholder = "${" + param.getKey() + "}";
      String value = param.getValue().toString();
      processedExpression = processedExpression.replace(placeholder, value);
    }

    return parseCondition(processedExpression);
  }
}
