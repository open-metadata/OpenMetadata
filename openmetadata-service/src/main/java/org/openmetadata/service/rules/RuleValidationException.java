package org.openmetadata.service.rules;

import org.openmetadata.schema.type.SemanticsRule;

public class RuleValidationException extends IllegalArgumentException {

  public RuleValidationException(SemanticsRule rule, String message) {
    super(formatMessage(rule, message));
  }

  public RuleValidationException(SemanticsRule rule, String message, Throwable throwable) {
    super(formatMessage(rule, message), throwable);
  }

  private static String formatMessage(SemanticsRule rule, String message) {
    return String.format(
        "Rule [%s] validation failed: %s. Rule context: %s",
        rule.getName(), message, rule.getDescription());
  }
}
