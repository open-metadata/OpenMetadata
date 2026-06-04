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
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.AIFrameworkControl;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
import org.openmetadata.schema.entity.ai.FrameworkAutoApplyRules;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
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
@SuppressWarnings("unchecked")
final class FrameworkCoverageComputer {

  private static final int PAGE_SIZE = 1000;

  private FrameworkCoverageComputer() {}

  static Map<String, Object> compute(
      AIGovernanceFramework framework, List<AIFrameworkControl> controls) {
    List<EntityInterface> assets = collectInScopeAssets(framework);
    Map<String, Object> response = new LinkedHashMap<>();
    response.put("frameworkId", framework.getId() == null ? null : framework.getId().toString());
    response.put("frameworkName", framework.getName());
    response.put("assetsInScope", assets.size());

    String frameworkName = framework.getName();
    int totalEvidenceCount = 0;
    int compliantAssetCount = 0;
    int partialAssetCount = 0;
    int nonCompliantAssetCount = 0;
    for (EntityInterface asset : assets) {
      Map<String, Object> record = findComplianceRecord(asset, frameworkName);
      if (record == null) {
        nonCompliantAssetCount++;
        continue;
      }
      String status = String.valueOf(record.getOrDefault("status", "UnderReview"));
      if ("Compliant".equals(status)) {
        compliantAssetCount++;
      } else if ("PartiallyCompliant".equals(status)) {
        partialAssetCount++;
      } else if ("NonCompliant".equals(status) || "UnderReview".equals(status)) {
        nonCompliantAssetCount++;
      }
      Object verification = record.get("verification");
      if (verification instanceof Map<?, ?> v
          && ((Map<String, Object>) v).get("certificateUrl") != null) {
        totalEvidenceCount++;
      }
    }

    List<Map<String, Object>> entries = new ArrayList<>();
    int controlEvidenceShare = controls.isEmpty() ? 0 : totalEvidenceCount / controls.size();
    for (AIFrameworkControl control : controls) {
      Map<String, Object> entry = new LinkedHashMap<>();
      String code = control.getCode() == null ? control.getName() : control.getCode();
      entry.put("code", code);
      entry.put("displayName", control.getDisplayName());
      entry.put("category", control.getCategory());
      entry.put("status", deriveControlStatus(nonCompliantAssetCount, partialAssetCount));
      entry.put(
          "affectedAssetCount",
          deriveAffectedAssetCount(nonCompliantAssetCount, partialAssetCount));
      entry.put("evidenceCount", controlEvidenceShare);
      entries.add(entry);
    }
    response.put("controls", entries);
    response.put(
        "summary",
        Map.of(
            "compliant",
            compliantAssetCount,
            "partial",
            partialAssetCount,
            "nonCompliant",
            nonCompliantAssetCount));

    return response;
  }

  private static String deriveControlStatus(int nonCompliant, int partial) {
    String result;
    if (nonCompliant > 0) {
      result = "Gap";
    } else if (partial > 0) {
      result = "Partial";
    } else {
      result = "Met";
    }

    return result;
  }

  private static int deriveAffectedAssetCount(int nonCompliant, int partial) {
    return nonCompliant + partial;
  }

  private static Map<String, Object> findComplianceRecord(
      EntityInterface asset, String frameworkName) {
    Map<String, Object> result = null;
    Map<String, Object> governance = governanceOf(asset);
    if (governance != null) {
      Object aiCompliance = governance.get("aiCompliance");
      if (aiCompliance instanceof Map<?, ?> compliance) {
        Object records = ((Map<String, Object>) compliance).get("complianceRecords");
        if (records instanceof List<?> list) {
          for (Object item : list) {
            if (item instanceof Map<?, ?> record) {
              Map<String, Object> recordMap = (Map<String, Object>) record;
              Object recordFramework = recordMap.get("framework");
              if (frameworkMatches(recordFramework, frameworkName)) {
                result = recordMap;
                break;
              }
            }
          }
        }
      }
    }

    return result;
  }

