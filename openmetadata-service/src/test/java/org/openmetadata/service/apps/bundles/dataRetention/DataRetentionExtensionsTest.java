package org.openmetadata.service.apps.bundles.dataRetention;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.applications.configuration.internal.DataRetentionConfiguration;

class DataRetentionExtensionsTest {

  private static final String FIRST_STEP = "first_step";
  private static final String SECOND_STEP = "second_step";

  /** A provider that contributes nothing but a name, for ordering and isolation assertions. */
  private record StubExtension(
      String name, List<RetentionStep> contributed, RuntimeException blowUp)
      implements DataRetentionExtension {

    @Override
    public List<RetentionStep> steps(DataRetentionConfiguration configuration) {
      if (blowUp != null) {
        throw blowUp;
      }
      return contributed;
    }
  }

  private static RetentionStep noOpStep(String statsKey) {
    return new RetentionStep(statsKey, batchSize -> 0);
  }

  @Test
  void discoverFindsExtensionsRegisteredViaServiceLoader() {
    List<RetentionStep> steps = DataRetentionExtensions.discover().resolveSteps(null, ex -> {});

    assertTrue(
        steps.stream()
            .anyMatch(step -> step.statsKey().startsWith(InertTestRetentionExtension.NAME)),
        "ServiceLoader did not pick up the extension registered in META-INF/services");
  }

  @Test
  void resolveStepsKeepsExtensionAndStepOrder() {
    DataRetentionExtensions extensions =
        new DataRetentionExtensions(
            List.of(
                new StubExtension("first", List.of(noOpStep(FIRST_STEP)), null),
                new StubExtension("second", List.of(noOpStep(SECOND_STEP)), null)));

    List<RetentionStep> steps = extensions.resolveSteps(null, ex -> {});

    assertEquals(
        List.of(FIRST_STEP, SECOND_STEP), steps.stream().map(RetentionStep::statsKey).toList());
  }

  @Test
  void aThrowingExtensionIsReportedAndDoesNotStopTheOthers() {
    RuntimeException failure = new IllegalStateException("provider is broken");
    DataRetentionExtensions extensions =
        new DataRetentionExtensions(
            List.of(
                new StubExtension("broken", null, failure),
                new StubExtension("healthy", List.of(noOpStep(SECOND_STEP)), null)));
    List<RuntimeException> reported = new ArrayList<>();

    List<RetentionStep> steps = extensions.resolveSteps(null, reported::add);

    assertEquals(List.of(SECOND_STEP), steps.stream().map(RetentionStep::statsKey).toList());
    assertEquals(1, reported.size());
    assertSame(failure, reported.get(0));
  }

  @Test
  void anExtensionReturningNoStepsContributesNothing() {
    DataRetentionExtensions extensions =
        new DataRetentionExtensions(List.of(new StubExtension("silent", null, null)));

    List<RetentionStep> steps = extensions.resolveSteps(null, ex -> {});

    assertTrue(steps.isEmpty());
  }

  @Test
  void retentionPeriodFallsBackToTheExtensionDefaultWhenUnconfigured() {
    DataRetentionExtension extension = new InertTestRetentionExtension();

    assertEquals(30, extension.retentionPeriodDays(null, 30));
    assertEquals(30, extension.retentionPeriodDays(new DataRetentionConfiguration(), 30));
  }

  @Test
  void retentionPeriodReadsTheOperatorsValueForThisExtension() {
    DataRetentionExtension extension = new InertTestRetentionExtension();
    DataRetentionConfiguration configuration =
        new DataRetentionConfiguration()
            .withExtensions(Map.of(InertTestRetentionExtension.NAME, 3, "someOtherExtension", 90));

    assertEquals(3, extension.retentionPeriodDays(configuration, 30));
  }

  @Test
  void aStepDrainsUntilItReturnsLessThanABatch() {
    AtomicInteger remaining = new AtomicInteger(25);
    RetentionStep step =
        new RetentionStep(
            FIRST_STEP,
            batchSize -> {
              int deleted = Math.min(batchSize, remaining.get());
              remaining.addAndGet(-deleted);
              return deleted;
            });

    int batchSize = 10;
    int totalDeleted = 0;
    int deleted;
    do {
      deleted = step.deleter().deleteBatch(batchSize);
      totalDeleted += deleted;
    } while (deleted == batchSize);

    assertEquals(25, totalDeleted);
    assertEquals(0, remaining.get());
  }

  @Test
  void aStepWithoutAStatsKeyOrDeleterIsRejected() {
    assertThrows(IllegalArgumentException.class, () -> new RetentionStep("", batchSize -> 0));
    assertThrows(IllegalArgumentException.class, () -> new RetentionStep(null, batchSize -> 0));
    assertThrows(NullPointerException.class, () -> new RetentionStep(FIRST_STEP, null));
    assertNotNull(noOpStep(FIRST_STEP));
  }
}
