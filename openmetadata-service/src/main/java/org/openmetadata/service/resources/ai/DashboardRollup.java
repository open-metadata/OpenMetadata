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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.Builder;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
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
  private static final String COMPLIANT = "Compliant";

  private DashboardRollup() {}

  static Map<String, Object> compute() {
    List<RolledAsset> assets = new ArrayList<>();
    collectAssets(Entity.AI_APPLICATION, "owners,domains,governanceMetadata", assets);
    collectAssets(Entity.MCP_SERVER, "owners,domains,governanceMetadata", assets);
    collectAssets(Entity.LLM_MODEL, "owners,domains,governanceStatus,detection", assets);

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
   * Per-framework readiness: % of in-scope assets currently {@code Compliant}. The
   * {@code focus} flag marks the most time-pressing framework the workspace has
   * enabled (nearest {@code nextDeadline}, breaking ties on lowest readiness) so the
   * UI can badge it; nothing is focused when no enabled framework has assessments.
   */
  private static List<Map<String, Object>> frameworkReadiness(List<RolledAsset> assets) {
    List<Map<String, Object>> result = buildReadinessEntries(frameworkCounts(assets));
    String focusKey = pickFocusFramework(result, enabledFrameworkDeadlines());
    for (Map<String, Object> entry : result) {
      String key = entry.get("framework").toString().toUpperCase(Locale.ROOT);
      entry.put("focus", key.equals(focusKey));
    }
    return result;
  }

  private static Map<String, int[]> frameworkCounts(List<RolledAsset> assets) {
    Map<String, int[]> bucketByFramework = new LinkedHashMap<>();
    for (RolledAsset asset : assets) {
      for (Map.Entry<String, String> entry : asset.frameworkStatuses().entrySet()) {
        int[] counts = bucketByFramework.computeIfAbsent(entry.getKey(), k -> new int[2]);
        counts[1] += 1;
        if (COMPLIANT.equals(entry.getValue())) {
          counts[0] += 1;
        }
      }
    }
    return bucketByFramework;
  }

  private static List<Map<String, Object>> buildReadinessEntries(Map<String, int[]> counts) {
    List<Map<String, Object>> result = new ArrayList<>();
    counts.forEach(
        (framework, count) -> {
          Map<String, Object> entry = new LinkedHashMap<>();
          entry.put("framework", framework);
          entry.put("compliant", count[0]);
          entry.put("inScope", count[1]);
          entry.put("readiness", count[1] == 0 ? 0.0 : (double) count[0] / count[1]);
          result.add(entry);
        });
    return result;
  }

  /** Map of enabled framework identifier (upper-cased) to its next deadline (nullable). */
  private static Map<String, Long> enabledFrameworkDeadlines() {
    Map<String, Long> result = new LinkedHashMap<>();
    try {
      EntityRepository<? extends EntityInterface> repository =
          Entity.getEntityRepository(Entity.AI_GOVERNANCE_FRAMEWORK);
      ListFilter filter = new ListFilter();
      String after = null;
      do {
        ResultList<? extends EntityInterface> page =
            repository.listAfter(null, Fields.EMPTY_FIELDS, filter, PAGE_SIZE, after);
        for (EntityInterface entity : page.getData()) {
          collectEnabledFramework(entity, result);
        }
        after = page.getPaging() == null ? null : page.getPaging().getAfter();
      } while (after != null);
    } catch (Exception error) {
      LOG.warn("Dashboard rollup: failed to list AI governance frameworks", error);
    }
    return result;
  }

  private static void collectEnabledFramework(EntityInterface entity, Map<String, Long> out) {
    if (entity instanceof AIGovernanceFramework framework
        && Boolean.TRUE.equals(framework.getEnabled())
        && framework.getName() != null) {
      out.put(framework.getName().toUpperCase(Locale.ROOT), framework.getNextDeadline());
    }
  }

  private static String pickFocusFramework(
      List<Map<String, Object>> readiness, Map<String, Long> enabledDeadlines) {
    String focusKey = null;
    long bestDeadline = Long.MAX_VALUE;
    double bestReadiness = Double.MAX_VALUE;
    for (Map<String, Object> entry : readiness) {
      String key = entry.get("framework").toString().toUpperCase(Locale.ROOT);
      if (enabledDeadlines.containsKey(key)) {
        Long deadline = enabledDeadlines.get(key);
        long effectiveDeadline = deadline == null ? Long.MAX_VALUE : deadline;
        double readinessValue = ((Number) entry.get("readiness")).doubleValue();
        if (effectiveDeadline < bestDeadline
            || (effectiveDeadline == bestDeadline && readinessValue < bestReadiness)) {
          bestDeadline = effectiveDeadline;
          bestReadiness = readinessValue;
          focusKey = key;
        }
      }
    }
    return focusKey;
  }

  /**
   * 4 risk levels × 4 affected-user buckets = 16 cells. Each non-empty cell also
   * carries the {@code topEntity} (the asset with the most affected users in that
   * cell) so the UI can name the headline asset alongside the count.
   */
  private static List<Map<String, Object>> riskMatrix(List<RolledAsset> assets) {
    String[] risks = {"Unacceptable", "High", "Limited", "Minimal"};
    int[] bucketCaps = {1000, 10000, 100000, Integer.MAX_VALUE};
    String[] bucketLabels = {"<1k", "1k–10k", "10k–100k", ">100k"};
    int[][] counts = new int[risks.length][bucketCaps.length];
    RolledAsset[][] top = new RolledAsset[risks.length][bucketCaps.length];

    for (RolledAsset asset : assets) {
      int riskIdx = indexOf(risks, asset.euRisk());
      if (riskIdx >= 0) {
        int bucketIdx = bucketIndex(bucketCaps, asset.affectedUsers());
        counts[riskIdx][bucketIdx] += 1;
        top[riskIdx][bucketIdx] = pickTop(top[riskIdx][bucketIdx], asset);
      }
    }

    List<Map<String, Object>> cells = new ArrayList<>();
    for (int r = 0; r < risks.length; r++) {
      for (int c = 0; c < bucketCaps.length; c++) {
        Map<String, Object> cell = new LinkedHashMap<>();
        cell.put("risk", risks[r]);
        cell.put("impactBucket", bucketLabels[c]);
        cell.put("count", counts[r][c]);
        if (top[r][c] != null) {
          cell.put("topEntity", top[r][c].toTopEntity());
        }
        cells.add(cell);
      }
    }
    return cells;
  }

  private static int indexOf(String[] values, String target) {
    int result = -1;
    for (int i = 0; i < values.length; i++) {
      if (values[i].equals(target)) {
        result = i;
        break;
      }
    }
    return result;
  }

  private static int bucketIndex(int[] caps, int value) {
    int result = caps.length - 1;
    for (int i = 0; i < caps.length; i++) {
      if (value < caps[i]) {
        result = i;
        break;
      }
    }
    return result;
  }

  private static RolledAsset pickTop(RolledAsset current, RolledAsset candidate) {
    RolledAsset result = current;
    boolean wins =
        current == null
            || candidate.affectedUsers() > current.affectedUsers()
            || (candidate.affectedUsers() == current.affectedUsers()
                && safeName(candidate).compareTo(safeName(current)) < 0);
    if (wins) {
      result = candidate;
    }
    return result;
  }

  private static String safeName(RolledAsset asset) {
    return asset.name() == null ? "" : asset.name();
  }

  static List<Map<String, Object>> topByStatus(
      List<RolledAsset> assets, String registrationStatus) {
    return assets.stream()
        .filter(asset -> registrationStatus.equals(asset.registrationStatus()))
        .sorted(
            Comparator.comparingInt(RolledAsset::affectedUsers)
                .reversed()
                .thenComparing(DashboardRollup::safeName))
        .limit(TOP_N)
        .map(RolledAsset::toSummary)
        .toList();
  }

  /** Normalized rolled-up view of an AI asset for rollup math. */
  @Builder
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
    private final String detectedVia;
    private final Long detectedAt;
    private final String submittedBy;
    private final String team;

    String name() {
      return name;
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
      summary.put("detectedVia", detectedVia);
      summary.put("detectedAt", detectedAt);
      summary.put("submittedBy", submittedBy);
      summary.put("submittedAt", registeredAt);
      summary.put("team", team);

      return summary;
    }

    Map<String, Object> toTopEntity() {
      Map<String, Object> entity = new LinkedHashMap<>();
      entity.put("name", name);
      entity.put("displayName", displayName);
      entity.put("fullyQualifiedName", fqn);
      entity.put("entityType", entityType);

      return entity;
    }

    @SuppressWarnings("unchecked")
    static RolledAsset from(String entityType, EntityInterface entity) {
      Map<String, Object> json =
          (Map<String, Object>) JsonUtils.getObjectMapper().convertValue(entity, Map.class);
      Map<String, Object> governance = pickGovernance(entityType, json);
      String registrationStatus = registrationStatus(entityType, json, governance);
      Map<String, String> frameworks = new LinkedHashMap<>();
      String euRisk = extractCompliance(governance, frameworks);
      int users = affectedUsers(governance);
      Map<String, Object> detection =
          governance == null ? null : asMap(governance.get("detection"));

      return RolledAsset.builder()
          .entityType(entityType)
          .id(asString(json.get("id")))
          .name(asString(json.get("name")))
          .displayName(asString(json.get("displayName")))
          .fqn(asString(json.get("fullyQualifiedName")))
          .registrationStatus(registrationStatus)
          .euRisk(euRisk)
          .affectedUsers(users)
          .frameworkStatuses(frameworks)
          .registeredAt(governance == null ? null : numberToLong(governance.get("registeredAt")))
          .detectedVia(detection == null ? null : asString(detection.get("source")))
          .detectedAt(detection == null ? null : numberToLong(detection.get("detectedAt")))
          .submittedBy(governance == null ? null : asString(governance.get("registeredBy")))
          .team(firstDomainName(json.get("domains")))
          .build();
    }

    private static String extractCompliance(
        Map<String, Object> governance, Map<String, String> frameworks) {
      String euRisk = null;
      Map<String, Object> aiCompliance =
          governance == null ? null : asMap(governance.get("aiCompliance"));
      List<Object> records =
          aiCompliance == null ? null : asList(aiCompliance.get("complianceRecords"));
      if (records != null) {
        for (Object recordObj : records) {
          Map<String, Object> record = asMap(recordObj);
          if (record != null) {
            Object framework = record.get("framework");
            Object status = record.get("status");
            if (framework != null && status != null) {
              frameworks.putIfAbsent(framework.toString(), status.toString());
            }
            Map<String, Object> eu = asMap(record.get("euAIAct"));
            if (euRisk == null && eu != null && eu.get("riskClassification") != null) {
              euRisk = eu.get("riskClassification").toString();
            }
          }
        }
      }
      return euRisk;
    }

    private static int affectedUsers(Map<String, Object> governance) {
      int users = 0;
      Map<String, Object> aiCompliance =
          governance == null ? null : asMap(governance.get("aiCompliance"));
      List<Object> records =
          aiCompliance == null ? null : asList(aiCompliance.get("complianceRecords"));
      if (records != null) {
        for (Object recordObj : records) {
          Map<String, Object> record = asMap(recordObj);
          Map<String, Object> scope =
              record == null ? null : asMap(record.get("scopeAndDeployment"));
          if (scope != null && scope.get("affectedUserCount") instanceof Number number) {
            users = Math.max(users, number.intValue());
          }
        }
      }
      return users;
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

  @SuppressWarnings("unchecked")
  private static Map<String, Object> asMap(Object value) {
    return value instanceof Map<?, ?> ? (Map<String, Object>) value : null;
  }

  @SuppressWarnings("unchecked")
  private static List<Object> asList(Object value) {
    return value instanceof List<?> ? (List<Object>) value : null;
  }

  private static String asString(Object value) {
    return value == null ? null : value.toString();
  }

  private static Long numberToLong(Object value) {
    return value instanceof Number number ? number.longValue() : null;
  }

  private static String firstDomainName(Object domainsValue) {
    String result = null;
    List<Object> domains = asList(domainsValue);
    if (!nullOrEmpty(domains)) {
      Map<String, Object> first = asMap(domains.getFirst());
      if (first != null) {
        result =
            first.get("displayName") != null
                ? first.get("displayName").toString()
                : asString(first.get("name"));
      }
    }
    return result;
  }
}
