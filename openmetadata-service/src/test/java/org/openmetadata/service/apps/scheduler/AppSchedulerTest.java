package org.openmetadata.service.apps.scheduler;

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
import org.quartz.Scheduler;
import org.quartz.Trigger;
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
}
