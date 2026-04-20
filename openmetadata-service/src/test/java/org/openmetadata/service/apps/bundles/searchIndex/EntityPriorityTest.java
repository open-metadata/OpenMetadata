package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("EntityPriority Tests")
class EntityPriorityTest {

  @Test
  @DisplayName("Services sort before users/teams")
  void servicesSortBeforeUsers() {
    Set<String> entities = Set.of("user", "databaseService", "team");
    List<String> sorted = EntityPriority.sortByPriority(entities);
    assertTrue(sorted.indexOf("databaseService") < sorted.indexOf("user"));
    assertTrue(sorted.indexOf("databaseService") < sorted.indexOf("team"));
  }

  @Test
  @DisplayName("Users/teams sort before data assets")
  void usersSortBeforeDataAssets() {
    Set<String> entities = Set.of("table", "user", "dashboard");
    List<String> sorted = EntityPriority.sortByPriority(entities);
    assertTrue(sorted.indexOf("user") < sorted.indexOf("table"));
    assertTrue(sorted.indexOf("user") < sorted.indexOf("dashboard"));
  }

  @Test
  @DisplayName("Data assets sort before governance entities")
  void dataAssetsSortBeforeGovernance() {
    Set<String> entities = Set.of("glossaryTerm", "table", "testCase");
    List<String> sorted = EntityPriority.sortByPriority(entities);
    assertTrue(sorted.indexOf("table") < sorted.indexOf("glossaryTerm"));
    assertTrue(sorted.indexOf("table") < sorted.indexOf("testCase"));
  }

  @Test
  @DisplayName("Time series entities sort last")
  void timeSeriesEntitiesSortLast() {
    Set<String> entities = Set.of("testCaseResult", "user", "table", "databaseService");
    List<String> sorted = EntityPriority.sortByPriority(entities);
    assertEquals("testCaseResult", sorted.get(sorted.size() - 1));
  }

  @Test
  @DisplayName("Unknown entity types default to LOW tier")
  void unknownEntitiesDefaultToLow() {
    assertEquals(EntityPriority.Tier.LOW, EntityPriority.getTier("someUnknownEntity"));
  }

  @Test
  @DisplayName("Empty set returns empty list")
  void emptySetReturnsEmptyList() {
    List<String> sorted = EntityPriority.sortByPriority(Set.of());
    assertTrue(sorted.isEmpty());
  }

  @Test
  @DisplayName("Single entity returns single-element list")
  void singleEntityReturnsSingleElement() {
    List<String> sorted = EntityPriority.sortByPriority(Set.of("table"));
    assertEquals(1, sorted.size());
    assertEquals("table", sorted.get(0));
  }

  @Test
  @DisplayName("Full priority ordering: CRITICAL > HIGH > MEDIUM > LOW > LOWEST")
  void fullPriorityOrdering() {
    Set<String> entities =
        Set.of("testCaseResult", "glossaryTerm", "table", "user", "databaseService");
    List<String> sorted = EntityPriority.sortByPriority(entities);

    int serviceIdx = sorted.indexOf("databaseService");
    int userIdx = sorted.indexOf("user");
    int tableIdx = sorted.indexOf("table");
    int glossaryIdx = sorted.indexOf("glossaryTerm");
    int tsIdx = sorted.indexOf("testCaseResult");

    assertTrue(serviceIdx < userIdx, "CRITICAL < HIGH");
    assertTrue(userIdx < tableIdx, "HIGH < MEDIUM");
    assertTrue(tableIdx < glossaryIdx, "MEDIUM < LOW");
    assertTrue(glossaryIdx < tsIdx, "LOW < LOWEST");
  }

  @Test
  @DisplayName("Entities within same tier preserve relative order from input")
  void sameTierPreservesOrder() {
    LinkedHashSet<String> entities = new LinkedHashSet<>();
    entities.add("dashboard");
    entities.add("table");
    entities.add("pipeline");
    List<String> sorted = EntityPriority.sortByPriority(entities);
    assertEquals(List.of("dashboard", "table", "pipeline"), sorted);
  }

  @Test
  @DisplayName("All service entities are CRITICAL tier")
  void allServicesAreCritical() {
    for (String svc :
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
      assertEquals(EntityPriority.Tier.CRITICAL, EntityPriority.getTier(svc), svc);
    }
  }

  @Test
  @DisplayName("All time series entities are LOWEST tier")
  void allTimeSeriesAreLowest() {
    for (String ts :
        List.of(
            "entityReportData",
            "rawCostAnalysisReportData",
            "webAnalyticUserActivityReportData",
            "webAnalyticEntityViewReportData",
            "aggregatedCostAnalysisReportData",
            "testCaseResolutionStatus",
            "testCaseResult",
            "queryCostRecord")) {
      assertEquals(EntityPriority.Tier.LOWEST, EntityPriority.getTier(ts), ts);
    }
  }

  @Test
  @DisplayName("Numeric priority maps correctly from tiers")
  void numericPriorityMapsFromTiers() {
    assertEquals(100, EntityPriority.getNumericPriority("databaseService"));
    assertEquals(80, EntityPriority.getNumericPriority("user"));
    assertEquals(60, EntityPriority.getNumericPriority("table"));
    assertEquals(40, EntityPriority.getNumericPriority("glossaryTerm"));
    assertEquals(20, EntityPriority.getNumericPriority("testCaseResult"));
  }

  @Test
  @DisplayName("Unknown entities get LOW numeric priority")
  void unknownEntitiesGetLowNumericPriority() {
    assertEquals(40, EntityPriority.getNumericPriority("someUnknownEntity"));
  }
}
