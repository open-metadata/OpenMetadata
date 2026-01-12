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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import io.fabric8.kubernetes.api.model.*;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientBuilder;
import io.fabric8.kubernetes.client.dsl.MixedOperation;
import io.fabric8.kubernetes.client.dsl.Resource;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.operator.model.CronOMJobResource;
import org.openmetadata.operator.model.CronOMJobResourceList;
import org.openmetadata.operator.model.CronOMJobSpec;
import org.openmetadata.operator.model.OMJobPhase;
import org.openmetadata.operator.model.OMJobResource;
import org.openmetadata.operator.model.OMJobResourceList;
import org.openmetadata.operator.model.OMJobSpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests for OMJob operator functionality.
 *
 * These tests verify the complete lifecycle of OMJob execution including:
 * - Main pod creation and execution
 * - Exit handler execution on success/failure
 * - Status updates throughout the lifecycle
 * - Race condition handling
 */
public class K8sOMJobOperatorIT {

  private static final Logger LOG = LoggerFactory.getLogger(K8sOMJobOperatorIT.class);
  private static final String TEST_NAMESPACE =
      System.getenv().getOrDefault("TEST_NAMESPACE", "openmetadata-pipelines-test");
  private static final Duration TIMEOUT = Duration.ofMinutes(2);

  private KubernetesClient client;
  private MixedOperation<OMJobResource, OMJobResourceList, Resource<OMJobResource>> omJobClient;
  private String testJobName;

  @BeforeAll
  static void setupClass() {
    // Ensure the operator is running
    Awaitility.setDefaultTimeout(TIMEOUT.toSeconds(), TimeUnit.SECONDS);
    Awaitility.setDefaultPollInterval(2, TimeUnit.SECONDS);
  }

  @BeforeEach
  void setup(TestInfo testInfo) {
    client = new KubernetesClientBuilder().build();
    omJobClient = client.resources(OMJobResource.class, OMJobResourceList.class);

    // Generate unique test job name
    testJobName =
        "test-omjob-"
            + testInfo.getTestMethod().get().getName().toLowerCase()
            + "-"
            + System.currentTimeMillis();
  }

  @AfterEach
  void cleanup() {
    try {
      // Clean up test OMJob and its pods
      if (testJobName != null) {
        omJobClient.inNamespace(TEST_NAMESPACE).withName(testJobName).delete();

        // Delete associated pods
        client
            .pods()
            .inNamespace(TEST_NAMESPACE)
            .withLabel("omjob.pipelines.openmetadata.org/name", testJobName)
            .delete();
      }
    } catch (Exception e) {
      LOG.warn("Failed to cleanup test resources", e);
    } finally {
      if (client != null) {
        client.close();
      }
    }
  }

  @Test
  void testSuccessfulJobWithExitHandler() {
    // Create OMJob that succeeds
    OMJobResource omJob =
        createOMJob(
            testJobName,
            "echo 'Main job running'; sleep 5; echo 'Main job done'",
            0,
            "echo 'Exit handler executing'");

    omJobClient.inNamespace(TEST_NAMESPACE).create(omJob);

    // Wait for main pod to be created
    Awaitility.await()
        .atMost(TIMEOUT)
        .until(
            () -> {
              OMJobResource current =
                  omJobClient.inNamespace(TEST_NAMESPACE).withName(testJobName).get();
              return current.getStatus() != null
                  && current.getStatus().getPhase() == OMJobPhase.RUNNING
                  && current.getStatus().getMainPodName() != null;
            });

    String mainPodName =
        omJobClient
            .inNamespace(TEST_NAMESPACE)
            .withName(testJobName)
            .get()
            .getStatus()
            .getMainPodName();
    LOG.info("Main pod created: {}", mainPodName);

    // Wait for main pod to complete
    Awaitility.await()
        .atMost(TIMEOUT)
        .until(
            () -> {
              Pod pod = client.pods().inNamespace(TEST_NAMESPACE).withName(mainPodName).get();
              return pod != null
                  && ("Succeeded".equals(pod.getStatus().getPhase())
                      || "Failed".equals(pod.getStatus().getPhase()));
            });

    // Wait for exit handler to be created
    Awaitility.await()
        .atMost(TIMEOUT)
        .until(
            () -> {
              OMJobResource current =
                  omJobClient.inNamespace(TEST_NAMESPACE).withName(testJobName).get();
              return current.getStatus() != null
                  && current.getStatus().getPhase() == OMJobPhase.EXIT_HANDLER_RUNNING
                  && current.getStatus().getExitHandlerPodName() != null;
            });

    String exitPodName =
        omJobClient
            .inNamespace(TEST_NAMESPACE)
            .withName(testJobName)
            .get()
            .getStatus()
            .getExitHandlerPodName();
    LOG.info("Exit handler pod created: {}", exitPodName);

    // Wait for exit handler to complete
    Awaitility.await()
        .atMost(TIMEOUT)
        .until(
            () -> {
              Pod pod = client.pods().inNamespace(TEST_NAMESPACE).withName(exitPodName).get();
              return pod != null
                  && ("Succeeded".equals(pod.getStatus().getPhase())
                      || "Failed".equals(pod.getStatus().getPhase()));
            });

    // Verify final status
    OMJobResource finalJob = omJobClient.inNamespace(TEST_NAMESPACE).withName(testJobName).get();
    assertEquals(OMJobPhase.SUCCEEDED, finalJob.getStatus().getPhase());
    assertEquals(Integer.valueOf(0), finalJob.getStatus().getMainPodExitCode());
    assertNotNull(finalJob.getStatus().getCompletionTime());
  }

