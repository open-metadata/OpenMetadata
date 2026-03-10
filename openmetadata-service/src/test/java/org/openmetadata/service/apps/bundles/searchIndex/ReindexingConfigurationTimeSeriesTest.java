package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Collections;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.EventPublisherJob;

@DisplayName("ReindexingConfiguration Time Series Tests")
class ReindexingConfigurationTimeSeriesTest {

  @Test
  @DisplayName("getTimeSeriesStartTs returns correct timestamp for default days")
  void defaultDaysReturnsCorrectTimestamp() {
    ReindexingConfiguration config =
        ReindexingConfiguration.builder()
            .entities(Set.of("testCaseResult"))
            .timeSeriesMaxDays(15)
            .build();

    long startTs = config.getTimeSeriesStartTs("testCaseResult");
    long expectedApprox = System.currentTimeMillis() - (15 * 86_400_000L);
    assertTrue(
        Math.abs(startTs - expectedApprox) < 1000,
        "Start timestamp should be approximately 15 days ago");
  }

  @Test
  @DisplayName("getTimeSeriesStartTs uses entity-specific override when configured")
  void entitySpecificOverride() {
    ReindexingConfiguration config =
        ReindexingConfiguration.builder()
            .entities(Set.of("testCaseResult", "entityReportData"))
            .timeSeriesMaxDays(15)
            .timeSeriesEntityDays(Map.of("testCaseResult", 30))
            .build();

    long testCaseStartTs = config.getTimeSeriesStartTs("testCaseResult");
    long reportDataStartTs = config.getTimeSeriesStartTs("entityReportData");

    long expected30Days = System.currentTimeMillis() - (30 * 86_400_000L);
    long expected15Days = System.currentTimeMillis() - (15 * 86_400_000L);

    assertTrue(
        Math.abs(testCaseStartTs - expected30Days) < 1000,
        "testCaseResult should use 30-day override");
    assertTrue(
        Math.abs(reportDataStartTs - expected15Days) < 1000,
        "entityReportData should use default 15 days");
  }

  @Test
  @DisplayName("getTimeSeriesStartTs returns -1 when days is 0 (no filtering)")
  void zeroDaysReturnsNegativeOne() {
    ReindexingConfiguration config =
        ReindexingConfiguration.builder()
            .entities(Set.of("testCaseResult"))
            .timeSeriesMaxDays(0)
            .build();

    assertEquals(-1, config.getTimeSeriesStartTs("testCaseResult"));
  }

  @Test
  @DisplayName("getTimeSeriesStartTs returns -1 when days is -1 (no filtering)")
  void negativeDaysReturnsNegativeOne() {
    ReindexingConfiguration config =
        ReindexingConfiguration.builder()
            .entities(Set.of("testCaseResult"))
            .timeSeriesMaxDays(-1)
            .build();

    assertEquals(-1, config.getTimeSeriesStartTs("testCaseResult"));
  }

  @Test
  @DisplayName("getTimeSeriesStartTs returns -1 when entity override is 0")
  void entityOverrideZeroReturnsNegativeOne() {
    ReindexingConfiguration config =
        ReindexingConfiguration.builder()
            .entities(Set.of("testCaseResult"))
            .timeSeriesMaxDays(15)
            .timeSeriesEntityDays(Map.of("testCaseResult", 0))
            .build();

    assertEquals(-1, config.getTimeSeriesStartTs("testCaseResult"));
  }

  @Test
  @DisplayName("from(EventPublisherJob) correctly reads new fields")
  void fromJobReadsNewFields() {
    EventPublisherJob job = new EventPublisherJob();
    job.setTimeSeriesMaxDays(30);
    job.setTimeSeriesEntityDays(Map.of("testCaseResult", 60));
    job.setEntities(Set.of("table"));

    ReindexingConfiguration config = ReindexingConfiguration.from(job);

    assertEquals(30, config.timeSeriesMaxDays());
    assertEquals(Map.of("testCaseResult", 60), config.timeSeriesEntityDays());
  }

  @Test
  @DisplayName("from(EventPublisherJob) uses defaults when fields are null")
  void fromJobUsesDefaults() {
    EventPublisherJob job = new EventPublisherJob();
    job.setEntities(Set.of("table"));

    ReindexingConfiguration config = ReindexingConfiguration.from(job);

    assertEquals(0, config.timeSeriesMaxDays());
    assertEquals(Collections.emptyMap(), config.timeSeriesEntityDays());
  }

  @Test
  @DisplayName("Builder propagates new fields")
  void builderPropagatesFields() {
    Map<String, Integer> entityDays = Map.of("queryCostRecord", 7, "testCaseResult", 45);
    ReindexingConfiguration config =
        ReindexingConfiguration.builder()
            .entities(Set.of("table"))
            .timeSeriesMaxDays(20)
            .timeSeriesEntityDays(entityDays)
            .build();

    assertEquals(20, config.timeSeriesMaxDays());
    assertEquals(entityDays, config.timeSeriesEntityDays());

    long queryCostStartTs = config.getTimeSeriesStartTs("queryCostRecord");
    long expected7Days = System.currentTimeMillis() - (7 * 86_400_000L);
    assertTrue(Math.abs(queryCostStartTs - expected7Days) < 1000);
  }
}
