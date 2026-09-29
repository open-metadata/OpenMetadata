/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.resources.ai;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.ai.AIGovernancePolicyRuleResult;
import org.openmetadata.schema.api.ai.AIGovernancePolicyViolation;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.schema.entity.ai.DataClassification;
import org.openmetadata.schema.entity.ai.DataClassification__2;
import org.openmetadata.schema.entity.ai.GovernanceMetadata;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.ai.McpGovernanceMetadata;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.type.AICompliance;
import org.openmetadata.schema.type.AIComplianceRecord;
import org.openmetadata.schema.type.AIEvidence;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AIGovernancePolicyRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil;

/**
 * Evaluates a small set of always-on AI governance policies against an entity.
 * Each rule returns a {@link Status}: {@code Passing}, {@code Breached}, or
 * {@code NotApplicable}. The rules are derived from existing entity fields so
 * no schema is duplicated.
 *
 * <p>Phase 4 will replace this with a real rule engine that evaluates the
 * referenced {@code AIGovernancePolicy} entries; this evaluator hardcodes a
 * useful baseline so the Policies tab has content to render today.
 */
final class PolicyEvaluator {

  private static final long FAIRNESS_FRESHNESS_MS = 90L * 24 * 60 * 60 * 1000;
  private static final int PAGE_SIZE = 500;

  private PolicyEvaluator() {}

  enum Status {
    PASSING,
    BREACHED,
    NOT_APPLICABLE
  }

  static List<AIGovernancePolicyRuleResult> evaluate(EntityInterface entity, String entityType) {
    List<AIGovernancePolicyRuleResult> rules = new ArrayList<>();
    rules.add(piiAccessRequiresDpia(entity));
    rules.add(subgroupFairnessQuarterly(entity));
    rules.add(humanOversight(entity));
    rules.add(auditLogRetention(entity));
    rules.add(driftThreshold());

    return rules;
  }

  private static AIGovernancePolicyRuleResult piiAccessRequiresDpia(EntityInterface entity) {
    GovernanceSnapshot governance = governance(entity);
    boolean accessesPii =
        governance.dataClassification() != null
            && Boolean.TRUE.equals(governance.dataClassification().accessesPii());
    AIEvidence evidence = governance.evidence();
    String dpiaUrl =
        evidence != null && evidence.getDpiaUrl() != null && !evidence.getDpiaUrl().isBlank()
            ? evidence.getDpiaUrl()
            : null;
    Status status;
    if (!accessesPii) {
      status = Status.NOT_APPLICABLE;
    } else if (dpiaUrl != null) {
      status = Status.PASSING;
    } else {
      status = Status.BREACHED;
    }

    return rule(
        "PII access requires DPIA",
        "When an asset accesses Personally Identifiable Information, a DPIA must be on file.",
        status,
        dpiaUrl == null ? (accessesPii ? "No DPIA on file" : "N/A") : dpiaUrl);
  }

  private static AIGovernancePolicyRuleResult subgroupFairnessQuarterly(EntityInterface entity) {
    GovernanceSnapshot governance = governance(entity);
    String euRisk = euRiskClassification(governance.aiCompliance());
    boolean highRisk = "High".equals(euRisk) || "Unacceptable".equals(euRisk);
    Long lastEval = lastBiasEval(entity);
    Status status;
    String value;
    if (!highRisk) {
      status = Status.NOT_APPLICABLE;
      value = "Risk tier not high-risk";
    } else if (lastEval == null) {
      status = Status.BREACHED;
      value = "No fairness evaluation on file";
    } else {
      long age = System.currentTimeMillis() - lastEval;
      if (age <= FAIRNESS_FRESHNESS_MS) {
        status = Status.PASSING;
        value = "Last evaluated " + relativeDays(age) + " days ago";
      } else {
        status = Status.BREACHED;
        value = "Last evaluated " + relativeDays(age) + " days ago";
      }
    }

    return rule(
        "Subgroup fairness quarterly",
        "High-risk systems require a documented subgroup fairness evaluation every 90 days.",
        status,
        value);
  }

  private static AIGovernancePolicyRuleResult humanOversight(EntityInterface entity) {
    GovernanceSnapshot governance = governance(entity);
    Boolean oversight = humanOversightFromGovernance(governance.aiCompliance());
    Status status;
    String value;
    if (oversight == null) {
      status = Status.NOT_APPLICABLE;
      value = "Not declared";
    } else if (oversight) {
      status = Status.PASSING;
      value = "Enabled";
    } else {
      status = Status.BREACHED;
      value = "Disabled";
    }

    return rule(
        "Human oversight",
        "Material decisions require human-in-the-loop oversight (Article 14).",
        status,
        value);
  }

