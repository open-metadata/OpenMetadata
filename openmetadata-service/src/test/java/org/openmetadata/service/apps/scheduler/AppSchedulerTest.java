package org.openmetadata.service.apps.scheduler;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.ScheduledExecutionContext;
import org.openmetadata.service.exception.UnhandledServerException;
import org.quartz.Job;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobKey;
import org.quartz.ObjectAlreadyExistsException;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.Trigger;
import org.quartz.TriggerKey;
import sun.misc.Unsafe;

@ExtendWith(MockitoExtension.class)
class AppSchedulerTest {

  private App testApp;
  private AppRunRecord testRunRecord;

  @Mock private Scheduler mockScheduler;

  @BeforeEach
  void setUp() {
    testApp =
        new App()
            .withId(UUID.randomUUID())
            .withName("TestSearchIndexingApp")
            .withFullyQualifiedName("TestSearchIndexingApp");

    testRunRecord =
        new AppRunRecord()
            .withAppId(testApp.getId())
            .withAppName(testApp.getName())
            .withStartTime(System.currentTimeMillis())
            .withTimestamp(System.currentTimeMillis())
            .withRunType("Manual")
            .withStatus(AppRunRecord.Status.RUNNING);
  }

  @Test
  void testAppRunRecordStatusTransition() {
    assertEquals(AppRunRecord.Status.RUNNING, testRunRecord.getStatus());

    testRunRecord.withStatus(AppRunRecord.Status.STOPPED);
    assertEquals(AppRunRecord.Status.STOPPED, testRunRecord.getStatus());
  }

  @Test
  void testAppRunRecordEndTimeSet() {
    long endTime = System.currentTimeMillis();
    testRunRecord.withEndTime(endTime);

    assertNotNull(testRunRecord.getEndTime());
    assertEquals(endTime, testRunRecord.getEndTime());
  }

  /**
   * Creates an AppScheduler instance with the mock scheduler injected,
   * bypassing the private constructor that requires database connectivity.
   */
  private AppScheduler createSchedulerWithMock() throws Exception {
    Field unsafeField = Unsafe.class.getDeclaredField("theUnsafe");
    unsafeField.setAccessible(true);
    Unsafe unsafe = (Unsafe) unsafeField.get(null);

    AppScheduler appScheduler = (AppScheduler) unsafe.allocateInstance(AppScheduler.class);

    Field schedulerField = AppScheduler.class.getDeclaredField("scheduler");
    schedulerField.setAccessible(true);
    schedulerField.set(appScheduler, mockScheduler);

    return appScheduler;
  }

  // --- Tests for getUniqueJobIdentifier ---

  @Test
  void testGetUniqueJobIdentifier_withIngestionRunner() throws Exception {
    AppScheduler appScheduler = createSchedulerWithMock();
    Map<String, Object> config = Map.of("ingestionRunner", "runner-123");

    assertEquals("runner-123", appScheduler.getUniqueJobIdentifier(config));
  }

  @Test
  void testGetUniqueJobIdentifier_withWorkflowName() throws Exception {
    AppScheduler appScheduler = createSchedulerWithMock();
    Map<String, Object> config = Map.of("workflowName", "workflow-abc");

    assertEquals("workflow-abc", appScheduler.getUniqueJobIdentifier(config));
  }

  @Test
  void testGetUniqueJobIdentifier_ingestionRunnerTakesPrecedence() throws Exception {
    AppScheduler appScheduler = createSchedulerWithMock();
    Map<String, Object> config = new HashMap<>();
    config.put("ingestionRunner", "runner-123");
    config.put("workflowName", "workflow-abc");

    assertEquals("runner-123", appScheduler.getUniqueJobIdentifier(config));
  }

  @Test
  void testGetUniqueJobIdentifier_noMatchingKeys() throws Exception {
    AppScheduler appScheduler = createSchedulerWithMock();

    assertNull(appScheduler.getUniqueJobIdentifier(Map.of("someOtherKey", "value")));
  }

  @Test
  void testGetUniqueJobIdentifier_nullConfig() throws Exception {
    AppScheduler appScheduler = createSchedulerWithMock();

    assertNull(appScheduler.getUniqueJobIdentifier(null));
  }

  @Test
  void testGetUniqueJobIdentifier_emptyConfig() throws Exception {
    AppScheduler appScheduler = createSchedulerWithMock();

    assertNull(appScheduler.getUniqueJobIdentifier(Map.of()));
  }