  @Test
  void testFailedJobWithExitHandler() {
    // Create OMJob that fails
    OMJobResource omJob =
        createOMJob(
            testJobName,
            "echo 'Main job starting'; exit 1",
            1,
            "echo 'Exit handler cleaning up after failure'");

    omJobClient.inNamespace(TEST_NAMESPACE).create(omJob);

    // Wait for main pod to fail
    Awaitility.await()
        .atMost(TIMEOUT)
        .until(
            () -> {
              OMJobResource current =
                  omJobClient.inNamespace(TEST_NAMESPACE).withName(testJobName).get();
              if (current.getStatus() == null || current.getStatus().getMainPodName() == null) {
                return false;
              }

              Pod mainPod =
                  client
                      .pods()
                      .inNamespace(TEST_NAMESPACE)
                      .withName(current.getStatus().getMainPodName())
                      .get();
              return mainPod != null && "Failed".equals(mainPod.getStatus().getPhase());
            });

    // Wait for exit handler to be created
    Awaitility.await()
        .atMost(TIMEOUT)
        .until(
            () -> {
              OMJobResource current =
                  omJobClient.inNamespace(TEST_NAMESPACE).withName(testJobName).get();
              return current.getStatus() != null
                  && current.getStatus().getPhase() == OMJobPhase.EXIT_HANDLER_RUNNING
                  && current.getStatus().getExitHandlerPodName() != null;
            });

    String exitPodName =
        omJobClient
            .inNamespace(TEST_NAMESPACE)
            .withName(testJobName)
            .get()
            .getStatus()
            .getExitHandlerPodName();
    LOG.info("Exit handler pod created after failure: {}", exitPodName);

    // Wait for exit handler to complete
    Awaitility.await()
        .atMost(TIMEOUT)
        .until(
            () -> {
              Pod pod = client.pods().inNamespace(TEST_NAMESPACE).withName(exitPodName).get();
              return pod != null && "Succeeded".equals(pod.getStatus().getPhase());
            });

    // Verify final status
    OMJobResource finalJob = omJobClient.inNamespace(TEST_NAMESPACE).withName(testJobName).get();
    assertEquals(OMJobPhase.SUCCEEDED, finalJob.getStatus().getPhase());
    assertEquals(Integer.valueOf(1), finalJob.getStatus().getMainPodExitCode());
  }

