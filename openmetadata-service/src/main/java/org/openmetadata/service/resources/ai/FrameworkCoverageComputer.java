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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.ai.FrameworkControlCoverage;
import org.openmetadata.schema.api.ai.FrameworkCoverageResponse;
import org.openmetadata.schema.api.ai.FrameworkCoverageSummary;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AIFrameworkControl;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
import org.openmetadata.schema.entity.ai.FrameworkAutoApplyRules;
import org.openmetadata.schema.entity.ai.GovernanceMetadata;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.ai.McpGovernanceMetadata;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.type.AICompliance;
import org.openmetadata.schema.type.AIComplianceRecord;
import org.openmetadata.schema.type.ComplianceFramework;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.RemediationAction;
import org.openmetadata.schema.type.RemediationStatus;
import org.openmetadata.schema.type.ScopeAndDeployment;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AIApplicationRepository;
import org.openmetadata.service.jdbi3.LLMModelRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.McpServerRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * Computes real per-control coverage for an {@link AIGovernanceFramework}.
 *
 * <p>"In-scope" assets are the union of AI Applications / LLM Models / MCP
 * Servers that match the framework's {@code autoApply} rules. For each control
 * defined under the framework, the result reflects the aggregate status from
 * the {@code aiCompliance.complianceRecords[]} that reference this framework on
 * in-scope assets:
 *
 * <ul>
 *   <li>{@code Met} — every in-scope asset has a {@code Compliant} record for the framework
 *   <li>{@code Partial} — at least one asset is {@code PartiallyCompliant} or has remediation pending
 *   <li>{@code Gap} — at least one asset is {@code NonCompliant} or has no record for the framework
 * </ul>
 *
 * <p>{@code affectedAssetCount} counts assets that fall short on this control
 * (i.e. status != Met). {@code evidenceCount} counts evidence URLs across the
 * in-scope assets' records. {@code assetsInScope} is the in-scope total.
 */
@Slf4j
public final class FrameworkCoverageComputer {

  private static final int PAGE_SIZE = 1000;

  private FrameworkCoverageComputer() {}

  public static FrameworkCoverageResponse compute(
      AIGovernanceFramework framework, List<AIFrameworkControl> controls) {
    return compute(framework, controls, collectInScopeAssets(framework));
  }

  static FrameworkCoverageResponse compute(
      AIGovernanceFramework framework,
      List<AIFrameworkControl> controls,
      List<EntityInterface> assets) {
    FrameworkCoverageResponse response = new FrameworkCoverageResponse();
    response.setFrameworkId(framework.getId());
    response.setFrameworkName(framework.getName());
    response.setAssetsInScope(assets.size());

    String frameworkName = framework.getName();
    List<AssetCompliance> assetCompliance =
        assets.stream().map(asset -> assetCompliance(asset, frameworkName)).toList();
    int compliantAssetCount = 0;
    int partialAssetCount = 0;
    int nonCompliantAssetCount = 0;
    for (AssetCompliance compliance : assetCompliance) {
      ComplianceRecordSnapshot record = compliance.record();
      if (record == null) {
        nonCompliantAssetCount++;
        continue;
      }
      if ("Compliant".equals(record.status())) {
        compliantAssetCount++;
      } else if ("PartiallyCompliant".equals(record.status())) {
        partialAssetCount++;
      } else if ("NonCompliant".equals(record.status()) || "UnderReview".equals(record.status())) {
        nonCompliantAssetCount++;
      }
    }

    List<FrameworkControlCoverage> entries = new ArrayList<>();
    for (AIFrameworkControl control : controls) {
      String code = control.getCode() == null ? control.getName() : control.getCode();
      ControlCoverage coverage = controlCoverage(assetCompliance, frameworkName, code);
      FrameworkControlCoverage entry = new FrameworkControlCoverage();
      entry.setCode(code);
      entry.setDisplayName(control.getDisplayName());
      entry.setCategory(control.getCategory());
      entry.setStatus(deriveControlStatus(coverage.nonCompliant(), coverage.partial()));
      entry.setAffectedAssetCount(
          deriveAffectedAssetCount(coverage.nonCompliant(), coverage.partial()));
      entry.setEvidenceCount(coverage.evidence());
      entries.add(entry);
    }
    response.setControls(entries);
    response.setSummary(
        new FrameworkCoverageSummary()
            .withCompliant(compliantAssetCount)
            .withPartial(partialAssetCount)
            .withNonCompliant(nonCompliantAssetCount));

    return response;
  }