  private static AIGovernancePolicyRuleResult auditLogRetention(EntityInterface entity) {
    GovernanceSnapshot governance = governance(entity);
    DataClassificationSnapshot classification = governance.dataClassification();
    String value =
        classification != null
                && classification.dataRetentionPeriod() != null
                && !classification.dataRetentionPeriod().isBlank()
            ? classification.dataRetentionPeriod()
            : null;
    Status status = value == null ? Status.BREACHED : Status.PASSING;

    return rule(
        "Audit log retention",
        "AI assets must declare an audit-log retention period (Article 12).",
        status,
        value == null ? "Not declared" : value);
  }

  private static AIGovernancePolicyRuleResult driftThreshold() {
    // No drift field exists at the entity level today. Phase 2 schema work
    // adds runtime drift metrics; until then this rule is N/A.
    Status status = Status.NOT_APPLICABLE;
    String value = "Drift telemetry not configured";

    return rule(
        "Drift threshold",
        "Asset is auto-flagged for review when 7-day drift exceeds 0.2.",
        status,
        value);
  }

  private static AIGovernancePolicyRuleResult rule(
      String name, String description, Status status, String value) {
    return new AIGovernancePolicyRuleResult()
        .withName(name)
        .withDescription(description)
        .withStatus(
            switch (status) {
              case PASSING -> "Passing";
              case BREACHED -> "Breached";
              case NOT_APPLICABLE -> "NotApplicable";
            })
        .withValue(value);
  }

  private static GovernanceSnapshot governance(EntityInterface entity) {
    GovernanceSnapshot result = GovernanceSnapshot.EMPTY;
    if (entity instanceof AIApplication app && app.getGovernanceMetadata() != null) {
      result = governance(app.getGovernanceMetadata());
    } else if (entity instanceof McpServer server && server.getGovernanceMetadata() != null) {
      result = governance(server.getGovernanceMetadata());
    } else if (entity instanceof LLMModel llm) {
      result = new GovernanceSnapshot(null, llm.getEvidence(), null);
    }
    return result;
  }

  private static GovernanceSnapshot governance(GovernanceMetadata governance) {
    return new GovernanceSnapshot(
        governance.getAiCompliance(),
        governance.getEvidence(),
        dataClassification(governance.getDataClassification()));
  }

  private static GovernanceSnapshot governance(McpGovernanceMetadata governance) {
    return new GovernanceSnapshot(
        governance.getAiCompliance(),
        governance.getEvidence(),
        dataClassification(governance.getDataClassification()));
  }

  private static DataClassificationSnapshot dataClassification(
      DataClassification dataClassification) {
    return dataClassification == null
        ? null
        : new DataClassificationSnapshot(
            dataClassification.getAccessesPII(), dataClassification.getDataRetentionPeriod());
  }

  private static DataClassificationSnapshot dataClassification(
      DataClassification__2 dataClassification) {
    return dataClassification == null
        ? null
        : new DataClassificationSnapshot(
            dataClassification.getAccessesPII(), dataClassification.getDataRetentionPeriod());
  }

  private static String euRiskClassification(AICompliance aiCompliance) {
    String result = null;
    if (aiCompliance != null && aiCompliance.getComplianceRecords() != null) {
      for (AIComplianceRecord record : aiCompliance.getComplianceRecords()) {
        if (record.getEuAIAct() != null && record.getEuAIAct().getRiskClassification() != null) {
          result = record.getEuAIAct().getRiskClassification().value();
          break;
        }
      }
    }
    return result;
  }

  private static Boolean humanOversightFromGovernance(AICompliance aiCompliance) {
    Boolean result = null;
    if (aiCompliance != null && aiCompliance.getComplianceRecords() != null) {
      for (AIComplianceRecord record : aiCompliance.getComplianceRecords()) {
        if (record.getEthicalAssessment() != null
            && record.getEthicalAssessment().getAccountabilityMeasures() != null
            && record
                    .getEthicalAssessment()
                    .getAccountabilityMeasures()
                    .getSubjectToHumanOversight()
                != null) {
          result =
              Boolean.TRUE.equals(
                  record
                      .getEthicalAssessment()
                      .getAccountabilityMeasures()
                      .getSubjectToHumanOversight());
          break;
        }
      }
    }
    return result;
  }

  private static Long lastBiasEval(EntityInterface entity) {
    Long result = null;
    if (entity instanceof AIApplication app && app.getBiasMetrics() != null) {
      result = app.getBiasMetrics().getLastEvaluatedAt();
    }
    return result;
  }

  private static long relativeDays(long ms) {
    return ms / (24L * 60 * 60 * 1000);
  }

