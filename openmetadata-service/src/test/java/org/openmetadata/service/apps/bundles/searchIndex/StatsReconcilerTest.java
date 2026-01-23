package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;

class StatsReconcilerTest {

  @Nested
  @DisplayName("reconcile() Tests")
  class ReconcileTests {

    @Test
    @DisplayName("Should handle null stats gracefully")
    void testReconcileNullStats() {
      Stats result = StatsReconciler.reconcile(null);
      assertNull(result);
    }

    @Test
    @DisplayName("Should handle stats with missing components")
    void testReconcileStatsWithMissingComponents() {
      Stats stats = new Stats();
      Stats result = StatsReconciler.reconcile(stats);
      assertNotNull(result);
    }

    @Test
    @DisplayName("Should correctly reconcile stats from reader and sink")
    void testReconcileStatsFromReaderAndSink() {
      Stats stats = createStats(100, 80, 20, 80, 60, 20);

      Stats result = StatsReconciler.reconcile(stats);

      assertEquals(60, result.getJobStats().getSuccessRecords());
      assertEquals(40, result.getJobStats().getFailedRecords());
      assertEquals(100, result.getJobStats().getTotalRecords());
    }

    @Test
    @DisplayName("Should handle zero values correctly")
    void testReconcileZeroValues() {
      Stats stats = createStats(0, 0, 0, 0, 0, 0);

      Stats result = StatsReconciler.reconcile(stats);

      assertEquals(0, result.getJobStats().getSuccessRecords());
      assertEquals(0, result.getJobStats().getFailedRecords());
      assertEquals(0, result.getJobStats().getTotalRecords());
    }

    @Test
    @DisplayName("Should handle 100% success scenario")
    void testReconcileAllSuccess() {
      Stats stats = createStats(100, 100, 0, 100, 100, 0);

      Stats result = StatsReconciler.reconcile(stats);

      assertEquals(100, result.getJobStats().getSuccessRecords());
      assertEquals(0, result.getJobStats().getFailedRecords());
      assertEquals(100, result.getJobStats().getTotalRecords());
    }

    @Test
    @DisplayName("Should handle 100% reader failure scenario")
    void testReconcileAllReaderFailure() {
      Stats stats = createStats(100, 0, 100, 0, 0, 0);

      Stats result = StatsReconciler.reconcile(stats);

      assertEquals(0, result.getJobStats().getSuccessRecords());
      assertEquals(100, result.getJobStats().getFailedRecords());
      assertEquals(100, result.getJobStats().getTotalRecords());
    }

    @Test
    @DisplayName("Should handle all sink failure scenario")
    void testReconcileAllSinkFailure() {
      Stats stats = createStats(100, 100, 0, 100, 0, 100);

      Stats result = StatsReconciler.reconcile(stats);

      assertEquals(0, result.getJobStats().getSuccessRecords());
      assertEquals(100, result.getJobStats().getFailedRecords());
      assertEquals(100, result.getJobStats().getTotalRecords());
    }

    @Test
    @DisplayName("Should handle stats with null reader stats")
    void testReconcileNullReaderStats() {
      Stats stats =
          new Stats()
              .withSinkStats(
                  new StepStats().withTotalRecords(80).withSuccessRecords(60).withFailedRecords(20))
              .withJobStats(
                  new StepStats().withTotalRecords(0).withSuccessRecords(0).withFailedRecords(0));

      Stats result = StatsReconciler.reconcile(stats);

      assertNotNull(result);
      assertEquals(0, result.getJobStats().getTotalRecords());
    }

    @Test
    @DisplayName("Should handle stats with null sink stats")
    void testReconcileNullSinkStats() {
      Stats stats =
          new Stats()
              .withReaderStats(
                  new StepStats()
                      .withTotalRecords(100)
                      .withSuccessRecords(80)
                      .withFailedRecords(20))
              .withJobStats(
                  new StepStats().withTotalRecords(0).withSuccessRecords(0).withFailedRecords(0));

      Stats result = StatsReconciler.reconcile(stats);

      assertNotNull(result);
      assertEquals(0, result.getJobStats().getTotalRecords());
    }
  }