  @Test
  void testRaceConditionHandling() {
    // Create multiple OMJobs simultaneously to test race conditions
    int jobCount = 5;
    Map<String, OMJobResource> jobs = new HashMap<>();

    for (int i = 0; i < jobCount; i++) {
      String jobName = testJobName + "-" + i;
      OMJobResource omJob =
          createOMJob(
              jobName,
              "echo 'Job " + i + " running'; sleep " + (i * 2) + "",
              0,
              "echo 'Exit handler for job " + i + "'");

      jobs.put(jobName, omJobClient.inNamespace(TEST_NAMESPACE).create(omJob));
    }

    // Verify all jobs complete successfully
    jobs.forEach(
        (jobName, omJob) -> {
          Awaitility.await()
              .atMost(TIMEOUT.multipliedBy(2))
              .until(
                  () -> {
                    OMJobResource current =
                        omJobClient.inNamespace(TEST_NAMESPACE).withName(jobName).get();
                    return current.getStatus() != null
                        && (current.getStatus().getPhase() == OMJobPhase.SUCCEEDED
                            || current.getStatus().getPhase() == OMJobPhase.FAILED);
                  });

          OMJobResource finalJob = omJobClient.inNamespace(TEST_NAMESPACE).withName(jobName).get();
          assertNotNull(finalJob.getStatus().getMainPodName(), "Main pod should be created");
          assertNotNull(
              finalJob.getStatus().getExitHandlerPodName(), "Exit handler should be created");
          assertTrue(
              finalJob.getStatus().getPhase().isTerminal(), "Job should reach terminal state");
        });
  }

  @Test
  void testPodDeletionDuringExecution() {
    // Create OMJob with long-running main pod
    OMJobResource omJob =
        createOMJob(
            testJobName,
            "echo 'Starting'; sleep 30; echo 'Done'",
            0,
            "echo 'Exit handler after pod deletion'");

    omJobClient.inNamespace(TEST_NAMESPACE).create(omJob);

    // Wait for main pod to be created and running
    Awaitility.await()
        .atMost(TIMEOUT)
        .until(
            () -> {
              OMJobResource current =
                  omJobClient.inNamespace(TEST_NAMESPACE).withName(testJobName).get();
              if (current.getStatus() == null || current.getStatus().getMainPodName() == null) {
                return false;
              }

              Pod mainPod =
                  client
                      .pods()
                      .inNamespace(TEST_NAMESPACE)
                      .withName(current.getStatus().getMainPodName())
                      .get();
              return mainPod != null && "Running".equals(mainPod.getStatus().getPhase());
            });

    String mainPodName =
        omJobClient
            .inNamespace(TEST_NAMESPACE)
            .withName(testJobName)
            .get()
            .getStatus()
            .getMainPodName();

    // Delete the main pod to simulate unexpected termination
    client.pods().inNamespace(TEST_NAMESPACE).withName(mainPodName).delete();
    LOG.info("Deleted main pod: {}", mainPodName);

    // Wait for operator to detect pod deletion and handle it
    Awaitility.await()
        .atMost(TIMEOUT)
        .until(
            () -> {
              OMJobResource current =
                  omJobClient.inNamespace(TEST_NAMESPACE).withName(testJobName).get();
              return current.getStatus() != null
                  && (current.getStatus().getPhase() == OMJobPhase.FAILED
                      || current.getStatus().getPhase() == OMJobPhase.EXIT_HANDLER_RUNNING);
            });

    // Verify job handles the deletion appropriately
    OMJobResource finalJob = omJobClient.inNamespace(TEST_NAMESPACE).withName(testJobName).get();
    assertTrue(
        finalJob.getStatus().getPhase() == OMJobPhase.FAILED
            || finalJob.getStatus().getPhase() == OMJobPhase.EXIT_HANDLER_RUNNING,
        "Job should handle pod deletion");
  }

  @Test
  void testTTLCleanup() {
    // Create OMJob with short TTL
    OMJobResource omJob = createOMJob(testJobName, "echo 'Quick job'", 0, "echo 'Exit handler'");
    omJob.getSpec().setTtlSecondsAfterFinished(10); // 10 second TTL

    omJobClient.inNamespace(TEST_NAMESPACE).create(omJob);

    // Wait for job to complete
    Awaitility.await()
        .atMost(TIMEOUT)
        .until(
            () -> {
              OMJobResource current =
                  omJobClient.inNamespace(TEST_NAMESPACE).withName(testJobName).get();
              return current.getStatus() != null
                  && (current.getStatus().getPhase() == OMJobPhase.SUCCEEDED
                      || current.getStatus().getPhase() == OMJobPhase.FAILED);
            });

    // Get pod names before TTL cleanup
    OMJobResource completedJob =
        omJobClient.inNamespace(TEST_NAMESPACE).withName(testJobName).get();
    String mainPodName = completedJob.getStatus().getMainPodName();
    String exitPodName = completedJob.getStatus().getExitHandlerPodName();

    // Verify pods exist initially
    assertNotNull(client.pods().inNamespace(TEST_NAMESPACE).withName(mainPodName).get());
    assertNotNull(client.pods().inNamespace(TEST_NAMESPACE).withName(exitPodName).get());

    // Wait for TTL to expire and pods to be cleaned up
    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(5))
        .until(
            () -> {
              Pod mainPod = client.pods().inNamespace(TEST_NAMESPACE).withName(mainPodName).get();
              Pod exitPod = client.pods().inNamespace(TEST_NAMESPACE).withName(exitPodName).get();
              return mainPod == null && exitPod == null;
            });

