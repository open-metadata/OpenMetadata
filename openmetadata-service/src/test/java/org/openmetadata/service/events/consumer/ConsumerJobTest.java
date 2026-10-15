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

package org.openmetadata.service.events.consumer;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.events.consumer.schedule.AlertJobs;
import org.openmetadata.service.util.DIContainer;
import org.openmetadata.service.util.PerRequestContextCleaner;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobKey;

class ConsumerJobTest {

  // Quartz threads are shared and never pass the request filter that clears per-request caches.
  @Test
  void aTickStartsAndEndsWithClearedCaches() throws Exception {
    UUID alertId = UUID.randomUUID();
    JobDetail job = mock(JobDetail.class);
    when(job.getKey()).thenReturn(new JobKey(alertId.toString(), AlertJobs.JOB_GROUP));
    JobExecutionContext context = mock(JobExecutionContext.class);
    when(context.getJobDetail()).thenReturn(job);

    try (MockedStatic<PerRequestContextCleaner> cleaner =
            mockStatic(PerRequestContextCleaner.class);
        MockedStatic<AlertRows> rows = mockStatic(AlertRows.class)) {
      rows.when(() -> AlertRows.readOrNull(alertId)).thenReturn(null);
      new ConsumerJob(mock(DIContainer.class)).execute(context);

      cleaner.verify(PerRequestContextCleaner::clear, times(2));
    }
  }
}