  @Nested
  @DisplayName("reconcileToJobStats() Tests")
  class ReconcileToJobStatsTests {

    @Test
    @DisplayName("Should create job stats from reader and sink stats")
    void testReconcileToJobStats() {
      StepStats readerStats =
          new StepStats().withTotalRecords(100).withSuccessRecords(80).withFailedRecords(20);
      StepStats sinkStats =
          new StepStats().withTotalRecords(80).withSuccessRecords(60).withFailedRecords(20);

      StepStats result = StatsReconciler.reconcileToJobStats(readerStats, sinkStats);

      assertEquals(100, result.getTotalRecords());
      assertEquals(60, result.getSuccessRecords());
      assertEquals(40, result.getFailedRecords());
    }

    @Test
    @DisplayName("Should handle null reader stats")
    void testReconcileToJobStatsNullReader() {
      StepStats sinkStats =
          new StepStats().withTotalRecords(80).withSuccessRecords(60).withFailedRecords(20);

      StepStats result = StatsReconciler.reconcileToJobStats(null, sinkStats);

      assertEquals(0, result.getTotalRecords());
      assertEquals(60, result.getSuccessRecords());
      assertEquals(20, result.getFailedRecords());
    }

    @Test
    @DisplayName("Should handle null sink stats")
    void testReconcileToJobStatsNullSink() {
      StepStats readerStats =
          new StepStats().withTotalRecords(100).withSuccessRecords(80).withFailedRecords(20);

      StepStats result = StatsReconciler.reconcileToJobStats(readerStats, null);

      assertEquals(100, result.getTotalRecords());
      assertEquals(0, result.getSuccessRecords());
      assertEquals(20, result.getFailedRecords());
    }

    @Test
    @DisplayName("Should handle both null stats")
    void testReconcileToJobStatsBothNull() {
      StepStats result = StatsReconciler.reconcileToJobStats(null, null);

      assertEquals(0, result.getTotalRecords());
      assertEquals(0, result.getSuccessRecords());
      assertEquals(0, result.getFailedRecords());
    }

    @Test
    @DisplayName("Should handle stats with null values inside StepStats")
    void testReconcileToJobStatsWithNullValues() {
      StepStats readerStats = new StepStats();
      StepStats sinkStats = new StepStats().withSuccessRecords(50);

      StepStats result = StatsReconciler.reconcileToJobStats(readerStats, sinkStats);

      assertEquals(0, result.getTotalRecords());
      assertEquals(50, result.getSuccessRecords());
      assertEquals(0, result.getFailedRecords());
    }
  }

  @Nested
  @DisplayName("validateInvariants() Tests")
  class ValidateInvariantsTests {

    @Test
    @DisplayName("Should validate balanced stats")
    void testValidateBalancedStats() {
      Stats stats =
          new Stats()
              .withJobStats(
                  new StepStats()
                      .withTotalRecords(100)
                      .withSuccessRecords(60)
                      .withFailedRecords(40));

      assertTrue(StatsReconciler.validateInvariants(stats));
    }

    @Test
    @DisplayName("Should fail validation for unbalanced stats")
    void testValidateUnbalancedStats() {
      Stats stats =
          new Stats()
              .withJobStats(
                  new StepStats()
                      .withTotalRecords(100)
                      .withSuccessRecords(60)
                      .withFailedRecords(20));

      assertFalse(StatsReconciler.validateInvariants(stats));
    }

    @Test
    @DisplayName("Should validate null stats")
    void testValidateNullStats() {
      assertTrue(StatsReconciler.validateInvariants(null));
    }

    @Test
    @DisplayName("Should validate stats with null job stats")
    void testValidateNullJobStats() {
      Stats stats = new Stats();
      assertTrue(StatsReconciler.validateInvariants(stats));
    }

    @Test
    @DisplayName("Should fail when success exceeds total")
    void testValidateSuccessExceedsTotal() {
      Stats stats =
          new Stats()
              .withJobStats(
                  new StepStats()
                      .withTotalRecords(50)
                      .withSuccessRecords(100)
                      .withFailedRecords(-50));

      assertFalse(StatsReconciler.validateInvariants(stats));
    }

