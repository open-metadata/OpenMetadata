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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * Computes the AI governance dashboard rollup the Overview tab consumes in
 * a single round-trip. Pulls AI Applications, LLM Models, and MCP Servers
 * from their repositories, projects each onto a normalized governance map
 * via Jackson, then aggregates stats / risk-matrix / framework readiness /
 * top-N lists in memory.
 *
 * <p>For estates over ~10k assets this should move to Elasticsearch
 * aggregations against the {@code aiGovernance.*} fields the
 * {@link org.openmetadata.service.search.indexes.AIGovernanceIndexProjection}
 * already produces. The paginated in-memory path keeps Phase 3 testable without a
 * search backend running.
 */
@Slf4j
final class DashboardRollup {

  private static final int PAGE_SIZE = 1000;
  private static final int TOP_N = 5;

  private DashboardRollup() {}

  static Map<String, Object> compute() {
    List<RolledAsset> assets = new ArrayList<>();
    collectAssets(Entity.AI_APPLICATION, "owners,governanceMetadata", assets);
    collectAssets(Entity.MCP_SERVER, "owners,governanceMetadata", assets);
    collectAssets(Entity.LLM_MODEL, "owners,governanceStatus,detection", assets);

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("estateStats", estateStats(assets));
    response.put("frameworkReadiness", frameworkReadiness(assets));
    response.put("riskMatrix", riskMatrix(assets));
    response.put("topShadow", topByStatus(assets, "Unregistered"));
    response.put("topApprovals", topByStatus(assets, "PendingApproval"));
    response.put("generatedAt", System.currentTimeMillis());

    return response;
  }

  private static void collectAssets(String entityType, String fields, List<RolledAsset> out) {
    try {
      EntityRepository<? extends EntityInterface> repository =
          Entity.getEntityRepository(entityType);
      Fields parsedFields = repository.getFields(fields);
      ListFilter filter = new ListFilter();
      String after = null;
      do {
        ResultList<? extends EntityInterface> page =
            repository.listAfter(null, parsedFields, filter, PAGE_SIZE, after);
        for (EntityInterface entity : page.getData()) {
          out.add(RolledAsset.from(entityType, entity));
        }
        after = page.getPaging() == null ? null : page.getPaging().getAfter();
      } while (after != null);
    } catch (Exception error) {
      LOG.warn("Dashboard rollup: failed to list {}", entityType, error);
    }
  }

  private static Map<String, Object> estateStats(List<RolledAsset> assets) {
    int total = assets.size();
    int registered = 0;
    int shadow = 0;
    int pending = 0;
    int approved = 0;
    int highRisk = 0;
    int unacceptable = 0;
    for (RolledAsset asset : assets) {
      switch (asset.registrationStatus()) {
        case "Registered":
          registered++;
          break;
        case "Approved":
          approved++;
          registered++;
          break;
        case "PendingApproval":
          pending++;
          break;
        case "Unregistered":
          shadow++;
          break;
        default:
      }
      String risk = asset.euRisk();
      if ("High".equals(risk)) {
        highRisk++;
      } else if ("Unacceptable".equals(risk)) {
        unacceptable++;
      }
    }
    Map<String, Object> stats = new LinkedHashMap<>();
    stats.put("total", total);
    stats.put("registered", registered);
    stats.put("approved", approved);
    stats.put("shadow", shadow);
    stats.put("pending", pending);
    stats.put("highRisk", highRisk);
    stats.put("unacceptable", unacceptable);

    return stats;
  }