  // --- Tests for triggerOnDemandApplication concurrent behavior ---

  @Test
  void testConcurrentApp_withWorkflowName_usesUniqueJobIdentity() throws Exception {
    AppScheduler appScheduler = createSchedulerWithMock();

    App concurrentApp =
        new App()
            .withId(UUID.randomUUID())
            .withName("QueryRunner")
            .withFullyQualifiedName("QueryRunner")
            .withClassName("org.openmetadata.service.resources.apps.TestApp")
            .withAllowConcurrentExecution(true)
            .withRuntime(new ScheduledExecutionContext().withEnabled(true));

    String workflowId = UUID.randomUUID().toString();
    Map<String, Object> config = new HashMap<>();
    config.put("workflowName", workflowId);

    when(mockScheduler.scheduleJob(any(JobDetail.class), any(Trigger.class))).thenReturn(null);

    appScheduler.triggerOnDemandApplication(concurrentApp, config);

    ArgumentCaptor<JobDetail> jobCaptor = ArgumentCaptor.forClass(JobDetail.class);
    ArgumentCaptor<Trigger> triggerCaptor = ArgumentCaptor.forClass(Trigger.class);
    verify(mockScheduler).scheduleJob(jobCaptor.capture(), triggerCaptor.capture());

    String expectedIdentity =
        String.format("QueryRunner-%s-%s", AppScheduler.ON_DEMAND_JOB, workflowId);
    assertEquals(expectedIdentity, jobCaptor.getValue().getKey().getName());
    assertEquals(expectedIdentity, triggerCaptor.getValue().getKey().getName());
  }

  @Test
  void testConcurrentApp_withoutUniqueId_fallsBackToBlocking() throws Exception {
    AppScheduler appScheduler = createSchedulerWithMock();

    App concurrentApp =
        new App()
            .withId(UUID.randomUUID())
            .withName("QueryRunner")
            .withFullyQualifiedName("QueryRunner")
            .withClassName("org.openmetadata.service.resources.apps.TestApp")
            .withAllowConcurrentExecution(true)
            .withRuntime(new ScheduledExecutionContext().withEnabled(true));

    // Config without ingestionRunner or workflowName
    Map<String, Object> config = new HashMap<>();
    config.put("query", "SELECT 1");

    String standardJobIdentity = String.format("QueryRunner-%s", AppScheduler.ON_DEMAND_JOB);
    when(mockScheduler.getJobDetail(new JobKey("QueryRunner", AppScheduler.APPS_JOB_GROUP)))
        .thenReturn(null);
    when(mockScheduler.getJobDetail(new JobKey(standardJobIdentity, AppScheduler.APPS_JOB_GROUP)))
        .thenReturn(null);
    when(mockScheduler.getCurrentlyExecutingJobs()).thenReturn(Collections.emptyList());
    when(mockScheduler.scheduleJob(any(JobDetail.class), any(Trigger.class))).thenReturn(null);

    appScheduler.triggerOnDemandApplication(concurrentApp, config);

    ArgumentCaptor<JobDetail> jobCaptor = ArgumentCaptor.forClass(JobDetail.class);
    verify(mockScheduler).scheduleJob(jobCaptor.capture(), any(Trigger.class));

    // Should use standard (non-concurrent) identity since no unique ID was found
    assertEquals(standardJobIdentity, jobCaptor.getValue().getKey().getName());
  }

  @Test
  void testNonConcurrentApp_blocksWhenJobRunning() throws Exception {
    AppScheduler appScheduler = createSchedulerWithMock();

    App nonConcurrentApp =
        new App()
            .withId(UUID.randomUUID())
            .withName("SearchIndexApp")
            .withFullyQualifiedName("SearchIndexApp")
            .withClassName("org.openmetadata.service.resources.apps.TestApp")
            .withAllowConcurrentExecution(false)
            .withRuntime(new ScheduledExecutionContext().withEnabled(true));

    String jobIdentity = String.format("SearchIndexApp-%s", AppScheduler.ON_DEMAND_JOB);
    JobDetail mockJobDetail =
        JobBuilder.newJob(Job.class).withIdentity(jobIdentity, AppScheduler.APPS_JOB_GROUP).build();

    when(mockScheduler.getJobDetail(new JobKey("SearchIndexApp", AppScheduler.APPS_JOB_GROUP)))
        .thenReturn(null);
    when(mockScheduler.getJobDetail(new JobKey(jobIdentity, AppScheduler.APPS_JOB_GROUP)))
        .thenReturn(mockJobDetail);

    // Simulate a running job
    JobExecutionContext mockExecContext = mock(JobExecutionContext.class);
    when(mockExecContext.getJobDetail()).thenReturn(mockJobDetail);
    when(mockScheduler.getCurrentlyExecutingJobs()).thenReturn(List.of(mockExecContext));

    assertThrows(
        UnhandledServerException.class,
        () -> appScheduler.triggerOnDemandApplication(nonConcurrentApp, new HashMap<>()));

    verify(mockScheduler, never()).scheduleJob(any(JobDetail.class), any(Trigger.class));
  }

