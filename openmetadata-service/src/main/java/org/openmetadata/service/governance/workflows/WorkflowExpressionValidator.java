package org.openmetadata.service.governance.workflows;

import java.util.regex.Pattern;

/**
 * Guards user-supplied workflow-definition values that get interpolated into Flowable JUEL
 * expressions on the governance-workflow edges. Without this, a crafted edge condition or node
 * reference can break out of the generated expression and achieve JUEL/Java expression injection
 * leading to remote code execution (GHSA-cq2r-82mr-xv2h).
 */
public final class WorkflowExpressionValidator {
  // Edge conditions are embedded inside a quoted JUEL string literal (${var == 'condition'}) where
  // the value is inert data. Allow the punctuation legitimate conditions use (e.g. "Tier.Gold") but
  // exclude every character that could terminate the literal or introduce expression syntax
  // (' " \ $ { } ( ) = etc.).
  private static final Pattern SAFE_EDGE_CONDITION = Pattern.compile("^[A-Za-z0-9 ._-]+$");

  // Node references (edge from/to and node names) land in code position as the JUEL variable-name
  // prefix (${from_result == ...}). Restrict them to identifier characters so no property
  // navigation, arithmetic, or expression syntax is reachable.
  private static final Pattern SAFE_NODE_REFERENCE = Pattern.compile("^[A-Za-z0-9_]+$");

  private WorkflowExpressionValidator() {}

  public static boolean isSafeCondition(String condition) {
    return condition != null && SAFE_EDGE_CONDITION.matcher(condition).matches();
  }

  public static boolean isSafeNodeReference(String reference) {
    return reference != null && SAFE_NODE_REFERENCE.matcher(reference).matches();
  }
}
