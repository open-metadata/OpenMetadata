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
import static org.junit.jupiter.api.Assertions.assertTrue;
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
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.apps.bundles.insights.workflows.DataInsightsWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.WorkflowStats;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;

class DataInsightsAppTest {

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

  // ────────────── job-level stats: exclude [Enricher] diagnostic keys ──────────────

  /**
   * The Data Assets workflow merges 10 per-step enricher diagnostic keys (each re-counting the
   * same entities) into the same {@code EntityStats.additionalProperties} map that
   * {@link DataInsightsApp#updateStats} sums for job-level totals. Without filtering, 100 enriched
   * entities would report {@code totalRecords=1100} (11x inflation). The fix excludes
   * {@code [Enricher] *} keys from the job-level sum.
   */
  @Test
  void jobStatsExcludeEnricherStepDiagnosticKeys() {
    DataInsightsApp app =
        new DataInsightsApp(mock(CollectionDAO.class), mock(SearchRepository.class));
    app.jobData = new EventPublisherJob().withStats(new Stats().withJobStats(new StepStats()));

    // Entity-type source key: 100 records processed successfully
    app.updateStats(
        "[DataAssetsWorkflow] table",
        new StepStats().withTotalRecords(100).withSuccessRecords(100).withFailedRecords(0));

    // 10 enricher step diagnostic keys: each re-counts the same 100 records
    for (String step :
        List.of(
            "identity",
            "entityStatus",
            "descriptionSources",
            "tagAndTierSources",
            "ownerTeam",
            "ownerName",
            "tier",
            "descriptionStats",
            "recursiveColumnStats",
            "customProperties")) {
      app.updateStats(
          DataAssetsWorkflow.ENRICHER_STEP_PREFIX + step,
          new StepStats().withTotalRecords(100).withSuccessRecords(100).withFailedRecords(0));
    }

    StepStats jobStats = app.jobData.getStats().getJobStats();
    // Should be 100 (entity-type only), not 1100 (entity + 10 enricher steps)
    assertEquals(100, jobStats.getTotalRecords());
    assertEquals(100, jobStats.getSuccessRecords());
    assertEquals(0, jobStats.getFailedRecords());
  }

  /**
   * Isolated enricher step failures (which still emit the entity) must not inflate job-level
   * {@code failedRecords}. Under the {@code EnrichmentPipeline} failure-isolation contract, a
   * throwing step increments its own failure counter while the entity is still emitted to the
   * index — these are diagnostic counters, not record losses.
   */
  @Test
  void jobStatsFailedRecordsExcludeIsolatedEnricherStepFailures() {
    DataInsightsApp app =
        new DataInsightsApp(mock(CollectionDAO.class), mock(SearchRepository.class));
    app.jobData = new EventPublisherJob().withStats(new Stats().withJobStats(new StepStats()));

    // Entity-type source: 100 records, all succeeded
    app.updateStats(
        "[DataAssetsWorkflow] table",
        new StepStats().withTotalRecords(100).withSuccessRecords(100).withFailedRecords(0));

    // Enricher steps: each has 5 isolated step failures (entity still emitted)
    for (String step : List.of("identity", "ownerTeam", "customProperties")) {
      app.updateStats(
          DataAssetsWorkflow.ENRICHER_STEP_PREFIX + step,
          new StepStats().withTotalRecords(100).withSuccessRecords(95).withFailedRecords(5));
    }

    StepStats jobStats = app.jobData.getStats().getJobStats();
    assertEquals(100, jobStats.getTotalRecords());
    assertEquals(100, jobStats.getSuccessRecords());
    // 15 isolated enricher step failures must not inflate job-level failedRecords
    assertEquals(0, jobStats.getFailedRecords());
  }

  /**
   * The {@code [Enricher] *} keys must remain visible as per-entity-type rows in {@code
   * EntityStats.additionalProperties} for operator diagnostics (the UI run viewer renders them as
   * table rows). The fix only excludes them from the job-level totals, not from the entity stats
   * map.
   */
  @Test
  void enricherStepKeysRemainVisibleAsEntityStatsRows() {
    DataInsightsApp app =
        new DataInsightsApp(mock(CollectionDAO.class), mock(SearchRepository.class));
    app.jobData = new EventPublisherJob().withStats(new Stats().withJobStats(new StepStats()));

    app.updateStats(
        "[DataAssetsWorkflow] table",
        new StepStats().withTotalRecords(100).withSuccessRecords(100).withFailedRecords(0));
    app.updateStats(
        DataAssetsWorkflow.ENRICHER_STEP_PREFIX + "identity",
        new StepStats().withTotalRecords(100).withSuccessRecords(100).withFailedRecords(0));

    EntityStats entityStats = app.jobData.getStats().getEntityStats();
    assertNotNull(entityStats);
    assertTrue(entityStats.getAdditionalProperties().containsKey("[DataAssetsWorkflow] table"));
    assertTrue(
        entityStats
            .getAdditionalProperties()
            .containsKey(DataAssetsWorkflow.ENRICHER_STEP_PREFIX + "identity"));
  }

