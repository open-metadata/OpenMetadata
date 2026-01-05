/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.events.scheduled;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.simulateWork;

import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.impl.StdSchedulerFactory;

/**
 * Unit test for verifying Quartz scheduler behavior with DisallowConcurrentExecution.
 *
 * <p>This test verifies that the @DisallowConcurrentExecution annotation (used by
 * AbstractEventConsumer) prevents concurrent job execution. In a clustered deployment with JDBC
 * JobStore, this annotation combined with database locking ensures only one server processes each
 * subscription at a time.
 *
 * <p>This test uses RAM JobStore for simplicity but validates the core concurrency prevention
 * mechanism that works identically with JDBC JobStore in production.
 */
@Slf4j
class EventSubscriptionSchedulerClusteringTest {

  private static final String TEST_JOB_GROUP = "ClusterTestGroup";

  private Scheduler scheduler;

  // Shared counters to track job execution
  private static final AtomicInteger executionCount = new AtomicInteger(0);
  private static final AtomicBoolean jobRunning = new AtomicBoolean(false);
  private static final AtomicBoolean concurrentExecutionDetected = new AtomicBoolean(false);
  private static CountDownLatch jobCompletedLatch;

  @BeforeEach
  void setUp() {
    executionCount.set(0);
    jobRunning.set(false);
    concurrentExecutionDetected.set(false);
  }

  @AfterEach
  void tearDown() {
    shutdownScheduler(scheduler);
  }

  private void shutdownScheduler(Scheduler sched) {
    if (sched != null) {
      try {
        sched.shutdown(true);
      } catch (SchedulerException e) {
        LOG.warn("Error shutting down scheduler: {}", e.getMessage());
      }
    }
  }

  @Test
  @DisplayName("DisallowConcurrentExecution should prevent overlapping job executions")
  void testDisallowConcurrentExecutionPreventsOverlap() throws Exception {
    scheduler = createScheduler("test-instance-1");

    // Create a slow job (1 second execution time)
    String jobId = "slow-job-" + UUID.randomUUID();
    JobDetail jobDetail =
        JobBuilder.newJob(SlowConcurrencyTestJob.class)
            .withIdentity(jobId, TEST_JOB_GROUP)
            .storeDurably(true)
            .build();

    // Trigger fires every 200ms - faster than job execution time
    // Without DisallowConcurrentExecution, this would cause overlapping executions
    Trigger trigger =
        TriggerBuilder.newTrigger()
            .withIdentity(jobId + "-trigger", TEST_JOB_GROUP)
            .withSchedule(
                SimpleScheduleBuilder.simpleSchedule()
                    .withIntervalInMilliseconds(200)
                    .withRepeatCount(9)) // 10 total fires
            .startNow()
            .build();

    // We expect fewer than 10 executions because overlapping ones are skipped
    jobCompletedLatch = new CountDownLatch(3);

    scheduler.scheduleJob(jobDetail, trigger);

    // Wait for at least 3 executions
    boolean completed = jobCompletedLatch.await(15, TimeUnit.SECONDS);
    assertTrue(completed, "At least 3 job executions should complete");

    // The key assertion: no concurrent execution detected
    assertFalse(
        concurrentExecutionDetected.get(),
        "DisallowConcurrentExecution should prevent concurrent runs");

    // Executions should be fewer than trigger count due to skipped overlapping triggers
    assertTrue(
        executionCount.get() < 10,
        "Some triggers should be skipped due to DisallowConcurrentExecution");

    LOG.info(
        "Test completed: {} executions (less than 10 due to skipped overlaps), concurrent: {}",
        executionCount.get(),
        concurrentExecutionDetected.get());

    scheduler.deleteJob(new JobKey(jobId, TEST_JOB_GROUP));
  }

  @Test
  @DisplayName("Jobs without DisallowConcurrentExecution can run concurrently")
  void testWithoutDisallowConcurrentExecutionAllowsOverlap() throws Exception {
    scheduler = createScheduler("test-instance-2");

    // Create a slow job WITHOUT DisallowConcurrentExecution
    String jobId = "concurrent-allowed-job-" + UUID.randomUUID();
    JobDetail jobDetail =
        JobBuilder.newJob(ConcurrentAllowedJob.class)
            .withIdentity(jobId, TEST_JOB_GROUP)
            .storeDurably(true)
            .build();

    // Trigger fires every 100ms - faster than 500ms job execution
    Trigger trigger =
        TriggerBuilder.newTrigger()
            .withIdentity(jobId + "-trigger", TEST_JOB_GROUP)
            .withSchedule(
                SimpleScheduleBuilder.simpleSchedule()
                    .withIntervalInMilliseconds(100)
                    .withRepeatCount(5))
            .startNow()
            .build();

    jobCompletedLatch = new CountDownLatch(4);

    scheduler.scheduleJob(jobDetail, trigger);

    // Wait for executions
    jobCompletedLatch.await(10, TimeUnit.SECONDS);

    // Without DisallowConcurrentExecution, concurrent execution SHOULD be detected
    assertTrue(
        concurrentExecutionDetected.get(),
        "Without DisallowConcurrentExecution, concurrent runs should occur");

    LOG.info(
        "Test completed: {} executions, concurrent detected: {}",
        executionCount.get(),
        concurrentExecutionDetected.get());

    scheduler.deleteJob(new JobKey(jobId, TEST_JOB_GROUP));
  }