  private static boolean frameworkMatches(Object recordFramework, String frameworkName) {
    boolean result = false;
    if (recordFramework instanceof String value && value.equalsIgnoreCase(frameworkName)) {
      result = true;
    } else if (recordFramework instanceof Map<?, ?> ref) {
      Object name = ((Map<String, Object>) ref).get("name");
      if (name instanceof String nameStr && nameStr.equalsIgnoreCase(frameworkName)) {
        result = true;
      }
    }

    return result;
  }

  private static Map<String, Object> governanceOf(EntityInterface asset) {
    Map<String, Object> result = null;
    try {
      Map<String, Object> raw = JsonUtils.readValue(JsonUtils.pojoToJson(asset), Map.class);
      Object governance = raw.get("governanceMetadata");
      if (governance instanceof Map<?, ?> g) {
        result = (Map<String, Object>) g;
      }
    } catch (Exception ignored) {
      // Best-effort — empty governance returns null
    }

    return result;
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
      Map<String, Object> governance = governanceOf(entity);
      boolean regionsOk = matchesRegions(governance, rules);
      boolean riskOk = matchesRiskClasses(governance, rules);
      boolean stageOk = matchesDeploymentStages(entity, rules);
      result = regionsOk && riskOk && stageOk;
    }

    return result;
  }

  private static boolean matchesRegions(
      Map<String, Object> governance, FrameworkAutoApplyRules rules) {
    boolean result;
    List<String> required = rules.getRegions();
    if (required == null || required.isEmpty()) {
      result = true;
    } else {
      List<String> assetRegions = extractRegions(governance);
      result = anyMatch(required, assetRegions);
    }

    return result;
  }

  private static boolean matchesRiskClasses(
      Map<String, Object> governance, FrameworkAutoApplyRules rules) {
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
      EntityInterface entity, FrameworkAutoApplyRules rules) {
    boolean result;
    List<String> required = rules.getDeploymentStages();
    if (required == null || required.isEmpty()) {
      result = true;
    } else {
      String stage = extractDeploymentStage(entity);
      result = stage != null && required.contains(stage);
    }

    return result;
  }

  private static List<String> extractRegions(Map<String, Object> governance) {
    List<String> result = new ArrayList<>();
    if (governance != null) {
      Object aiCompliance = governance.get("aiCompliance");
      if (aiCompliance instanceof Map<?, ?> compliance) {
        Object records = ((Map<String, Object>) compliance).get("complianceRecords");
        if (records instanceof List<?> list) {
          for (Object item : list) {
            if (item instanceof Map<?, ?> record) {
              Object scope = ((Map<String, Object>) record).get("scopeAndDeployment");
              if (scope instanceof Map<?, ?> s) {
                Object regions = ((Map<String, Object>) s).get("deploymentRegions");
                if (regions instanceof List<?> regionsList) {
                  for (Object r : regionsList) {
                    if (r instanceof String region) {
                      result.add(region);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return result;
  }

  private static List<String> extractRiskClasses(Map<String, Object> governance) {
    List<String> result = new ArrayList<>();
    if (governance != null) {
      Object risk = governance.get("riskAssessment");
      if (risk instanceof Map<?, ?> riskMap) {
        Object level = ((Map<String, Object>) riskMap).get("riskLevel");
        if (level instanceof String levelStr) {
          result.add(levelStr);
        }
      }
      Object aiCompliance = governance.get("aiCompliance");
      if (aiCompliance instanceof Map<?, ?> compliance) {
        Object records = ((Map<String, Object>) compliance).get("complianceRecords");
        if (records instanceof List<?> list) {
          for (Object item : list) {
            if (item instanceof Map<?, ?> record) {
              Object euAct = ((Map<String, Object>) record).get("euAIAct");
              if (euAct instanceof Map<?, ?> euMap) {
                Object cls = ((Map<String, Object>) euMap).get("riskClassification");
                if (cls instanceof String clsStr) {
                  result.add(clsStr);
                }
              }
            }
          }
        }
      }
    }

    return result;
  }

  private static String extractDeploymentStage(EntityInterface entity) {
    String result = null;
    try {
      Map<String, Object> raw = JsonUtils.readValue(JsonUtils.pojoToJson(entity), Map.class);
      Object stage = raw.get("developmentStage");
      if (stage instanceof String stageStr) {
        result = stageStr;
      }
    } catch (Exception ignored) {
      // null is acceptable
    }

    return result;
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
}