    LOG.info(
        "TTL cleanup verified - pods deleted after {} seconds",
        omJob.getSpec().getTtlSecondsAfterFinished());
  }

  private OMJobResource createOMJob(
      String name, String mainCommand, int expectedExitCode, String exitCommand) {
    OMJobResource omJob = new OMJobResource();

    ObjectMeta metadata = new ObjectMeta();
    metadata.setName(name);
    metadata.setNamespace(TEST_NAMESPACE);
    omJob.setMetadata(metadata);

    OMJobSpec spec = new OMJobSpec();

    // Main pod spec
    OMJobSpec.OMJobPodSpec mainPodSpec = new OMJobSpec.OMJobPodSpec();
    mainPodSpec.setImage("busybox:1.28");
    mainPodSpec.setImagePullPolicy("IfNotPresent");
    mainPodSpec.setCommand(List.of("sh", "-c", mainCommand));
    mainPodSpec.setServiceAccountName("openmetadata-ingestion-test");
    spec.setMainPodSpec(mainPodSpec);

    // Exit handler spec
    OMJobSpec.OMJobPodSpec exitHandlerSpec = new OMJobSpec.OMJobPodSpec();
    exitHandlerSpec.setImage("busybox:1.28");
    exitHandlerSpec.setImagePullPolicy("IfNotPresent");
    exitHandlerSpec.setCommand(List.of("sh", "-c", exitCommand));
    spec.setExitHandlerSpec(exitHandlerSpec);

    spec.setTtlSecondsAfterFinished(3600); // 1 hour default TTL
    omJob.setSpec(spec);

    return omJob;
  }

  @Test
  void testCronOMJobCreatesOMJobsOnSchedule() {
    MixedOperation<CronOMJobResource, CronOMJobResourceList, Resource<CronOMJobResource>>
        cronOMJobClient = client.resources(CronOMJobResource.class, CronOMJobResourceList.class);

    // Create a CronOMJob with a frequent schedule for testing
    CronOMJobResource cronOMJob =
        createCronOMJob(
            "test-cronjob-" + System.currentTimeMillis(),
            "* * * * *", // Every minute
            "echo 'Scheduled job running'",
            "echo 'Exit handler for scheduled job'");

    cronOMJobClient.inNamespace(TEST_NAMESPACE).create(cronOMJob);

    // Wait for the CronOMJob to create at least one OMJob
    Awaitility.await()
        .atMost(Duration.ofMinutes(2))
        .until(
            () -> {
              CronOMJobResource current =
                  cronOMJobClient
                      .inNamespace(TEST_NAMESPACE)
                      .withName(cronOMJob.getMetadata().getName())
                      .get();
              return current.getStatus() != null && current.getStatus().getLastOMJobName() != null;
            });

    // Verify the created OMJob
    CronOMJobResource finalCronJob =
        cronOMJobClient
            .inNamespace(TEST_NAMESPACE)
            .withName(cronOMJob.getMetadata().getName())
            .get();
    assertNotNull(finalCronJob.getStatus().getLastScheduleTime());
    assertNotNull(finalCronJob.getStatus().getLastOMJobName());
    assertEquals("Created OMJob", finalCronJob.getStatus().getMessage());

    // Clean up
    cronOMJobClient
        .inNamespace(TEST_NAMESPACE)
        .withName(cronOMJob.getMetadata().getName())
        .delete();
  }

  @Test
  void testCronOMJobSuspension() {
    MixedOperation<CronOMJobResource, CronOMJobResourceList, Resource<CronOMJobResource>>
        cronOMJobClient = client.resources(CronOMJobResource.class, CronOMJobResourceList.class);

    // Create a suspended CronOMJob
    CronOMJobResource cronOMJob =
        createCronOMJob(
            "test-suspended-cronjob-" + System.currentTimeMillis(),
            "* * * * *",
            "echo 'Should not run'",
            "echo 'Exit handler'");
    cronOMJob.getSpec().setSuspend(true);

    cronOMJobClient.inNamespace(TEST_NAMESPACE).create(cronOMJob);

    // Wait and verify that no OMJobs are created
    try {
      Thread.sleep(70000); // Wait for more than a minute
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      fail("Test interrupted");
    }

    CronOMJobResource finalCronJob =
        cronOMJobClient
            .inNamespace(TEST_NAMESPACE)
            .withName(cronOMJob.getMetadata().getName())
            .get();
    assertEquals("Suspended", finalCronJob.getStatus().getMessage());
    assertNull(finalCronJob.getStatus().getLastOMJobName());

    // Clean up
    cronOMJobClient
        .inNamespace(TEST_NAMESPACE)
        .withName(cronOMJob.getMetadata().getName())
        .delete();
  }

  @Test
  void testCronOMJobWithStartingDeadline() {
    MixedOperation<CronOMJobResource, CronOMJobResourceList, Resource<CronOMJobResource>>
        cronOMJobClient = client.resources(CronOMJobResource.class, CronOMJobResourceList.class);

    // Create a CronOMJob with a starting deadline
    CronOMJobResource cronOMJob =
        createCronOMJob(
            "test-deadline-cronjob-" + System.currentTimeMillis(),
            "*/5 * * * *", // Every 5 minutes
            "echo 'Job with deadline'",
            "echo 'Exit handler'");
    cronOMJob.getSpec().setStartingDeadlineSeconds(60); // 1 minute deadline

    cronOMJobClient.inNamespace(TEST_NAMESPACE).create(cronOMJob);

    // Wait for at least one schedule
    Awaitility.await()
        .atMost(Duration.ofMinutes(6))
        .until(
            () -> {
              CronOMJobResource current =
                  cronOMJobClient
                      .inNamespace(TEST_NAMESPACE)
                      .withName(cronOMJob.getMetadata().getName())
                      .get();
              return current.getStatus() != null
                  && current.getStatus().getLastScheduleTime() != null;
            });

    CronOMJobResource finalCronJob =
        cronOMJobClient
            .inNamespace(TEST_NAMESPACE)
            .withName(cronOMJob.getMetadata().getName())
            .get();
    assertNotNull(finalCronJob.getStatus());

    // Clean up
    cronOMJobClient
        .inNamespace(TEST_NAMESPACE)
        .withName(cronOMJob.getMetadata().getName())
        .delete();
  }

  private CronOMJobResource createCronOMJob(
      String name, String schedule, String mainCommand, String exitCommand) {
    CronOMJobResource cronOMJob = new CronOMJobResource();

    ObjectMeta metadata = new ObjectMeta();
    metadata.setName(name);
    metadata.setNamespace(TEST_NAMESPACE);
    metadata.setLabels(Map.of("app", "test-cronjob"));
    cronOMJob.setMetadata(metadata);

    CronOMJobSpec spec = new CronOMJobSpec();
    spec.setSchedule(schedule);
    spec.setTimeZone("UTC");
    spec.setStartingDeadlineSeconds(300);
    spec.setSuccessfulJobsHistoryLimit(3);
    spec.setFailedJobsHistoryLimit(1);

    // Create OMJobSpec for the scheduled jobs
    OMJobSpec omJobSpec = new OMJobSpec();

    OMJobSpec.OMJobPodSpec mainPodSpec = new OMJobSpec.OMJobPodSpec();
    mainPodSpec.setImage("busybox:1.28");
    mainPodSpec.setImagePullPolicy("IfNotPresent");
    mainPodSpec.setCommand(List.of("sh", "-c", mainCommand));
    mainPodSpec.setServiceAccountName("openmetadata-ingestion-test");
    omJobSpec.setMainPodSpec(mainPodSpec);

    OMJobSpec.OMJobPodSpec exitHandlerSpec = new OMJobSpec.OMJobPodSpec();
    exitHandlerSpec.setImage("busybox:1.28");
    exitHandlerSpec.setImagePullPolicy("IfNotPresent");
    exitHandlerSpec.setCommand(List.of("sh", "-c", exitCommand));
    omJobSpec.setExitHandlerSpec(exitHandlerSpec);

    omJobSpec.setTtlSecondsAfterFinished(300); // 5 minute TTL for test jobs
    spec.setOmJobSpec(omJobSpec);

    cronOMJob.setSpec(spec);
    return cronOMJob;
  }
}