  /**
   * Multiple entity-type source keys must still be summed correctly into job-level totals — the
   * filter must not accidentally exclude legitimate entity-type keys.
   */
  @Test
  void jobStatsSumMultipleEntityTypesCorrectly() {
    DataInsightsApp app =
        new DataInsightsApp(mock(CollectionDAO.class), mock(SearchRepository.class));
    app.jobData = new EventPublisherJob().withStats(new Stats().withJobStats(new StepStats()));

    app.updateStats(
        "[DataAssetsWorkflow] table",
        new StepStats().withTotalRecords(100).withSuccessRecords(90).withFailedRecords(10));
    app.updateStats(
        "[DataAssetsWorkflow] topic",
        new StepStats().withTotalRecords(50).withSuccessRecords(45).withFailedRecords(5));

    StepStats jobStats = app.jobData.getStats().getJobStats();
    assertEquals(150, jobStats.getTotalRecords());
    assertEquals(135, jobStats.getSuccessRecords());
    assertEquals(15, jobStats.getFailedRecords());
  }

  /**
   * Edge case: if only {@code [Enricher] *} keys are present (no entity-type source keys), the
   * job-level totals should be 0, not the sum of enricher counters.
   */
  @Test
  void jobStatsWithOnlyEnricherKeysReportZero() {
    DataInsightsApp app =
        new DataInsightsApp(mock(CollectionDAO.class), mock(SearchRepository.class));
    app.jobData = new EventPublisherJob().withStats(new Stats().withJobStats(new StepStats()));

    app.updateStats(
        DataAssetsWorkflow.ENRICHER_STEP_PREFIX + "identity",
        new StepStats().withTotalRecords(100).withSuccessRecords(100).withFailedRecords(0));

    StepStats jobStats = app.jobData.getStats().getJobStats();
    assertEquals(0, jobStats.getTotalRecords());
    assertEquals(0, jobStats.getSuccessRecords());
    assertEquals(0, jobStats.getFailedRecords());
  }

  /**
   * End-to-end simulation of {@link DataInsightsApp#updateJobStatsWithWorkflowStats}: dispatch
   * every entry from a {@link WorkflowStats} that contains both entity-type source keys and
   * {@code [Enricher] *} diagnostic keys, then assert job-level totals match entity-type keys
   * only.
   */
  @Test
  void fullWorkflowDispatchExcludesEnricherKeysFromJobTotals() {
    DataInsightsApp app =
        new DataInsightsApp(mock(CollectionDAO.class), mock(SearchRepository.class));
    app.jobData = new EventPublisherJob().withStats(new Stats().withJobStats(new StepStats()));

    WorkflowStats workflowStats = new WorkflowStats("DataAssetsWorkflow");
    workflowStats.updateWorkflowStepStats(
        "[DataAssetsWorkflow] table",
        new StepStats().withTotalRecords(100).withSuccessRecords(100).withFailedRecords(0));
    for (String step :
        List.of(
            "identity",
            "entityStatus",
            "descriptionSources",
            "tagAndTierSources",
            "ownerTeam",
            "ownerName",
            "tier",
            "descriptionStats",
            "recursiveColumnStats",
            "customProperties")) {
      workflowStats.updateWorkflowStepStats(
          DataAssetsWorkflow.ENRICHER_STEP_PREFIX + step,
          new StepStats().withTotalRecords(100).withSuccessRecords(100).withFailedRecords(0));
    }

    // Mimic updateJobStatsWithWorkflowStats: dispatch every workflow step key to updateStats
    for (Map.Entry<String, StepStats> entry : workflowStats.getWorkflowStepStats().entrySet()) {
      app.updateStats(entry.getKey(), entry.getValue());
    }

    StepStats jobStats = app.jobData.getStats().getJobStats();
    assertEquals(100, jobStats.getTotalRecords());
    assertEquals(100, jobStats.getSuccessRecords());
    assertEquals(0, jobStats.getFailedRecords());
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