  @Test
  @DisplayName("Schedulers with different names have different instance IDs")
  void testSchedulersWithDifferentNamesHaveDifferentIds() throws Exception {
    // Create two scheduler instances with DIFFERENT scheduler names
    // This verifies that instance identification works correctly
    Scheduler sched1 = createSchedulerWithName("ClusterSchedulerA", "instance-A");
    Scheduler sched2 = createSchedulerWithName("ClusterSchedulerB", "instance-B");

    assertNotNull(sched1);
    assertNotNull(sched2);

    // They should have different instance IDs
    assertFalse(
        sched1.getSchedulerInstanceId().equals(sched2.getSchedulerInstanceId()),
        "Scheduler instances should have different IDs");

    // And different scheduler names
    assertFalse(
        sched1.getSchedulerName().equals(sched2.getSchedulerName()),
        "Scheduler instances should have different names");

    LOG.info(
        "Scheduler 1: name={}, instanceId={}",
        sched1.getSchedulerName(),
        sched1.getSchedulerInstanceId());
    LOG.info(
        "Scheduler 2: name={}, instanceId={}",
        sched2.getSchedulerName(),
        sched2.getSchedulerInstanceId());

    shutdownScheduler(sched1);
    shutdownScheduler(sched2);
  }

  private Scheduler createSchedulerWithName(String name, String instanceId)
      throws SchedulerException {
    Properties props = new Properties();
    props.setProperty("org.quartz.scheduler.instanceName", name);
    props.setProperty("org.quartz.scheduler.instanceId", instanceId);
    props.setProperty("org.quartz.threadPool.class", "org.quartz.simpl.SimpleThreadPool");
    props.setProperty("org.quartz.threadPool.threadCount", "5");
    props.setProperty("org.quartz.jobStore.class", "org.quartz.simpl.RAMJobStore");

    StdSchedulerFactory factory = new StdSchedulerFactory();
    factory.initialize(props);
    Scheduler sched = factory.getScheduler();
    sched.start();
    return sched;
  }

  private Scheduler createScheduler(String instanceId) throws SchedulerException {
    Properties props = new Properties();
    props.setProperty("org.quartz.scheduler.instanceName", "TestClusterScheduler");
    props.setProperty("org.quartz.scheduler.instanceId", instanceId);
    props.setProperty("org.quartz.threadPool.class", "org.quartz.simpl.SimpleThreadPool");
    props.setProperty("org.quartz.threadPool.threadCount", "5");
    // Using RAM store for unit tests - behavior is same as JDBC for concurrency
    props.setProperty("org.quartz.jobStore.class", "org.quartz.simpl.RAMJobStore");

    StdSchedulerFactory factory = new StdSchedulerFactory();
    factory.initialize(props);
    Scheduler sched = factory.getScheduler();
    sched.start();
    return sched;
  }

  /** Slow job WITH DisallowConcurrentExecution - overlapping triggers are skipped. */
  @DisallowConcurrentExecution
  public static class SlowConcurrencyTestJob implements Job {
    @Override
    public void execute(JobExecutionContext context) throws JobExecutionException {
      if (!jobRunning.compareAndSet(false, true)) {
        LOG.error("CONCURRENT EXECUTION DETECTED!");
        concurrentExecutionDetected.set(true);
        return;
      }

      try {
        int count = executionCount.incrementAndGet();
        LOG.info("SlowConcurrencyTestJob executing (count: {})", count);
        simulateWork(1000); // Slow execution
      } catch (Exception e) {
        LOG.error("Error in SlowConcurrencyTestJob", e);
      } finally {
        jobRunning.set(false);
        if (jobCompletedLatch != null) {
          jobCompletedLatch.countDown();
        }
      }
    }
  }

  /** Job WITHOUT DisallowConcurrentExecution - allows concurrent execution. */
  public static class ConcurrentAllowedJob implements Job {
    @Override
    public void execute(JobExecutionContext context) throws JobExecutionException {
      if (!jobRunning.compareAndSet(false, true)) {
        LOG.warn("Concurrent execution detected (expected for this job)");
        concurrentExecutionDetected.set(true);
        // Don't return - continue execution to show concurrency
      }

      try {
        int count = executionCount.incrementAndGet();
        LOG.info("ConcurrentAllowedJob executing (count: {})", count);
        simulateWork(500);
      } catch (Exception e) {
        LOG.error("Error in ConcurrentAllowedJob", e);
      } finally {
        jobRunning.set(false);
        if (jobCompletedLatch != null) {
          jobCompletedLatch.countDown();
        }
      }
    }
  }
}