  private static ControlCoverage controlCoverage(
      List<AssetCompliance> assetCompliance, String frameworkName, String controlCode) {
    int evidence = 0;
    int partial = 0;
    int nonCompliant = 0;
    for (AssetCompliance compliance : assetCompliance) {
      ComplianceRecordSnapshot record = compliance.record();
      if (record == null) {
        nonCompliant++;
        continue;
      }
      if (record.hasEvidence()) {
        evidence++;
      }
      if ("NonCompliant".equals(record.status()) || "UnderReview".equals(record.status())) {
        nonCompliant++;
      } else if ("PartiallyCompliant".equals(record.status())
          || hasPendingRemediation(compliance.remediationActions(), frameworkName, controlCode)) {
        partial++;
      }
    }

    return new ControlCoverage(evidence, partial, nonCompliant);
  }

  private static FrameworkControlCoverage.Status deriveControlStatus(
      int nonCompliant, int partial) {
    FrameworkControlCoverage.Status result;
    if (nonCompliant > 0) {
      result = FrameworkControlCoverage.Status.GAP;
    } else if (partial > 0) {
      result = FrameworkControlCoverage.Status.PARTIAL;
    } else {
      result = FrameworkControlCoverage.Status.MET;
    }

    return result;
  }

  private static int deriveAffectedAssetCount(int nonCompliant, int partial) {
    return nonCompliant + partial;
  }

  private static AssetCompliance assetCompliance(EntityInterface asset, String frameworkName) {
    GovernanceSnapshot governance = governance(asset);
    return new AssetCompliance(
        findComplianceRecord(governance.aiCompliance(), frameworkName),
        governance.remediationActions());
  }

  private static ComplianceRecordSnapshot findComplianceRecord(
      EntityInterface asset, String frameworkName) {
    return findComplianceRecord(governance(asset).aiCompliance(), frameworkName);
  }

  private static ComplianceRecordSnapshot findComplianceRecord(
      AICompliance aiCompliance, String frameworkName) {
    ComplianceRecordSnapshot result = null;
    if (aiCompliance != null && aiCompliance.getComplianceRecords() != null) {
      for (AIComplianceRecord record : aiCompliance.getComplianceRecords()) {
        if (frameworkMatches(record.getFramework(), frameworkName)) {
          result =
              new ComplianceRecordSnapshot(
                  record.getStatus() == null ? "UnderReview" : record.getStatus().value(),
                  hasEvidence(record));
          break;
        }
      }
    }

    return result;
  }

  private static boolean hasEvidence(AIComplianceRecord record) {
    return record.getVerification() != null && record.getVerification().getCertificateUrl() != null;
  }

  private static boolean hasPendingRemediation(
      List<RemediationAction> remediationActions, String frameworkName, String controlCode) {
    boolean result = false;
    for (RemediationAction action : remediationActions) {
      if (frameworkMatches(action.getFrameworkRef(), frameworkName)
          && controlMatches(action.getControlCode(), controlCode)
          && action.getStatus() != RemediationStatus.Done) {
        result = true;
        break;
      }
    }

    return result;
  }

  private static boolean controlMatches(String actionControlCode, String controlCode) {
    return actionControlCode != null && actionControlCode.equalsIgnoreCase(controlCode);
  }

  private static boolean frameworkMatches(
      ComplianceFramework recordFramework, String frameworkName) {
    return recordFramework != null && recordFramework.value().equalsIgnoreCase(frameworkName);
  }