  /**
   * Per-framework readiness: % of in-scope assets currently {@code Compliant}.
   */
  private static List<Map<String, Object>> frameworkReadiness(List<RolledAsset> assets) {
    Map<String, int[]> bucketByFramework = new LinkedHashMap<>();
    for (RolledAsset asset : assets) {
      for (Map.Entry<String, String> entry : asset.frameworkStatuses().entrySet()) {
        int[] counts = bucketByFramework.computeIfAbsent(entry.getKey(), k -> new int[2]);
        counts[1] += 1;
        if ("Compliant".equals(entry.getValue())) {
          counts[0] += 1;
        }
      }
    }
    List<Map<String, Object>> result = new ArrayList<>();
    bucketByFramework.forEach(
        (framework, counts) -> {
          int compliant = counts[0];
          int inScope = counts[1];
          Map<String, Object> entry = new LinkedHashMap<>();
          entry.put("framework", framework);
          entry.put("compliant", compliant);
          entry.put("inScope", inScope);
          entry.put("readiness", inScope == 0 ? 0.0 : (double) compliant / inScope);
          result.add(entry);
        });
    return result;
  }

  /**
   * 4 risk levels × 4 affected-user buckets = 16 cells.
   */
  private static List<Map<String, Object>> riskMatrix(List<RolledAsset> assets) {
    String[] risks = {"Unacceptable", "High", "Limited", "Minimal"};
    int[] bucketCaps = {1000, 10000, 100000, Integer.MAX_VALUE};
    String[] bucketLabels = {"<1k", "1k–10k", "10k–100k", ">100k"};
    int[][] counts = new int[risks.length][bucketCaps.length];

    for (RolledAsset asset : assets) {
      String risk = asset.euRisk();
      int riskIdx = -1;
      for (int i = 0; i < risks.length; i++) {
        if (risks[i].equals(risk)) {
          riskIdx = i;
          break;
        }
      }
      if (riskIdx < 0) {
        continue;
      }
      int users = asset.affectedUsers();
      int bucketIdx = bucketCaps.length - 1;
      for (int i = 0; i < bucketCaps.length; i++) {
        if (users < bucketCaps[i]) {
          bucketIdx = i;
          break;
        }
      }
      counts[riskIdx][bucketIdx] += 1;
    }

    List<Map<String, Object>> cells = new ArrayList<>();
    for (int r = 0; r < risks.length; r++) {
      for (int c = 0; c < bucketCaps.length; c++) {
        Map<String, Object> cell = new LinkedHashMap<>();
        cell.put("risk", risks[r]);
        cell.put("impactBucket", bucketLabels[c]);
        cell.put("count", counts[r][c]);
        cells.add(cell);
      }
    }
    return cells;
  }

  private static List<Map<String, Object>> topByStatus(
      List<RolledAsset> assets, String registrationStatus) {
    List<Map<String, Object>> result = new ArrayList<>();
    for (RolledAsset asset : assets) {
      if (result.size() >= TOP_N) {
        break;
      }
      if (registrationStatus.equals(asset.registrationStatus())) {
        result.add(asset.toSummary());
      }
    }
    return result;
  }

  /** Normalized rolled-up view of an AI asset for rollup math. */
  static final class RolledAsset {
    private final String entityType;
    private final String id;
    private final String name;
    private final String displayName;
    private final String fqn;
    private final String registrationStatus;
    private final String euRisk;
    private final int affectedUsers;
    private final Map<String, String> frameworkStatuses;
    private final Long registeredAt;

    private RolledAsset(
        String entityType,
        String id,
        String name,
        String displayName,
        String fqn,
        String registrationStatus,
        String euRisk,
        int affectedUsers,
        Map<String, String> frameworkStatuses,
        Long registeredAt) {
      this.entityType = entityType;
      this.id = id;
      this.name = name;
      this.displayName = displayName;
      this.fqn = fqn;
      this.registrationStatus = registrationStatus;
      this.euRisk = euRisk;
      this.affectedUsers = affectedUsers;
      this.frameworkStatuses = frameworkStatuses;
      this.registeredAt = registeredAt;
    }

    String registrationStatus() {
      return registrationStatus;
    }

    String euRisk() {
      return euRisk;
    }

    int affectedUsers() {
      return affectedUsers;
    }

    Map<String, String> frameworkStatuses() {
      return frameworkStatuses;
    }

