package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Defines priority tiers for entity types during reindexing. Higher-priority entities are processed
 * first so that foundational data (services, users) is available in the search index before
 * dependent data (tables, dashboards) is indexed.
 */
public final class EntityPriority {

  enum Tier {
    CRITICAL(0, 100),
    HIGH(1, 80),
    MEDIUM(2, 60),
    LOW(3, 40),
    LOWEST(4, 20);

    private final int order;
    private final int numericPriority;

    Tier(int order, int numericPriority) {
      this.order = order;
      this.numericPriority = numericPriority;
    }

    int order() {
      return order;
    }

    int numericPriority() {
      return numericPriority;
    }
  }

  private static final Map<String, Tier> ENTITY_TIERS = new LinkedHashMap<>();

  static {
    // P0 CRITICAL: Service entities — hierarchy parents, must exist first
    for (String s :
        List.of(
            "databaseService",
            "messagingService",
            "dashboardService",
            "pipelineService",
            "mlmodelService",
            "storageService",
            "searchService",
            "apiService",
            "metadataService")) {
      ENTITY_TIERS.put(s, Tier.CRITICAL);
    }

    // P1 HIGH: Identity/org entities — referenced by everything
    for (String s : List.of("user", "team", "role", "bot", "persona")) {
      ENTITY_TIERS.put(s, Tier.HIGH);
    }

    // P2 MEDIUM: Core data assets
    for (String s :
        List.of(
            "table",
            "database",
            "databaseSchema",
            "dashboard",
            "chart",
            "pipeline",
            "topic",
            "mlmodel",
            "container",
            "storedProcedure",
            "query",
            "dashboardDataModel",
            "api",
            "apiEndpoint",
            "apiCollection")) {
      ENTITY_TIERS.put(s, Tier.MEDIUM);
    }

    // P4 LOWEST: Time series entities
    for (String s :
        List.of(
            "entityReportData",
            "rawCostAnalysisReportData",
            "webAnalyticUserActivityReportData",
            "webAnalyticEntityViewReportData",
            "aggregatedCostAnalysisReportData",
            "testCaseResolutionStatus",
            "testCaseResult",
            "queryCostRecord")) {
      ENTITY_TIERS.put(s, Tier.LOWEST);
    }

    // P3 LOW: Everything else not explicitly listed defaults to LOW via getTier()
  }

  private EntityPriority() {}

  static Tier getTier(String entityType) {
    return ENTITY_TIERS.getOrDefault(entityType, Tier.LOW);
  }

  /**
   * Returns a numeric priority score for the given entity type. Higher values mean higher priority.
   * Used by the distributed indexing path to store priority on partitions for SQL-level ordering.
   */
  public static int getNumericPriority(String entityType) {
    return getTier(entityType).numericPriority();
  }

  /**
   * Returns entity types sorted by priority tier. Entities within the same tier preserve their
   * original iteration order from the input set.
   */
  public static List<String> sortByPriority(Set<String> entities) {
    List<String> list = new ArrayList<>(entities);
    list.sort(Comparator.comparingInt(e -> getTier(e).order()));
    return list;
  }
}