  private static List<EntityInterface> collectInScopeAssets(AIGovernanceFramework framework) {
    FrameworkAutoApplyRules rules = framework.getAutoApply();
    String frameworkName = framework.getName();
    List<EntityInterface> result = new ArrayList<>();
    List<String> assetTypes = autoApplyAssetTypes(rules);
    for (String entityType : assetTypes) {
      for (EntityInterface entity : listEntities(entityType)) {
        // In-scope when the asset matches the auto-apply rules OR already carries
        // a compliance record for this framework (an explicit assessment always
        // counts, even if the asset hasn't declared the matching region/stage).
        if (matchesScope(entity, rules) || findComplianceRecord(entity, frameworkName) != null) {
          result.add(entity);
        }
      }
    }

    return result;
  }

  private static List<String> autoApplyAssetTypes(FrameworkAutoApplyRules rules) {
    List<String> result;
    if (rules == null || rules.getAssetTypes() == null || rules.getAssetTypes().isEmpty()) {
      result = List.of(Entity.AI_APPLICATION, Entity.LLM_MODEL, Entity.MCP_SERVER);
    } else {
      List<String> filtered = new ArrayList<>();
      for (String type : rules.getAssetTypes()) {
        if (Entity.AI_APPLICATION.equals(type)
            || Entity.LLM_MODEL.equals(type)
            || Entity.MCP_SERVER.equals(type)) {
          filtered.add(type);
        }
      }
      result = filtered.isEmpty() ? List.of(Entity.AI_APPLICATION) : filtered;
    }

    return result;
  }

  private static List<? extends EntityInterface> listEntities(String entityType) {
    List<EntityInterface> result = new ArrayList<>();
    try {
      ListFilter filter = new ListFilter(Include.NON_DELETED);
      String after = null;
      do {
        ResultList<? extends EntityInterface> page = listEntityPage(entityType, filter, after);
        result.addAll(page.getData());
        after = page.getPaging() == null ? null : page.getPaging().getAfter();
      } while (after != null);
    } catch (Exception e) {
      LOG.debug("Framework coverage walk for {} returned empty: {}", entityType, e.getMessage());
    }

    return result;
  }

  private static ResultList<? extends EntityInterface> listEntityPage(
      String entityType, ListFilter filter, String after) {
    if (Entity.AI_APPLICATION.equals(entityType)) {
      AIApplicationRepository repo =
          (AIApplicationRepository) Entity.getEntityRepository(entityType);
      return repo.listAfter(null, EntityUtil.Fields.EMPTY_FIELDS, filter, PAGE_SIZE, after);
    }
    if (Entity.LLM_MODEL.equals(entityType)) {
      LLMModelRepository repo = (LLMModelRepository) Entity.getEntityRepository(entityType);
      return repo.listAfter(null, EntityUtil.Fields.EMPTY_FIELDS, filter, PAGE_SIZE, after);
    }
    if (Entity.MCP_SERVER.equals(entityType)) {
      McpServerRepository repo = (McpServerRepository) Entity.getEntityRepository(entityType);
      return repo.listAfter(null, EntityUtil.Fields.EMPTY_FIELDS, filter, PAGE_SIZE, after);
    }
    return new ResultList<>(List.of(), null, null, 0);
  }

  private static boolean matchesScope(EntityInterface entity, FrameworkAutoApplyRules rules) {
    boolean result;
    if (rules == null) {
      result = true;
    } else {
      GovernanceSnapshot governance = governance(entity);
      boolean regionsOk = matchesRegions(governance, rules);
      boolean riskOk = matchesRiskClasses(governance, rules);
      boolean stageOk = matchesDeploymentStages(governance, rules);
      result = regionsOk && riskOk && stageOk;
    }

    return result;
  }

  private static boolean matchesRegions(
      GovernanceSnapshot governance, FrameworkAutoApplyRules rules) {
    boolean result;
    List<String> required = rules.getRegions();
    if (required == null || required.isEmpty()) {
      result = true;
    } else {
      List<String> assetRegions = extractRegions(governance.aiCompliance());
      result = anyMatch(required, assetRegions);
    }

    return result;
  }

  private static boolean matchesRiskClasses(
      GovernanceSnapshot governance, FrameworkAutoApplyRules rules) {
    boolean result;
    List<String> required = rules.getRiskClasses();
    if (required == null || required.isEmpty()) {
      result = true;
    } else {
      List<String> assetRisks = extractRiskClasses(governance);
      result = anyMatch(required, assetRisks);
    }

    return result;
  }

