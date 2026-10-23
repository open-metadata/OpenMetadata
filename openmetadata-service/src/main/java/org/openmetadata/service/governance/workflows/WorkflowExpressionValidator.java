package org.openmetadata.service.governance.workflows;

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

  // A value interpolated in code position as a JUEL variable reference (${<value>...}) — a
  // conditional edge's source node, or a timer's process-variable name — is limited to identifier
  // characters.
  private static final Pattern SAFE_VARIABLE_REFERENCE = Pattern.compile("^[A-Za-z0-9_]+$");

  private WorkflowExpressionValidator() {}

  public static boolean isSafeCondition(String condition) {
    return condition != null && SAFE_EDGE_CONDITION.matcher(condition).matches();
  }

  public static boolean isSafeNodeReference(String reference) {
    return reference != null && SAFE_VARIABLE_REFERENCE.matcher(reference).matches();
  }

  /**
   * A process-variable name interpolated alone in code position (an expiry timer's duration or date
   * variable) must read as a valid variable reference, nothing more.
   */
  public static boolean isSafeExpressionVariable(String variableName) {
    return isSafeNodeReference(variableName);
  }
}
