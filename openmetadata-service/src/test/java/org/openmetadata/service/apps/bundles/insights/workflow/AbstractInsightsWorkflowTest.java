package org.openmetadata.service.apps.bundles.insights.workflow;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.service.apps.bundles.insights.stats.WorkflowResult;
import org.openmetadata.service.exception.SearchIndexException;

class AbstractInsightsWorkflowTest {

  private static AbstractInsightsWorkflow workflow(
      boolean enabled, Runnable runBody, Runnable cleanupBody) {
    return new AbstractInsightsWorkflow("test-workflow") {
      @Override
      protected boolean isEnabled() {
        return enabled;
      }

      @Override
      protected void initialize() {}

      @Override
      protected void run() throws Exception {
        runBody.run();
      }

      @Override
      protected void cleanup() {
        cleanupBody.run();
      }
    };
  }

  @Test
  void successfulRunReturnsFailed_False() {
    WorkflowResult result = workflow(true, () -> {}, () -> {}).execute();
    assertFalse(result.failed());
    assertTrue(result.failures().isEmpty());
  }

  @Test
  void disabledWorkflowSkipsRunAndReturnsFailed_False() throws Exception {
    Runnable run = mock(Runnable.class);
    WorkflowResult result = workflow(false, run, () -> {}).execute();
    assertFalse(result.failed());
    verify(run, never()).run();
  }

  @Test
  void searchIndexExceptionPreservesIndexingError() {
    IndexingError error =
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.SINK)
            .withMessage("bulk write failed");
    AbstractInsightsWorkflow wf =
        new AbstractInsightsWorkflow("test") {
          @Override
          protected boolean isEnabled() {
            return true;
          }

          @Override
          protected void initialize() {}

          @Override
          protected void run() throws SearchIndexException {
            throw new SearchIndexException(error);
          }
        };
    WorkflowResult result = wf.execute();
    assertTrue(result.failed());
    assertEquals(1, result.failures().size());
    assertEquals(IndexingError.ErrorSource.SINK, result.failures().get(0).getErrorSource());
    assertEquals("bulk write failed", result.failures().get(0).getMessage());
  }

  @Test
  void genericExceptionWrappedAsJobError() {
    AbstractInsightsWorkflow wf =
        new AbstractInsightsWorkflow("test") {
          @Override
          protected boolean isEnabled() {
            return true;
          }

          @Override
          protected void initialize() {}

          @Override
          protected void run() {
            throw new RuntimeException("unexpected failure");
          }
        };
    WorkflowResult result = wf.execute();
    assertTrue(result.failed());
    assertEquals(IndexingError.ErrorSource.JOB, result.failures().get(0).getErrorSource());
  }

  @Test
  void executeNeverThrowsForAnyException() {
    AbstractInsightsWorkflow wf =
        new AbstractInsightsWorkflow("test") {
          @Override
          protected boolean isEnabled() {
            return true;
          }

          @Override
          protected void initialize() {}

          @Override
          protected void run() {
            throw new IllegalStateException("unexpected failure");
          }
        };
    assertDoesNotThrow(wf::execute);
    assertTrue(wf.execute().failed());
  }

  @Test
  void cleanupCalledEvenWhenRunThrows() {
    Runnable cleanup = mock(Runnable.class);
    workflow(
            true,
            () -> {
              throw new RuntimeException("fail");
            },
            cleanup)
        .execute();
    verify(cleanup, times(1)).run();
  }

  @Test
  void stopSetsFlagAndNameIsPreserved() {
    AbstractInsightsWorkflow wf =
        new AbstractInsightsWorkflow("my-workflow") {
          @Override
          protected boolean isEnabled() {
            return true;
          }

          @Override
          protected void initialize() {}

          @Override
          protected void run() {}
        };
    assertEquals("my-workflow", wf.name());
    assertFalse(wf.stopped);
    wf.stop();
    assertTrue(wf.stopped);
  }
}