  @Test
  void testConcurrentApp_twoParallelJobs_differentIdentities() throws Exception {
    AppScheduler appScheduler = createSchedulerWithMock();

    App concurrentApp =
        new App()
            .withId(UUID.randomUUID())
            .withName("QueryRunner")
            .withFullyQualifiedName("QueryRunner")
            .withClassName("org.openmetadata.service.resources.apps.TestApp")
            .withAllowConcurrentExecution(true)
            .withRuntime(new ScheduledExecutionContext().withEnabled(true));

    when(mockScheduler.scheduleJob(any(JobDetail.class), any(Trigger.class))).thenReturn(null);

    String workflowId1 = UUID.randomUUID().toString();
    String workflowId2 = UUID.randomUUID().toString();

    Map<String, Object> config1 = new HashMap<>();
    config1.put("workflowName", workflowId1);

    Map<String, Object> config2 = new HashMap<>();
    config2.put("workflowName", workflowId2);

    appScheduler.triggerOnDemandApplication(concurrentApp, config1);
    appScheduler.triggerOnDemandApplication(concurrentApp, config2);

    ArgumentCaptor<JobDetail> jobCaptor = ArgumentCaptor.forClass(JobDetail.class);
    verify(mockScheduler, times(2)).scheduleJob(jobCaptor.capture(), any(Trigger.class));

    List<JobDetail> capturedJobs = jobCaptor.getAllValues();
    String identity1 = capturedJobs.get(0).getKey().getName();
    String identity2 = capturedJobs.get(1).getKey().getName();

    assertNotEquals(identity1, identity2);
    assertTrue(identity1.contains(workflowId1));
    assertTrue(identity2.contains(workflowId2));
  }

  // --- Tests for the reindex/ops path: clear a stale on-demand job, then trigger ---

  private App nonConcurrentApp(String name) {
    return new App()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withClassName("org.openmetadata.service.resources.apps.TestApp")
        .withAllowConcurrentExecution(false)
        .withRuntime(new ScheduledExecutionContext().withEnabled(true));
  }

  @Test
  void testDeleteOnDemandJob_removesOnDemandJobAndTrigger() throws Exception {
    AppScheduler appScheduler = createSchedulerWithMock();
    App app = nonConcurrentApp("SearchIndexingApplication");

    appScheduler.deleteOnDemandJob(app);

    String onDemandIdentity =
        String.format("SearchIndexingApplication-%s", AppScheduler.ON_DEMAND_JOB);
    verify(mockScheduler).deleteJob(new JobKey(onDemandIdentity, AppScheduler.APPS_JOB_GROUP));
    verify(mockScheduler)
        .unscheduleJob(new TriggerKey(onDemandIdentity, AppScheduler.APPS_TRIGGER_GROUP));
  }

  @Test
  void testDeleteOnDemandJob_skipsWhenJobCurrentlyExecuting() throws Exception {
    AppScheduler appScheduler = createSchedulerWithMock();
    App app = nonConcurrentApp("SearchIndexingApplication");
    String onDemandIdentity =
        String.format("SearchIndexingApplication-%s", AppScheduler.ON_DEMAND_JOB);
    JobKey onDemandKey = new JobKey(onDemandIdentity, AppScheduler.APPS_JOB_GROUP);

    // The on-demand job is genuinely executing right now.
    JobDetail running =
        JobBuilder.newJob(Job.class)
            .withIdentity(onDemandIdentity, AppScheduler.APPS_JOB_GROUP)
            .build();
    JobExecutionContext execContext = mock(JobExecutionContext.class);
    when(execContext.getJobDetail()).thenReturn(running);
    when(mockScheduler.getCurrentlyExecutingJobs()).thenReturn(List.of(execContext));

    appScheduler.deleteOnDemandJob(app);

    // A running job must never be cleared.
    verify(mockScheduler, never()).deleteJob(onDemandKey);
    verify(mockScheduler, never()).unscheduleJob(any(TriggerKey.class));
  }

