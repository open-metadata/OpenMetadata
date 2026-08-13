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
import org.openmetadata.schema.api.ai.AIGovernanceAssetSummary;
import org.openmetadata.schema.api.ai.AIGovernanceDashboardResponse;
import org.openmetadata.schema.api.ai.AIGovernanceEstateStats;
import org.openmetadata.schema.api.ai.AIGovernanceFrameworkReadiness;
import org.openmetadata.schema.api.ai.AIGovernanceRiskMatrixCell;
import org.openmetadata.schema.api.ai.AIGovernanceTopEntity;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
import org.openmetadata.schema.entity.ai.GovernanceMetadata;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.ai.McpGovernanceMetadata;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.type.AICompliance;
import org.openmetadata.schema.type.AIComplianceRecord;
import org.openmetadata.schema.type.AIDetection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * Computes the AI governance dashboard rollup the Overview tab consumes in
 * a single round-trip. Pulls AI Applications, LLM Models, and MCP Servers
 * from their repositories, projects each onto a normalized governance record,
 * then aggregates stats / risk-matrix / framework readiness /
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
  private static final String[] RISK_SEVERITY = {"Unacceptable", "High", "Limited", "Minimal"};

  private DashboardRollup() {}

  static AIGovernanceDashboardResponse compute() {
    List<RolledAsset> assets = new ArrayList<>();
    collectAssets(Entity.AI_APPLICATION, "owners,domains,governanceMetadata", assets);
    collectAssets(Entity.MCP_SERVER, "owners,domains,governanceMetadata", assets);
    collectAssets(Entity.LLM_MODEL, "owners,domains,governanceStatus,detection", assets);

    return new AIGovernanceDashboardResponse()
        .withEstateStats(estateStats(assets))
        .withFrameworkReadiness(frameworkReadiness(assets))
        .withRiskMatrix(riskMatrix(assets))
        .withTopShadow(topByStatus(assets, "Unregistered", shadowRanking()))
        .withTopApprovals(topByStatus(assets, "PendingApproval", approvalRanking()))
        .withGeneratedAt(System.currentTimeMillis());
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

  private static AIGovernanceEstateStats estateStats(List<RolledAsset> assets) {
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
    return new AIGovernanceEstateStats()
        .withTotal(total)
        .withRegistered(registered)
        .withApproved(approved)
        .withShadow(shadow)
        .withPending(pending)
        .withHighRisk(highRisk)
        .withUnacceptable(unacceptable);
  }

  /**
   * Per-framework readiness: % of in-scope assets currently {@code Compliant}. The
   * {@code focus} flag marks the most time-pressing framework the workspace has
   * enabled (nearest {@code nextDeadline}, breaking ties on lowest readiness) so the
   * UI can badge it; nothing is focused when no enabled framework has assessments.
   */
  private static List<AIGovernanceFrameworkReadiness> frameworkReadiness(List<RolledAsset> assets) {
    List<AIGovernanceFrameworkReadiness> result = buildReadinessEntries(frameworkCounts(assets));
    String focusKey = pickFocusFramework(result, enabledFrameworkDeadlines());
    for (AIGovernanceFrameworkReadiness entry : result) {
      String key = entry.getFramework().toUpperCase(Locale.ROOT);
      entry.setFocus(key.equals(focusKey));
    }
    return result;
  }

  private static Map<String, FrameworkReadinessCounts> frameworkCounts(List<RolledAsset> assets) {
    Map<String, FrameworkReadinessCounts> bucketByFramework = new LinkedHashMap<>();
    for (RolledAsset asset : assets) {
      for (FrameworkStatusSnapshot status : asset.frameworkStatuses()) {
        bucketByFramework.merge(
            status.framework(),
            new FrameworkReadinessCounts(COMPLIANT.equals(status.status()) ? 1 : 0, 1),
            FrameworkReadinessCounts::plus);
      }
    }
    return bucketByFramework;
  }

  private static List<AIGovernanceFrameworkReadiness> buildReadinessEntries(
      Map<String, FrameworkReadinessCounts> counts) {
    List<AIGovernanceFrameworkReadiness> result = new ArrayList<>();
    counts.forEach(
        (framework, count) -> {
          result.add(
              new AIGovernanceFrameworkReadiness()
                  .withFramework(framework)
                  .withCompliant(count.compliant())
                  .withInScope(count.inScope())
                  .withReadiness(count.readiness())
                  .withFocus(false));
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
      List<AIGovernanceFrameworkReadiness> readiness, Map<String, Long> enabledDeadlines) {
    String focusKey = null;
    long bestDeadline = Long.MAX_VALUE;
    double bestReadiness = Double.MAX_VALUE;
    for (AIGovernanceFrameworkReadiness entry : readiness) {
      String key = entry.getFramework().toUpperCase(Locale.ROOT);
      if (enabledDeadlines.containsKey(key)) {
        Long deadline = enabledDeadlines.get(key);
        long effectiveDeadline = deadline == null ? Long.MAX_VALUE : deadline;
        double readinessValue = entry.getReadiness();
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
  private static List<AIGovernanceRiskMatrixCell> riskMatrix(List<RolledAsset> assets) {
    String[] risks = RISK_SEVERITY;
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

    List<AIGovernanceRiskMatrixCell> cells = new ArrayList<>();
    for (int r = 0; r < risks.length; r++) {
      for (int c = 0; c < bucketCaps.length; c++) {
        AIGovernanceRiskMatrixCell cell =
            new AIGovernanceRiskMatrixCell()
                .withRisk(risks[r])
                .withImpactBucket(bucketLabels[c])
                .withCount(counts[r][c]);
        if (top[r][c] != null) {
          cell.setTopEntity(top[r][c].toTopEntity());
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

  static List<AIGovernanceAssetSummary> topByStatus(
      List<RolledAsset> assets, String registrationStatus, Comparator<RolledAsset> ranking) {
    return assets.stream()
        .filter(asset -> registrationStatus.equals(asset.registrationStatus()))
        .sorted(ranking)
        .limit(TOP_N)
        .map(RolledAsset::toSummary)
        .toList();
  }

  /**
   * Shadow AI assets have no compliance records yet (so {@code affectedUsers} is 0 for all
   * of them); rank by EU-risk severity first, then most-recently-detected, so the headline
   * detections surface rather than an arbitrary alphabetical slice.
   */
  static Comparator<RolledAsset> shadowRanking() {
    return Comparator.comparingInt((RolledAsset asset) -> severityRank(asset.euRisk()))
        .thenComparingLong(asset -> recencyKey(asset.detectedAt()))
        .thenComparingInt(asset -> -asset.affectedUsers())
        .thenComparing(DashboardRollup::safeName);
  }

  /**
   * Pending approvals rank by EU-risk severity, then longest-waiting (oldest submission)
   * first, so the most urgent Risk Council items are surfaced instead of an alphabetical
   * slice.
   */
  static Comparator<RolledAsset> approvalRanking() {
    return Comparator.comparingInt((RolledAsset asset) -> severityRank(asset.euRisk()))
        .thenComparingLong(asset -> waitingKey(asset.registeredAt()))
        .thenComparingInt(asset -> -asset.affectedUsers())
        .thenComparing(DashboardRollup::safeName);
  }

  private static int severityRank(String euRisk) {
    int index = indexOf(RISK_SEVERITY, euRisk);
    return index >= 0 ? index : RISK_SEVERITY.length;
  }

  /** Sort key that surfaces the most recently detected asset first (nulls last). */
  private static long recencyKey(Long timestamp) {
    return timestamp == null ? Long.MAX_VALUE : -timestamp;
  }

  /** Sort key that surfaces the longest-waiting submission first (nulls last). */
  private static long waitingKey(Long timestamp) {
    return timestamp == null ? Long.MAX_VALUE : timestamp;
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
    private final List<FrameworkStatusSnapshot> frameworkStatuses;
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

    Long detectedAt() {
      return detectedAt;
    }

    Long registeredAt() {
      return registeredAt;
    }

    List<FrameworkStatusSnapshot> frameworkStatuses() {
      return frameworkStatuses;
    }

    AIGovernanceAssetSummary toSummary() {
      return new AIGovernanceAssetSummary()
          .withEntityType(entityType)
          .withId(id)
          .withName(name)
          .withDisplayName(displayName)
          .withFullyQualifiedName(fqn)
          .withRegistrationStatus(registrationStatus)
          .withEuRisk(euRisk)
          .withAffectedUsers(affectedUsers)
          .withRegisteredAt(registeredAt)
          .withDetectedVia(detectedVia)
          .withDetectedAt(detectedAt)
          .withSubmittedBy(submittedBy)
          .withSubmittedAt(registeredAt)
          .withTeam(team);
    }

    AIGovernanceTopEntity toTopEntity() {
      return new AIGovernanceTopEntity()
          .withName(name)
          .withDisplayName(displayName)
          .withFullyQualifiedName(fqn)
          .withEntityType(entityType);
    }

    static RolledAsset from(String entityType, EntityInterface entity) {
      GovernanceSnapshot governance = governance(entity);
      List<FrameworkStatusSnapshot> frameworks = new ArrayList<>();
      String euRisk = extractCompliance(governance.aiCompliance(), frameworks);
      int users = affectedUsers(governance.aiCompliance());
      AIDetection detection = governance.detection();

      return RolledAsset.builder()
          .entityType(entityType)
          .id(entity.getId() == null ? null : entity.getId().toString())
          .name(entity.getName())
          .displayName(entity.getDisplayName())
          .fqn(entity.getFullyQualifiedName())
          .registrationStatus(registrationStatus(governance.registrationStatus()))
          .euRisk(euRisk)
          .affectedUsers(users)
          .frameworkStatuses(frameworks)
          .registeredAt(governance.registeredAt())
          .detectedVia(detection == null ? null : enumValue(detection.getSource()))
          .detectedAt(detection == null ? null : detection.getDetectedAt())
          .submittedBy(governance.registeredBy())
          .team(firstDomainName(entity.getDomains()))
          .build();
    }

    private static String extractCompliance(
        AICompliance aiCompliance, List<FrameworkStatusSnapshot> frameworks) {
      String euRisk = null;
      if (aiCompliance != null && aiCompliance.getComplianceRecords() != null) {
        for (AIComplianceRecord record : aiCompliance.getComplianceRecords()) {
          String framework = enumValue(record.getFramework());
          String status = enumValue(record.getStatus());
          if (framework != null && status != null) {
            addFrameworkStatus(frameworks, framework, status);
          }
          if (euRisk == null
              && record.getEuAIAct() != null
              && record.getEuAIAct().getRiskClassification() != null) {
            euRisk = record.getEuAIAct().getRiskClassification().value();
          }
        }
      }
      return euRisk;
    }

    private static void addFrameworkStatus(
        List<FrameworkStatusSnapshot> frameworks, String framework, String status) {
      for (FrameworkStatusSnapshot existing : frameworks) {
        if (existing.framework().equals(framework)) {
          return;
        }
      }
      frameworks.add(new FrameworkStatusSnapshot(framework, status));
    }

    private static int affectedUsers(AICompliance aiCompliance) {
      int users = 0;
      if (aiCompliance != null && aiCompliance.getComplianceRecords() != null) {
        for (AIComplianceRecord record : aiCompliance.getComplianceRecords()) {
          if (record.getScopeAndDeployment() != null
              && record.getScopeAndDeployment().getAffectedUserCount() != null) {
            users = Math.max(users, record.getScopeAndDeployment().getAffectedUserCount());
          }
        }
      }
      return users;
    }

    private static String registrationStatus(String status) {
      return status == null ? "Registered" : status;
    }

    private static String mapLlmStatus(LLMModel.GovernanceStatus status) {
      String result;
      if (status == null) {
        result = null;
      } else {
        switch (status) {
          case APPROVED:
            result = "Approved";
            break;
          case PENDING_REVIEW:
            result = "PendingApproval";
            break;
          case REJECTED:
            result = "Rejected";
            break;
          case UNAUTHORIZED:
            result = "Unregistered";
            break;
          default:
            result = "Registered";
        }
      }
      return result;
    }

    private static GovernanceSnapshot governance(EntityInterface entity) {
      GovernanceSnapshot result = GovernanceSnapshot.EMPTY;
      if (entity instanceof AIApplication app) {
        result = governance(app.getGovernanceMetadata());
      } else if (entity instanceof McpServer server) {
        result = governance(server.getGovernanceMetadata());
      } else if (entity instanceof LLMModel llm) {
        result =
            new GovernanceSnapshot(
                mapLlmStatus(llm.getGovernanceStatus()), null, null, llm.getDetection(), null);
      }
      return result;
    }

    private static GovernanceSnapshot governance(GovernanceMetadata governance) {
      return governance == null
          ? GovernanceSnapshot.EMPTY
          : new GovernanceSnapshot(
              enumValue(governance.getRegistrationStatus()),
              governance.getRegisteredBy(),
              governance.getRegisteredAt(),
              governance.getDetection(),
              governance.getAiCompliance());
    }

    private static GovernanceSnapshot governance(McpGovernanceMetadata governance) {
      return governance == null
          ? GovernanceSnapshot.EMPTY
          : new GovernanceSnapshot(
              enumValue(governance.getRegistrationStatus()),
              governance.getRegisteredBy(),
              governance.getRegisteredAt(),
              governance.getDetection(),
              governance.getAiCompliance());
    }
  }

  private static String enumValue(Object value) {
    return value == null ? null : value.toString();
  }

  private record FrameworkReadinessCounts(int compliant, int inScope) {
    private FrameworkReadinessCounts plus(FrameworkReadinessCounts other) {
      return new FrameworkReadinessCounts(compliant + other.compliant(), inScope + other.inScope());
    }

    private double readiness() {
      return inScope == 0 ? 0.0 : (double) compliant / inScope;
    }
  }

  private record FrameworkStatusSnapshot(String framework, String status) {}

  private record GovernanceSnapshot(
      String registrationStatus,
      String registeredBy,
      Long registeredAt,
      AIDetection detection,
      AICompliance aiCompliance) {
    private static final GovernanceSnapshot EMPTY =
        new GovernanceSnapshot("Registered", null, null, null, null);
  }

  private static String firstDomainName(List<EntityReference> domains) {
    String result = null;
    if (!nullOrEmpty(domains)) {
      EntityReference first = domains.getFirst();
      result = first.getDisplayName() != null ? first.getDisplayName() : first.getName();
    }
    return result;
  }
}
