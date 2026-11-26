package org.openmetadata.service.governance.workflows;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * Restricts the governance-workflow values that get interpolated into Flowable JUEL expressions
 * (sequence-flow conditions, timer event definitions) to well-formed identifiers and comparison
 * values, so only valid variable references and inert literals reach the generated expression.
 */
public final class WorkflowExpressionValidator {
  // Edge conditions are embedded inside a quoted JUEL string literal (${var == 'condition'}) as an
  // inert comparison value. Require at least one alphanumeric character (a value of only spaces or
  // punctuation is a meaningless condition) and allow the separators legitimate conditions use
  // (e.g. "Tier.Gold").
  private static final Pattern SAFE_EDGE_CONDITION =
      Pattern.compile("^(?=.*[A-Za-z0-9])[A-Za-z0-9 ._-]+$");

  // A conditional edge's source node lands in code position as the JUEL variable-name prefix
  // (${from_result == ...}); a valid variable reference is limited to identifier characters.
  private static final Pattern SAFE_NODE_REFERENCE = Pattern.compile("^[A-Za-z0-9_]+$");

  // A process-variable name interpolated alone in code position (${<name>}) must parse as a JUEL
  // variable reference — it cannot start with a digit (JUEL would read it as a number) and it
  // cannot be one of the tokens JUEL treats as literals or operators.
  private static final Pattern SAFE_EXPRESSION_VARIABLE =
      Pattern.compile("^[A-Za-z_][A-Za-z0-9_]*$");

  private static final Set<String> JUEL_RESERVED_WORDS =
      Set.of(
          "true",
          "false",
          "null",
          "empty",
          "and",
          "or",
          "not",
          "div",
          "mod",
          "instanceof",
          "eq",
          "ne",
          "lt",
          "le",
          "gt",
          "ge");

  private WorkflowExpressionValidator() {}

  public static boolean isSafeCondition(String condition) {
    return condition != null && SAFE_EDGE_CONDITION.matcher(condition).matches();
  }

  public static boolean isSafeNodeReference(String reference) {
    return reference != null && SAFE_NODE_REFERENCE.matcher(reference).matches();
  }

  /**
   * A process-variable name interpolated alone in code position (an expiry timer's duration or date
   * variable) must read as a valid variable reference: identifier characters, not starting with a
   * digit, and not a reserved word.
   */
  public static boolean isSafeExpressionVariable(String variableName) {
    return variableName != null
        && SAFE_EXPRESSION_VARIABLE.matcher(variableName).matches()
        && !JUEL_RESERVED_WORDS.contains(variableName);
  }
}
