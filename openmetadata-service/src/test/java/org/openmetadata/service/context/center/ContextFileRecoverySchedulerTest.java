package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

class ContextFileRecoverySchedulerTest {
  /** An exception escaping a scheduleWithFixedDelay task would end the sweep for good. */
  @Test
  void aFailingSweepLeavesTheScheduleRunning() {
    ContextFileProcessingService service = mock(ContextFileProcessingService.class);
    when(service.resubmitStaleTextExtraction(anyLong()))
        .thenThrow(new IllegalStateException("database unavailable"));
    ContextFileRecoveryScheduler scheduler = new ContextFileRecoveryScheduler(() -> service);

    assertDoesNotThrow(scheduler::runSafely);

    verify(service).resubmitStaleTextExtraction(anyLong());
  }
}
