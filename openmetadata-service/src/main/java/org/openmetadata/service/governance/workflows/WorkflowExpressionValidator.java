package org.openmetadata.service.governance.workflows;

import java.util.regex.Pattern;

/**
 * Restricts the governance-workflow edge values that get interpolated into Flowable JUEL
 * sequence-flow expressions ({@code ${from_result == 'condition'}}) to a well-formed character set,
 * so only valid comparison values and variable references reach the generated expression.
 */
public final class WorkflowExpressionValidator {
  // Edge conditions are embedded inside a quoted JUEL string literal (${var == 'condition'}) as an
  // inert comparison value. Allow the punctuation legitimate conditions use (e.g. "Tier.Gold") and
  // exclude characters that are not part of a well-formed literal value.
  private static final Pattern SAFE_EDGE_CONDITION = Pattern.compile("^[A-Za-z0-9 ._-]+$");

  // A conditional edge's source ('from') lands in code position as the JUEL variable-name prefix
  // (${from_result == ...}); a valid variable reference is limited to identifier characters.
  private static final Pattern SAFE_NODE_REFERENCE = Pattern.compile("^[A-Za-z0-9_]+$");

  private WorkflowExpressionValidator() {}

  public static boolean isSafeCondition(String condition) {
    return condition != null && SAFE_EDGE_CONDITION.matcher(condition).matches();
  }

  public static boolean isSafeNodeReference(String reference) {
    return reference != null && SAFE_NODE_REFERENCE.matcher(reference).matches();
  }
}
