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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
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
@SuppressWarnings("unchecked")
final class PolicyEvaluator {

  private static final long FAIRNESS_FRESHNESS_MS = 90L * 24 * 60 * 60 * 1000;
  private static final int PAGE_SIZE = 500;

  private PolicyEvaluator() {}

  enum Status {
    PASSING,
    BREACHED,
    NOT_APPLICABLE
  }

  static List<Map<String, Object>> evaluate(EntityInterface entity, String entityType) {
    List<Map<String, Object>> rules = new ArrayList<>();
    rules.add(piiAccessRequiresDpia(entity, entityType));
    rules.add(subgroupFairnessQuarterly(entity, entityType));
    rules.add(humanOversight(entity, entityType));
    rules.add(auditLogRetention(entity, entityType));
    rules.add(driftThreshold(entity, entityType));

    return rules;
  }

  private static Map<String, Object> piiAccessRequiresDpia(
      EntityInterface entity, String entityType) {
    Map<String, Object> governance = governance(entity, entityType);
    Map<String, Object> classification =
        asMap(governance == null ? null : governance.get("dataClassification"));
    boolean accessesPii =
        classification != null && Boolean.TRUE.equals(classification.get("accessesPII"));
    Map<String, Object> evidence = asMap(governance == null ? null : governance.get("evidence"));
    Object dpia = evidence == null ? null : evidence.get("dpiaUrl");
    String dpiaUrl = dpia instanceof String value && !value.isBlank() ? value : null;
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

  private static Map<String, Object> subgroupFairnessQuarterly(
      EntityInterface entity, String entityType) {
    Map<String, Object> governance = governance(entity, entityType);
    String euRisk = euRiskClassification(governance);
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

  private static Map<String, Object> humanOversight(EntityInterface entity, String entityType) {
    Map<String, Object> governance = governance(entity, entityType);
    Boolean oversight = humanOversightFromGovernance(governance);
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

  private static Map<String, Object> auditLogRetention(EntityInterface entity, String entityType) {
    Map<String, Object> governance = governance(entity, entityType);
    Map<String, Object> classification =
        asMap(governance == null ? null : governance.get("dataClassification"));
    Object retention = classification == null ? null : classification.get("dataRetentionPeriod");
    String value = retention instanceof String s && !s.isBlank() ? s : null;
    Status status = value == null ? Status.BREACHED : Status.PASSING;

    return rule(
        "Audit log retention",
        "AI assets must declare an audit-log retention period (Article 12).",
        status,
        value == null ? "Not declared" : value);
  }

  private static Map<String, Object> driftThreshold(EntityInterface entity, String entityType) {
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

  private static Map<String, Object> rule(
      String name, String description, Status status, String value) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("name", name);
    result.put("description", description);
    result.put(
        "status",
        switch (status) {
          case PASSING -> "Passing";
          case BREACHED -> "Breached";
          case NOT_APPLICABLE -> "NotApplicable";
        });
    result.put("value", value);

    return result;
  }

  private static Map<String, Object> governance(EntityInterface entity, String entityType) {
    Map<String, Object> result = null;
    if (entity instanceof AIApplication app && app.getGovernanceMetadata() != null) {
      result =
          (Map<String, Object>)
              JsonUtils.getObjectMapper().convertValue(app.getGovernanceMetadata(), Map.class);
    } else if (entity instanceof McpServer server && server.getGovernanceMetadata() != null) {
      result =
          (Map<String, Object>)
              JsonUtils.getObjectMapper().convertValue(server.getGovernanceMetadata(), Map.class);
    } else if (entity instanceof LLMModel llm) {
      // LLM has no rich governance block; surface a shim so the rules can
      // still inspect detection / evidence when present.
      Map<String, Object> shim = new LinkedHashMap<>();
      if (llm.getDetection() != null) {
        shim.put(
            "detection", JsonUtils.getObjectMapper().convertValue(llm.getDetection(), Map.class));
      }
      if (llm.getEvidence() != null) {
        shim.put(
            "evidence", JsonUtils.getObjectMapper().convertValue(llm.getEvidence(), Map.class));
      }
      if (!shim.isEmpty()) {
        result = shim;
      }
    }
    return result;
  }

  private static String euRiskClassification(Map<String, Object> governance) {
    String result = null;
    Map<String, Object> aiCompliance =
        asMap(governance == null ? null : governance.get("aiCompliance"));
    if (aiCompliance != null && aiCompliance.get("complianceRecords") instanceof List<?> records) {
      for (Object recordObj : records) {
        Map<String, Object> record = asMap(recordObj);
        Map<String, Object> eu = record == null ? null : asMap(record.get("euAIAct"));
        if (eu != null && eu.get("riskClassification") != null) {
          result = eu.get("riskClassification").toString();
          break;
        }
      }
    }
    return result;
  }

  private static Boolean humanOversightFromGovernance(Map<String, Object> governance) {
    Boolean result = null;
    Map<String, Object> aiCompliance =
        asMap(governance == null ? null : governance.get("aiCompliance"));
    if (aiCompliance != null && aiCompliance.get("complianceRecords") instanceof List<?> records) {
      for (Object recordObj : records) {
        Map<String, Object> record = asMap(recordObj);
        Map<String, Object> ethical =
            record == null ? null : asMap(record.get("ethicalAssessment"));
        Map<String, Object> accountability =
            ethical == null ? null : asMap(ethical.get("accountabilityMeasures"));
        if (accountability != null && accountability.get("subjectToHumanOversight") != null) {
          result = Boolean.TRUE.equals(accountability.get("subjectToHumanOversight"));
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

  private static Map<String, Object> asMap(Object value) {
    return value instanceof Map<?, ?> ? (Map<String, Object>) value : null;
  }

  /**
   * Walks in-scope AI assets, re-evaluates every rule and returns rows that
   * map to the named policy. Used by the Policies & Drift page to populate
   * the recent-violations panel. v1 backed by a live re-evaluation over the
   * AI assets table; a real time-series store can replace this later without
   * changing the response shape.
   */
  static List<Map<String, Object>> recentViolations(UUID policyId, Long since, int limit) {
    String ruleNamePattern = ruleNameForPolicy(policyId);
    long sinceMs = since == null ? 0 : since;
    int effectiveLimit = Math.max(1, Math.min(limit, 500));

    List<Map<String, Object>> rows = new ArrayList<>();
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
      List<Map<String, Object>> rows) {
    List<? extends EntityInterface> entities = listEntities(entityType, limit);
    for (EntityInterface entity : entities) {
      if (rows.size() >= limit) {
        return;
      }
      List<Map<String, Object>> rules = evaluate(entity, entityType);
      for (Map<String, Object> rule : rules) {
        if (rows.size() >= limit) {
          return;
        }
        if (!"Breached".equals(rule.get("status"))) {
          continue;
        }
        String ruleName = String.valueOf(rule.get("name"));
        if (ruleNamePattern != null
            && !ruleName.toLowerCase(Locale.ROOT).contains(ruleNamePattern)) {
          continue;
        }
        Long observedAt = entity.getUpdatedAt();
        if (observedAt == null || observedAt < sinceMs) {
          continue;
        }
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("entityType", entityType);
        row.put("entityId", entity.getId() == null ? null : entity.getId().toString());
        row.put(
            "entityName",
            entity.getDisplayName() == null ? entity.getName() : entity.getDisplayName());
        row.put("ruleName", ruleName);
        row.put("status", "Breached");
        row.put("value", rule.get("value"));
        row.put("observedAt", observedAt);
        rows.add(row);
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
}
