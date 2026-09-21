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
package org.openmetadata.service.apps.bundles.insights;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.service.apps.bundles.insights.workflows.DataInsightsWorkflow;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;

class DataInsightsAppTest {

  @Test
  void createsDatabaseSafeLockOwnerFromLongQuartzFireInstanceId() {
    String fireInstanceId = "server-with-a-long-identity-1786858582985-1234567890";

    String lockJobId = DataInsightsApp.createJobLockId(fireInstanceId);

    assertEquals(36, lockJobId.length());
    assertNotEquals(fireInstanceId, lockJobId);
    assertEquals(lockJobId, DataInsightsApp.createJobLockId(fireInstanceId));
  }

  @Test
  void recordsLockContendingRunAsStopped() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.SearchReindexLockDAO lockDAO = mock(CollectionDAO.SearchReindexLockDAO.class);
    when(collectionDAO.searchReindexLockDAO()).thenReturn(lockDAO);
    when(lockDAO.tryAcquireLock(anyString(), anyString(), anyString(), anyLong(), anyLong()))
        .thenReturn(false);

    JobExecutionContext context = mock(JobExecutionContext.class);
    JobDetail jobDetail = mock(JobDetail.class);
    JobDataMap jobDataMap = new JobDataMap();
    when(context.getFireInstanceId()).thenReturn("contending-run");
    when(context.getJobDetail()).thenReturn(jobDetail);
    when(jobDetail.getJobDataMap()).thenReturn(jobDataMap);

    TestableDataInsightsApp app =
        new TestableDataInsightsApp(collectionDAO, mock(SearchRepository.class));
    app.jobData = new EventPublisherJob().withStats(new Stats());
    app.appRunRecord = new AppRunRecord().withStatus(AppRunRecord.Status.RUNNING);

    app.startApp(context);

    assertEquals(EventPublisherJob.Status.STOPPED, app.jobData.getStatus());
    assertNotNull(app.pushedRecord);
    assertEquals(AppRunRecord.Status.STOPPED, app.pushedRecord.getStatus());
    assertSame(app.jobData.getStats(), jobDataMap.get(APP_RUN_STATS));
    verify(lockDAO, never()).releaseLock(anyString(), anyString());
  }

  @Test
  void stopCancelsActiveAndLateRegisteredWorkflows() {
    DataInsightsApp app =
        new DataInsightsApp(mock(CollectionDAO.class), mock(SearchRepository.class));
    DataInsightsWorkflow activeWorkflow = mock(DataInsightsWorkflow.class);
    DataInsightsWorkflow lateWorkflow = mock(DataInsightsWorkflow.class);

    app.activateWorkflow(activeWorkflow);
    app.stop();
    app.activateWorkflow(lateWorkflow);

    verify(activeWorkflow).stop();
    verify(lateWorkflow).stop();
  }

  private static class TestableDataInsightsApp extends DataInsightsApp {
    private AppRunRecord appRunRecord;
    private AppRunRecord pushedRecord;

    private TestableDataInsightsApp(
        CollectionDAO collectionDAO, SearchRepository searchRepository) {
      super(collectionDAO, searchRepository);
    }

    @Override
    protected AppRunRecord getJobRecord(JobExecutionContext jobExecutionContext) {
      return appRunRecord;
    }

    @Override
    protected void pushAppStatusUpdates(
        JobExecutionContext jobExecutionContext, AppRunRecord appRecord, boolean update) {
      pushedRecord = appRecord;
    }
  }
}