  private static boolean matchesDeploymentStages(
      GovernanceSnapshot governance, FrameworkAutoApplyRules rules) {
    boolean result;
    List<String> required = rules.getDeploymentStages();
    if (required == null || required.isEmpty()) {
      result = true;
    } else {
      String stage = governance.deploymentStage();
      result = stage != null && required.contains(stage);
    }

    return result;
  }

  private static List<String> extractRegions(AICompliance aiCompliance) {
    List<String> result = new ArrayList<>();
    if (aiCompliance != null && aiCompliance.getComplianceRecords() != null) {
      for (AIComplianceRecord record : aiCompliance.getComplianceRecords()) {
        ScopeAndDeployment scope = record.getScopeAndDeployment();
        if (scope != null && scope.getDeploymentRegions() != null) {
          result.addAll(scope.getDeploymentRegions());
        }
      }
    }

    return result;
  }

  private static List<String> extractRiskClasses(GovernanceSnapshot governance) {
    List<String> result = new ArrayList<>();
    if (governance.riskLevel() != null) {
      result.add(governance.riskLevel());
    }
    AICompliance aiCompliance = governance.aiCompliance();
    if (aiCompliance != null && aiCompliance.getComplianceRecords() != null) {
      for (AIComplianceRecord record : aiCompliance.getComplianceRecords()) {
        if (record.getEuAIAct() != null && record.getEuAIAct().getRiskClassification() != null) {
          result.add(record.getEuAIAct().getRiskClassification().value());
        }
      }
    }

    return result;
  }

  private static GovernanceSnapshot governance(EntityInterface asset) {
    GovernanceSnapshot result = GovernanceSnapshot.EMPTY;
    if (asset instanceof AIApplication app) {
      result = governance(app.getGovernanceMetadata(), enumValue(app.getDevelopmentStage()));
    } else if (asset instanceof McpServer server) {
      result = governance(server.getGovernanceMetadata(), enumValue(server.getDevelopmentStage()));
    } else if (asset instanceof LLMModel llm) {
      result = new GovernanceSnapshot(null, actions(llm.getRemediationActions()), null, null);
    }
    return result;
  }

  private static GovernanceSnapshot governance(
      GovernanceMetadata governance, String deploymentStage) {
    return governance == null
        ? new GovernanceSnapshot(null, List.of(), null, deploymentStage)
        : new GovernanceSnapshot(
            governance.getAiCompliance(),
            actions(governance.getRemediationActions()),
            governance.getRiskAssessment() == null
                ? null
                : enumValue(governance.getRiskAssessment().getRiskLevel()),
            deploymentStage);
  }

  private static GovernanceSnapshot governance(
      McpGovernanceMetadata governance, String deploymentStage) {
    return governance == null
        ? new GovernanceSnapshot(null, List.of(), null, deploymentStage)
        : new GovernanceSnapshot(
            governance.getAiCompliance(),
            actions(governance.getRemediationActions()),
            governance.getRiskAssessment() == null
                ? null
                : enumValue(governance.getRiskAssessment().getRiskLevel()),
            deploymentStage);
  }

  private static List<RemediationAction> actions(List<RemediationAction> actions) {
    return actions == null ? List.of() : actions;
  }

  private static String enumValue(Object value) {
    return value == null ? null : value.toString();
  }

  private static boolean anyMatch(List<String> required, List<String> assetValues) {
    boolean result = false;
    if (assetValues != null && !assetValues.isEmpty()) {
      for (String r : required) {
        if (assetValues.contains(r)) {
          result = true;
          break;
        }
      }
    }

    return result;
  }

  private record AssetCompliance(
      ComplianceRecordSnapshot record, List<RemediationAction> remediationActions) {}

  private record ComplianceRecordSnapshot(String status, boolean hasEvidence) {}

  private record GovernanceSnapshot(
      AICompliance aiCompliance,
      List<RemediationAction> remediationActions,
      String riskLevel,
      String deploymentStage) {
    private static final GovernanceSnapshot EMPTY =
        new GovernanceSnapshot(null, List.of(), null, null);
  }

  private record ControlCoverage(int evidence, int partial, int nonCompliant) {}
}