    @Test
    @DisplayName("Should fail when failed exceeds total")
    void testValidateFailedExceedsTotal() {
      Stats stats =
          new Stats()
              .withJobStats(
                  new StepStats()
                      .withTotalRecords(50)
                      .withSuccessRecords(-50)
                      .withFailedRecords(100));

      assertFalse(StatsReconciler.validateInvariants(stats));
    }

    @Test
    @DisplayName("Should validate zero total with zero success and failed")
    void testValidateZeroTotal() {
      Stats stats =
          new Stats()
              .withJobStats(
                  new StepStats().withTotalRecords(0).withSuccessRecords(0).withFailedRecords(0));

      assertTrue(StatsReconciler.validateInvariants(stats));
    }

    @Test
    @DisplayName("Should handle stats with null values in job stats")
    void testValidateNullValuesInJobStats() {
      Stats stats = new Stats().withJobStats(new StepStats());

      assertTrue(StatsReconciler.validateInvariants(stats));
    }
  }

  @Nested
  @DisplayName("fixInvariants() Tests")
  class FixInvariantsTests {

    @Test
    @DisplayName("Should fix unbalanced stats by adjusting total")
    void testFixUnbalancedStats() {
      Stats stats =
          new Stats()
              .withJobStats(
                  new StepStats()
                      .withTotalRecords(100)
                      .withSuccessRecords(60)
                      .withFailedRecords(20));

      Stats result = StatsReconciler.fixInvariants(stats);

      assertEquals(80, result.getJobStats().getTotalRecords());
      assertEquals(60, result.getJobStats().getSuccessRecords());
      assertEquals(20, result.getJobStats().getFailedRecords());
    }

    @Test
    @DisplayName("Should not modify already balanced stats")
    void testFixAlreadyBalancedStats() {
      Stats stats =
          new Stats()
              .withJobStats(
                  new StepStats()
                      .withTotalRecords(100)
                      .withSuccessRecords(60)
                      .withFailedRecords(40));

      Stats result = StatsReconciler.fixInvariants(stats);

      assertEquals(100, result.getJobStats().getTotalRecords());
    }

    @Test
    @DisplayName("Should handle null stats")
    void testFixNullStats() {
      Stats result = StatsReconciler.fixInvariants(null);
      assertNull(result);
    }

    @Test
    @DisplayName("Should handle stats with null job stats")
    void testFixNullJobStats() {
      Stats stats = new Stats();
      Stats result = StatsReconciler.fixInvariants(stats);
      assertNotNull(result);
      assertNull(result.getJobStats());
    }

    @Test
    @DisplayName("Should fix stats when total is less than sum")
    void testFixWhenTotalLessThanSum() {
      Stats stats =
          new Stats()
              .withJobStats(
                  new StepStats()
                      .withTotalRecords(50)
                      .withSuccessRecords(60)
                      .withFailedRecords(40));

      Stats result = StatsReconciler.fixInvariants(stats);

      assertEquals(100, result.getJobStats().getTotalRecords());
      assertEquals(60, result.getJobStats().getSuccessRecords());
      assertEquals(40, result.getJobStats().getFailedRecords());
    }

    @Test
    @DisplayName("Should fix stats with null values in job stats")
    void testFixNullValuesInJobStats() {
      Stats stats = new Stats().withJobStats(new StepStats().withSuccessRecords(50));

      Stats result = StatsReconciler.fixInvariants(stats);

      assertEquals(50, result.getJobStats().getTotalRecords());
      assertEquals(50, result.getJobStats().getSuccessRecords());
    }
  }

  private Stats createStats(
      int readerTotal,
      int readerSuccess,
      int readerFailed,
      int sinkTotal,
      int sinkSuccess,
      int sinkFailed) {
    return new Stats()
        .withReaderStats(
            new StepStats()
                .withTotalRecords(readerTotal)
                .withSuccessRecords(readerSuccess)
                .withFailedRecords(readerFailed))
        .withSinkStats(
            new StepStats()
                .withTotalRecords(sinkTotal)
                .withSuccessRecords(sinkSuccess)
                .withFailedRecords(sinkFailed))
        .withJobStats(
            new StepStats().withTotalRecords(0).withSuccessRecords(0).withFailedRecords(0));
  }
}
