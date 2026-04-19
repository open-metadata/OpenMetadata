package org.openmetadata.service.apps.bundles.insights.stats;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.IndexingError;

class WorkflowStatsCollectorTest {

  private WorkflowStatsCollector collector;

  @BeforeEach
  void setUp() {
    collector = new WorkflowStatsCollector("TestWorkflow");
  }

  @Test
  void emptyCollectorProducesNotFailed() {
    WorkflowResult result = collector.buildResult();
    assertFalse(result.failed());
    assertTrue(result.failures().isEmpty());
    assertTrue(result.stepStats().isEmpty());
    assertEquals("TestWorkflow", result.workflowName());
  }

  @Test
  void recordIndexingErrorMarksFailed() {
    collector.recordIndexingError(
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.SINK)
            .withMessage("bulk write failed"));
    WorkflowResult result = collector.buildResult();
    assertTrue(result.failed());
    assertEquals(1, result.failures().size());
    assertEquals(IndexingError.ErrorSource.SINK, result.failures().get(0).getErrorSource());
  }

  @Test
  void recordWorkflowErrorSetsJobSourceAndStackTrace() {
    collector.recordWorkflowError(new RuntimeException("oops"));
    WorkflowResult result = collector.buildResult();
    assertTrue(result.failed());
    assertEquals(IndexingError.ErrorSource.JOB, result.failures().get(0).getErrorSource());
    assertEquals("oops", result.failures().get(0).getMessage());
    assertNotNull(result.failures().get(0).getStackTrace());
  }

  @Test
  void recordStepAccumulatesStats() {
    collector.record(new StepResult("step-table", 100, 2, List.of("err1", "err2")));
    collector.record(new StepResult("step-table", 50, 1, List.of("err3")));
    WorkflowResult result = collector.buildResult();
    assertFalse(result.failed());
    assertEquals(1, result.stepStats().size());
    assertEquals(150, result.stepStats().get("step-table").getSuccessRecords());
    assertEquals(3, result.stepStats().get("step-table").getFailedRecords());
    assertEquals(153, result.stepStats().get("step-table").getTotalRecords());
  }

  @Test
  void recordDifferentStepsProducesSeparateEntries() {
    collector.record(new StepResult("step-table", 10, 0, List.of()));
    collector.record(new StepResult("step-dashboard", 5, 0, List.of()));
    WorkflowResult result = collector.buildResult();
    assertEquals(2, result.stepStats().size());
    assertTrue(result.stepStats().containsKey("step-table"));
    assertTrue(result.stepStats().containsKey("step-dashboard"));
  }

  @Test
  void buildResultIsImmutable() {
    WorkflowResult result = collector.buildResult();
    assertThrows(UnsupportedOperationException.class, () -> result.failures().add(new IndexingError()));
    assertThrows(UnsupportedOperationException.class, () -> result.stepStats().put("x", null));
  }
}
