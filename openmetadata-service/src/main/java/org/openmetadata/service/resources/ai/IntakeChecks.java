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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.resources.ai.AIGovernanceResource.IntakeCheck;
import org.openmetadata.service.resources.ai.AIGovernanceResource.IntakeChecksResponse;

/**
 * Computes the 5 intake checks the Approvals queue UI surfaces for an AI asset.
 * Checks are derived from existing entity fields so no schema is duplicated.
 */
final class IntakeChecks {

  static final String OWNER_ASSIGNED = "Owner assigned";
  static final String RISK_CLASSIFIED = "Risk classification complete";
  static final String FAIRNESS_EVIDENCE = "Fairness evidence attached";
  static final String DPIA_REFERENCED = "DPIA referenced";
  static final String TRANSPARENCY_DISCLOSURE = "Transparency disclosure";

  private IntakeChecks() {}

  static IntakeChecksResponse compute(EntityInterface entity) {
    List<IntakeCheck> checks = new ArrayList<>();
    checks.add(new IntakeCheck(OWNER_ASSIGNED, hasOwner(entity), null));
    checks.add(new IntakeCheck(RISK_CLASSIFIED, hasRisk(entity), null));
    checks.add(new IntakeCheck(FAIRNESS_EVIDENCE, hasFairnessEvidence(entity), null));
    checks.add(new IntakeCheck(DPIA_REFERENCED, hasDpia(entity), null));
    checks.add(new IntakeCheck(TRANSPARENCY_DISCLOSURE, hasTransparency(entity), null));
    IntakeChecksResponse response = new IntakeChecksResponse();
    response.setChecks(checks);

    return response;
  }

  private static boolean hasOwner(EntityInterface entity) {
    return !nullOrEmpty(entity.getOwners());
  }

  private static boolean hasRisk(EntityInterface entity) {
    Map<String, Object> governance = readGovernance(entity);
    boolean result = false;
    if (governance != null) {
      Map<String, Object> risk = asMap(governance.get("riskAssessment"));
      if (risk != null && risk.get("riskLevel") != null) {
        result = true;
      }
      if (!result) {
        result = euRiskClassificationPresent(governance);
      }
    }
    if (!result && entity instanceof LLMModel llm) {
      result = llm.getGovernanceStatus() != null;
    }
    return result;
  }

  private static boolean hasFairnessEvidence(EntityInterface entity) {
    boolean result = false;
    if (entity instanceof AIApplication app
        && app.getBiasMetrics() != null
        && app.getBiasMetrics().getLastEvaluatedAt() != null) {
      result = true;
    }
    if (!result) {
      String url = readEvidenceUrl(entity, "fairnessEvidenceUrl");
      result = url != null && !url.isBlank();
    }
    return result;
  }

  private static boolean hasDpia(EntityInterface entity) {
    String url = readEvidenceUrl(entity, "dpiaUrl");
    return url != null && !url.isBlank();
  }

  private static boolean hasTransparency(EntityInterface entity) {
    Map<String, Object> governance = readGovernance(entity);
    boolean result = false;
    if (governance != null) {
      Map<String, Object> aiCompliance = asMap(governance.get("aiCompliance"));
      if (aiCompliance != null) {
        List<Object> records = asList(aiCompliance.get("complianceRecords"));
        if (records != null) {
          for (Object item : records) {
            Map<String, Object> record = asMap(item);
            if (record == null) {
              continue;
            }
            Map<String, Object> eu = asMap(record.get("euAIAct"));
            Map<String, Object> transparency =
                eu == null ? null : asMap(eu.get("transparencyObligations"));
            if (transparency != null && Boolean.TRUE.equals(transparency.get("usersInformed"))) {
              result = true;
              break;
            }
          }
        }
      }
    }
    return result;
  }

  private static String readEvidenceUrl(EntityInterface entity, String key) {
    String url = null;
    Map<String, Object> evidence = null;
    if (entity instanceof AIApplication app && app.getGovernanceMetadata() != null) {
      evidence =
          JsonUtils.getObjectMapper()
              .convertValue(app.getGovernanceMetadata().getEvidence(), Map.class);
    } else if (entity instanceof McpServer server && server.getGovernanceMetadata() != null) {
      evidence =
          JsonUtils.getObjectMapper()
              .convertValue(server.getGovernanceMetadata().getEvidence(), Map.class);
    } else if (entity instanceof LLMModel llm && llm.getEvidence() != null) {
      evidence = JsonUtils.getObjectMapper().convertValue(llm.getEvidence(), Map.class);
    }
    if (evidence != null && evidence.get(key) instanceof String value) {
      url = value;
    }
    return url;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> readGovernance(EntityInterface entity) {
    Object source = null;
    if (entity instanceof AIApplication app) {
      source = app.getGovernanceMetadata();
    } else if (entity instanceof McpServer server) {
      source = server.getGovernanceMetadata();
    }
    return source == null
        ? null
        : (Map<String, Object>) JsonUtils.getObjectMapper().convertValue(source, Map.class);
  }

  private static boolean euRiskClassificationPresent(Map<String, Object> governance) {
    Map<String, Object> aiCompliance = asMap(governance.get("aiCompliance"));
    boolean result = false;
    if (aiCompliance != null) {
      List<Object> records = asList(aiCompliance.get("complianceRecords"));
      if (records != null) {
        for (Object item : records) {
          Map<String, Object> record = asMap(item);
          if (record == null) {
            continue;
          }
          Map<String, Object> eu = asMap(record.get("euAIAct"));
          if (eu != null && eu.get("riskClassification") != null) {
            result = true;
            break;
          }
        }
      }
    }
    return result;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asMap(Object value) {
    return value instanceof Map<?, ?> ? (Map<String, Object>) value : null;
  }

  @SuppressWarnings("unchecked")
  private static List<Object> asList(Object value) {
    return value instanceof List<?> ? (List<Object>) value : null;
  }
}