    Map<String, Object> toSummary() {
      Map<String, Object> summary = new LinkedHashMap<>();
      summary.put("entityType", entityType);
      summary.put("id", id);
      summary.put("name", name);
      summary.put("displayName", displayName);
      summary.put("fullyQualifiedName", fqn);
      summary.put("registrationStatus", registrationStatus);
      summary.put("euRisk", euRisk);
      summary.put("affectedUsers", affectedUsers);
      summary.put("registeredAt", registeredAt);

      return summary;
    }

    static RolledAsset from(String entityType, EntityInterface entity) {
      Map<String, Object> json =
          (Map<String, Object>) JsonUtils.getObjectMapper().convertValue(entity, Map.class);
      Map<String, Object> governance = pickGovernance(entityType, json);
      String registrationStatus = registrationStatus(entityType, json, governance);
      Map<String, String> frameworks = new LinkedHashMap<>();
      String euRisk = null;
      int users = 0;
      if (governance != null) {
        Map<String, Object> aiCompliance = asMap(governance.get("aiCompliance"));
        if (aiCompliance != null) {
          List<Object> records = asList(aiCompliance.get("complianceRecords"));
          if (records != null) {
            for (Object recordObj : records) {
              Map<String, Object> record = asMap(recordObj);
              if (record == null) {
                continue;
              }
              Object framework = record.get("framework");
              Object status = record.get("status");
              if (framework != null && status != null) {
                frameworks.putIfAbsent(framework.toString(), status.toString());
              }
              Map<String, Object> eu = asMap(record.get("euAIAct"));
              if (eu != null && eu.get("riskClassification") != null && euRisk == null) {
                euRisk = eu.get("riskClassification").toString();
              }
              Map<String, Object> scope = asMap(record.get("scopeAndDeployment"));
              if (scope != null && scope.get("affectedUserCount") instanceof Number number) {
                users = Math.max(users, number.intValue());
              }
            }
          }
        }
      }
      Long registeredAt = null;
      if (governance != null && governance.get("registeredAt") instanceof Number number) {
        registeredAt = number.longValue();
      }
      return new RolledAsset(
          entityType,
          (String) json.get("id"),
          (String) json.get("name"),
          (String) json.get("displayName"),
          (String) json.get("fullyQualifiedName"),
          registrationStatus,
          euRisk,
          users,
          frameworks,
          registeredAt);
    }

    private static String registrationStatus(
        String entityType, Map<String, Object> json, Map<String, Object> governance) {
      String result = "Registered";
      if (Entity.LLM_MODEL.equals(entityType)) {
        Object status = json.get("governanceStatus");
        if (status != null) {
          result = mapLlmStatus(status.toString());
        }
      } else if (governance != null && governance.get("registrationStatus") != null) {
        result = governance.get("registrationStatus").toString();
      }
      return result;
    }

    private static String mapLlmStatus(String status) {
      String result;
      switch (status) {
        case "Approved":
          result = "Approved";
          break;
        case "PendingReview":
          result = "PendingApproval";
          break;
        case "Rejected":
          result = "Rejected";
          break;
        case "Unauthorized":
          result = "Unregistered";
          break;
        default:
          result = "Registered";
      }
      return result;
    }

    private static Map<String, Object> pickGovernance(String entityType, Map<String, Object> json) {
      Map<String, Object> result = null;
      if (Entity.LLM_MODEL.equals(entityType)) {
        Map<String, Object> shim = new LinkedHashMap<>();
        Object status = json.get("governanceStatus");
        if (status != null) {
          shim.put("registrationStatus", mapLlmStatus(status.toString()));
        }
        if (json.get("detection") != null) {
          shim.put("detection", json.get("detection"));
        }
        if (!nullOrEmpty(shim)) {
          result = shim;
        }
      } else {
        result = asMap(json.get("governanceMetadata"));
      }
      return result;
    }
  }

  private static Map<String, Object> asMap(Object value) {
    return value instanceof Map<?, ?> ? (Map<String, Object>) value : null;
  }

  private static List<Object> asList(Object value) {
    return value instanceof List<?> ? (List<Object>) value : null;
  }
}