  /**
   * Walks in-scope AI assets, re-evaluates every rule and returns rows that
   * map to the named policy. Used by the Policies & Drift page to populate
   * the recent-violations panel. v1 backed by a live re-evaluation over the
   * AI assets table; a real time-series store can replace this later without
   * changing the response shape.
   */
  static List<AIGovernancePolicyViolation> recentViolations(UUID policyId, Long since, int limit) {
    String ruleNamePattern = ruleNameForPolicy(policyId);
    long sinceMs = since == null ? 0 : since;
    int effectiveLimit = Math.max(1, Math.min(limit, 500));

    List<AIGovernancePolicyViolation> rows = new ArrayList<>();
    scanAssets(Entity.AI_APPLICATION, ruleNamePattern, sinceMs, effectiveLimit, rows);
    if (rows.size() < effectiveLimit) {
      scanAssets(Entity.LLM_MODEL, ruleNamePattern, sinceMs, effectiveLimit, rows);
    }
    if (rows.size() < effectiveLimit) {
      scanAssets(Entity.MCP_SERVER, ruleNamePattern, sinceMs, effectiveLimit, rows);
    }

    return rows;
  }

  private static void scanAssets(
      String entityType,
      String ruleNamePattern,
      long sinceMs,
      int limit,
      List<AIGovernancePolicyViolation> rows) {
    List<? extends EntityInterface> entities = listEntities(entityType, limit);
    for (EntityInterface entity : entities) {
      if (rows.size() >= limit) {
        return;
      }
      List<AIGovernancePolicyRuleResult> rules = evaluate(entity, entityType);
      for (AIGovernancePolicyRuleResult rule : rules) {
        if (rows.size() >= limit) {
          return;
        }
        if (!"Breached".equals(rule.getStatus())) {
          continue;
        }
        String ruleName = rule.getName();
        if (ruleNamePattern != null
            && !ruleName.toLowerCase(Locale.ROOT).contains(ruleNamePattern)) {
          continue;
        }
        Long observedAt = entity.getUpdatedAt();
        if (observedAt == null || observedAt < sinceMs) {
          continue;
        }
        rows.add(
            new AIGovernancePolicyViolation()
                .withEntityType(entityType)
                .withEntityId(entity.getId() == null ? null : entity.getId().toString())
                .withEntityName(
                    entity.getDisplayName() == null ? entity.getName() : entity.getDisplayName())
                .withRuleName(ruleName)
                .withStatus("Breached")
                .withValue(rule.getValue())
                .withObservedAt(observedAt));
      }
    }
  }

  private static List<? extends EntityInterface> listEntities(String entityType, int limit) {
    List<EntityInterface> result = new ArrayList<>();
    try {
      ListFilter filter = new ListFilter(Include.NON_DELETED);
      EntityRepository<? extends EntityInterface> repo = Entity.getEntityRepository(entityType);
      String after = null;
      do {
        int pageSize = Math.min(PAGE_SIZE, Math.max(1, limit - result.size()));
        ResultList<? extends EntityInterface> page =
            repo.listAfter(null, EntityUtil.Fields.EMPTY_FIELDS, filter, pageSize, after);
        result.addAll(page.getData());
        after = page.getPaging() == null ? null : page.getPaging().getAfter();
      } while (after != null && result.size() < limit);
    } catch (Exception ignored) {
      // Swallow - empty list is acceptable for the violations endpoint
    }
    return result;
  }

  /**
   * Maps a stored policy id to a substring pattern that PolicyEvaluator's
   * synthetic rule names will match. The synthetic rules are named in
   * {@link #evaluate(EntityInterface, String)}; if the stored policy's name
   * matches one of those patterns, violations propagate. Otherwise returns
   * null which falls back to "all breaches".
   */
  private static String ruleNameForPolicy(UUID policyId) {
    if (policyId == null) {
      return null;
    }
    try {
      AIGovernancePolicyRepository repo =
          (AIGovernancePolicyRepository) Entity.getEntityRepository(Entity.AI_GOVERNANCE_POLICY);
      AIGovernancePolicy policy = repo.get(null, policyId, repo.getFields("id,name"));
      String name =
          policy == null || policy.getName() == null
              ? ""
              : policy.getName().toLowerCase(Locale.ROOT);
      if (name.contains("pii") || name.contains("dpia")) {
        return "pii";
      }
      if (name.contains("fairness")) {
        return "fairness";
      }
      if (name.contains("oversight") || name.contains("human")) {
        return "oversight";
      }
      if (name.contains("retention") || name.contains("log")) {
        return "retention";
      }
      if (name.contains("drift") || name.contains("performance")) {
        return "drift";
      }
    } catch (Exception ignored) {
      // No match -> return all breaches
    }
    return null;
  }

  private record GovernanceSnapshot(
      AICompliance aiCompliance,
      AIEvidence evidence,
      DataClassificationSnapshot dataClassification) {
    private static final GovernanceSnapshot EMPTY = new GovernanceSnapshot(null, null, null);
  }

  private record DataClassificationSnapshot(Boolean accessesPii, String dataRetentionPeriod) {}
}
