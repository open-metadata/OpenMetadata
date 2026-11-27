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

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.apps.bundles.insights.workflows.DataInsightsWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.WorkflowStats;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;

class DataInsightsAppTest {
  private static final List<String> HEALTHY_ENRICHER_STEPS =
      List.of(
          "identity",
          "testCaseParent",
          "entityStatus",
          "descriptionSources",
          "tagTierSources",
          "ownerName",
          "tier",
          "descriptionStats",
          "customProperties");

  @Test
  void jobStatsExcludeEnricherDiagnosticStepsWhileRetainingThemInEntityStats() {
    final DataInsightsApp app = newAppWithJobStats();
    app.updateStats("[DataAssetsWorkflow] table", stepStats(100, 100, 0));
    app.updateStats("[DataAssetsWorkflow] dashboard", stepStats(25, 24, 1));
    recordTenEnricherSteps(app);

    final Map<String, StepStats> entityStats =
        app.jobData.getStats().getEntityStats().getAdditionalProperties();
    assertEquals(12, entityStats.size());
    assertStepStats(entityStats.get("[Enricher] team"), 125, 120, 5);
    assertStepStats(app.jobData.getStats().getJobStats(), 125, 124, 1);
  }

  @Test
  void jobStatsHandleNullCountersAndAllEnricherMapsSafely() {
    final DataInsightsApp app = new DataInsightsApp(null, null);
    app.jobData = new EventPublisherJob().withEntities(null).withStats(new Stats());

    app.updateStats("[Enricher] team", stepStats(50, 48, 2));
    assertStepStats(app.jobData.getStats().getJobStats(), 0, 0, 0);

    app.updateStats("[DataAssetsWorkflow] table", nullCounterStepStats());
    app.updateStats("[DataAssetsWorkflow] topic", null);
    assertStepStats(app.jobData.getStats().getJobStats(), 0, 0, 0);
    assertEquals(3, app.jobData.getStats().getEntityStats().getAdditionalProperties().size());
  }

  @Test
  void jobStatsIncludeSiblingWorkflowsWhileSkippingEnricherDiagnostics() {
    final DataInsightsApp app = newAppWithJobStats();
    app.updateStats("[WebAnalyticsWorkflow] Entity View Report Data Sink", stepStats(40, 40, 0));
    app.updateStats("[CostAnalysisWorkflow] snowflake_prod", stepStats(10, 9, 1));
    app.updateStats("[DataAssetsWorkflow] table", stepStats(100, 100, 0));
    app.updateStats("[Enricher] identity", stepStats(100, 100, 0));

    assertEquals(4, app.jobData.getStats().getEntityStats().getAdditionalProperties().size());
    assertStepStats(app.jobData.getStats().getJobStats(), 150, 149, 1);
  }

  @Test
  void jobStatsSumAccumulatedStepsWithoutCountingProgressSnapshotsTwice() {
    DataInsightsApp app = new DataInsightsApp(null, null);
    app.jobData = new EventPublisherJob().withStats(new Stats().withJobStats(new StepStats()));
    WorkflowStats workflowStats = new WorkflowStats("test");
    String stepName = "processor";
    workflowStats.accumulateWorkflowStepStats(
        stepName, new StepStats().withTotalRecords(50).withSuccessRecords(45).withFailedRecords(5));
    app.updateStats(stepName, workflowStats.getWorkflowStepStats().get(stepName));
    workflowStats.accumulateWorkflowStepStats(
        stepName, new StepStats().withTotalRecords(70).withSuccessRecords(70));
    app.updateStats(stepName, workflowStats.getWorkflowStepStats().get(stepName));
    app.updateStats("sink", workflowStats.getWorkflowStepStats().get(stepName));

    StepStats jobStats = app.jobData.getStats().getJobStats();
    assertEquals(2, app.jobData.getStats().getEntityStats().getAdditionalProperties().size());
    assertEquals(240, jobStats.getTotalRecords());
    assertEquals(230, jobStats.getSuccessRecords());
    assertEquals(10, jobStats.getFailedRecords());
  }

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

  private static DataInsightsApp newAppWithJobStats() {
    final DataInsightsApp app = new DataInsightsApp(null, null);
    app.jobData = new EventPublisherJob().withStats(new Stats().withJobStats(new StepStats()));
    return app;
  }

  private static void recordTenEnricherSteps(final DataInsightsApp app) {
    for (final String step : HEALTHY_ENRICHER_STEPS) {
      app.updateStats("[Enricher] " + step, stepStats(125, 125, 0));
    }
    app.updateStats("[Enricher] team", stepStats(125, 120, 5));
  }

  private static StepStats stepStats(final int total, final int success, final int failed) {
    return new StepStats()
        .withTotalRecords(total)
        .withSuccessRecords(success)
        .withFailedRecords(failed);
  }

  private static StepStats nullCounterStepStats() {
    return new StepStats().withTotalRecords(null).withSuccessRecords(null).withFailedRecords(null);
  }

  private static void assertStepStats(
      final StepStats actual, final int total, final int success, final int failed) {
    assertEquals(total, actual.getTotalRecords());
    assertEquals(success, actual.getSuccessRecords());
    assertEquals(failed, actual.getFailedRecords());
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
