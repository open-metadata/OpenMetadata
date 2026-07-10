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
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.ai.IntakeCheck;
import org.openmetadata.schema.api.ai.IntakeChecksResponse;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.GovernanceMetadata;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.ai.McpGovernanceMetadata;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.type.AICompliance;
import org.openmetadata.schema.type.AIComplianceRecord;
import org.openmetadata.schema.type.AIEvidence;

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
    checks.add(intakeCheck(OWNER_ASSIGNED, hasOwner(entity), null));
    checks.add(intakeCheck(RISK_CLASSIFIED, hasRisk(entity), null));
    checks.add(intakeCheck(FAIRNESS_EVIDENCE, hasFairnessEvidence(entity), null));
    checks.add(intakeCheck(DPIA_REFERENCED, hasDpia(entity), null));
    checks.add(intakeCheck(TRANSPARENCY_DISCLOSURE, hasTransparency(entity), null));

    return new IntakeChecksResponse().withChecks(checks);
  }

  private static IntakeCheck intakeCheck(String name, boolean passing, String evidenceRef) {
    return new IntakeCheck().withName(name).withPassing(passing).withEvidenceRef(evidenceRef);
  }

  private static boolean hasOwner(EntityInterface entity) {
    return !nullOrEmpty(entity.getOwners());
  }

  private static boolean hasRisk(EntityInterface entity) {
    boolean result =
        riskAssessmentDeclared(entity) || euRiskClassificationPresent(aiCompliance(entity));
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
      AIEvidence evidence = evidence(entity);
      result = evidence != null && !nullOrEmpty(evidence.getFairnessEvidenceUrl());
    }
    return result;
  }

  private static boolean hasDpia(EntityInterface entity) {
    AIEvidence evidence = evidence(entity);
    return evidence != null && !nullOrEmpty(evidence.getDpiaUrl());
  }

  private static boolean hasTransparency(EntityInterface entity) {
    AICompliance aiCompliance = aiCompliance(entity);
    boolean result = false;
    if (aiCompliance != null && aiCompliance.getComplianceRecords() != null) {
      for (AIComplianceRecord record : aiCompliance.getComplianceRecords()) {
        if (record.getEuAIAct() != null
            && record.getEuAIAct().getTransparencyObligations() != null
            && Boolean.TRUE.equals(
                record.getEuAIAct().getTransparencyObligations().getUsersInformed())) {
          result = true;
          break;
        }
      }
    }
    return result;
  }

  private static boolean riskAssessmentDeclared(EntityInterface entity) {
    boolean result = false;
    if (entity instanceof AIApplication app && app.getGovernanceMetadata() != null) {
      GovernanceMetadata governance = app.getGovernanceMetadata();
      result =
          governance.getRiskAssessment() != null
              && governance.getRiskAssessment().getRiskLevel() != null;
    } else if (entity instanceof McpServer server && server.getGovernanceMetadata() != null) {
      McpGovernanceMetadata governance = server.getGovernanceMetadata();
      result =
          governance.getRiskAssessment() != null
              && governance.getRiskAssessment().getRiskLevel() != null;
    }
    return result;
  }

  private static boolean euRiskClassificationPresent(AICompliance aiCompliance) {
    boolean result = false;
    if (aiCompliance != null && aiCompliance.getComplianceRecords() != null) {
      for (AIComplianceRecord record : aiCompliance.getComplianceRecords()) {
        if (record.getEuAIAct() != null && record.getEuAIAct().getRiskClassification() != null) {
          result = true;
          break;
        }
      }
    }
    return result;
  }

  private static AICompliance aiCompliance(EntityInterface entity) {
    AICompliance result = null;
    if (entity instanceof AIApplication app && app.getGovernanceMetadata() != null) {
      result = app.getGovernanceMetadata().getAiCompliance();
    } else if (entity instanceof McpServer server && server.getGovernanceMetadata() != null) {
      result = server.getGovernanceMetadata().getAiCompliance();
    }
    return result;
  }

  private static AIEvidence evidence(EntityInterface entity) {
    AIEvidence result = null;
    if (entity instanceof AIApplication app && app.getGovernanceMetadata() != null) {
      result = app.getGovernanceMetadata().getEvidence();
    } else if (entity instanceof McpServer server && server.getGovernanceMetadata() != null) {
      result = server.getGovernanceMetadata().getEvidence();
    } else if (entity instanceof LLMModel llm) {
      result = llm.getEvidence();
    }
    return result;
  }
}