  @Test
  void testDeleteOnDemandJob_isBestEffortOnSchedulerException() throws Exception {
    AppScheduler appScheduler = createSchedulerWithMock();
    App app = nonConcurrentApp("SearchIndexingApplication");
    when(mockScheduler.deleteJob(any(JobKey.class)))
        .thenThrow(new SchedulerException("store unavailable"));

    // Clearing a leftover is best-effort; a failure here must not break the reindex flow.
    assertDoesNotThrow(() -> appScheduler.deleteOnDemandJob(app));
  }

  @Test
  void testStaleOnDemandJob_blocksTriggerWithoutClear() throws Exception {
    AppScheduler appScheduler = createSchedulerWithMock();
    App app = nonConcurrentApp("SearchIndexingApplication");
    String onDemandIdentity =
        String.format("SearchIndexingApplication-%s", AppScheduler.ON_DEMAND_JOB);
    JobKey onDemandKey = new JobKey(onDemandIdentity, AppScheduler.APPS_JOB_GROUP);

    // A leftover on-demand job persisted by a previous run that died (not currently running).
    JobDetail stale =
        JobBuilder.newJob(Job.class)
            .withIdentity(onDemandIdentity, AppScheduler.APPS_JOB_GROUP)
            .build();
    when(mockScheduler.getJobDetail(
            new JobKey("SearchIndexingApplication", AppScheduler.APPS_JOB_GROUP)))
        .thenReturn(null);
    when(mockScheduler.getJobDetail(onDemandKey)).thenReturn(stale);
    when(mockScheduler.getCurrentlyExecutingJobs()).thenReturn(Collections.emptyList());
    // Quartz rejects scheduling a duplicate key while the stale job is still persisted.
    when(mockScheduler.scheduleJob(any(JobDetail.class), any(Trigger.class)))
        .thenThrow(new ObjectAlreadyExistsException("duplicate job key"));

    assertThrows(
        UnhandledServerException.class,
        () -> appScheduler.triggerOnDemandApplication(app, new HashMap<>()));
  }

  @Test
  void testReindexPath_clearStaleThenTriggerSucceeds() throws Exception {
    AppScheduler appScheduler = createSchedulerWithMock();
    App app = nonConcurrentApp("SearchIndexingApplication");
    String onDemandIdentity =
        String.format("SearchIndexingApplication-%s", AppScheduler.ON_DEMAND_JOB);
    JobKey onDemandKey = new JobKey(onDemandIdentity, AppScheduler.APPS_JOB_GROUP);

    // Stale leftover present until deleteOnDemandJob removes it, mirroring the JDBC job store.
    AtomicBoolean stalePresent = new AtomicBoolean(true);
    JobDetail stale =
        JobBuilder.newJob(Job.class)
            .withIdentity(onDemandIdentity, AppScheduler.APPS_JOB_GROUP)
            .build();
    when(mockScheduler.getJobDetail(
            new JobKey("SearchIndexingApplication", AppScheduler.APPS_JOB_GROUP)))
        .thenReturn(null);
    when(mockScheduler.getJobDetail(onDemandKey))
        .thenAnswer(inv -> stalePresent.get() ? stale : null);
    when(mockScheduler.getCurrentlyExecutingJobs()).thenReturn(Collections.emptyList());
    when(mockScheduler.deleteJob(onDemandKey))
        .thenAnswer(
            inv -> {
              stalePresent.set(false);
              return true;
            });
    when(mockScheduler.scheduleJob(any(JobDetail.class), any(Trigger.class)))
        .thenAnswer(
            inv -> {
              if (stalePresent.get()) {
                throw new ObjectAlreadyExistsException("duplicate job key");
              }
              return null;
            });

    // The reindex CLI path: clear the leftover, then trigger.
    appScheduler.deleteOnDemandJob(app);
    appScheduler.triggerOnDemandApplication(app, new HashMap<>());

    verify(mockScheduler).deleteJob(onDemandKey);
    ArgumentCaptor<JobDetail> jobCaptor = ArgumentCaptor.forClass(JobDetail.class);
    verify(mockScheduler).scheduleJob(jobCaptor.capture(), any(Trigger.class));
    assertEquals(onDemandIdentity, jobCaptor.getValue().getKey().getName());
  }
}
