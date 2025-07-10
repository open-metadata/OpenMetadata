package org.openmetadata.service.security.policyevaluator;

import java.util.ArrayList;
import java.util.List;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;

/**
 * Debug information for real-time permission evaluation with context
 */
@Data
@NoArgsConstructor
public class PermissionEvaluationDebugInfo {

  private EntityReference user;
  private String resource;
  private String resourceId;
  private MetadataOperation operation;
  private boolean allowed;
  private String finalDecision;
  private List<PolicyEvaluationStep> evaluationSteps = new ArrayList<>();
  private EvaluationSummary summary;

  @Data
  @NoArgsConstructor
  public static class PolicyEvaluationStep {
    private int stepNumber;
    private String source; // "DIRECT_ROLE", "TEAM_ROLE", "TEAM_POLICY", "INHERITED_ROLE", etc.
    private EntityReference sourceEntity; // The role/team/policy that provided this rule
    private EntityReference policy;
    private String rule;
    private String effect; // "ALLOW" or "DENY"
    private boolean matched;
    private String matchReason;
    private List<ConditionEvaluation> conditionEvaluations = new ArrayList<>();
  }

  @Data
  @NoArgsConstructor
  public static class ConditionEvaluation {
    private String condition;
    private boolean result;
    private String evaluationDetails;
  }

  @Data
  @NoArgsConstructor
  public static class EvaluationSummary {
    private int totalPoliciesEvaluated;
    private int totalRulesEvaluated;
    private int matchingRules;
    private int denyRules;
    private int allowRules;
    private List<String> appliedPolicies = new ArrayList<>();
    private List<String> reasonsForDecision = new ArrayList<>();
    private long evaluationTimeMs;
  }
}
