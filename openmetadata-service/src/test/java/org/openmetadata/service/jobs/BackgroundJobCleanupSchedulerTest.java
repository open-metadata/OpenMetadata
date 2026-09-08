/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.jobs;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.csv.CsvAsyncJobManager;

class BackgroundJobCleanupSchedulerTest {
  private static final long NOW = 2_000_000L;

  @Test
  void reapsWorkerJobsOutsideTheHeartbeatWindow() {
    final JobDAO jobDao = mock(JobDAO.class);
    final CsvAsyncJobManager csvJobManager = mock(CsvAsyncJobManager.class);
    final BackgroundJobCleanupScheduler scheduler =
        new BackgroundJobCleanupScheduler(jobDao, csvJobManager);

    scheduler.runCleanupOnce(NOW);

    verify(jobDao)
        .markStaleRunningJobsFailed(
            NOW, NOW - GenericBackgroundWorker.RUNNING_JOB_STALE_AFTER.toMillis());
    verify(csvJobManager).runCleanupOnce();
  }

  @Test
  void cleanupFailuresRemainBestEffort() {
    final JobDAO jobDao = mock(JobDAO.class);
    final BackgroundJobCleanupScheduler scheduler =
        new BackgroundJobCleanupScheduler(jobDao, mock(CsvAsyncJobManager.class));
    when(jobDao.markStaleRunningJobsFailed(anyLong(), anyLong()))
        .thenThrow(new IllegalStateException("Database unavailable"));

    assertDoesNotThrow(() -> scheduler.runCleanupSafely());
  }
}
