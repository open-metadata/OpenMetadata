package org.openmetadata.service.rules;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.SemanticsRule;

public class RuleValidationException extends IllegalArgumentException {

  public RuleValidationException(SemanticsRule rule, String message) {
    super(formatMessage(rule, message));
  }

  public RuleValidationException(List<SemanticsRule> rules, String message) {
    super(formatMessage(rules, message));
  }

  public RuleValidationException(SemanticsRule rule, String message, Throwable throwable) {
    super(formatMessage(rule, message), throwable);
  }

  private static String formatMessage(SemanticsRule rule, String message) {
    return String.format(
        "Rule [%s] validation failed: %s. Rule context: %s",
        rule.getName(), message, rule.getDescription());
  }

  private static String formatMessage(List<SemanticsRule> rules, String message) {
    if (nullOrEmpty(rules)) {
      return message;
    }

    String rulesDetails =
        rules.stream()
            .map(
                rule ->
                    String.format(
                        "Rule [%s] validation failed: Rule context: %s",
                        rule.getName(), rule.getDescription()))
            .collect(Collectors.joining("\n"));

    return String.format("%s\n%s", message, rulesDetails);
  }
}
